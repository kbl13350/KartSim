import assert from "node:assert/strict";
import test from "node:test";
import { garageItemInUse } from "./garage-selection";
import { defaultMyRoomProfile, validateMyRoomProfile } from "./local-profile";
import { myRoomAdminKartChoices, sameFavorite } from "./my-room-admin";
import { myRoomDisplayKarts } from "./my-room-view";

const kart = (itemId: number, title: string, systemKart?: string) => ({
  item: { category: 3, itemId, serial: 0, ...(systemKart ? { systemKart } : {}) }, title,
});

test("representative kart choices start with 不选择 and keep labels unique", () => {
  const choices = myRoomAdminKartChoices([kart(1636, "光明骑士 迅"), kart(1637, "音律 迅"),
    kart(0, "光明骑士 迅", "legacy")]);
  assert.deepEqual(choices.map(choice => choice.label),
    ["不选择", "光明骑士 迅", "音律 迅", "光明骑士 迅 (2)"]);
  assert.equal(sameFavorite(choices[3]!.kart!.item, kart(0, "", "legacy").item), true);
  assert.equal(sameFavorite(choices[1]!.kart!.item, choices[2]!.kart!.item), false);
});

test("the room shows saved representative karts, else the first two starred", () => {
  const starred = [kart(1, "a"), kart(2, "b"), kart(3, "c")];
  const room = defaultMyRoomProfile();
  assert.deepEqual(myRoomDisplayKarts(room, starred).map(item => item.itemId), [1, 2]);
  assert.deepEqual(myRoomDisplayKarts({ ...room, displayKarts: [] }, starred), []);
});

test("room admin settings are validated", () => {
  const room = { ...defaultMyRoomProfile(), chatAllowed: false, roomPassword: "1234",
    displayKarts: [kart(1, "a").item, kart(2, "b").item] };
  validateMyRoomProfile(room);
  assert.throws(() => validateMyRoomProfile({ ...room,
    displayKarts: [kart(1, "a").item, kart(2, "b").item, kart(3, "c").item] }));
  assert.throws(() => validateMyRoomProfile({ ...room, roomPassword: "x".repeat(13) }));
  assert.throws(() => validateMyRoomProfile({ ...room,
    displayKarts: [{ category: 1, itemId: 2, serial: 0 }] }));
});

test("使用 lists the items the rider currently has equipped", () => {
  const equipment = { itemIds: { 1: 5, 3: 0, 9: 0, 11: 42 }, systemKart: "legacy" };
  const item = (kind: string, itemId: number, systemKey?: string) =>
    ({ kind, itemId, systemKey, title: "" }) as Parameters<typeof garageItemInUse>[0];
  assert.equal(garageItemInUse(item("character", 5), equipment), true);
  assert.equal(garageItemInUse(item("headBand", 42), equipment), true);
  assert.equal(garageItemInUse(item("kart", 0, "legacy"), equipment), true);
  assert.equal(garageItemInUse(item("kart", 0, "other"), equipment), false);
  assert.equal(garageItemInUse(item("balloon", 0), equipment), false);
  assert.equal(garageItemInUse(item("unknownKind", 5), equipment), false);
});
