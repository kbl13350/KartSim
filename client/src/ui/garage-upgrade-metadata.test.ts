import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  parseGarageTuneAbilities, parseGarageExceedTypes,
  parseGarageExceedChangeRules, type GarageUpgradeXmlNode,
} from "./garage-upgrade-metadata";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name: string, bindings: string[], values: unknown[]): Function {
  const declaration = declarations.find(node => node.type === "FunctionDeclaration" &&
    node.id?.name === name);
  assert.ok(declaration && declaration.type === "FunctionDeclaration");
  return new Function(...bindings,
    `return (${release.slice(declaration.start!, declaration.end!)});`)(...values) as Function;
}

interface TestNode extends GarageUpgradeXmlNode {
  attributes: Record<string, string>;
  children: TestNode[];
}
const node = (name: string, attributes: Record<string, string> = {},
  children: TestNode[] = []): TestNode => ({ name, attributes, children });
const attribute = (source: GarageUpgradeXmlNode, name: string): string | undefined =>
  (source as TestNode).attributes[name];

test("localized tune ability IDs, duplicate rows and color markup match release ea", () => {
  const released = original("ea", ["L"], [attribute]) as
    (root: GarageUpgradeXmlNode) => ReturnType<typeof parseGarageTuneAbilities>;
  for (const root of [
    node("Other", {}, [node("Tune", { groupId: "1", id: "1" })]),
    node("TuneAbility", {}, [
      node("Tune", { groupId: "2", id: "3", name: "漂移", desc:
        "[color:255 0 0 255]强化[/color]速度" }),
      node("Tune", { groupId: "2", id: "3", name: "覆盖" }),
      node("Tune", { groupId: "0", id: "3", name: "忽略" }),
      node("Tune", { groupId: "NaN", id: "1" }),
      node("NotTune", { groupId: "3", id: "3" }),
    ]),
  ]) assert.deepEqual(parseGarageTuneAbilities(root, attribute), released(root));
});

test("exceed type levels and malformed entries match release ta", () => {
  const released = original("ta", ["L"], [attribute]) as
    (root: GarageUpgradeXmlNode) => ReturnType<typeof parseGarageExceedTypes>;
  for (const root of [
    node("root"),
    node("root", {}, [node("exceedTypeList", {}, [
      node("exceedType", { id: "5", textureType: "2", exceedAccel: "3",
        exceedTime: "1" }),
      node("exceedType", { id: "5", textureType: "3", exceedAccel: "1",
        exceedTime: "2" }),
      node("exceedType", { id: "6", textureType: "0", exceedAccel: "1",
        exceedTime: "2" }),
      node("exceedType", { id: "7", textureType: "1", exceedAccel: "4",
        exceedTime: "2" }),
      node("other", { id: "8", textureType: "1", exceedAccel: "1",
        exceedTime: "2" }),
    ])]),
  ]) assert.deepEqual(parseGarageExceedTypes(root, attribute), released(root));
});

test("exceed change fees and vehicle restrictions match release sa", () => {
  const originalTypes = original("ta", ["L"], [attribute]);
  const quality = new Map([
    ["Unique", 4], ["Legend", 3], ["Rare", 5], ["Normal", 2],
    ["Special", 1], ["Ultimate", 6], ["Epic", 7],
  ]);
  const released = original("sa", ["ta", "Ji", "L"],
    [originalTypes, quality, attribute]) as
    (root: GarageUpgradeXmlNode) => ReturnType<typeof parseGarageExceedChangeRules>;
  const root = node("root", {}, [
    node("exceedTypeList", {}, [node("exceedType", {
      id: "1", textureType: "9", exceedAccel: "2", exceedTime: "3",
    })]),
    node("exceedTypeChangeFee", {}, [
      node("Legend", { ethisSpanner: "3", lucci: "500",
        ingredientEnableGrade: "1,2,2,7,0,NaN" }),
      node("Normal", { ethisSpanner: "0", lucci: "0",
        ingredientEnableGrade: "3" }),
      node("Epic", { ethisSpanner: "-1", lucci: "100",
        ingredientEnableGrade: "2" }),
      node("Unknown", { ethisSpanner: "1", lucci: "2",
        ingredientEnableGrade: "3" }),
    ]),
    node("exceedTypeChangeOnly", {}, [node("Kart", { id: "22" }),
      node("Kart", { id: "0" }), node("Kart", { id: "22" })]),
    node("notUseAsExceedTypeChange", {}, [node("Item", { id: "44" })]),
    node("unableExceedTypeChange", {}, [node("Kart", { id: "55" })]),
  ]);
  assert.deepEqual(parseGarageExceedChangeRules(root, attribute), released(root));
  const empty = node("root");
  assert.deepEqual(parseGarageExceedChangeRules(empty, attribute), released(empty));
});
