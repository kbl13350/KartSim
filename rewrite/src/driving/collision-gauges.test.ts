import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  advanceResetGaugeRefill,
  beginInstantWallChargeWindow,
  beginWallGaugeWindow,
  cacheDisplaySpeed,
  clearWallGaugeRefund,
  mainVehicleGaugeRatio,
  publishVehicleGauge,
  setWallGaugeRefund,
  settleInstantWallCharge,
  settleWallGaugeWindow,
  syncVehiclePresentation,
  updateInstantAccelerationCharge,
  type CollisionGaugeContext,
  type VehiclePresentationContext,
} from "./collision-gauges";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  updatePublicGauge(", classStart);
const end = release.indexOf("  createBody(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function V9("), release.indexOf("function ri0(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
  release.slice(release.indexOf("function O9("), release.indexOf("function qt(")),
].join("\n");
interface OriginalGauge {
  updatePublicGauge(this: CollisionGaugeContext): void;
  mainGaugeRatio(this: CollisionGaugeContext): number;
  updateInstantAccelerationGauge(this: CollisionGaugeContext, seconds: number): void;
  updateInstantWallCharge(this: CollisionGaugeContext, nowMs: number): void;
  beginInstantWallCharge(this: CollisionGaugeContext, nowMs: number): void;
  updateResetGaugeRefill(this: CollisionGaugeContext, seconds: number, nowMs: number): void;
  beginWallCollision(this: CollisionGaugeContext): void;
  settleWallCollision(this: CollisionGaugeContext, nowMs: number): void;
  setWallGaugeRefill(this: CollisionGaugeContext, fraction: number): void;
  clearResetGaugeRefill(this: CollisionGaugeContext): void;
  updateCachedDisplaySpeed(this: CollisionGaugeContext): void;
  syncPresentationFields(this: VehiclePresentationContext): void;
}
const Original = new Function("m", `${helpers}\nreturn class Original { ${methods} };`)(Math.fround) as new () => OriginalGauge;
const original = new Original();

type Scenario = CollisionGaugeContext & { calls: string[]; crash: boolean };
function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    crash: true,
    tuning: {
      driftMaxGauge: 2,
      instAccelGaugeLength: 1200,
      autoChargeLowSpeed: 20,
      chargeInstAccelGaugeByGrip: 0.2,
      chargeInstAccelGaugeByBoost: 0.3,
      chargeInstAccelGaugeByBoostAdded: 0.1,
      instAccelGaugeCooldownTime: 1200,
      instAccelGaugeMinVelLoss: 10,
      instAccelGaugeMinVelBound: 35,
      chargeInstAccelGaugeByWall: 0.4,
      chargeInstAccelGaugeByWallAdded: 0.2,
      wallCollGaugeCooldownTime: 1800,
      wallCollGaugeMaxVelLoss: 80,
      wallCollGaugeMinVelLoss: 20,
    },
    runtime: {
      committedGauge: 0.7,
      pendingGauge: 0.2,
      instantGauge: 300,
      instantAccelerationActive: false,
      cachedDisplaySpeedKmh: 70,
      physicsState: 0,
      chargerEnabled: false,
      chargerActive: false,
      instantWallCollisionAnchorMs: 0,
      instantWallCooldownAnchorMs: 0,
      instantWallPreSpeedKmh: 100,
      resetRefillRemaining: 0.6,
      resetRefillInitial: 0.6,
      resetRefillAnchorMs: 1600,
      wallCollisionAnchorMs: 0,
      wallCollisionPreSpeedKmh: 120,
      currentUpdateMs: 3500,
    },
    state: { boostGauge: 0, driftEnergy: 0 },
    body: { linearVelocity: { x: 3.1, y: -2.4, z: 14.6 } },
    mainGaugeRatio() {
      calls.push("ratio");
      return released ? original.mainGaugeRatio.call(this) : mainVehicleGaugeRatio(this);
    },
    timeAttackTachometerCollision() {
      calls.push("collision");
      return { crash: this.crash };
    },
    setWallGaugeRefill(amount) {
      calls.push(`set:${amount}`);
      return released ? original.setWallGaugeRefill.call(this, amount) : setWallGaugeRefund(this, amount);
    },
    clearResetGaugeRefill() {
      calls.push("clear");
      return released ? original.clearResetGaugeRefill.call(this) : clearWallGaugeRefund(this);
    },
  };
}

function snapshot(state: Scenario): unknown {
  return { calls: state.calls, crash: state.crash, tuning: state.tuning,
    runtime: state.runtime, state: state.state, body: state.body };
}

function compare(
  label: string,
  releaseCall: (vehicle: Scenario) => unknown,
  migratedCall: (vehicle: Scenario) => unknown,
  edit: (vehicle: Scenario) => void = () => {},
): void {
  const expected = scenario(true), actual = scenario(false);
  edit(expected); edit(actual);
  assert.deepEqual(migratedCall(actual), releaseCall(expected), `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("public and committed gauge ratios match release", () => {
  for (const capacity of [0, 1, 1.5, 2, Number.NaN]) {
    compare(`ratio capacity ${capacity}`, state => original.mainGaugeRatio.call(state),
      mainVehicleGaugeRatio, state => { state.tuning.driftMaxGauge = capacity; });
  }
  compare("publish", state => original.updatePublicGauge.call(state), publishVehicleGauge);
  compare("publish capped", state => original.updatePublicGauge.call(state), publishVehicleGauge,
    state => { state.runtime.committedGauge = 3; });
});

test("instant acceleration charge and drain match release", () => {
  const check = (label: string, edit: (state: Scenario) => void) =>
    compare(label, state => original.updateInstantAccelerationGauge.call(state, 0.016),
      state => updateInstantAccelerationCharge(state, 0.016), edit);
  check("grip", () => {});
  check("boost", state => { state.runtime.physicsState = 3; });
  check("charger boost", state => {
    state.runtime.physicsState = 3; state.runtime.chargerEnabled = true; state.runtime.chargerActive = true;
  });
  check("low speed", state => { state.runtime.cachedDisplaySpeedKmh = 19; });
  check("capacity absent", state => { state.tuning.instAccelGaugeLength = 0; });
  check("charged cap", state => { state.runtime.instantGauge = 1199; });
  check("active drain", state => { state.runtime.instantAccelerationActive = true; });
  check("active expires", state => {
    state.runtime.instantAccelerationActive = true; state.runtime.instantGauge = 10;
  });
});

test("instant wall charge samples speed loss with cooldown", () => {
  const begin = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.beginInstantWallCharge.call(state, 3500),
      state => beginInstantWallChargeWindow(state, 3500), edit);
  begin("begin");
  begin("cooldown", state => { state.runtime.instantWallCooldownAnchorMs = 3000; });
  begin("low speed", state => { state.runtime.cachedDisplaySpeedKmh = 20; });
  begin("already observing", state => { state.runtime.instantWallCollisionAnchorMs = 3000; });
  begin("disabled", state => { state.tuning.instAccelGaugeCooldownTime = 0; });

  const settle = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateInstantWallCharge.call(state, 3600),
      state => settleInstantWallCharge(state, 3600), edit);
  settle("pre-speed sample");
  settle("within observation", state => { state.runtime.instantWallCollisionAnchorMs = 3400; });
  settle("full charge", state => { state.runtime.instantWallCollisionAnchorMs = 3000; });
  settle("loss below threshold", state => {
    state.runtime.instantWallCollisionAnchorMs = 3000; state.runtime.instantWallPreSpeedKmh = 75;
  });
  settle("charger extra", state => {
    state.runtime.instantWallCollisionAnchorMs = 3000; state.runtime.chargerEnabled = true;
    state.runtime.chargerActive = true;
  });
  settle("cooldown pending", state => {
    state.runtime.instantWallCollisionAnchorMs = 3000; state.runtime.instantWallCooldownAnchorMs = 2000;
  });
});

test("post-reset gauge refund cadence matches release", () => {
  const refill = (label: string, now: number, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateResetGaugeRefill.call(state, 0.016, now),
      state => advanceResetGaugeRefill(state, 0.016, now), edit);
  refill("increment", 1700);
  refill("fill remainder", 1700, state => { state.runtime.resetRefillRemaining = 0.005; });
  refill("after 500ms", 2200);
  refill("cooldown expired", 3500);
  refill("disabled", 1700, state => { state.tuning.wallCollGaugeCooldownTime = 0; });
  refill("no amount", 1700, state => { state.runtime.resetRefillRemaining = 0; });
  refill("capacity cap", 1700, state => { state.runtime.committedGauge = 1.99; });
  compare("set fraction", state => original.setWallGaugeRefill.call(state, 0.377),
    state => setWallGaugeRefund(state, 0.377));
  compare("clear fraction", state => original.clearResetGaugeRefill.call(state), clearWallGaugeRefund);
});

test("wall speed loss starts and settles its gauge refund", () => {
  const begin = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.beginWallCollision.call(state), beginWallGaugeWindow, edit);
  begin("begin");
  begin("no crash", state => { state.crash = false; });
  begin("one slot", state => { state.tuning.driftMaxGauge = 1; });
  begin("cooldown", state => { state.runtime.resetRefillAnchorMs = 3000; });
  begin("already observing", state => { state.runtime.wallCollisionAnchorMs = 3000; });

  const settle = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.settleWallCollision.call(state, 3600),
      state => settleWallGaugeWindow(state, 3600), edit);
  settle("pre-speed sample");
  settle("within window", state => { state.runtime.wallCollisionAnchorMs = 3400; state.runtime.resetRefillAnchorMs = 0; });
  settle("full refund", state => { state.runtime.wallCollisionAnchorMs = 3000; state.runtime.resetRefillAnchorMs = 0; });
  settle("partial refund", state => {
    state.runtime.wallCollisionAnchorMs = 3000; state.runtime.resetRefillAnchorMs = 0;
    state.runtime.wallCollisionPreSpeedKmh = 120; state.runtime.cachedDisplaySpeedKmh = 75;
  });
  settle("small loss", state => {
    state.runtime.wallCollisionAnchorMs = 3000; state.runtime.resetRefillAnchorMs = 0;
    state.runtime.wallCollisionPreSpeedKmh = 75;
  });
  settle("NaN speed", state => {
    state.runtime.wallCollisionAnchorMs = 3000; state.runtime.resetRefillAnchorMs = 0;
    state.runtime.wallCollisionPreSpeedKmh = Number.NaN;
  });
  settle("refund already running", state => {
    state.runtime.wallCollisionAnchorMs = 3000; state.runtime.resetRefillAnchorMs = 2000;
  });
});

test("cached speed preserves release vector length and km/h rounding", () => {
  for (const velocity of [
    { x: 0, y: 0, z: 0 },
    { x: 3.1, y: -2.4, z: 14.6 },
    { x: Number.NaN, y: 1, z: 4 },
    { x: Number.POSITIVE_INFINITY, y: 0, z: 0 },
  ]) {
    compare(`speed ${JSON.stringify(velocity)}`,
      state => original.updateCachedDisplaySpeed.call(state), cacheDisplaySpeed,
      state => { state.body.linearVelocity = velocity; });
  }
});

test("public presentation fields copy completed physics slice like release", () => {
  function presentationScenario(released: boolean): VehiclePresentationContext & { calls: string[] } {
    const base = scenario(released);
    return {
      ...base,
      runtime: {
        ...base.runtime,
        localForwardSpeed: 12.7,
        localRightSpeed: -1.31,
        visualScaleA: { x: 0.9, y: 1.1, z: 0.77 },
        steeringAngle: 0.18,
      },
      body: {
        ...base.body,
        position: { x: 3.2, y: 4.7, z: -20.4 },
        angularVelocity: { x: 0.07, y: 0.13, z: -0.22 },
        right: { x: 0.9, y: 0.05, z: -0.4 },
        forward: { x: 0.4, y: 0.04, z: 0.91 },
        up: { x: 0.01, y: 0.99, z: 0.02 },
      },
      state: {
        ...base.state,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        heading: 0, yawRate: 0,
        right: { x: 0, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 0 },
        visualScale: { x: 0, y: 0, z: 0 },
        forwardSpeed: 0, lateralSpeed: 0, slipAngle: 0,
        steering: 0, wheelCompression: [],
      },
      wheels: { compression: [0.2, 0.5, 0.75, 1] },
      collisionShape: { scaleX: 1.2, scaleY: 1.5, rawHeight: 0.45 },
      updatePublicGauge() {
        this.calls.push("publish");
        return released ? original.updatePublicGauge.call(this) : publishVehicleGauge(this);
      },
    };
  }
  const expected = presentationScenario(true), actual = presentationScenario(false);
  original.syncPresentationFields.call(expected);
  syncVehiclePresentation(actual);
  assert.deepEqual(actual.runtime, expected.runtime);
  assert.deepEqual(actual.state, expected.state);
  assert.deepEqual(actual.body, expected.body);
  assert.deepEqual(actual.calls, expected.calls);
  assert.notStrictEqual(actual.state.forward, actual.body.forward);
  assert.notStrictEqual(actual.state.wheelCompression, actual.wheels.compression);
});
