import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { decorateRoadblockRiders, lobbyRiderSlots, roadblockRunnerId,
  wrapLobbyChatBubble, type LobbyRoomSnapshot } from
  "./lobby-room-helpers";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function kl0(");
const end = release.indexOf("\nasync function Ll0(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

function released(mode: (room: LobbyRoomSnapshot) => string) {
  return new Function("G2", `${source}\nreturn { kl0, FT, TF, DT };`)(mode) as {
    kl0(text: string): string[];
    FT(room: LobbyRoomSnapshot, playerId: string): unknown;
    TF(room: LobbyRoomSnapshot): string | undefined;
    DT(room: LobbyRoomSnapshot, colors: { dyeId: number }[]):
      LobbyRoomSnapshot;
  };
}

test("room slot ordering, closed seats and missing player match release", () => {
  const old = released(() => "ordinary");
  for (const room of [
    { mode: "individual", capacity: 4, closedSlots: [2], members: [
      { playerId: "self", slot: 3 }, { playerId: "other", slot: 0 } ] },
    { mode: "team", capacity: 4, members: [
      { playerId: "self", slot: 5 }, { playerId: "other", slot: 0 } ] },
    { mode: "individual", capacity: 8, members: [
      { playerId: "self", slot: 9 } ] },
  ] satisfies LobbyRoomSnapshot[]) {
    for (const playerId of ["self", "missing"]) {
      assert.deepEqual(lobbyRiderSlots(room, playerId), old.FT(room, playerId));
    }
  }
});

test("roadblock runner choice and rider decoration match release", () => {
  const gameplayMode = (room: LobbyRoomSnapshot) =>
    room.mode === "roadblock" ? "roadblock" : "ordinary";
  const old = released(gameplayMode);
  const base: LobbyRoomSnapshot = {
    mode: "roadblock", capacity: 8, phase: "open", hostId: "host",
    race: { roadblock: { runnerId: "runner" } },
    members: [
      { playerId: "host", slot: 0, equipment: {
        itemIds: { 2: 300, 70: 10 }, kartId: 100 } },
      { playerId: "other", slot: 1, equipment: {
        itemIds: { 2: 301, 70: 11 } } },
      { playerId: "empty", slot: 2 },
    ],
  };
  const colors = [{ dyeId: 71 }, { dyeId: 72 }];
  for (const room of [base, { ...base, phase: "racing" },
    { ...base, mode: "ordinary" }, { ...base, hostId: "" }]) {
    const runner = roadblockRunnerId(room, gameplayMode);
    assert.equal(runner, old.TF(room));
    assert.deepEqual(decorateRoadblockRiders(room, colors, runner),
      old.DT(room, colors));
    if (!runner) assert.equal(decorateRoadblockRiders(room, colors, runner),
      room);
  }
  let expected = "";
  try { old.DT(base, []); } catch (error) { expected = (error as Error).message; }
  assert.throws(() => decorateRoadblockRiders(base, [], "host"),
    { message: expected });
});

test("chat bubble widths and truncation match release for ASCII and Unicode", () => {
  const old = released(() => "ordinary");
  for (const text of ["", "short", "a".repeat(80),
    "你好世界".repeat(20), "🏁🚗✨".repeat(30), "a b 中文 🏁".repeat(20)]) {
    assert.deepEqual(wrapLobbyChatBubble(text), old.kl0(text));
  }
});
