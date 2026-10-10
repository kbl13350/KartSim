import assert from "node:assert/strict";
import test from "node:test";

import { clearAccountSession } from "../account/account-runtime";
import { enterTimeAttackReady, readyStageContext, type ReadySelection } from "./ready-flow";
import type { ReadyShopController } from "./ready-shop";
import { multiplayerRaceActive, openShopUnlessRacing, SHOP_BLOCKED_DURING_RACE,
  type GuardedShopController } from "./ready-shop-guard";

function shopController(multiplayer?: unknown) {
  const events: unknown[] = [];
  const controller = {
    host: {
      root: {} as HTMLElement,
      hud: { showDebugText: (message: string) => events.push(["debug", message]) },
      shell: { current: "MultiplayerLobby", closeModal() {} },
      getLibrary: () => ({}), getSelection: () => undefined, getReadyOptions: () => ({}),
    },
    disposed: false, multiplayer,
    activeHome: { showNotice: (message: string) => events.push(["notice", message]) },
    enterTimeAttackReady: async () => undefined, openGarageX() {},
  } as unknown as GuardedShopController;
  return { controller, events };
}

test("a room that is loading, counting down or racing counts as an active race", () => {
  assert.equal(multiplayerRaceActive(undefined), false);
  for (const phase of ["open", "finished"])
    assert.equal(multiplayerRaceActive({ state: { room: { phase } } }), false, phase);
  for (const phase of ["loading", "countdown", "racing"])
    assert.equal(multiplayerRaceActive({ state: { room: { phase } } }), true, phase);
  assert.equal(multiplayerRaceActive({ raceVisible: true, state: {} }), true);
  assert.equal(multiplayerRaceActive({ raceVisible: false, state: {} }), false);
});

test("the shop is refused with a notice while the room's race is starting or running", () => {
  for (const phase of ["loading", "countdown", "racing"]) {
    const { controller, events } = shopController({ state: { room: { phase } } });
    let opened = 0;
    openShopUnlessRacing(controller, async () => { opened++; });
    assert.equal(opened, 0, phase);
    assert.deepEqual(events.at(-1), ["notice", SHOP_BLOCKED_DURING_RACE]);
  }
  for (const lobby of [undefined, { state: { room: { phase: "open" } } }, { state: {} }]) {
    const { controller } = shopController(lobby);
    let opened = 0;
    openShopUnlessRacing(controller, async () => { opened++; });
    assert.equal(opened, 1);
  }
});

test("the taskbar 상점 button goes through the race guard", async () => {
  clearAccountSession();
  const selection: ReadySelection = { mapPath: "m", trackId: "t", vehiclePath: "k5",
    vehicleItemId: 5, characterPath: "c2", characterItemId: 2 };
  let taskbarOptions: Record<string, any> | undefined;
  const events: unknown[] = [];
  const env = { dispose() {} };
  const library = {
    timeAttackGarageCatalog: async () => ({ karts: [{ itemId: 5, path: "k5" }],
      characters: [{ itemId: 2, path: "c2" }] }),
    timeAttackTrackCatalog: async () => [], timeAttackRandomTrackGroups: async () => [],
    timeAttackRandomTrackNames: async () => new Map(),
  };
  const controller: any = {
    host: {
      root: {}, toonStageBinding: {},
      hud: { beginLoading() {}, finishLoading() {},
        showDebugText: (message: string) => events.push(["debug", message]) },
      shell: { isReadyStageOpening: false, started: false, current: "MultiplayerLobby",
        beginReadyStage() {}, endReadyStage() {}, openModal: () => true, closeModal() {} },
      getSelection: () => selection, setSelection() {}, getReadyOptions: () => ({}),
      setReadyOptions() {}, getLibrary: () => library, getBgm: () => ({ playReady() {} }),
      getProfile: () => ({}), setProfile() {}, saveProfile() {}, getRecordFor() {},
      getAudioContext: () => undefined, getInterfaceAudio: () => undefined,
      releaseRaceForReady() {},
    },
    disposed: false, randomTrackSession: {}, readyToonEnvironment: env,
    multiplayer: { raceVisible: false, state: { room: { phase: "countdown" } } },
    activeHome: { showNotice: (message: string) => events.push(["notice", message]) },
    readyStageContext() { return readyStageContext(controller); },
    acquireReadyToonEnvironment: async () => env,
    readyModalBusy: () => false,
  };
  await enterTimeAttackReady(controller, {}, {
    findKart: (karts: any[], itemId: number) => karts.find(kart => kart.itemId === itemId),
    loadTaskbar: async options => { taskbarOptions = options; return { setVisible() {} }; },
    loadReadyView: async () => ({ show() {}, freeze() {}, unfreeze() {}, dispose() {} }),
  });
  events.length = 0;
  taskbarOptions!.onShop();
  assert.deepEqual(events, [["debug", SHOP_BLOCKED_DURING_RACE], ["notice", SHOP_BLOCKED_DURING_RACE]]);
  // Back in the open room the button reaches the shop (here: no account signed in).
  controller.multiplayer.state.room.phase = "open";
  events.length = 0;
  taskbarOptions!.onShop();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events[0], ["notice", "商店需要登录账号。"]);
  assert.ok((controller as ReadyShopController).activeShop === undefined);
});
