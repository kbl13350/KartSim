import assert from "node:assert/strict";
import test from "node:test";

import type { ItemInventoryCatalog } from "../ui/item-inventory";
import { itemInventoryEntries } from "../ui/item-inventory";
import { defaultLocalProfile, type LocalProfile } from "../ui/local-profile";
import { equipReadyInventoryItem } from "./ready-inventory";
import type { ReadyGarageController } from "./ready-garage";
import type { ReadySelection } from "./ready-flow";

const catalog: ItemInventoryCatalog = {
  karts: [
    { kind: "kart", itemId: 387, title: "标准赛车", internalId: "kart_a",
      path: "kart_/kart_a/model.1s", identityClass: "catalog-vehicle" },
    { kind: "kart", itemId: 0, title: "系统赛车", internalId: "sys_a",
      path: "kart_/sys_a/model.1s", systemKey: "sys-a",
      identityClass: "system-vehicle" },
  ],
  characters: [
    { kind: "character", itemId: 2, title: "皮蛋", internalId: "dao",
      path: "character_dao.rho/model.1s", identityClass: "catalog-character" },
    { kind: "character", itemId: 3, title: "黑妞", internalId: "dizi",
      path: "character_dizi.rho/model.1s", identityClass: "catalog-character" },
  ],
  equipment: [{ kind: "headBand", category: 11, itemId: 22,
    title: "头饰", internalId: "head_a" },
    { kind: "color", category: 2, itemId: 7,
      title: "喷漆", internalId: "paint_a" }],
};

function fixture(reloadFails = false, saveFails = false) {
  const events: unknown[] = [];
  let selection: ReadySelection = {
    mapPath: "track.rho", trackId: "track", vehiclePath: "kart_/kart_a/model.1s",
    vehicleItemId: 387, characterPath: "character_dao.rho/model.1s",
    characterItemId: 2,
  };
  let options = { speed: 2 };
  let title = "标准赛车";
  let profile: LocalProfile = {
    ...defaultLocalProfile(),
    equipment: { itemIds: { 1: 2, 3: 387, 11: 0 }, kartSerial: 9,
      valueAt3E: 0, exceedType: 4 }, initial: "", favoriteTracks: [], favoriteItems: [],
  };
  const host = {
    getSelection: () => selection,
    setSelection: (value: ReadySelection) => { selection = value; events.push("selection"); },
    getReadyOptions: () => options,
    setReadyOptions: (value: typeof options) => { options = value; events.push("options"); },
    getVehicleTitle: () => title,
    setVehicleTitle: (value: string) => { title = value; events.push("title"); },
    getProfile: () => profile,
    setProfile: (value: LocalProfile) => { profile = value; events.push("profile"); },
    saveProfile: () => {
      events.push("save");
      if (saveFails) throw new Error("storage unavailable");
    },
    hud: { showDebugText: (message: string, level: string) =>
      events.push(["notice", message, level]) },
    enterTimeAttackReady: async (value: LocalProfile) => {
      events.push(["reload", value.equipment.itemIds[3], value.equipment.itemIds[11]]);
      if (reloadFails) throw new Error("reload failed");
    },
  };
  const controller = { host } as unknown as ReadyGarageController;
  return { controller, host, events };
}

test("warehouse kart and accessory equipment pass through Ready reload and profile save", async () => {
  const f = fixture();
  const items = itemInventoryEntries(catalog);
  const system = items.find(item => item.systemKey === "sys-a")!;
  const afterKart = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), system, catalog);
  assert.equal(afterKart.equipment.itemIds[3], 0);
  assert.equal(afterKart.equipment.systemKart, "sys-a");
  assert.equal(afterKart.equipment.kartSerial, 0);
  assert.equal(afterKart.equipment.exceedType, 0);
  assert.equal(f.host.getSelection().vehiclePath, system.path);
  assert.equal(f.host.getVehicleTitle(), "系统赛车");
  assert.deepEqual(f.events.slice(-3), [["reload", 0, 0], "profile", "save"]);

  const headband = items.find(item => item.kind === "headBand")!;
  const afterAccessory = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), headband, catalog);
  assert.equal(afterAccessory.equipment.itemIds[11], 22);
  assert.equal(afterAccessory.equipment.systemKart, "sys-a");
  assert.equal(f.host.getSelection().vehiclePath, system.path);
  assert.deepEqual(f.events.slice(-3), [["reload", 0, 22], "profile", "save"]);
});

test("warehouse equipment rejects absent catalog identity and rolls back a failed Ready reload", async () => {
  const f = fixture(true);
  const previousSelection = f.host.getSelection();
  const previousOptions = f.host.getReadyOptions();
  const previousProfile = f.host.getProfile();
  const character = itemInventoryEntries(catalog).find(item => item.itemId === 3)!;
  await assert.rejects(equipReadyInventoryItem(f.controller,
    previousSelection, previousOptions, character, catalog), /reload failed/);
  assert.deepEqual(f.host.getSelection(), previousSelection);
  assert.deepEqual(f.host.getReadyOptions(), previousOptions);
  assert.equal(f.host.getProfile(), previousProfile);
  assert.equal(f.events.includes("save"), false);
  await assert.rejects(equipReadyInventoryItem(f.controller,
    previousSelection, previousOptions, { ...character, internalId: "forged" }, catalog),
    /不在当前本地目录/);
});

test("kart selection reads target garage progress and preserves an equipped system variant", async () => {
  const f = fixture();
  const upgradedCatalog: ItemInventoryCatalog = {
    ...catalog,
    karts: [...catalog.karts, { kind: "kart", itemId: 400, title: "升级赛车",
      internalId: "kart_b", path: "kart_/kart_b/model.1s",
      identityClass: "catalog-vehicle" },
      { kind: "kart", itemId: 0, title: "旧版练习车",
        internalId: "practice3", path: "kart_/practice3/model.1s",
        systemKey: "legacyPractice", identityClass: "legacy-system-family" }],
  };
  f.host.setProfile({ ...f.host.getProfile(),
    garage: { version: 1, builds: { "400:0": { exceedType: 7 } } } });
  const target = itemInventoryEntries(upgradedCatalog).find(item => item.itemId === 400)!;
  const upgraded = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), target, upgradedCatalog);
  assert.equal(upgraded.equipment.kartSerial, 0);
  assert.equal(upgraded.equipment.exceedType, 7);

  const system = itemInventoryEntries(upgradedCatalog).find(item =>
    item.systemKey === "legacyPractice")!;
  const withSystem = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), system, upgradedCatalog);
  const variant = { ...withSystem, equipment: { ...withSystem.equipment,
    systemKartVariant: "practice0", kartSerial: 4, exceedType: 2 } };
  f.host.setProfile(variant);
  f.host.setSelection({ ...f.host.getSelection(), vehiclePath: "kart_/practice0/model.1s" });
  const sameSystem = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), system, upgradedCatalog);
  assert.equal(sameSystem.equipment.systemKartVariant, "practice0");
  assert.equal(sameSystem.equipment.kartSerial, 4);
  assert.equal(sameSystem.equipment.exceedType, 2);
  assert.equal(f.host.getSelection().vehiclePath, "kart_/practice0/model.1s");
});

test("a profile save failure keeps the applied equipment and reports it as unsaved", async () => {
  const f = fixture(false, true);
  const headband = itemInventoryEntries(catalog).find(item => item.kind === "headBand")!;
  const changed = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), headband, catalog);
  assert.equal(changed.equipment.itemIds[11], 22);
  assert.equal(f.host.getProfile(), changed);
  assert.deepEqual(f.events.slice(-4), [
    ["reload", 387, 22], "profile", "save",
    ["notice", "本次装备已应用，但未保存：storage unavailable", "error"],
  ]);
});

test("an equipped accessory can be removed through Ready reload and save, while paint cannot", async () => {
  const f = fixture();
  const items = itemInventoryEntries(catalog);
  const headband = items.find(item => item.kind === "headBand")!;
  await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), headband, catalog);
  const removed = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), headband, catalog, "unequip");
  assert.equal(removed.equipment.itemIds[11], 0);
  assert.equal(f.host.getProfile(), removed);
  assert.deepEqual(f.events.slice(-3), [["reload", 387, 0], "profile", "save"]);
  await assert.rejects(equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), headband, catalog, "unequip"),
    /不能卸下/);

  const paint = items.find(item => item.kind === "color")!;
  f.host.setProfile({ ...f.host.getProfile(), equipment: {
    ...f.host.getProfile().equipment, itemIds: {
      ...f.host.getProfile().equipment.itemIds, 2: paint.itemId,
    },
  } });
  await assert.rejects(equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), paint, catalog, "unequip"),
    /不能卸下/);
});

test("original auxiliary equipment slots persist through Ready, including bonus and item skin cards", async () => {
  const auxiliary = [
    ["headPhone", 12], ["uniform", 18], ["decal", 20],
    ["pet", 21], ["ridColor", 31], ["slotBg", 71],
    ["rpLucciBonus", 32], ["goItemSkinCard", 58], ["tachometer", 61],
  ] as const;
  const expanded: ItemInventoryCatalog = {
    ...catalog,
    equipment: [...catalog.equipment,
      ...auxiliary.map(([kind, category]) => ({
        kind, category, itemId: category + 100, title: kind, internalId: kind,
      }))],
  };
  for (const [kind, category] of auxiliary) {
    const f = fixture();
    const item = itemInventoryEntries(expanded).find(entry => entry.kind === kind)!;
    const result = await equipReadyInventoryItem(f.controller,
      f.host.getSelection(), f.host.getReadyOptions(), item, expanded);
    assert.equal(result.equipment.itemIds[category], category + 100);
    assert.equal(f.host.getProfile(), result);
    assert.equal(f.events.at(-1), "save");
  }
  const f = fixture();
  const bonus = itemInventoryEntries(expanded).find(item => item.kind === "rpLucciBonus")!;
  await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), bonus, expanded);
  const removed = await equipReadyInventoryItem(f.controller,
    f.host.getSelection(), f.host.getReadyOptions(), bonus, expanded, "unequip");
  assert.equal(removed.equipment.itemIds[32], 0);
  assert.equal(f.events.at(-1), "save");
});
