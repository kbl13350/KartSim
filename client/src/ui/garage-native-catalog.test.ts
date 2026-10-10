import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  garageDrivingMode, garageEnchantScoreFields, garageExceedTextures,
  garageFactoryAbilityAttributes, garageFunctionTextures,
  garageLayoutProfiles, garagePartCategoryIds,
  garagePartSlotsByCategory, garageScoreDisplayRows,
  garageScoreFieldBySlot, garageScorePartCategories,
  garageScoreXmlAttributes, garageSkillDirectory,
  garageSkillPickerImages, garageSkillTextures,
  garageTuneCategoriesByNode, garageTuneNodesByCategory,
  garageVehicleFunctions, zeroGarageFactoryAbility,
} from "./garage-native-catalog";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["Q", "Ii", "ne", "Ki", "Vt", "Fa", "tt", "pn"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "VariableDeclaration" &&
    node.declarations.some(item => item.id.type === "Identifier" &&
      names.has(item.id.name)));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(item => release.slice(item.start!, item.end!))
  .join("\n");
const original = new Function(`${originalSource}\nreturn {
  Q,Ps,$i,Ti,ki,Ii,Es,Ri,Ki,Vi,Hi,Vt,Ht,Fa,Ga,tt,ks,pn,fn,mn,ls
};`)() as Record<string, unknown>;

test("Garage native catalog constants and vehicle function gates match release", () => {
  const comparison = [
    [original.Q, garagePartCategoryIds],
    [[...(original.Ps as Map<unknown, unknown>)], [...garagePartSlotsByCategory]],
    [[...(original.$i as Map<unknown, unknown>)], [...garageTuneNodesByCategory]],
    [[...(original.Ti as Map<unknown, unknown>)], [...garageTuneCategoriesByNode]],
    [original.ki, garageDrivingMode],
    [[...(original.Ii as Set<unknown>)], [...garageEnchantScoreFields]],
    [original.Ri, garageFunctionTextures],
    [original.Ki, garageLayoutProfiles.classic],
    [original.Vi, garageLayoutProfiles.v1],
    [original.Hi, garageLayoutProfiles.xun],
    [original.Vt, garageSkillTextures],
    [original.Ht, garageExceedTextures],
    [original.Fa, garageSkillDirectory],
    [original.Ga, garageSkillPickerImages],
    [original.tt, garageFactoryAbilityAttributes],
    [(original.ks as () => unknown)(), zeroGarageFactoryAbility()],
    [original.pn, garageScoreFieldBySlot],
    [original.fn, garageScorePartCategories],
    [original.mn, garageScoreXmlAttributes],
    [original.ls, garageScoreDisplayRows],
  ];
  for (const [expected, actual] of comparison) assert.deepEqual(actual, expected);
  const oldFunctions = original.Es as Array<{
    icon: string; focusedIcon: string; nameKey: string;
    descriptionKey: string;
    visible(vehicle: Record<string, number | undefined>): boolean;
  }>;
  assert.equal(garageVehicleFunctions.length, oldFunctions.length);
  const scenarios = [
    {}, { draftTick: 1, dualTransLowSpeed: 1,
      chargeBoostBySpeed: 1, vehicleFunctionWallCollisionGaugeValue: 1,
      vehicleFunctionChargerBranchValue: 1, speedSlotCapacity: 3,
      itemSlotCapacity: 3, specialSlotCapacity: 2,
      useExtendedAfterBoosterMore: 1 },
    { vehicleFunctionChargerBranchValue: 0 },
  ];
  for (const [index, item] of garageVehicleFunctions.entries()) {
    const reference = oldFunctions[index]!;
    assert.deepEqual({ icon: item.icon, focusedIcon: item.focusedIcon,
      nameKey: item.nameKey, descriptionKey: item.descriptionKey },
    { icon: reference.icon, focusedIcon: reference.focusedIcon,
      nameKey: reference.nameKey, descriptionKey: reference.descriptionKey });
    for (const scenario of scenarios)
      assert.equal(item.visible(scenario), reference.visible(scenario));
  }
});
