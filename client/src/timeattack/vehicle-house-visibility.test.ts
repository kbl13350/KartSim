import assert from "node:assert/strict";
import test from "node:test";
import { refreshVehicleDisplaySettings } from "../resources/vehicle-display-settings";
import { defaultLocalProfile } from "../ui/local-profile";
import { itemInventoryEntries, filterItemInventory, itemInventoryCanEquip, type ItemInventoryCatalog } from "../ui/item-inventory";
import { myRoomAdminKartChoices } from "../ui/my-room-admin";
import { myRoomDisplayKarts } from "../ui/my-room-view";
import { autoFillCrew } from "../ui/my-room-expedition";
import { roomKarts } from "./ready-house";

async function closed(action: () => void) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window"), oldFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: { location: { origin: "https://vehicle-house.example" } } });
  globalThis.fetch = async () => new Response(JSON.stringify({
    disabledVehicleIds: ["catalog:3:10", "system:practiceKart"], version: "v1", updatedAt: 1,
  }));
  try { await refreshVehicleDisplaySettings(true); action(); }
  finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
const kart = (itemId: number, systemKey?: string) => ({ kind: "kart", itemId, systemKey,
  title: `车 ${itemId}`, internalId: `kart${itemId}`, path: `kart_/kart${itemId}/model.1s`, identityClass: "catalog-vehicle" });
const catalog: ItemInventoryCatalog = { karts: [kart(10), kart(20), kart(0, "practiceKart")],
  characters: [{ ...kart(2), kind: "character" }], equipment: [] };

test("old inventory filters disabled cards and refuses their equip without changing raw assets, favorites or ownership", async () => {
  await closed(() => {
    const profile = { ...defaultLocalProfile(), favoriteItems: [{ category: 3, itemId: 10, serial: 0 }] };
    const items = itemInventoryEntries(catalog);
    assert.equal(items.length, 4);
    assert.deepEqual(filterItemInventory(items, profile, "kartBody", "").map(item => item.itemId), [20]);
    assert.deepEqual(filterItemInventory(items, profile, "favorite", ""), []);
    assert.equal(itemInventoryCanEquip(items[0]!), false);
    assert.equal(itemInventoryCanEquip(items[1]!), true);
    assert.equal(itemInventoryCanEquip(items[2]!), false);
    assert.equal(profile.favoriteItems.length, 1);
  });
});

test("representative car dropdown hides closed cars but parked/current selections remain renderable", async () => {
  await closed(() => {
    const favorite = { category: 3, itemId: 10, serial: 0 };
    const profile = { ...defaultLocalProfile(), favoriteItems: [favorite] };
    const all = roomKarts(profile, catalog, true);
    assert.equal(all.length, 3);
    assert.deepEqual(myRoomAdminKartChoices(all).flatMap(choice => choice.kart ? [choice.kart.item.itemId] : []), [20]);
    assert.deepEqual(myRoomDisplayKarts(profile.myRoom, all), [favorite]);
    assert.deepEqual(myRoomDisplayKarts({ ...profile.myRoom, displayKarts: [favorite] }, all), [favorite]);
  });
});

test("expedition auto-fill chooses only enabled vehicles and retains full owned crew data", async () => {
  await closed(() => {
    const crew = { characters: [1, 2, 3].map(itemId => ({ itemId, specific: 0 })),
      karts: [{ itemId: 10, specific: 0, level: 5, parts: 0 },
        { itemId: 20, specific: 0, level: 0, parts: 0 },
        { itemId: 0, kartKey: "practiceKart", specific: 0, level: 0, parts: 0 }], friends: [] };
    const members = autoFillCrew({ specific: 0 }, crew, { characters: new Set(), karts: new Set() });
    assert.deepEqual(members.map(member => member.kart?.itemId), [20, undefined, undefined]);
    assert.equal(crew.karts.length, 3);
  });
});
