import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyLongitudinalForce, applyVelocityDrag, integrateVehicleVelocity,
  type ContinuousMotionContext, type Vector3,
} from "./continuous-motion";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");

function between(start: string, end: string, from = 0): string {
  const first = release.indexOf(start, from);
  const last = release.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `release source span ${start}`);
  return release.slice(first, last);
}

const classStart = release.indexOf("class AL {");
assert.ok(classStart > 0);
const sourceMethods = [
  between("  applyLongitudinal(", "  applySteeringAndTires(", classStart),
  between("  applyDrag(", "  integrateVelocity(", classStart),
  between("  integrateVelocity(", "  accumulateDriftGauge(", classStart),
];
const releaseHelpers = [
  between("function VG(", "function Ri("),
  between("function qt(", "function ai0("),
  between("function Mt(", "function _n("),
  between("function JC(", "function vi("),
].join("\n");
const OriginalStages = new Function("m", `${releaseHelpers}\nreturn class OriginalStages {
  ${sourceMethods.join("\n")}
};`)(Math.fround) as new () => {
  applyLongitudinal(this: ContinuousMotionContext, seconds: number,
    input: { forward: number; reverse: number }, force: Vector3): void;
  applyDrag(this: ContinuousMotionContext, force: Vector3,
    torque: Vector3, full3DRail: boolean): void;
  integrateVelocity(this: ContinuousMotionContext, seconds: number,
    force: Vector3, torque: Vector3, extraForce: Vector3): void;
};
const original = new OriginalStages();

const vector = (x = 0, y = 0, z = 0): Vector3 => ({ x, y, z });

function context(): ContinuousMotionContext {
  return {
    body: {
      linearVelocity: vector(4.5, 0.2, -2.25),
      angularVelocity: vector(0.5, -0.25, 0.125),
      forward: vector(1, 0, 0), right: vector(0, 0, -1), up: vector(0, 1, 0),
    },
    wheels: {
      grounded: true, averageNormal: vector(0, 1, 0),
      roadDescriptor: { road: { attributes: [{ name: "surface", value: "normal" }] } },
    },
    tuning: {
      backwardAccel: 1725, boostAccelFactor: 1.5,
      driftBoostMulAccelFactor: 1.25, driftEscapeForce: 3200,
      dualMulAccelFactor: 1.1, gripBrake: 2070, instAccelFactor: 1.25,
      mass: 100, slipBrake: 1415, startForwardAccelSpeed: 3700,
      transAccelFactor: 1.8, useTransformBooster: 1,
      wallCollGaugeMinVelBound: 200, airFriction: 3,
    },
    runtime: {
      localForwardSpeed: 4.5, localRightSpeed: 0.2,
      hwContact: false, specialNormal: vector(1, 0, 0),
      raceMotionLocked: false, pressProtected1C0: false,
      liveForwardAccel: 2300, liveDragFactor: 0.66, driveScale: 1,
      dragScale: 1, catchupDragScale: 1, physicsState: 0,
      animationSlot: 0, draftAccelerationScale: 1,
      instantAccelerationActive: false, cachedDisplaySpeedKmh: 100,
      oneSubstepDrift: false, activeDrift: false, bodySpeed: 5,
      massGravityForce: 980, reverseAccumulator: 0,
    },
    scratch: { v0: vector(), v1: vector(), v2: vector(), v3: vector() },
  };
}

function compareLongitudinal(label: string, edit: (state: ContinuousMotionContext) => void,
  input = { forward: 1, reverse: 0 }): void {
  const expected = context(); edit(expected);
  const actual = structuredClone(expected);
  const expectedForce = vector(4, 5, 6);
  const actualForce = structuredClone(expectedForce);
  original.applyLongitudinal.call(expected, 0.002, input, expectedForce);
  applyLongitudinalForce(actual, 0.002, input, actualForce);
  assert.deepEqual(actual, expected, `${label}: state`);
  assert.deepEqual(actualForce, expectedForce, `${label}: force`);
}

test("longitudinal drive, boost, drift, reverse and brake stages match AL", () => {
  compareLongitudinal("cruise", () => {});
  compareLongitudinal("start", (state) => { state.runtime.physicsState = 1; });
  compareLongitudinal("transform boost", (state) => {
    state.runtime.physicsState = 4; state.runtime.animationSlot = 4;
    state.runtime.draftAccelerationScale = 1.2;
  });
  compareLongitudinal("drift boost", (state) => {
    state.runtime.physicsState = 2; state.runtime.oneSubstepDrift = true;
  });
  compareLongitudinal("dual instant boost", (state) => {
    state.runtime.physicsState = 10; state.runtime.instantAccelerationActive = true;
    state.runtime.cachedDisplaySpeedKmh = 70;
    state.giant = { forceBonus: 40 };
  });
  compareLongitudinal("reverse recovery", (state) => {
    state.runtime.localForwardSpeed = -2;
    state.runtime.activeDrift = true;
  });
  compareLongitudinal("reverse entry", (state) => {
    state.runtime.localForwardSpeed = 0.2;
  }, { forward: 0, reverse: 1 });
  compareLongitudinal("reverse drive", (state) => {
    state.runtime.localForwardSpeed = -2;
  }, { forward: 0, reverse: 1 });
  compareLongitudinal("locked controls", (state) => {
    state.runtime.raceMotionLocked = true;
  });
  compareLongitudinal("brake at speed", (state) => {
    state.runtime.localForwardSpeed = 12;
    state.runtime.localRightSpeed = 3;
  }, { forward: 0, reverse: 1 });
  compareLongitudinal("hover contact", (state) => {
    state.runtime.hwContact = true; state.wheels.grounded = false;
  });
});

test("air, road and full-3D drag stages match AL", () => {
  for (const [label, edit, rail] of [
    ["grounded", () => {}, false],
    ["airborne", (state: ContinuousMotionContext) => { state.wheels.grounded = false; }, false],
    ["rail", (state: ContinuousMotionContext) => { state.wheels.grounded = false; }, true],
    ["DF road", (state: ContinuousMotionContext) => {
      state.wheels.roadDescriptor!.road.attributes[0]!.value = "DF3.5";
    }, false],
  ] as const) {
    const expected = context(); edit(expected);
    const actual = structuredClone(expected);
    const expectedForce = vector(10, -2, 0.5);
    const actualForce = structuredClone(expectedForce);
    const expectedTorque = vector(0.3, 0.4, 0.5);
    const actualTorque = structuredClone(expectedTorque);
    original.applyDrag.call(expected, expectedForce, expectedTorque, rail);
    applyVelocityDrag(actual, actualForce, actualTorque, rail);
    assert.deepEqual(actual, expected, `${label}: state`);
    assert.deepEqual(actualForce, expectedForce, `${label}: force`);
    assert.deepEqual(actualTorque, expectedTorque, `${label}: torque`);
  }
});

test("linear and angular velocity integration matches AL", () => {
  for (const extra of [vector(1, 2, 3), vector(-200, 15, 88), vector(Number.NaN, 0, 0)]) {
    const expected = context();
    const actual = structuredClone(expected);
    const expectedForce = vector(100, -30, 42);
    const actualForce = structuredClone(expectedForce);
    const expectedTorque = vector(0.3, 8, -3);
    const actualTorque = structuredClone(expectedTorque);
    original.integrateVelocity.call(expected, 0.002, expectedForce, expectedTorque, extra);
    integrateVehicleVelocity(actual, 0.002, actualForce, actualTorque, extra);
    assert.deepEqual(actual, expected);
    assert.deepEqual(actualForce, expectedForce);
    assert.deepEqual(actualTorque, expectedTorque);
  }
});
