import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { MotionClockMapping, RemoteMotionPredictor,
  type RemoteMotionSnapshot } from "./remote-motion";
import type { RailMatrix } from "../driving/rail-frame";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const sE = 4294967296;");
const end = source.indexOf("class Bi0 {", start);
assert.ok(start > 0 && end > start);
const original = new Function(`${source.slice(start, end)}\nreturn { BL, Gi0 };`)() as {
  BL: new (mapping: { offsetMs: number }) => MotionClockMapping;
  Gi0: new (mass: number, inertia: unknown) => RemoteMotionPredictor;
};

const inertia: RailMatrix = [
  { x: 1.3, y: 0.01, z: 0 },
  { x: 0.01, y: 1.4, z: 0.02 },
  { x: 0, y: 0.02, z: 1.5 },
];

function snapshot(changes: Partial<RemoteMotionSnapshot> = {}): RemoteMotionSnapshot {
  return {
    kind: "kinematic", flags: [1, 0],
    position: [5, 0, -2], quaternion: [1, 0, 0, 0],
    linearVelocity: [1.2, 0.1, -0.4], angularVelocity: [0.3, -0.2, 0.1],
    vector5C: [0.4, -0.2, 0.1], vector68: [0.02, 0.05, -0.03],
    collision: { active: true }, ...changes,
  };
}

function state(predictor: RemoteMotionPredictor) {
  return {
    snapshotTick: predictor.snapshotTick, previousTick: predictor.previousTick,
    eligible: predictor.eligible, futureTickInvalid: predictor.futureTickInvalid,
    snapshotAgeDisplay: predictor.snapshotAgeDisplay,
    position: predictor.position, velocity: predictor.velocity,
    angular: predictor.angular, rotation: predictor.rotation,
    collision: predictor.collisionState(), pose: predictor.copyPose(),
  };
}

test("motion clock wrap expansion and invalid inputs match release", () => {
  for (const offsetMs of [-500, 0, 90_000]) {
    const actual = new MotionClockMapping({ offsetMs });
    const released = new original.BL({ offsetMs });
    for (const local of [0, 100, 4_294_967_295, 4_294_967_400]) {
      let packet: number;
      try { packet = actual.encode(local); }
      catch (error) {
        assert.throws(() => released.encode(local),
          { message: (error as Error).message });
        continue;
      }
      assert.equal(packet, released.encode(local));
      for (const now of [local, local + 250, local + 4_294_967_296]) {
        assert.equal(actual.decode(packet, now), released.decode(packet, now));
      }
    }
  }
  for (const offsetMs of [Infinity, NaN]) {
    assert.throws(() => new MotionClockMapping({ offsetMs }),
      { message: "Invalid motion clock mapping" });
  }
});

test("remote snapshot acceptance, eligibility and tick ordering match release", () => {
  const actual = new RemoteMotionPredictor(2.5, structuredClone(inertia));
  const released = new original.Gi0(2.5, structuredClone(inertia));
  const first = snapshot();
  for (const predictor of [actual, released]) {
    assert.equal(predictor.receive(first, 1_000, 1_005), true);
    assert.equal(predictor.receive(first, 999, 1_010), false);
  }
  assert.deepEqual(state(actual), state(released));
  for (const [now, options] of [
    [1_000, { bypass: false, locked: false }],
    [1_012, { bypass: true, locked: false }],
    [1_015, { bypass: false, locked: true }],
    [6_050, { bypass: false, locked: false }],
  ] as const) {
    actual.update(now, options);
    released.update(now, options);
    assert.deepEqual(state(actual), state(released));
  }
  actual.clear(); released.clear();
  assert.deepEqual(state(actual), state(released));
});

test("remote force, torque and orientation prediction match release frames", () => {
  const actual = new RemoteMotionPredictor(2.5, structuredClone(inertia));
  const released = new original.Gi0(2.5, structuredClone(inertia));
  const first = snapshot({ quaternion: [0.9, 0.1, -0.1, 0.05] });
  actual.receive(first, 2_000, 2_004);
  released.receive(first, 2_000, 2_004);
  for (const now of [2_001, 2_010, 2_024, 2_050, 2_250, 2_261]) {
    actual.update(now, { bypass: false, locked: false });
    released.update(now, { bypass: false, locked: false });
    assert.deepEqual(state(actual), state(released), `at ${now}`);
  }
});

test("remote validation errors and non-kinematic snapshots match release", () => {
  function compareOperation(operation: (predictor: RemoteMotionPredictor) => unknown) {
    const make = (Original: typeof RemoteMotionPredictor) => {
      const predictor = new Original(2.5, structuredClone(inertia));
      try { return { value: operation(predictor), state: state(predictor) }; }
      catch (error) { return { error: (error as Error).message, state: state(predictor) }; }
    };
    assert.deepEqual(make(RemoteMotionPredictor), make(original.Gi0));
  }
  compareOperation(predictor => predictor.receive(snapshot(), 0, 1_000));
  compareOperation(predictor => predictor.receive(snapshot({ quaternion: [0, 0, 0, 0] }), 1_000, 1_001));
  compareOperation(predictor => predictor.receive(snapshot({ kind: "legacy", flags: [1, 1] }), 1_000, 1_001));
  compareOperation(predictor => predictor.receive(snapshot({ kind: "legacy", flags: [1, 0] }), 1_000, 1_001));
  compareOperation(predictor => predictor.update(-1, { bypass: false, locked: false }));
});
