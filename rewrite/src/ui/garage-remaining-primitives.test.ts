import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageAvailableVehicleFunctions, garageClassicUpgradeLines,
  garageExpectedProgressionKind, garageFactoryAbilityDraft,
  garageFactorySignature, garageGameTypeAllowed,
  garageNativeStatePath, garageNeedsLoadingLabel,
  garagePartCardLayoutForKind, garagePartCategoryId,
  garagePartPresentation, garageShowMaxPart,
  garageStageLayout } from "./garage-remaining-primitives";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["Bt", "Ni", "_t", "Fi", "xt", "se", "Ut", "Wi",
  "ht", "Zt", "Ta", "Na", "En"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

function run(released: boolean): unknown {
  const categories = { engine: 43, wheel: 45 };
  const layouts = [{ width: 1280, id: "small" },
    { width: 1600, id: "large" }];
  const functionCatalog = [
    { icon: "fast", nameKey: "fast", visible: (value: { speed: number }) =>
      value.speed > 0 },
    { icon: "slow", nameKey: "slow", visible: (value: { speed: number }) =>
      value.speed < 0 },
  ];
  const cardLayouts = new Map([["classic", { id: "classic-card" }],
    ["xun", { id: "xun-card" }]]);
  const lookup = (id: number) => id === 2 ? { id, level: 1 } : undefined;
  const isMaximum = (_part: unknown, values: unknown[]) => values.length > 1;
  const original = new Function("ki", "Q", "Mi", "Es", "js", "Pn",
    `${originalSource}\nreturn {Bt,Ni,_t,Fi,xt,se,Ut,Wi,ht,Zt,Ta,Na,En};`)(
    "TimeAttack", categories, layouts, functionCatalog, lookup,
    isMaximum) as {
      Bt(value: string | undefined): unknown;
      Ni(slot: string): unknown;
      _t(width: number): unknown;
      Fi(vehicle: { speed: number }): unknown;
      xt(assets: { partCardLayouts: Map<string, unknown> }, kind: string): unknown;
      se(path: string, suffix: string): unknown;
      Ut(kind: string): unknown;
      Wi(value: string | undefined, locked: boolean,
        fallback?: string): unknown;
      ht(factory: { abilities: number[] }): unknown;
      Zt(factory: { active: boolean; abilities: number[] }): unknown;
      Ta(summary: unknown): unknown;
      Na(value: boolean): unknown;
      En(part: unknown, available: unknown[], enabled?: boolean): unknown;
    };
  const capture = (callback: () => unknown) => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const modes = [undefined, "Speed;TimeAttack", "Item; Speed", ""]
    .map(value => released ? original.Bt(value) :
      garageGameTypeAllowed(value, "TimeAttack"));
  const categoryIds = ["engine", "wheel", "booster"].map(slot =>
    released ? original.Ni(slot) : garagePartCategoryId(slot, categories));
  const stages = [1280, 1600, 900].map(width => capture(() =>
    released ? original._t(width) : garageStageLayout(width, layouts)));
  const visible = [-1, 0, 1].map(speed => released ? original.Fi({ speed }) :
    garageAvailableVehicleFunctions({ speed }, functionCatalog));
  const cards = ["classic", "xun", "v1"].map(kind => released ?
    original.xt({ partCardLayouts: cardLayouts }, kind) :
    garagePartCardLayoutForKind({ partCardLayouts: cardLayouts }, kind));
  const paths = ["base", "base@zz"].map(path => released ?
    original.se(path, "_hover") : garageNativeStatePath(path, "_hover"));
  const progression = ["classic", "xun", "none"].map(kind => released ?
    original.Ut(kind) : garageExpectedProgressionKind(kind));
  const presentations = [
    [undefined, false, undefined], ["plus", true, undefined],
    [undefined, true, "默认"],
  ] as Array<[string | undefined, boolean, string | undefined]>;
  const parts = presentations.map(([value, locked, fallback]) => released ?
    original.Wi(value, locked, fallback) :
    garagePartPresentation(value, locked, fallback));
  const draft = released ? original.ht({ abilities: [1, 2, 0] }) :
    garageFactoryAbilityDraft([1, 2, 0], lookup);
  const signatures = [
    { active: false, abilities: [1, 2, 0] },
    { active: true, abilities: [] },
  ].map(factory => released ? original.Zt(factory) :
    garageFactorySignature(factory));
  const summary = { beforeLevel: 3, afterLevel: 4,
    beforePoints: 2, afterPoints: 5 };
  const lines = released ? original.Ta(summary) :
    garageClassicUpgradeLines(summary);
  const labels = [true, false].map(value => released ? original.Na(value) :
    garageNeedsLoadingLabel(value));
  const maxPart = [true, false, undefined].map(enabled => released ?
    original.En("part", [1, 2], enabled) :
    garageShowMaxPart("part", [1, 2], enabled,
      isMaximum));
  return { modes, categoryIds, stages, visible, cards, paths,
    progression, parts, draft, signatures, lines, labels, maxPart };
}

test("remaining Garage top-level primitives match release", () => {
  assert.deepEqual(run(false), run(true));
});
