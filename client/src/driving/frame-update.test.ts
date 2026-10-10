import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { advanceVehicleFrame, type VehicleFrameContext } from "./frame-update";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  update(", classStart);
const methodEnd = release.indexOf("  synchronizeClock(", methodStart);
assert.ok(classStart > 0 && methodStart > classStart && methodEnd > methodStart);
const originalBody = release.slice(methodStart, methodEnd);
const clearHelper = release.slice(release.indexOf("function a1("), release.indexOf("function hd("));
const OriginalFrame = new Function("m", `${clearHelper}\nreturn class OriginalFrame { ${originalBody} };`)(
  Math.fround,
) as new () => { update(this: VehicleFrameContext, milliseconds: number,
  input: { forward: number; reverse: number }, track: unknown): unknown };
const originalFrame = new OriginalFrame();

type Scenario = VehicleFrameContext & { calls: string[] };
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });

function scenario(): Scenario {
  const calls: string[] = [];
  const runtime = {
    currentUpdateMs: 0, currentReverseSnapshot: 0,
    liveForwardAccel: 2200, liveDragFactor: 0.7,
    collisionMotionHit: true, collisionMotionStrength: 7,
    landingMotionTrigger: true, landingShockAudioStrength: 2,
    collisionResponseMagnitudeB6C: 0,
    fullPhysicsBypass: false,
    stagedExternalForce: vector(1, 2, 3), stagedExternalTorque: vector(4, 5, 6),
  };
  const state: Record<string, unknown> = {
    calls, runtime,
    clock: { advance(milliseconds: number) {
      calls.push(`clock:${milliseconds}`);
      return { nowMs: 15000, elapsedMs: 4, slicesMs: [2, 2] };
    } },
    body: { linearVelocity: vector(3, 4, 5), angularVelocity: vector(6, 7, 8) },
    scratch: { force: vector(9, 10, 11), torque: vector(12, 13, 14) },
  };
  const methods = [
    "applyJumpSurfaceTuning", "updateEventGravity", "updateInstantWallCharge",
    "updateStateTimerMilliseconds", "updateResetGaugeRefill", "updateModeScale",
    "updatePublicGauge", "updateObstacleSuppressionTimer", "updateChargerExpiry",
    "updateCachedDisplaySpeed", "updateDualBooster", "updateTeamGauge",
    "updateTeamSlotWindow", "settleWallCollision", "syncPresentationFields",
  ];
  for (const name of methods) state[name] = () => { calls.push(name); };
  let slice = 0;
  state.stepSubstep = () => {
    calls.push("stepSubstep");
    runtime.liveForwardAccel = -1;
    runtime.liveDragFactor = -1;
    runtime.collisionResponseMagnitudeB6C = ++slice * 3;
  };
  return state as unknown as Scenario;
}

function snapshot(context: Scenario): unknown {
  return {
    calls: context.calls, runtime: context.runtime,
    body: context.body, scratch: context.scratch,
  };
}

function compare(label: string, edit: (context: Scenario) => void): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const input = { forward: 1, reverse: 0.3 };
  const originalClock = originalFrame.update.call(expected, 4, input, { id: 42 });
  const rewrittenClock = advanceVehicleFrame(actual, 4, input, { id: 42 });
  assert.deepEqual(rewrittenClock, originalClock, `${label}: clock`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("outer AL frame update matches release in active, bypass and frozen states", () => {
  compare("active physics", () => {});
  compare("full physics bypass", (context) => { context.runtime.fullPhysicsBypass = true; });
  compare("giant frozen", (context) => {
    context.giant = { frozen: true, processWallCollision() {} };
  });
});
