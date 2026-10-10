/** Team boost charge queue and temporary converted nitro slots. */

export interface TeamGaugeContext {
  teamBooster: boolean;
  teamBoosterDirect: boolean;
  externalTeamGauge: boolean;
  speedRaceMode?: { kind: string };
  /** Item team races have no team booster gauge; the slots hold items, not nitro. */
  itemMode?: boolean;
  runtime: {
    teamGaugeCharge: number;
    teamGaugeQueue: number[];
    teamGaugeValue: number;
    teamGaugeTickMs: number;
    teamGaugeFullPending: boolean;
    teamGaugeSettledAtMs: number;
    speedSlots: number[];
    speedSlotDisabled: boolean[];
    teamSlotWindowEndMs: number;
  };
  state: { nitro: number };
  convertTeamBoosterSlots(nowMs: number, temporary: boolean): void;
}

const float = Math.fround;
const ordinaryBoosterSlot = 6;
const teamBoosterSlot = 14;
const isBoosterSlot = (slot: number) => slot === ordinaryBoosterSlot || slot === teamBoosterSlot;
const gaugeChargeDivisor = float(8_000);
const gaugeTravelRate = float(0.1);

/** Record a positive drift charge for the team meter. */
export function accumulateVehicleTeamGauge(vehicle: TeamGaugeContext, amount: number): void {
  if (vehicle.teamBooster && amount > 0) vehicle.runtime.teamGaugeCharge = amount;
}

export function consumeVehicleTeamGaugeCharge(vehicle: TeamGaugeContext): number {
  if (!vehicle.externalTeamGauge) return 0;
  const amount = vehicle.runtime.teamGaugeCharge;
  vehicle.runtime.teamGaugeCharge = 0;
  return amount;
}

export function enqueueVehicleTeamGaugeTarget(vehicle: TeamGaugeContext, fraction: number): void {
  if (vehicle.itemMode || !vehicle.externalTeamGauge || !Number.isFinite(fraction) ||
    fraction < 0 || fraction > 1) return;
  vehicle.runtime.teamGaugeQueue.push(float(fraction));
}

/** Move the team meter toward queued targets and promote nitro slots on completion. */
export function updateVehicleTeamGauge(vehicle: TeamGaugeContext, nowMs: number): void {
  const { runtime } = vehicle;
  const gripRace = vehicle.speedRaceMode?.kind === "grip";
  if (vehicle.itemMode || !vehicle.teamBooster || (vehicle.teamBoosterDirect &&
    (vehicle.convertTeamBoosterSlots(nowMs, false), !gripRace))) return;
  if (gripRace && !vehicle.teamBoosterDirect) vehicle.convertTeamBoosterSlots(nowMs, false);
  const charge = runtime.teamGaugeCharge;
  if (charge > 0 && !vehicle.externalTeamGauge && !gripRace) {
    const target = Math.min(1, float(float(charge / gaugeChargeDivisor) + runtime.teamGaugeValue));
    runtime.teamGaugeQueue.push(target);
    runtime.teamGaugeCharge = 0;
  }
  const queue = runtime.teamGaugeQueue;
  if (queue.length === 0) return;
  if (runtime.teamGaugeTickMs < 0) {
    runtime.teamGaugeTickMs = nowMs;
    return;
  }
  const increment = float(float(float(nowMs - runtime.teamGaugeTickMs) / 1_000) * gaugeTravelRate);
  const target = queue[0]!;
  const next = float(runtime.teamGaugeValue + increment);
  if (target >= next) {
    runtime.teamGaugeValue = next;
    return;
  }
  runtime.teamGaugeValue = target;
  runtime.teamGaugeTickMs = -1;
  queue.shift();
  if (target >= 1) {
    runtime.teamGaugeFullPending = true;
    runtime.teamGaugeSettledAtMs = nowMs >>> 0;
    vehicle.convertTeamBoosterSlots(nowMs, true);
    runtime.teamGaugeValue = 0;
  }
}

export function consumeVehicleTeamGaugeFullAnimation(vehicle: TeamGaugeContext): boolean {
  if (!vehicle.runtime.teamGaugeFullPending) return false;
  vehicle.runtime.teamGaugeFullPending = false;
  return true;
}

export function teamGaugeSettledAtMs(vehicle: TeamGaugeContext): number {
  return vehicle.runtime.teamGaugeSettledAtMs >>> 0;
}

/** Promote ordinary nitro slots into team slots, optionally locking them for 1 s. */
export function convertVehicleTeamBoosterSlots(vehicle: TeamGaugeContext, nowMs: number, temporary: boolean): void {
  const { runtime } = vehicle;
  const slots = runtime.speedSlots;
  let converted = false;
  for (let index = 0; index < slots.length; index += 1) {
    if (slots[index] === ordinaryBoosterSlot) {
      slots[index] = teamBoosterSlot;
      if (temporary) runtime.speedSlotDisabled[index] = true;
      converted = true;
    }
  }
  if (converted) {
    vehicle.state.nitro = slots.filter(isBoosterSlot).length;
    if (temporary) runtime.teamSlotWindowEndMs = nowMs + 1_000;
  }
}

export function expireVehicleTeamSlotWindow(vehicle: TeamGaugeContext, nowMs: number): void {
  const { runtime } = vehicle;
  const end = runtime.teamSlotWindowEndMs;
  if (end === 0 || nowMs < end) return;
  runtime.teamSlotWindowEndMs = 0;
  runtime.speedSlotDisabled.fill(false);
}

export function vehicleSpeedSlotDisabled(vehicle: TeamGaugeContext): boolean[] {
  return vehicle.runtime.speedSlotDisabled;
}

export function teamSlotWindowStartMs(vehicle: TeamGaugeContext): number {
  const end = vehicle.runtime.teamSlotWindowEndMs;
  return end === 0 ? -1 : end - 1_000;
}
