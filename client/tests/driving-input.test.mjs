import assert from "node:assert/strict";
import test from "node:test";
import { DrivingAction, DrivingInputAccumulator } from "../src/input/driving-input.ts";

test("forward/reverse, steering options and cancel update the physics snapshot", () => {
  const input = new DrivingInputAccumulator();
  input.dispatch([
    { action: DrivingAction.Forward, down: true },
    { action: DrivingAction.SteerLeft, down: true },
  ]);
  assert.equal(input.snapshot().forward, 1);
  assert.equal(input.snapshot().steer, 1);
  assert.equal(input.snapshot().actionMarkerWord & 1, 1);

  input.setForwardReverseSwap(true);
  input.setSteeringInverted(true);
  assert.equal(input.snapshot().reverse, 1);
  assert.equal(input.snapshot().steer, -1);

  input.cancel();
  assert.equal(input.snapshot().forward, 0);
  assert.equal(input.snapshot().reverse, 0);
  assert.equal(input.snapshot().rawSteer, 0);
});

test("drift starts once per hold when steering begins, then reports its release", () => {
  const input = new DrivingInputAccumulator();
  const effects = [];
  const report = (effect) => effects.push(effect);
  input.dispatch([{ action: DrivingAction.Drift, down: true }], report);
  input.dispatch([{ action: DrivingAction.SteerLeft, down: true }], report);
  input.dispatch([{ action: DrivingAction.SteerLeft, down: true }], report);
  input.dispatch([{ action: DrivingAction.Drift, down: false }], report);

  assert.deepEqual(effects.filter((effect) => effect.kind === "drift-start"), [
    { kind: "drift-start", direction: 1 },
  ]);
  assert.equal(input.getDriftEdgeMetadata().pressCount, 1);
  assert.equal(input.getDriftEdgeMetadata().released, true);
  assert.equal(input.snapshot().rawDriftHeld, false);
});

test("forward batch gate consumes one edge without applying it", () => {
  const input = new DrivingInputAccumulator();
  input.setForwardBatchGate(true);
  assert.equal(
    input.dispatch([
      { action: DrivingAction.Forward, down: true },
      { action: DrivingAction.SteerRight, down: true },
    ]),
    1,
  );
  assert.equal(input.snapshot().forward, 0);
  assert.equal(input.snapshot().steer, 0);
  assert.deepEqual(input.getForwardBatchState(), { gate: false, down: true });
  input.dispatch([{ action: DrivingAction.Forward, down: true }]);
  assert.equal(input.snapshot().forward, 1);
});
