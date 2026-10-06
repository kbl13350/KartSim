#!/usr/bin/env node
/** Exercise special modes against the real frontend room/event validators. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const origin = (process.env.KART_SERVER_BASE ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
const wsUrl = process.env.KART_WS_URL ??
  `${origin.replace(/^http:/, "ws:").replace(/^https:/, "wss:")}/multiplayer/ws`;
const timeoutMs = Number(process.env.KART_SMOKE_TIMEOUT_MS ?? 8000);
const { tsImport } = await import("./rewrite/node_modules/tsx/dist/esm/api/index.mjs");
const { isValidRoomSnapshot } = await tsImport(
  "./rewrite/src/multiplayer/room-validation.ts", import.meta.url);
const { parseServerEvent } = await tsImport(
  "./rewrite/src/multiplayer/server-events.ts", import.meta.url);
const channelRules = {
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
};
const randomTrackCodes = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);
const verifiedRpKarts = new Set([387, 390, 378, 361]);
const validation = {
  validRoom: isValidRoomSnapshot,
  validChannel: (channel, mode, speed) =>
    channel in channelRules && channelRules[channel].mode === mode &&
    channelRules[channel].speed === speed,
  validGameplay: (gameplay, channel, version) => {
    if (gameplay === undefined || gameplay === "ordinary") return true;
    if (version !== "p3553" || !(channel in channelRules)) return false;
    if (gameplay === "roadblock" || gameplay === "giant")
      return channel === "speedIndiCombine";
    if (gameplay === "rp" || gameplay === "shadow") return true;
    return (gameplay === "lte" || gameplay === "grip") &&
      channelRules[channel].speed === 7;
  },
  validRandomTrackCode: code => randomTrackCodes.has(code),
};
const slots = [1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26,
  27, 30, 31, 32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78];
const browserDefaults = { 1: 2, 2: 1, 3: 387, 70: 1 };
const equipment = {
  itemIds: Object.fromEntries(slots.map(slot => [slot, browserDefaults[slot] ?? 0])),
  kartSerial: 0, valueAt3E: 0, exceedType: 0,
};

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

class Peer {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.events = [];
    this.waiters = new Set();
    this.failure = undefined;
    socket.addEventListener("message", event => {
      if (typeof event.data !== "string") return;
      let message;
      try { message = JSON.parse(event.data); }
      catch { return this.fail(new Error("Server sent invalid JSON")); }
      if (!parseServerEvent(message, validation))
        return this.fail(new Error(`Frontend rejected server event: ${JSON.stringify(message)}`));
      const waiter = [...this.waiters].find(entry => entry.predicate(message));
      if (waiter) waiter.resolve(message);
      else this.events.push(message);
    });
    socket.addEventListener("close", () => this.fail(new Error("WebSocket closed")));
    socket.addEventListener("error", () => this.fail(new Error("WebSocket error")));
  }

  static async connect(name) {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("WebSocket open timed out")), timeoutMs);
      socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebSocket open failed")); }, { once: true });
    });
    const peer = new Peer(socket);
    const welcome = await peer.request({ type: "hello", protocolVersion: 39,
      ruleset: "launcher-room-v1", resourceVersion: "p3553", name,
      equipment, initial: "", raceRuntime: true });
    assert.equal(welcome.type, "welcome");
    peer.playerId = welcome.playerId;
    return peer;
  }

  fail(error) {
    this.failure ??= error;
    for (const waiter of [...this.waiters]) waiter.reject(error);
  }

  waitFor(predicate) {
    if (this.failure) return Promise.reject(this.failure);
    const index = this.events.findIndex(predicate);
    if (index >= 0) return Promise.resolve(this.events.splice(index, 1)[0]);
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate,
        resolve: value => { clearTimeout(timer); this.waiters.delete(waiter); resolve(value); },
        reject: error => { clearTimeout(timer); this.waiters.delete(waiter); reject(error); },
      };
      const timer = setTimeout(() => waiter.reject(new Error("Timed out waiting for event")), timeoutMs);
      this.waiters.add(waiter);
    });
  }

  async request(fields) {
    const requestId = String(++this.nextId);
    const reply = this.waitFor(message => message.requestId === requestId);
    this.socket.send(JSON.stringify({ ...fields, requestId }));
    const message = await reply;
    assert.notEqual(message.type, "error", `${fields.type}: ${message.code}`);
    return message;
  }

  close() { this.socket.close(); }
}

const suffix = randomBytes(4).toString("hex");
const modes = [
  { gameplay: "roadblock", count: 5, channelName: "speedIndiCombine", speed: 7 },
  { gameplay: "giant", count: 2, channelName: "speedIndiCombine", speed: 7 },
  { gameplay: "rp", count: 2, channelName: "speedIndiInfinit", speed: 4 },
  { gameplay: "lte", count: 2, channelName: "speedIndiCombine", speed: 7 },
];

for (const mode of modes) {
  const peers = [];
  try {
    for (let index = 0; index < mode.count; index++) {
      peers.push(await Peer.connect(`S${mode.gameplay.slice(0, 2)}${index}${suffix}`));
    }
    const host = peers[0];
    const created = await host.request({ type: "create", name: `${mode.gameplay}${suffix}`,
      password: "", capacity: mode.count, channelName: mode.channelName,
      gameplay: mode.gameplay, mode: "individual", speed: mode.speed,
      speedVersion: "国服" });
    assert.equal(created.room.gameplay, mode.gameplay);
    assert.equal(created.room.phase, "open");
    const roomId = created.room.roomId;
    if (mode.gameplay === "roadblock" || mode.gameplay === "lte") {
      assert.equal(created.room.randomTrackCode, 0);
      assert.equal(created.room.trackId, undefined);
    }
    const listed = await peers[1].request({ type: "list-gameplay",
      gameplay: mode.gameplay, page: 0 });
    assert.ok(listed.rooms.some(room => room.roomId === roomId));

    let room = created.room;
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "join", roomId, password: "" })).room;
      assert.equal(room.members.length, peers.indexOf(peer) + 1);
    }
    for (const peer of peers.slice(1)) {
      room = (await peer.request({ type: "ready", roomId,
        revision: room.revision, ready: true })).room;
    }
    room = (await host.request({ type: "start", roomId, revision: room.revision })).room;
    assert.equal(room.phase, "loading");
    const raceId = room.race.raceId;
    assertStartSlots(room.race);
    if (mode.gameplay === "roadblock") {
      assert.equal(room.race.roadblock.limitMs, 180_000);
      assert.ok(peers.some(peer => peer.playerId === room.race.roadblock.runnerId));
    } else if (mode.gameplay === "giant") {
      assert.equal(room.race.giant.ruleset, "p948-giant-p3553-web-v1");
    } else if (mode.gameplay === "rp") {
      assert.equal(Object.keys(room.race.rp.draws).length, peers.length);
      for (const draw of Object.values(room.race.rp.draws)) {
        assert.ok(verifiedRpKarts.has(draw.kartId), `Unverified RP kart ${draw.kartId}`);
        assert.equal(draw.flyingPetId, 0);
      }
    } else {
      assert.equal(room.race.lte.ruleset, "web-lte-v1");
      assert.equal(room.race.lte.featureSet, "dodge-trial");
    }
    for (const peer of peers) {
      room = (await peer.request({ type: "loaded", roomId, raceId })).room;
    }
    assert.equal(room.phase, "countdown");
    const racing = await host.waitFor(message => message.type === "room" &&
      message.room?.roomId === roomId && message.room?.phase === "racing");
    assert.equal(racing.room.race.raceId, raceId);

    if (mode.gameplay === "roadblock") {
      const runner = peers.find(peer => peer.playerId === room.race.roadblock.runnerId);
      assert.ok(runner);
      await new Promise(resolve => setTimeout(resolve, 1100));
      const finished = await runner.request({ type: "finish", roomId, raceId, elapsedMs: 1000 });
      assert.equal(finished.room.phase, "finished");
      assert.equal(finished.room.race.roadblockOutcome.reason, "finish");
      assert.equal(finished.room.race.roadblockOutcome.runnerWon, true);
    } else {
      if (mode.gameplay === "giant") {
        await host.request({ type: "giant-state", roomId, raceId,
          sequence: 1, main: 1, extra: 0, status: 0 });
        const state = await peers[1].waitFor(message => message.type === "giant-state" &&
          message.roomId === roomId && message.raceId === raceId);
        assert.equal(state.playerId, host.playerId);
        assert.equal(state.main, 1);
      }
      for (const [index, peer] of peers.entries()) {
        room = (await peer.request({ type: "finish", roomId, raceId,
          elapsedMs: 60_000 + index * 1000 })).room;
      }
      assert.equal(room.phase, "finished");
      assert.equal(room.race.results.length, peers.length);
    }
    for (const [index, peer] of peers.entries()) {
      const returned = await peer.request({ type: "return-room", roomId, raceId });
      assert.equal(returned.room.phase,
        index === peers.length - 1 ? "open" : "finished");
    }
    const historyResponse = await fetch(`${origin}/api/race-outcomes?gameplay=${mode.gameplay}`,
      { signal: AbortSignal.timeout(timeoutMs) });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json();
    const saved = history.find(entry => entry.raceId === raceId);
    assert.ok(saved, `${mode.gameplay} outcome was not saved to SQLite`);
    assert.equal(saved.snapshot.race.gameplay, mode.gameplay);
    if (mode.gameplay === "roadblock")
      assert.equal(saved.snapshot.race.roadblockOutcome.runnerWon, true);
    console.log(`✓ ${mode.gameplay}: validated lobby, race and result snapshots`);
  } finally {
    for (const peer of peers) peer.close();
  }
}

console.log("PASS: all special modes accepted by the real frontend validators");
