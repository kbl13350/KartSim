import assert from "node:assert/strict";
import test from "node:test";
import { captureVehicleRail, type RailCaptureContext } from "./rail-capture";
import { applyVehicleRailDynamics, type RailDynamicsContext } from "./rail-dynamics";
import { handleVehicleDrivingCommand, type DrivingCommandContext } from "./vehicle-commands";
import { updateDriftWindows, type DriftGaugeContext } from "./drift-gauge";
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
function scenario() {
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
    requestMotionMode(lift: boolean, mode: number) { calls.push(`mode:${lift}/${mode}`); },
    produceRailFrame(seconds: number) { calls.push(`frame:${seconds}`); return this.frameAccepted; },
    commitDriftGauge() { calls.push("commit"); },
  };
}

function vehicle(drifting = true) {
  const base = scenario();
  return Object.assign(base, {
    wheels: { grounded: true, railContactDescriptor: { road: { attributes: [{ name: "rail", value: "test" }] } } },
    runtime: Object.assign(base.runtime, {
      motionMode: 1, railCaptureTimeout: 1, railCaptureDelay: -1, bodySpeed: 20,
      activeDrift: drifting, oneSubstepDrift: false, driftTailLatch: drifting,
      driftGaugeWindow: drifting, driftLifecycleB50: 0, driftLifecycleB44: 0,
      stateRemainingMs: 0, triggerPhase: drifting, delayedDriftRequest: false,
      forwardOneShot: false, driftDecay: 0, contactWorking: true,
      instantGauge: 0, instantAccelerationActive: false,
    }),
    tuning: Object.assign(base.tuning, { driftTrigTime: 0.2, driftBoostTick: 500,
      instAccelGaugeLength: 0, instAccelGaugeMinUsable: 1 }),
    state: { boostTime: 0, driftDirection: 1 },
    stopDrift() { this.runtime.activeDrift = false; },
    startNormalBooster() { return false; }, armDualBooster() {}, reorderSpeedSlots() { return false; },
  }) as unknown as RailCaptureContext & RailDynamicsContext & DrivingCommandContext & DriftGaugeContext;
}
function capture(v: ReturnType<typeof vehicle>) {
  captureVehicleRail(v, 0.002, {
    rayQuery: () => undefined,
    sampleRoute: () => ({ sampled: true, point: v.body.position }),
    railCaptureDistance: () => 10,
    lookupRailConfig: () => ({ minVelocity: 8, maxVelocity: 100, accelFactor: 1, gravityFactor: 0 }),
  });
  assert.equal(v.runtime.motionMode, 2);
}
function align(v: ReturnType<typeof vehicle>) {
  for (let i = 0; i < 150 && v.runtime.motionMode === 2; i++)
    applyVehicleRailDynamics(v, 0.002, { forward: 1, reverse: 0, steer: 0 }, {}, vector(), vector());
  assert.equal(v.runtime.motionMode, 3);
}
const press = (v: ReturnType<typeof vehicle>) => handleVehicleDrivingCommand(v, { kind: "forward-down" }, { forward: 1 });

test("drift before capture earns one usable boost after rail alignment", () => {
  const v = vehicle(); capture(v);
  handleVehicleDrivingCommand(v, { kind: "drift-stop" }, { forward: 1 });
  assert.equal(v.runtime.driftLifecycleB50, 0);
  align(v);
  assert.equal(v.runtime.driftLifecycleB50, 0.5);
  const normal = vector(), boosted = vector();
  applyVehicleRailDynamics(v, 0.002, { forward: 1, reverse: 0, steer: 0 }, {}, normal, vector());
  press(v);
  assert.equal(v.runtime.physicsState, 2);
  assert.equal(v.runtime.driftLifecycleB50, 0);
  applyVehicleRailDynamics(v, 0.002, { forward: 1, reverse: 0, steer: 0 }, {}, boosted, vector());
  assert.ok(Math.hypot(boosted.x, boosted.y, boosted.z) > Math.hypot(normal.x, normal.y, normal.z));
  updateDriftWindows(v, 0.6); press(v);
  assert.equal(v.runtime.physicsState, 0, "cannot reuse consumed boost");
});

test("straight entry and drift keys first pressed on rail do not earn a boost", () => {
  const v = vehicle(false); capture(v);
  handleVehicleDrivingCommand(v, { kind: "drift-start", direction: 1 }, { forward: 1 });
  align(v); press(v); assert.equal(v.runtime.physicsState, 0);
});

test("rail boost opportunity expires normally", () => {
  const v = vehicle(); capture(v); align(v); updateDriftWindows(v, 0.6); press(v);
  assert.equal(v.runtime.physicsState, 0);
});

test("existing pre-entry boost window is preserved, not refreshed", () => {
  const v = vehicle(); v.runtime.driftLifecycleB50 = 0.1; capture(v); align(v);
  assert.equal(v.runtime.driftLifecycleB50, 0.1);
  press(v); assert.equal(v.runtime.physicsState, 2);
});

test("already consumed boost and invalidated drift do not get a second opportunity", () => {
  const used = vehicle(); used.runtime.driftLifecycleB44 = 0.3; used.runtime.physicsState = 2;
  capture(used); align(used); assert.equal(used.runtime.driftLifecycleB50, 0);
  const cancelled = vehicle(); capture(cancelled); cancelled.runtime.driftTailLatch = false;
  align(cancelled); assert.equal(cancelled.runtime.driftLifecycleB50, 0);
});

test("grip mode and locked vehicle do not earn a rail boost", () => {
  for (const mode of ["grip", "locked"]) {
    const v = vehicle(); capture(v);
    if (mode === "grip") v.speedRaceMode = { kind: "grip" };
    else v.runtime.raceMotionLocked = true;
    align(v); assert.equal(v.runtime.driftLifecycleB50, 0);
  }
});
