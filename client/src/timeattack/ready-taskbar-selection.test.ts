import assert from "node:assert/strict";
import test from "node:test";

import { enterTimeAttackReady, readyStageContext, type ReadySelection } from "./ready-flow";
import { openReadyGarageX, type ReadyGarageController } from "./ready-garage";

/**
 * The taskbar is created once (activeTaskbar ??=); its 车库 button must open
 * GarageX on the equipment Ready shows now, not the first Ready build's
 * (onboarding picks 黑妞, a bought kart replaces the practice kart).
 */
test("taskbar 车库 opens GarageX with the current selection, not the first Ready build's", async () => {
  let selection: ReadySelection = {
    mapPath: "m", trackId: "t", vehiclePath: "practice", vehicleItemId: 0,
    vehicleSystemKey: "practiceKart", characterPath: "c2", characterItemId: 2,
  };
  const garageXCalls: ReadySelection[] = [];
  let taskbarOptions: Record<string, any> | undefined;
  let taskbarLoads = 0;
  const view = { show() {}, freeze() {}, unfreeze() {}, dispose() {} };
  const library = {
    timeAttackGarageCatalog: async () => ({
      karts: [{ itemId: 0, systemKey: "practiceKart", path: "practice" }, { itemId: 5, path: "k5" }],
      characters: [{ itemId: 2, path: "c2" }, { itemId: 3, path: "c3" }],
    }),
    timeAttackTrackCatalog: async () => [], timeAttackRandomTrackGroups: async () => [],
    timeAttackRandomTrackNames: async () => new Map(),
  };
  const env = { dispose() {} };
  const controller: any = {
    host: {
      root: {}, toonStageBinding: {},
      hud: { beginLoading() {}, finishLoading() {}, showDebugText() {} },
      shell: { isReadyStageOpening: false, started: false, current: "Ready",
        beginReadyStage() {}, endReadyStage() {}, openModal: () => true, closeModal() {} },
      getSelection: () => selection, setSelection: (next: ReadySelection) => { selection = next; },
      getReadyOptions: () => ({ speed: 7 }), setReadyOptions() {}, getLibrary: () => library,
      getBgm: () => ({ playReady() {} }), getProfile: () => ({}), setProfile() {}, saveProfile() {},
      getRecordFor() {}, getAudioContext: () => undefined, getInterfaceAudio: () => undefined,
      releaseRaceForReady() {},
    },
    disposed: false, randomTrackSession: {},
    readyToonEnvironment: env,
    readyStageContext() { return readyStageContext(controller); },
    acquireReadyToonEnvironment: async () => env,
    openGarageX: (current: ReadySelection) => { garageXCalls.push(current); },
    readyModalBusy: () => false,
  };
  const deps = {
    findKart: (karts: any[], itemId: number) => karts.find(kart => kart.itemId === itemId),
    loadTaskbar: async (options: Record<string, unknown>) => {
      taskbarLoads++;
      taskbarOptions = options;
      return { setVisible() {} };
    },
    loadReadyView: async () => view,
  };
  await enterTimeAttackReady(controller, {}, deps);
  // Onboarding picks 黑妞 (3); later the player equips the bought kart 5.
  selection = { ...selection, characterPath: "c3", characterItemId: 3 };
  await enterTimeAttackReady(controller, {}, deps);
  selection = { ...selection, vehiclePath: "k5", vehicleItemId: 5, vehicleSystemKey: undefined };
  await enterTimeAttackReady(controller, {}, deps);
  assert.equal(taskbarLoads, 1, "the taskbar is still built once");

  taskbarOptions!.onGarage();
  assert.equal(garageXCalls.length, 1);
  assert.equal(garageXCalls[0]!.characterItemId, 3);
  assert.equal(garageXCalls[0]!.vehicleItemId, 5);
  assert.equal(garageXCalls[0]!.vehicleSystemKey, undefined);
});

test("GarageX opens on the host's current selection even when called with an older one", async () => {
  const current: ReadySelection = { trackId: "t", vehiclePath: "k5", vehicleItemId: 5,
    characterPath: "c3", characterItemId: 3 };
  const stale: ReadySelection = { trackId: "t", vehiclePath: "practice", vehicleItemId: 0,
    vehicleSystemKey: "practiceKart", characterPath: "c2", characterItemId: 2 };
  let loaded: Record<string, any> | undefined;
  const shell = { current: "Ready", modal: undefined as string | undefined,
    openModal: (name: string) => { shell.modal = name; return true; },
    closeModal: () => { shell.modal = undefined; } };
  const controller = {
    host: {
      root: {}, toonStageBinding: {}, hud: { showDebugText() {} }, shell,
      getLibrary: () => ({ timeAttackGarageCatalog: async () => ({ karts: [], characters: [] }) }),
      getSelection: () => current, setSelection() {},
      getReadyOptions: () => ({ speed: 7 }), setReadyOptions() {},
      getVehicleTitle: () => "", setVehicleTitle() {},
      getProfile: () => ({}), setProfile() {}, saveProfile() {},
      enterTimeAttackReady: async () => undefined, selectReadyGarage() {},
      getInterfaceAudio: () => undefined, getAudioContext: () => undefined,
      getBgm: () => undefined,
    },
    disposed: false, settingsOpening: false,
    readyToonEnvironment: { dispose() {} },
    readyModalBusy: () => false, closeMultiplayer() {},
    enterTimeAttackReady: async () => undefined, showGarageError(error: unknown) { throw error; },
    changeFavoriteItems() {}, applyImmediateGarageSelection() {},
  } as unknown as ReadyGarageController;
  await openReadyGarageX(controller, stale, { speed: 7 }, {
    loadGarage: async () => { throw new Error("unused"); },
    loadGarageX: async options => { loaded = options; return { show() {}, dispose() {} }; },
    createNotice: () => ({ show() {} }), speed: () => 7, defaultVersion: "国服",
  });
  assert.equal(loaded?.selectedKartItemId, 5);
  assert.equal(loaded?.selectedCharacterItemId, 3);
});
