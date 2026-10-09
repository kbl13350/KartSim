// Checks of ../run-full-local.sh that end before anything is built or
// started: invalid settings must be refused with a clear message.
//   node --test test/launcher.test.mjs
// Uses free high ports, so it never probes the default 8787/8788/8790/8780.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = resolve(dirname(fileURLToPath(import.meta.url)), "../../run-full-local.sh");

async function freePorts(count) {
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

/** Runs the launcher with only `env` set among the KART_ and VITE_ variables. */
async function launch(env) {
  const [data, internal, game, vite] = await freePorts(4);
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
    !name.startsWith("KART_") && !name.startsWith("VITE_") && name !== "SERVER_ADDRESS"));
  const result = spawnSync("bash", [script], {
    env: {
      ...inherited,
      KART_DATA_PORT: String(data), KART_INTERNAL_LISTEN: `127.0.0.1:${internal}`,
      KART_GAME_BASE_PORT: String(game), KART_VITE_PORT: String(vite), ...env,
    },
    encoding: "utf8", timeout: 30_000,
  });
  return { status: result.status, output: result.stdout + result.stderr };
}

test("same-origin without a same-origin proxy is refused", async () => {
  const { status, output } = await launch({ KART_GAME_PUBLIC_ORIGIN: "same-origin" });
  assert.equal(status, 1, output);
  assert.match(output, /KART_GAME_PUBLIC_ORIGIN=same-origin 需要同源代理/);
  assert.match(output, /run-lan\.sh/);
});

test("same-origin passes the proxy check with run-lan.sh or an explicit proxy origin", async () => {
  // A malformed DSN stops the script right after the proxy check, before
  // anything is built or started.
  for (const proxy of [{ VITE_MULTIPLAYER_SAME_ORIGIN: "1" },
    { VITE_MULTIPLAYER_BACKEND_ORIGIN: "https://kart.example.com" }]) {
    const { status, output } = await launch({
      KART_GAME_PUBLIC_ORIGIN: "same-origin", KART_MYSQL_DSN: "kart@tcp(127.0.0.1:1)", ...proxy,
    });
    assert.equal(status, 1, output);
    assert.doesNotMatch(output, /需要同源代理/);
    assert.match(output, /KART_MYSQL_DSN 格式不正确/);
  }
});

test("a malformed KART_MYSQL_DSN is reported without its password", async () => {
  for (const [dsn, shown] of [
    ["kart:Pr0dSecret@tcp(db:3306)", "kart:***@tcp(db:3306)"],
    // go-sql-driver splits the credentials at the last @ and the user at the first :.
    ["kart:Pr0d@Se:cret@tcp(db:3306)", "kart:***@tcp(db:3306)"],
    ["kart@tcp(db:3306)", "kart@tcp(db:3306)"],
  ]) {
    const { status, output } = await launch({ KART_MYSQL_DSN: dsn });
    assert.equal(status, 1, output);
    assert.ok(output.includes(`KART_MYSQL_DSN 格式不正确（缺少 /库名）：${shown}`), output);
    assert.doesNotMatch(output, /Pr0d|Se:cret/);
  }
});

test("an unknown KART_REGISTRATION is refused before anything starts", async () => {
  const { status, output } = await launch({ KART_REGISTRATION: "public" });
  assert.equal(status, 1, output);
  assert.match(output, /KART_REGISTRATION 只能是 open、invite 或 closed，当前为：public/);
});

test("invalid KART_ADMIN_USERNAMES entries are refused", async () => {
  const { status, output } = await launch({ KART_ADMIN_USERNAMES: "alice, bad name! " });
  assert.equal(status, 1, output);
  assert.match(output, /KART_ADMIN_USERNAMES 中的“bad name!”不是有效用户名/);
});

test("valid account settings pass the launcher checks", async () => {
  // A malformed DSN stops the script right after the configuration checks.
  const { status, output } = await launch({ KART_REGISTRATION: "invite", KART_ADMIN_USERNAMES: " alice , Bob_2,",
    KART_MYSQL_DSN: "kart@tcp(127.0.0.1:1)" });
  assert.equal(status, 1, output);
  assert.doesNotMatch(output, /KART_REGISTRATION|KART_ADMIN_USERNAMES/);
  assert.match(output, /KART_MYSQL_DSN 格式不正确/);
});
