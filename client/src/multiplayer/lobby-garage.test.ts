import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { chooseLobbyGarage, confirmLobbyGarage, type GarageChoice,
  type GarageViewOptions, type LobbyGarageHost } from "./lobby-garage";
import type { ChangingModal } from "./lobby-dialogs";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  async chooseGarage() {", classStart);
const middle = source.indexOf("  async confirmGarage(", start);
const end = source.indexOf("  async chooseTrack()", middle);
assert.ok(start > classStart && middle > start && end > middle);

function room(): LobbyRoom {
  return { roomId: "room-1", revision: 4, name: "Room", phase: "open",
    speed: 7, hostId: "me", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null },
    ] };
}

function fixture() {
  const events: unknown[] = [];
  let loadedOptions: GarageViewOptions | undefined;
  const view = { show: () => events.push("show"), dispose: () => events.push("dispose"),
    freeze: () => events.push("freeze"), unfreeze: () => events.push("unfreeze") };
  const host = {
    options: { garage: {
      options: async () => { events.push("options"); return { profile: { equipment: "old" },
        onCancel: () => {}, onConfirm: (_choice: GarageChoice) => {} }; },
      apply: (choice: GarageChoice) => events.push(["apply", choice]),
    }, status: (message: string, error?: boolean) => events.push(["status", message, error]) },
    state: { room: room() }, playerId: "me", roomView: { countdownLocked: false },
    connected: true, disposed: false, busy: false,
    modalLoading: false, garageLoading: false, dialogGeneration: 0,
    changingModal: undefined as ChangingModal | undefined,
    dialog: undefined, trackSelect: undefined, garage: undefined,
    render: () => events.push("render"),
    mutate: async (message: Record<string, unknown>) => { events.push(["mutate", message]); return true; },
    isChangingModalCurrent: (modal: ChangingModal) => host.changingModal === modal,
    cancelDialog: (allowed = true) => { events.push(["cancelDialog", allowed]);
      host.changingModal = undefined; },
    finishChangingLoad: (_modal: ChangingModal, loaded: boolean) => {
      events.push(["finish", loaded]); host.modalLoading = false; host.garageLoading = false;
    },
    confirmGarage: async (_choice: GarageChoice, _roomId: string, _modal: ChangingModal) => {},
  } as unknown as LobbyGarageHost;
  const load = async (options: GarageViewOptions) => {
    events.push("load"); loadedOptions = options; return view;
  };
  const normalize = (profile: { equipment: unknown }, choice: GarageChoice) =>
    `${profile.equipment}:${choice.equipment}`;
  const Original = new Function("El", "w80", "zw", "C1",
    `return class { ${source.slice(start, end)} };`)(
      async (factory: () => Promise<unknown>) => factory(),
      { TimeAttackGarageView: { load } },
      (profile: { equipment: unknown }) => profile.equipment === "new" ? "old:new" : "unexpected",
      (error: unknown) => error instanceof Error ? error.message : String(error),
    ) as new () => { chooseGarage(this: LobbyGarageHost): Promise<void>;
      confirmGarage(this: LobbyGarageHost, choice: GarageChoice, roomId: string,
        modal: ChangingModal): Promise<void> };
  return { host, events, view, load, normalize, Original,
    getOptions: () => loadedOptions };
}

test("garage opening and local command callbacks match release", async () => {
  const run = async (released: boolean) => {
    const { host, events, load, normalize, Original, getOptions } = fixture();
    if (released) await Original.prototype.chooseGarage.call(host);
    else await chooseLobbyGarage(host, load, normalize);
    const options = getOptions();
    assert.ok(options);
    options.onConfirm({ equipment: "new" });
    await new Promise(resolve => setImmediate(resolve));
    return { events, modalLoading: host.modalLoading, garageLoading: host.garageLoading,
      hasView: !!host.garage, changingKind: host.changingModal?.kind };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("accepted and rejected equipment updates match release", async () => {
  const run = async (released: boolean, accept: boolean) => {
    const { host, events, view, Original } = fixture();
    const modal: ChangingModal = { kind: "garage", roomId: "room-1", generation: 1,
      entered: true, released: false, releaseAllowed: true };
    host.changingModal = modal;
    host.garage = view;
    host.mutate = async message => { events.push(["mutate", message]); return accept; };
    const choice = { equipment: "new" };
    if (released) await Original.prototype.confirmGarage.call(host, choice, "room-1", modal);
    else await confirmLobbyGarage(host, choice, "room-1", modal);
    return { events, changing: host.changingModal };
  };
  assert.deepEqual(await run(false, true), await run(true, true));
  assert.deepEqual(await run(false, false), await run(true, false));
});
