#!/usr/bin/env node
// Runs against an already-started local server. No npm dependencies.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const origin = process.env.KART_SERVER_ORIGIN ?? "http://127.0.0.1:8787";
const socketUrl = origin.replace(/^http/, "ws") + "/multiplayer/ws";
const slots = [1,2,3,4,8,9,10,11,12,16,17,18,20,21,52,26,27,30,31,
  32,36,43,45,44,46,58,59,61,70,68,69,71,76,77,78];
const equipment = {
  itemIds: Object.fromEntries(slots.map(slot => [slot, slot === 1 || slot === 3 ? 1 : 0])),
  kartSerial: 0, valueAt3E: 0, exceedType: 0,
};

async function connect(name) {
  const socket = new WebSocket(socketUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const pending = new Map();
  const events = [];
  let next = 0;
  socket.addEventListener("message", event => {
    if (typeof event.data !== "string") return;
    const message = JSON.parse(event.data);
    const request = pending.get(message.requestId);
    if (request) {
      pending.delete(message.requestId);
      clearTimeout(request.timeout);
      if (message.type === "error") request.reject(new Error(message.code));
      else request.resolve(message);
    } else events.push(message);
  });
  function request(type, body = {}) {
    const requestId = String(++next);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Timed out: ${type}`));
      }, 8_000);
      pending.set(requestId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ type, requestId, ...body }));
    });
  }
  const welcome = await request("hello", {
    protocolVersion: 39, ruleset: "launcher-room-v1",
    resourceVersion: "p3553", name, equipment, initial: "", raceRuntime: true,
  });
  assert.equal(welcome.type, "welcome");
  assert.equal(welcome.protocolVersion, 39);
  return { request, events, welcome, close: () => socket.close() };
}

const health = await fetch(origin + "/multiplayer/healthz").then(response => response.json());
assert.equal(health.protocolVersion, 39);
const owner = randomUUID();
const key = randomBytes(32).toString("base64url");
const profileUrl = origin + "/api/profile/" + owner;
const headers = { "Content-Type": "application/json", "X-Profile-Key": key };
assert.equal((await fetch(profileUrl, { headers })).status, 404);
const profile = { nickname: "smoke", coins: 42 };
assert.deepEqual(await fetch(profileUrl, {
  method: "PUT", headers, body: JSON.stringify(profile),
}).then(response => response.json()), profile);
assert.deepEqual(await fetch(profileUrl, { headers }).then(response => response.json()), profile);
assert.equal((await fetch(profileUrl, {
  headers: { "X-Profile-Key": randomBytes(32).toString("base64url") },
})).status, 403);
const recordUrl = origin + "/api/records/" + owner + "/ghost-summary-index";
assert.deepEqual(await fetch(recordUrl, {
  method: "PUT", headers, body: JSON.stringify([{ trackId: "village_R01", ms: 12345 }]),
}).then(response => response.json()), [{ trackId: "village_R01", ms: 12345 }]);

const alice = await connect("SmokeAlice");
const bob = await connect("SmokeBob");
try {
  const clock = await alice.request("clock", { clientTick: 12.5 });
  assert.equal(clock.clientTick, 12.5);
  assert.ok(clock.serverTick >= 0);
  const created = await alice.request("create", {
    name: "Test Room", capacity: 2, password: "", channelName: "speedIndiCombine",
    gameplay: "ordinary", mode: "individual", speed: 7, speedVersion: "国服",
  });
  assert.equal(created.type, "room");
  assert.equal(created.room.trackId, "village_R01");
  assert.equal(created.room.members.length, 1);
  const roomId = created.room.roomId;
  const list = await bob.request("list-ordinary", { page: 0 });
  assert.ok(list.rooms.some(room => room.roomId === roomId));
  const joined = await bob.request("join", { roomId, password: "" });
  assert.equal(joined.room.members.length, 2);
  const ready = await bob.request("ready", {
    roomId, revision: joined.room.revision, ready: true,
  });
  assert.equal(ready.room.members.find(member =>
    member.playerId === bob.welcome.playerId).ready, true);
  const sentChat = await alice.request("chat", { roomId, text: "hello" });
  assert.equal(sentChat.message.text, "hello");
  const started = await alice.request("start", { roomId, revision: ready.room.revision });
  assert.equal(started.room.phase, "loading");
  const raceId = started.room.race.raceId;
  const oneLoaded = await alice.request("loaded", { roomId, raceId });
  assert.equal(oneLoaded.room.phase, "loading");
  const bothLoaded = await bob.request("loaded", { roomId, raceId });
  assert.equal(bothLoaded.room.phase, "countdown");
  await new Promise(resolve => setTimeout(resolve, 3_150));
  const firstFinish = await alice.request("finish", { roomId, raceId, elapsedMs: 12_345 });
  assert.equal(firstFinish.room.phase, "racing");
  const lastFinish = await bob.request("finish", { roomId, raceId, elapsedMs: 13_456 });
  assert.equal(lastFinish.room.phase, "finished");
  assert.equal(lastFinish.room.race.results.length, 2);
  const firstReturn = await alice.request("return-room", { roomId, raceId });
  assert.equal(firstReturn.room.phase, "finished");
  const lastReturn = await bob.request("return-room", { roomId, raceId });
  assert.equal(lastReturn.room.phase, "open");
  const left = await bob.request("leave", { roomId, revision: lastReturn.room.revision });
  assert.equal(left.type, "left");
  console.log("HTTP storage and two-player WebSocket race: OK");
} finally {
  alice.close();
  bob.close();
}
