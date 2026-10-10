import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeLobbyShellState, lobbyHasModal, lobbyIsInRoom } from
  "./lobby-shell-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Wl0 {");
const end = release.indexOf("\nfunction Hl0(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

test("lobby shell owns fresh released fields in initialization order", () => {
  const events: string[] = [];
  class AbortStub { constructor() { events.push("abort"); } }
  class ClientStub { constructor() { events.push("client"); } }
  class StateStub {
    room: unknown;
    constructor() { events.push("state"); }
  }
  const Original = new Function("AbortController", "LT", "Ul0",
    `${source}\nreturn Wl0;`)(AbortStub, ClientStub, StateStub) as
    new (options: unknown) => Record<string, unknown> & {
      readonly hasModal: boolean; readonly isInRoom: boolean;
    };
  const options = { raceLoader: undefined, nickname: "车手" };
  const old = new Original(options);
  const originalEvents = events.splice(0);
  const modern: Record<string, unknown> = {};
  initializeLobbyShellState(modern, options, {
    createAbortController: () => new AbortStub(),
    createClient: () => new ClientStub(),
    createState: () => new StateStub(),
  });
  assert.deepEqual(events, originalEvents);
  assert.deepEqual(Object.keys(modern), Object.keys(old));
  assert.deepEqual(modern, Object.assign({}, old));
  assert.equal(modern.options, options);
  assert.notEqual(modern.favoriteTracks, old.favoriteTracks);
  assert.notEqual(modern.rooms, old.rooms);

  for (const field of ["leaving", "busy", "modalLoading", "dialog",
    "trackSelect", "garage"]) {
    old[field] = field === "leaving" || field === "busy" ||
      field === "modalLoading" ? true : { id: field };
    modern[field] = old[field];
    assert.equal(lobbyHasModal(modern as unknown as Parameters<typeof lobbyHasModal>[0]),
      old.hasModal, field);
    old[field] = modern[field] = field === "leaving" || field === "busy" ||
      field === "modalLoading" ? false : undefined;
  }
  assert.equal(lobbyHasModal(modern as unknown as Parameters<typeof lobbyHasModal>[0]),
    old.hasModal);
  const room = { roomId: "room" };
  (old.state as StateStub).room = room;
  (modern.state as StateStub).room = room;
  assert.equal(lobbyIsInRoom(modern as unknown as Parameters<typeof lobbyIsInRoom>[0]),
    old.isInRoom);
});
