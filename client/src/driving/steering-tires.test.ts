import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applySteeringTireForces, type SteeringInput,
  type SteeringTireContext } from "./steering-tires";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  applySteeringAndTires(", classStart);
const methodEnd = release.indexOf("  applyRoadConsumers(", methodStart);
assert.ok(classStart > 0 && methodStart > classStart && methodEnd > methodStart);
const method = release.slice(methodStart, methodEnd);
const helpers = [
  release.slice(release.indexOf("function VG("), release.indexOf("function Ri(")),
  release.slice(release.indexOf("function c9("), release.indexOf("function bt(")),
  release.slice(release.indexOf("function t1("), release.indexOf("function dd(")),
  release.slice(release.indexOf("function Mt("), release.indexOf("function _n(")),
  release.slice(release.indexOf("function vi("), release.indexOf("function md(")),
].join("\n");
const constants = `const mi=m(0.5), NC=m(3.141592025756836), OC=[m(2),m(0.5)],
tc=[[120,0,0,1,0,0,1,1,1,1,1],[120,0,0,1,0,0,1,1,1,1,1],
[340,-1,-1,1,0,0,1,0.6,1,1,1],[120,0,0,1,0,0,1,0.85,1,1,1],
[180,0,0,0.5,0,0,1,0.6,1,1,1],[120,-2,-2,1,0,0,1,1,1,1,1]],
ud=m(0.0020000000949949026);`;
const OriginalSteering = new Function("m", `${helpers}\n${constants}\nreturn class OriginalSteering { ${method} };`)(
  Math.fround,
) as new () => { applySteeringAndTires(this: SteeringTireContext,
  seconds: number, input: SteeringInput, force: { x: number; y: number; z: number },
  torque: { x: number; y: number; z: number }): void };
const original = new OriginalSteering();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = SteeringTireContext & { calls: string[] };
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    tuning: {
      motorcycleType: 0, maxSteerDeg: 32, steerConstraint: 120,
      frontGripFactor: 1.2, rearGripFactor: 1.1,
      driftTrigFactor: 1.4, driftTrigTime: 0.2,
      driftSlipFactor: 0.8, driftLeanFactor: 0.3,
      steerLeanFactor: 0.2, cornerDrawFactor: 0.4,
    },
    runtime: {
      driveSteeringSuppressed: false,
      massGravityForce: 980, localForwardSpeed: 30, localRightSpeed: 3,
      steeringExponentialScale: 1, catchupSteeringScale: 1,
      steeringEnvelope: 0, steeringAngle: 0,
      oneSubstepDrift: false, activeDrift: false, triggerPhase: false,
      triggerTimer: 0, triggerRawSteer: 0, driftDecay: 0,
      driftTailLatch: false, driftGaugeWindow: false,
      driftGaugeElapsed: 0, pendingGauge: 0,
      driftLifecycleB50: 0, driftLifecycleB44: 0,
      physicsState: 0, stateRemainingMs: 0,
      tireTransient: 0.2, tireEnvelope: 0.3, tireEnvelopeRate: 0.1,
      roadTransient: 0, currentUpdateMs: 1000,
      motorcycleDriftTimestampMs: 0, motorcycleTransientTorque: 0,
      bodySpeed: 30, forwardOneShot: false,
    },
    body: {
      angularVelocity: vector(0, 0.3, 0), right: vector(1, 0, 0),
      forward: vector(0, 0, -1), up: vector(0, 1, 0),
    },
    wheels: {}, scratch: { v0: vector() },
    state: { motorcyclePresentation: 0 },
    speedRaceMode: { kind: "speed" },
    commitDriftGauge() { calls.push("commitDriftGauge"); },
  };
}

function snapshot(state: Scenario): unknown {
  return {
    calls: state.calls, tuning: state.tuning, runtime: state.runtime,
    body: state.body, wheels: state.wheels, scratch: state.scratch,
    state: state.state,
  };
}

function compare(label: string, edit: (state: Scenario) => void,
  input: SteeringInput = { rawSteer: 1, steeringInverted: false, forward: 1 }): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const expectedForce = vector(1, 2, 3), actualForce = vector(1, 2, 3);
  const expectedTorque = vector(4, 5, 6), actualTorque = vector(4, 5, 6);
  original.applySteeringAndTires.call(expected, 0.002, input, expectedForce, expectedTorque);
  applySteeringTireForces(actual, 0.002, input, actualForce, actualTorque);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
  assert.deepEqual(actualForce, expectedForce, `${label}: force`);
  assert.deepEqual(actualTorque, expectedTorque, `${label}: torque`);
}

const surface = (value: string) => ({ road: { attributes: [{ name: "surface", value }] } });

test("normal, low speed and road-surface tire forces match release", () => {
  compare("normal road", () => {});
  compare("steering suppressed", (state) => { state.runtime.driveSteeringSuppressed = true; });
  compare("slow", (state) => { state.runtime.localForwardSpeed = 2; });
  compare("near stop", (state) => { state.runtime.localForwardSpeed = 0.1; });
  compare("reverse", (state) => { state.runtime.localForwardSpeed = -20; });
  compare("dirt", (state) => { state.wheels.roadDescriptor = surface("dirt"); });
  compare("slip", (state) => { state.wheels.roadDescriptor = surface("slip"); });
  compare("dirt one shot", (state) => {
    state.wheels.roadDescriptor = surface("dirt");
    state.runtime.forwardOneShot = true;
    state.runtime.localRightSpeed = 50;
  });
});

test("trigger, drift, motorcycle and gauge transitions match release", () => {
  compare("trigger begins", (state) => { state.runtime.triggerPhase = true; });
  compare("trigger expires", (state) => {
    state.runtime.triggerPhase = true;
    state.runtime.triggerTimer = 0.001;
  });
  compare("drift", (state) => { state.runtime.activeDrift = true; });
  compare("dirt drift", (state) => {
    state.runtime.activeDrift = true;
    state.wheels.roadDescriptor = surface("dirt");
  });
  compare("dirt decay", (state) => {
    state.runtime.driftDecay = 0.3;
    state.wheels.roadDescriptor = surface("dirt");
  });
  compare("slip drift", (state) => {
    state.runtime.activeDrift = true;
    state.wheels.roadDescriptor = surface("slip");
  });
  compare("motorcycle ordinary", (state) => { state.tuning.motorcycleType = 1; });
  compare("motorcycle trigger", (state) => {
    state.tuning.motorcycleType = 1; state.runtime.triggerPhase = true;
  });
  compare("motorcycle drift", (state) => {
    state.tuning.motorcycleType = 1; state.runtime.activeDrift = true;
  });
  compare("commit gauge", (state) => { state.runtime.driftGaugeWindow = true; });
  compare("drift tail", (state) => {
    state.runtime.oneSubstepDrift = true;
    state.runtime.driftTailLatch = true;
  });
});
