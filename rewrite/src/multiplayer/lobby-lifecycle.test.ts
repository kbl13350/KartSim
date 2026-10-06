import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { bindLobbyClient, disposeLobby, handleRoomShortcut,
  maybeAutoReadyInRoom, quickJoinShortcut, renderLobby,
  type LobbyLifecycleHost, type RoomShortcutEvent } from "./lobby-lifecycle";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const method = (name: string, next: string): string => {
  const begin = source.indexOf(`  ${name}(`, classStart);
  const end = source.indexOf(`  ${next}(`, begin);
  assert.ok(begin > classStart && end > begin, `${name} boundaries`);
  return source.slice(begin, end);
};
const Original = new Function(`return class {
  ${method("quickJoinShortcut", "handleRoomShortcut")}
  ${method("handleRoomShortcut", "refreshAutoReady")}
  ${method("bindClient", "dispose")}
  ${method("dispose", "render")}
  ${method("render", "syncLoadingView")}
  ${method("maybeAutoReady", "receive")}
};`)() as new () => Record<string, (...args: never[]) => unknown>;
type MethodName = "quickJoinShortcut" | "handleRoomShortcut" | "bindClient" |
  "dispose" | "render" | "maybeAutoReady";
const release = (name: MethodName, host: LobbyLifecycleHost, ...args: unknown[]) =>
  (Original.prototype[name] as (...args: unknown[]) => unknown).call(host, ...args);

function room(): LobbyRoom {
  return { roomId: "room-1", revision: 1, name: "Room", phase: "open",
    speed: 7, hostId: "host", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 1, ready: false, team: null },
    ] };
}

function fixture() {
  const events: unknown[] = [];
  let messageListener: (message: unknown) => void = () => {};
  let closeListener: () => void = () => {};
  const client = {
    subscribe(listener: (message: unknown) => void) { messageListener = listener; events.push("subscribe"); return () => {}; },
    onClose(listener: () => void) { closeListener = listener; events.push("onClose"); return () => {}; },
    dispose: () => events.push("client.dispose"),
  };
  const host = {
    options: { status: (message: string, error?: boolean) =>
      events.push(["status", message, error]),
      autoReadyEnabled: () => true,
      toggleAutoReady: () => true },
    client,
    state: { room: undefined as LobbyRoom | undefined },
    lobby: { setEnabled: (value: boolean) => events.push(["enabled", value]),
      setInert: (value: boolean) => events.push(["inert", value]),
      dispose: () => events.push("lobby.dispose") },
    roomView: { update: (_room: LobbyRoom, busy: boolean, connected: boolean) =>
      events.push(["room.update", busy, connected]),
      activateReadyShortcut: () => events.push("readyShortcut"),
      dispose: () => events.push("room.dispose") },
    dialog: undefined as { setBusy(value: boolean): void; dispose(): void } | undefined,
    trackSelect: undefined, garage: undefined,
    loadingView: { dispose: () => events.push("loading.dispose") },
    startMission: { dispose: () => events.push("mission.dispose") },
    rpNotice: { dispose: () => events.push("rp.dispose") },
    startCoordinator: { reset: () => events.push("start.reset"),
      dispose: () => events.push("start.dispose") },
    accountAbort: new AbortController(), refresh: undefined,
    leaveConfirmation: { resolve: (value: boolean) => events.push(["leave.resolve", value]) },
    playerId: "me", connected: true, busy: false, leaving: false,
    modalLoading: false, raceVisible: false, hasModal: false, disposed: false,
    autoReadyConsumed: false, generation: 0, dialogGeneration: 0,
    receive: (message: unknown) => events.push(["receive", message]),
    render: () => events.push("render"),
    syncLoadingView: () => events.push("loading.sync"),
    cancelDialog: () => events.push("cancelDialog"),
    quickJoin: async () => { events.push("quickJoin"); },
  };
  return { host: host as unknown as LobbyLifecycleHost, events,
    message: (value: unknown) => messageListener(value), close: () => closeListener() };
}

test("room controls, render gates and auto-ready match release", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture();
    const call = (name: MethodName, ...args: unknown[]) => release(name, host, ...args);
    if (released) call("quickJoinShortcut"); else quickJoinShortcut(host);
    host.state.room = room();
    if (released) call("render"); else renderLobby(host);
    if (released) call("maybeAutoReady"); else maybeAutoReadyInRoom(host);
    const keyEvent = (code: string): RoomShortcutEvent => ({ code,
      preventDefault: () => { events.push("preventDefault"); },
      stopPropagation: () => { events.push("stopPropagation"); },
    });
    const f5 = released ? call("handleRoomShortcut", keyEvent("F5"))
      : handleRoomShortcut(host, keyEvent("F5"));
    const keyP = released ? call("handleRoomShortcut", keyEvent("KeyP"))
      : handleRoomShortcut(host, keyEvent("KeyP"));
    const ignored = released ? call("handleRoomShortcut", {
      ...keyEvent("F5"), target: { matches: () => true },
    }) : handleRoomShortcut(host, { ...keyEvent("F5"), target: { matches: () => true } });
    return { events, f5, keyP, ignored, consumed: host.autoReadyConsumed };
  };
  assert.deepEqual(run(false), run(true));
});

test("client subscription and close handling match release", () => {
  const run = (released: boolean) => {
    const { host, events, message, close } = fixture();
    if (released) release("bindClient", host); else bindLobbyClient(host);
    message({ type: "room" });
    close();
    close();
    return { events, connected: host.connected };
  };
  assert.deepEqual(run(false), run(true));
});

test("lobby disposal order and idempotence match release", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture();
    if (released) { release("dispose", host); release("dispose", host); }
    else { disposeLobby(host); disposeLobby(host); }
    return { events, disposed: host.disposed, generation: host.generation,
      dialogGeneration: host.dialogGeneration, aborted: host.accountAbort.signal.aborted,
      loadingView: host.loadingView, rpNotice: host.rpNotice };
  };
  assert.deepEqual(run(false), run(true));
});
