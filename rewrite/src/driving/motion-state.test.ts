import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  accumulateSpeedCharge,
  advanceStateTimerMilliseconds,
  advanceStateTimerSeconds,
  beginRoadAction,
  type MotionStateContext,
} from "./motion-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const OriginalState = new Function("m", `return class OriginalState {
${method("setRoadActionState", "applyDrag")}
${method("updateStateTimer", "updateDriftLifecycleTimers")}
${method("updateStateTimerMilliseconds", "updateDualBooster")}
${method("accumulateSpeedGauge", "commitDriftGauge")}
};`)(Math.fround) as new () => {
  setRoadActionState(this: MotionStateContext, state: number, ms: number): void;
  updateStateTimer(this: MotionStateContext, seconds: number): void;
  updateStateTimerMilliseconds(this: MotionStateContext, ms: number): void;
  accumulateSpeedGauge(this: MotionStateContext, seconds: number, rail: boolean): void;
};
const original = new OriginalState();

function scenario(): MotionStateContext {
  return {
    runtime: {
      physicsState: 3,
      stateRemainingMs: 1200,
      tachometerIncGauge: true,
      driftGaugeElapsed: 0.1,
      chargerEnabled: false,
      chargerActive: false,
      committedGauge: 0.2,
    },
    state: { boostTime: 1.2 },
    tuning: {
      chargeBoostBySpeed: 0.3,
      chargeBoostBySpeedAdded: 0.2,
      driftMaxGauge: 1,
    },
  };
}

function compare(
  label: string,
  originalCall: (state: MotionStateContext) => void,
  migratedCall: (state: MotionStateContext) => void,
  edit: (state: MotionStateContext) => void = () => {},
): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  originalCall(expected); migratedCall(actual);
  assert.deepEqual(actual, expected, label);
}

test("timed road actions and state expiry match the released vehicle", () => {
  compare("new road action", state => original.setRoadActionState.call(state, 14, 3000),
    state => beginRoadAction(state, 14, 3000));
  compare("existing road action preserved", state => original.setRoadActionState.call(state, 14, 3000),
    state => beginRoadAction(state, 14, 3000), state => { state.runtime.physicsState = 15; });
  for (const milliseconds of [0, 300, 1200, 1500, -200]) {
    compare(`timer ${milliseconds} ms`, state => original.updateStateTimerMilliseconds.call(state, milliseconds),
      state => advanceStateTimerMilliseconds(state, milliseconds));
  }
  compare("empty normal timer", state => original.updateStateTimerMilliseconds.call(state, 500),
    state => advanceStateTimerMilliseconds(state, 500), state => {
      state.runtime.stateRemainingMs = 0; state.runtime.physicsState = 2;
    });
  compare("empty boost timer", state => original.updateStateTimerMilliseconds.call(state, 500),
    state => advanceStateTimerMilliseconds(state, 500), state => {
      state.runtime.stateRemainingMs = 0;
    });
  compare("road state boost display", state => original.updateStateTimerMilliseconds.call(state, 50),
    state => advanceStateTimerMilliseconds(state, 50), state => {
      state.runtime.physicsState = 14;
    });
});

test("seconds timer rounds to release millisecond resolution", () => {
  for (const seconds of [0.0004, 0.0005, 0.0017, 0.016, -0.0013]) {
    const originalCalls: number[] = [];
    const migratedCalls: number[] = [];
    original.updateStateTimer.call(Object.assign(scenario(), {
      updateStateTimerMilliseconds(ms: number) { originalCalls.push(ms); },
    }), seconds);
    advanceStateTimerSeconds({ updateStateTimerMilliseconds(ms) { migratedCalls.push(ms); } }, seconds);
    assert.deepEqual(migratedCalls, originalCalls, `seconds=${seconds}`);
  }
});

test("speed gauge charging matches release across rail, charger and cap", () => {
  compare("normal charging", state => original.accumulateSpeedGauge.call(state, 0.002, false),
    state => accumulateSpeedCharge(state, 0.002, false));
  compare("rail doubles charge", state => original.accumulateSpeedGauge.call(state, 0.002, true),
    state => accumulateSpeedCharge(state, 0.002, true));
  compare("charger rate", state => original.accumulateSpeedGauge.call(state, 0.002, false),
    state => accumulateSpeedCharge(state, 0.002, false), state => {
      state.runtime.chargerEnabled = true; state.runtime.chargerActive = true;
    });
  compare("charging disabled", state => original.accumulateSpeedGauge.call(state, 0.002, false),
    state => accumulateSpeedCharge(state, 0.002, false), state => {
      state.runtime.tachometerIncGauge = false;
    });
  compare("gauge cap", state => original.accumulateSpeedGauge.call(state, 0.5, true),
    state => accumulateSpeedCharge(state, 0.5, true), state => {
      state.runtime.committedGauge = 0.99;
    });
  compare("extended gauge cap", state => original.accumulateSpeedGauge.call(state, 0.5, true),
    state => accumulateSpeedCharge(state, 0.5, true), state => {
      state.tuning.driftMaxGauge = 1.5;
    });
});
