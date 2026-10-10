import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { snapshotVehicleDebugState, type VehicleDebugContext } from "./debug-state";
import { createVehicleRuntime } from "./initial-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  getDebugState()", classStart);
const end = release.indexOf("  settle(e, t)", start);
assert.ok(classStart >= 0 && start > classStart && end > start);
const Original = new Function(`function O9(value) { return { x: value.x, y: value.y, z: value.z }; }
function ic(matrix) { return [O9(matrix[0]), O9(matrix[1]), O9(matrix[2])]; }
return class Original { ${release.slice(start, end)} };`)() as new () => {
  getDebugState(this: VehicleDebugContext): ReturnType<typeof snapshotVehicleDebugState>;
};
const original = new Original();

function scenario(): VehicleDebugContext {
  const runtime = createVehicleRuntime({ tuning: {
    forwardAccel: 6, dragFactor: 0.4, chargerEnabled: true,
    speedSlotCapacity: 3, mass: 14,
  } });
  runtime.numbers.forEach((_, index) => { runtime.numbers[index] = index + 0.125; });
  runtime.flags.forEach((_, index) => { runtime.flags[index] = index % 2; });
  runtime.railConfig = { railId: "test", left: 2, mode: false };
  runtime.railFrame = [
    { x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 },
  ];
  runtime.railRelativeOrientation = [
    { x: 11, y: 12, z: 13 }, { x: 14, y: 15, z: 16 }, { x: 17, y: 18, z: 19 },
  ];
  runtime.visualScaleA = { x: 0.2, y: 0.3, z: 0.4 };
  runtime.eventScalePrimary = { x: 1.2, y: 1.3, z: 1.4 };
  runtime.eventScaleSecondary = { x: 2.2, y: 2.3, z: 2.4 };
  runtime.eventScaleTarget = { x: 3.2, y: 3.3, z: 3.4 };
  runtime.eventScaleStart = { x: 4.2, y: 4.3, z: 4.4 };
  return { runtime: runtime as VehicleDebugContext["runtime"] };
}

function compare(label: string, edit: (state: VehicleDebugContext) => void = () => {}): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  const released = original.getDebugState.call(expected);
  const rewritten = snapshotVehicleDebugState(actual);
  assert.deepEqual(rewritten, released, `${label}: values`);
  assert.deepEqual(Object.keys(rewritten), Object.keys(released), `${label}: ordered keys`);
  assert.notStrictEqual(rewritten.visualScaleA, actual.runtime.visualScaleA, `${label}: vector clone`);
  assert.notStrictEqual(rewritten.railRelativeOrientation, actual.runtime.railRelativeOrientation, `${label}: matrix clone`);
  if (actual.runtime.railConfig) assert.notStrictEqual(rewritten.railConfig, actual.runtime.railConfig, `${label}: config clone`);
  if (actual.runtime.railFrame) assert.notStrictEqual(rewritten.railFrame, actual.runtime.railFrame, `${label}: frame clone`);
}

test("debug snapshot copies every released runtime field and selected structures", () => {
  compare("populated runtime");
  compare("missing optional rail state", state => {
    state.runtime.railConfig = undefined;
    state.runtime.railFrame = undefined;
  });
});
