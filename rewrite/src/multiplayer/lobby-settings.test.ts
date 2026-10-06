import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { changeLobbyRoomInfo, confirmLobbyAction, createLobbyRoom,
  type CreateRoomForm, type LobbySettingsHost, type RoomSettings } from "./lobby-settings";
import type { Gameplay, LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const extract = (startText: string, nextText: string) => {
  const start = source.indexOf(`  ${startText}(`, classStart);
  const end = source.indexOf(`  ${nextText}(`, start);
  assert.ok(start > classStart && end > start, startText);
  return source.slice(start, end);
};
const channels = { speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 } };

function room(): LobbyRoom {
  return { roomId: "room-1", revision: 2, name: "Room", phase: "open",
    speed: 7, hostId: "me", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null },
    ] };
}

function fixture(gameplay: Gameplay, settingsName = "Changed") {
  const events: unknown[] = [];
  const settings: RoomSettings = { type: "room-settings", roomId: "room-1",
    name: "Original", password: "" };
  const b1 = {
    roomSettings: async (_options: unknown, mode: string, _settings: RoomSettings,
      submit: (value: { name: string; password: string }) => void) => {
      events.push(["roomSettings", mode]);
      submit({ name: settingsName, password: "" });
      return { dispose: () => { events.push("settings.dispose"); } };
    },
    createGameplay: (_options: unknown, mode: Gameplay, channel: string,
      nickname: string, submit: (value: CreateRoomForm) => void) => {
      events.push(["createGameplay", mode, channel, nickname]);
      submit({ channelName: "speedTeamCombine", gameplay: mode, name: "New" });
    },
    createOrdinary: (_options: unknown, channel: string, nickname: string,
      submit: (value: CreateRoomForm) => void) => {
      events.push(["createOrdinary", channel, nickname]);
      submit({ channelName: "speedTeamCombine", name: "New" });
    },
    confirm: (_options: unknown, title: string, message: string, accept: () => void) => {
      events.push(["confirm", title, message]); accept();
    },
  };
  const host = {
    options: { nickname: "Suggestion", status: (message: string, error?: boolean) =>
      events.push(["status", message, error]) },
    state: { room: room() },
    client: { request: async (request: Record<string, unknown>) => {
      events.push(["request", request]); return settings;
    } },
    gameplay, channelName: "speedIndiCombine", accountNickname: "Account",
    playerId: "me", disposed: false, connected: true, busy: false, hasModal: false,
    modalLoading: false, dialogGeneration: 0, roomSettingsRoomId: undefined,
    dialog: undefined,
    render: () => events.push(["render", host.modalLoading]),
    syncKickVoteDialog: () => events.push("syncVote"),
    cancelDialog: () => { events.push("cancelDialog"); ++host.dialogGeneration; },
    dialogOptions: () => "options",
    openDialog: async (factory: () => unknown) => { factory(); },
    mutate: async (message: Record<string, unknown>) => { events.push(["mutate", message]); return true; },
    submitRoomSettings: async (update: Record<string, unknown>, generation: number) => {
      events.push(["submit", update, generation]);
    },
  } as unknown as LobbySettingsHost;
  const Original = new Function("b1", "rg", "He", "C1",
    `return class {
      ${extract("async changeRoomInfo", "async submitRoomSettings")}
      ${extract("async create", "async join")}
      ${source.slice(source.indexOf("  async confirm(", classStart),
        source.indexOf("\n}\nfunction C1", source.indexOf("  async confirm(", classStart)))}
    };`)(b1, (mode: Gameplay) => mode !== "lte" && mode in {
      ordinary: 1, grip: 1, shadow: 1, roadblock: 1, giant: 1, rp: 1,
    }, channels, (error: unknown) => error instanceof Error ? error.message : String(error)) as
    new () => { changeRoomInfo(this: LobbySettingsHost): Promise<void>;
      create(this: LobbySettingsHost): Promise<void>;
      confirm(this: LobbySettingsHost, title: string, message: string,
        action: () => void): Promise<void> };
  return { host, events, b1, Original };
}

test("room settings fetch, edits and unchanged close match release", async () => {
  for (const name of ["Changed", "Original"]) {
    const run = async (released: boolean) => {
      const { host, events, b1, Original } = fixture("ordinary", name);
      if (released) await Original.prototype.changeRoomInfo.call(host);
      else await changeLobbyRoomInfo(host, b1.roomSettings);
      return { events, modalLoading: host.modalLoading,
        roomSettingsRoomId: host.roomSettingsRoomId, generation: host.dialogGeneration,
        hasDialog: !!host.dialog };
    };
    assert.deepEqual(await run(false), await run(true), name);
  }
});

test("ordinary and gameplay room creation match release payloads", async () => {
  for (const gameplay of ["ordinary", "grip", "lte"] as const) {
    const run = async (released: boolean) => {
      const { host, events, b1, Original } = fixture(gameplay);
      host.state.room = undefined;
      if (released) await Original.prototype.create.call(host);
      else await createLobbyRoom(host, channels,
        (options, mode, channel, nickname, submit) => mode === "ordinary"
          ? b1.createOrdinary(options, channel, nickname!, submit)
          : b1.createGameplay(options, mode, channel, nickname!, submit));
      return { events, channelName: host.channelName };
    };
    assert.deepEqual(await run(false), await run(true), gameplay);
  }
});

test("confirmation closes modal before running command", async () => {
  const run = async (released: boolean) => {
    const { host, events, b1, Original } = fixture("ordinary");
    const action = () => { events.push("action"); };
    if (released) await Original.prototype.confirm.call(host, "Title", "Message", action);
    else await confirmLobbyAction(host, "Title", "Message", action, b1.confirm);
    return events;
  };
  assert.deepEqual(await run(false), await run(true));
});
