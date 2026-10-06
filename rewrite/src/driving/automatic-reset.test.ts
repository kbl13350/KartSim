import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activateDirectionalCollisionPress,
  activateHardCollisionPress,
  advanceCollisionResetTimer,
  updateObstacleCollisionResetTimer,
  updatePrimaryCollisionResetTimers,
  type CollisionResetContext,
} from "./automatic-reset";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  updatePrimaryAutomaticResetTimers(", classStart);
const end = release.indexOf("  applyHighObstacleAngularResponse(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const clear = release.slice(release.indexOf("function a1("), release.indexOf("function hd("));
const Original = new Function("m", `${clear}\nreturn class Original { ${methods} };`)(
  Math.fround,
) as new () => {
  updatePrimaryAutomaticResetTimers(this: CollisionResetContext,
    collision: { responseHit: boolean; lowHit: boolean }, seconds: number): void;
  updateObstacleAutomaticResetTimer(this: CollisionResetContext, hit: boolean, seconds: number): void;
  advanceAutomaticResetTimer(this: CollisionResetContext,
    elapsed: number, interrupted: boolean, seconds: number, threshold: number): number;
  activateDirectionalPress(this: CollisionResetContext, mode: number): void;
  activateHardPress(this: CollisionResetContext): void;
};
const original = new Original();

type Scenario = CollisionResetContext & { calls: string[] };
function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    runtime: {
      automaticResetLowCollisionTime: 0.9,
      automaticResetHighCollisionTime: 0.1,
      automaticResetObstacleTime: 0.39,
      automaticResetRequest: false,
      pressState: 0,
      obstacleSuppressionRemainingMs: 0,
      pressProtected1C0: false,
      collisionResponseMagnitudeB6C: 17,
      obstacleSuppressionLatch: false,
    },
    body: {
      linearVelocity: { x: 3, y: -1, z: 5 },
      angularVelocity: { x: 0.1, y: 0.3, z: -0.2 },
    },
    flyingPetListeners: [
      active => { calls.push(`pet0:${active}`); },
      active => { calls.push(`pet1:${active}`); },
    ],
    setVisualScaleMode(mode) { calls.push(`visual:${mode}`); },
    advanceAutomaticResetTimer(elapsed, interrupted, seconds, threshold) {
      return released
        ? original.advanceAutomaticResetTimer.call(this, elapsed, interrupted, seconds, threshold)
        : advanceCollisionResetTimer(this, elapsed, interrupted, seconds, threshold);
    },
  };
}

function snapshot(state: Scenario): unknown {
  return { calls: state.calls, runtime: state.runtime, body: state.body };
}

function compare(
  label: string,
  originalCall: (vehicle: Scenario) => void,
  migratedCall: (vehicle: Scenario) => void,
): void {
  const expected = scenario(true), actual = scenario(false);
  originalCall(expected);
  migratedCall(actual);
  assert.deepEqual(snapshot(actual), snapshot(expected), label);
}

test("low, high and obstacle reset thresholds match release", () => {
  compare("low hit", state => original.updatePrimaryAutomaticResetTimers.call(state,
    { responseHit: true, lowHit: true }, 0.2),
  state => updatePrimaryCollisionResetTimers(state, { responseHit: true, lowHit: true }, 0.2));
  compare("high hit", state => original.updatePrimaryAutomaticResetTimers.call(state,
    { responseHit: true, lowHit: false }, 0.91),
  state => updatePrimaryCollisionResetTimers(state, { responseHit: true, lowHit: false }, 0.91));
  compare("no hit", state => original.updatePrimaryAutomaticResetTimers.call(state,
    { responseHit: false, lowHit: true }, 0.2),
  state => updatePrimaryCollisionResetTimers(state, { responseHit: false, lowHit: true }, 0.2));
  compare("obstacle", state => original.updateObstacleAutomaticResetTimer.call(state, true, 0.02),
    state => updateObstacleCollisionResetTimer(state, true, 0.02));
  compare("obstacle cleared", state => original.updateObstacleAutomaticResetTimer.call(state, false, 0.02),
    state => updateObstacleCollisionResetTimer(state, false, 0.02));
});

test("directional and hard press preserve release side effects", () => {
  compare("directional press", state => original.activateDirectionalPress.call(state, 2),
    state => activateDirectionalCollisionPress(state, 2));
  compare("hard press", state => original.activateHardPress.call(state),
    activateHardCollisionPress);
});
