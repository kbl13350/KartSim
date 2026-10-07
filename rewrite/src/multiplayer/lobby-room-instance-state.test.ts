import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeLobbyRoom } from "./lobby-room-construction";
import { initializeLobbyRoomInstanceState } from
  "./lobby-room-instance-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class py {");
const end = release.indexOf("\nclass gy {", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

test("room instance fields precede constructor state like release", () => {
  const Original = new Function(`${source}\nreturn py;`)() as new (
    room: unknown, playerId: string, actions: unknown, library: unknown,
  ) => Record<string, unknown>;
  const actions = { send() {} };
  const library = { id: "library" };
  for (const room of [
    { phase: "open", chat: [{ sequence: 2 }, { sequence: 7 }] },
    { phase: "open", chat: [] },
  ]) {
    const old = new Original(room, "self", actions, library);
    const modern: Record<string, unknown> = {};
    initializeLobbyRoomInstanceState(modern, {
      emotion() {}, room() {},
    });
    initializeLobbyRoom(modern as unknown as Parameters<typeof initializeLobbyRoom>[0],
      room, "self", actions, library);
    assert.deepEqual(Object.keys(modern), Object.keys(old));
    const normalize = (value: Record<string, unknown>) => Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key,
        typeof entry === "function" ? "function" : entry]));
    assert.deepEqual(normalize(modern), normalize(old));
    assert.notEqual(modern.bubbles, old.bubbles);
    assert.notEqual(modern.emotions, old.emotions);
    assert.notEqual(modern.roleTeams, old.roleTeams);
  }
});
