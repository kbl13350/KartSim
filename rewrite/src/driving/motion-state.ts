/** State transitions and gauges advanced during each vehicle physics slice. */

export interface MotionStateContext {
  runtime: {
    physicsState: number;
    stateRemainingMs: number;
    tachometerIncGauge: boolean;
    driftGaugeElapsed: number;
    chargerEnabled: boolean;
    chargerActive: boolean;
    committedGauge: number;
  };
  state: { boostTime: number };
  tuning: {
    chargeBoostBySpeed: number;
    chargeBoostBySpeedAdded: number;
    driftMaxGauge: number;
  };
}

const float = Math.fround;

/** Begin a timed road action unless an existing road action is still active. */
export function beginRoadAction(
  vehicle: Pick<MotionStateContext, "runtime" | "state">,
  physicsState: number,
  milliseconds: number,
): void {
  const current = vehicle.runtime.physicsState;
  if (current >= 13 && current <= 16) return;
  vehicle.runtime.physicsState = physicsState;
  vehicle.runtime.stateRemainingMs = milliseconds;
  vehicle.state.boostTime = 0;
}

/** Convert a seconds slice into the integer timer resolution used by the game. */
export function advanceStateTimerSeconds(
  vehicle: { updateStateTimerMilliseconds(milliseconds: number): void },
  seconds: number,
): void {
  vehicle.updateStateTimerMilliseconds(Math.round(seconds * 1_000));
}

export function advanceStateTimerMilliseconds(
  vehicle: Pick<MotionStateContext, "runtime" | "state">,
  milliseconds: number,
): void {
  const runtime = vehicle.runtime;
  if (runtime.stateRemainingMs <= 0) {
    if (runtime.physicsState !== 0 && runtime.physicsState !== 2) {
      runtime.physicsState = 0;
    }
    return;
  }
  runtime.stateRemainingMs = Math.max(0, runtime.stateRemainingMs - milliseconds);
  if (runtime.stateRemainingMs === 0) runtime.physicsState = 0;
  vehicle.state.boostTime = runtime.physicsState >= 1 && runtime.physicsState <= 11
    ? runtime.stateRemainingMs * 0.001 : 0;
}

/** Charge the shared speed/drift meter while speed charging is enabled. */
export function accumulateSpeedCharge(
  vehicle: Pick<MotionStateContext, "runtime" | "tuning"> & { itemMode?: boolean },
  seconds: number,
  full3DRail: boolean,
): void {
  const { runtime, tuning } = vehicle;
  if (!runtime.tachometerIncGauge || vehicle.itemMode) return;
  runtime.driftGaugeElapsed = float(runtime.driftGaugeElapsed + seconds);
  let chargeRate = float(tuning.chargeBoostBySpeed);
  if (runtime.chargerEnabled && runtime.chargerActive) {
    chargeRate = float(chargeRate + float(tuning.chargeBoostBySpeedAdded));
  }
  let gain = float(seconds * chargeRate);
  if (full3DRail) gain = float(gain * float(2));
  const updated = float(runtime.committedGauge + gain);
  const cap = float(Math.max(float(tuning.driftMaxGauge), float(1)));
  runtime.committedGauge = updated >= cap ? cap : updated;
}
