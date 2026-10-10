import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { cancelLobbyDialog, castLobbyKickVote, confirmLeaveLobbyRoom,
  lobbyDialogOptions, openLobbyDialog, syncKickVoteDialog,
  type ConfirmDialogFactory, type LobbyDialogHost } from "./lobby-dialogs";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const method = (startText: string, nextText: string) => {
  const start = source.indexOf(`  ${startText}(`, classStart);
  const end = source.indexOf(`  ${nextText}(`, start);
  assert.ok(start > classStart && end > start, startText);
  return source.slice(start, end);
};
const eventsForConfirm: unknown[] = [];
let acceptImmediately = false;
const confirm: ConfirmDialogFactory = (options, title, message, accept, labels) => {
  eventsForConfirm.push(["confirm", title, message, labels, typeof options.cancel]);
  if (acceptImmediately) accept();
  return { dispose: () => eventsForConfirm.push("confirm.dispose") };
};
const Original = new Function("b1", "C1", `return class {
  ${method("cancelDialog", "async confirmLeaveRoom")}
  ${method("async confirmLeaveRoom", "async openDialog")}
  ${method("async openDialog", "dialogOptions")}
  ${method("dialogOptions", "syncKickVoteDialog")}
  ${method("syncKickVoteDialog", "castKickVote")}
  ${method("castKickVote", "async sendChat")}
};`)({ confirm }, (error: unknown) => error instanceof Error ? error.message : String(error)) as
  new () => Record<string, (...args: never[]) => unknown>;
type Name = "cancelDialog" | "confirmLeaveRoom" | "openDialog" |
  "dialogOptions" | "syncKickVoteDialog" | "castKickVote";
const release = (name: Name, host: LobbyDialogHost, ...args: unknown[]) =>
  (Original.prototype[name] as (...args: unknown[]) => unknown).call(host, ...args);

function room(): LobbyRoom {
  return { roomId: "room-1", revision: 4, name: "Room", phase: "open",
    speed: 7, hostId: "host", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null },
      { playerId: "target", name: "Target", slot: 1, ready: false, team: null },
    ], kickVote: { voteId: "vote-1", targetId: "target", eligibleIds: ["me"],
      yesIds: [], noIds: [] } };
}

function fixture(released: boolean) {
  const events: unknown[] = [];
  const host = {
    options: { status: (message: string, error?: boolean) =>
      events.push(["status", message, error]) },
    state: { room: room() },
    client: { request: async () => ({}), dispose: () => {} },
    playerId: "me", connected: true, disposed: false, busy: false,
    raceVisible: false, modalLoading: false, garageLoading: false,
    dialogGeneration: 0, changingModal: undefined,
    roomSettingsRoomId: undefined, voteDialogId: undefined,
    leaveConfirmation: undefined, dialog: undefined,
    trackSelect: undefined, garage: undefined, roomView: undefined,
    render: () => { events.push(["render", host.modalLoading]); },
    syncKickVoteDialog: () => { events.push("syncVote"); },
    cancelDialog: (_releaseAllowed?: boolean) => {},
    endChangingModal: (_modal: unknown, _releaseAllowed?: boolean) =>
      events.push("endChanging"),
    openDialog: async (_factory: () => unknown, _allowDisconnected?: boolean) => {},
    dialogOptions: () => ({}),
    castKickVote: (_approve: boolean) => {},
    mutate: async (message: Record<string, unknown>) => {
      events.push(["mutate", message]); return true;
    },
    receive: (_message: unknown) => {},
  } as unknown as LobbyDialogHost;
  host.cancelDialog = (value = true) => {
    if (released) release("cancelDialog", host, value);
    else cancelLobbyDialog(host, value);
  };
  host.openDialog = async (factory, allowDisconnected = false) => {
    if (released) await release("openDialog", host, factory, allowDisconnected);
    else await openLobbyDialog(host, factory, allowDisconnected);
  };
  host.dialogOptions = () => released
    ? release("dialogOptions", host) as Record<string, unknown>
    : lobbyDialogOptions(host);
  host.syncKickVoteDialog = () => {
    events.push("syncVote");
  };
  host.castKickVote = approve => {
    if (released) release("castKickVote", host, approve);
    else castLobbyKickVote(host, approve);
  };
  return { host, events };
}

test("dialog loading and stale-generation cleanup match release", async () => {
  const run = async (released: boolean) => {
    const { host, events } = fixture(released);
    await host.openDialog(() => ({ dispose: () => events.push("view.dispose") }));
    host.cancelDialog();
    host.changingModal = { kind: "garage", roomId: "room-1", generation: 1,
      entered: true, released: false, releaseAllowed: true };
    host.garageLoading = true;
    host.cancelDialog(false);
    await host.openDialog(() => { host.dialogGeneration++;
      return { dispose: () => events.push("stale.dispose") }; });
    return { events, generation: host.dialogGeneration,
      modalLoading: host.modalLoading, garageLoading: host.garageLoading,
      dialog: host.dialog };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("leave confirmation acceptance and kick vote command match release", async () => {
  const run = async (released: boolean) => {
    eventsForConfirm.length = 0;
    const { host, events } = fixture(released);
    acceptImmediately = true;
    const accepted = released
      ? await release("confirmLeaveRoom", host, "room-1")
      : await confirmLeaveLobbyRoom(host, "room-1", confirm);
    acceptImmediately = false;
    host.syncKickVoteDialog = () => {
      if (released) release("syncKickVoteDialog", host);
      else syncKickVoteDialog(host, confirm);
    };
    host.syncKickVoteDialog();
    host.castKickVote(true);
    return { accepted, events: [...events], confirm: [...eventsForConfirm],
      voteDialogId: host.voteDialogId };
  };
  assert.deepEqual(await run(false), await run(true));
});
