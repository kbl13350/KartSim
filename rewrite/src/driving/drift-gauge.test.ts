import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { accumulateDriftCharge, commitDriftCharge, updateDriftWindows,
  preserveDriftChargeAfterCollision, type DriftGaugeContext } from "./drift-gauge";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const first = release.indexOf(`  ${name}(`, classStart);
  const last = release.indexOf(`  ${next}(`, first);
  assert.ok(first > classStart && last > first, `${name} release body`);
  return release.slice(first, last);
}
const methods = [
  method("accumulateDriftGauge", "accumulateTeamGauge"),
  method("commitDriftGauge", "consumeMultiplayerTeamCharge"),
  method("updateDriftLifecycleTimers", "updateStateTimerMilliseconds"),
  method("applyCollisionDriftGaugePreserve", "updatePublicGauge"),
].join("\n");
const comparisonHelpers = release.slice(release.indexOf("function vi("), release.indexOf("function md("));
const OriginalGauge = new Function("m", `${comparisonHelpers}\nreturn class OriginalGauge { ${methods} };`)(
  Math.fround,
) as new () => {
  accumulateDriftGauge(this: DriftGaugeContext, seconds: number, rail: boolean): void;
  commitDriftGauge(this: DriftGaugeContext): void;
  updateDriftLifecycleTimers(this: DriftGaugeContext, seconds: number): void;
  applyCollisionDriftGaugePreserve(this: DriftGaugeContext, charger: boolean): void;
};
const original = new OriginalGauge();

type Scenario = DriftGaugeContext & { teamCharges: number[] };
function scenario(): Scenario {
  const teamCharges: number[] = [];
  return {
    teamCharges,
    speedRaceMode: { kind: "speed" },
    wheels: { grounded: true },
    tuning: {
      driftMaxGauge: 100, driftGaugeFactor: 1.4,
      driftGaugeReset: true, driftGaguePreservePercent: 0.25,
    },
    runtime: {
      driftGaugeWindow: true, localForwardSpeed: 12, localRightSpeed: 3,
      pendingGauge: 0.5, committedGauge: 8, driftGaugeElapsed: 0.05,
      chargerEnabled: false, chargerActive: false,
      driftTailLatch: true, tachometerGaugePreserveMarker: false,
      lastCommittedPending: 0, driftLifecycleB50: 0.4,
      driftLifecycleB44: 0.8, physicsState: 2,
    },
    accumulateTeamGauge(charge) { teamCharges.push(charge); },
  };
}

function snapshot(state: Scenario): unknown {
  return {
    wheels: state.wheels, tuning: state.tuning, runtime: state.runtime,
    teamCharges: state.teamCharges,
  };
}

function compare(label: string, edit: (state: Scenario) => void,
  released: (state: Scenario) => void, rewritten: (state: Scenario) => void): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  released(expected); rewritten(actual);
  assert.deepEqual(snapshot(actual), snapshot(expected), label);
}

test("drift charge windows, charger, rail and disabled branches match release", () => {
  const cases: Array<[string, (state: Scenario) => void, boolean]> = [
    ["early", () => {}, false],
    ["middle", (state) => { state.runtime.driftGaugeElapsed = 0.25; }, false],
    ["late", (state) => { state.runtime.driftGaugeElapsed = 0.75; }, false],
    ["rail", (state) => { state.wheels.grounded = false; }, true],
    ["charger", (state) => {
      state.runtime.chargerEnabled = true; state.runtime.chargerActive = true;
    }, false],
    ["grip disabled", (state) => { state.speedRaceMode!.kind = "grip"; }, false],
    ["air disabled", (state) => { state.wheels.grounded = false; }, false],
    ["reverse disabled", (state) => { state.runtime.localForwardSpeed = -1; }, false],
    ["single gauge", (state) => { state.tuning.driftMaxGauge = 1; }, false],
  ];
  for (const [name, edit, rail] of cases)
    compare(name, edit,
      (state) => original.accumulateDriftGauge.call(state, 0.002, rail),
      (state) => accumulateDriftCharge(state, 0.002, rail));
});

test("drift commit, timer expiry and collision preservation match release", () => {
  compare("commit", () => {},
    (state) => original.commitDriftGauge.call(state),
    (state) => commitDriftCharge(state));
  compare("commit cap", (state) => { state.runtime.committedGauge = 99.9; },
    (state) => original.commitDriftGauge.call(state),
    (state) => commitDriftCharge(state));
  for (const seconds of [0.002, 0.8])
    compare(`timer ${seconds}`, () => {},
      (state) => original.updateDriftLifecycleTimers.call(state, seconds),
      (state) => updateDriftWindows(state, seconds));
  for (const preserve of [0, 0.25])
    for (const charger of [false, true])
      compare(`collision ${preserve}/${charger}`, (state) => {
        state.tuning.driftGaguePreservePercent = preserve;
        state.runtime.chargerEnabled = charger;
        state.runtime.chargerActive = charger;
      },
      (state) => original.applyCollisionDriftGaugePreserve.call(state, charger),
      (state) => preserveDriftChargeAfterCollision(state, charger));
});
