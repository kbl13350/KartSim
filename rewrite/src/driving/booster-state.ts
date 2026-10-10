/** Nitro slot, charger, and dual-booster state transitions. */

export interface BoosterStateContext {
  runtime: {
    physicsState: number;
    speedSlots: number[];
    speedSlotDisabled: boolean[];
    tachometerNormalBoosterDuration: number;
    dualActiveSpeedLocked: boolean;
    stateRemainingMs: number;
    raceMotionLocked: boolean;
    resultBoosterCount: number;
    chargerBoosterUses: number;
    chargerEnabled: boolean;
    chargerActive: boolean;
    chargerPendingUses: number;
    chargerActivations: number;
    chargerExpiryMs: number;
    currentUpdateMs: number;
    chargerDurationScale: number;
    cachedDisplaySpeedKmh: number;
    dualBoosterMode: number;
    dualBoosterState: number;
    dualReadyRemainingMs: number;
    dualBoosterTeam: boolean;
    animationInput?: {
      physicsState: number;
      displaySpeedKmh: number;
      dualMode: number;
      dualBoosterState: number;
      dualReadyRemainingMs: number;
    };
  };
  tuning: {
    normalBoosterTime: number;
    teamBoosterTime: number;
    chargerSystemBoosterUseCount: number;
    chargerSystemUseTime: number;
    dualTransLowSpeed: number;
    dualBoosterEnabled: boolean;
    dualBoosterTickMin: number;
    dualBoosterTickMax: number;
  };
  state: { nitro: number; boostTime: number };
  teamBooster: boolean;
  /** Item races spend booster items through startItemBooster, never as nitro slots. */
  itemMode?: boolean;
  dualBoostAutoArm: boolean;
  dualBoostAuto: boolean;
  activateChargerIfReady(): void;
  chargerDurationMs(): number;
  dualBoosterReadyRemainingMs(): number;
  refreshDualBoosterReady(): number | undefined;
  classifyDualBoosterReady(elapsed: number, minTick: number, maxTick: number): number;
  clearDualBoosterReady(state: number): void;
}

const float = Math.fround;
const ordinaryBoosterSlot = 6;
const teamBoosterSlot = 14;
const isBoosterSlot = (slot: number) => slot === ordinaryBoosterSlot || slot === teamBoosterSlot;

/** Consume the first eligible nitro slot and enter the ordinary/team boost state. */
export function startVehicleNormalBooster(vehicle: BoosterStateContext, input: { forward: number }): boolean {
  const { runtime, tuning, state } = vehicle;
  if (vehicle.itemMode) return false;
  if ((runtime.physicsState !== 0 && runtime.physicsState !== 18) || input.forward <= 0) return false;
  const firstSlot = runtime.speedSlots[0];
  if (runtime.speedSlotDisabled[0]) return false;
  const teamBoost = firstSlot === teamBoosterSlot && vehicle.teamBooster;
  if (firstSlot !== ordinaryBoosterSlot && !teamBoost) return false;
  runtime.speedSlots.shift();
  runtime.speedSlots.push(-1);
  runtime.speedSlotDisabled.shift();
  runtime.speedSlotDisabled.push(false);
  state.nitro = runtime.speedSlots.filter(isBoosterSlot).length;
  const duration = Math.max(0, Math.trunc(teamBoost ? tuning.teamBoosterTime : tuning.normalBoosterTime));
  runtime.tachometerNormalBoosterDuration = duration;
  runtime.physicsState = teamBoost ? 4 : 3;
  runtime.dualActiveSpeedLocked = false;
  runtime.stateRemainingMs = duration;
  state.boostTime = duration * 0.001;
  if (!runtime.raceMotionLocked) {
    runtime.resultBoosterCount = (runtime.resultBoosterCount + 1) >>> 0;
    runtime.chargerBoosterUses += 1;
    if (runtime.chargerEnabled && !runtime.chargerActive) runtime.chargerPendingUses += 1;
    vehicle.activateChargerIfReady();
  }
  return true;
}

/** Activate the charger on the configured nth booster use. */
export function activateVehicleCharger(vehicle: BoosterStateContext): void {
  const { runtime, tuning } = vehicle;
  const usesPerCharge = tuning.chargerSystemBoosterUseCount >>> 0;
  if (!runtime.chargerEnabled || usesPerCharge === 0 || runtime.chargerBoosterUses === 0
    || Math.trunc(runtime.chargerBoosterUses / usesPerCharge) <= runtime.chargerActivations
    || runtime.chargerExpiryMs > runtime.currentUpdateMs || runtime.chargerActive
    || runtime.chargerPendingUses !== usesPerCharge) return;
  runtime.chargerActive = true;
  runtime.chargerActivations += 1;
  runtime.chargerPendingUses = 0;
  const duration = vehicle.chargerDurationMs();
  runtime.chargerExpiryMs = (runtime.currentUpdateMs + duration) >>> 0;
}

export function vehicleChargerDurationMs(vehicle: BoosterStateContext): number {
  return Math.trunc(Math.max(1,
    float(float(vehicle.tuning.chargerSystemUseTime) * vehicle.runtime.chargerDurationScale)));
}

export function expireVehicleCharger(vehicle: BoosterStateContext, nowMs: number): void {
  const runtime = vehicle.runtime;
  if (runtime.chargerExpiryMs === 0 || !runtime.chargerActive || !runtime.chargerEnabled
    || nowMs <= runtime.chargerExpiryMs) return;
  runtime.chargerActive = false;
  runtime.chargerExpiryMs = 0;
  runtime.chargerPendingUses = 0;
}

/** Refresh the animation view and transition a prepared dual booster. */
export function updateVehicleDualBooster(vehicle: BoosterStateContext): void {
  const { runtime, tuning } = vehicle;
  runtime.animationInput = {
    physicsState: runtime.physicsState,
    displaySpeedKmh: runtime.cachedDisplaySpeedKmh,
    dualMode: runtime.dualBoosterMode,
    dualBoosterState: runtime.dualBoosterState,
    dualReadyRemainingMs: vehicle.dualBoosterReadyRemainingMs(),
  };
  if (runtime.physicsState === 10) {
    if (float(tuning.dualTransLowSpeed) > runtime.cachedDisplaySpeedKmh) {
      runtime.physicsState = runtime.dualBoosterTeam ? 4 : 3;
      runtime.dualBoosterState = 4;
      runtime.dualBoosterMode = 0;
      runtime.dualReadyRemainingMs = 0;
      runtime.dualActiveSpeedLocked = true;
      return;
    }
    runtime.dualBoosterMode = 3;
    runtime.dualReadyRemainingMs = 0;
    return;
  }
  const remaining = vehicle.refreshDualBoosterReady();
  if (remaining !== undefined) {
    if (vehicle.dualBoostAutoArm) runtime.dualBoosterState = 6;
    if (runtime.dualBoosterState === 6 && remaining <= 0) {
      runtime.dualBoosterTeam = runtime.physicsState === 4;
      runtime.physicsState = 10;
      runtime.dualBoosterState = 5;
      runtime.dualBoosterMode = 3;
      runtime.dualReadyRemainingMs = 0;
    }
  }
}

export function armVehicleDualBooster(vehicle: BoosterStateContext): void {
  if (vehicle.runtime.physicsState !== 3 && vehicle.runtime.physicsState !== 4) return;
  if (vehicle.refreshDualBoosterReady() !== undefined) vehicle.runtime.dualBoosterState = 6;
}

/** Calculate dual-booster readiness from elapsed boost ticks and speed. */
export function refreshVehicleDualBoosterReady(vehicle: BoosterStateContext): number | undefined {
  const { runtime, tuning } = vehicle;
  // Item races have no dual booster: the booster item (state 3 for itemBoosterTime)
  // must not arm or auto-chain into state 10 on a dual-booster engine.
  if (!tuning.dualBoosterEnabled || vehicle.itemMode) {
    runtime.dualReadyRemainingMs = 0;
    return;
  }
  if (runtime.dualActiveSpeedLocked && (runtime.physicsState === 3 || runtime.physicsState === 4)) {
    runtime.dualBoosterState = 4;
    runtime.dualBoosterMode = 0;
    runtime.dualReadyRemainingMs = 0;
    return;
  }
  const teamBoost = runtime.physicsState === 4;
  if (runtime.physicsState !== 3 && !teamBoost) {
    runtime.dualReadyRemainingMs = 0;
    vehicle.clearDualBoosterReady(runtime.physicsState === 0 ? 0 : 1);
    return;
  }
  const duration = Math.max(0, Math.trunc(teamBoost ? tuning.teamBoosterTime : tuning.normalBoosterTime));
  const elapsed = duration - runtime.stateRemainingMs;
  const tick = float(float(duration) / float(100));
  const minimum = Math.trunc(float(tick * float(tuning.dualBoosterTickMin)));
  const maximum = Math.trunc(float(tick * float(tuning.dualBoosterTickMax)));
  runtime.dualBoosterState = vehicle.classifyDualBoosterReady(elapsed, minimum, maximum);
  if (runtime.dualBoosterState < 6) {
    runtime.dualReadyRemainingMs = 0;
    vehicle.clearDualBoosterReady(runtime.dualBoosterState);
    return;
  }
  runtime.dualBoosterMode = 1;
  runtime.dualReadyRemainingMs = Math.max(0, maximum - elapsed);
  return maximum - elapsed;
}

export function classifyVehicleDualBoosterReady(
  vehicle: BoosterStateContext,
  elapsed: number,
  minimum: number,
  maximum: number,
): number {
  if (elapsed > maximum + 50) return 3;
  if (elapsed < minimum) return 2;
  if (float(vehicle.tuning.dualTransLowSpeed) > vehicle.runtime.cachedDisplaySpeedKmh) return 4;
  if (vehicle.runtime.dualBoosterState === 6) return 6;
  return vehicle.dualBoostAuto ? 7 : 8;
}

export function clearVehicleDualBoosterReady(vehicle: BoosterStateContext, state: number): void {
  vehicle.runtime.dualBoosterState = state;
  if (vehicle.runtime.dualBoosterMode === 1) vehicle.runtime.dualBoosterMode = 0;
}
