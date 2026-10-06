import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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
  `${source.slice(constants, roomParser)}\n${source.slice(eventParser, afterParser)}\nreturn zo0;`)(
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
    { type: "welcome", playerId, protocolVersion: 39,
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
