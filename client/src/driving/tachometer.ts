/** The race HUD reads these values from the same vehicle that runs physics. */
export interface VehicleTachometerContext {
  teamBooster: boolean;
  tuning: {
    autoChargeLowSpeed: number;
    instAccelGaugeLength: number;
    instAccelGaugeMinUsable: number;
    driftMaxGauge: number;
    chargerSystemBoosterUseCount: number;
    wallCollGaugeMinVelBound: number;
    wallCollGaugeCooldownTime: number;
  };
  runtime: {
    cachedDisplaySpeedKmh: number;
    instantGauge: number;
    instantWallCooldownAnchorMs: number;
    teamGaugeValue: number;
    speedSlots: number[];
    speedSlotDisabled: (boolean | undefined)[];
    speedSlotReorderedAtMs: number;
    speedSlotReorderedEdge: boolean;
    currentUpdateMs: number;
    instantAccelerationActive: boolean;
    tachometerIncGauge: number;
    chargerPendingUses: number;
    chargerActive: boolean;
    wallCollisionAnchorMs: number;
    resetRefillAnchorMs: number;
    resetRefillRemaining: number;
    tachometerNormalBoosterDuration?: number;
    tachometerGaugePreserveMarker: boolean;
    resultCrashCount: number;
    resultBoosterCount: number;
    animationSlot: number;
  };
  mainGaugeRatio(): number;
  timeAttackBoosterUnlimited(): boolean;
  canReorderSpeedSlots(): boolean;
  chargerDurationMs(): number;
}

const f32 = Math.fround;
const SLOT_REORDER_COOLDOWN_MS = 350;

export function vehicleTachometerSpeed(vehicle: VehicleTachometerContext) {
  return {
    displaySpeed: vehicle.runtime.cachedDisplaySpeedKmh,
    layerThreshold: vehicle.tuning.autoChargeLowSpeed,
  };
}

export function vehicleTachometerGauges(vehicle: VehicleTachometerContext) {
  const instantCapacity = f32(vehicle.tuning.instAccelGaugeLength);
  const unlimitedBooster = vehicle.timeAttackBoosterUnlimited();
  return {
    mainRatio: vehicle.mainGaugeRatio(),
    instantRatio: instantCapacity === 0
      ? 0
      : f32(f32(vehicle.runtime.instantGauge) / instantCapacity),
    wallCompensationEventId: vehicle.runtime.instantWallCooldownAnchorMs >>> 0,
    instantInterpolationMs: 500,
    teamRatio: unlimitedBooster ? 0 : vehicle.runtime.teamGaugeValue,
    teamBooster: unlimitedBooster ? false : vehicle.teamBooster,
  };
}

export function vehicleSpeedSlots(vehicle: VehicleTachometerContext): number[] {
  return vehicle.runtime.speedSlots;
}

export function canReorderVehicleSpeedSlots(vehicle: VehicleTachometerContext): boolean {
  const slots = vehicle.runtime.speedSlots;
  if (!vehicle.teamBooster || slots.length < 2) return false;
  const lastReordered = vehicle.runtime.speedSlotReorderedAtMs;
  if (lastReordered >= 0 && vehicle.runtime.currentUpdateMs - lastReordered <= SLOT_REORDER_COOLDOWN_MS) {
    return false;
  }
  const [first, second] = slots;
  return first !== -1 && second !== -1 && first !== second;
}

export function vehicleSlotChangerActive(vehicle: VehicleTachometerContext): boolean {
  return vehicle.teamBooster;
}

export function reorderVehicleSpeedSlots(vehicle: VehicleTachometerContext): boolean {
  if (!vehicle.canReorderSpeedSlots()) return false;
  const runtime = vehicle.runtime;
  [runtime.speedSlots[0], runtime.speedSlots[1]] = [runtime.speedSlots[1]!, runtime.speedSlots[0]!];
  [runtime.speedSlotDisabled[0], runtime.speedSlotDisabled[1]] = [
    runtime.speedSlotDisabled[1], runtime.speedSlotDisabled[0],
  ];
  runtime.speedSlotReorderedEdge = true;
  runtime.speedSlotReorderedAtMs = runtime.currentUpdateMs;
  return true;
}

export function consumeVehicleSpeedSlotReordered(vehicle: VehicleTachometerContext): boolean {
  const reordered = vehicle.runtime.speedSlotReorderedEdge;
  vehicle.runtime.speedSlotReorderedEdge = false;
  return reordered;
}

export function vehicleTachometerExceed(vehicle: VehicleTachometerContext) {
  const charge = f32(vehicle.runtime.instantGauge);
  const capacity = f32(vehicle.tuning.instAccelGaugeLength);
  const usableCharge = f32(vehicle.tuning.instAccelGaugeMinUsable);
  return {
    active: vehicle.runtime.instantAccelerationActive,
    usable: charge >= usableCharge,
    usableThresholdRatio: capacity === 0 ? 0 : Math.min(1, Math.max(0, f32(f32(usableCharge / capacity)))),
    full: charge === f32(vehicle.tuning.instAccelGaugeLength),
  };
}

export function vehicleBoosterUnlimited(vehicle: VehicleTachometerContext): boolean {
  return f32(Math.max(f32(vehicle.tuning.driftMaxGauge), f32(1))) === f32(1);
}

export function vehicleDriftMaxGauge(vehicle: VehicleTachometerContext): number {
  return vehicle.tuning.driftMaxGauge;
}

export function vehicleTachometerIncGauge(vehicle: VehicleTachometerContext): number {
  return vehicle.runtime.tachometerIncGauge;
}

export function vehicleTachometerCharger(vehicle: VehicleTachometerContext) {
  return {
    count: vehicle.runtime.chargerPendingUses >>> 0,
    capacity: vehicle.tuning.chargerSystemBoosterUseCount >>> 0,
    active: vehicle.runtime.chargerActive,
    durationMs: vehicle.chargerDurationMs(),
  };
}

export function vehicleTachometerCollision(vehicle: VehicleTachometerContext) {
  const speed = f32(vehicle.runtime.cachedDisplaySpeedKmh);
  const minimumSpeed = f32(vehicle.tuning.wallCollGaugeMinVelBound);
  return {
    crash: !Number.isNaN(speed) && !Number.isNaN(minimumSpeed) && speed >= minimumSpeed,
    charging: vehicle.runtime.wallCollisionAnchorMs !== 0 && vehicle.runtime.resetRefillAnchorMs === 0,
    timerEnabled: f32(vehicle.runtime.resetRefillRemaining) > 0,
    collisionAnchorMs: vehicle.runtime.wallCollisionAnchorMs >>> 0,
    refillAnchorMs: vehicle.runtime.resetRefillAnchorMs >>> 0,
    cooldownMs: vehicle.tuning.wallCollGaugeCooldownTime >>> 0,
  };
}

export function consumeVehicleNormalBoosterDuration(vehicle: VehicleTachometerContext): number | undefined {
  const duration = vehicle.runtime.tachometerNormalBoosterDuration;
  vehicle.runtime.tachometerNormalBoosterDuration = undefined;
  return duration;
}

export function consumeVehicleGaugePreserveMarker(vehicle: VehicleTachometerContext): boolean {
  const marker = vehicle.runtime.tachometerGaugePreserveMarker;
  vehicle.runtime.tachometerGaugePreserveMarker = false;
  return marker;
}

export function vehicleTimeAttackResultCounts(vehicle: VehicleTachometerContext) {
  return {
    crashCount: vehicle.runtime.resultCrashCount,
    boosterCount: vehicle.runtime.resultBoosterCount,
  };
}

export function vehicleTachometerAnimationState(vehicle: VehicleTachometerContext): number {
  return vehicle.runtime.animationSlot;
}
