#!/usr/bin/env node
// End-to-end check against an already running cluster (kart-data plus at
// least one kart-game node), e.g. started by ../run-full-local.sh or
// docker compose. No npm dependencies; Node.js 22+.
//
//   node test/smoke.mjs
//   KART_DATA_ORIGIN=http://127.0.0.1:8787 KART_GAME_ORIGINS=http://127.0.0.1:8788,http://127.0.0.1:8789 node test/smoke.mjs
//
// There are no guests by default, so the script registers three accounts
// (open registration), claims their starter kits and enters with Bearer
// tickets and the starter equipment (see lib/kart-client.mjs). Registration
// is rate limited to 5 per hour per client IP: every account sends its own
// X-Forwarded-For address, which kart-data honours from KART_TRUSTED_PROXIES
// (default loopback — a cluster from run-full-local.sh tested on the same
// machine works). Otherwise pass existing onboarded accounts with
// KART_SMOKE_ACCOUNTS=user:password,… (KART_REGISTRATION=invite|closed
// deployments need this too). Other settings: KART_GAME_NODE,
// KART_SMOKE_TIMEOUT_MS, KART_SMOKE_SETTLE_TIMEOUT_MS, KART_SMOKE_FORWARDED_FOR=0.
//
// It stores test accounts, a test profile, race results and room rules in
// the cluster's MySQL database; run it against a test deployment.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import {
  assertRaceRewards, checkAdmission, createPlayer, discoverCluster, enterGame, expectRoomRules,
  expectSettlement, http, httpOk, poll, readSettings,
} from "./lib/kart-client.mjs";

const settings = readSettings();
const { dataOrigin } = settings;
const suffix = randomBytes(4).toString("hex");

const cluster = await discoverCluster(settings);
console.log(`Data service ${dataOrigin} (${cluster.dataNode}); game servers: ` +
  cluster.servers.map(server => `${server.nodeId}@${server.connectOrigin}`).join(", "));

// Profile and record storage (X-Profile-Key ownership).
const owner = randomUUID();
const key = randomBytes(32).toString("base64url");
const profilePath = "/api/profile/" + owner;
const headers = { "X-Profile-Key": key };
assert.equal((await http(dataOrigin, profilePath, { headers })).status, 404);
const profile = { nickname: "smoke", coins: 42 };
assert.deepEqual(await httpOk(dataOrigin, profilePath, { method: "PUT", headers, body: profile }), profile);
assert.deepEqual(await httpOk(dataOrigin, profilePath, { headers }), profile);
assert.equal((await http(dataOrigin, profilePath, {
  headers: { "X-Profile-Key": randomBytes(32).toString("base64url") },
})).status, 403);
const recordPath = "/api/records/" + owner + "/ghost-summary-index";
const record = [{ trackId: "village_R01", ms: 12345 }];
assert.deepEqual(await httpOk(dataOrigin, recordPath, { method: "PUT", headers, body: record }), record);
console.log("✓ profile and record storage");

const holder = await createPlayer(cluster, `Hold${suffix}`);
const aliceAccount = await createPlayer(cluster, `SmokeA${suffix}`, { starter: { character: 2, paint: 6, dye: 4 } });
const bobAccount = await createPlayer(cluster, `SmokeB${suffix}`, { starter: { character: 3, paint: 5, dye: 7 } });
console.log(`✓ accounts ${[holder, aliceAccount, bobAccount].map(player => player.nickname).join(", ")} ` +
  "ready with their starter kits");

await checkAdmission(cluster, { holder, suffix, settleMs: settings.settleMs });

const [node] = cluster.servers;
const aliceName = aliceAccount.nickname;
const bobName = bobAccount.nickname;
const aliceBefore = await aliceAccount.summary();
const alice = await enterGame(cluster, node, aliceAccount);
const bob = await enterGame(cluster, node, bobAccount);
try {
  assert.notEqual(alice.welcome.playerId, bob.welcome.playerId);
  const clock = await alice.control.request({ type: "clock", clientTick: 12.5 });
  assert.equal(clock.clientTick, 12.5);
  assert.ok(clock.serverTick >= 0);
  const roomName = `Smoke${suffix}`;
  const created = await alice.control.request({
    type: "create", name: roomName, capacity: 2, password: "", channelName: "speedIndiCombine",
    gameplay: "ordinary", mode: "individual", speed: 7, speedVersion: "国服", equipment: aliceAccount.equipment,
  });
  assert.equal(created.type, "room");
  assert.equal(created.room.trackId, "village_R01");
  assert.equal(created.room.members.length, 1);
  const roomId = created.room.roomId;
  const list = await bob.control.request({ type: "list-ordinary", page: 0 });
  assert.ok(list.rooms.some(room => room.roomId === roomId));
  const joined = await bob.control.request({ type: "join", roomId, password: "", equipment: bobAccount.equipment });
  assert.equal(joined.room.members.length, 2);
  const ready = await bob.control.request({
    type: "ready", roomId, revision: joined.room.revision, ready: true,
  });
  assert.equal(ready.room.members.find(member =>
    member.playerId === bob.welcome.playerId).ready, true);
  const sentChat = await alice.control.request({ type: "chat", roomId, text: "hello" });
  assert.equal(sentChat.message.text, "hello");
  const started = await alice.control.request({ type: "start", roomId, revision: ready.room.revision });
  assert.equal(started.room.phase, "loading");
  const raceId = started.room.race.raceId;
  const oneLoaded = await alice.control.request({ type: "loaded", roomId, raceId });
  assert.equal(oneLoaded.room.phase, "loading");
  const bothLoaded = await bob.control.request({ type: "loaded", roomId, raceId });
  assert.equal(bothLoaded.room.phase, "countdown");
  // The node switches to racing from a 3 s timer; wait for that broadcast
  // instead of sleeping, so a late timer on a loaded machine is not a failure.
  await alice.control.waitFor(message => message.type === "room" &&
    message.room?.roomId === roomId && message.room?.phase === "racing", "racing phase");
  const firstFinish = await alice.control.request({ type: "finish", roomId, raceId, elapsedMs: 12_345 });
  assert.equal(firstFinish.room.phase, "racing");
  const lastFinish = await bob.control.request({ type: "finish", roomId, raceId, elapsedMs: 13_456 });
  assert.equal(lastFinish.room.phase, "finished");
  assert.equal(lastFinish.room.race.results.length, 2);
  const rewards = assertRaceRewards(lastFinish.room.race, [alice.welcome.playerId, bob.welcome.playerId]);
  // Both finished within 10 s of server time after the start: race.results
  // keep the reported ranks, but both earn the same unfinished reward.
  assert.deepEqual(rewards[alice.welcome.playerId], rewards[bob.welcome.playerId],
    `finishes within 10 s of the start earn the unfinished reward: ${JSON.stringify(rewards)}`);
  const firstReturn = await alice.control.request({ type: "return-room", roomId, raceId });
  assert.equal(firstReturn.room.phase, "finished");
  const lastReturn = await bob.control.request({ type: "return-room", roomId, raceId });
  assert.equal(lastReturn.room.phase, "open");
  const left = await bob.control.request({ type: "leave", roomId, revision: lastReturn.room.revision });
  assert.equal(left.type, "left");
  console.log(`✓ two-player WebSocket race on ${node.nodeId}; race.rewards ${JSON.stringify(rewards)}`);

  // The game node reports the race to the data service through its outbox.
  await expectSettlement(cluster, {
    raceId, roomId, gameplay: "ordinary", timeoutMs: settings.settleMs,
    racers: [
      { name: aliceName, playerId: alice.welcome.playerId, rank: 1, elapsedMs: 12_345, points: 10 },
      { name: bobName, playerId: bob.welcome.playerId, rank: 2, elapsedMs: 13_456, points: 8 },
    ],
  });
  const rules = await expectRoomRules(cluster, roomId, settings.settleMs);
  assert.equal(rules.settings.name, roomName);
  assert.equal(rules.settings.gameplay, "ordinary");
  // The data service credits the rewards in the settlement transaction.
  const earned = rewards[alice.welcome.playerId];
  if (earned.exp > 0) {
    await poll(async () => (await aliceAccount.summary()).progress.exp >= aliceBefore.progress.exp + earned.exp,
      { timeoutMs: settings.settleMs, description: `${aliceName} to be credited ${earned.exp} exp` });
  }
  console.log("✓ race settlement, rewards and room rules reached the data service");
  await alice.control.drain();
  await bob.control.drain();
  console.log("PASS: data service, accounts, entry tickets and game-node race smoke test");
} finally {
  alice.control.close();
  bob.control.close();
}
