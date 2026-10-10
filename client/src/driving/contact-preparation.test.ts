import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyBoosterChargeRoad,
  applyJumpRoadTuning,
  rebuildVehicleBodyState,
  requestResetRoad,
  updateSpeedChargeEligibility,
  type ContactPreparationContext,
} from "./contact-preparation";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  applyBoosterChargeSurface(", classStart);
const end = release.indexOf("  scanSpecialRoad(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function VG("), release.indexOf("function Ri(")),
  release.slice(release.indexOf("function a1("), release.indexOf("function hd(")),
  release.slice(release.indexOf("function V9("), release.indexOf("function ri0(")),
  release.slice(release.indexOf("function Mt("), release.indexOf("function _n(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
type OriginalContact = {
  applyBoosterChargeSurface(this: ContactPreparationContext): void;
  updateTachometerIncGauge(this: ContactPreparationContext, rail: boolean): void;
  applyJumpSurfaceTuning(this: ContactPreparationContext): void;
  applyResetSurfaceRequest(this: ContactPreparationContext): void;
  rebuildBodyState(this: ContactPreparationContext, force: Vector, torque: Vector): void;
};
const Original = new Function("m", `${helpers}\nreturn class Original { ${methods} };`)(
  Math.fround,
) as new () => OriginalContact;
const original = new Original();
type Vector = { x: number; y: number; z: number };
const vector = (x = 0, y = 0, z = 0): Vector => ({ x, y, z });

function scenario(tag = "normal"): ContactPreparationContext {
  return {
    body: {
      linearVelocity: vector(6.13, -0.38, 4.47),
      forward: vector(0.92, 0.1, -0.2),
      right: vector(0.2, 0, 0.98),
      up: vector(0.1, 0.96, -0.02),
    },
    wheels: {
      grounded: true,
      roadDescriptor: { road: { attributes: [{ name: "surface", value: tag }] } },
      surfaceVelocity: vector(1, 2, 3),
    },
    runtime: {
      stagedExternalForce: vector(17, -2, 5),
      stagedExternalTorque: vector(4, 1, -3),
      localForwardSpeed: 0,
      localRightSpeed: 0,
      localUpSpeed: 0,
      bodySpeed: 0,
      committedGauge: 0.6,
      tachometerIncGauge: false,
      contactWorking: true,
      physicsState: 0,
      driftGaugeWindow: false,
      cachedDisplaySpeedKmh: 50,
      liveForwardAccel: 2400,
      liveDragFactor: 0.8,
      railResetRequest: false,
    },
    tuning: { driftMaxGauge: 1.5, chargeBoostBySpeed: 0.1, autoChargeLowSpeed: 30 },
  };
}

function compare(
  label: string,
  originalCall: (vehicle: ContactPreparationContext) => void,
  migratedCall: (vehicle: ContactPreparationContext) => void,
  edit: (vehicle: ContactPreparationContext) => void = () => {},
  tag = "normal",
): void {
  const expected = scenario(tag); edit(expected);
  const actual = scenario(tag); edit(actual);
  originalCall(expected);
  migratedCall(actual);
  assert.deepEqual(actual, expected, label);
}

test("staged force and road-coordinate body speed match release", () => {
  const expected = scenario();
  const actual = scenario();
  const expectedForce = vector(), expectedTorque = vector();
  const actualForce = vector(), actualTorque = vector();
  original.rebuildBodyState.call(expected, expectedForce, expectedTorque);
  rebuildVehicleBodyState(actual, actualForce, actualTorque);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actualForce, expectedForce);
  assert.deepEqual(actualTorque, expectedTorque);
});

test("special road gauge, jump and reset effects match release", () => {
  for (const tag of ["normal", "bcharge", "점프", "리셋"]) {
    compare(`${tag}: booster charge`, state => original.applyBoosterChargeSurface.call(state),
      applyBoosterChargeRoad, () => {}, tag);
    compare(`${tag}: jump tuning`, state => original.applyJumpSurfaceTuning.call(state),
      applyJumpRoadTuning, () => {}, tag);
    compare(`${tag}: reset request`, state => original.applyResetSurfaceRequest.call(state),
      requestResetRoad, () => {}, tag);
  }
  compare("airborne jump ignored", state => original.applyJumpSurfaceTuning.call(state),
    applyJumpRoadTuning, state => { state.wheels.grounded = false; }, "점프");
  compare("charge cap", state => original.applyBoosterChargeSurface.call(state),
    applyBoosterChargeRoad, state => { state.runtime.committedGauge = 1.4; }, "bcharge");
});

test("speed charge eligibility matches all gating branches", () => {
  compare("active contact", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false));
  compare("rail without contact", state => original.updateTachometerIncGauge.call(state, true),
    state => updateSpeedChargeEligibility(state, true), state => {
      state.runtime.contactWorking = false;
    });
  compare("no contact", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.runtime.contactWorking = false;
    });
  compare("drifting", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.runtime.driftGaugeWindow = true;
    });
  compare("boosting", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.runtime.physicsState = 3;
    });
  compare("low speed", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.runtime.cachedDisplaySpeedKmh = 29.9;
    });
  compare("zero charging rate", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.tuning.chargeBoostBySpeed = 0;
    });
  compare("one-slot gauge", state => original.updateTachometerIncGauge.call(state, false),
    state => updateSpeedChargeEligibility(state, false), state => {
      state.tuning.driftMaxGauge = 1;
    });
});
