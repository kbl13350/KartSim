import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RoomState, type ActiveRoom, type RoomStateEvent } from "./room-state";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("class Ul0 {");
const end = source.indexOf("const $l0 =", start);
assert.ok(start > 0 && end > start);
const Original = new Function(`${source.slice(start, end)}\nreturn Ul0;`)() as
  new () => RoomState;

const me = "player-1";
const other = "player-2";
const room = (revision: number, roomId = "room-1"): ActiveRoom => ({
  roomId, revision, name: "Lobby", phase: "open",
  members: [{ playerId: me, name: "Me", slot: 0, ready: false, team: null }],
});
const chat = (sequence: number) => ({ sequence, playerId: other, name: "Other", text: `Message ${sequence}` });

test("room replacement, departure and explicit rejoin match release", () => {
  const run = (state: RoomState) => {
    const result = [
      state.apply({ type: "room", room: room(1) }, me),
      state.apply({ type: "room", room: room(1) }, me),
      state.apply({ type: "room", room: room(2, "other-room") }, me),
      state.apply({ type: "room", room: room(2) }, other),
      state.apply({ type: "room", room: room(2) }, me),
      state.apply({ type: "left", roomId: "other-room" }, me),
      state.apply({ type: "left", roomId: "room-1" }, me),
      state.apply({ type: "room", room: room(3) }, me),
    ];
    state.allowJoin("room-1");
    result.push(state.apply({ type: "room", room: room(3) }, me));
    result.push(state.apply({ type: "unknown" } as RoomStateEvent, me));
    return { result, room: state.room, departed: [...state.departed] };
  };
  assert.deepEqual(run(new RoomState()), run(new Original()));
});

test("chat accepts increasing sequence and retains the last 32 entries", () => {
  const run = (state: RoomState) => {
    state.apply({ type: "room", room: room(1) }, me);
    const result = [state.appendChat({ roomId: "wrong", message: chat(1) })];
    for (let sequence = 1; sequence <= 34; sequence++) {
      result.push(state.appendChat({ roomId: "room-1", message: chat(sequence) }));
    }
    result.push(state.appendChat({ roomId: "room-1", message: chat(33) }));
    return { result, room: state.room };
  };
  assert.deepEqual(run(new RoomState()), run(new Original()));
});
