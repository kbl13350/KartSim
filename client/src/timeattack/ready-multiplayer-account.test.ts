import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { clearAccountSession, installAccountSession } from "../account/account-runtime";
import { accountService, item, summaryFixture, TEST_ORIGIN, TEST_TOKEN } from "../account/account-test-fixtures";
import { BrowserAccountSession } from "../account/browser-session";
import { defaultLocalProfile } from "../ui/local-profile";
import { openReadyMultiplayer, type ReadyMultiplayerController,
  type ReadyMultiplayerDependencies } from "./ready-multiplayer";

const now = Date.now();
const inventory = [
  item(3, 0, { systemKey: "practiceKart", source: "starter" }), item(1, 2, { source: "starter" }),
  item(2, 4, { source: "starter" }), item(70, 4, { source: "starter" }),
  item(8, 9, { expiresAt: now - 1_000 }), // goggle rental, already expired
];

function equippedProfile() {
  const base = defaultLocalProfile();
  return { ...base, equipment: { ...base.equipment, systemKart: "practiceKart",
    itemIds: { ...base.equipment.itemIds, 3: 0, 1: 2, 2: 4, 70: 4, 8: 9 } } };
}

async function openLobby(repairs: string[]) {
  let options!: Record<string, any>;
  const events: unknown[] = [];
  const profile = equippedProfile();
  const controller = {
    host: {
      root: {}, toonStageBinding: {}, hud: { showDebugText() {} },
      shell: { current: "Ready", enterMultiplayerLobby: () => true,
        restoreGarageFromMultiplayerLobby() {}, leaveMultiplayerLobby() {} },
      getLibrary: () => ({ timeAttackGarageCatalog: async () => ({}) }),
      getReadyOptions: () => ({}), setReadyOptions() {},
      getGameOptions: () => ({ autoReady: false, mainMenuBgmPath: "" }), setGameOptions() {},
      saveGameOptions() {}, getSelection: () => ({ trackId: "t" }), setSelection() {},
      setVehicleTitle() {}, getProfile: () => profile, setProfile() {}, saveProfile() {},
      getBgm: () => undefined, getAudioContext: () => undefined, getInterfaceAudio: () => undefined,
    },
    disposed: false,
    activeTaskbar: { setVisible: (visible: boolean) => events.push(["taskbar", visible]) },
    activeShop: { close: () => events.push("shop.close") },
    closeMultiplayer() {}, multiplayerGarageOptions: async () => ({}), applyMultiplayerGarage() {},
    changeFavoriteTrack() {}, changeFavoriteItems() {}, showGarageError() {},
    enterTimeAttackReady: async () => undefined,
  } as unknown as ReadyMultiplayerController;
  const deps: ReadyMultiplayerDependencies = {
    sanitizeReadyOptions: value => value, nickname: () => "", version: id => id,
    initialEquipment: value => value.equipment, favoriteTrackIds: () => [],
    createNotice: () => ({ show() {} }),
    createLobby: value => {
      options = value;
      return { open: async () => undefined, dispose() {}, leaveRoom: async () => true,
        networkDiagnostics: () => [] };
    },
    repairEquipment: async () => { repairs.push("repair"); },
  };
  await openReadyMultiplayer(controller, deps);
  return { options, controller, events };
}

test("rooms are sent owned equipment only; an expired rental is replaced before create/join", async () => {
  const service = accountService(summaryFixture({ onboarded: true }), inventory, now);
  const session = new BrowserAccountSession({ backendOrigin: TEST_ORIGIN, token: TEST_TOKEN,
    fetch: service.fetch });
  await session.refresh();
  installAccountSession(session);
  try {
    const repairs: string[] = [];
    const { options } = await openLobby(repairs);
    assert.equal(options.initialEquipment.itemIds[8], 0, "hello carries no expired goggle");
    assert.equal(options.currentEquipment().itemIds[8], 0, "create/join carry no expired goggle");
    assert.equal(options.currentEquipment().itemIds[1], 2);

    // ITEM_NOT_OWNED: repair, then resend with owned gear.
    const join = await options.repairEquipment({ type: "join", roomId: "r", password: "x" });
    assert.deepEqual(repairs, ["repair"]);
    assert.equal(join.password, "x");
    assert.equal(join.equipment.itemIds[8], 0);
    const chosen = { type: "equipment", roomId: "r", revision: 1,
      equipment: { ...equippedProfile().equipment, itemIds: { ...equippedProfile().equipment.itemIds, 1: 2 } } };
    const equipment = await options.repairEquipment(chosen);
    assert.equal(equipment.equipment.itemIds[8], 0);
    assert.equal(await options.repairEquipment({ type: "ready", roomId: "r", ready: true }), undefined);
    assert.equal(repairs.length, 3, "ready still repairs the profile");
  } finally {
    clearAccountSession();
  }
});

test("without an account the equipment is sent unchanged (release behavior)", async () => {
  clearAccountSession();
  const { options } = await openLobby([]);
  assert.equal(options.initialEquipment.itemIds[8], 9);
  assert.equal(options.currentEquipment().itemIds[8], 9);
});

test("a multiplayer race becoming visible closes the shop", async () => {
  clearAccountSession();
  const { options, controller, events } = await openLobby([]);
  options.onRaceVisibility(true);
  assert.deepEqual(events, ["shop.close", ["taskbar", false]]);
  assert.equal((controller as { activeShop?: unknown }).activeShop, undefined);
  options.onRaceVisibility(false);
  assert.deepEqual(events.at(-1), ["taskbar", true]);
});

test("the generated lobby sanitizes room-garage equipment and repairs refused gear", () => {
  const generated = readFileSync(new URL("../generated/multiplayer.js", import.meta.url), "utf8");
  assert.match(generated,
    /normalizeEquipment: \(profile, choice\) => accountOwnedEquipment\(zw\(\{ \.\.\.profile, equipment: choice\.equipment \}\)\)/);
  const services = generated.slice(generated.indexOf("const readyControllerServices"),
    generated.indexOf("const multiplayerLobbyServices"));
  assert.match(services, /repairEquipment: \(\) => repairEquipmentForMultiplayer\(\)/);
});
