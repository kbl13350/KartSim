import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garagePartDisplayName, garagePartOrdinal,
  garageXunPartOrdinal, parseGarageEnchantSpecs,
  type GaragePartListing, type GaragePartLabelDependencies,
  type GarageEnchantNode } from "./garage-part-presentation";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["_i", "Ls", "Ns", "$n"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");
const node = (name: string, properties: Record<string, string> = {},
  children: GarageEnchantNode[] = []): GarageEnchantNode => ({
    name, children, attributes: Object.entries(properties).map(([key, value]) =>
      ({ name: key, value })),
  });
const attribute = (source: GarageEnchantNode,
  name: string): string | undefined => source.attributes.find(entry =>
    entry.name === name)?.value;
const normalize = (value: unknown): unknown => value instanceof Map ? [...value] : value;

function run(released: boolean): unknown {
  const events: unknown[] = [];
  const defaults: GaragePartListing[] = [
    { family: "classic", slot: "engine", grade: 2, value: 10, itemId: 9 },
    { family: "classic", slot: "engine", grade: 2, value: 20, itemId: 10 },
  ];
  const available: GaragePartListing[] = [
    ...defaults,
    { family: "v1", slot: "engine", grade: 2, value: 3, itemId: 13 },
    { family: "xun", slot: "engine", grade: 2, value: 7, itemId: 20 },
    { family: "xun", slot: "engine", grade: 2, value: 4, itemId: 21 },
  ];
  const dependencies: GaragePartLabelDependencies = {
    slotLabel(slot, family) {
      events.push(["slot", slot, family]);
      return `${family}:${slot}`;
    },
    localize(_strings, key, fallback) {
      events.push(["localize", key, fallback]);
      return `L:${key}`;
    },
    slotKey: { engine: "engineKey" },
    engineName(_strings, grade, fallback) {
      events.push(["engine", grade, fallback]);
      return `E:${grade}`;
    },
    gradeName(grade) {
      events.push(["grade", grade]);
      return `Q:${grade}`;
    },
    defaultParts(family, slot) {
      events.push(["defaults", family, slot]);
      return defaults;
    },
  };
  const supportedCategories = new Set([100]);
  const supportedFields = new Set(["speed", "boost"]);
  const appliesToGameType = (gameType: string | undefined) =>
    gameType === "speed";
  const original = new Function("L", "Ps", "Bt", "Ii", "le", "Ge",
    "xn", "pt", "ft", "gs", `${originalSource}\nreturn {_i,Ls,Ns,$n};`)(
    attribute, supportedCategories, appliesToGameType, supportedFields,
    dependencies.slotLabel, dependencies.localize, dependencies.slotKey,
    dependencies.engineName, dependencies.gradeName, dependencies.defaultParts,
  ) as {
    _i(root: GarageEnchantNode | undefined): unknown;
    Ls(part: GaragePartListing, all: GaragePartListing[]): unknown;
    Ns(part: GaragePartListing, all: GaragePartListing[]): unknown;
    $n(part: GaragePartListing, strings: unknown,
      all: GaragePartListing[]): unknown;
  };
  const items = node("root", {}, [node("ItemCat", { id: "100" }, [
    node("Item", { id: "1" }, [
      node("EnchanterAddSpec", { gameType: "speed", speed: "1.5",
        boost: "2", ignored: "9", class: "fast" }),
      node("EnchanterAddSpec", { gameType: "other", speed: "99" }),
      node("EnchanterSetSpec", { gameType: "speed", speed: "10" }),
    ]),
    node("Item", { id: "0" }),
  ]), node("ItemCat", { id: "200" }, [node("Item", { id: "5" })])]);
  const cases: GaragePartListing[] = [
    { family: "legacy", slot: "engine", grade: 2, value: 0, itemId: 7,
      legacyTitle: "  Legacy Item  " },
    { family: "legacy", slot: "engine", grade: 2, value: 0, itemId: 8 },
    { family: "classic", slot: "engine", grade: 2, value: 0, itemId: 0,
      builtIn: true, engineGrade: 7 },
    available[3]!, available[0]!, available[2]!,
    { family: "classic", slot: "engine", grade: 2, value: 99, itemId: 99 },
  ];
  const results = cases.map(part => ({
    label: released ? original.$n(part, {}, available) :
      garagePartDisplayName(part, {}, available, dependencies),
    ordinal: released ? original.Ls(part, available) :
      garagePartOrdinal(part, available, dependencies),
    xunOrdinal: released ? original.Ns(part, available) :
      garageXunPartOrdinal(part, available, dependencies),
  }));
  const fallbackPart = defaults[1]!;
  const fallbackOrdinal = released ? original.Ls(fallbackPart, []) :
    garagePartOrdinal(fallbackPart, [], dependencies);
  const parsed = released ? original._i(items) : parseGarageEnchantSpecs(items, {
    attribute, categories: supportedCategories, appliesToGameType,
    scoreFields: supportedFields,
  });
  const empty = released ? original._i(undefined) :
    parseGarageEnchantSpecs(undefined, {
      attribute, categories: supportedCategories, appliesToGameType,
      scoreFields: supportedFields,
    });
  return { results, fallbackOrdinal, parsed: normalize(parsed),
    empty: normalize(empty), events };
}

test("Garage part labels, ordinals and enchant specs match release", () => {
  assert.deepEqual(run(false), run(true));
});
