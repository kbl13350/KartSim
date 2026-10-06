import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activateVehicleCharger,
  armVehicleDualBooster,
  classifyVehicleDualBoosterReady,
  clearVehicleDualBoosterReady,
  expireVehicleCharger,
  refreshVehicleDualBoosterReady,
  startVehicleNormalBooster,
  updateVehicleDualBooster,
  vehicleChargerDurationMs,
  type BoosterStateContext,
} from "./booster-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const methods = [
  method("startNormalBooster", "activateChargerIfReady"),
  method("activateChargerIfReady", "chargerDurationMs"),
  method("chargerDurationMs", "updateChargerExpiry"),
  method("updateChargerExpiry", "updateStateTimer"),
  method("updateDualBooster", "armDualBooster"),
  method("armDualBooster", "refreshDualBoosterReady"),
  method("refreshDualBoosterReady", "classifyDualBoosterReady"),
  method("classifyDualBoosterReady", "clearDualBoosterReady"),
  method("clearDualBoosterReady", "updateObstacleSuppressionTimer"),
].join("\n");
const Original = new Function("m", `const Cs=6,_g=14;function ec(n){return n===Cs||n===_g;}
return class Original { ${methods} };`)(Math.fround) as new () => {
  startNormalBooster(this: BoosterStateContext, input: { forward: number }): boolean;
  activateChargerIfReady(this: BoosterStateContext): void;
  chargerDurationMs(this: BoosterStateContext): number;
  updateChargerExpiry(this: BoosterStateContext, nowMs: number): void;
  updateDualBooster(this: BoosterStateContext): void;
  armDualBooster(this: BoosterStateContext): void;
  refreshDualBoosterReady(this: BoosterStateContext): number | undefined;
  classifyDualBoosterReady(this: BoosterStateContext, elapsed: number, min: number, max: number): number;
  clearDualBoosterReady(this: BoosterStateContext, state: number): void;
};
const original = new Original();
type Scenario = BoosterStateContext & { calls: string[] };

function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    teamBooster: true,
    dualBoostAutoArm: false,
    dualBoostAuto: false,
    runtime: {
      physicsState: 0,
      speedSlots: [6, -1],
      speedSlotDisabled: [false, false],
      tachometerNormalBoosterDuration: 0,
      dualActiveSpeedLocked: false,
      stateRemainingMs: 0,
      raceMotionLocked: false,
      resultBoosterCount: 0,
      chargerBoosterUses: 1,
      chargerEnabled: true,
      chargerActive: false,
      chargerPendingUses: 1,
      chargerActivations: 0,
      chargerExpiryMs: 0,
      currentUpdateMs: 3000,
      chargerDurationScale: 1.2,
      cachedDisplaySpeedKmh: 90,
      dualBoosterMode: 0,
      dualBoosterState: 0,
      dualReadyRemainingMs: 0,
      dualBoosterTeam: false,
    },
    tuning: {
      normalBoosterTime: 3000,
      teamBoosterTime: 3600,
      chargerSystemBoosterUseCount: 2,
      chargerSystemUseTime: 4000,
      dualTransLowSpeed: 30,
      dualBoosterEnabled: true,
      dualBoosterTickMin: 20,
      dualBoosterTickMax: 50,
    },
    state: { nitro: 1, boostTime: 0 },
    activateChargerIfReady() {
      calls.push("activate");
      return released ? original.activateChargerIfReady.call(this) : activateVehicleCharger(this);
    },
    chargerDurationMs() {
      calls.push("duration");
      return released ? original.chargerDurationMs.call(this) : vehicleChargerDurationMs(this);
    },
    dualBoosterReadyRemainingMs() { calls.push("remaining"); return Math.max(0, Math.trunc(this.runtime.dualReadyRemainingMs)); },
    refreshDualBoosterReady() {
      calls.push("refresh");
      return released ? original.refreshDualBoosterReady.call(this) : refreshVehicleDualBoosterReady(this);
    },
    classifyDualBoosterReady(elapsed, min, max) {
      calls.push(`classify:${elapsed}/${min}/${max}`);
      return released ? original.classifyDualBoosterReady.call(this, elapsed, min, max)
        : classifyVehicleDualBoosterReady(this, elapsed, min, max);
    },
    clearDualBoosterReady(state) {
      calls.push(`clear:${state}`);
      return released ? original.clearDualBoosterReady.call(this, state)
        : clearVehicleDualBoosterReady(this, state);
    },
  };
}

function snapshot(state: Scenario): unknown {
  return { calls: state.calls, runtime: state.runtime, state: state.state, tuning: state.tuning };
}

function compare(
  label: string,
  releasedCall: (state: Scenario) => unknown,
  migratedCall: (state: Scenario) => unknown,
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(true), actual = scenario(false);
  edit(expected); edit(actual);
  assert.deepEqual(migratedCall(actual), releasedCall(expected), `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("normal/team nitro consumption and charger uses match release", () => {
  const check = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.startNormalBooster.call(state, { forward: 1 }),
      state => startVehicleNormalBooster(state, { forward: 1 }), edit);
  check("normal");
  check("team", state => { state.runtime.speedSlots[0] = 14; });
  check("team disabled", state => { state.runtime.speedSlots[0] = 14; state.teamBooster = false; });
  check("slot disabled", state => { state.runtime.speedSlotDisabled[0] = true; });
  check("wrong state", state => { state.runtime.physicsState = 3; });
  check("locked result", state => { state.runtime.raceMotionLocked = true; });
  compare("not driving", state => original.startNormalBooster.call(state, { forward: 0 }),
    state => startVehicleNormalBooster(state, { forward: 0 }));
  compare("duration zero", state => original.startNormalBooster.call(state, { forward: 1 }),
    state => startVehicleNormalBooster(state, { forward: 1 }),
    state => { state.tuning.normalBoosterTime = -7; });
});

test("charger activation, duration and expiry match release", () => {
  const activate = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.activateChargerIfReady.call(state), activateVehicleCharger, edit);
  activate("not enough uses");
  activate("activate", state => { state.runtime.chargerBoosterUses = 2; state.runtime.chargerPendingUses = 2; });
  activate("already active", state => {
    state.runtime.chargerBoosterUses = 2; state.runtime.chargerPendingUses = 2;
    state.runtime.chargerActive = true;
  });
  activate("cooldown", state => {
    state.runtime.chargerBoosterUses = 2; state.runtime.chargerPendingUses = 2;
    state.runtime.chargerExpiryMs = 4000;
  });
  activate("pending uses wrong", state => {
    state.runtime.chargerBoosterUses = 2; state.runtime.chargerPendingUses = 1;
  });
  compare("duration", state => original.chargerDurationMs.call(state), vehicleChargerDurationMs);
  compare("minimum duration", state => original.chargerDurationMs.call(state), vehicleChargerDurationMs,
    state => { state.tuning.chargerSystemUseTime = 0; });
  const expire = (label: string, nowMs: number, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateChargerExpiry.call(state, nowMs),
      state => expireVehicleCharger(state, nowMs), edit);
  expire("exact expiry", 4000, state => { state.runtime.chargerActive = true; state.runtime.chargerExpiryMs = 4000; });
  expire("expired", 4001, state => { state.runtime.chargerActive = true; state.runtime.chargerExpiryMs = 4000; });
  expire("disabled", 4001, state => {
    state.runtime.chargerActive = true; state.runtime.chargerExpiryMs = 4000; state.runtime.chargerEnabled = false;
  });
});

test("dual booster classification and ready windows match release", () => {
  const classify = (label: string, elapsed: number, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.classifyDualBoosterReady.call(state, elapsed, 600, 1500),
      state => classifyVehicleDualBoosterReady(state, elapsed, 600, 1500), edit);
  classify("too early", 500);
  classify("too late", 1600);
  classify("low speed", 1200, state => { state.runtime.cachedDisplaySpeedKmh = 20; });
  classify("armed", 1200, state => { state.runtime.dualBoosterState = 6; });
  classify("auto", 1200, state => { state.dualBoostAuto = true; });
  classify("manual", 1200);

  const refresh = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.refreshDualBoosterReady.call(state), refreshVehicleDualBoosterReady, edit);
  refresh("disabled", state => { state.tuning.dualBoosterEnabled = false; });
  refresh("idle");
  refresh("locked speed", state => {
    state.runtime.physicsState = 3; state.runtime.dualActiveSpeedLocked = true;
  });
  refresh("too early", state => { state.runtime.physicsState = 3; state.runtime.stateRemainingMs = 2900; });
  refresh("ready", state => {
    state.runtime.physicsState = 3; state.runtime.stateRemainingMs = 1800; state.runtime.dualBoosterState = 6;
  });
  refresh("team ready", state => {
    state.runtime.physicsState = 4; state.runtime.stateRemainingMs = 2200;
    state.runtime.dualBoosterState = 6;
  });
  compare("clear", state => original.clearDualBoosterReady.call(state, 4),
    state => clearVehicleDualBoosterReady(state, 4), state => { state.runtime.dualBoosterMode = 1; });
});

test("dual booster animation, auto arm and transition match release", () => {
  const update = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateDualBooster.call(state), updateVehicleDualBooster, edit);
  update("idle");
  update("active dual", state => { state.runtime.physicsState = 10; });
  update("dual too slow", state => {
    state.runtime.physicsState = 10; state.runtime.cachedDisplaySpeedKmh = 20;
  });
  update("auto arm", state => {
    state.runtime.physicsState = 3; state.runtime.stateRemainingMs = 1500;
    state.dualBoostAutoArm = true;
  });
  update("armed transition", state => {
    state.runtime.physicsState = 4; state.runtime.stateRemainingMs = 1800;
    state.runtime.dualBoosterState = 6;
  });
  compare("arm booster", state => original.armDualBooster.call(state), armVehicleDualBooster,
    state => { state.runtime.physicsState = 3; state.runtime.stateRemainingMs = 1500; });
  compare("cannot arm", state => original.armDualBooster.call(state), armVehicleDualBooster);
});
