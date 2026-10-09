import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryItem } from "./account-session";
import { item } from "./account-test-fixtures";
import {
  ownedGarageCatalog, remainingLabel, sanitizeEquipment, starterChoice, STARTER,
  unownedSlots, type EquipmentLike, type Ownership,
} from "./ownership";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function ownership(items: InventoryItem[], now = NOW): Ownership {
  return {
    inventory: () => items,
    serverNow: () => now,
    owns: (category, itemId, systemKey, at = now) => items.some(row =>
      row.category === category && row.itemId === itemId &&
      (itemId !== 0 || (row.systemKey ?? "") === (systemKey ?? "")) &&
      (row.expiresAt === null || row.expiresAt > at)),
  };
}

const starterKit = [
  item(3, 0, { systemKey: "practiceKart", source: "starter" }),
  item(1, 3, { source: "starter" }),
  item(2, 6, { source: "starter" }),
  item(70, 7, { source: "starter" }),
];

const catalog = {
  karts: [
    { itemId: 387, title: "尖锋6.5", path: "kart_/saber10/model.1s" },
    { itemId: 1, title: "爆烈 C1", path: "kart_/burst1/model.1s" },
    { itemId: 0, systemKey: "practiceKart", title: "练习用卡丁车 V1", path: "kart_/practiceV1/model.1s" },
    { itemId: 0, systemKey: "legacyPracticeX", title: "练习用卡丁车 X", path: "kart_/practiceX/model.1s" },
  ],
  characters: [
    { itemId: 2, title: "皮蛋", path: "character_/dao/model.1s" },
    { itemId: 3, title: "黑妞", path: "character_/dizni/model.1s" },
  ],
  equipment: [
    { kind: "color", category: 2, itemId: 6, title: "蓝色喷漆" },
    { kind: "color", category: 2, itemId: 1, title: "红色喷漆" },
    { kind: "dye", category: 70, itemId: 7, title: "紫色染色剂" },
    { kind: "balloon", category: 9, itemId: 5, title: "气球" },
    { kind: "goggle", category: 8, itemId: 9, title: "眼镜" },
    // Not a shop category: free garage content stays listed.
    { kind: "tuneEnginePatch", category: 43, itemId: 2, title: "部件" },
  ],
  legacyFamilies: [],
};

test("the garage lists only owned, unexpired items with rental time left", () => {
  const owned = ownership([...starterKit,
    item(3, 387, { expiresAt: NOW + 3 * DAY + 1000, source: "shop" }),
    item(3, 1, { expiresAt: NOW - 1, source: "shop" }),
    item(9, 5, { quantity: 100 }),
  ]);
  const filtered = ownedGarageCatalog(catalog, owned);
  assert.deepEqual(filtered.karts.map(kart => [kart.itemId, kart.systemKey ?? "",
    (kart as { ownershipLabel?: string }).ownershipLabel]),
  [[387, "", "剩余 3 天"], [0, "practiceKart", undefined]]);
  assert.deepEqual(filtered.characters.map(character => character.itemId), [3]);
  assert.deepEqual(filtered.equipment.map(entry => `${entry.category}:${entry.itemId}`),
    ["2:6", "70:7", "9:5", "43:2"]);
  // The full catalog is untouched for races, ghosts and other players.
  assert.equal(catalog.karts.length, 4);
});

test("the current selection stays listed so the garage views can open", () => {
  const filtered = ownedGarageCatalog(catalog, ownership(starterKit),
    { kartItemId: 387, characterItemId: 2 });
  assert.deepEqual(filtered.karts.map(kart => kart.itemId), [387, 0]);
  assert.deepEqual(filtered.characters.map(character => character.itemId), [2, 3]);
  const system = ownedGarageCatalog(catalog, ownership([]),
    { kartItemId: 0, kartSystemKey: "legacyPracticeX" });
  assert.deepEqual(system.karts.map(kart => kart.systemKey), ["legacyPracticeX"]);
});

test("expired or unowned equipment falls back to the starter kit", () => {
  const equipment: EquipmentLike = {
    itemIds: { 1: 2, 2: 1, 3: 387, 4: 0, 8: 9, 9: 5, 43: 2, 68: 4, 70: 1 } as Record<number, number>,
    kartSerial: 7, valueAt3E: 0, exceedType: 3, systemKartVariant: "saber10",
  };
  const owned = ownership([...starterKit, item(9, 5)]);
  assert.deepEqual(unownedSlots(equipment, owned).sort((a, b) => a - b), [1, 2, 3, 8, 70]);
  const next = sanitizeEquipment(equipment, owned);
  assert.deepEqual(next.itemIds, { 1: 3, 2: 6, 3: 0, 4: 0, 8: 0, 9: 5, 43: 2, 68: 4, 70: 7 });
  assert.equal(next.systemKart, "practiceKart");
  assert.equal(next.kartSerial, 0);
  assert.equal(next.exceedType, 0);
  assert.equal("systemKartVariant" in next, false);
  // Nothing to replace keeps the same object.
  assert.equal(sanitizeEquipment(next, owned), next);
});

test("a rental that ran out is replaced the moment the clock passes it", () => {
  const equipment = { itemIds: { 1: 3, 2: 6, 3: 387, 70: 7 } as Record<number, number> };
  const rows = [...starterKit, item(3, 387, { expiresAt: NOW + 1000 })];
  assert.deepEqual(unownedSlots(equipment, ownership(rows)), []);
  assert.equal(sanitizeEquipment(equipment, ownership(rows, NOW + 1000)).itemIds[3], 0);
});

test("a fresh account owns nothing and starts from the default starter choice", () => {
  assert.deepEqual(starterChoice(ownership([])), { character: STARTER.defaultCharacter,
    paint: STARTER.defaultPaint, dye: STARTER.defaultDye });
  assert.deepEqual(starterChoice(ownership(starterKit)), { character: 3, paint: 6, dye: 7 });
  const next = sanitizeEquipment<EquipmentLike>({ itemIds: { 1: 2, 2: 1, 3: 387, 70: 1 } },
    ownership([]));
  assert.deepEqual(next.itemIds, { 1: 2, 2: 4, 3: 0, 70: 4 });
  assert.equal(next.systemKart, "practiceKart");
});

test("remaining time reads in days, hours or minutes", () => {
  assert.equal(remainingLabel(null, NOW), undefined);
  assert.equal(remainingLabel(NOW + 30 * DAY, NOW), "剩余 30 天");
  assert.equal(remainingLabel(NOW + 5 * 3_600_000 + 1, NOW), "剩余 5 小时");
  assert.equal(remainingLabel(NOW + 90_000, NOW), "剩余 2 分钟");
  assert.equal(remainingLabel(NOW, NOW), "已过期");
});
