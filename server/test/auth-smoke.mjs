#!/usr/bin/env node
// Uses a temporary SQLite directory and a separate random loopback port.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const jar = join(serverDir, "target", "kartsim-server-1.0.0.jar");
const directory = await mkdtemp(join(tmpdir(), "kartsim-auth-smoke-"));
const invite = "AUTH-SMOKE-INVITE";

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function launch(port) {
  const child = spawn("java", ["-jar", jar], {
    cwd: serverDir,
    env: { ...process.env, KART_SERVER_PORT: String(port),
      KART_DATA_DIR: directory, KART_BOOTSTRAP_INVITE: invite },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", chunk => { logs += chunk; });
  child.stderr.on("data", chunk => { logs += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Java exited early:\n${logs}`);
    try {
      const response = await fetch(origin + "/multiplayer/healthz");
      if (response.ok) return { child, origin };
    } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  child.kill("SIGTERM");
  throw new Error(`Java did not become healthy:\n${logs}`);
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function json(origin, path, options = {}) {
  const response = await fetch(origin + path, options);
  const body = await response.json();
  return { status: response.status, body };
}

const port = await freePort();
let processOne;
let processTwo;
try {
  const first = await launch(port);
  processOne = first.child;
  const origin = first.origin;
  const post = (path, body, token) => json(origin, path, {
    method: "POST",
    headers: { "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const account = await post("/multiplayer/auth/register", {
    username: "test_user", nickname: "TestDriver",
    password: "a-local-password-123", invite,
  });
  assert.equal(account.status, 200);
  assert.equal(account.body.account.admin, true);
  assert.equal((await post("/multiplayer/auth/register", {
    username: "another_user", nickname: "AnotherDriver",
    password: "a-local-password-123", invite,
  })).body.error, "INVALID_INVITE");
  assert.equal((await post("/multiplayer/auth/login", {
    username: "test_user", password: "wrong-password",
  })).body.error, "INVALID_CREDENTIALS");
  const login = await post("/multiplayer/auth/login", {
    username: "test_user", password: "a-local-password-123",
  });
  assert.equal(login.status, 200);
  assert.match(login.body.token, /^[A-Za-z0-9_-]{43}$/);
  const token = login.body.token;
  const authHeader = { Authorization: `Bearer ${token}` };
  assert.equal((await json(origin, "/multiplayer/auth/me", {
    headers: authHeader,
  })).body.account.nickname, "TestDriver");
  const changed = await post("/multiplayer/auth/nickname", {
    nickname: "TestDriver2",
  }, token);
  assert.equal(changed.body.account.nickname, "TestDriver2");
  const newInvite = await post("/multiplayer/admin/invites", {}, token);
  assert.equal(newInvite.status, 200);
  assert.match(newInvite.body.invite, /^[A-Za-z0-9_-]{24}$/);

  const owner = randomUUID();
  const key = randomBytes(32).toString("base64url");
  const url = "/api/profile/" + owner;
  const headers = { "Content-Type": "application/json", "X-Profile-Key": key };
  assert.equal((await json(origin, url, {
    method: "PUT", headers, body: JSON.stringify({ nickname: "TestDriver2" }),
  })).status, 200);
  assert.equal((await json(origin, url, { headers: {
    "X-Profile-Key": randomBytes(32).toString("base64url"),
  } })).status, 403);
  assert.equal((await json(origin, url)).status, 403);

  await stop(processOne);
  processOne = undefined;
  const second = await launch(port);
  processTwo = second.child;
  assert.equal((await json(origin, url, { headers })).body.nickname, "TestDriver2");
  assert.equal((await json(origin, "/multiplayer/auth/me", {
    headers: authHeader,
  })).body.account.nickname, "TestDriver2");
  assert.equal((await post("/multiplayer/auth/logout", {}, token)).status, 200);
  assert.equal((await json(origin, "/multiplayer/auth/me", {
    headers: authHeader,
  })).status, 401);
  console.log("Account, invitation, session, profile key and SQLite restart: OK");
} finally {
  if (processOne) await stop(processOne);
  if (processTwo) await stop(processTwo);
  await rm(directory, { recursive: true, force: true });
}
