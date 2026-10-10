import assert from "node:assert/strict";
import test from "node:test";

import { clearAccountSession, installAccountSession } from "../account/account-runtime";
import { accountService, item, TEST_ORIGIN, TEST_TOKEN } from "../account/account-test-fixtures";
import { BrowserAccountSession } from "../account/browser-session";
import { garageViewCatalog } from "../account/garage-ownership";
import { openReadyGarage, type ReadyGarageController, type ReadyGarageDependencies } from "./ready-garage";
import { readyMultiplayerGarageOptions, type ReadyMultiplayerController } from "./ready-multiplayer";

const catalog = {
  karts: [{ itemId: 1200, title: "未拥有", path: "kart_/x/model.1s" },
    { itemId: 387, title: "尖锋6.5", path: "kart_/saber10/model.1s" },
    { itemId: 0, systemKey: "practiceKart", title: "练习用卡丁车 V1", path: "kart_/practiceV1/model.1s" }],
  characters: [{ itemId: 2, title: "皮蛋", path: "character_/dao/model.1s" },
    { itemId: 3, title: "黑妞", path: "character_/dizni/model.1s" }],
  equipment: [{ kind: "color", category: 2, itemId: 6, title: "蓝" },
    { kind: "color", category: 2, itemId: 1, title: "红" }],
  legacyFamilies: [],
};

const selection = { trackId: "village_R01", mapPath: "m", vehiclePath: "kart_/practiceV1/model.1s",
  vehicleItemId: 0, vehicleSystemKey: "practiceKart", characterPath: "character_/dizni/model.1s",
  characterItemId: 3 };

async function signedIn() {
  const service = accountService(undefined, [
    item(3, 0, { systemKey: "practiceKart", source: "starter" }), item(1, 3, { source: "starter" }),
    item(2, 6, { source: "starter" }), item(3, 387, { expiresAt: Date.now() + 2 * 86_400_000 + 5_000 }),
  ], Date.now());
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
}

test("without an account the garage views keep the release catalog", () => {
  clearAccountSession();
  assert.equal(garageViewCatalog(catalog), catalog);
  assert.deepEqual(garageViewCatalog(["kart"]), ["kart"]);
});

test("Ready 选道具 opens the classic garage with owned items only", async () => {
  await signedIn();
  try {
    let options: Record<string, unknown> | undefined;
    const controller = {
      host: {
        root: {}, toonStageBinding: {}, hud: { showDebugText() {} },
        shell: { current: "Ready", openModal: () => true, closeModal() {} },
        getLibrary: () => ({ timeAttackGarageCatalog: async () => catalog }),
        getProfile: () => ({}),
        getInterfaceAudio: () => undefined, getAudioContext: () => undefined,
      },
      readyToonEnvironment: { dispose() {} },
      readyModalBusy: () => false,
      showGarageError: (error: unknown) => { throw error; },
      changeFavoriteItems() {},
    } as unknown as ReadyGarageController;
    const deps = {
      loadGarage: async (value: Record<string, unknown>) => {
        options = value;
        return { show() {}, dispose() {} };
      },
    } as unknown as ReadyGarageDependencies;
    await openReadyGarage(controller, selection, {}, deps);
    const shown = options!.catalog as typeof catalog;
    assert.deepEqual(shown.karts.map(kart => [kart.itemId,
      (kart as { ownershipLabel?: string }).ownershipLabel]), [[387, "剩余 2 天"], [0, undefined]]);
    assert.deepEqual(shown.characters.map(character => character.itemId), [3]);
    assert.deepEqual(shown.equipment.map(entry => entry.itemId), [6]);
  } finally {
    clearAccountSession();
  }
});

test("the multiplayer room garage lists owned items and keeps the current kart", async () => {
  await signedIn();
  try {
    const controller = {
      host: {
        root: {}, toonStageBinding: {},
        getLibrary: () => ({ timeAttackGarageCatalog: async () => catalog }),
        getSelection: () => ({ ...selection, vehicleItemId: 1200, vehiclePath: "kart_/x/model.1s",
          vehicleSystemKey: undefined }),
        getProfile: () => ({}),
        getInterfaceAudio: () => undefined, getAudioContext: () => undefined,
      },
      readyToonEnvironment: {},
      changeFavoriteItems() {},
    } as unknown as ReadyMultiplayerController;
    const options = await readyMultiplayerGarageOptions(controller, () => ({ show() {} }));
    const shown = options.catalog as typeof catalog;
    assert.deepEqual(shown.karts.map(kart => kart.itemId), [1200, 387, 0]);
  } finally {
    clearAccountSession();
  }
});
