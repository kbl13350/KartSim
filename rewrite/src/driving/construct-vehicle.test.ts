import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { initializeVehicle, type VehicleCollisionDimensions, type VehicleRaceMode } from "./construct-vehicle";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const constructorStart = release.indexOf("  constructor(e, t, i = !1", classStart);
const constructorEnd = release.indexOf("  externalTeamGauge;", constructorStart);
assert.ok(classStart >= 0 && constructorStart > classStart && constructorEnd > constructorStart);
const constructorSource = release.slice(constructorStart, constructorEnd);

const fixtureMembers = `
  calls = [];
  clock = { enableRhythmCheck: () => this.calls.push("clock.enableRhythmCheck") };
  createBody() { this.calls.push("createBody"); return { kind: "body" }; }
  createState() { this.calls.push("createState"); return { kind: "state" }; }
  createWheelRuntime() { this.calls.push("createWheelRuntime"); return { kind: "wheels" }; }
  createRuntime() { this.calls.push("createRuntime"); return { eventScalePrimary: { x: 1, y: 1, z: 1 } }; }
`;
const validationCalls: VehicleRaceMode[] = [];
function validateRaceMode(mode: VehicleRaceMode): void {
  validationCalls.push(mode);
  if (mode.kind === "invalid") throw new Error("Invalid race mode");
}
const Original = new Function("Q00", "m", `return class Original { ${constructorSource} ${fixtureMembers} };`)(
  validateRaceMode, Math.fround,
) as new (...args: unknown[]) => Record<string, unknown>;
const Migrated = new Function("initializeVehicle", "Q00", `return class Migrated {
  constructor(e, t, i = false, r = false, s = false, o, a, c, l = false) {
    initializeVehicle(this, e, t, i, r, s, o, a, c, l, Q00);
  }
  ${fixtureMembers}
};`)(initializeVehicle, validateRaceMode) as new (...args: unknown[]) => Record<string, unknown>;

const tuning = { mass: 29.5, driftMaxGauge: 100, nested: { shared: "object" } };
const dimensions: VehicleCollisionDimensions = {
  rawHalfWidth: 0.85, rawHalfLength: 1.4,
  scaleX: 1.234567890123, scaleY: 0.987654321987, rawHeight: 1.765432109876,
};

function capture(make: new (...args: unknown[]) => Record<string, unknown>, args: unknown[]) {
  validationCalls.length = 0;
  try {
    const vehicle = new make(...args);
    const shape = vehicle.collisionShape as Record<string, number>;
    const runtime = vehicle.runtime as { eventScalePrimary: { x: number; y: number; z: number } };
    const result = {
      error: undefined,
      fields: {
        externalTeamGauge: vehicle.externalTeamGauge,
        speedRaceMode: vehicle.speedRaceMode,
        lteMotion: vehicle.lteMotion,
        giant: vehicle.giant,
        checkClientFramerate: vehicle.checkClientFramerate,
        tuning: vehicle.tuning,
        teamBooster: vehicle.teamBooster,
        teamBoosterDirect: vehicle.teamBoosterDirect,
        body: vehicle.body,
        state: vehicle.state,
        wheels: vehicle.wheels,
        runtime: vehicle.runtime,
        collisionShape: {
          rawHalfWidth: shape.rawHalfWidth,
          rawHalfLength: shape.rawHalfLength,
          scaleX: shape.scaleX,
          scaleY: shape.scaleY,
          rawHeight: shape.rawHeight,
        },
      },
      calls: vehicle.calls,
      validationCalls: [...validationCalls],
    };
    assert.notStrictEqual(vehicle.tuning, tuning, "tuning is shallow-copied");
    assert.strictEqual((vehicle.tuning as typeof tuning).nested, tuning.nested, "nested tuning reference is retained");
    assert.deepEqual(runtime.eventScalePrimary, {
      x: Math.fround(dimensions.scaleX),
      y: Math.fround(dimensions.scaleY),
      z: Math.fround(dimensions.rawHeight),
    });
    runtime.eventScalePrimary = { x: 7, y: 8, z: 9 };
    assert.deepEqual([shape.scaleX, shape.scaleY, shape.rawHeight], [7, 8, 9], "shape tracks runtime replacement");
    return result;
  } catch (error) {
    return {
      error: (error as Error).message,
      validationCalls: [...validationCalls],
    };
  }
}

function compare(label: string, ...args: unknown[]) {
  const rewritten = capture(Migrated, args);
  assert.deepEqual(rewritten, capture(Original, args), label);
  return rewritten;
}

test("constructor initializes validated modes, fresh objects and live collision shape", () => {
  assert.equal(compare("defaults", tuning, dimensions).error, undefined);
  assert.equal(compare("team mode and rhythm clock", tuning, dimensions, true, true, true,
    { kind: "ordinary", team: true }, undefined, undefined, true).error, undefined);
  assert.equal(compare("lte mode", tuning, dimensions, false, false, false,
    { kind: "lte", team: false }, { active: true }, undefined, false).error, undefined);
  assert.equal(compare("giant mode", tuning, dimensions, false, false, false,
    { kind: "giant", team: false }, undefined, { active: true }, false).error, undefined);
});

test("constructor validation errors and validator call order match release", () => {
  assert.match(compare("lte owner missing", tuning, dimensions, false, false, false,
    { kind: "lte", team: false }).error ?? "", /LTE/);
  assert.match(compare("giant owner missing", tuning, dimensions, false, false, false,
    { kind: "giant", team: false }).error ?? "", /巨人/);
  assert.match(compare("unexpected lte owner", tuning, dimensions, false, false, false,
    undefined, { active: true }).error ?? "", /LTE/);
  assert.match(compare("team mismatch", tuning, dimensions, false, false, false,
    { kind: "ordinary", team: true }).error ?? "", /组队/);
  assert.match(compare("mode validator", tuning, dimensions, false, false, false,
    { kind: "invalid", team: false }).error ?? "", /Invalid race mode/);
});
