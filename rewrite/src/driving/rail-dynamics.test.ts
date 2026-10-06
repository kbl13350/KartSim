import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyVehicleRailDynamics,
  type RailDrivingInput,
  type RailDynamicsContext,
} from "./rail-dynamics";
import type { RailFrameTrack } from "./rail-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  applyFull3DRail(", classStart);
const end = release.indexOf("  returnToStandard(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function O9("), release.indexOf("function Mt(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const Original = new Function("m", `${helpers}
const NC=m(3.141592025756836), X40=F4(1062380241),Y40=F4(1058398929),
$C=F4(1064666457),WC=F4(3204993777),HC=F4(1065533027),
Z40=F4(1063930709),Q40=F4(1059516753);
return class Original { ${method} };`)(Math.fround) as new () => {
  applyFull3DRail(this: RailDynamicsContext, seconds: number, input: RailDrivingInput,
    track: RailFrameTrack, force: Vector, torque: Vector): void;
};
const original = new Original();
type Vector = { x: number; y: number; z: number };
const vector = (x = 0, y = 0, z = 0): Vector => ({ x, y, z });
type Scenario = RailDynamicsContext & { calls: string[]; frameAccepted: boolean };

function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    frameAccepted: true,
    body: {
      position: vector(1.4, 0.5, 7.3),
      up: vector(0, 1, 0),
      forward: vector(0, 0, 1),
      linearVelocity: vector(0.5, 0.1, 14),
      angularVelocity: vector(0.02, -0.3, 0.08),
    },
    runtime: {
      railBadGeometryTimer: 0,
      railResetRequest: false,
      railPoint: vector(1.5, 0.8, 8.3),
      railFrame: [vector(1, 0, 0), vector(0, 1, 0), vector(0, 0, 1)],
      railConfig: { minVelocity: 8, maxVelocity: 30, accelFactor: 0.4, gravityFactor: 0.3 },
      motionMode: 3,
      raceMotionLocked: false,
      pressProtected1C0: false,
      physicsState: 0,
      animationSlot: 0,
      liveForwardAccel: 700,
      railScalar0: 0.2,
      railScalar1: 0.01,
      railScalar2: 0.04,
      driftGaugeWindow: false,
      driftGaugeElapsed: 0.2,
      pendingGauge: 0.7,
      railEntryTimerA: 0.01,
      railEntryTimerB: 0.01,
      railEntryMarker: 0,
      localForwardSpeed: 20,
      localRightSpeed: 1,
      localUpSpeed: 0.2,
      railRelativeOrientation: [vector(1, 0, 0), vector(0, 1, 0), vector(0, 0, 1)],
      gravity: vector(0, -9.8, 0),
    },
    tuning: {
      useTransformBooster: false,
      transAccelFactor: 1.8,
      boostAccelFactor: 1.4,
      gripBrake: 0.6,
      maxSteerDeg: 28,
      mass: 140,
    },
    requestMotionMode(lift, mode) { calls.push(`mode:${lift}/${mode}`); },
    produceRailFrame(seconds) { calls.push(`frame:${seconds}`); return this.frameAccepted; },
    commitDriftGauge() { calls.push("commit"); },
  };
}

function compare(
  label: string,
  input: RailDrivingInput,
  edit: (state: Scenario) => void = () => {},
  seconds = 0.016,
): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  const expectedForce = vector(1, 2, 3), actualForce = vector(1, 2, 3);
  const expectedTorque = vector(4, 5, 6), actualTorque = vector(4, 5, 6);
  let expectedError: unknown, actualError: unknown;
  try { original.applyFull3DRail.call(expected, seconds, input, {}, expectedForce, expectedTorque); }
  catch (error) { expectedError = error; }
  try { applyVehicleRailDynamics(actual, seconds, input, {}, actualForce, actualTorque); }
  catch (error) { actualError = error; }
  assert.equal((actualError as Error | undefined)?.message, (expectedError as Error | undefined)?.message,
    `${label}: error`);
  assert.deepEqual(actual.body, expected.body, `${label}: body`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actualForce, expectedForce, `${label}: force`);
  assert.deepEqual(actualTorque, expectedTorque, `${label}: torque`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("rail frame and config guards match release", () => {
  compare("frame rejected", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.frameAccepted = false; });
  compare("initial frame absent", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.frameAccepted = false; state.runtime.railFrame = undefined; });
  compare("config absent", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.runtime.railConfig = undefined; });
});

test("captured rail propulsion, braking, boost and gravity match release", () => {
  compare("drive", { forward: 1, reverse: 0, steer: 0.2 });
  compare("reverse brake", { forward: 0, reverse: 1, steer: 0.2 });
  compare("neutral", { forward: 0, reverse: 0, steer: -0.7 });
  compare("boost", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.runtime.physicsState = 3; });
  compare("transform boost", { forward: 1, reverse: 0, steer: 0.2 }, state => {
    state.runtime.physicsState = 3;
    state.runtime.animationSlot = 4;
    state.tuning.useTransformBooster = true;
  });
  compare("race lock", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.runtime.raceMotionLocked = true; });
  compare("press protection", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.runtime.pressProtected1C0 = true; });
  compare("velocity max", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.body.linearVelocity = vector(1, 0, 40); });
  compare("velocity min", { forward: 1, reverse: 0, steer: 0.2 },
    state => { state.body.linearVelocity = vector(1, 0, 2); });
});

test("rail entry transitions and scalar recovery match release", () => {
  compare("entry ready", { forward: 1, reverse: 0, steer: 0.5 },
    state => { state.runtime.motionMode = 2; }, 0.02);
  compare("entry sideslip", { forward: 1, reverse: 0, steer: 0.5 }, state => {
    state.runtime.motionMode = 2;
    state.runtime.localRightSpeed = 10;
  });
  compare("scalar pull", { forward: 1, reverse: 0, steer: 0.2 }, state => {
    state.runtime.railScalar2 = -0.1;
  });
  compare("scalar reset", { forward: 1, reverse: 0, steer: 0.2 }, state => {
    state.runtime.railScalar0 = -0.4;
  });
  compare("zero direction fallback", { forward: 1, reverse: 0, steer: 0.2 }, state => {
    state.runtime.railPoint = vector(1.4, 0.3, 7.3);
  });
});
