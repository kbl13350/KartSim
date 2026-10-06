import assert from "node:assert/strict";
import test from "node:test";

import { defaultMyRoomProfile, type LocalProfile } from "./local-profile";
import {
  filterItemInventory, itemInventoryCanUnequip, itemInventoryEntries, itemInventoryIsEquipped,
  itemInventoryIsFavorite, toggleItemInventoryFavorite,
  type ItemInventoryCatalog,
} from "./item-inventory";

const catalog: ItemInventoryCatalog = {
  karts: [
    { kind: "kart", itemId: 387, title: "标准赛车", internalId: "kart_a",
      path: "kart_/kart_a/model.1s", identityClass: "catalog-vehicle" },
    { kind: "kart", itemId: 0, title: "系统赛车", internalId: "sys_a",
      path: "kart_/sys_a/model.1s", systemKey: "system-a",
      identityClass: "system-vehicle" },
    { kind: "kart", itemId: 0, title: "无身份赛车", internalId: "invalid",
      path: "kart_/invalid/model.1s", identityClass: "system-vehicle" },
  ],
  characters: [{ kind: "character", itemId: 2, title: "皮蛋", internalId: "dao",
    path: "character_dao.rho/model.1s", identityClass: "catalog-character" }],
  equipment: [
    { kind: "headBand", category: 11, itemId: 22, title: "蓝色头饰", internalId: "head_a" },
    { kind: "aura", category: 26, itemId: 33, title: "蓝色光环", internalId: "aura_a" },
    { kind: "flyingPet", category: 52, itemId: 44, title: "蓝色飞宠", internalId: "pet_a" },
    { kind: "unsupported", category: 30, itemId: 55, title: "未知消耗品", internalId: "use_a" },
  ],
};

function profile(): LocalProfile {
  return {
    equipment: { itemIds: { 1: 2, 3: 387, 11: 22, 26: 0, 52: 0 },
      kartSerial: 0, valueAt3E: 0, exceedType: 0 },
    initial: "", favoriteItems: [], favoriteTracks: [],
    myRoom: defaultMyRoomProfile(),
  };
}

test("My Items uses only categories supported by the local garage catalog", () => {
  const items = itemInventoryEntries(catalog);
  assert.deepEqual(items.map(item => item.title), [
    "标准赛车", "系统赛车", "皮蛋", "蓝色头饰", "蓝色光环", "蓝色飞宠",
  ]);
  assert.deepEqual(filterItemInventory(items, profile(), "equip", "蓝色", "all")
    .map(item => item.title), ["蓝色头饰"]);
  assert.deepEqual(filterItemInventory(items, profile(), "deco", "33", "all")
    .map(item => item.title), ["蓝色光环"]);
  assert.deepEqual(filterItemInventory(items, profile(), "character", "", "flyingPet")
    .map(item => item.title), ["蓝色飞宠"]);
});

test("favorites use existing profile identity, persist via profile copies, and respect system kart keys", () => {
  const items = itemInventoryEntries(catalog);
  const standard = items[0]!;
  const system = items[1]!;
  const original = profile();
  const withStandard = toggleItemInventoryFavorite(original, standard);
  const withBoth = toggleItemInventoryFavorite(withStandard, system);
  assert.equal(original.favoriteItems.length, 0);
  assert.deepEqual(withBoth.favoriteItems, [
    { category: 3, itemId: 387, serial: 0 },
    { category: 3, itemId: 0, serial: 0, systemKart: "system-a" },
  ]);
  assert.equal(itemInventoryIsFavorite(system, withBoth), true);
  assert.deepEqual(filterItemInventory(items, withBoth, "favorite", "", "all")
    .map(item => item.title), ["标准赛车", "系统赛车"]);
  assert.deepEqual(toggleItemInventoryFavorite(withBoth, standard).favoriteItems,
    [withBoth.favoriteItems[1]]);
});

test("equipped state distinguishes system kart identities and accessory categories", () => {
  const items = itemInventoryEntries(catalog);
  const current = profile();
  assert.equal(itemInventoryIsEquipped(items[0]!, current), true);
  assert.equal(itemInventoryIsEquipped(items[3]!, current), true);
  assert.equal(itemInventoryIsEquipped(items[1]!, current), false);
  current.equipment.itemIds[3] = 0;
  current.equipment.systemKart = "other-system";
  assert.equal(itemInventoryIsEquipped(items[1]!, current), false);
  current.equipment.systemKart = "system-a";
  assert.equal(itemInventoryIsEquipped(items[1]!, current), true);
});

test("only removable accessories expose the original garage's second-click unequip action", () => {
  const items = itemInventoryEntries(catalog);
  assert.equal(itemInventoryCanUnequip(items.find(item => item.kind === "kart")!), false);
  assert.equal(itemInventoryCanUnequip(items.find(item => item.kind === "character")!), false);
  assert.equal(itemInventoryCanUnequip(items.find(item => item.kind === "headBand")!), true);
  assert.equal(itemInventoryCanUnequip(items.find(item => item.kind === "aura")!), true);
  assert.equal(itemInventoryCanUnequip(items.find(item => item.kind === "flyingPet")!), true);
  assert.equal(itemInventoryCanUnequip({ ...items[3]!, kind: "color", category: 2 }), false);
  assert.equal(itemInventoryCanUnequip({ ...items[3]!, kind: "dye", category: 70 }), false);
});
