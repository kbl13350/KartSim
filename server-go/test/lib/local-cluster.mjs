// Launcher for the self-contained end-to-end scripts (auth-smoke.mjs,
// economy-smoke.mjs): builds (or reuses) server-go/bin/{kart-data,kart-game},
// creates a temporary MySQL database and user plus a unique Redis key
// prefix, starts one kart-data and the requested kart-game nodes on free
// loopback ports and removes everything again on every exit path (success,
// failure, SIGINT, SIGTERM, SIGHUP).
//
// Environment (shared by the scripts that use it):
//   KART_SMOKE_MYSQL_ADMIN   mysql CLI arguments of an admin connection, e.g. "-h127.0.0.1 -P3307 -uroot"
//                            (split on whitespace; required, otherwise the script is skipped)
//   KART_SMOKE_MYSQL_ADDR    host:port the services use (default: -h/-P from the admin arguments)
//   KART_SMOKE_REDIS_ADDR    default 127.0.0.1:6380; KART_SMOKE_REDIS_PASSWORD / KART_SMOKE_REDIS_DB
//   KART_SMOKE_SKIP_BUILD=1  use the existing binaries; KART_BIN_DIR uses binaries from another directory
//   KART_SMOKE_PORTS         port range for the services, e.g. 18800-18849 (default: any free port)
//   KART_SMOKE_KEEP=1        keep the database, user, Redis keys and work directory for debugging
//   KART_SMOKE_VERBOSE=1     stream service logs
//   KART_SMOKE_TIMEOUT_MS / KART_SMOKE_SETTLE_TIMEOUT_MS (default 8000 / 60000: covers outbox back-off)
//
// kart-data always runs with KART_TRUSTED_PROXIES=127.0.0.1/32 so the
// per-player X-Forwarded-For addresses of the scripts (kart-client.mjs)
// keep the registration rate limit (5 per hour per client IP) per player.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { discoverCluster, http, httpOk, poll } from "./kart-client.mjs";
import { MiniRedis } from "./redis-mini.mjs";

const run = promisify(execFile);
export const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const CLUSTER_KEY_HEADER = "X-Kart-Cluster-Key";

/** Settings of the self-contained scripts; undefined when KART_SMOKE_MYSQL_ADMIN is unset. */
export function readLocalSettings(env = process.env) {
  const adminSpec = env.KART_SMOKE_MYSQL_ADMIN?.trim();
  if (!adminSpec) return undefined;
  const settings = {
    adminSpec,
    adminArgs: adminSpec.split(/\s+/),
    mysqlAddr: env.KART_SMOKE_MYSQL_ADDR?.trim() || undefined,
    redisAddr: env.KART_SMOKE_REDIS_ADDR?.trim() || "127.0.0.1:6380",
    redisPassword: env.KART_SMOKE_REDIS_PASSWORD ?? "",
    redisDb: Number(env.KART_SMOKE_REDIS_DB ?? 0),
    keep: env.KART_SMOKE_KEEP === "1",
    verbose: env.KART_SMOKE_VERBOSE === "1",
    build: env.KART_SMOKE_SKIP_BUILD !== "1" && !env.KART_BIN_DIR,
    binDir: env.KART_BIN_DIR ? resolve(env.KART_BIN_DIR) : join(serverDir, "bin"),
    ports: parsePortRange(env.KART_SMOKE_PORTS),
    timeoutMs: Number(env.KART_SMOKE_TIMEOUT_MS ?? 8000),
    settleMs: Number(env.KART_SMOKE_SETTLE_TIMEOUT_MS ?? 60_000),
  };
  assert.ok(Number.isInteger(settings.redisDb) && settings.redisDb >= 0, "Invalid KART_SMOKE_REDIS_DB");
  assert.ok(Number.isFinite(settings.timeoutMs) && settings.timeoutMs >= 1000, "Invalid KART_SMOKE_TIMEOUT_MS");
  assert.ok(Number.isFinite(settings.settleMs) && settings.settleMs >= 1000,
    "Invalid KART_SMOKE_SETTLE_TIMEOUT_MS");
  return settings;
}

function parsePortRange(value) {
  if (!value?.trim()) return undefined;
  const match = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(value);
  assert.ok(match, `KART_SMOKE_PORTS must look like 18800-18849, got ${JSON.stringify(value)}`);
  const [low, high] = [Number(match[1]), Number(match[2])];
  assert.ok(low >= 1024 && high <= 65535 && low <= high, `Invalid KART_SMOKE_PORTS ${value}`);
  return { low, high };
}

/** Value of a mysql CLI option such as -h/--host in the admin arguments. */
function adminOption(adminArgs, short, long) {
  for (let index = 0; index < adminArgs.length; index++) {
    const arg = adminArgs[index];
    if (arg === short || arg === long) return adminArgs[index + 1];
    if (arg.startsWith(`${long}=`)) return arg.slice(long.length + 1);
    if (arg.startsWith(short) && !arg.startsWith("--") && arg.length > short.length) {
      return arg.slice(short.length);
    }
  }
  return undefined;
}

function mysqlAddress(settings) {
  if (settings.mysqlAddr) return settings.mysqlAddr;
  const host = adminOption(settings.adminArgs, "-h", "--host") ?? "127.0.0.1";
  const port = adminOption(settings.adminArgs, "-P", "--port") ?? "3306";
  return `${host === "localhost" ? "127.0.0.1" : host}:${port}`;
}

const canListen = port => new Promise(done => {
  const server = createServer();
  server.once("error", () => done(false));
  server.listen(port, "127.0.0.1", () => server.close(() => done(true)));
});

/** `count` free loopback ports, from KART_SMOKE_PORTS when set. */
async function freePorts(count, range) {
  if (range) {
    const ports = [];
    for (let port = range.low; port <= range.high && ports.length < count; port++) {
      if (await canListen(port)) ports.push(port);
    }
    assert.equal(ports.length, count, `KART_SMOKE_PORTS ${range.low}-${range.high} has fewer than ${count} free ports`);
    return ports;
  }
  const servers = [];
  for (let index = 0; index < count; index++) {
    const server = createServer();
    await new Promise(done => server.listen(0, "127.0.0.1", done));
    servers.push(server);
  }
  const ports = servers.map(server => server.address().port);
  await Promise.all(servers.map(server => new Promise(done => server.close(done))));
  return ports;
}

/** Quotes a value for a MySQL string literal. */
export const sqlString = value => `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** One service process with captured logs. */
class Service {
  constructor(harness, label, kind, env) {
    Object.assign(this, { harness, label, kind, env, logs: "", child: undefined });
    this.binary = join(harness.settings.binDir, `kart-${kind}`);
  }

  start() {
    // A signal can start cleanup while the test is still running; a service
    // started after that would outlive this process.
    if (this.harness.cleaning) throw new Error(`${this.label}: not started, cleaning up`);
    this.logs = "";
    this.child = spawn(this.binary, [], {
      cwd: this.harness.workDir, env: { ...this.harness.baseEnv, ...this.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    this.exited = new Promise(done => this.child.once("exit", (code, signal) => done({ code, signal })));
    const capture = chunk => {
      const text = chunk.toString();
      this.logs = (this.logs + text).slice(-200_000);
      if (this.harness.settings.verbose) process.stderr.write(text.replace(/^(?=.)/gm, `[${this.label}] `));
    };
    this.child.stdout.on("data", capture);
    this.child.stderr.on("data", capture);
    this.child.once("error", error => { this.logs += `\nspawn failed: ${error.message}`; });
  }

  get running() {
    return this.child !== undefined && this.child.exitCode === null && this.child.signalCode === null;
  }

  async waitHealthy(origin, service, limitMs) {
    const deadline = Date.now() + limitMs;
    while (Date.now() < deadline) {
      if (!this.running) throw new Error(`${this.label} exited during startup:\n${this.logs}`);
      try {
        const response = await fetch(origin + "/multiplayer/healthz", { signal: AbortSignal.timeout(1000) });
        if (response.ok && (await response.json()).service === service) return;
      } catch { /* still starting */ }
      await delay(200);
    }
    throw new Error(`${this.label} did not become healthy within ${limitMs} ms:\n${this.logs}`);
  }

  async stop() {
    if (!this.running) return;
    this.child.kill("SIGTERM");
    // Game nodes flush their outbox for up to 5 s on shutdown.
    await Promise.race([this.exited, delay(10_000)]);
    if (this.running) {
      console.warn(`${this.label} ignored SIGTERM; killing it`);
      this.child.kill("SIGKILL");
      await this.exited;
    }
  }
}

/**
 * A running local cluster. Created by runLocalCluster(); the body receives
 * it as `ctx`.
 */
class LocalCluster {
  constructor(name, settings) {
    this.name = name;
    this.settings = settings;
    this.id = randomBytes(4).toString("hex");
    this.database = `kartsim_${name.replace(/[^a-z0-9]/gi, "_")}_${this.id}`;
    this.mysqlUser = `ks_${this.id}`;
    this.mysqlPassword = `${randomBytes(12).toString("hex")}Aa1_`;
    this.redisPrefix = `kart-${name}-${this.id}:`;
    this.secret = randomBytes(36).toString("base64url");
    this.dataNode = `data-${name.replace(/[^A-Za-z0-9_-]/g, "-")}`.slice(0, 64);
    this.timeoutMs = settings.timeoutMs;
    this.settleMs = settings.settleMs;
    this.services = [];
    this.sockets = [];
    this.cleaning = undefined;
    this.pendingAdmin = Promise.resolve();
    this.databaseCreated = false;
    // Services inherit the environment minus every KART_* setting of the shell.
    this.baseEnv = Object.fromEntries(Object.entries(process.env)
      .filter(([key]) => !key.startsWith("KART_") && key !== "SERVER_ADDRESS"));
  }

  /** Runs SQL with the admin connection (in the test database once it exists); returns stdout. */
  async mysqlAdmin(sql, { duringCleanup = false, database } = {}) {
    if (this.cleaning && !duringCleanup) throw new Error("mysql: not run, cleaning up");
    const call = run("mysql", [...this.settings.adminArgs, "--batch", "--skip-column-names",
      ...(database ? ["-D", database] : []), "-e", sql], { timeout: 20_000 });
    // The latest admin statement; cleanup waits for it so that a CREATE still
    // running when a signal arrives cannot finish after the DROP.
    this.pendingAdmin = call.catch(() => {});
    try {
      const { stdout } = await call;
      return stdout;
    } catch (error) {
      throw new Error(`mysql ${this.settings.adminSpec} failed: ${error.stderr?.trim() || error.message}`);
    }
  }

  /** SELECT in the test database → rows of strings (NULL as null). */
  async query(sql) {
    const output = await this.mysqlAdmin(sql, { database: this.database });
    return output.split("\n").filter(line => line.length > 0)
      .map(line => line.split("\t").map(cell => (cell === "NULL" ? null : cell)));
  }

  /** Signs claims like internal/shared/ticket with the cluster secret. */
  forgeTicket(claims) {
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
    const signature = createHmac("sha256", this.secret).update(`kt1.${body}`).digest("base64url");
    return `kt1.${body}.${signature}`;
  }

  /** POST to the internal API with the cluster key (key: null sends none); returns the raw result. */
  internalPost(path, body, { key = this.secret } = {}) {
    return http(this.internalOrigin, path, { method: "POST", body, timeoutMs: this.timeoutMs,
      headers: key === null ? {} : { [CLUSTER_KEY_HEADER]: key } });
  }

  /** Remembers a ControlSocket (or anything with close()) to close on cleanup. */
  track(socket) {
    this.sockets.push(socket);
    return socket;
  }

  dataService(extraEnv = {}) {
    return new Service(this, `kart-data#${this.services.filter(service => service.kind === "data").length + 1}`,
      "data", { ...this.dataEnv, ...extraEnv });
  }

  /** Starts a new kart-data with the base environment plus `extraEnv`. */
  async startData(extraEnv = {}) {
    this.data = this.dataService(extraEnv);
    this.services.push(this.data);
    this.data.start();
    await this.data.waitHealthy(this.dataOrigin, "data", 60_000);
    return this.data;
  }

  async stopData() {
    await this.data?.stop();
  }

  /** Waits until every game node is in /multiplayer/game-servers (after a data restart). */
  async waitNodesListed(limitMs = 20_000) {
    const ids = this.games.map(game => game.nodeId);
    await poll(async () => {
      const list = await httpOk(this.dataOrigin, "/multiplayer/game-servers", { timeoutMs: this.timeoutMs });
      return ids.every(nodeId => list.servers.some(server => server.nodeId === nodeId));
    }, { timeoutMs: limitMs, description: `${ids.join(", ")} in /multiplayer/game-servers` });
  }

  /** Re-reads the game-server list (e.g. after a data restart). */
  async discover() {
    this.cluster = await discoverCluster({ dataOrigin: this.dataOrigin, timeoutMs: this.timeoutMs,
      settleMs: this.settleMs, gameOrigins: [] });
    assert.equal(this.cluster.dataNode, this.dataNode);
    return this.cluster;
  }

  /** The discovered server entry of a game node. */
  node(nodeId) {
    const server = this.cluster.servers.find(candidate => candidate.nodeId === nodeId);
    assert.ok(server, `${nodeId} is not in the game-server list`);
    return server;
  }

  async setUp({ dataEnv = {}, gameEnv = {}, nodes }) {
    await run("mysql", ["--version"]).catch(() => {
      throw new Error("The mysql command-line client is required (brew install mysql-client)");
    });
    const { redisAddr, redisPassword, redisDb } = this.settings;
    this.redis = await MiniRedis.connect(redisAddr, { password: redisPassword, db: redisDb })
      .catch(error => { throw new Error(`Redis ${redisAddr} is not reachable: ${error.message}`); });
    assert.equal(await this.redis.command("PING"), "PONG");

    // Marked first: cleanup uses DROP ... IF EXISTS, so a failing CREATE USER or
    // GRANT (or a signal during setup) still removes the database and the user.
    this.databaseCreated = true;
    await this.mysqlAdmin(`CREATE DATABASE \`${this.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci;`);
    await this.mysqlAdmin(`CREATE USER '${this.mysqlUser}'@'%' IDENTIFIED BY '${this.mysqlPassword}';
      GRANT ALL PRIVILEGES ON \`${this.database}\`.* TO '${this.mysqlUser}'@'%';`);
    const dsn = `${this.mysqlUser}:${this.mysqlPassword}@tcp(${mysqlAddress(this.settings)})/${this.database}` +
      "?charset=utf8mb4&collation=utf8mb4_0900_as_ci";

    if (this.settings.build) {
      console.log("Building kart-data and kart-game…");
      await run("go", ["build", "-o", "bin/", "./cmd/kart-data", "./cmd/kart-game"],
        { cwd: serverDir, timeout: 600_000 }).catch(error => {
        throw new Error(`go build failed:\n${error.stderr || error.message}`);
      });
    }
    for (const binary of ["kart-data", "kart-game"]) {
      await access(join(this.settings.binDir, binary)).catch(() => {
        throw new Error(`${join(this.settings.binDir, binary)} is missing; ` +
          "run: go build -o bin/ ./cmd/kart-data ./cmd/kart-game");
      });
    }

    this.workDir = await mkdtemp(join(tmpdir(), `kartsim-${this.name}-`));
    const [dataPort, internalPort, ...gamePorts] = await freePorts(2 + nodes.length, this.settings.ports);
    this.dataOrigin = `http://127.0.0.1:${dataPort}`;
    this.internalOrigin = `http://127.0.0.1:${internalPort}`;
    this.dataEnv = {
      KART_DATA_ADDR: "127.0.0.1", KART_DATA_PORT: String(dataPort),
      KART_INTERNAL_LISTEN: `127.0.0.1:${internalPort}`, KART_MYSQL_DSN: dsn,
      KART_REDIS_ADDR: redisAddr, KART_REDIS_PREFIX: this.redisPrefix,
      ...(redisPassword ? { KART_REDIS_PASSWORD: redisPassword } : {}),
      ...(redisDb ? { KART_REDIS_DB: String(redisDb) } : {}),
      KART_CLUSTER_SECRET: this.secret, KART_DATA_NODE_ID: this.dataNode,
      KART_TRUSTED_PROXIES: "127.0.0.1/32",
      ...dataEnv,
    };
    await this.startData();

    this.games = nodes.map(({ nodeId, name }, index) => {
      const port = gamePorts[index];
      const service = new Service(this, nodeId, "game", {
        KART_GAME_ADDR: "127.0.0.1", KART_GAME_PORT: String(port), KART_NODE_ID: nodeId,
        KART_NODE_NAME: name, KART_PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
        KART_DATA_INTERNAL_URL: this.internalOrigin, KART_DATA_NODE_ID: this.dataNode,
        KART_CLUSTER_SECRET: this.secret, KART_OUTBOX_DIR: join(this.workDir, `outbox-${nodeId}`),
        ...gameEnv,
      });
      return Object.assign(service, { nodeId, origin: `http://127.0.0.1:${port}` });
    });
    this.services.push(...this.games);
    for (const game of this.games) game.start();
    for (const game of this.games) await game.waitHealthy(game.origin, "game", 30_000);
    await this.waitNodesListed(15_000);
    await this.discover();
  }

  cleanup() {
    this.cleaning ??= (async () => {
      for (const socket of this.sockets) {
        try { socket.close(); } catch { /* already closed */ }
      }
      // Game nodes first, so their shutdown can still reach the data service.
      const order = [...this.services.filter(service => service.kind === "game"),
        ...this.services.filter(service => service.kind !== "game")];
      for (const service of order) {
        await service.stop().catch(error => console.warn(`${service.label}: ${error.message}`));
      }
      if (this.settings.keep) {
        console.log(`KART_SMOKE_KEEP=1: kept database ${this.database}, MySQL user ${this.mysqlUser}, ` +
          `Redis prefix ${this.redisPrefix} and ${this.workDir ?? "(no work directory)"}`);
        this.redis?.close();
        return;
      }
      if (this.databaseCreated) {
        await this.pendingAdmin;
        await this.mysqlAdmin(`DROP DATABASE IF EXISTS \`${this.database}\`; ` +
          `DROP USER IF EXISTS '${this.mysqlUser}'@'%';`, { duringCleanup: true })
          .catch(error => console.warn(`Could not drop ${this.database}/${this.mysqlUser}: ${error.message}`));
      }
      if (this.redis) {
        await this.redis.deletePrefix(this.redisPrefix)
          .catch(error => console.warn(`Could not delete Redis keys ${this.redisPrefix}*: ${error.message}`));
        this.redis.close();
      }
      if (this.workDir) await rm(this.workDir, { recursive: true, force: true });
    })();
    return this.cleaning;
  }

  printLogs() {
    for (const service of this.services) {
      if (service.logs) console.error(`\n----- ${service.label} log (tail) -----\n${service.logs.slice(-8000)}`);
    }
  }
}

/**
 * Starts a local cluster, runs `body(ctx)` and always cleans up. Prints SKIP
 * and exits 0 when KART_SMOKE_MYSQL_ADMIN is unset; on failure prints FAIL,
 * the service log tails and sets exit code 1.
 *
 *   options.dataEnv / options.gameEnv  extra environment of kart-data / every kart-game
 *   options.nodes                      [{nodeId, name}] game nodes to start
 */
export async function runLocalCluster(name, options, body) {
  const settings = readLocalSettings();
  if (!settings) {
    console.log(`SKIP ${name}: set KART_SMOKE_MYSQL_ADMIN to the mysql CLI arguments of an admin ` +
      `connection, e.g. KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3307 -uroot' node test/${name}.mjs`);
    return;
  }
  const ctx = new LocalCluster(name, settings);
  let interrupted;
  // A CI timeout or `kill` sends SIGTERM; closing the terminal sends SIGHUP.
  for (const [signal, code] of [["SIGINT", 130], ["SIGTERM", 143], ["SIGHUP", 129]]) {
    process.once(signal, () => {
      interrupted = signal;
      console.error(`${signal}; cleaning up…`);
      ctx.cleanup().finally(() => process.exit(code));
    });
  }
  try {
    await ctx.setUp(options);
    await body(ctx);
  } catch (error) {
    if (interrupted) {
      // The services were stopped under the running test; its error is a consequence.
      console.error(`Interrupted by ${interrupted}.`);
    } else {
      console.error("FAIL:", error instanceof Error ? error.stack ?? error.message : error);
      ctx.printLogs();
    }
    process.exitCode = 1;
  } finally {
    await ctx.cleanup();
  }
}
