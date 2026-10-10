#!/usr/bin/env node
// Runs the end-to-end scripts that need an already running cluster
// (test/smoke.mjs, ../server-smoke.mjs, ../server-special-smoke.mjs) against
// a temporary local cluster: one kart-data (open registration,
// KART_TRUSTED_PROXIES=127.0.0.1/32) and two kart-game nodes started by
// lib/local-cluster.mjs with a temporary MySQL database and user and a
// unique Redis prefix, all removed afterwards (also on SIGINT/SIGTERM/SIGHUP).
// Use it instead of pointing the scripts at a development cluster.
//
//   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3307 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6380 \
//     node test/run-cluster-smokes.mjs                 # all three
//   … node test/run-cluster-smokes.mjs smoke special   # a subset: smoke, server-smoke, special
//
// Environment: see lib/local-cluster.mjs (KART_SMOKE_MYSQL_ADMIN is required,
// otherwise everything is skipped; KART_BIN_DIR, KART_SMOKE_SKIP_BUILD=1,
// KART_SMOKE_PORTS=18800-18849, KART_SMOKE_KEEP=1, KART_SMOKE_VERBOSE=1, …).
// KART_SMOKE_TIMEOUT_MS and KART_SMOKE_SETTLE_TIMEOUT_MS are passed on to the
// scripts. server-special-smoke.mjs needs `npm ci` in client/ and is skipped
// without it.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { runLocalCluster, serverDir } from "./lib/local-cluster.mjs";

const root = resolve(serverDir, "..");
const scripts = {
  smoke: join(serverDir, "test/smoke.mjs"),
  "server-smoke": join(root, "server-smoke.mjs"),
  special: join(root, "server-special-smoke.mjs"),
};
const selected = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(scripts);
for (const name of selected) {
  if (!scripts[name]) {
    console.error(`Unknown script ${JSON.stringify(name)}; choose from ${Object.keys(scripts).join(", ")}`);
    process.exit(2);
  }
}

let child;
// A signal ends this process from the cluster's cleanup handler; take the running script along.
process.on("exit", () => child?.kill("SIGTERM"));
await runLocalCluster("run-cluster-smokes", {
  dataEnv: { KART_REGISTRATION: "open", KART_ALLOW_GUESTS: "false" },
  // Unlimited item changers: the item scenarios of server-special-smoke.mjs
  // swap and change with them (the card inventories are covered by the Go tests).
  // The scripts race without driving and finish at once, which the
  // anti-cheat would kick (ANTICHEAT.md): it only records here, so the
  // records still travel the outbox to the data service.
  gameEnv: { KART_ALLOW_GUESTS: "false", KART_ITEM_CHANGERS: "infinite", KART_ANTICHEAT: "log" },
  nodes: [{ nodeId: "game-1", name: "游戏服 1" }, { nodeId: "game-2", name: "游戏服 2" }],
}, async ctx => {
  // The scripts get this cluster only: overrides aimed at another one are dropped.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !["KART_GAME_ORIGINS", "KART_GAME_NODE", "KART_SMOKE_ACCOUNTS", "KART_SERVER_BASE",
      "KART_SERVER_ORIGIN"].includes(key)));
  Object.assign(env, { KART_DATA_ORIGIN: ctx.dataOrigin,
    KART_SMOKE_SETTLE_TIMEOUT_MS: process.env.KART_SMOKE_SETTLE_TIMEOUT_MS ?? String(ctx.settleMs) });
  const failed = [];
  for (const name of selected) {
    if (name === "special" && !existsSync(join(root, "client/node_modules/tsx"))) {
      console.log(`\n- ${name}: skipped (run npm ci in client/ first)`);
      continue;
    }
    console.log(`\n===== ${name}: ${scripts[name]} =====`);
    const code = await new Promise(done => {
      child = spawn(process.execPath, [scripts[name]], { cwd: root, env, stdio: "inherit" });
      child.once("exit", (exitCode, signal) => done(signal ? 1 : exitCode));
    });
    child = undefined;
    if (code !== 0) failed.push(name);
    if (ctx.cleaning) break;
  }
  if (failed.length > 0) throw new Error(`failed: ${failed.join(", ")}`);
  console.log(`\nPASS: ${selected.join(", ")} against a temporary cluster`);
});
