import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  accumulateVehicleTeamGauge,
  consumeVehicleTeamGaugeCharge,
  consumeVehicleTeamGaugeFullAnimation,
  convertVehicleTeamBoosterSlots,
  enqueueVehicleTeamGaugeTarget,
  expireVehicleTeamSlotWindow,
  teamGaugeSettledAtMs,
  teamSlotWindowStartMs,
  updateVehicleTeamGauge,
  vehicleSpeedSlotDisabled,
  type TeamGaugeContext,
} from "./team-gauge";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function methodRange(first: string, next: string): string {
  const start = release.indexOf(`  ${first}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const methods = [
  methodRange("accumulateTeamGauge", "accumulateSpeedGauge"),
  methodRange("consumeMultiplayerTeamCharge", "startNormalBooster"),
].join("\n");
const Original = new Function("m", `const Cs=6,_g=14,H40=m(8e3),q40=m(0.1);
function ec(n){return n===Cs||n===_g;}
return class Original { ${methods} };`)(Math.fround) as new () => {
  accumulateTeamGauge(this: TeamGaugeContext, amount: number): void;
  consumeMultiplayerTeamCharge(this: TeamGaugeContext): number;
  enqueueMultiplayerTeamTarget(this: TeamGaugeContext, amount: number): void;
  updateTeamGauge(this: TeamGaugeContext, nowMs: number): void;
  consumeTeamGaugeFullAnimation(this: TeamGaugeContext): boolean;
  timeAttackTeamGaugeSettledAtMs(this: TeamGaugeContext): number;
  convertTeamBoosterSlots(this: TeamGaugeContext, nowMs: number, temporary: boolean): void;
  updateTeamSlotWindow(this: TeamGaugeContext, nowMs: number): void;
  timeAttackSpeedSlotDisabled(this: TeamGaugeContext): boolean[];
  timeAttackSpeedSlotWindowStartMs(this: TeamGaugeContext): number;
};
const original = new Original();
type Scenario = TeamGaugeContext & { calls: string[] };
function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    teamBooster: true,
    teamBoosterDirect: false,
    externalTeamGauge: false,
    speedRaceMode: { kind: "ordinary" },
    runtime: {
      teamGaugeCharge: 600,
      teamGaugeQueue: [],
      teamGaugeValue: 0.4,
      teamGaugeTickMs: -1,
      teamGaugeFullPending: false,
      teamGaugeSettledAtMs: 0,
      speedSlots: [6, -1, 6],
      speedSlotDisabled: [false, false, false],
      teamSlotWindowEndMs: 0,
    },
    state: { nitro: 2 },
    convertTeamBoosterSlots(nowMs, temporary) {
      calls.push(`convert:${nowMs}/${temporary}`);
      return released ? original.convertTeamBoosterSlots.call(this, nowMs, temporary)
        : convertVehicleTeamBoosterSlots(this, nowMs, temporary);
    },
  };
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
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.state, expected.state, `${label}: state`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("local and external team charge accumulation match release", () => {
  compare("positive charge", state => original.accumulateTeamGauge.call(state, 0.5),
    state => accumulateVehicleTeamGauge(state, 0.5));
  compare("zero ignored", state => original.accumulateTeamGauge.call(state, 0),
    state => accumulateVehicleTeamGauge(state, 0));
  compare("booster off", state => original.accumulateTeamGauge.call(state, 0.5),
    state => accumulateVehicleTeamGauge(state, 0.5), state => { state.teamBooster = false; });
  compare("external consume", state => original.consumeMultiplayerTeamCharge.call(state),
    consumeVehicleTeamGaugeCharge, state => { state.externalTeamGauge = true; });
  compare("local consume ignored", state => original.consumeMultiplayerTeamCharge.call(state),
    consumeVehicleTeamGaugeCharge);
  for (const amount of [0, 0.5377, 1, -0.1, 1.1, Number.NaN]) {
    compare(`external queue ${amount}`, state => original.enqueueMultiplayerTeamTarget.call(state, amount),
      state => enqueueVehicleTeamGaugeTarget(state, amount), state => { state.externalTeamGauge = true; });
  }
});

test("team gauge queue, ticks and full slot conversion match release", () => {
  const update = (label: string, nowMs: number, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateTeamGauge.call(state, nowMs),
      state => updateVehicleTeamGauge(state, nowMs), edit);
  update("charge creates queue", 3000);
  update("queue increment", 3500, state => {
    state.runtime.teamGaugeQueue = [0.8]; state.runtime.teamGaugeTickMs = 3000;
  });
  update("queue target reached", 3500, state => {
    state.runtime.teamGaugeQueue = [0.42]; state.runtime.teamGaugeTickMs = 3000;
  });
  update("full target", 4500, state => {
    state.runtime.teamGaugeQueue = [1]; state.runtime.teamGaugeTickMs = 3000;
    state.runtime.teamGaugeValue = 0.99;
  });
  update("team disabled", 3500, state => { state.teamBooster = false; });
  update("direct ordinary", 3500, state => { state.teamBoosterDirect = true; });
  update("direct grip", 3500, state => {
    state.teamBoosterDirect = true; state.speedRaceMode = { kind: "grip" };
  });
  update("grip conversion", 3500, state => { state.speedRaceMode = { kind: "grip" }; });
  update("external target", 3500, state => {
    state.externalTeamGauge = true; state.runtime.teamGaugeQueue = [0.8];
  });
});

test("team slot window, animation and view accessors match release", () => {
  compare("temporary conversion", state => original.convertTeamBoosterSlots.call(state, 3000, true),
    state => convertVehicleTeamBoosterSlots(state, 3000, true));
  compare("permanent conversion", state => original.convertTeamBoosterSlots.call(state, 3000, false),
    state => convertVehicleTeamBoosterSlots(state, 3000, false));
  compare("no ordinary slot", state => original.convertTeamBoosterSlots.call(state, 3000, true),
    state => convertVehicleTeamBoosterSlots(state, 3000, true),
    state => { state.runtime.speedSlots = [14, -1, 14]; });
  compare("window before expiry", state => original.updateTeamSlotWindow.call(state, 3999),
    state => expireVehicleTeamSlotWindow(state, 3999),
    state => { state.runtime.teamSlotWindowEndMs = 4000; state.runtime.speedSlotDisabled[0] = true; });
  compare("window expires", state => original.updateTeamSlotWindow.call(state, 4000),
    state => expireVehicleTeamSlotWindow(state, 4000),
    state => { state.runtime.teamSlotWindowEndMs = 4000; state.runtime.speedSlotDisabled[0] = true; });
  compare("animation pending", state => original.consumeTeamGaugeFullAnimation.call(state),
    consumeVehicleTeamGaugeFullAnimation, state => { state.runtime.teamGaugeFullPending = true; });
  compare("animation absent", state => original.consumeTeamGaugeFullAnimation.call(state),
    consumeVehicleTeamGaugeFullAnimation);
  compare("settled time", state => original.timeAttackTeamGaugeSettledAtMs.call(state),
    teamGaugeSettledAtMs, state => { state.runtime.teamGaugeSettledAtMs = 0xffff_ffff + 3; });
  compare("disabled view", state => original.timeAttackSpeedSlotDisabled.call(state),
    vehicleSpeedSlotDisabled);
  compare("window start", state => original.timeAttackSpeedSlotWindowStartMs.call(state),
    teamSlotWindowStartMs, state => { state.runtime.teamSlotWindowEndMs = 4000; });
});
