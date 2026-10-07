import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garagePartCardLayout, garagePreparationCardLayout,
  type GarageCardLayoutDependencies } from "./garage-card-layouts";
import type { GarageAssetNode } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["qt", "Wa"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");
const node = (name: string, properties: Record<string, string> = {},
  children: GarageAssetNode[] = []): GarageAssetNode => ({
    name, children, attributes: Object.entries(properties).map(([key, value]) =>
      ({ name: key, value })),
  });
const attribute = (source: GarageAssetNode | undefined,
  name: string): string | undefined => source?.attributes.find(entry =>
    entry.name === name)?.value;

type Variant = "normal" | "fallback-card" | "bad-grid" |
  "bad-card-size";

function run(released: boolean, variant: Variant): unknown {
  const dependencies: GarageCardLayoutDependencies = {
    attribute,
    pair(value) {
      const numbers = (value ?? "0 0").split(/\s+/).map(Number);
      return [numbers[0]!, numbers[1]!];
    },
    numbers(value, count, label) {
      const numbers = (value ?? "").split(/\s+/).map(Number);
      if (numbers.length !== count || numbers.some(Number.isNaN))
        throw new Error(`bad ${label}`);
      return numbers;
    },
  };
  const card = node("Card", variant === "fallback-card" ? {
    windowRect: "0 0 100 80", texture: "card",
  } : { leftTopWH: "0 0 100 80", texture: "card" }, [
    node("Image", { name: "shopItemContainer", windowSize: "32 40",
      adjust: "2 3" }),
    node("Text", { name: "itemNameLabel", leftTopWH: "4 5 60 16" }),
  ]);
  const selector = node("Selector", {
    alignMargin: "2 3", clientMargin: "1 2 3 4",
    alignSize: variant === "bad-grid" ? "0" : "4", maxLine: "2",
  });
  const prepCard = node("Card", { windowRect:
    variant === "bad-card-size" ? "0 0 0 70" : "0 0 110 70" });
  const original = new Function("y", "Qe", "gt",
    `${originalSource}\nreturn {qt,Wa};`)(
    attribute, dependencies.pair, dependencies.numbers) as {
    qt(card: GarageAssetNode, x: number, y: number): unknown;
    Wa(selector: GarageAssetNode, card: GarageAssetNode): unknown;
  };
  const result = (callback: () => unknown): unknown => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  return {
    part: result(() => released ? original.qt(card, 5, 6) :
      garagePartCardLayout(card, 5, 6, dependencies)),
    preparation: result(() => released ? original.Wa(selector, prepCard) :
      garagePreparationCardLayout(selector, prepCard, dependencies)),
  };
}

test("Garage part and upgrade card layouts match release", () => {
  for (const variant of ["normal", "fallback-card", "bad-grid",
    "bad-card-size"] as const)
    assert.deepEqual(run(false, variant), run(true, variant), variant);
});
