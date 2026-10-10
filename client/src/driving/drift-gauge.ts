/** Drift charge and collision preservation rules used by AL. */
export interface DriftGaugeContext {
  speedRaceMode?: { kind: string };
  itemMode?: boolean;
  wheels: { grounded: boolean };
  tuning: {
    driftMaxGauge: number;
    driftGaugeFactor: number;
    driftGaugeReset: boolean;
    driftGaguePreservePercent: number;
  };
  runtime: {
    driftGaugeWindow: boolean;
    localForwardSpeed: number;
    localRightSpeed: number;
    pendingGauge: number;
    committedGauge: number;
    driftGaugeElapsed: number;
    chargerEnabled: boolean;
    chargerActive: boolean;
    driftTailLatch: boolean;
    tachometerGaugePreserveMarker: boolean;
    lastCommittedPending: number;
    driftLifecycleB50: number;
    driftLifecycleB44: number;
    physicsState: number;
  };
  accumulateTeamGauge(charge: number): void;
}

const float = Math.fround;

/** Accumulate lateral slip charge during a drift window. */
export function accumulateDriftCharge(context: DriftGaugeContext,
  seconds: number, full3DRail: boolean): void {
  const { runtime, tuning } = context;
  // Item races keep drifting and the drift-exit boost but never charge the booster gauge.
  if (context.itemMode || context.speedRaceMode?.kind === "grip" ||
      (!context.wheels.grounded && !full3DRail) ||
      !runtime.driftGaugeWindow || runtime.localForwardSpeed < 0) return;
  if (tuning.driftMaxGauge === 1) {
    runtime.pendingGauge = 1;
    return;
  }
  let charge = float(float(runtime.localRightSpeed * runtime.localRightSpeed) * seconds);
  if (full3DRail) charge = float(charge * float(2));
  runtime.driftGaugeElapsed = float(runtime.driftGaugeElapsed + seconds);
  let weightedCharge: number;
  if (runtime.driftGaugeElapsed < 0.2)
    weightedCharge = float(3 * charge);
  else if (runtime.driftGaugeElapsed < 0.5)
    weightedCharge = float(1.5 * charge);
  else
    weightedCharge = float(charge / float(2 * runtime.driftGaugeElapsed));
  if (runtime.chargerEnabled && runtime.chargerActive)
    weightedCharge = float(weightedCharge * tuning.driftGaugeFactor);
  runtime.pendingGauge = float(runtime.pendingGauge + weightedCharge);
}

/** Commit pending drift charge and notify the multiplayer team gauge. */
export function commitDriftCharge(context: DriftGaugeContext): void {
  const { runtime, tuning } = context;
  const charge = float(runtime.committedGauge + runtime.pendingGauge);
  const max = float(tuning.driftMaxGauge);
  runtime.committedGauge = charge < max ? charge : max;
  runtime.driftGaugeWindow = false;
  runtime.driftGaugeElapsed = 0;
  context.accumulateTeamGauge(runtime.pendingGauge);
  runtime.lastCommittedPending = runtime.pendingGauge;
  runtime.pendingGauge = 0;
}

/** Age the two drift windows and clear the drift physics state on expiry. */
export function updateDriftWindows(context: DriftGaugeContext, seconds: number): void {
  const { runtime } = context;
  if (runtime.driftLifecycleB50 > 0) {
    const remaining = float(runtime.driftLifecycleB50 - seconds);
    runtime.driftLifecycleB50 = float(0) < remaining ? remaining : float(0);
  }
  if (runtime.driftLifecycleB44 > 0 || runtime.physicsState === 2) {
    runtime.driftLifecycleB44 = float(runtime.driftLifecycleB44 - seconds);
    if (runtime.driftLifecycleB44 <= 0) {
      runtime.driftLifecycleB44 = 0;
      if (runtime.physicsState === 2) runtime.physicsState = 0;
    }
  }
}

/** Preserve or discard pending drift charge after a wall or obstacle hit. */
export function preserveDriftChargeAfterCollision(context: DriftGaugeContext,
  chargerCollision: boolean): void {
  const { runtime, tuning } = context;
  if (!tuning.driftGaugeReset) return;
  const preserve = float(tuning.driftGaguePreservePercent);
  if (preserve === 0) {
    runtime.driftTailLatch = false;
    runtime.driftGaugeWindow = false;
    runtime.driftGaugeElapsed = 0;
  }
  if (preserve !== 0)
    runtime.tachometerGaugePreserveMarker = runtime.pendingGauge > 0;
  const factor = chargerCollision && runtime.chargerEnabled && runtime.chargerActive
    ? float(100) : preserve;
  runtime.pendingGauge = float(runtime.pendingGauge * factor);
}
