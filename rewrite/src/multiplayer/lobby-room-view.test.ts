import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatMultiplayerError } from "./errors";
import { showLobbyRoom, type LoadRoomView, type RoomViewCallbacks,
  type RoomViewHost } from "./lobby-room-view";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  async showRoom() {", classStart);
const end = source.indexOf("  async list(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = source.slice(start, end);

const room = (): LobbyRoom => ({ roomId: "room-1", revision: 4, name: "Room",
  phase: "open", hostId: "me", mode: "individual", speed: 7,
  members: [{ playerId: "me", name: "Me", slot: 0, ready: false, team: null }] });

function fixture(behavior: "success" | "stale" | "failure" = "success") {
  const events: unknown[] = [];
  let callbacks: RoomViewCallbacks | undefined;
  const host = {
    options: { library: "library", root: "root", raceLoader: {}, garage: {},
      audioContext: () => "audio", onPageAudio: (page: string) => events.push(["audio", page]),
      status: (message: string, error?: boolean) => events.push(["status", message, error]) },
    state: { room: room() },
    client: { captureClock: () => { events.push("clock"); return 42; },
      dispose: () => events.push("client.dispose") },
    lobby: { hide: () => events.push("lobby.hide") },
    roomView: undefined,
    playerId: "me", generation: 0, manualStartAfter: 0,
    roomLoading: false, disposed: false, raceVisible: false,
    leaveRoom: async (reason: string) => { events.push(["leave", reason]); return true; },
    mutate: async (message: Record<string, unknown>) => { events.push(["mutate", message]); return true; },
    cancelCountdownModals: () => events.push("countdown"),
    changeRoomInfo: async () => { events.push("settings"); },
    team: async () => { events.push("team"); },
    chooseTrack: async () => { events.push("track"); },
    chooseGarage: async () => { events.push("garage"); },
    sendChat: async (text: string) => { events.push(["chat", text]); return true; },
    confirm: async (title: string, message: string, action: () => void) => {
      events.push(["confirm", title, message]); action();
    },
    render: () => events.push("render"),
    maybeAutoReady: () => events.push("autoReady"),
  } as unknown as RoomViewHost;
  const load: LoadRoomView = async (_library, _root, selected, playerId, options, audio) => {
    events.push(["load", selected.roomId, playerId, audio]);
    callbacks = options;
    if (behavior === "stale") ++host.generation;
    if (behavior === "failure") throw new Error("VIEW_FAIL");
    return { show: () => events.push("view.show"),
      dispose: () => events.push("view.dispose") };
  };
  const Original = new Function("py", "C1", `return class { ${method} };`)(
    { load }, formatMultiplayerError,
  ) as new () => { showRoom(this: RoomViewHost): Promise<void> };
  return { host, events, load, Original, getCallbacks: () => callbacks };
}

async function run(released: boolean, behavior: "success" | "stale" | "failure") {
  const { host, events, load, Original, getCallbacks } = fixture(behavior);
  if (released) await Original.prototype.showRoom.call(host);
  else await showLobbyRoom(host, load);
  const callbacks = getCallbacks();
  if (behavior === "success" && callbacks) {
    callbacks.ready(true);
    callbacks.start?.();
    callbacks.settings();
    callbacks.captureClock();
    callbacks.team();
    callbacks.track();
    callbacks.garage?.();
    await callbacks.chat("hi");
    callbacks.onError(new Error("ROOM_FULL"));
    callbacks.kick({ playerId: "target", name: "Target" });
    callbacks.slot(3, true);
    callbacks.transfer({ playerId: "target", name: "Target" });
    callbacks.leave();
  }
  return { events, generation: host.generation, roomLoading: host.roomLoading,
    hasView: !!host.roomView };
}

test("room mount and bound commands match release", async () => {
  assert.deepEqual(await run(false, "success"), await run(true, "success"));
});

test("stale and failed room loads match release cleanup", async () => {
  assert.deepEqual(await run(false, "stale"), await run(true, "stale"));
  assert.deepEqual(await run(false, "failure"), await run(true, "failure"));
});
