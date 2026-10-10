import assert from "node:assert/strict";
import test from "node:test";

import type { ItemXmlNode } from "./item-bml";
import {
  NO_PASSIVES, animalBoosterIcon, cloudFactors, createAnimalBoosterTable, createItemPassiveTable,
  equipmentBlock, itemBoosterBonusMs, loadAnimalBoosterTable, loadItemPassiveTable, partialVariant,
  passivePercent, quickEscape, racerPassives, type PassiveRollContext, type RacerPassives,
} from "./item-passives";
import { itemRoll } from "./item-roll";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

const node = (name: string, attributes: Record<string, string> = {}, children: ItemXmlNode[] = []): ItemXmlNode =>
  ({ name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children });

/** Equipment `itemIds` with the passive slots. */
const ids = (slots: Partial<Record<"kart" | "character" | "pet" | "goggle" | "balloon" | "headBand" | "flyingPet",
  number>>) => ({
  "1": slots.character ?? 1, "3": slots.kart ?? 0, "21": slots.pet ?? 0, "8": slots.goggle ?? 0,
  "9": slots.balloon ?? 0, "11": slots.headBand ?? 0, "52": slots.flyingPet ?? 0,
});

test("the real itemTable: base kml overlaid by @cn per (tag, id), first numbers only", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const table = await loadItemPassiveTable(library);
  assert.ok(table.size > 1000);
  // CN overlay rows (itemTable@cn.xml line numbers).
  assert.deepEqual(table.attributes("kart", 75), { devil: "100" });                 // :28
  assert.deepEqual(table.attributes("kart", 62), { mine: "70", banana: "50" });      // :25
  assert.deepEqual(table.attributes("kart", 432), { waterfly: "-1,80" });           // :102
  assert.deepEqual(table.attributes("pet", 3), { rocket: "20" });                   // :1462
  assert.deepEqual(table.attributes("pet", 110), { waterfly: "20", devil: "0,100" }); // :1555
  assert.deepEqual(table.attributes("headBand", 284), { probability: "50" });       // :1313 (道具换位卡头饰)
  assert.deepEqual(table.attributes("balloon", 1135), { prob: "80" });              // :1104
  assert.deepEqual(table.attributes("character", 94), { lucciUfo: "10" });          // :9
  assert.deepEqual(table.attributes("flyingPet", 5), { tuneGroupId: "204" });       // :1978
  // Base kml only: goggle cloud time and the kart see-through (karts 61, 182).
  assert.deepEqual(table.attributes("goggle", 251), { trans: "0.7", cloudTime: "0.35" });
  assert.deepEqual(table.attributes("kart", 182), { trans: "0.7" });
  // CN re-assigns 572 (base tank1) to pumpkin2 with onlyWaterBomb; 571 is the CN tank1.
  assert.deepEqual(table.attributes("kart", 572), { onlyWaterBomb: "40" });
  assert.deepEqual(table.attributes("kart", 571), { mine: "100", banana: "100" });

  const kart826 = racerPassives(table, ids({ kart: 826 }));
  assert.equal(kart826.kart.eatMine, true);
  assert.equal(kart826.kart.mineWithKindOfEgg, true);
  assert.equal(kart826.kart.useTwoRocket, true);
  assert.equal(racerPassives(table, ids({ pet: 110 })).pet.devil, 0, "0,100 is AI-only");
  assert.equal(racerPassives(table, ids({ kart: 432 })).kart.waterfly, 0, "-1,80 is AI-only");
  assert.equal(racerPassives(table, ids({ kart: 608 })).kart.rocket, 0, "0,80 is AI-only");
  const goggle = racerPassives(table, ids({ goggle: 251 }));
  assert.deepEqual(cloudFactors(goggle), { opacity: 1 - 0.7, duration: 0.35 });
  assert.equal(itemBoosterBonusMs(racerPassives(table, ids({ flyingPet: 5 }))), 250);
  assert.equal(itemBoosterBonusMs(racerPassives(table, ids({ flyingPet: 6 }))), 0);
});

test("the real special booster table: base rows overlaid by @cn, -1 disables", async () => {
  const library = await loadMirrorLibrary(ITEM_CONTAINERS);
  const rows = await loadAnimalBoosterTable(library);
  assert.deepEqual(rows.get(80), { kartId: 80, iconId: 80, prob: 50 });   // base :4
  assert.deepEqual(rows.get(112), { kartId: 112, iconId: 266, prob: -1 }); // @cn :3 cancels base :8
  assert.equal(animalBoosterIcon(rows, 112), undefined);
  assert.equal(animalBoosterIcon(rows, 250), 241);                          // 黄金龙车SR
  assert.equal(animalBoosterIcon(rows, 97), 97);                            // base, no prob = 100
  assert.equal(animalBoosterIcon(rows, 1), undefined);
});

test("overlays, percents and slot keys", () => {
  const table = createItemPassiveTable(
    node("itemtable", {}, [
      node("kart", { id: "5", name: "a", banana: "50", grade: "1" }),
      node("goggle", { id: "7", trans: "0.5" }),
      node("pet", { id: "x", rocket: "20" }),
      node("other", { id: "1", rocket: "100" }),
    ]),
    node("itemtable", {}, [node("kart", { id: "5", banana: "100", rocket: "40,80" }), node("pet", { id: "9", rocket: "-1" })]));
  assert.deepEqual(table.attributes("kart", 5), { banana: "100", rocket: "40,80" });
  assert.deepEqual(table.attributes("goggle", 7), { trans: "0.5" });
  assert.equal(table.attributes("pet", 9)?.rocket, "-1");
  assert.equal(table.size, 3);
  assert.throws(() => createItemPassiveTable(node("root")));
  for (const [value, percent] of [["40", 40], ["40,80", 40], ["-1,80", 0], ["0,100", 0], ["150", 100],
    ["abc", 0], [undefined, 0], [" 25 , 3", 25]] as const) assert.equal(passivePercent(value), percent, String(value));
  // JSON equipment keys are strings; numbers work too.
  const passives = racerPassives(table, { "3": 5, "8": 7 });
  assert.equal(passives.kart.banana, 100);
  assert.equal(passives.kart.rocket, 40);
  assert.equal(passives.goggle.trans, 0.5);
  assert.equal(racerPassives(table, { 3: 5 }).kart.banana, 100);
  assert.equal(racerPassives(table, undefined).kart.banana, 0);
  assert.equal(racerPassives(undefined, { "3": 5 }).kartId, 5);
  const rows = createAnimalBoosterTable(node("animalBoosterList", {}, [
    node("animalBooster", { kartId: "3", iconId: "9" }), node("animalBooster", { kartId: "4", iconId: "8", prob: "-1" })]),
  node("animalBoosterList", {}, [node("animalBooster", { kartId: "4", iconId: "8", prob: "100" })]));
  assert.equal(animalBoosterIcon(rows, 3), 9);
  assert.equal(animalBoosterIcon(rows, 4), 8);
});

/** Passives with given values on top of nothing. */
function with_(patch: { kart?: Partial<RacerPassives["kart"]>; pet?: Partial<RacerPassives["pet"]>;
  character?: Partial<RacerPassives["character"]>; balloon?: number; headBand?: number }): RacerPassives {
  return { ...NO_PASSIVES, kart: { ...NO_PASSIVES.kart, ...patch.kart }, pet: { ...NO_PASSIVES.pet, ...patch.pet },
    character: { ...NO_PASSIVES.character, ...patch.character },
    balloon: { prob: patch.balloon ?? 0 }, headBand: { probability: patch.headBand ?? 0 } };
}

const context = (itemId: number, extra: Partial<PassiveRollContext> = {}): PassiveRollContext =>
  ({ raceId: "race", useId: 7, victimId: "me", itemId, ...extra });

test("equipment defences cover exactly the C.2 item groups", () => {
  const full = with_({ kart: { rocket: 100, waterfly: 100, devil: 100, banana: 100, mine: 100,
    waterMine: 100, siren: 100 }, pet: { waterBomb: 100, snowBomb: 100 } });
  // Rockets: rocket, cokeRocket and the gold family — not guide or random rockets.
  for (const idx of [7, 30, 32, 102, 107, 126]) assert.deepEqual(equipmentBlock(full, context(idx)), { by: "kart", kind: "rocket" });
  for (const idx of [33, 127, 99, 104, 112]) assert.equal(equipmentBlock(full, context(idx)), undefined, String(idx));
  for (const idx of [4, 118, 119, 120]) assert.equal(equipmentBlock(full, context(idx))?.kind, "waterfly");
  for (const idx of [9, 13, 20, 21, 27, 28, 44, 47]) assert.deepEqual(equipmentBlock(full, context(idx)), { by: "pet", kind: "waterBomb" });
  for (const idx of [34, 35]) assert.deepEqual(equipmentBlock(full, context(idx)), { by: "pet", kind: "snowBomb" });
  for (const idx of [2, 23, 38]) assert.deepEqual(equipmentBlock(full, context(idx)), { by: "kart", kind: "devil" });
  for (const idx of [8, 85]) assert.deepEqual(equipmentBlock(full, context(idx)),
    { by: "eat", kind: "banana", consumed: true, bonus: false });
  for (const idx of [17, 129, 130]) assert.deepEqual(equipmentBlock(full, context(idx)), { by: "kart", kind: "mine" });
  // Egg mines need an egg extension.
  for (const idx of [45, 82, 83]) {
    assert.equal(equipmentBlock(full, context(idx)), undefined);
    assert.equal(equipmentBlock(with_({ kart: { mine: 100, mineWithEggMine: true } }), context(idx))?.kind, "mine");
  }
  assert.deepEqual(equipmentBlock(full, context(37)), { by: "kart", kind: "waterMine" });
  assert.deepEqual(equipmentBlock(full, context(24)), { by: "kart", kind: "siren" });
  for (const idx of [3, 114, 110, 111, 113, 135, 137, 25, 46]) assert.equal(equipmentBlock(full, context(idx)), undefined);
  // onlyWaterBomb: the water bomb alone, and flies only with a fly-to-bomb ability.
  const onlyBomb = with_({ kart: { onlyWaterBomb: 100 } });
  assert.deepEqual(equipmentBlock(onlyBomb, context(9)), { by: "kart", kind: "waterBomb" });
  for (const idx of [13, 20, 4]) assert.equal(equipmentBlock(onlyBomb, context(idx)), undefined, String(idx));
  const flyToBomb = with_({ kart: { onlyWaterBomb: 100, waterflyToWaterBomb: true } });
  assert.deepEqual(equipmentBlock(flyToBomb, context(4)), { by: "kart", kind: "waterBomb" });
  assert.equal(equipmentBlock(flyToBomb, context(118)), undefined);
  assert.equal(equipmentBlock(with_({ kart: { onlyWaterBomb: 100, allflyToAllBomb: true } }), context(118))?.by, "kart");
  // Eating a mine: removed, plus the lucci bonus with a lucciMine character.
  assert.deepEqual(equipmentBlock(with_({ kart: { mine: 100, eatMine: true }, character: { lucciMine: 100 } }), context(17)),
    { by: "eat", kind: "mine", consumed: true, bonus: true });
  // iceBanana only on ice_ tracks.
  const ice = with_({ kart: { iceBanana: 100 } });
  assert.equal(equipmentBlock(ice, context(8, { trackId: "village_I01" })), undefined);
  assert.equal(equipmentBlock(ice, context(8, { trackId: "ice_I02" }))?.by, "eat");
  assert.equal(equipmentBlock(NO_PASSIVES, context(7)), undefined);
});

test("one shared roll per kind: the kart first, the better probability wins", () => {
  const roll = itemRoll({ raceId: "race", useId: 7, victimId: "me", kind: "rocket" });
  const kartJust = with_({ kart: { rocket: roll + 1 } });
  const kartMiss = with_({ kart: { rocket: roll }, pet: { rocket: roll + 1 } });
  assert.equal(equipmentBlock(kartJust, context(7))?.by, "kart");
  assert.equal(equipmentBlock(kartMiss, context(7))?.by, "pet");
  assert.equal(equipmentBlock(with_({ kart: { rocket: roll }, pet: { rocket: roll } }), context(7)), undefined);
  // The roll is per race, use, hazard and victim.
  const hazard = itemRoll({ raceId: "race", hazardId: 4, victimId: "me", kind: "banana" });
  assert.equal(equipmentBlock(with_({ kart: { banana: hazard + 1 } }), context(8, { useId: 0, hazardId: 4 }))?.by, "eat");
  assert.equal(equipmentBlock(with_({ kart: { banana: hazard } }), context(8, { useId: 0, hazardId: 4 })), undefined);
});

test("partial outcomes: balloon (not gold rockets), headband before 奇奇, waterAngel quick escape", () => {
  const all = with_({ balloon: 100, headBand: 100, character: { lucciUfo: 100 }, kart: { waterAngel: 100 } });
  for (const idx of [7, 33, 127, 30]) assert.equal(partialVariant(all, context(idx)), "balloon", String(idx));
  for (const idx of [32, 102, 107, 126, 104]) assert.equal(partialVariant(all, context(idx)), undefined, String(idx));
  assert.equal(partialVariant(all, context(7), { balloonSpent: true }), undefined);
  assert.equal(partialVariant(all, context(3)), "headband");
  assert.equal(partialVariant(with_({ character: { lucciUfo: 100 } }), context(3)), "bonus");
  assert.equal(partialVariant(all, context(2)), undefined);
  for (const idx of [9, 13, 20, 21, 27, 28, 34, 35, 44, 47, 4, 118, 119, 120, 37])
    assert.equal(quickEscape(all, context(idx)), true, String(idx));
  for (const idx of [7, 3, 2]) assert.equal(quickEscape(all, context(idx)), false);
  assert.equal(quickEscape(NO_PASSIVES, context(9)), false);
  assert.deepEqual(cloudFactors(NO_PASSIVES), { opacity: 1, duration: 1 });
  assert.deepEqual(cloudFactors({ ...NO_PASSIVES, kart: { ...NO_PASSIVES.kart, trans: 0.7 },
    goggle: { trans: 0.5, cloudTime: 1 } }), { opacity: 1 - 0.7, duration: 1 });
});
