import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  calculateGarageVehicleScores,
  type GarageConfigurationPart, type GarageScoreSource,
  type GarageScoringDependencies,
} from "./garage-score-calculation";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Me");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const releasedBody = release.slice(declaration.start!, declaration.end!);

type Variant = "xun" | "xun-skill" | "xun-missing-score" | "xun-ignore" |
  "legacy" | "v1" | "v1-fallback" | "v1-missing-grid" |
  "v1-invalid-grade" | "mismatch" | "missing-family" |
  "incompatible" | "invalid-factory";

function run(released: boolean, variant: Variant): unknown {
  const events: unknown[] = [];
  const family = variant.startsWith("xun") ? "xun" :
    variant === "legacy" ? "legacy" : "v1";
  const source: GarageScoreSource = {
    table: { kind: family === "xun" ? "xun-body" : "x-v1" },
    input: { TransAccelFactor: 20, DriftEscapeForce: 31,
      SteerConstraint: 42, NormalBoosterTime: 53, DriftMaxGauge: 64 },
    parts: variant === "xun-missing-score" ? [] :
      [{ category: 72, itemId: 501, score: 7 },
        { category: 73, itemId: 502, score: 3 }],
    skills: { skill: 1 },
    grid: variant === "v1-missing-grid" ? undefined : new Map([[7, "ranges"]]),
    factory: "factory-source",
  };
  const enginePart: GarageConfigurationPart = {
    family: variant === "incompatible" ? "wrong" :
      variant === "legacy" ? "v1" : family,
    slot: "engine", value: 150, itemId: 501,
  };
  const configuration: Record<string, unknown> = {
    engine: enginePart,
    factory: variant === "invalid-factory" ? "invalid" : "selected-factory",
    progression: variant === "xun-skill" ? { kind: "xun", skills: [] } :
      { kind: "classic" },
  };
  const vehicle = { id: 25 };
  const parts = { available: true };
  const slots = ["engine", "handle", "wheel", "booster"];
  const categories = { engine: 72, handle: 73, wheel: 74, booster: 75 };
  const fields = { engine: "TransAccelFactor", handle: "SteerConstraint",
    wheel: "DriftEscapeForce", booster: "NormalBoosterTime" };
  const dependencies: GarageScoringDependencies = {
    partFamily: () => family,
    scoreFamily: () => variant === "missing-family" ? undefined :
      variant === "mismatch" ? "xun" : family,
    validateFactory: factory => {
      events.push(["validate-factory", factory]);
      if (factory === "invalid") throw new Error("Invalid factory");
    },
    validatePart: part => { events.push(["validate-part", part.itemId]); },
    slotLocked: (_vehicle, slot) => { events.push(["slot-locked", slot]);
      return false; },
    slots, scorePartCategories: categories, scorePartFields: fields,
    resolvePart: (_vehicle, config, slot, _parts, grade) => {
      events.push(["resolve", slot, grade]);
      return config[slot] as GarageConfigurationPart | undefined;
    },
    skillBonus: (_skills, progression) => {
      events.push(["skill-bonus", progression]);
      return { Bonus: progression ? 8 : 0 };
    },
    combineXun: (input, scoredParts, bonus) => {
      events.push(["combine-xun", scoredParts.map(part => part.itemId), bonus]);
      return { TransAccelFactor: input.TransAccelFactor! + scoredParts.length,
        Bonus: bonus.Bonus! };
    },
    scoreBody: (input, table) => {
      events.push(["score-body", { ...input }, table.kind]);
      return { TransAccelFactor: input.TransAccelFactor! + 1,
        DriftEscapeForce: input.DriftEscapeForce! - 3 };
    },
    addLegacyParts: (input, config) => {
      events.push(["legacy-parts", config.engine]);
      return { ...input, TransAccelFactor: input.TransAccelFactor! + 9 };
    },
    applyFactory: (input, available, selected) => {
      events.push(["factory", available, selected]);
      return { ...input, DriftEscapeForce: input.DriftEscapeForce! + 2 };
    },
    fallbackGrade: grade => { events.push(["fallback", grade]); return 7; },
    gradeContains: (_grid, grade, field, value) => {
      events.push(["grade-contains", grade, field, value]);
      return variant !== "v1-invalid-grade";
    },
    inversePartScore: (field, value, table) => {
      events.push(["inverse", field, value, table.kind]);
      return value + 10;
    },
  };
  const grade = variant === "v1-fallback" ? 8 : 7;
  const ignoredSlot = variant === "xun-ignore" ? "engine" : undefined;
  let error: string | undefined;
  let value: Record<string, number> | undefined;
  try {
    if (released) {
      const original = new Function(
        "me", "vt", "Tt", "Zs", "de", "fe", "Xe", "fn", "sn", "un",
        "ut", "yn", "as", "pn", "ys", "hn", "cn",
        `return (${releasedBody});`,
      )(
        dependencies.partFamily, dependencies.scoreFamily,
        dependencies.validateFactory, dependencies.validatePart,
        slots, dependencies.slotLocked, dependencies.resolvePart, categories,
        dependencies.skillBonus, dependencies.combineXun,
        dependencies.scoreBody, dependencies.addLegacyParts,
        dependencies.applyFactory, fields, dependencies.fallbackGrade,
        dependencies.gradeContains, dependencies.inversePartScore,
      ) as (source: GarageScoreSource, vehicle: unknown, grade: number,
        configuration: Record<string, unknown>, parts: unknown,
        ignoredSlot: string | undefined) => Record<string, number>;
      value = original(source, vehicle, grade, configuration, parts, ignoredSlot);
    } else value = calculateGarageVehicleScores(source, vehicle, grade,
      configuration, parts, ignoredSlot, dependencies);
  } catch (cause) { error = String(cause); }
  return { error, value, events };
}

test("garage score family validation and XUN, legacy, V1 branches match release Me", () => {
  const variants: Variant[] = ["xun", "xun-skill", "xun-missing-score", "xun-ignore",
    "legacy", "v1", "v1-fallback", "v1-missing-grid", "v1-invalid-grade",
    "mismatch", "missing-family", "incompatible", "invalid-factory"];
  for (const variant of variants)
    assert.deepEqual(run(false, variant), run(true, variant), variant);
});
