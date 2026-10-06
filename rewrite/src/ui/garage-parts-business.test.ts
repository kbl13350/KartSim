import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  collectGarageParts, parseLegacyGarageParts, resolveEquippedGaragePart,
  sameGaragePart, sortGarageParts,
  type GaragePart, type GaragePartFamily, type GaragePartSlot,
  type GarageXmlNode,
} from "./garage-parts-business";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const originalNames = new Set(["Bt", "_i", "Li", "Bi", "qi", "Xe", "Kt"]);
const originalConstants = new Set(["Q", "Ii", "ji"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration"
    ? originalNames.has(node.id?.name ?? "")
    : node.type === "VariableDeclaration" && node.declarations.some(declaration =>
      declaration.id.type === "Identifier" && originalConstants.has(declaration.id.name)))
  .map(node => release.slice(node.start!, node.end!));

const slots: GaragePartSlot[] = ["engine", "handle", "wheel", "booster"];
const readAttribute = (node: GarageXmlNode | undefined, name: string): string | undefined =>
  node?.attributes.find(entry => entry.name === name)?.value;
const defaultParts = (family: "x" | "v1", slot: GaragePartSlot): GaragePart[] => [{
  family, slot, itemId: family === "x" ? 1 : 2, value: 0,
  grade: 4, builtIn: true, engineGrade: family === "x" ? 7 : 8,
}];
const xunPartValue = (id: number): number => id * 0.25;
const familyForKart = (_kart: unknown, grade: number | undefined): GaragePartFamily | undefined =>
  grade === 9 ? "xun" : grade === 8 ? "v1" : grade === 7 ? "x" : "legacy";

const Original = new Function("L", "de", "gs", "Bs", "me",
  `${declarations.join("\n")}; return { Li, Bi, qi, Xe, Kt };`)(
    readAttribute, slots, defaultParts, xunPartValue, familyForKart,
  ) as {
    Li: (...args: unknown[]) => GaragePart[];
    Bi: (...args: unknown[]) => GaragePart[];
    qi: (...args: unknown[]) => GaragePart[];
    Xe: (...args: unknown[]) => GaragePart | undefined;
    Kt: (...args: unknown[]) => boolean;
  };

function xml(name: string, attributes: Record<string, string> = {}, children: GarageXmlNode[] = []): GarageXmlNode {
  return { name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children };
}
function comparable(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

const inventory = xml("inventory", {}, [
  xml("item", { itemCatId: "43", itemId: "101", itemName: " 加速引擎 ", itemEffect: "更快", itemDesc: " 适用比赛 " }),
  xml("item", { itemCatId: "43", itemId: "101", itemName: "重复应忽略" }),
  xml("item", { itemCatId: "44", itemId: "202", itemName: "转向器" }),
  xml("item", { itemCatId: "45", itemId: "303", itemName: "" }),
  xml("item", { itemCatId: "45", itemId: "303", itemName: "即使再次出现也应忽略" }),
  xml("item", { itemCatId: "99", itemId: "1", itemName: "无关物品" }),
]);
const specs = xml("specs", {}, [
  xml("ItemCat", { id: "43" }, [
    xml("Item", { id: "101" }, [
      xml("EnchanterAddSpec", { gameType: "Item", forwardAccel: "99" }),
      xml("EnchanterAddSpec", { gameType: "Item; TimeAttack", forwardAccel: "2.5", unknownStat: "100" }),
      xml("EnchanterSetSpec", { gameType: "TimeAttack", dragFactor: "0.9" }),
    ]),
  ]),
]);
const artwork = xml("artwork", {}, [
  xml("tuneEnginePatch", { id: "101", name: "engine_icon" }),
  xml("tuneHandle", { id: "202", name: " handle_icon " }),
]);
const rarity = xml("rarity", {}, [
  xml("tuneEnginePatch", { id: "101", uniqueLevel: "3" }),
  xml("tuneHandle", { id: "202", uniqueLevel: "5" }),
]);

test("legacy part inventory, art, rarity, and tune stats match the release", () => {
  const expected = Original.Li(inventory, specs, artwork, rarity);
  const actual = parseLegacyGarageParts(inventory, specs, artwork, rarity, readAttribute);
  assert.deepEqual(comparable(actual), comparable(expected));
  assert.equal(actual.length, 2);
  assert.deepEqual(actual[0]?.legacySpec, { forwardAccel: 2.5 });
  assert.equal(actual[0]?.legacyRarity, 3);
  assert.equal(actual[1]?.legacyRarity, undefined);
});

test("garage parts from built-in, XUN, and legacy sources match the release", () => {
  const parts = xml("parts", {}, [
    xml("partsEngine", { id: "1" }),
    xml("partsEngine", { id: "2" }),
    xml("partsEngine12", { id: "11", uniqueLevel: "2" }),
    xml("partsWheel12", { id: "12", uniqueLevel: "4" }),
    xml("partsBooster12", { id: "13", uniqueLevel: "5" }),
    ...artwork.children,
  ]);
  const expected = Original.Bi(parts, inventory, specs, rarity);
  const actual = collectGarageParts(parts, inventory, specs, rarity,
    { slots, attribute: readAttribute, defaultParts, xunPartValue });
  assert.deepEqual(comparable(actual), comparable(expected));
  assert.equal(actual.filter(part => part.family === "xun").length, 2);
});

test("part sorting preserves rarity order and descending newer part value", () => {
  const list: GaragePart[] = [
    { family: "legacy", slot: "engine", itemId: 1, value: 0, grade: 0 },
    { family: "legacy", slot: "engine", itemId: 2, value: 0, grade: 0, legacyRarity: 3 },
    { family: "legacy", slot: "engine", itemId: 3, value: 0, grade: 0, legacyRarity: 3 },
    { family: "xun", slot: "engine", itemId: 4, value: 4, grade: 2 },
    { family: "xun", slot: "engine", itemId: 5, value: 4, grade: 3 },
    { family: "xun", slot: "engine", itemId: 6, value: 8, grade: 1 },
  ];
  for (const family of ["legacy", "xun"] as const) {
    const expected = Original.qi({ parts: list }, family, "engine");
    const actual = sortGarageParts({ parts: list }, family, "engine");
    assert.deepEqual(comparable(actual), comparable(expected));
  }
});

test("equipped and built-in parts resolve identically to the release", () => {
  const kart = { defaultExceedType: 1, defaultEngineType: 11 };
  const canonicalLegacy: GaragePart = {
    family: "legacy", slot: "engine", itemId: 101, value: 0, grade: 0, legacyRarity: 3,
  };
  const selectedLegacy: GaragePart = { ...canonicalLegacy, legacyRarity: undefined };
  const available: GaragePart[] = [canonicalLegacy,
    { family: "xun", slot: "engine", itemId: 11, value: 2.75, grade: 2 }];
  const cases: Array<[Partial<Record<GaragePartSlot, GaragePart>>, number | undefined,
    number | undefined, Partial<Record<GaragePartSlot, number>> | undefined]> = [
      [{ engine: selectedLegacy }, 6, undefined, undefined],
      [{}, 9, undefined, undefined],
      [{ engine: { family: "xun", slot: "engine", itemId: 1, value: 0, grade: 1 } }, 9, undefined, undefined],
      [{}, undefined, undefined, undefined],
      [{}, 7, 2, undefined],
      [{}, 8, 1, { engine: 4 }],
      [{}, 6, undefined, undefined],
  ];
  for (const [equipped, grade, uniqueLevel, defaults] of cases) {
    const expected = Original.Xe(kart, equipped, "engine", available, grade, uniqueLevel, defaults);
    const actual = resolveEquippedGaragePart(kart, equipped, "engine", available,
      grade, uniqueLevel, defaults, familyForKart);
    assert.deepEqual(comparable(actual), comparable(expected));
    assert.equal(sameGaragePart(actual, expected), Original.Kt(actual, expected));
  }
  const first = available[0];
  const equivalent = first && { ...first, legacyTitle: "different text" };
  assert.equal(sameGaragePart(first, equivalent), Original.Kt(first, equivalent));
  assert.equal(sameGaragePart(undefined, first), Original.Kt(undefined, first));
});

test("generated lazy GarageXView delegates its five business functions to readable code", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-parts-business\.ts"/);
  const functions = new Set(["Li", "Bi", "qi", "Xe", "Kt"]);
  const wrappers = parse(generated, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration" && functions.has(node.id?.name ?? ""))
    .map(node => generated.slice(node.start!, node.end!));
  assert.equal(wrappers.length, functions.size);
  const delegated = new Function(
    "parseLegacyGarageParts", "collectGarageParts", "sortGarageParts",
    "resolveEquippedGaragePart", "sameGaragePart", "L", "de", "gs", "Bs", "me",
    `${wrappers.join("\n")}; return { Li, Bi, qi, Xe, Kt };`,
  )(
    parseLegacyGarageParts, collectGarageParts, sortGarageParts,
    resolveEquippedGaragePart, sameGaragePart,
    readAttribute, slots, defaultParts, xunPartValue, familyForKart,
  ) as typeof Original;
  assert.deepEqual(comparable(delegated.Li(inventory, specs, artwork, rarity)),
    comparable(Original.Li(inventory, specs, artwork, rarity)));
  const parts = xml("parts", {}, [xml("partsEngine", { id: "1" }),
    xml("partsEngine12", { id: "11", uniqueLevel: "2" }), ...artwork.children]);
  assert.deepEqual(comparable(delegated.Bi(parts, inventory, specs, rarity)),
    comparable(Original.Bi(parts, inventory, specs, rarity)));
  const available = delegated.Bi(parts, inventory, specs, rarity);
  assert.deepEqual(comparable(delegated.qi({ parts: available }, "legacy", "engine")),
    comparable(Original.qi({ parts: available }, "legacy", "engine")));
  const kart = { defaultEngineType: 11 };
  assert.deepEqual(comparable(delegated.Xe(kart, {}, "engine", available, 9)),
    comparable(Original.Xe(kart, {}, "engine", available, 9)));
  assert.equal(delegated.Kt(available[0], available[0]), Original.Kt(available[0], available[0]));
});
