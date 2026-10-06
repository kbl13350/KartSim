#!/usr/bin/env node
/**
 * End-to-end probe for the local Java lobby server.
 *
 * Run: node server-smoke.mjs
 * Override: KART_SERVER_BASE=http://127.0.0.1:8787 KART_WS_URL=ws://127.0.0.1:8787/multiplayer/ws node server-smoke.mjs
 * Requires Node.js 22+ for its built-in fetch and WebSocket implementations.
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = (process.env.KART_SERVER_BASE ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
const websocketUrl = process.env.KART_WS_URL ??
  `${origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/multiplayer/ws`;
const timeoutMs = Number(process.env.KART_SMOKE_TIMEOUT_MS ?? 7000);
assert.ok(Number.isFinite(timeoutMs) && timeoutMs >= 1000, "Invalid KART_SMOKE_TIMEOUT_MS");
const protocolVersion = 39;
const ruleset = "launcher-room-v1";
const channelRules = {
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
};
const randomTrackCodes = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);

// Use the same handwritten validators that guard the real browser UI when the
// rewrite dependencies are installed. The HTTP/WS probe remains runnable alone.
let validateServerEvent;
try {
  const { tsImport } = await import("./rewrite/node_modules/tsx/dist/esm/api/index.mjs");
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
  validateServerEvent = message => parseServerEvent(message, dependencies);
} catch (error) {
  console.warn(`Frontend strict validators unavailable: ${error instanceof Error ? error.message : error}`);
}
const equipmentSlots = [
  1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30,
  31, 32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
];

function equipment() {
  return {
    itemIds: Object.fromEntries(equipmentSlots.map(slot => [slot, slot === 1 || slot === 3 ? 1 : 0])),
    kartSerial: 0,
    valueAt3E: 0,
    exceedType: 0,
  };
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
  assert.equal(Object.keys(member.equipment.itemIds).length, equipmentSlots.length);
  for (const slot of equipmentSlots) {
    assert.ok(Number.isInteger(member.equipment.itemIds[slot]), `Equipment category ${slot} is invalid`);
  }
}

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${origin}/multiplayer/${path}`, {
    signal: AbortSignal.timeout(timeoutMs),
    ...options,
  });
  const body = await response.json();
  assert.ok(response.ok, `${path} returned HTTP ${response.status}: ${JSON.stringify(body)}`);
  assert.ok(body && typeof body === "object" && !Array.isArray(body), `${path} did not return a JSON object`);
  return body;
}

class ControlSocket {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.events = [];
    this.waiters = new Set();
    this.failure = undefined;
    socket.addEventListener("message", event => {
      let message;
      try { message = JSON.parse(String(event.data)); }
      catch { return this.failAll(new Error("WebSocket emitted invalid JSON")); }
      if (validateServerEvent && !validateServerEvent(message)) {
        return this.failAll(new Error(`Frontend rejected server event: ${JSON.stringify(message)}`));
      }
      const index = [...this.waiters].findIndex(waiter => waiter.predicate(message));
      if (index < 0) this.events.push(message);
      else [...this.waiters][index].resolve(message);
    });
    socket.addEventListener("close", () => this.failAll(new Error("WebSocket closed during smoke test")));
    socket.addEventListener("error", () => this.failAll(new Error("WebSocket failed during smoke test")));
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`WebSocket open timed out: ${url}`)), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error(`WebSocket open failed: ${url}`)); }, { once: true });
    });
    return new ControlSocket(socket);
  }

  waitFor(predicate) {
    if (this.failure) return Promise.reject(this.failure);
    const found = this.events.findIndex(predicate);
    if (found >= 0) return Promise.resolve(this.events.splice(found, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: message => { clearTimeout(timer); this.waiters.delete(waiter); resolve(message); },
        reject: error => { clearTimeout(timer); this.waiters.delete(waiter); reject(error); },
      };
      const timer = setTimeout(() => waiter.reject(new Error("Timed out waiting for control message")), timeoutMs);
      this.waiters.add(waiter);
    });
  }

  failAll(error) {
    this.failure ??= error;
    for (const waiter of [...this.waiters]) waiter.reject(error);
  }

  async request(fields) {
    const requestId = String(++this.nextId);
    const reply = this.waitFor(message => message?.requestId === requestId);
    this.socket.send(JSON.stringify({ ...fields, requestId }));
    const message = await reply;
    assert.notEqual(message.type, "error", `${fields.type} failed: ${message.code}`);
    return message;
  }

  close() { this.socket.close(); }
}

async function openGuest(name) {
  const control = await ControlSocket.connect(websocketUrl);
  const welcome = await control.request({
    type: "hello",
    protocolVersion,
    ruleset,
    resourceVersion: "p3553",
    name,
    equipment: equipment(),
    initial: "",
    raceRuntime: true,
  });
  assert.equal(welcome.type, "welcome");
  assert.equal(welcome.protocolVersion, protocolVersion);
  assert.equal(welcome.ruleset, ruleset);
  assert.ok(typeof welcome.playerId === "string" && welcome.playerId.length > 0);
  assert.ok(Array.isArray(welcome.capabilities));
  return { control, welcome };
}

const suffix = randomBytes(4).toString("hex");
const firstName = `SmokeA${suffix}`;
const secondName = `SmokeB${suffix}`;
let first;
let second;

try {
  const health = await jsonRequest("healthz");
  assert.equal(health.protocolVersion, protocolVersion);
  console.log("✓ healthz: protocolVersion 39");

  const auth = await jsonRequest("auth/config");
  assert.equal(auth.loginRequired, false, "Smoke test expects local guest mode (loginRequired:false)");
  assert.ok(auth.backendOrigin === null || auth.backendOrigin === origin,
    "auth/config backendOrigin differs from local server origin");
  for (const name of [firstName, secondName]) {
    const check = await jsonRequest("auth/guest-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    assert.equal(check.available, true, `Guest name ${name} is unavailable`);
  }
  console.log("✓ auth/config and guest-name");

  first = await openGuest(firstName);
  second = await openGuest(secondName);
  assert.notEqual(first.welcome.playerId, second.welcome.playerId);
  console.log("✓ WebSocket hello/welcome for two players");

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
    mode: "individual", speed: 7, speedVersion: "国服",
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

  const joined = await second.control.request({ type: "join", roomId: room.roomId, password: "" });
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
  console.log("✓ finish/result snapshot accepted");

  const firstReturn = await first.control.request({ type: "return-room", roomId: room.roomId, raceId });
  assert.equal(firstReturn.room.phase, "finished");
  const secondReturn = await second.control.request({ type: "return-room", roomId: room.roomId, raceId });
  assert.equal(secondReturn.room.phase, "open");
  console.log("✓ both players returned to open room");

  await first.control.request({ type: "leave", roomId: room.roomId,
    revision: secondReturn.room.revision });
  await second.control.request({ type: "leave", roomId: room.roomId });
  const teamCreated = await first.control.request({
    type: "create", name: `Team${suffix}`, capacity: 2, password: "",
    channelName: "speedTeamCombine", gameplay: "ordinary",
    mode: "team", speed: 7, speedVersion: "国服",
  });
  assert.equal(teamCreated.room.mode, "team");
  const teamRoomId = teamCreated.room.roomId;
  const teamJoined = await second.control.request({
    type: "join", roomId: teamRoomId, password: "",
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
  const teamRaceId = teamLoading.room.race.raceId;
  assert.ok(typeof teamLoading.room.race.trackId === "string");
  await first.control.request({ type: "loaded", roomId: teamRoomId, raceId: teamRaceId });
  const teamCountdown = await second.control.request({ type: "loaded",
    roomId: teamRoomId, raceId: teamRaceId });
  assert.equal(teamCountdown.room.phase, "countdown");
  await first.control.waitFor(message => message?.type === "room" &&
    message.room?.roomId === teamRoomId && message.room?.phase === "racing");
  await first.control.request({ type: "finish", roomId: teamRoomId,
    raceId: teamRaceId, elapsedMs: 61_000 });
  const teamFinished = await second.control.request({ type: "finish", roomId: teamRoomId,
    raceId: teamRaceId, elapsedMs: 62_000 });
  assert.equal(teamFinished.room.phase, "finished");
  assert.ok(teamFinished.room.race.winningTeam === 1 || teamFinished.room.race.winningTeam === 2);
  assert.ok(Number.isInteger(teamFinished.room.race.teamScores[1]));
  assert.ok(Number.isInteger(teamFinished.room.race.teamScores[2]));
  console.log("✓ team race with random track and team scores accepted");

  console.log("PASS: Java server HTTP/auth/WebSocket lobby and race-state smoke test" +
    (validateServerEvent ? " (real frontend validators)" : " (validators unavailable)"));
} catch (error) {
  console.error("FAIL:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  second?.control.close();
  first?.control.close();
}
