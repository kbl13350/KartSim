import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  calculateGarageRadar, drawGarageRadar, garageRadarPoint,
  type GarageRadarAxis, type GarageRadarRect, type GarageRadarWeights,
} from "./garage-radar-chart";

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
function releaseConstant(name: string): unknown {
  const declaration = declarations.filter(node => node.type === "VariableDeclaration")
    .flatMap(node => node.declarations)
    .find(node => node.id.type === "Identifier" && node.id.name === name);
  assert.ok(declaration?.init);
  return new Function(`return (${release.slice(declaration.init.start!,
    declaration.init.end!)});`)();
}

const fields = releaseConstant("et") as Record<string, string>;
const labels = releaseConstant("na") as string[];
const finite = original("ee", ["H"], [Math.fround]);
const releaseCalculate = original("la", ["et", "ee", "H", "na"],
  [fields, finite, Math.fround, labels]) as (
  base: Record<string, number>, enhanced: Record<string, number>,
  weights: Map<string, GarageRadarWeights>) => GarageRadarAxis[];

function vehicle(offset = 0): Record<string, number> {
  return {
    dragFactor: 45 + offset, forwardAccel: 32 + offset,
    transAccelFactor: 58 + offset, teamBoosterTime: 42 + offset,
    normalBoosterTime: 38 + offset, startBoosterTimeSpeed: 21 + offset,
    driftMaxGauge: 56 + offset, driftEscapeForce: 19 + offset,
    cornerDrawFactor: 12 + offset, DescEngineGrade: 4 + offset,
    DescCornering: 3 + offset, DescStability: 30 + offset,
    DescBalance: 40 + offset, DescEnchantCap: 50 + offset,
  };
}
function weights(): Map<string, GarageRadarWeights> {
  return new Map(Object.keys(fields).map((key, index) => [key, {
    publicCutDown: 5 + index / 7, enchantVariable: 2 + index / 3,
    generalWeight: 0.9 + index / 10, enchantWeight: 1.1 + index / 10,
  }]));
}

test("vehicle radar eight-axis values and invalid weights match release la", () => {
  const cases: Array<{
    base: Record<string, number>; enhanced: Record<string, number>;
    weights: Map<string, GarageRadarWeights>;
  }> = [
    { base: vehicle(), enhanced: vehicle(3.25), weights: weights() },
    { base: vehicle(-150), enhanced: vehicle(-70), weights: weights() },
    { base: vehicle(100), enhanced: vehicle(200), weights: weights() },
    { base: vehicle(), enhanced: vehicle(), weights: new Map() },
  ];
  const badWeight = weights();
  badWeight.set("DriftMaxGauge", { ...badWeight.get("DriftMaxGauge")!,
    enchantVariable: 0 });
  cases.push({ base: vehicle(), enhanced: vehicle(1), weights: badWeight });
  const nonFinite = vehicle();
  nonFinite.dragFactor = Number.NaN;
  cases.push({ base: nonFinite, enhanced: vehicle(1), weights: weights() });
  for (const [index, input] of cases.entries()) {
    const run = (released: boolean) => {
      try {
        return { value: released ? releaseCalculate(input.base, input.enhanced,
          input.weights) : calculateGarageRadar(input.base, input.enhanced,
          input.weights) };
      } catch (cause) { return { error: String(cause) }; }
    };
    assert.deepEqual(run(false), run(true), `radar case ${index}`);
  }
});

test("radar polygon points preserve release Yt float32 geometry", () => {
  const point = original("Yt", [], []) as (rect: GarageRadarRect,
    axis: number, percent: number) => { x: number; y: number };
  for (const rect of [
    { x: 0, y: 0, width: 180, height: 220 },
    { x: -12.5, y: 4.25, width: 140.5, height: 80.25 },
  ]) for (const axis of [0, 1, 3, 7]) for (const percent of [0, 25, 100, 125])
    assert.deepEqual(garageRadarPoint(rect, axis, percent),
      point(rect, axis, percent), `${JSON.stringify(rect)} ${axis} ${percent}`);
});

function drawRun(released: boolean, axes: GarageRadarAxis[]): unknown {
  const events: unknown[] = [];
  const context = new Proxy({
    save: () => { events.push("save"); },
    restore: () => { events.push("restore"); },
    beginPath: () => { events.push("beginPath"); },
    closePath: () => { events.push("closePath"); },
    fill: () => { events.push("fill"); },
    stroke: () => { events.push("stroke"); },
    moveTo: (x: number, y: number) => { events.push(["moveTo", x, y]); },
    lineTo: (x: number, y: number) => { events.push(["lineTo", x, y]); },
    fillText: (text: string, x: number, y: number) => {
      events.push(["fillText", text, x, y]);
    },
  }, {
    set(target, property, value) {
      events.push(["set", String(property), value]);
      return Reflect.set(target, property, value);
    },
  }) as unknown as CanvasRenderingContext2D;
  const rect = { x: 11, y: 23, width: 177, height: 146 };
  if (released) {
    const releasedDraw = original("ga", ["Yt"], [original("Yt", [], [])]) as
      (context: CanvasRenderingContext2D, rect: GarageRadarRect,
        axes: GarageRadarAxis[]) => void;
    releasedDraw(context, rect, axes);
  } else drawGarageRadar(context, rect, axes);
  return events;
}

test("radar rings, polygons and labels follow release ga canvas calls", () => {
  const axes = calculateGarageRadar(vehicle(), vehicle(4), weights());
  assert.deepEqual(drawRun(false, axes), drawRun(true, axes));
  assert.deepEqual(drawRun(false, axes.slice(0, 7)), drawRun(true, axes.slice(0, 7)));
});
