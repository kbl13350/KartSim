import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  applyGarageLegacyParts, combineGarageXunScores, garageGradeContains,
  garageScoreInteger, garageXunSkillBonus, inverseGaragePartScore,
  projectGarageScoreField, roundGarageScore, scoreGarageBody,
  type GarageScoreWeightTable, type GarageXunScoredPart,
} from "./garage-score-arithmetic";

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
function outcome(run: () => unknown): unknown {
  try { return { value: run() }; }
  catch (cause) { return { error: String(cause) }; }
}

const fields = releaseConstant("Se") as string[];
const lengths = releaseConstant("Lt") as Record<string, number[]>;
const finite = original("xe", ["U"], [Math.fround]);
const releasedRound = original("rs", ["U"], [Math.fround]) as
  (value: number) => number;
const releasedProject = original("_s", ["Se", "Lt", "xe", "rs", "U"],
  [fields, lengths, finite, releasedRound, Math.fround]) as
  (field: string, value: number | undefined, table: GarageScoreWeightTable) => number;
const releasedInteger = original("Nt", [], []) as (value: number) => number;
const releasedBody = original("ut", ["Se", "Nt", "_s"],
  [fields, releasedInteger, releasedProject]) as
  (input: Record<string, number>, table: GarageScoreWeightTable) =>
    Record<string, number>;
const releasedInverse = original("cn", ["Lt", "Se", "xe", "U"],
  [lengths, fields, finite, Math.fround]) as
  (field: string, value: number, table: GarageScoreWeightTable) => number;

function table(kind: "x-v1" | "xun-body" | "xun-parts"):
  GarageScoreWeightTable {
  const count = lengths[kind]!;
  return { kind, rows: new Map(fields.map((field, index) => [field, {
    values: Array.from({ length: count[index]! }, (_, offset) =>
      index === 1 && offset === 0 ? 2 : 1 + offset * 0.25),
    fallback: 2.75,
  }])) };
}

test("float rounding, score projection, signed body and inverse part values match release", () => {
  for (const value of [-100.51, -0.5, -0.49, 0, 0.49, 0.5, 1.85, 65_535.25])
    assert.equal(roundGarageScore(value), releasedRound(value));
  for (const kind of ["x-v1", "xun-body"] as const) {
    const weights = table(kind);
    for (const field of fields) for (const value of [undefined, -1.25, 1.85, 3.875])
      assert.deepEqual(outcome(() => projectGarageScoreField(field, value, weights)),
        outcome(() => releasedProject(field, value, weights)),
        `${kind} ${field} ${value}`);
    const input = Object.fromEntries(fields.map(field => [field, 4.25]));
    assert.deepEqual(outcome(() => scoreGarageBody(input, weights)),
      outcome(() => releasedBody(input, weights)), kind);
  }
  const partWeights = table("xun-parts");
  assert.deepEqual(outcome(() => scoreGarageBody({}, partWeights)),
    outcome(() => releasedBody({}, partWeights)));
  const weights = table("x-v1");
  for (const field of fields) for (const value of [0, 15, 200, 65_535,
    65_536, 2.25])
    assert.deepEqual(outcome(() => inverseGaragePartScore(field, value, weights)),
      outcome(() => releasedInverse(field, value, weights)), `${field} ${value}`);
  assert.deepEqual(outcome(() => inverseGaragePartScore("TransAccelFactor", 5,
    table("xun-body"))), outcome(() => releasedInverse("TransAccelFactor", 5,
    table("xun-body"))));
  for (const value of [-2_147_483_649, -10.5, 0, 70_000, 2_147_483_648,
    Number.NaN])
    assert.deepEqual(outcome(() => garageScoreInteger(value)),
      outcome(() => releasedInteger(value)));
});

test("authored part grade grid accepts only exact integer steps like release hn", () => {
  const released = original("hn", [], []) as typeof garageGradeContains;
  const grid = new Map([[7, new Map([["TransAccelFactor", [
    { min: 100, max: 190, unit: 10 }, { min: 200, max: 290, unit: 10 },
  ]]])]]);
  for (const grade of [7, 8]) for (const value of [100, 105, 190, 200, 290, 300, 1.5])
    assert.equal(garageGradeContains(grid, grade, "TransAccelFactor", value),
      released(grid, grade, "TransAccelFactor", value));
});

test("XUN part plus skill composition validates categories, duplicates and ranges like release un", () => {
  const category = releaseConstant("Is") as Map<number, string>;
  const released = original("un", ["Se", "Is", "Nt"],
    [fields, category, releasedInteger]) as typeof combineGarageXunScores;
  const input = Object.fromEntries(fields.map((field, index) => [field, 20 + index]));
  const cases: Array<{ parts: GarageXunScoredPart[];
    bonus: Record<string, number> }> = [
    { parts: [{ field: "TransAccelFactor", category: 72, score: 8 }], bonus: {
      TransAccelFactor: 4, SteerConstraint: 100,
    } },
    { parts: [{ field: "TransAccelFactor", category: 72, score: 8 },
      { field: "TransAccelFactor", category: 72, score: 9 }], bonus: {} },
    { parts: [{ field: "TransAccelFactor", category: 74, score: 8 }], bonus: {} },
    { parts: [{ field: "TransAccelFactor", category: 72,
      score: Number.NaN }], bonus: {} },
    { parts: [], bonus: { DriftMaxGauge: 2_147_483_648 } },
  ];
  for (const [index, value] of cases.entries())
    assert.deepEqual(outcome(() => combineGarageXunScores(input, value.parts,
      value.bonus)), outcome(() => released(input, value.parts, value.bonus)),
      `composition ${index}`);
});

test("legacy part deltas preserve release float32 values and skip invalid specs", () => {
  const slots = ["engine", "handle", "wheel", "booster"];
  const released = original("yn", ["de", "mn"],
    [slots, releaseConstant("mn")]) as
    (input: Record<string, number>, configuration: Record<string, unknown>) =>
      Record<string, number>;
  const input = Object.fromEntries(fields.map((field, index) => [field, 1.25 + index]));
  const configurations = [
    {},
    { engine: { family: "legacy", legacySpec: { transAccelFactor: 0.1,
      driftEscapeForce: -0.4 } }, handle: { family: "xun",
      legacySpec: { steerConstraint: 999 } } },
    { wheel: { family: "legacy", legacySpec: { normalBoosterTime: Number.NaN,
      driftMaxGauge: 0.6 } } },
  ];
  for (const value of configurations)
    assert.deepEqual(applyGarageLegacyParts(input, value, slots),
      released(input, value));
});

test("XUN selected skill bonuses and missing tables match release sn", () => {
  const zero = releaseConstant("Pt") as () => Record<string, number>;
  const skillFields = releaseConstant("Ct") as Record<string, string>;
  const events: unknown[] = [];
  const validate = (value: unknown) => { events.push(["validate", value]); };
  const released = original("sn", ["Pt", "kt", "Ct"],
    [zero, validate, skillFields]) as typeof garageXunSkillBonus;
  const table = new Map([[1, [zero(), { TransAccelFactor: 4,
    DriftEscapeForce: 5, NormalBoosterTime: 6, DriftMaxGauge: 7 }]]]);
  const cases = [undefined, { skills: [{ id: 1, points: 1 }] },
    { skills: [{ id: 1, points: 0 }] }, { skills: [{ id: 2, points: 1 }] }];
  for (const [index, progression] of cases.entries()) {
    events.length = 0;
    const rewritten = outcome(() => garageXunSkillBonus(table, progression, validate));
    const rewrittenEvents = [...events];
    events.length = 0;
    const originalResult = outcome(() => released(table, progression, validate));
    assert.deepEqual(rewritten, originalResult, `skill ${index}`);
    assert.deepEqual(rewrittenEvents, events);
  }
});
