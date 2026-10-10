import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { receiveGameControlEvent } from "./client-control-receiver";
import type { ClientConnectionHost } from "./client-connect";
import { SERVER_EVENT_TYPES, isValidItemRequest, parseServerMessage, PROTOCOL_VERSION } from "./protocol";
import { parseServerEvent, type ServerEventValidation } from "./server-events";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const constants = source.indexOf("const Uo = 39,");
const roomParser = source.indexOf("function bP(", constants);
const eventParser = source.indexOf("function zo0(", roomParser);
const afterParser = source.indexOf("const Uo0 =", eventParser);
assert.ok(constants > 0 && roomParser > constants && eventParser > roomParser &&
  afterParser > eventParser);

const deps: ServerEventValidation = {
  validRoom: value => !!value && typeof value === "object" &&
    (value as { roomId?: string }).roomId === "valid-room",
  validChannel: (channel, mode, speed) =>
    channel === "speedIndiCombine" && mode === "individual" && speed === 7,
  validGameplay: gameplay => gameplay === "ordinary" || gameplay === undefined,
  validRandomTrackCode: code => code === 8,
};
const releaseParser = new Function("bP", "W6", "To", "X6", "t20",
  // The release's protocol version, raised to ours (motion frames by slot, protocol 40).
  `${source.slice(constants, roomParser).replace("const Uo = 39,", `const Uo = ${PROTOCOL_VERSION},`)}
${source.slice(eventParser, afterParser)}\nreturn zo0;`)(
    deps.validRoom, deps.validChannel, deps.validGameplay,
    (code: number) => deps.validRandomTrackCode(code) ? { code } : undefined,
    (value: Record<string, unknown>) => Number.isInteger(value.main) &&
      Number(value.main) >= 0 && Number(value.main) <= 4 &&
      Number.isInteger(value.extra) && Number(value.extra) >= 0 && Number(value.extra) <= 2 &&
      (value.main === 4 || value.extra === 0) &&
      (value.status === 0 || value.status === 1),
  ) as (value: unknown) => unknown;

const roomId = "room-1";
const raceId = "race-1";
const playerId = "player-1";
const chat = { sequence: 1, playerId, name: "Guest", text: "hello" };
const roomSummary = { roomId, name: "Test", mode: "individual", capacity: 8,
  speedVersion: "国服", channelName: "speedIndiCombine", speed: 7,
  gameplay: "ordinary", count: 2, locked: false, resourceVersion: "p3553",
  trackId: "village_R01" };

test("all control envelope branches and giant-state projection match release", () => {
  const examples: unknown[] = [
    null, [], {}, { type: "unknown" }, { type: "latency-ack" },
    { type: "latency-ack", requestId: "" },
    { type: "p2p-signal", roomId, raceId, playerId, generation: "g1",
      kind: "offer", sdp: "v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel" },
    { type: "p2p-signal", roomId, raceId, playerId, generation: "g1",
      kind: "offer", sdp: "v=0\nm=audio 9 RTP/AVP 0" },
    { type: "p2p-relay", roomId, raceId, playerId },
    { type: "p2p-accepted", roomId, raceId },
    { type: "welcome", playerId, protocolVersion: PROTOCOL_VERSION,
      ruleset: "launcher-room-v1", capabilities: ["p2p-motion"] },
    { type: "team-gauge", roomId, raceId, team: 1, sequence: 4, target: 0.7 },
    { type: "giant-state", roomId, raceId, playerId, sequence: 2,
      main: 4, extra: 2, status: 1, ignored: "strip-me" },
    { type: "giant-state", roomId, raceId, playerId, sequence: 2,
      main: 2, extra: 2, status: 1 },
    { type: "award-motion", roomId, raceId, playerId, motion: 12 },
    { type: "latency-probe", roomId, raceId, nonce: "n1" },
    { type: "latency", roomId, raceId, playerId, latencyMs: 101 },
    { type: "room", room: { roomId: "valid-room" } },
    { type: "room", room: { roomId: "bad-room" } },
    { type: "room-settings", roomId, revision: 1, name: "Room", password: "" },
    { type: "chat", roomId, message: chat },
    { type: "race-chat", roomId, raceId, message: chat },
    { type: "left", roomId },
    { type: "error", code: "INVALID_ROOM" },
    { type: "clock", clientTick: 23.1, serverTick: 24.2 },
    { type: "rooms", page: 0, total: 1, rooms: [roomSummary] },
    { type: "rooms", page: 0, total: 1,
      rooms: [{ ...roomSummary, randomTrackCode: 8, trackId: undefined }] },
    { type: "rooms", page: 0, total: 1,
      rooms: [{ ...roomSummary, count: 9 }] },
  ];
  for (const example of examples) {
    assert.deepEqual(parseServerEvent(example, deps), releaseParser(example),
      JSON.stringify(example));
  }
});

const item = { type: "item", roomId, raceId };
const slots = [7, -1];

test("every item event action is projected onto its known fields", () => {
  const accepted: Array<[unknown, unknown]> = [
    [{ ...item, requestId: "r1", action: "grant", cubeId: 12, itemId: 7, slots, extra: 1 },
      { ...item, requestId: "r1", action: "grant", cubeId: 12, itemId: 7, slots }],
    [{ ...item, action: "grant", cubeId: 4096, itemId: null, reason: "full", slots: [8, 9, 6] },
      { ...item, action: "grant", cubeId: 4096, itemId: null, reason: "full", slots: [8, 9, 6] }],
    [{ ...item, action: "grant", cubeId: 1, itemId: null, reason: "abusing", slots: [null, null] },
      { ...item, action: "grant", cubeId: 1, itemId: null, reason: "abusing", slots: [-1, -1] }],
    [{ ...item, action: "used", playerId, useId: 3, itemId: 7, targets: ["player-2"],
      startAt: 1234.5, etaMs: 1500 },
    { ...item, action: "used", playerId, useId: 3, itemId: 7, targets: ["player-2"],
      startAt: 1234.5, etaMs: 1500 }],
    [{ ...item, requestId: "r2", action: "used", playerId, useId: 4, itemId: 8, targets: [],
      startAt: 0, etaMs: 0, point: { x: 1, y: -2, z: 3.5, w: 9 }, slots: [-1, -1] },
    { ...item, requestId: "r2", action: "used", playerId, useId: 4, itemId: 8, targets: [],
      startAt: 0, etaMs: 0, point: { x: 1, y: -2, z: 3.5 }, slots: [-1, -1] }],
    [{ ...item, action: "placed", playerId, useId: 5, itemId: 113, point: { x: 0, y: 0, z: 0 } },
      { ...item, action: "placed", playerId, useId: 5, itemId: 113, point: { x: 0, y: 0, z: 0 } }],
    [{ ...item, action: "hit", playerId: "player-2", useId: 3, itemId: 7, userId: playerId,
      result: "blocked", by: "shield" },
    { ...item, action: "hit", playerId: "player-2", useId: 3, itemId: 7, userId: playerId,
      result: "blocked", by: "shield" }],
    [{ ...item, action: "hit", playerId, useId: 0, itemId: 8, result: "hit", removed: true,
      hazardId: 2 },
    { ...item, action: "hit", playerId, useId: 0, itemId: 8, result: "hit", removed: true,
      hazardId: 2 }],
    // The game node writes userId null for a track hazard.
    [{ ...item, requestId: "r4", action: "hit", playerId, useId: 0, itemId: 17, userId: null,
      result: "blocked", by: "shield", hazardId: 9, sequence: 5 },
    { ...item, requestId: "r4", action: "hit", playerId, useId: 0, itemId: 17,
      result: "blocked", by: "shield", hazardId: 9 }],
    [{ ...item, requestId: "r3", action: "slots", slots: [6, 7] },
      { ...item, requestId: "r3", action: "slots", slots: [6, 7] }],
    [{ ...item, action: "scan", playerId: "player-2", slots: [10, 109, -1], until: 9000 },
      { ...item, action: "scan", playerId: "player-2", slots: [10, 109, -1], until: 9000 }],
    // A trapped racer left its bubble early (the reply carries the sequence).
    [{ ...item, action: "escaped", playerId: "player-2", useId: 6, itemId: 9 },
      { ...item, action: "escaped", playerId: "player-2", useId: 6, itemId: 9 }],
    [{ ...item, requestId: "r5", action: "escaped", playerId, useId: 0, itemId: 37, hazardId: 3,
      sequence: 8 },
    { ...item, requestId: "r5", action: "escaped", playerId, useId: 0, itemId: 37, hazardId: 3 }],
  ];
  for (const [event, parsed] of accepted) {
    assert.deepEqual(parseServerEvent(event, deps), parsed, JSON.stringify(event));
  }
});

test("an invalid item event is dropped without closing the connection", () => {
  const invalid: unknown[] = [
    { ...item, action: "unknown" },
    { ...item, action: "grant", cubeId: 0, itemId: 7, slots },
    { ...item, action: "grant", cubeId: 4097, itemId: 7, slots },
    { ...item, action: "grant", cubeId: 1, itemId: 7, reason: "full", slots },
    { ...item, action: "grant", cubeId: 1, itemId: null, reason: "late", slots },
    { ...item, action: "grant", cubeId: 1, itemId: 256, slots },
    { ...item, action: "grant", cubeId: 1, slots },
    { ...item, action: "grant", cubeId: 1, itemId: 7, slots: [7] },
    { ...item, action: "grant", cubeId: 1, itemId: 7, slots: [7, 7, 7, 7] },
    { ...item, action: "grant", cubeId: 1, itemId: 7, slots: [7, -2] },
    { ...item, action: "used", playerId, useId: 0, itemId: 7, targets: [], startAt: 0, etaMs: 0 },
    { ...item, action: "used", playerId, useId: 1, itemId: 7, targets: ["a", "a"], startAt: 0,
      etaMs: 0 },
    { ...item, action: "used", playerId, useId: 1, itemId: 7, targets: [], startAt: -1,
      etaMs: 0 },
    { ...item, action: "used", playerId, useId: 1, itemId: 7, targets: [], startAt: 0,
      etaMs: 60_001 },
    { ...item, action: "used", playerId, useId: 1, itemId: 7, targets: [], startAt: 0,
      etaMs: 0, point: { x: Number.NaN, y: 0, z: 0 } },
    { ...item, action: "placed", playerId, useId: 1, itemId: 113 },
    { ...item, action: "placed", playerId, useId: 1, itemId: 113,
      point: { x: 2_000_000, y: 0, z: 0 } },
    { ...item, action: "hit", playerId, useId: 3, itemId: 7, result: "hit" },
    { ...item, action: "hit", playerId, useId: 3, itemId: 7, userId: null, result: "hit" },
    { ...item, action: "hit", playerId, useId: 3, itemId: 7, userId: "u", result: "miss" },
    { ...item, action: "hit", playerId, useId: 3, itemId: 7, userId: "u", result: "hit",
      by: "shield" },
    { ...item, action: "hit", playerId, useId: 3, itemId: 7, userId: "u", result: "blocked",
      by: "wall" },
    { ...item, action: "hit", playerId, useId: -1, itemId: 7, userId: "u", result: "hit" },
    { ...item, action: "hit", playerId, useId: 0, itemId: 8, result: "hit", removed: "yes" },
    { ...item, action: "slots", slots: "7,-1" },
    { ...item, action: "scan", playerId, slots },
    { ...item, action: "escaped", useId: 6, itemId: 9 },
    { ...item, action: "escaped", playerId, useId: -1, itemId: 9 },
    { ...item, action: "escaped", playerId, useId: 6, itemId: 256 },
    { ...item, action: "escaped", playerId, useId: 0, itemId: 37 },
    { ...item, action: "escaped", playerId, useId: 0, itemId: 37, hazardId: 4097 },
    { type: "item", raceId, action: "slots", slots },
    { type: "item", roomId, action: "slots", slots },
  ];
  for (const event of invalid) {
    assert.deepEqual(parseServerEvent(event, deps), { type: "error", code: "INVALID_ITEM_EVENT" },
      JSON.stringify(event));
  }
  // The answer to an item request rejects only that request.
  assert.deepEqual(parseServerEvent({ ...item, requestId: "r9", action: "slots" }, deps),
    { type: "error", code: "INVALID_ITEM_EVENT", requestId: "r9" });
  assert.deepEqual(parseServerEvent({ ...item, requestId: "", action: "slots", slots }, deps),
    { type: "error", code: "INVALID_ITEM_EVENT" });
  // Other malformed events still close the connection.
  assert.equal(parseServerEvent({ type: "giant-state", roomId }, deps), undefined);
});

test("the receiver rejects the pending item request and keeps the connection", () => {
  const events: unknown[] = [];
  let disposed = false;
  const host = {
    motionScope: undefined,
    pending: new Map([["r9", {
      timer: setTimeout(() => {}, 0),
      resolve: (value: unknown) => events.push(["resolve", value]),
      reject: (error: Error) => events.push(["reject", error.message]),
    }]]),
    listeners: new Set([(message: unknown) => events.push(["listener", message])]),
    dispose: () => { disposed = true; },
  } as unknown as ClientConnectionHost;
  const validate = (value: unknown) => parseServerEvent(value, deps);
  receiveGameControlEvent(host, { ...item, requestId: "r9", action: "slots", slots: [99, 999] },
    validate, () => 0);
  receiveGameControlEvent(host, { ...item, action: "scan", playerId, slots, until: "soon" },
    validate, () => 0);
  assert.equal(disposed, false);
  assert.deepEqual(events, [
    ["reject", "INVALID_ITEM_EVENT"],
    ["listener", { type: "error", code: "INVALID_ITEM_EVENT", requestId: "r9" }],
    ["listener", { type: "error", code: "INVALID_ITEM_EVENT" }],
  ]);
  receiveGameControlEvent(host, { type: "nonsense" }, validate, () => 0);
  assert.equal(disposed, true);
});

test("the item event type and item requests are part of the client protocol", () => {
  assert.ok(SERVER_EVENT_TYPES.includes("item"));
  assert.equal(parseServerMessage({ ...item, action: "slots", slots }).type, "item");
  const request = { type: "item", roomId, raceId, sequence: 1 };
  for (const valid of [
    { ...request, action: "cube", cubeId: 1, capacity: 2 },
    { ...request, action: "cube", cubeId: 4096, capacity: 3 },
    { ...request, action: "use", itemId: 7, targetId: "player-2" },
    { ...request, action: "use", itemId: 8, point: { x: 1, y: 2, z: 3 } },
    { ...request, action: "place", useId: 9, point: { x: 1, y: 2, z: 3 } },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "blocked", by: "angel" },
    { ...request, action: "hit", useId: 0, itemId: 8, result: "hit", hazardId: 4 },
    { ...request, action: "swap" },
    { ...request, action: "change" },
    { ...request, action: "slots" },
    { ...request, action: "escape", useId: 9 },
    { ...request, action: "escape", useId: 0, hazardId: 4 },
  ]) assert.equal(isValidItemRequest(valid), true, JSON.stringify(valid));
  for (const invalid of [
    { ...request, sequence: 0, action: "swap" },
    { ...request, action: "cube", cubeId: 1, capacity: 4 },
    { ...request, action: "cube", cubeId: 0, capacity: 2 },
    { ...request, action: "use", itemId: 300 },
    { ...request, action: "place", useId: 0, point: { x: 1, y: 2, z: 3 } },
    { ...request, action: "hit", useId: 1, itemId: 7, result: "hit", by: "shield" },
    { ...request, action: "throw" },
    { ...request, action: "escape" },
    { ...request, action: "escape", useId: -1 },
    { ...request, action: "escape", useId: 0 },
    { ...request, action: "escape", useId: 0, hazardId: 0 },
    { ...request, type: "giant-state", action: "swap" },
  ]) assert.equal(isValidItemRequest(invalid), false, JSON.stringify(invalid));
});

test("phase 3: changers, double rockets, hit outcomes, slot pushes and lucci (ITEM_MODE.md C.7)", () => {
  const changers = { slot: 12, item: -1, itemArmed: true };
  const accepted: Array<[unknown, unknown]> = [
    [{ ...item, requestId: "r1", action: "grant", cubeId: 3, itemId: 7, slots, changers },
      { ...item, requestId: "r1", action: "grant", cubeId: 3, itemId: 7, slots, changers }],
    [{ ...item, requestId: "r2", action: "used", playerId, useId: 4, itemId: 7, targets: ["b"],
      startAt: 5, etaMs: 300, count: 2, slots: [-1, -1], changers },
    { ...item, requestId: "r2", action: "used", playerId, useId: 4, itemId: 7, targets: ["b"],
      startAt: 5, etaMs: 300, slots: [-1, -1], changers, count: 2 }],
    [{ ...item, action: "hit", playerId: "b", useId: 4, itemId: 7, userId: playerId, result: "hit",
      variant: "balloon", shot: 1 },
    { ...item, action: "hit", playerId: "b", useId: 4, itemId: 7, userId: playerId, result: "hit",
      variant: "balloon", shot: 1 }],
    [{ ...item, action: "hit", playerId: "b", useId: 5, itemId: 2, userId: playerId, result: "blocked",
      by: "kart" },
    { ...item, action: "hit", playerId: "b", useId: 5, itemId: 2, userId: playerId, result: "blocked",
      by: "kart" }],
    [{ ...item, action: "hit", playerId: "b", useId: 6, itemId: 8, userId: playerId, result: "blocked",
      by: "eat", removed: true },
    { ...item, action: "hit", playerId: "b", useId: 6, itemId: 8, userId: playerId, result: "blocked",
      by: "eat", removed: true }],
    // A mine the kart ate, with the lucciMine bonus.
    [{ ...item, action: "hit", playerId, useId: 0, itemId: 17, result: "blocked", by: "eat",
      variant: "bonus", hazardId: 3 },
    { ...item, action: "hit", playerId, useId: 0, itemId: 17, result: "blocked", by: "eat",
      variant: "bonus", hazardId: 3 }],
    ...(["small", "headband", "bonus", "quick"] as const).map(variant => [
      { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "hit", variant },
      { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "hit", variant },
    ] as [unknown, unknown]),
    [{ ...item, action: "hit", playerId, useId: 7, itemId: 7, userId: "b", result: "blocked", by: "pet",
      shot: 0 },
    { ...item, action: "hit", playerId, useId: 7, itemId: 7, userId: "b", result: "blocked", by: "pet",
      shot: 0 }],
    // The server's pushes: a gained item, the 迅 start item.
    [{ ...item, action: "slots", slots: [8, 6], changers, reason: "gain", itemId: 6 },
      { ...item, action: "slots", slots: [8, 6], changers, reason: "gain", itemId: 6 }],
    [{ ...item, action: "slots", slots: [33, -1, -1], changers, reason: "start", itemId: 33 },
      { ...item, action: "slots", slots: [33, -1, -1], changers, reason: "start", itemId: 33 }],
    [{ ...item, requestId: "r3", action: "slots", slots: [6, 7], changers: { slot: 0, item: 0, itemArmed: false } },
      { ...item, requestId: "r3", action: "slots", slots: [6, 7], changers: { slot: 0, item: 0, itemArmed: false } }],
    [{ ...item, action: "lucci", amount: 10, reason: "lucciUfo" },
      { ...item, action: "lucci", amount: 10, reason: "lucciUfo" }],
    // The node's per-slot special booster icons (0: the item's own).
    [{ ...item, requestId: "r6", action: "grant", cubeId: 3, itemId: 31, slots: [31, -1], slotIcons: [241, 0] },
      { ...item, requestId: "r6", action: "grant", cubeId: 3, itemId: 31, slots: [31, -1], slotIcons: [241, 0] }],
    [{ ...item, action: "slots", slots: [6, 31, -1], slotIcons: [0, 266, 0], reason: "gain", itemId: 31 },
      { ...item, action: "slots", slots: [6, 31, -1], slotIcons: [0, 266, 0], reason: "gain", itemId: 31 }],
    [{ ...item, requestId: "r7", action: "used", playerId, useId: 9, itemId: 6, targets: [], startAt: 1,
      etaMs: 0, slots: [31, -1], slotIcons: [97, 0] },
    { ...item, requestId: "r7", action: "used", playerId, useId: 9, itemId: 6, targets: [], startAt: 1,
      etaMs: 0, slots: [31, -1], slotIcons: [97, 0] }],
  ];
  for (const [event, parsed] of accepted)
    assert.deepEqual(parseServerEvent(event, deps), parsed, JSON.stringify(event));
  const invalid: unknown[] = [
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: { slot: -2, item: 0, itemArmed: true } },
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: { slot: 1, item: 0 } },
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: { slot: 1, item: 0, itemArmed: 1 } },
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: { slot: 1.5, item: 0, itemArmed: true } },
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: { slot: 1, item: 0, itemArmed: true, x: 1 } },
    { ...item, action: "grant", cubeId: 3, itemId: 7, slots, changers: [1, 0, true] },
    { ...item, action: "used", playerId, useId: 4, itemId: 7, targets: [], startAt: 5, etaMs: 0, count: 1 },
    { ...item, action: "used", playerId, useId: 4, itemId: 7, targets: [], startAt: 5, etaMs: 0, count: 3 },
    { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "hit", variant: "big" },
    { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "blocked", by: "kart",
      variant: "headband" },
    { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "blocked", variant: "bonus" },
    { ...item, action: "hit", playerId, useId: 7, itemId: 3, userId: "b", result: "hit", by: "eat" },
    { ...item, action: "hit", playerId, useId: 7, itemId: 7, userId: "b", result: "hit", shot: 2 },
    { ...item, action: "hit", playerId, useId: 0, itemId: 8, result: "hit", shot: 0, hazardId: 1 },
    { ...item, action: "slots", slots, reason: "gain" },
    { ...item, action: "slots", slots, reason: "cube", itemId: 6 },
    { ...item, action: "slots", slots, itemId: 6 },
    { ...item, action: "lucci", amount: 0, reason: "x" },
    { ...item, action: "lucci", amount: 201, reason: "x" },
    { ...item, action: "lucci", amount: 10 },
    { ...item, action: "lucci", amount: 10, reason: "a b" },
    { ...item, action: "grant", cubeId: 3, itemId: 31, slots: [31, -1], slotIcons: [241] },
    { ...item, action: "grant", cubeId: 3, itemId: 31, slots: [31, -1], slotIcons: [241, -1] },
    { ...item, action: "slots", slots: [31, -1], slotIcons: "241" },
    { ...item, action: "used", playerId, useId: 9, itemId: 6, targets: [], startAt: 1, etaMs: 0,
      slotIcons: [0, 0] },
  ];
  for (const event of invalid)
    assert.deepEqual(parseServerEvent(event, deps), { type: "error", code: "INVALID_ITEM_EVENT" },
      JSON.stringify(event));
  // Requests: the new defences, variants and shots.
  const request = { type: "item", roomId, raceId, sequence: 1 };
  for (const valid of [
    { ...request, action: "hit", useId: 9, itemId: 2, result: "blocked", by: "kart" },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "blocked", by: "pet", shot: 1 },
    { ...request, action: "hit", useId: 0, itemId: 8, result: "blocked", by: "eat", hazardId: 2 },
    { ...request, action: "hit", useId: 0, itemId: 17, result: "blocked", by: "eat", variant: "bonus", hazardId: 2 },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "hit", variant: "balloon", shot: 0 },
    { ...request, action: "hit", useId: 9, itemId: 9, result: "hit", variant: "quick" },
    { ...request, action: "hit", useId: 9, itemId: 104, result: "hit", variant: "small" },
  ]) assert.equal(isValidItemRequest(valid), true, JSON.stringify(valid));
  for (const invalid of [
    { ...request, action: "hit", useId: 9, itemId: 7, result: "hit", variant: "huge" },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "blocked", by: "kart", variant: "balloon" },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "hit", shot: 2 },
    { ...request, action: "hit", useId: 0, itemId: 8, result: "hit", shot: 0, hazardId: 2 },
    { ...request, action: "hit", useId: 9, itemId: 7, result: "blocked", by: "goggle" },
  ]) assert.equal(isValidItemRequest(invalid), false, JSON.stringify(invalid));
});
