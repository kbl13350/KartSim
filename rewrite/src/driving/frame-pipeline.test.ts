import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { advancePhysicsSubstep, type VehicleStepContext } from "./frame-pipeline";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  stepSubstep(", classStart);
const methodEnd = release.indexOf("  applyBoosterChargeSurface(", methodStart);
assert.ok(classStart > 0 && methodStart > classStart && methodEnd > methodStart);
const releasedMethod = release.slice(methodStart, methodEnd);
const helpers = [
  release.slice(release.indexOf("function s9("), release.indexOf("function KC(")),
  release.slice(release.indexOf("function t1("), release.indexOf("function dd(")),
].join("\n");
const OriginalStep = new Function("m", `${helpers}\nconst ud = m(0.0020000000949949026);\nreturn class OriginalStep { ${releasedMethod} };`)(
  Math.fround,
) as new () => { stepSubstep(this: VehicleStepContext, seconds: number,
  input: { forward: number; reverse: number }, track: unknown): void };
const originalStep = new OriginalStep();

type Scenario = VehicleStepContext & { calls: string[] };
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });

function scenario(): Scenario {
  const calls: string[] = [];
  const state: Record<string, unknown> = {
    calls,
    runtime: {
      motionMode: 0, mrContact: false, hwContact: false,
      specialNormal: vector(0, 1, 0), liveForwardAccel: 2300, driveScale: 1.1,
      driveSteeringSuppressed: false, delayedDriftRequest: false,
      driftDecay: 0, activeDrift: false, triggerPhase: false,
      driftTailLatch: false, localForwardSpeed: 2,
      oneSubstepDrift: false, steeringEnvelope: 0.4,
      raceMotionLocked: false, fullPhysicsBypass: false,
      pressProtected1C0: false, integrationExtraForce: vector(),
      currentUpdateMs: 7000, physicsState: 0,
    },
    scratch: { force: vector(1, 2, 3), torque: vector() },
    wheels: { grounded: true, surfaceVelocity: vector(1.25, -0.75, 0.5) },
    body: { linearVelocity: vector(4, 5, 6), right: vector(0, 0, -1) },
    state: { drifting: false, driftTime: 0, driftDirection: 1 },
    nitroSeamlessRequest: false,
    giantObstacleLowHit: false,
  };
  const methods = [
    "updateStateTimer", "updateDriftLifecycleTimers", "scanSpecialRoad", "rebuildBodyState",
    "probeWheels", "enterRailMode", "applyResetSurfaceRequest", "applyFull3DRail",
    "applySuspension", "applyLongitudinal", "applySteeringAndTires", "applyRoadConsumers",
    "applyBoosterChargeSurface", "applyAirState", "updateTachometerIncGauge", "applyDrag",
    "captureRail", "returnToStandard", "integrateVelocity", "updateInstantAccelerationGauge",
    "accumulateDriftGauge", "accumulateSpeedGauge", "updateResetGaugeRefill", "integrateFull3D",
    "updatePrimaryAutomaticResetTimers", "updateObstacleAutomaticResetTimer",
    "resolveTrackEvents", "applySupplementalWheelRecovery", "applySlipAlignment",
    "integrateStandardOrientation", "updateCollisionGaugeOwners",
  ];
  for (const name of methods) state[name] = () => { calls.push(name); };
  state.tryConsumeNormalBooster = () => { calls.push("tryConsumeNormalBooster"); return true; };
  state.resolvePrimaryCollision = () => {
    calls.push("resolvePrimaryCollision"); return { lowHit: true };
  };
  state.resolveStaticObstacles = () => {
    calls.push("resolveStaticObstacles"); return { kind: "none" };
  };
  return state as unknown as Scenario;
}

function snapshot(context: Scenario): unknown {
  return {
    calls: context.calls, runtime: context.runtime, scratch: context.scratch,
    wheels: context.wheels, body: context.body, state: context.state,
    nitroSeamlessRequest: context.nitroSeamlessRequest,
  };
}

function compare(name: string, edit: (context: Scenario) => void): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const input = { forward: 1, reverse: 0 };
  originalStep.stepSubstep.call(expected, 0.002, input, { id: 42 });
  advancePhysicsSubstep(actual, 0.002, input, { id: 42 });
  assert.deepEqual(snapshot(actual), snapshot(expected), name);
}

test("physics substep orchestration matches release across contact and rail branches", () => {
  compare("grounded", () => {});
  compare("airborne", (context) => { context.wheels.grounded = false; });
  compare("hover contact", (context) => {
    context.wheels.grounded = false; context.runtime.hwContact = true;
  });
  compare("full-3D rail", (context) => { context.runtime.motionMode = 2; });
  compare("enter rail next slice", (context) => {
    context.wheels.railContactDescriptor = { id: 8 };
  });
  compare("drift and nitro", (context) => {
    context.nitroSeamlessRequest = true;
    context.runtime.delayedDriftRequest = true;
  });
  compare("steering disabled", (context) => {
    context.runtime.driveSteeringSuppressed = true;
  });
  compare("LTE interrupted", (context) => {
    context.runtime.raceMotionLocked = true;
    context.lteMotion = { interrupt() { context.calls.push("lte.interrupt"); },
      step() { context.calls.push("lte.step"); } };
  });
  compare("LTE force", (context) => {
    context.lteMotion = { interrupt() { context.calls.push("lte.interrupt"); },
      step() { context.calls.push("lte.step"); } };
  });
  compare("giant wall collision", (context) => {
    context.giant = { processWallCollision() { context.calls.push("giant.wall"); } };
  });
});

test("physics substep rejects invalid slice duration exactly as release", () => {
  for (const seconds of [0, -0.001, 0.0021, Number.NaN]) {
    assert.throws(() => originalStep.stepSubstep.call(scenario(), seconds, { forward: 0, reverse: 0 }, {}),
      /车辆物理子步/);
    assert.throws(() => advancePhysicsSubstep(scenario(), seconds, { forward: 0, reverse: 0 }, {}),
      /车辆物理子步/);
  }
});
