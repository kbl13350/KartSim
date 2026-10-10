import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { updateCameraRuntimeView, updateDriftVisualView, type VehiclePresentationContext } from "./presentation-view";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const helperSource = [
  ["function qt(", "function a1("],
  ["function L2(", "function ii0("],
  ["function V9(", "function d1("],
  ["function d1(", "function ri0("],
  ["function oi0(", "function fd("],
  ["function fd(", "function Tn("],
  ["function JC(", "function gd("],
  ["function gd(", "function vi("],
  ["function VG(", "function Ri("],
  ["function Mt(", "function _n("],
].map(([start, end]) => sourceBetween(start!, end!)).join("\n");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  driveCameraRuntime()", classStart);
const methodEnd = release.indexOf("  reset(e, t, i, r)", methodStart);
assert.ok(classStart >= 0 && methodStart > classStart && methodEnd > methodStart);
const methods = release.slice(methodStart, methodEnd);
const Original = new Function("m", "x5", `${helperSource}\nreturn class Original { ${methods} };`)(
  Math.fround, Math.fround(0.5),
) as new () => {
  driveCameraRuntime(this: Scenario): Scenario["cameraRuntimeView"];
  driftVisualRuntime(this: Scenario): Scenario["driftVisualView"];
};
const original = new Original();

type Scenario = VehiclePresentationContext & { calls: string[] };
const vec = (x: number, y: number, z: number) => ({ x, y, z });
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    body: {
      position: vec(23.7, 4.5, -8.2),
      right: vec(0.8, 0, 0.2),
      forward: vec(0.2, 0.1, 0.8),
      up: vec(0, 1, 0.1),
      linearVelocity: vec(3.6, 2.4, -1.8),
    },
    wheels: {
      grounded: true,
      averageNormal: vec(0.1, 0.9, 0.2),
      roadDescriptor: { road: { attributes: [{ name: "other", value: "x" }, { name: "surface", value: "dirt" }] } },
      compression: [1, 2, 0.12, 0.16],
      obstacleRayHit: true,
    },
    tuning: { motorcycleType: false },
    state: { drifting: true },
    runtime: {
      eventScaleSecondary: vec(1.2, 0.7, 0.8),
      physicsState: 2, motionMode: 3, instantAccelerationActive: true,
      mrContact: false, hwContact: true, tireTransient: 0.24,
      currentReverseSnapshot: 0.05, landingMotionTrigger: true,
      landingShockAudioStrength: 0.9, collisionMotionHit: true,
      collisionMotionStrength: 4, cachedDisplaySpeedKmh: 85.9,
      localForwardSpeed: 25, contactWorking: true, fullPhysicsBypass: false,
    },
    cameraRuntimeView: {
      wheelContact: false, averageWheelHitNormal: vec(0, 0, 0),
      eventScaleSecondary: vec(0, 0, 0), stateCode: 0,
      motionMode: 0, action8: false, mrContact: false, hwContact: false,
      motorcycleType: true, tireTransient: 0, effectiveReverseScalar: 0,
      landingMotionTrigger: false, landingShockAudioStrength: 0,
      collisionMotionHit: false, collisionMotionStrength: 0, visualScaleMode: 0,
    },
    driftVisualView: {
      active: false, contact: false, speedKmh: 0, forwardSpeed: 0,
      motionMode: 0, roadSurface: undefined, rearWheelCompression: [0, 0],
      wheelCompressionBaseline: 0, obstacleWheelHit: false,
      fullPhysicsBypass: false, position: vec(0, 0, 0), right: vec(0, 0, 0),
      forward: vec(0, 0, 0), up: vec(0, 0, 0),
      presentationRight: vec(0, 0, 0), presentationForward: vec(0, 0, 0),
      presentationUp: vec(0, 0, 0),
    },
    driftVisualScratch: vec(1, 2, 3),
    visualScaleMode() { calls.push("visualScaleMode"); return 2; },
  };
}

function compare(
  label: string,
  name: "driveCameraRuntime" | "driftVisualRuntime",
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  const expectedView = name === "driveCameraRuntime" ? expected.cameraRuntimeView : expected.driftVisualView;
  const actualView = name === "driveCameraRuntime" ? actual.cameraRuntimeView : actual.driftVisualView;
  const releasedResult = name === "driveCameraRuntime"
    ? original.driveCameraRuntime.call(expected)
    : original.driftVisualRuntime.call(expected);
  const migratedResult = name === "driveCameraRuntime" ? updateCameraRuntimeView(actual) : updateDriftVisualView(actual);
  assert.strictEqual(releasedResult, expectedView, `${label}: released view identity`);
  assert.strictEqual(migratedResult, actualView, `${label}: migrated view identity`);
  assert.deepEqual(migratedResult, releasedResult, `${label}: view`);
  assert.deepEqual(actual.driftVisualScratch, expected.driftVisualScratch, `${label}: scratch`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("camera view reuses the same vectors and fields as release", () => {
  compare("moving vehicle", "driveCameraRuntime");
  compare("airborne motorcycle", "driveCameraRuntime", state => {
    state.wheels.grounded = false;
    state.tuning.motorcycleType = true;
    state.runtime.eventScaleSecondary = vec(0.4, 2.4, 1.1);
  });
});

test("drift view preserves moving, stationary and missing-road branches", () => {
  compare("moving dirt road", "driftVisualRuntime");
  compare("stationary road", "driftVisualRuntime", state => { state.body.linearVelocity = vec(0, 0, 0); });
  compare("no descriptor", "driftVisualRuntime", state => { state.wheels.roadDescriptor = undefined; });
  compare("no surface attribute", "driftVisualRuntime", state => {
    state.wheels.roadDescriptor = { road: { attributes: [{ name: "other", value: "x" }] } };
  });
  compare("NaN velocity", "driftVisualRuntime", state => { state.body.linearVelocity.x = NaN; });
});
