#!/usr/bin/env node
// Self-contained cluster check: builds and launches its own kart-data (in
// KART_REGISTRATION=invite mode) and two kart-game nodes (server-go/bin) on
// free loopback ports, with a temporary MySQL database and user plus a
// unique Redis key prefix, then verifies invitations, accounts, sessions,
// onboarding before tickets, profile keys, entry tickets (guest tickets are
// refused), cluster-wide nicknames and one live session per account
// (ACCOUNT_ONLINE on another node), the settlement outbox (an instant finish
// earns the unfinished reward) and persistence across a data-service restart. Everything it creates is removed at the end
// (also on SIGINT/SIGTERM/SIGHUP). The account economy itself is covered by
// economy-smoke.mjs.
//
//   KART_SMOKE_MYSQL_ADMIN='-h127.0.0.1 -P3307 -uroot' KART_SMOKE_REDIS_ADDR=127.0.0.1:6380 \
//     node test/auth-smoke.mjs
//
// Environment: see test/lib/local-cluster.mjs (KART_SMOKE_MYSQL_ADMIN is
// required, otherwise the test is skipped; KART_SMOKE_MYSQL_ADDR,
// KART_SMOKE_REDIS_ADDR/_PASSWORD/_DB, KART_SMOKE_SKIP_BUILD=1, KART_BIN_DIR,
// KART_SMOKE_PORTS, KART_SMOKE_KEEP=1, KART_SMOKE_VERBOSE=1,
// KART_SMOKE_TIMEOUT_MS, KART_SMOKE_SETTLE_TIMEOUT_MS).
//
// Registration is rate limited per client IP (5 per hour): kart-data runs
// with KART_TRUSTED_PROXIES=127.0.0.1/32 and every registration below sends
// its own X-Forwarded-For address.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  ControlSocket, Player, assertApiError, assertRaceRewards, enterGame, equipmentFromInventory, expectRejectedEntry,
  expectRejectedHello, expectRoomRules, expectSettlement, guestNameAvailable, helloFields, http, httpOk,
  issueTicket, poll, randomForwardedFor, ticketClaims,
} from "./lib/kart-client.mjs";
import { raceRewards } from "./lib/economy.mjs";
import { runLocalCluster } from "./lib/local-cluster.mjs";

const invite = "AUTH-SMOKE-INVITE";
const password = "a-local-password-123";

await runLocalCluster("auth-smoke", {
  dataEnv: {
    KART_REGISTRATION: "invite", KART_BOOTSTRAP_INVITE: invite,
    // Admins are named explicitly; the first registrant is not assumed to be one.
    KART_ADMIN_USERNAMES: "test_user", KART_ALLOW_GUESTS: "false",
  },
  gameEnv: { KART_ALLOW_GUESTS: "false" },
  nodes: [{ nodeId: "smoke-a", name: "Smoke A" }, { nodeId: "smoke-b", name: "Smoke B" }],
}, async ctx => {
  const { dataOrigin, internalOrigin, cluster, timeoutMs, settleMs, id, redis, redisPrefix, dataNode } = ctx;
  const nodeA = ctx.node("smoke-a");
  const nodeB = ctx.node("smoke-b");
  assert.deepEqual(cluster.servers.map(server => server.name), ["Smoke A", "Smoke B"]);
  assert.equal(nodeA.origin, ctx.games[0].origin);
  console.log("✓ data service and two game nodes started and registered");

  // Every registration or login uses its own client address (rate limit).
  const xff = () => ({ "X-Forwarded-For": randomForwardedFor() });
  const post = (path, body, token, headers = {}) =>
    http(dataOrigin, path, { method: "POST", body, token, headers, timeoutMs });
  const get = (path, options = {}) => http(dataOrigin, path, { timeoutMs, ...options });
  const registerAs = (fields, headers = xff()) => post("/multiplayer/auth/register", fields, undefined, headers);
  const loginAs = async username => {
    const result = await post("/multiplayer/auth/login", { username, password }, undefined, xff());
    assert.equal(result.status, 200, result.text);
    return result.body.token;
  };

  const config = await httpOk(dataOrigin, "/multiplayer/auth/config", { timeoutMs });
  assert.equal(config.registration, "invite", `auth/config: ${JSON.stringify(config)}`);
  assert.equal(config.loginRequired, true);
  assert.equal(config.guests, false);

  // Accounts, invitations and sessions (same flow as the Java auth smoke test).
  const account = await registerAs({ username: "test_user", nickname: "TestDriver", password, invite });
  assert.equal(account.status, 200, account.text);
  assert.equal(account.body.account.admin, true, "test_user is listed in KART_ADMIN_USERNAMES");
  assertApiError(await registerAs({ username: "another_user", nickname: "AnotherDriver", password, invite }),
    400, "INVALID_INVITE", "reused bootstrap invite");
  assertApiError(await registerAs({ username: "another_user", nickname: "AnotherDriver", password }),
    400, "INVALID_INVITE", "invite mode without an invite");
  assertApiError(await post("/multiplayer/auth/login", {
    username: "test_user", password: "wrong-password",
  }, undefined, xff()), 401, "INVALID_CREDENTIALS", "wrong password");
  const token = await loginAs("test_user");
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await get("/multiplayer/auth/me", { token })).body.account.nickname, "TestDriver");
  const changed = await post("/multiplayer/auth/nickname", { nickname: "TestDriver2" }, token);
  assert.equal(changed.body.account.nickname, "TestDriver2");
  const invites = [];
  for (let index = 0; index < 2; index++) {
    const created = await post("/multiplayer/admin/invites", {}, token);
    assert.equal(created.status, 200, created.text);
    assert.match(created.body.invite, /^[A-Za-z0-9_-]{24}$/);
    invites.push(created.body.invite);
  }

  const second = await registerAs({ username: "second_user", nickname: "SecondDriver", password, invite: invites[0] });
  assert.equal(second.status, 200, second.text);
  assert.equal(second.body.account.admin, false);
  const secondToken = await loginAs("second_user");
  assertApiError(await post("/multiplayer/admin/invites", {}, secondToken), 403, "ADMIN_REQUIRED",
    "invite by a non-admin");
  assertApiError(await post("/multiplayer/auth/nickname", { nickname: "testdriver2" }, secondToken),
    409, "NICKNAME_TAKEN", "case-insensitive nickname collision");
  // utf8mb4_0900_as_ci: case-insensitive but accent-sensitive, like the Java service.
  const accented = await post("/multiplayer/auth/nickname", { nickname: "TéstDriver2" }, secondToken);
  assert.equal(accented.status, 200, `accent-distinct nickname rejected: ${accented.text}`);
  const late = await registerAs({ username: "late_user", nickname: "LateDriver", password, invite: invites[1] });
  assert.equal(late.status, 200, late.text);
  const lateToken = await loginAs("late_user");
  const guestCheck = await guestNameAvailable(cluster, "TESTDRIVER2");
  if (guestCheck !== undefined) assert.equal(guestCheck, false, "a guest name must not be an account nickname");
  console.log("✓ invitation, registration, login, rename, admin invite and nickname collation");

  const owner = randomUUID();
  const key = randomBytes(32).toString("base64url");
  const profilePath = "/api/profile/" + owner;
  const headers = { "X-Profile-Key": key };
  assert.equal((await http(dataOrigin, profilePath, {
    method: "PUT", headers, body: { nickname: "TestDriver2" }, timeoutMs,
  })).status, 200);
  assert.equal((await get(profilePath, {
    headers: { "X-Profile-Key": randomBytes(32).toString("base64url") },
  })).status, 403);
  assert.equal((await get(profilePath)).status, 403);
  console.log("✓ profile key ownership");

  // The internal API needs the cluster key and is not served on public ports.
  const heartbeatPath = "/internal/v1/nodes/heartbeat";
  assertApiError(await ctx.internalPost(heartbeatPath, { nodeId: "intruder" }, { key: null }),
    401, "CLUSTER_KEY_INVALID", "internal API without key");
  assertApiError(await ctx.internalPost(heartbeatPath, { nodeId: "intruder" }, { key: "x".repeat(48) }),
    401, "CLUSTER_KEY_INVALID", "internal API with a wrong key");
  assertApiError(await ctx.internalPost("/internal/v1/equipment/verify", { accountId: "x", equipment: {} },
    { key: null }), 401, "CLUSTER_KEY_INVALID", "equipment verification without key");
  assert.equal((await post(heartbeatPath, { nodeId: "intruder" })).status, 404,
    "the internal API must not be reachable on the public port");
  assert.equal((await http(nodeA.connectOrigin, "/api/race-results", { timeoutMs })).status, 404,
    "game nodes serve only healthz and the WebSocket");
  console.log("✓ internal API requires the cluster key and stays off public ports");

  // No guests: a ticket needs a session, and an account must claim its starter kit first.
  const ticketPath = "/multiplayer/game-servers/ticket";
  assertApiError(await post(ticketPath, { nodeId: nodeA.nodeId }), 401, "LOGIN_REQUIRED", "guest ticket");
  assertApiError(await post(ticketPath, { nodeId: nodeA.nodeId }, token), 403, "ONBOARDING_REQUIRED",
    "ticket before the starter kit is claimed");
  const onboard = async (username, nickname, sessionToken, choice) => {
    const player = new Player({ dataOrigin, timeoutMs, username, nickname, password, token: sessionToken,
      forwardedFor: randomForwardedFor() });
    const claimed = await player.call("/api/account/starter", { method: "POST", body: choice });
    assert.ok(claimed.status >= 200 && claimed.status < 300, `${username} starter claim: ${claimed.text}`);
    player.equipment = equipmentFromInventory(await player.inventory(), choice);
    return player;
  };
  const driverPlayer = await onboard("test_user", "TestDriver2", token, { character: 2, paint: 6, dye: 6 });
  const secondPlayer = await onboard("second_user", "TéstDriver2", secondToken, { character: 3, paint: 4, dye: 5 });
  const latePlayer = await onboard("late_user", "LateDriver", lateToken, { character: 2, paint: 7, dye: 7 });
  console.log("✓ guest tickets refused (LOGIN_REQUIRED); tickets need the starter kit (ONBOARDING_REQUIRED)");

  // Tickets: account claims, invalid sessions, forged and misrouted tickets.
  const accountTicket = await issueTicket(cluster, nodeA, driverPlayer);
  const claims = ticketClaims(accountTicket.ticket);
  assert.equal(claims.nick, "TestDriver2");
  assert.equal(claims.usr, "test_user");
  assert.equal(claims.adm, true);
  assert.ok(typeof claims.aid === "string" && claims.aid.length > 0);
  assertApiError(await post(ticketPath, { nodeId: nodeA.nodeId }, "B".repeat(43)),
    401, "LOGIN_REQUIRED", "ticket with an unknown session");
  const lateClaims = ticketClaims((await issueTicket(cluster, nodeA, latePlayer)).ticket);
  const now = Date.now();
  const forged = overrides => ctx.forgeTicket({
    ...lateClaims, nonce: randomBytes(16).toString("base64url"), iat: now, exp: now + 120_000, ...overrides,
  });
  const forgedEntry = ctx.track(await ControlSocket.connect(nodeA.wsUrl, { timeoutMs, label: "forged" }));
  const forgedWelcome = await forgedEntry.send(helloFields("LateDriver", forged({}), latePlayer.equipment));
  assert.equal(forgedWelcome.type, "welcome", "kart-game must accept a ticket signed with " +
    `HMAC-SHA256(KART_CLUSTER_SECRET, "kt1."+payload) as in internal/shared/ticket: ${JSON.stringify(forgedWelcome)}`);
  forgedEntry.close();
  await expectRejectedHello(cluster, nodeA, helloFields(`Guest${id}`, ctx.forgeTicket({
    v: 1, node: nodeA.nodeId, data: dataNode, nonce: randomBytes(16).toString("base64url"),
    iat: now, exp: now + 120_000, guest: true,
  })), "LOGIN_REQUIRED");
  await expectRejectedHello(cluster, nodeA, helloFields(`Expired${id}`,
    forged({ iat: now - 180_000, exp: now - 1000 }), latePlayer.equipment), "TICKET_EXPIRED");
  await expectRejectedHello(cluster, nodeA, helloFields(`OtherData${id}`,
    forged({ data: "data-other" }), latePlayer.equipment), "DATA_NODE_MISMATCH");
  await expectRejectedHello(cluster, nodeB, helloFields(`WrongNode${id}`,
    (await issueTicket(cluster, nodeA, latePlayer)).ticket, latePlayer.equipment), "TICKET_WRONG_NODE");
  console.log("✓ ticket claims, signature, guest refusal, expiry, data-node binding and node binding");

  // Logged-in entry: the game node uses the ticket's nickname, cluster-wide.
  const driver = await enterGame(cluster, nodeA, driverPlayer, { name: "IgnoredName" });
  ctx.track(driver.control);
  const created = await driver.control.request({
    type: "create", name: `Auth${id}`, capacity: 2, password: "", channelName: "speedIndiCombine",
    gameplay: "ordinary", mode: "individual", speed: 7, speedVersion: "国服", equipment: driverPlayer.equipment,
  });
  assert.equal(created.room.members[0].name, "TestDriver2", "account hello must use the ticket nickname");
  assert.equal(await redis.command("GET", `${redisPrefix}presence:testdriver2`),
    `${nodeA.nodeId}|${driver.welcome.playerId}`, "presence key must hold nodeId|playerId");
  assert.equal(await redis.command("GET", `${redisPrefix}presence-account:${claims.aid}`),
    `${nodeA.nodeId}|${driver.welcome.playerId}`, "the account key must hold nodeId|playerId");
  // One live session per account: on another node the account claim fails first.
  await expectRejectedEntry(cluster, nodeB, driverPlayer, "ACCOUNT_ONLINE");
  await expectRejectedEntry(cluster, nodeA, driverPlayer, "NICKNAME_TAKEN");
  const racer = await enterGame(cluster, nodeA, secondPlayer);
  ctx.track(racer.control);
  await expectRejectedEntry(cluster, nodeB, secondPlayer, "ACCOUNT_ONLINE");
  console.log("✓ account entry uses the account nickname; one session per account across nodes " +
    "(ACCOUNT_ONLINE on another node, NICKNAME_TAKEN on the same node)");

  const roomId = created.room.roomId;
  const joined = await racer.control.request({ type: "join", roomId, password: "", equipment: secondPlayer.equipment });
  const ready = await racer.control.request({ type: "ready", roomId, revision: joined.room.revision, ready: true });
  const started = await driver.control.request({ type: "start", roomId, revision: ready.room.revision });
  const raceId = started.room.race.raceId;
  await driver.control.request({ type: "loaded", roomId, raceId });
  await racer.control.request({ type: "loaded", roomId, raceId });
  await driver.control.waitFor(message => message.type === "room" &&
    message.room?.roomId === roomId && message.room?.phase === "racing", "racing phase");
  const rules = await expectRoomRules(cluster, roomId, settleMs);
  assert.equal(rules.settings.name, `Auth${id}`);

  // Finish the race while the data service is down: the settlement must wait
  // in the game node's outbox. Redis is emptied too, so everything read after
  // the restart comes from MySQL.
  await ctx.stopData();
  await redis.deletePrefix(redisPrefix);
  assert.equal((await driver.control.request({ type: "finish", roomId, raceId, elapsedMs: 60_000 })).room.phase,
    "racing");
  const finished = await racer.control.request({ type: "finish", roomId, raceId, elapsedMs: 65_000 });
  assert.equal(finished.room.phase, "finished");
  // Finished within 10 s of server time: ranked as reported, rewarded as unfinished.
  const shown = assertRaceRewards(finished.room.race, [driver.welcome.playerId, racer.welcome.playerId], {
    label: "instant race", expected: raceRewards({ channel: "speedIndiCombine", racers: [
      { playerId: driver.welcome.playerId, rank: 1, finished: false },
      { playerId: racer.welcome.playerId, rank: 2, finished: false }] }) });
  const driverReward = shown[driver.welcome.playerId];
  await driver.control.request({ type: "return-room", roomId, raceId });
  await racer.control.request({ type: "return-room", roomId, raceId });
  await delay(1500);

  await ctx.startData();
  assert.equal((await get(profilePath, { headers })).body?.nickname, "TestDriver2");
  assert.equal((await get("/multiplayer/auth/me", { token })).body?.account?.nickname, "TestDriver2");
  console.log("✓ accounts, sessions and profiles persisted across a data-service restart");

  await expectSettlement(cluster, {
    raceId, roomId, gameplay: "ordinary", timeoutMs: settleMs,
    racers: [
      { name: "TestDriver2", playerId: driver.welcome.playerId, rank: 1, elapsedMs: 60_000, points: 10 },
      { name: "TéstDriver2", playerId: racer.welcome.playerId, rank: 2, elapsedMs: 65_000, points: 8 },
    ],
  });
  const statsOf = async name => {
    const stats = await httpOk(dataOrigin, `/api/player-stats?name=${encodeURIComponent(name)}`, { timeoutMs });
    assert.ok(Number.isSafeInteger(stats.updatedAt));
    return { nickname: stats.nickname, races: stats.races, wins: stats.wins, podiums: stats.podiums,
      points: stats.points };
  };
  assert.deepEqual(await statsOf("TestDriver2"),
    { nickname: "TestDriver2", races: 1, wins: 1, podiums: 1, points: 10 });
  assert.deepEqual(await statsOf("TéstDriver2"),
    { nickname: "TéstDriver2", races: 1, wins: 0, podiums: 1, points: 8 });
  assertApiError(await get(`/api/player-stats?name=Nobody${id}`), 404, "PLAYER_NOT_FOUND", "unknown player");
  // The rewards of the race that waited in the outbox are credited once it arrives.
  await poll(async () => (await driverPlayer.summary()).progress.exp === driverReward.exp,
    { timeoutMs: settleMs, description: `test_user exp to become ${driverReward.exp}` });
  console.log("✓ settlement queued during the outage reached MySQL; player stats and rewards updated");

  // Redis was wiped and kart-data restarted, so the ticket API knows a node
  // again only after that node's next heartbeat (every 5 s). Wait for it
  // before asking for tickets.
  await ctx.waitNodesListed(20_000);

  // Settlements are idempotent by raceId (a resend must not count twice).
  const secondAccountId = ticketClaims((await issueTicket(cluster, nodeB, secondPlayer)).ticket).aid;
  const replayRaceId = `smoke-race-${id}`;
  const replayRoomId = `smoke-room-${id}`;
  const settlement = {
    nodeId: nodeB.nodeId, raceId: replayRaceId, roomId: replayRoomId, mode: "individual",
    gameplay: "ordinary", trackId: "village_R01",
    snapshot: { roomId: replayRoomId, mode: "individual", gameplay: "ordinary",
      race: { raceId: replayRaceId, trackId: "village_R01", results: [] } },
    results: [{ playerId: randomUUID(), accountId: secondAccountId, name: "TéstDriver2",
      rank: 1, elapsedMs: 70_000, points: 10 }],
    finishedAt: Date.now(),
  };
  const before = await statsOf("TéstDriver2");
  const replay = async () => {
    const result = await ctx.internalPost("/internal/v1/races", settlement);
    assert.equal(result.status, 200, result.text);
    return result.body;
  };
  assert.deepEqual(await replay(), { stored: true, duplicate: false });
  assert.deepEqual(await replay(), { stored: true, duplicate: true });
  assert.deepEqual(await statsOf("TéstDriver2"), { ...before, races: before.races + 1,
    wins: before.wins + 1, podiums: before.podiums + 1, points: before.points + 10 },
  "a duplicate settlement must not be counted twice");
  console.log("✓ duplicate settlements are stored once");

  // The heartbeat that re-registered the nodes also re-claims online nicknames.
  await poll(async () => await redis.command("GET", `${redisPrefix}presence:testdriver2`) ===
    `${nodeA.nodeId}|${driver.welcome.playerId}`,
  { timeoutMs: 15_000, description: "heartbeat to re-claim the online nickname" });
  const lateEntry = await enterGame(cluster, nodeB, latePlayer);
  ctx.track(lateEntry.control);
  await lateEntry.control.drain();
  lateEntry.control.close();
  console.log("✓ game nodes re-registered and admit players after the restart");

  await driver.control.drain();
  await racer.control.drain();
  driver.control.close();
  racer.control.close();
  assert.equal((await post("/multiplayer/auth/logout", {}, token)).status, 200);
  assert.equal((await get("/multiplayer/auth/me", { token })).status, 401);
  assertApiError(await post(ticketPath, { nodeId: nodeA.nodeId }, token),
    401, "LOGIN_REQUIRED", "ticket after logout");
  console.log("PASS: accounts, invitations, sessions, onboarding, profile keys, tickets, outbox and MySQL restart");
});
