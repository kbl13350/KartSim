import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createVehicleBody,
  createVehicleRuntime,
  createVehicleState,
  createVehicleWheelRuntime,
  type VehicleTuningForInitialization,
} from "./initial-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const mapStart = release.indexOf("  J = {");
const runtimeClassStart = release.indexOf("class J40 {", mapStart);
const vehicleClassStart = release.indexOf("class AL {", runtimeClassStart);
const factoryStart = release.indexOf("  createBody() {", vehicleClassStart);
const factoryEnd = release.indexOf("\n}\nfunction ei0", factoryStart);
assert.ok(mapStart > 0 && runtimeClassStart > mapStart && vehicleClassStart > runtimeClassStart);
assert.ok(factoryStart > vehicleClassStart && factoryEnd > factoryStart);

const Original = new Function("m", `
  function F2(x = 0, y = 0, z = 0) { return { x, y, z }; }
  function O9(value) { return { x: value.x, y: value.y, z: value.z }; }
  function ic(basis) { return [O9(basis[0]), O9(basis[1]), O9(basis[2])]; }
  const ad = { x: 0, y: 1, z: 0 };
  const VC = { x: 0, y: m(-58.80000305175781), z: 0 };
  const qC = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  const ${release.slice(mapStart, runtimeClassStart)}
  ${release.slice(runtimeClassStart, vehicleClassStart)}
  return class Original { ${release.slice(factoryStart, factoryEnd)} };
`)(Math.fround) as new () => {
  tuning: VehicleTuningForInitialization;
  createBody(): unknown;
  createWheelRuntime(): unknown;
  createRuntime(): Record<string, unknown>;
  createState(): unknown;
};

function snapshot(runtime: Record<string, unknown>) {
  const own = Object.fromEntries(Object.keys(runtime).map((key) => [key, runtime[key]]));
  const accessors = Object.getOwnPropertyNames(Object.getPrototypeOf(runtime))
    .filter((name) => name !== "constructor");
  return {
    own,
    accessors,
    values: Object.fromEntries(accessors.map((name) => [name, runtime[name]])),
  };
}

test("body, wheels, and presentation state match the release factories", () => {
  const original = new Original();
  assert.deepStrictEqual(createVehicleBody(), original.createBody());
  assert.deepStrictEqual(createVehicleWheelRuntime(), original.createWheelRuntime());
  assert.deepStrictEqual(createVehicleState(), original.createState());

  const first = createVehicleWheelRuntime();
  const second = createVehicleWheelRuntime();
  first.normals[0]!.x = 12;
  assert.equal(first.normals[1]!.x, 0);
  assert.equal(second.normals[0]!.x, 0);
});

test("runtime storage and all initial accessor values match across tuning variants", () => {
  const tunings: VehicleTuningForInitialization[] = [
    { forwardAccel: 60.25, dragFactor: 0.122, chargerEnabled: true, speedSlotCapacity: 2, mass: 125.27 },
    {
      forwardAccel: -0.005, dragFactor: 4.33333,
      suspensionSpring: 15.123456789, suspensionPositiveDamping: -0.322222222,
      suspensionNegativeDamping: 0, chargerEnabled: false, speedSlotCapacity: 5, mass: 0.125,
    },
    { forwardAccel: 0, dragFactor: 0, chargerEnabled: false, speedSlotCapacity: 0, mass: 0 },
  ];
  for (const tuning of tunings) {
    const original = new Original();
    original.tuning = tuning;
    const released = original.createRuntime();
    const rewritten = createVehicleRuntime({ tuning });
    assert.deepStrictEqual(snapshot(rewritten as unknown as Record<string, unknown>), snapshot(released));
  }
});

test("runtime accessors retain the release typed-array indices and coercion", () => {
  const tuning = {
    forwardAccel: 45, dragFactor: 0.2, chargerEnabled: true, speedSlotCapacity: 3, mass: 83,
  };
  const original = new Original();
  original.tuning = tuning;
  const released = original.createRuntime();
  const rewritten = createVehicleRuntime({ tuning }) as unknown as Record<string, unknown>;
  const names = snapshot(released).accessors;
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i]!;
    const value = typeof released[name] === "boolean" ? true : i + 0.125;
    released[name] = value;
    rewritten[name] = value;
    assert.deepStrictEqual(rewritten.numbers, released.numbers, `number slot for ${name}`);
    assert.deepStrictEqual(rewritten.flags, released.flags, `flag slot for ${name}`);
    assert.deepStrictEqual(rewritten[name], released[name], `getter for ${name}`);
    if (typeof value === "boolean") {
      released[name] = false;
      rewritten[name] = false;
    }
  }
});

test("runtime vectors, scales, arrays, and separate instances retain reference independence", () => {
  const tuning = {
    forwardAccel: 45, dragFactor: 0.2, chargerEnabled: true, speedSlotCapacity: 3, mass: 83,
  };
  const original = new Original();
  original.tuning = tuning;
  const released = original.createRuntime();
  const rewritten = createVehicleRuntime({ tuning }) as unknown as Record<string, unknown>;
  const referenceFields = [
    "numbers", "flags", "teamGaugeQueue", "speedSlots", "speedSlotDisabled", "gravity",
    "specialNormal", "railPoint", "railRelativeOrientation", "stagedExternalForce",
    "stagedExternalTorque", "integrationExtraForce", "visualScaleA", "eventScalePrimary",
    "eventScaleSecondary", "eventScaleTarget", "eventScaleStart",
  ];
  for (const left of referenceFields) {
    for (const right of referenceFields) {
      assert.equal(rewritten[left] === rewritten[right], released[left] === released[right], `${left}/${right}`);
    }
  }
  const second = createVehicleRuntime({ tuning });
  assert.notStrictEqual(second.numbers, rewritten.numbers);
  assert.notStrictEqual(second.flags, rewritten.flags);
  assert.notStrictEqual(second.eventScalePrimary, rewritten.eventScalePrimary);
  assert.notStrictEqual(second.railRelativeOrientation[0],
    (rewritten.railRelativeOrientation as Array<object>)[0]);
});
