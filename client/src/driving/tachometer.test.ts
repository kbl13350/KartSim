import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canReorderVehicleSpeedSlots,
  consumeVehicleGaugePreserveMarker,
  consumeVehicleNormalBoosterDuration,
  consumeVehicleSpeedSlotReordered,
  reorderVehicleSpeedSlots,
  vehicleBoosterUnlimited,
  vehicleDriftMaxGauge,
  vehicleSlotChangerActive,
  vehicleSpeedSlots,
  vehicleTachometerAnimationState,
  vehicleTachometerCharger,
  vehicleTachometerCollision,
  vehicleTachometerExceed,
  vehicleTachometerGauges,
  vehicleTachometerIncGauge,
  vehicleTachometerSpeed,
  vehicleTimeAttackResultCounts,
  type VehicleTachometerContext,
} from "./tachometer";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const methodStart = release.indexOf("  timeAttackTachometerSpeed()", classStart);
const methodEnd = release.indexOf("  startRaceBooster()", methodStart);
assert.ok(classStart >= 0 && methodStart > classStart && methodEnd > methodStart);
const methodSource = release.slice(methodStart, methodEnd);
const Original = new Function("m", "wd", "K40", `return class Original { ${methodSource} };`)(
  Math.fround,
  (value: number, low: number, high: number) => Math.min(high, Math.max(low, value)),
  350,
) as new () => Record<string, (this: Scenario) => unknown>;
const original = new Original();

type Scenario = VehicleTachometerContext & {
  calls: string[];
  canReorderSpeedSlots(): boolean;
};
const migrated = {
  timeAttackTachometerSpeed: vehicleTachometerSpeed,
  timeAttackTachometerGauges: vehicleTachometerGauges,
  timeAttackSpeedSlots: vehicleSpeedSlots,
  canReorderSpeedSlots: canReorderVehicleSpeedSlots,
  timeAttackSlotChangerActive: vehicleSlotChangerActive,
  reorderSpeedSlots: reorderVehicleSpeedSlots,
  consumeSpeedSlotReordered: consumeVehicleSpeedSlotReordered,
  timeAttackTachometerExceed: vehicleTachometerExceed,
  timeAttackBoosterUnlimited: vehicleBoosterUnlimited,
  timeAttackTachometerDriftMaxGauge: vehicleDriftMaxGauge,
  timeAttackTachometerIncGauge: vehicleTachometerIncGauge,
  timeAttackTachometerCharger: vehicleTachometerCharger,
  timeAttackTachometerCollision: vehicleTachometerCollision,
  consumeTimeAttackTachometerNormalBooster: consumeVehicleNormalBoosterDuration,
  consumeTimeAttackTachometerGaugePreserve: consumeVehicleGaugePreserveMarker,
  timeAttackResultCounts: vehicleTimeAttackResultCounts,
  timeAttackTachometerAnimationState: vehicleTachometerAnimationState,
};
type MethodName = keyof typeof migrated;

function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    teamBooster: true,
    tuning: {
      autoChargeLowSpeed: 67,
      instAccelGaugeLength: 0.7,
      instAccelGaugeMinUsable: 0.2,
      driftMaxGauge: 100,
      chargerSystemBoosterUseCount: 4,
      wallCollGaugeMinVelBound: 30,
      wallCollGaugeCooldownTime: 4200,
    },
    runtime: {
      cachedDisplaySpeedKmh: 45.1234,
      instantGauge: 0.4,
      instantWallCooldownAnchorMs: 0xffff_ffff + 8,
      teamGaugeValue: 0.76,
      speedSlots: [6, 14, -1],
      speedSlotDisabled: [true, false, false],
      speedSlotReorderedAtMs: -1,
      speedSlotReorderedEdge: false,
      currentUpdateMs: 4000,
      instantAccelerationActive: true,
      tachometerIncGauge: 0.117,
      chargerPendingUses: 3,
      chargerActive: true,
      wallCollisionAnchorMs: 2222,
      resetRefillAnchorMs: 0,
      resetRefillRemaining: 0.5,
      tachometerNormalBoosterDuration: 2700,
      tachometerGaugePreserveMarker: true,
      resultCrashCount: 2,
      resultBoosterCount: 5,
      animationSlot: 3,
    },
    mainGaugeRatio() { calls.push("mainGaugeRatio"); return 0.37; },
    timeAttackBoosterUnlimited() {
      calls.push("timeAttackBoosterUnlimited");
      return released
        ? original.timeAttackBoosterUnlimited!.call(this) as boolean
        : vehicleBoosterUnlimited(this);
    },
    canReorderSpeedSlots() {
      calls.push("canReorderSpeedSlots");
      return released
        ? original.canReorderSpeedSlots!.call(this) as boolean
        : canReorderVehicleSpeedSlots(this);
    },
    chargerDurationMs() { calls.push("chargerDurationMs"); return 1937; },
  };
}

function compare(
  label: string,
  name: MethodName,
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(true);
  const actual = scenario(false);
  edit(expected); edit(actual);
  const releasedResult = original[name]!.call(expected);
  const migratedResult = migrated[name](actual);
  assert.deepEqual(migratedResult, releasedResult, `${label}: result`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.tuning, expected.tuning, `${label}: tuning`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("tachometer projections and float32 thresholds match release", () => {
  for (const name of [
    "timeAttackTachometerSpeed",
    "timeAttackTachometerGauges",
    "timeAttackTachometerExceed",
    "timeAttackBoosterUnlimited",
    "timeAttackTachometerDriftMaxGauge",
    "timeAttackTachometerIncGauge",
    "timeAttackTachometerCharger",
    "timeAttackTachometerCollision",
    "timeAttackResultCounts",
    "timeAttackTachometerAnimationState",
  ] as MethodName[]) compare(name, name);
  compare("unlimited drift gauge", "timeAttackTachometerGauges", state => { state.tuning.driftMaxGauge = 1; });
  compare("zero instant gauge", "timeAttackTachometerGauges", state => { state.tuning.instAccelGaugeLength = 0; });
  compare("NaN collision speed", "timeAttackTachometerCollision", state => { state.runtime.cachedDisplaySpeedKmh = NaN; });
  compare("zero exceed capacity", "timeAttackTachometerExceed", state => { state.tuning.instAccelGaugeLength = 0; });
  compare("threshold rounds to full", "timeAttackTachometerExceed", state => {
    state.tuning.instAccelGaugeMinUsable = 1.00001;
    state.tuning.instAccelGaugeLength = 1;
  });
});

test("speed slot reordering preserves cooldown, entries and disabled flags", () => {
  for (const name of ["timeAttackSpeedSlots", "canReorderSpeedSlots", "timeAttackSlotChangerActive", "reorderSpeedSlots", "consumeSpeedSlotReordered"] as MethodName[]) {
    compare(name, name);
  }
  compare("cooldown inclusive", "reorderSpeedSlots", state => { state.runtime.speedSlotReorderedAtMs = 3650; });
  compare("cooldown elapsed", "reorderSpeedSlots", state => { state.runtime.speedSlotReorderedAtMs = 3649; });
  compare("team disabled", "reorderSpeedSlots", state => { state.teamBooster = false; });
  compare("empty slot", "reorderSpeedSlots", state => { state.runtime.speedSlots[0] = -1; });
  compare("same slots", "reorderSpeedSlots", state => { state.runtime.speedSlots[1] = 6; });
  compare("single slot", "canReorderSpeedSlots", state => { state.runtime.speedSlots.length = 1; });
  compare("consume edge", "consumeSpeedSlotReordered", state => { state.runtime.speedSlotReorderedEdge = true; });
});

test("tachometer consume methods clear exactly one event", () => {
  compare("normal booster duration", "consumeTimeAttackTachometerNormalBooster");
  compare("missing duration", "consumeTimeAttackTachometerNormalBooster", state => {
    state.runtime.tachometerNormalBoosterDuration = undefined;
  });
  compare("preserve marker", "consumeTimeAttackTachometerGaugePreserve");
  compare("cleared marker", "consumeTimeAttackTachometerGaugePreserve", state => {
    state.runtime.tachometerGaugePreserveMarker = false;
  });
});
