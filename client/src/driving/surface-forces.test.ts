import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { applyAirborneForces, applySuspensionForce,
  type SurfaceForceContext } from "./surface-forces";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const suspensionStart = release.indexOf("  applySuspension(", classStart);
const airStart = release.indexOf("  applyAirState(", suspensionStart);
const end = release.indexOf("  applyLongitudinal(", airStart);
assert.ok(classStart > 0 && suspensionStart > classStart && airStart > suspensionStart && end > airStart);
const methods = release.slice(suspensionStart, end);
const helpers = release.slice(release.indexOf("function a1("), release.indexOf("function ai0("));
const OriginalForces = new Function("m", `${helpers}\nconst od = [[1,1],[-1,1],[1,-1],[-1,-1]];\nreturn class OriginalForces { ${methods} };`)(
  Math.fround,
) as new () => {
  applySuspension(this: SurfaceForceContext, seconds: number,
    force: { x: number; y: number; z: number }, torque: { x: number; y: number; z: number }): void;
  applyAirState(this: SurfaceForceContext,
    force: { x: number; y: number; z: number }, torque: { x: number; y: number; z: number }): void;
};
const original = new OriginalForces();
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });

function context(): SurfaceForceContext {
  return {
    body: {
      up: vector(0, 1, 0), right: vector(1, 0, 0),
      forward: vector(0, 0, -1), angularVelocity: vector(0.1, -0.2, 0.3),
    },
    wheels: {
      hit: [true, true, true, true],
      compression: [0.2, 0.15, 0.05, 0.1],
      compressionDelta: [0.001, -0.002, 0.003, -0.004],
      normals: [vector(0, 1, 0), vector(0, 1, 0),
        vector(0, 1, 0), vector(0, 1, 0)],
    },
    collisionShape: { rawHalfWidth: 0.75, rawHalfLength: 1.2 },
    tuning: { mass: 100 },
    runtime: {
      suspensionSpring: 3200, suspensionPositiveDamping: 30,
      suspensionNegativeDamping: 20, gravity: vector(0, -9.8, 0),
      gravityDivisor: 1, freeOrientationLatch: false, motionMode: 0,
    },
    scratch: {
      v0: vector(), v1: vector(), v2: vector(), v3: vector(),
      v4: vector(), v5: vector(), v6: vector(), v7: vector(),
    },
  };
}

function compareSuspension(label: string, edit: (state: SurfaceForceContext) => void): void {
  const expected = context(); edit(expected);
  const actual = structuredClone(expected);
  const expectedForce = vector(1, 2, 3);
  const actualForce = structuredClone(expectedForce);
  const expectedTorque = vector(4, 5, 6);
  const actualTorque = structuredClone(expectedTorque);
  original.applySuspension.call(expected, 0.002, expectedForce, expectedTorque);
  applySuspensionForce(actual, 0.002, actualForce, actualTorque);
  assert.deepEqual(actual, expected, `${label}: state and scratch`);
  assert.deepEqual(actualForce, expectedForce, `${label}: force`);
  assert.deepEqual(actualTorque, expectedTorque, `${label}: torque`);
}

test("four-wheel spring, damping, misses and tilted normals match release", () => {
  compareSuspension("four wheels", () => {});
  compareSuspension("missing wheels", (state) => {
    state.wheels.hit[1] = false; state.wheels.hit[3] = false;
  });
  compareSuspension("tilted wheels", (state) => {
    state.wheels.normals[0] = vector(0.4, 0.8, 0.2);
    state.wheels.normals[2] = vector(0, -1, 0);
  });
  compareSuspension("upside down", (state) => {
    state.body.up = vector(0.2, -0.9, 0.1);
  });
});

test("missing suspension producers throw the released error", () => {
  const expected = context(); expected.runtime.suspensionSpring = undefined;
  const actual = structuredClone(expected);
  assert.throws(() => original.applySuspension.call(expected, 0.002, vector(), vector()),
    /P3528 suspension/);
  assert.throws(() => applySuspensionForce(actual, 0.002, vector(), vector()),
    /P3528 suspension/);
});

test("air gravity, angular damping and orientation recovery match release", () => {
  const cases: Array<[string, (state: SurfaceForceContext) => void]> = [
    ["normal", () => {}],
    ["latched upside down", (state) => {
      state.runtime.freeOrientationLatch = true;
      state.body.up.y = 0.2; state.body.right.y = 0.5;
      state.body.forward.y = 0.8;
    }],
    ["mode 6 forward down", (state) => {
      state.runtime.motionMode = 6;
      state.body.up.y = -0.3; state.body.right.y = -0.2;
      state.body.forward.y = -0.8;
    }],
  ];
  for (const [label, edit] of cases) {
    const expected = context(); edit(expected);
    const actual = structuredClone(expected);
    const expectedForce = vector(1, 2, 3);
    const actualForce = structuredClone(expectedForce);
    const expectedTorque = vector(4, 5, 6);
    const actualTorque = structuredClone(expectedTorque);
    original.applyAirState.call(expected, expectedForce, expectedTorque);
    applyAirborneForces(actual, actualForce, actualTorque);
    assert.deepEqual(actual, expected, `${label}: state and scratch`);
    assert.deepEqual(actualForce, expectedForce, `${label}: force`);
    assert.deepEqual(actualTorque, expectedTorque, `${label}: torque`);
  }
});
