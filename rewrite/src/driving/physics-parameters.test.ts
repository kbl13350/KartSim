import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bundledVehicleSpecCatalog } from "../physics/bundled";
import { vehiclePhysicsParameters, type PhysicsParameterSpec } from "./physics-parameters";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function jt0(n, e, t) {");
const end = release.indexOf("\nfunction $h(", start);
assert.ok(start > 0 && end > start);
const releaseParameters = new Function(`${release.slice(start, end)}\nreturn jt0;`)() as
  (spec: unknown, visual: unknown, grade: number) => Record<string, unknown>;

const itemFields = [
  "itemSlotCapacity", "itemBoosterTime", "startBoosterTimeItem", "startForwardAccelItem",
  "boostAccelFactorOnlyItem", "useExtendedAfterBooster", "useExtendedAfterBoosterMore",
  "animalBoosterTime", "superBoosterTime",
];

test("the AL tuning record keeps every release field and appends the item columns", () => {
  const catalog = bundledVehicleSpecCatalog();
  const keys = [...catalog.captured.keys(), ...catalog.supplemental.keys()];
  assert.ok(keys.length > 5000);
  const visual = { autoChargeLowSpeed: 120, driftGaugeReset: false, wheelPosition: 0.9 };
  let checked = 0;
  for (const key of keys) {
    const [id, speed] = key.split(":").map(Number);
    let spec: PhysicsParameterSpec;
    try {
      spec = catalog.lookup(id!, speed!).spec as unknown as PhysicsParameterSpec;
    } catch {
      continue; // incomplete supplemental rows are rejected by the catalog for every mode
    }
    for (const grade of [5, 7, 9]) {
      const actual: Record<string, unknown> = vehiclePhysicsParameters(spec, visual, grade);
      const expected = releaseParameters(spec, visual, grade);
      assert.deepEqual(Object.keys(actual).slice(0, Object.keys(expected).length),
        Object.keys(expected), key);
      for (const [name, value] of Object.entries(expected))
        assert.ok(Object.is(actual[name], value), `${key}:${grade}:${name}`);
      assert.deepEqual(Object.keys(actual).slice(Object.keys(expected).length), itemFields);
      checked += 1;
    }
  }
  assert.ok(checked > 5000 * 3, `${checked}`);
});

test("item columns come from the CN kart table", () => {
  const spec = bundledVehicleSpecCatalog().lookup(373, 7).spec as unknown as PhysicsParameterSpec;
  const tuning = vehiclePhysicsParameters(spec,
    { autoChargeLowSpeed: 100, driftGaugeReset: true, wheelPosition: 0.85 }, 5);
  assert.equal(tuning.itemSlotCapacity, 3);
  assert.equal(tuning.itemBoosterTime, 3000);
  assert.equal(tuning.startBoosterTimeItem, 1300);
  assert.equal(tuning.startForwardAccelItem, spec.startForwardAccelItem);
  assert.equal(tuning.boostAccelFactorOnlyItem, 1.5);
  assert.equal(typeof tuning.useExtendedAfterBooster, "boolean");
  assert.equal(tuning.animalBoosterTime, 4000);
  assert.equal(tuning.superBoosterTime, 3500);
});
