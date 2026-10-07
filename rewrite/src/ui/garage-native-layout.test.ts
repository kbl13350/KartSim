import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { garageArrowColor, garageBetweenRects, garageExtendRect,
  garageInsetRect, garageKartCardRect, garageNumericTuple, garagePair,
  garageSecondInsetRect, garageUpgradeAnimationPhase } from
  "./garage-native-layout";
import type { GarageCardGridAssets } from "./garage-ui-support";
import type { GarageAssetRect } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["Qe", "We", "gt", "Aa", "Gi", "st", "fa", "ma", "wa"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id!.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");

function run(released: boolean): unknown {
  const assets: GarageCardGridAssets = {
    rects: new Map(),
    kartCardLayout: { contentAdjustX: 0, contentAdjustY: 0,
      pageSize: 4, width: 40, gapX: 5, height: 60 },
    partGridLayout: { columns: 4, rows: 3 },
  };
  const cardsRect = () => ({ x: 10, y: 20, width: 200, height: 70 });
  const original = new Function("bt", "It",
    `${originalSource}\nreturn {Qe,We,gt,Aa,Gi,st,fa,ma,wa};`)(
      cardsRect, 15) as {
    Qe(value: string | undefined): unknown;
    We(value: string | undefined, label: string): unknown;
    gt(value: string | undefined, count: number, label: string): unknown;
    Aa(durations: number[], elapsed: number): unknown;
    Gi(assets: GarageCardGridAssets, index: number): unknown;
    st(rect: GarageAssetRect): unknown;
    fa(rect: GarageAssetRect): unknown;
    ma(left: GarageAssetRect, right: GarageAssetRect): unknown;
    wa(rect: GarageAssetRect, rightEdge: number): unknown;
  };
  const capture = (callback: () => unknown) => {
    try { return { value: callback() }; }
    catch (error) { return { error: String(error) }; }
  };
  const pairs = [undefined, "1 2", "bad 8", "1", " "]
    .map(value => released ? original.Qe(value) : garagePair(value));
  const colors = ["255 1 2 3", "256 1 2 3", "1 2", undefined]
    .map(value => capture(() => released ? original.We(value, "arrow") :
      garageArrowColor(value, "arrow")));
  const tuples = ["1 2 3 4", "1 2 3", "1 NaN 3 4", undefined]
    .map(value => capture(() => released ? original.gt(value, 4, "rect") :
      garageNumericTuple(value, 4, "rect")));
  const phases = [-5, 0, 9, 10, 34, 35, 99, NaN]
    .map(value => capture(() => released ? original.Aa([10, 25], value) :
      garageUpgradeAnimationPhase([10, 25], value)));
  const invalidPhase = capture(() => released ? original.Aa([], 10) :
    garageUpgradeAnimationPhase([], 10));
  const cards = [-1, 0, 2, 4].map(index => released ? original.Gi(assets, index) :
    garageKartCardRect(assets, index, cardsRect));
  const left = { x: 100, y: 20, width: 50, height: 40 };
  const right = { x: 160, y: 25, width: 20, height: 20 };
  const insets = {
    first: released ? original.st(left) : garageInsetRect(left, 15),
    second: released ? original.fa(left) : garageSecondInsetRect(left, 15),
    between: released ? original.ma(left, right) :
      garageBetweenRects(left, right, 15),
    extended: released ? original.wa(left, 220) :
      garageExtendRect(left, 220),
  };
  return { pairs, colors, tuples, phases, invalidPhase, cards, insets };
}

test("Garage numeric BML fields, animation phases and native geometry match release", () => {
  assert.deepEqual(run(false), run(true));
});
