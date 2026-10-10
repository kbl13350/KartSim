import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  createVehicleBody,
  createVehicleRuntime,
  createVehicleState,
  createVehicleWheelRuntime,
} from "./initial-state";
import {
  beginVehicleReset,
  placeVehicleAtCheckpoint,
  prepareVehicleLowHeightReset,
  resetVehicle,
  resetVehicleFromRoute,
  settleVehicle,
  warpVehiclePosition,
  type VehicleResetContext,
} from "./reset-runtime";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const helperSource = [
  ["function ei0(", "function ti0("],
  ["function O9(", "function qt("],
  ["function a1(", "function hd("],
  ["function Tn(", "function XC("],
  ["function ai0(", "function ZC("],
  ["function ZC(", "function bL("],
  ["function hl(", "function ML("],
].map(([start, end]) => sourceBetween(start!, end!)).join("\n");
const methods = [
  sourceBetween("  reset(e, t, i, r) {", "  handleDrivingCommand("),
  sourceBetween("  beginResetInitiation(e) {", "  restoreResetInteraction()"),
  sourceBetween("  settle(e, t) {", "  lteDodgeAvailable()"),
].join("\n");
const neutralInput = {
  forward: 0, reverse: 0, steer: 0, rawSteer: 0,
  steeringInverted: false, rawDriftHeld: false, derivedDriftHeld: false,
  actionMarkerWord: 0,
};
const Original = new Function("m", "W40", `${helperSource}\nreturn class Original { ${methods} };`)(
  Math.fround, neutralInput,
) as new () => {
  reset(this: Scenario, x: number, y: number, z: number, heading: number): void;
  resetFromRouteFrame(this: Scenario, frame: { position: Vector3; forward: Vector3 }): void;
  beginResetInitiation(this: Scenario, immediate: boolean): boolean;
  prepareLowHeightResetPose(this: Scenario): void;
  completeCheckpointPose(this: Scenario, frame: { position: Vector3; forward: Vector3; up: Vector3 }, clearMotion: boolean): void;
  warpPosition(this: Scenario, position: Vector3): void;
  settle(this: Scenario, seconds: number, track: unknown): void;
};
const original = new Original();
type Vector3 = { x: number; y: number; z: number };
type Scenario = VehicleResetContext & { calls: string[] };
const vec = (x: number, y: number, z: number): Vector3 => ({ x, y, z });
const initTuning = {
  forwardAccel: 8, dragFactor: 0.4, chargerEnabled: false,
  speedSlotCapacity: 3, mass: 14,
};

function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  const runtime = createVehicleRuntime({ tuning: initTuning });
  runtime.wallCollisionAnchorMs = 3333;
  runtime.committedGauge = 4;
  runtime.currentUpdateMs = 1720;
  runtime.driftGaugeWindow = true;
  runtime.resetRefillInitial = 0.25;
  runtime.resetRefillRemaining = 0.75;
  return {
    calls,
    body: {
      ...createVehicleBody(),
      position: vec(2, 3, 4),
      linearVelocity: vec(7, 8, 9),
      angularVelocity: vec(1, 2, 3),
    },
    state: { ...createVehicleState(), stale: true },
    wheels: { ...createVehicleWheelRuntime(), stale: true },
    runtime,
    scratch: { force: vec(1, -2, 3), torque: vec(4, 5, -6) },
    trackEventEffectRequests: ["old"],
    nitroSeamlessRequest: true,
    checkClientFramerate: true,
    clock: { reset(check) { calls.push(`clock.reset:${check}`); } },
    tuning: { wallCollGaugeCooldownTime: 4200, driftMaxGauge: 100 },
    createBody() { calls.push("createBody"); return createVehicleBody(); },
    createState() { calls.push("createState"); return createVehicleState(); },
    createWheelRuntime() { calls.push("createWheelRuntime"); return createVehicleWheelRuntime(); },
    createRuntime() { calls.push("createRuntime"); return createVehicleRuntime({ tuning: initTuning }); },
    syncPresentationFields() { calls.push("syncPresentationFields"); },
    reset(x, y, z, heading) {
      calls.push("reset");
      return released ? original.reset.call(this, x, y, z, heading) : resetVehicle(this, x, y, z, heading);
    },
    clearResetGaugeRefill() {
      calls.push("clearResetGaugeRefill");
      this.runtime.resetRefillInitial = 0;
      this.runtime.resetRefillRemaining = 0;
      this.runtime.resetRefillAnchorMs = 0;
    },
    commitDriftGauge() { calls.push("commitDriftGauge"); this.runtime.committedGauge = 5; },
    stepSubstep(seconds, input, track) { calls.push(`stepSubstep:${seconds}:${input === neutralInput}:${track === trackMarker}`); },
    updateCachedDisplaySpeed() { calls.push("updateCachedDisplaySpeed"); },
  };
}
const trackMarker = {};
const route = {
  position: vec(12.25, 0.7, -48.12),
  forward: vec(0.1, 0.3, -0.9),
  up: vec(0, 1, 0),
};

function compare(
  label: string,
  releasedCall: (vehicle: Scenario) => unknown,
  migratedCall: (vehicle: Scenario) => unknown,
  edit: (vehicle: Scenario) => void = () => {},
): void {
  const expected = scenario(true), actual = scenario(false);
  edit(expected); edit(actual);
  const body = actual.body, state = actual.state, wheels = actual.wheels;
  assert.deepEqual(migratedCall(actual), releasedCall(expected), `${label}: result`);
  assert.deepEqual(actual.body, expected.body, `${label}: body`);
  assert.deepEqual(actual.state, expected.state, `${label}: state`);
  assert.deepEqual(actual.wheels, expected.wheels, `${label}: wheels`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.scratch, expected.scratch, `${label}: scratch`);
  assert.deepEqual(actual.trackEventEffectRequests, expected.trackEventEffectRequests, `${label}: event requests`);
  assert.equal(actual.nitroSeamlessRequest, expected.nitroSeamlessRequest, `${label}: nitro request`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
  assert.strictEqual(actual.body, body, `${label}: body identity`);
  assert.strictEqual(actual.state, state, `${label}: state identity`);
  assert.strictEqual(actual.wheels, wheels, `${label}: wheels identity`);
}

test("reset reuses public state objects and preserves release call order", () => {
  compare("ordinary reset", vehicle => original.reset.call(vehicle, 8, 9, 10, Math.PI / 7),
    vehicle => resetVehicle(vehicle, 8, 9, 10, Math.PI / 7));
  compare("route frame", vehicle => original.resetFromRouteFrame.call(vehicle, route),
    vehicle => resetVehicleFromRoute(vehicle, route));
  compare("degenerate route forward", vehicle => original.resetFromRouteFrame.call(vehicle, { ...route, forward: vec(0, 0, 0) }),
    vehicle => resetVehicleFromRoute(vehicle, { ...route, forward: vec(0, 0, 0) }));
});

test("reset initiation branches match release refund and interaction state", () => {
  const call = (label: string, immediate: boolean, edit?: (vehicle: Scenario) => void) => compare(label,
    vehicle => original.beginResetInitiation.call(vehicle, immediate),
    vehicle => beginVehicleReset(vehicle, immediate), edit);
  call("ordinary refund", false);
  call("immediate clears refund", true);
  call("duplicate immediate", true, vehicle => { vehicle.runtime.fullPhysicsBypass = true; });
  call("zero cooldown", false, vehicle => { vehicle.tuning.wallCollGaugeCooldownTime = 0; });
  call("full gauge", false, vehicle => {
    vehicle.runtime.committedGauge = 100; vehicle.runtime.driftGaugeWindow = false;
  });
  call("no drift commit", false, vehicle => { vehicle.runtime.driftGaugeWindow = false; });
});

test("checkpoint pose, low-height recovery and warp copy vectors like release", () => {
  compare("low height", vehicle => original.prepareLowHeightResetPose.call(vehicle),
    prepareVehicleLowHeightReset);
  compare("checkpoint retains motion", vehicle => original.completeCheckpointPose.call(vehicle, route, false),
    vehicle => placeVehicleAtCheckpoint(vehicle, route, false));
  compare("checkpoint clears motion", vehicle => original.completeCheckpointPose.call(vehicle, route, true),
    vehicle => placeVehicleAtCheckpoint(vehicle, route, true));
  compare("warp", vehicle => original.warpPosition.call(vehicle, route.position),
    vehicle => warpVehiclePosition(vehicle, route.position));
});

test("settle runs one neutral substep then updates speed and presentation", () => {
  compare("settle", vehicle => original.settle.call(vehicle, 0.016, trackMarker),
    vehicle => settleVehicle(vehicle, 0.016, trackMarker, neutralInput));
});
