import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  advanceObstacleSuppression,
  setVehicleVisualScaleMode,
  updateVehicleEventGravity,
  updateVehicleEventScale,
  updateVehicleScaleMode,
  updateVehicleVisualScale,
  vehicleVisualScaleMode,
  type VisualScaleContext,
} from "./visual-scale";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  updateObstacleSuppressionTimer(", classStart);
const end = release.indexOf("  resolvePrimaryCollision(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const tables = release.slice(release.indexOf("  cs = ["), release.indexOf("  qC = ["))
  .replace(/,\s*$/, ";");
const helpers = [
  release.slice(release.indexOf("function O9("), release.indexOf("function qt(")),
  release.slice(release.indexOf("function md("), release.indexOf("function wd(")),
].join("\n");
const Original = new Function("m", `const ${tables}\n${helpers}\nreturn class Original { ${methods} };`)(Math.fround) as new () => {
  updateObstacleSuppressionTimer(this: VisualScaleContext, milliseconds: number): void;
  visualScaleMode(this: VisualScaleContext): number;
  setVisualScaleMode(this: VisualScaleContext, mode: number): void;
  updateVisualScale(this: VisualScaleContext, nowMs: number): void;
  updateModeScale(this: VisualScaleContext, nowMs: number): void;
  updateEventScale(this: VisualScaleContext, nowMs: number): void;
  updateEventGravity(this: VisualScaleContext, nowMs: number): void;
};
const original = new Original();
const vector = (x: number, y: number, z: number) => ({ x, y, z });
type Scenario = VisualScaleContext & { calls: string[] };
function scenario(released: boolean, hasGiant = false): Scenario {
  const calls: string[] = [];
  const state: Scenario = {
    calls,
    runtime: {
      obstacleSuppressionRemainingMs: 150,
      raceMotionLocked: false,
      pressProtected1C0: true,
      pressState: 2,
      obstacleSuppressionLatch: true,
      visualScaleRestorePending: false,
      visualScaleTransitionAnchorMs: 3000,
      visualScaleA: vector(1.2, 1.2, 0.2),
      eventScaleMode: 1,
      eventScaleAnchorMs: 3000,
      eventScaleDurationMs: 950,
      eventScalePrimary: vector(1, 1, 1),
      eventScaleSecondary: vector(1, 1, 1),
      eventScaleStart: vector(1, 1, 1),
      eventScaleTarget: vector(2, 1.7, 1.4),
      gravityDivisor: 3,
      gravityAnchorMs: 3000,
    },
    wheels: { grounded: true },
    flyingPetListeners: [active => { calls.push(`pet:${active}`); }],
    visualScaleMode() {
      calls.push("mode");
      return released ? original.visualScaleMode.call(this) : vehicleVisualScaleMode(this);
    },
    updateEventScale(now) {
      calls.push(`event:${now}`);
      return released ? original.updateEventScale.call(this, now) : updateVehicleEventScale(this, now);
    },
    updateVisualScale(now) {
      calls.push(`visual:${now}`);
      return released ? original.updateVisualScale.call(this, now) : updateVehicleVisualScale(this, now);
    },
  };
  if (hasGiant) state.giant = {
    nativeFlattenWritten(scale) { calls.push(`flatten:${scale.z}`); },
    nativeRestoreRequested() { calls.push("restore"); },
    updateVehicle(now, publish) {
      calls.push(`giant:${now}`);
      publish(vector(2, 3, 4), vector(4, 5, 6), vector(1.5, 1.4, 1.3));
    },
  };
  return state;
}

function compare(
  label: string,
  releasedCall: (state: Scenario) => unknown,
  migratedCall: (state: Scenario) => unknown,
  edit: (state: Scenario) => void = () => {},
  hasGiant = false,
): void {
  const expected = scenario(true, hasGiant), actual = scenario(false, hasGiant);
  edit(expected); edit(actual);
  assert.deepEqual(migratedCall(actual), releasedCall(expected), `${label}: result`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("obstacle suppression expiry and scale mode match release", () => {
  const suppression = (label: string, milliseconds: number, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateObstacleSuppressionTimer.call(state, milliseconds),
      state => advanceObstacleSuppression(state, milliseconds), edit);
  suppression("partial", 50);
  suppression("expires", 200);
  suppression("locked expiry", 200, state => { state.runtime.raceMotionLocked = true; });
  suppression("no active suppression", 200, state => { state.runtime.obstacleSuppressionRemainingMs = 0; });
  suppression("negative elapsed", -4);
  for (const scale of [vector(1, 1, 1), vector(1.2, 1.2, 0.2),
    vector(0.2, 1.2, 1.2), vector(1.2, 0.2, 1.2)]) {
    compare(`mode ${JSON.stringify(scale)}`, state => original.visualScaleMode.call(state),
      vehicleVisualScaleMode, state => { state.runtime.visualScaleA = scale; });
  }
  compare("flatten", state => original.setVisualScaleMode.call(state, 1),
    state => setVehicleVisualScaleMode(state, 1), () => {}, true);
  compare("side flatten", state => original.setVisualScaleMode.call(state, 2),
    state => setVehicleVisualScaleMode(state, 2));
});

test("visual squash recovery keyframes and giant ownership match release", () => {
  for (const now of [3000, 3050, 3100, 3200, 3350, 3600, 3700]) {
    compare(`visual ${now}`, state => original.updateVisualScale.call(state, now),
      state => updateVehicleVisualScale(state, now));
  }
  compare("restore starts", state => original.updateVisualScale.call(state, 3050),
    state => updateVehicleVisualScale(state, 3050), state => { state.runtime.visualScaleRestorePending = true; });
  compare("inactive mode scale", state => original.updateModeScale.call(state, 3050),
    state => updateVehicleScaleMode(state, 3050));
  compare("giant update", state => original.updateModeScale.call(state, 3050),
    state => updateVehicleScaleMode(state, 3050), () => {}, true);
  compare("giant restore", state => original.updateModeScale.call(state, 3050),
    state => updateVehicleScaleMode(state, 3050), state => { state.runtime.visualScaleRestorePending = true; }, true);
});

test("event scale primary/secondary curves match release at segment boundaries", () => {
  for (const now of [3000, 3200, 3400, 3500, 3650, 3900, 3950, 3960]) {
    compare(`event ${now}`, state => original.updateEventScale.call(state, now),
      state => updateVehicleEventScale(state, now));
  }
  compare("event starts", state => original.updateEventScale.call(state, 3400),
    state => updateVehicleEventScale(state, 3400), state => { state.runtime.eventScaleAnchorMs = 0; });
  compare("event idle", state => original.updateEventScale.call(state, 3400),
    state => updateVehicleEventScale(state, 3400), state => { state.runtime.eventScaleMode = 0; });
});

test("temporary gravity ends after grounded cooldown", () => {
  for (const now of [3000, 4000, 4001]) {
    compare(`gravity ${now}`, state => original.updateEventGravity.call(state, now),
      state => updateVehicleEventGravity(state, now));
  }
  compare("gravity starts", state => original.updateEventGravity.call(state, 3000),
    state => updateVehicleEventGravity(state, 3000), state => { state.runtime.gravityAnchorMs = 0; });
  compare("airborne", state => original.updateEventGravity.call(state, 4001),
    state => updateVehicleEventGravity(state, 4001), state => { state.wheels.grounded = false; });
  compare("already normal", state => original.updateEventGravity.call(state, 4001),
    state => updateVehicleEventGravity(state, 4001), state => { state.runtime.gravityDivisor = 1; });
});
