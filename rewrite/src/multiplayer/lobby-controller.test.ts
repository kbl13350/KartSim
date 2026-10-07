import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { MultiplayerLobbyController, type MultiplayerLobbyServices } from
  "./lobby-controller";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Wl0 {");
const end = release.indexOf("\nfunction C1(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

async function observe(rewritten: boolean) {
  const events: unknown[][] = [];
  class AbortStub { constructor() { events.push(["abort"]); } }
  class ClientStub {
    constructor() { events.push(["client"]); }
    networkDiagnostics() { events.push(["diagnostics"]); return [42]; }
    async request(message: unknown) {
      events.push(["request", message]);
      return { type: "rooms", rooms: [{ roomId: "r1" }], total: 1 };
    }
  }
  class StateStub {
    room: unknown;
    constructor() { events.push(["state"]); }
  }
  const options = {
    version: "p3553", raceLoader: undefined,
    status(message: string, failure?: boolean) {
      events.push(["status", message, failure]);
    },
  };
  const Original = new Function("LT", "Ul0", "AbortController", "rg",
    `${source}\nreturn Wl0;`)(ClientStub, StateStub, AbortStub,
      () => true) as new (settings: { version: string;
        raceLoader?: unknown; status(message: string, failure?: boolean): void }) =>
        Record<string, unknown>;
  const dependencies = {
    state: {
      createAbortController: () => new AbortStub(),
      createClient: () => new ClientStub(),
      createState: () => new StateStub(),
    },
    race: {},
  } as unknown as MultiplayerLobbyServices;
  const instance = rewritten
    ? new MultiplayerLobbyController(options as never, dependencies)
    : new Original(options);
  const host = instance as unknown as Record<string, unknown>;
  const keys = Object.keys(host);
  const initial = JSON.parse(JSON.stringify(host, (_key, value: unknown) =>
    typeof value === "function" ? "function" : value instanceof Set
      ? [...value] : value));
  const diagnostics = (instance as MultiplayerLobbyController).networkDiagnostics();
  const modalInitially = (instance as MultiplayerLobbyController).hasModal;
  host.dialog = { id: "dialog" };
  const modalWithDialog = (instance as MultiplayerLobbyController).hasModal;
  host.dialog = undefined;
  host.quickJoin = () => { events.push(["quick-join"]); };
  host.connected = true;
  (instance as MultiplayerLobbyController).quickJoinShortcut();
  host.lobby = { setRooms(...args: unknown[]) { events.push(["rooms", args]); } };
  await (instance as MultiplayerLobbyController).list("speedIndiCombine", 0);
  const rooms = host.rooms;
  const inRoomInitially = (instance as MultiplayerLobbyController).isInRoom;
  (host.state as StateStub).room = { roomId: "r1" };
  const inRoomAfterJoin = (instance as MultiplayerLobbyController).isInRoom;
  return { keys, initial, events, diagnostics, modalInitially,
    modalWithDialog, rooms, inRoomInitially, inRoomAfterJoin,
    selection: host.selection, channelName: host.channelName };
}

test("lobby controller construction, room list and modal actions match release", async () => {
  assert.deepEqual(await observe(true), await observe(false));
});
