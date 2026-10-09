#!/usr/bin/env node
/**
 * End-to-end probe for the local Go services: the data service (kart-data)
 * and its game nodes (kart-game).
 *
 * Run: node server-smoke.mjs
 * Override:
 *   KART_DATA_ORIGIN=http://127.0.0.1:8787        data service (legacy name: KART_SERVER_BASE)
 *   KART_GAME_ORIGINS=http://127.0.0.1:8788,...   test these game nodes instead of the listed origins
 *   KART_GAME_NODE=game-1                         node used for the room/race flows
 *   KART_SMOKE_TIMEOUT_MS / KART_SMOKE_SETTLE_TIMEOUT_MS
 *   KART_SMOKE_ACCOUNTS=user:password,...         existing onboarded accounts to use instead of
 *                                                 registering new ones (needed when registration
 *                                                 is invite-only/closed or the rate limit applies)
 *   KART_SMOKE_FORWARDED_FOR=0                    do not send per-player X-Forwarded-For
 *   KART_SMOKE_ALLOW_NO_VALIDATORS=1              warn instead of failing when the frontend
 *                                                 validators are installed but cannot be loaded
 * Players enter like the browser: there are no guests, so each player is an
 * account (open registration → starter kit) → game-server list → one-time
 * Bearer ticket from the data service → WebSocket hello {ticket, starter
 * equipment} on the chosen node. Registration is rate limited (5 per hour
 * per client IP); every player sends its own X-Forwarded-For, honoured by
 * kart-data from KART_TRUSTED_PROXIES (default loopback, which covers a
 * cluster started by run-full-local.sh and tested from the same machine).
 * Requires Node.js 22+ for its built-in fetch and WebSocket implementations.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  EQUIPMENT_SLOTS, assertRaceRewards, checkAdmission, createPlayer, discoverCluster, enterGame,
  expectRoomRules, expectSettlement, httpOk, readSettings,
} from "./server-go/test/lib/kart-client.mjs";

const settings = readSettings();
const origin = settings.dataOrigin;
const timeoutMs = settings.timeoutMs;
const protocolVersion = 39;
const channelRules = {
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
};
const randomTrackCodes = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);

// Use the same handwritten validators that guard the real browser UI when the
// rewrite dependencies are installed. The HTTP/WS probe remains runnable alone
// without rewrite/node_modules, but once they are installed a validator module
// that fails to load (a syntax or import error in rewrite/src/multiplayer)
// fails the run instead of silently turning it into an unvalidated pass.
const tsxApi = new URL("./rewrite/node_modules/tsx/dist/esm/api/index.mjs", import.meta.url);

async function loadServerEventValidator() {
  const { tsImport } = await import(tsxApi.href);
  const { isValidRoomSnapshot } = await tsImport("./rewrite/src/multiplayer/room-validation.ts", import.meta.url);
  const { parseServerEvent } = await tsImport("./rewrite/src/multiplayer/server-events.ts", import.meta.url);
  const dependencies = {
    validRoom: isValidRoomSnapshot,
    validChannel: (channel, mode, speed) =>
      channel in channelRules && channelRules[channel].mode === mode && channelRules[channel].speed === speed,
    validGameplay: (gameplay, channel, version) => {
      if (gameplay === undefined || gameplay === "ordinary") return true;
      if (version !== "p3553" || !(channel in channelRules)) return false;
      if (gameplay === "roadblock" || gameplay === "giant") return channel === "speedIndiCombine";
      if (gameplay === "rp") return true;
      if (gameplay === "lte") return channelRules[channel].speed === 7;
      if (gameplay === "grip") return channelRules[channel].speed === 7;
      return gameplay === "shadow";
    },
    validRandomTrackCode: code => randomTrackCodes.has(code),
  };
  return message => parseServerEvent(message, dependencies) !== undefined;
}

let validateServerEvent;
if (!existsSync(tsxApi)) {
  console.warn("Frontend strict validators unavailable: rewrite/node_modules is missing " +
    "(run npm ci in rewrite/ to check events with them)");
} else {
  try {
    validateServerEvent = await loadServerEventValidator();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.KART_SMOKE_ALLOW_NO_VALIDATORS !== "1") {
      console.error(`FAIL: the frontend validators could not be loaded: ${reason}\n` +
        "Fix rewrite/src/multiplayer, or set KART_SMOKE_ALLOW_NO_VALIDATORS=1 to run without them.");
      process.exit(1);
    }
    console.warn(`Frontend strict validators unavailable: ${reason}`);
  }
}

function assertStartSlots(race) {
  const entries = Object.entries(race.startSlots ?? {});
  assert.deepEqual(entries.map(([id]) => id).sort(),
    race.roster.map(member => member.playerId).sort(), "Incomplete startSlots");
  assert.equal(new Set(entries.map(([, slot]) => slot)).size, entries.length,
    "Duplicate start slot");
  for (const [, slot] of entries)
    assert.ok(Number.isInteger(slot) && slot >= 0 && slot <= 7,
      `Invalid start slot ${slot}`);
}

function assertRoomBasics(room, expectedPlayerId) {
  assert.ok(room && typeof room.roomId === "string" && room.roomId.length > 0);
  assert.ok(Number.isSafeInteger(room.revision) && room.revision >= 1);
  assert.equal(room.mode, "individual");
  assert.equal(room.capacity, 2);
  assert.equal(room.speedVersion, "国服");
  assert.equal(room.channelName, "speedIndiCombine");
  assert.equal(room.speed, 7);
  assert.equal(room.gameplay, "ordinary");
  assert.equal(room.resourceVersion, "p3553");
  assert.ok(typeof room.trackId === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(room.trackId));
  assert.ok(Array.isArray(room.members) && room.members.length >= 1 && room.members.length <= 2);
  assert.ok(room.members.some(member => member.playerId === room.hostId));
  const member = room.members.find(candidate => candidate.playerId === expectedPlayerId);
  assert.ok(member, `Room does not contain player ${expectedPlayerId}`);
  assert.ok(Number.isInteger(member.slot) && member.slot >= 0 && member.slot < 2);
  assert.equal(typeof member.ready, "boolean");
  assert.equal(member.team, null);
  assert.ok(member.equipment && typeof member.equipment.itemIds === "object");
  assert.equal(Object.keys(member.equipment.itemIds).length, EQUIPMENT_SLOTS.length);
  for (const slot of EQUIPMENT_SLOTS) {
    assert.ok(Number.isInteger(member.equipment.itemIds[slot]), `Equipment category ${slot} is invalid`);
  }
}

function jsonRequest(path, options = {}) {
  return httpOk(origin, `/multiplayer/${path}`, { timeoutMs, ...options });
}

const suffix = randomBytes(4).toString("hex");
let first;
let second;

try {
  const health = await jsonRequest("healthz");
  assert.equal(health.protocolVersion, protocolVersion);
  assert.equal(health.service, "data");
  console.log("✓ healthz: protocolVersion 39 (data service)");

  const auth = await jsonRequest("auth/config");
  assert.equal(auth.loginRequired, true, "Accounts are required: auth/config must report loginRequired:true");
  assert.ok(["open", "invite", "closed"].includes(auth.registration),
    `auth/config.registration must be open, invite or closed, got ${JSON.stringify(auth.registration)}`);
  assert.equal(typeof auth.guests, "boolean", "auth/config.guests must be a boolean");
  assert.ok(auth.backendOrigin === null || auth.backendOrigin === origin,
    "auth/config backendOrigin differs from the data service origin");
  console.log(`✓ auth/config: registration ${auth.registration}, guests ${auth.guests}`);

  const cluster = await discoverCluster(settings);
  const node = cluster.servers[0];
  console.log(`✓ game-servers: ${cluster.servers.map(server =>
    `${server.nodeId} ${server.players}/${server.capacity}`).join(", ")} (data node ${cluster.dataNode})`);
  const holder = await createPlayer(cluster, `Hold${suffix}`);
  const firstAccount = await createPlayer(cluster, `SmokeA${suffix}`, { starter: { character: 2, paint: 6, dye: 6 } });
  const secondAccount = await createPlayer(cluster, `SmokeB${suffix}`, { starter: { character: 3, paint: 4, dye: 5 } });
  const firstName = firstAccount.nickname;
  console.log("✓ three accounts registered and onboarded (starter kit claimed)");

  await checkAdmission(cluster, { holder, suffix, validate: validateServerEvent, settleMs: settings.settleMs });

  first = await enterGame(cluster, node, firstAccount, { validate: validateServerEvent });
  second = await enterGame(cluster, node, secondAccount, { validate: validateServerEvent });
  assert.notEqual(first.welcome.playerId, second.welcome.playerId);
  console.log(`✓ Bearer ticket + WebSocket hello/welcome for two accounts on ${node.nodeId}`);

  for (const guest of [first, second]) {
    const tick = performance.now();
    const reply = await guest.control.request({ type: "clock", clientTick: tick });
    assert.equal(reply.type, "clock");
    assert.equal(reply.clientTick, tick);
    assert.ok(Number.isFinite(reply.serverTick) && reply.serverTick >= 0);
  }
  console.log("✓ clock echo and server tick");

  const roomName = `Smoke${suffix}`;
  const created = await first.control.request({
    type: "create", name: roomName, capacity: 2, password: "",
    channelName: "speedIndiCombine", gameplay: "ordinary",
    mode: "individual", speed: 7, speedVersion: "国服", equipment: firstAccount.equipment,
  });
  assert.equal(created.type, "room");
  const room = created.room;
  assertRoomBasics(room, first.welcome.playerId);
  assert.equal(room.hostId, first.welcome.playerId);
  assert.equal(room.phase, "open");
  assert.equal(room.name, roomName);
  console.log(`✓ create room ${room.roomId}`);

  const listed = await second.control.request({ type: "list-ordinary", page: 0 });
  assert.equal(listed.type, "rooms");
  assert.equal(listed.page, 0);
  assert.ok(Array.isArray(listed.rooms));
  const summary = listed.rooms.find(candidate => candidate.roomId === room.roomId);
  assert.ok(summary,
    "Created room is missing from the first lobby page");
  assert.equal(summary.mode, "individual");
  assert.equal(summary.capacity, 2);
  assert.equal(summary.speedVersion, "国服");
  assert.equal(summary.channelName, "speedIndiCombine");
  assert.equal(summary.speed, 7);
  assert.equal(summary.resourceVersion, "p3553");
  assert.equal(summary.count, 1);
  assert.equal(summary.locked, false);
  console.log("✓ list-ordinary contains the created room");

  const joined = await second.control.request({ type: "join", roomId: room.roomId, password: "",
    equipment: secondAccount.equipment });
  assert.equal(joined.type, "room");
  assert.equal(joined.room.roomId, room.roomId);
  assertRoomBasics(joined.room, second.welcome.playerId);
  assert.ok(joined.room.revision > room.revision);
  console.log("✓ second player joined; room revision advanced");

  const chatText = `hi-${suffix}`;
  await first.control.request({ type: "chat", roomId: room.roomId, text: chatText });
  const broadcast = await second.control.waitFor(message =>
    message?.type === "chat" && message.roomId === room.roomId && message.message?.text === chatText);
  assert.equal(broadcast.message.playerId, first.welcome.playerId);
  assert.equal(broadcast.message.name, firstName);
  assert.ok(Number.isSafeInteger(broadcast.message.sequence) && broadcast.message.sequence >= 1);
  console.log("✓ room chat broadcast reached the other player");

  const ready = await second.control.request({ type: "ready", roomId: room.roomId,
    revision: joined.room.revision, ready: true });
  assert.equal(ready.type, "room");
  assert.equal(ready.room.members.find(member => member.playerId === second.welcome.playerId).ready, true);
  const loading = await first.control.request({ type: "start", roomId: room.roomId,
    revision: ready.room.revision });
  assert.equal(loading.type, "room");
  assert.equal(loading.room.phase, "loading");
  assertStartSlots(loading.room.race);
  const raceId = loading.room.race?.raceId;
  assert.ok(typeof raceId === "string" && raceId.length > 0);
  console.log("✓ ready/start entered loading phase");

  const firstLoaded = await first.control.request({ type: "loaded", roomId: room.roomId, raceId });
  assert.equal(firstLoaded.room.phase, "loading");
  const countdown = await second.control.request({ type: "loaded", roomId: room.roomId, raceId });
  assert.equal(countdown.room.phase, "countdown");
  assert.ok(Number.isFinite(countdown.room.race.startAt));
  const racing = await first.control.waitFor(message =>
    message?.type === "room" && message.room?.roomId === room.roomId && message.room?.phase === "racing");
  assert.equal(racing.room.race.raceId, raceId);
  console.log("✓ loaded/countdown/racing snapshots accepted");

  const firstFinish = await first.control.request({ type: "finish", roomId: room.roomId,
    raceId, elapsedMs: 60_000 });
  assert.equal(firstFinish.room.phase, "racing");
  const finished = await second.control.request({ type: "finish", roomId: room.roomId,
    raceId, elapsedMs: 65_000 });
  assert.equal(finished.room.phase, "finished");
  assert.equal(finished.room.race.results.length, 2);
  assert.equal(finished.room.race.raceOverAt, finished.room.race.finishDeadline + 6000);
  const rewards = assertRaceRewards(finished.room.race, [first.welcome.playerId, second.welcome.playerId],
    { label: "individual race" });
  // Both finished within 10 s of server time after the start: race.results keep
  // the reported ranks, but both earn the same unfinished reward (ECONOMY.md 2.1).
  assert.deepEqual(rewards[first.welcome.playerId], rewards[second.welcome.playerId],
    `finishes within 10 s of the start earn the unfinished reward: ${JSON.stringify(rewards)}`);
  console.log(`✓ finish/result snapshot accepted; race.rewards ${JSON.stringify(rewards)}`);

  const firstReturn = await first.control.request({ type: "return-room", roomId: room.roomId, raceId });
  assert.equal(firstReturn.room.phase, "finished");
  const secondReturn = await second.control.request({ type: "return-room", roomId: room.roomId, raceId });
  assert.equal(secondReturn.room.phase, "open");
  console.log("✓ both players returned to open room");

  await expectSettlement(cluster, {
    raceId, roomId: room.roomId, gameplay: "ordinary", timeoutMs: settings.settleMs,
    racers: [
      { name: firstName, playerId: first.welcome.playerId, rank: 1, elapsedMs: 60_000, points: 10 },
      { name: secondAccount.nickname, playerId: second.welcome.playerId, rank: 2, elapsedMs: 65_000, points: 8 },
    ],
  });
  const rules = await expectRoomRules(cluster, room.roomId, settings.settleMs);
  assert.equal(rules.settings.name, roomName);
  console.log("✓ race-results, race-outcomes and room-rules reached the data service");

  await first.control.request({ type: "leave", roomId: room.roomId,
    revision: secondReturn.room.revision });
  await second.control.request({ type: "leave", roomId: room.roomId });
  const teamCreated = await first.control.request({
    type: "create", name: `Team${suffix}`, capacity: 2, password: "",
    channelName: "speedTeamCombine", gameplay: "ordinary",
    mode: "team", speed: 7, speedVersion: "国服", equipment: firstAccount.equipment,
  });
  assert.equal(teamCreated.room.mode, "team");
  const teamRoomId = teamCreated.room.roomId;
  const teamJoined = await second.control.request({
    type: "join", roomId: teamRoomId, password: "", equipment: secondAccount.equipment,
  });
  assert.deepEqual(new Set(teamJoined.room.members.map(member => member.team)), new Set([1, 2]));
  const randomTrack = await first.control.request({ type: "random-track",
    roomId: teamRoomId, revision: teamJoined.room.revision, randomTrackCode: 0 });
  assert.equal(randomTrack.room.randomTrackCode, 0);
  assert.equal(randomTrack.room.trackId, undefined);
  const teamReady = await second.control.request({ type: "ready", roomId: teamRoomId,
    revision: randomTrack.room.revision, ready: true });
  const teamLoading = await first.control.request({ type: "start", roomId: teamRoomId,
    revision: teamReady.room.revision });
  assert.equal(teamLoading.room.phase, "loading");
  assertStartSlots(teamLoading.room.race);
  const teamRaceId = teamLoading.room.race.raceId;
  assert.ok(typeof teamLoading.room.race.trackId === "string");
  await first.control.request({ type: "loaded", roomId: teamRoomId, raceId: teamRaceId });
  const teamCountdown = await second.control.request({ type: "loaded",
    roomId: teamRoomId, raceId: teamRaceId });
  assert.equal(teamCountdown.room.phase, "countdown");
  await first.control.waitFor(message => message?.type === "room" &&
    message.room?.roomId === teamRoomId && message.room?.phase === "racing");
  const gauge = await first.control.request({ type: "team-charge", roomId: teamRoomId,
    raceId: teamRaceId, sequence: 1, charge: 4000 });
  assert.equal(gauge.type, "team-gauge");
  assert.equal(gauge.team, 1);
  assert.equal(gauge.sequence, 1);
  assert.equal(gauge.target, 0.5);
  const receivedGauge = await second.control.waitFor(message => message?.type === "team-gauge" &&
    message.roomId === teamRoomId && message.raceId === teamRaceId);
  assert.equal(receivedGauge.target, 0.5);
  const award = await first.control.request({ type: "award-motion", roomId: teamRoomId,
    raceId: teamRaceId, motion: 3 });
  assert.equal(award.type, "award-motion");
  assert.equal(award.playerId, first.welcome.playerId);
  const receivedAward = await second.control.waitFor(message => message?.type === "award-motion" &&
    message.roomId === teamRoomId && message.raceId === teamRaceId);
  assert.equal(receivedAward.motion, 3);
  console.log("✓ team charge and award motion accepted and broadcast");
  await first.control.request({ type: "finish", roomId: teamRoomId,
    raceId: teamRaceId, elapsedMs: 61_000 });
  const teamFinished = await second.control.request({ type: "finish", roomId: teamRoomId,
    raceId: teamRaceId, elapsedMs: 62_000 });
  assert.equal(teamFinished.room.phase, "finished");
  assert.ok(teamFinished.room.race.winningTeam === 1 || teamFinished.room.race.winningTeam === 2);
  assert.ok(Number.isInteger(teamFinished.room.race.teamScores[1]));
  assert.ok(Number.isInteger(teamFinished.room.race.teamScores[2]));
  assertRaceRewards(teamFinished.room.race, [first.welcome.playerId, second.welcome.playerId],
    { label: "team race" });
  const teamSettled = await expectSettlement(cluster, {
    raceId: teamRaceId, roomId: teamRoomId, gameplay: "ordinary", timeoutMs: settings.settleMs,
  });
  assert.equal(teamSettled.outcome.snapshot.mode, "team");
  assert.equal(teamSettled.outcome.snapshot.race.winningTeam, teamFinished.room.race.winningTeam);
  console.log("✓ team race with random track and team scores accepted and settled");

  // Broadcasts that reached a player after its last request (e.g. the finished
  // team-race snapshot for the first player) were validated but not awaited.
  await first.control.drain();
  await second.control.drain();
  console.log("PASS: Go data service, accounts, entry tickets and game-node lobby/race smoke test" +
    (validateServerEvent ? " (real frontend validators)" : " (validators unavailable)"));
} catch (error) {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  second?.control.close();
  first?.control.close();
}
