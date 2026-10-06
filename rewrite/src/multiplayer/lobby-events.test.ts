import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { formatMultiplayerError } from "./errors";
import { receiveLobbyEvent, type LobbyEvent, type LobbyEventHost } from "./lobby-events";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  receive(e) {", classStart);
const end = source.indexOf("  async showRoom()", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const roomSpeed = (room: LobbyRoom) => ({ speed: room.speed, version: "国服" });
const Original = new Function("G2", "RI", "C1",
  `return class { ${source.slice(start, end)} };`)(
    (room: LobbyRoom) => room.gameplay ?? "ordinary", roomSpeed, formatMultiplayerError,
  ) as new () => { receive(this: LobbyEventHost, event: LobbyEvent): void };

const makeRoom = (revision: number, phase: LobbyRoom["phase"] = "open",
  changes: Partial<LobbyRoom> = {}): LobbyRoom => ({
    roomId: "room-1", revision, name: "Room", phase, hostId: "me", mode: "individual",
    speed: 7, trackId: "track-a", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null },
    ], ...changes,
  });

function fixture() {
  const events: unknown[] = [];
  const host = {
    state: { room: undefined as LobbyRoom | undefined,
      apply(event: LobbyEvent) {
        events.push(["apply", event.type]);
        if (event.type === "left") this.room = undefined;
        if (event.type === "room") this.room = event.room;
        return true;
      },
      appendChat(event: LobbyEvent) { events.push(["chat", event.message]); return true; },
    },
    client: { bindMotionScope: (room?: LobbyRoom) =>
      events.push(["scope", room?.roomId, room?.revision]) },
    options: { speed: (speed: number, version: string) =>
      events.push(["speed", speed, version]),
      status: (message: string, error?: boolean) =>
        events.push(["status", message, error]),
      onPageAudio: (page: string) => events.push(["audio", page]),
    },
    disposed: false, playerId: "me", connected: true,
    gameplay: "ordinary", autoReadyRoom: undefined as string | undefined,
    autoReadyConsumed: false, manualStartAfter: 0,
    startCoordinator: { reset: () => events.push("reset"),
      update: (room: LobbyRoom) => events.push(["update", room.revision]) },
    roomSettingsRoomId: undefined as string | undefined,
    dialog: undefined, leaveConfirmation: undefined,
    voteDialogId: undefined, garage: undefined, garageLoading: false,
    trackSelect: undefined, modalLoading: false, changingModal: undefined,
    roomView: undefined, roomLoading: false, generation: 0,
    channelName: "speedIndiCombine", page: 0,
    lobby: { show: () => events.push("lobby.show") },
    render: () => events.push("render"),
    cancelDialog: (closeChanging?: boolean) => events.push(["cancelDialog", closeChanging]),
    cancelCountdownModals: () => events.push("countdown"),
    maybeAutoReady: () => events.push("autoReady"),
    showRoom: async () => { events.push("showRoom"); },
    syncKickVoteDialog: () => events.push("kickVote"),
    list: async (channel: string, page: number) => events.push(["list", channel, page]),
  };
  return { host: host as unknown as LobbyEventHost, events };
}

test("chat, room updates, countdown and departure match release event order", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture();
    const receive = (event: LobbyEvent) => released
      ? Original.prototype.receive.call(host, event)
      : receiveLobbyEvent(host, event, roomSpeed);
    receive({ type: "chat", roomId: "room-1", message: { sequence: 1 } });
    receive({ type: "room", room: makeRoom(1) });
    receive({ type: "room", room: makeRoom(2, "open", { trackId: "track-b" }) });
    receive({ type: "room", room: makeRoom(3, "loading", {
      race: { raceId: "race-1", loadedIds: ["me"], returnedIds: ["me"] },
    }) });
    receive({ type: "room", room: makeRoom(4, "countdown") });
    receive({ type: "left", roomId: "room-1" });
    return { events, generation: host.generation, room: host.state.room,
      autoReadyRoom: host.autoReadyRoom, autoReadyConsumed: host.autoReadyConsumed,
      timerWasSet: host.manualStartAfter > 0 };
  };
  assert.deepEqual(run(false), run(true));
});

test("invalid room gameplay raises the same error", () => {
  const bad = { type: "room", room: makeRoom(1, "open", {
    gameplay: "invalid" as LobbyRoom["gameplay"],
  }) };
  const newer = fixture();
  const original = fixture();
  assert.throws(() => receiveLobbyEvent(newer.host, bad, roomSpeed),
    error => error instanceof Error && error.message === "未知的房间玩法");
  // The release helper G2 is tested here with its actual validity check.
  const validateGameplay = (room: LobbyRoom) => {
    const mode = room.gameplay ?? "ordinary";
    if (!["ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp"].includes(mode)) {
      throw new Error("未知的房间玩法");
    }
    return mode;
  };
  const OriginalValidating = new Function("G2", "RI", "C1",
    `return class { ${source.slice(start, end)} };`)(
      validateGameplay, roomSpeed, formatMultiplayerError,
    ) as typeof Original;
  assert.throws(() => OriginalValidating.prototype.receive.call(original.host, bad),
    error => error instanceof Error && error.message === "未知的房间玩法");
});
