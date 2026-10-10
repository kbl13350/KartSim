import type { Vector3 } from "./continuous-motion";

export interface GiantVehicleScale {
  nativeFlattenWritten(scale: Vector3): void;
  nativeRestoreRequested(): void;
  updateVehicle(nowMs: number, publish: (primary: Vector3, secondary: Vector3, visual: Vector3) => void): void;
}

export interface VisualScaleContext {
  runtime: {
    obstacleSuppressionRemainingMs: number;
    raceMotionLocked: boolean;
    pressProtected1C0: boolean;
    pressState: number;
    obstacleSuppressionLatch: boolean;
    visualScaleRestorePending: boolean;
    visualScaleTransitionAnchorMs?: number;
    visualScaleA: Vector3;
    eventScaleMode: number;
    eventScaleAnchorMs: number;
    eventScaleDurationMs: number;
    eventScalePrimary: Vector3;
    eventScaleSecondary: Vector3;
    eventScaleStart: Vector3;
    eventScaleTarget: Vector3;
    gravityDivisor: number;
    gravityAnchorMs: number;
  };
  wheels: { grounded: boolean };
  flyingPetListeners: Array<(active: boolean) => void>;
  giant?: GiantVehicleScale;
  visualScaleMode(): number;
  updateEventScale(nowMs: number): void;
  updateVisualScale(nowMs: number): void;
}

const float = Math.fround;
const visualPulseKeyframes = [
  [0, 0.8999999761581421, 0.8999999761581421, 1.399999976158142],
  [100, 1.399999976158142, 1, 0.6000000238418579],
  [200, 0.699999988079071, 1, 1.2999999523162842],
  [300, 1.100000023841858, 1, 0.8999999761581421],
  [400, 0.800000011920929, 1, 1.2000000476837158],
  [500, 1.2000000476837158, 1, 0.800000011920929],
  [600, 1.2000000476837158, 1.2000000476837158, 1.2000000476837158],
];
const eventScaleKeyframes = [
  [0, 1, 1, 1], [400, 7, 7, 7], [500, 9, 7, 5],
  [600, 5, 7, 9], [700, 8, 7, 6], [800, 6, 7, 8],
  [850, 7.5, 7, 6.5], [900, 7, 7, 7],
];

/** Expire a squash/obstacle suppression period and restore pet/scale effects. */
export function advanceObstacleSuppression(vehicle: VisualScaleContext, elapsedMs: number): void {
  const runtime = vehicle.runtime;
  if (runtime.obstacleSuppressionRemainingMs <= 0) return;
  runtime.obstacleSuppressionRemainingMs = Math.max(0,
    runtime.obstacleSuppressionRemainingMs - Math.max(0, Math.trunc(elapsedMs)));
  if (runtime.obstacleSuppressionRemainingMs !== 0) return;
  if (!runtime.raceMotionLocked) runtime.pressProtected1C0 = false;
  runtime.pressState = 0;
  runtime.obstacleSuppressionLatch = false;
  if (vehicle.visualScaleMode() !== 0) runtime.visualScaleRestorePending = true;
  vehicle.flyingPetListeners.forEach(listener => listener(true));
}

/** Identify the axis flattened to 0.2 in the current presentation scale. */
export function vehicleVisualScaleMode(vehicle: VisualScaleContext): number {
  const scale = vehicle.runtime.visualScaleA;
  return scale.y === float(0.2) ? 3 : scale.x === float(0.2) ? 2
    : scale.z === float(0.2) ? 1 : 0;
}

export function setVehicleVisualScaleMode(vehicle: VisualScaleContext, mode: number): void {
  vehicle.runtime.visualScaleA = mode === 1
    ? { x: float(1.2), y: float(1.2), z: float(0.2) }
    : { x: float(0.2), y: float(1.2), z: float(1.2) };
  vehicle.giant?.nativeFlattenWritten(vehicle.runtime.visualScaleA);
}

/** Animate a flattened body back through the released 600 ms keyframes. */
export function updateVehicleVisualScale(vehicle: VisualScaleContext, nowMs: number): void {
  const runtime = vehicle.runtime;
  if (runtime.visualScaleRestorePending || runtime.visualScaleTransitionAnchorMs === 0) {
    runtime.visualScaleRestorePending = false;
    runtime.visualScaleTransitionAnchorMs = nowMs >>> 0;
  }
  const anchor = runtime.visualScaleTransitionAnchorMs;
  if (anchor === undefined) return;
  const elapsed = Math.min(600, Math.max(0, (nowMs >>> 0) - anchor));
  let index = 0;
  while (index + 1 < visualPulseKeyframes.length &&
    elapsed > visualPulseKeyframes[index + 1]![0]!) index += 1;
  const start = visualPulseKeyframes[index]!;
  const end = visualPulseKeyframes[Math.min(index + 1, visualPulseKeyframes.length - 1)]!;
  const duration = end[0]! - start[0]!;
  const progress = duration === 0 ? 0 : float(float(elapsed - start[0]!) / float(duration));
  const remaining = float(1 - progress);
  runtime.visualScaleA = {
    x: float(float(end[1]! * progress) + float(start[1]! * remaining)),
    y: float(float(end[2]! * progress) + float(start[2]! * remaining)),
    z: float(float(end[3]! * progress) + float(start[3]! * remaining)),
  };
  if (runtime.visualScaleA.x >= 1 && runtime.visualScaleA.y >= 1 && runtime.visualScaleA.z >= 1) {
    runtime.visualScaleA = { x: 1, y: 1, z: 1 };
    runtime.visualScaleTransitionAnchorMs = undefined;
  }
}

/** Let giant mode own scale presentation; otherwise run event and squash animation. */
export function updateVehicleScaleMode(vehicle: VisualScaleContext, nowMs: number): void {
  const runtime = vehicle.runtime;
  if (vehicle.giant) {
    if (runtime.visualScaleRestorePending) {
      runtime.visualScaleRestorePending = false;
      vehicle.giant.nativeRestoreRequested();
    }
    vehicle.giant.updateVehicle(nowMs, (primary, secondary, visual) => {
      runtime.eventScalePrimary = { ...primary };
      runtime.eventScaleSecondary = { ...secondary };
      runtime.visualScaleA = { ...visual };
    });
  } else {
    vehicle.updateEventScale(nowMs);
    vehicle.updateVisualScale(nowMs);
  }
}

function eventScaleBlend(from: number, to: number, firstWeight: number, secondWeight: number,
  progress: number, remaining: number): number {
  const seventh = float(float(to - from) / float(7));
  const first = float(float(seventh * float(firstWeight)) + from);
  const second = float(float(seventh * float(secondWeight)) + from);
  return float(float(second * progress) + float(first * remaining));
}

/** Apply the transient course scale event with independent primary/secondary curves. */
export function updateVehicleEventScale(vehicle: VisualScaleContext, nowMs: number): void {
  const runtime = vehicle.runtime;
  if (runtime.eventScaleMode !== 1) return;
  const now = nowMs >>> 0;
  if (runtime.eventScaleAnchorMs === 0) {
    runtime.eventScaleAnchorMs = now;
    runtime.eventScaleDurationMs = 950;
    runtime.eventScaleStart = { ...runtime.eventScalePrimary };
    runtime.eventScaleSecondary = { ...runtime.eventScaleStart };
  }
  const unsignedElapsed = (now - runtime.eventScaleAnchorMs) >>> 0;
  const elapsed = unsignedElapsed > 950 ? 950 : Math.max(0, now - runtime.eventScaleAnchorMs);
  const target = runtime.eventScaleTarget;
  const start = runtime.eventScaleStart;
  if (elapsed >= 950) {
    runtime.eventScalePrimary = { ...target };
  } else {
    let index = 0;
    while (index + 1 < eventScaleKeyframes.length && elapsed > eventScaleKeyframes[index + 1]![0]!) index += 1;
    const first = eventScaleKeyframes[index]!;
    const second = eventScaleKeyframes[index + 1] ?? [950, 7, 7, 7];
    const progress = float(float(elapsed - first[0]!) / float(second[0]! - first[0]!));
    const remaining = float(float(1) - progress);
    runtime.eventScalePrimary = {
      x: eventScaleBlend(start.x, target.x, first[1]!, second[1]!, progress, remaining),
      y: eventScaleBlend(start.y, target.y, first[2]!, second[2]!, progress, remaining),
      z: eventScaleBlend(start.z, target.z, first[3]!, second[3]!, progress, remaining),
    };
  }
  const secondaryElapsed = Math.min(elapsed, 600);
  const secondaryProgress = float(float(secondaryElapsed) / float(600));
  const secondaryRemaining = float(float(1) - secondaryProgress);
  runtime.eventScaleSecondary = {
    x: float(float(target.x * secondaryProgress) + float(start.x * secondaryRemaining)),
    y: float(float(target.y * secondaryProgress) + float(start.y * secondaryRemaining)),
    z: float(float(target.z * secondaryProgress) + float(start.z * secondaryRemaining)),
  };
  if (!(unsignedElapsed <= 950)) {
    runtime.eventScaleAnchorMs = 0;
    runtime.eventScaleMode = 0;
  }
}

export function updateVehicleEventGravity(vehicle: VisualScaleContext, nowMs: number): void {
  const runtime = vehicle.runtime;
  const now = nowMs >>> 0;
  if (runtime.gravityDivisor !== 1 && runtime.gravityAnchorMs === 0) {
    runtime.gravityAnchorMs = now;
    return;
  }
  if (((now - runtime.gravityAnchorMs) >>> 0) <= 1_000 || runtime.gravityDivisor === 1
    || !vehicle.wheels.grounded) return;
  runtime.gravityDivisor = 1;
  runtime.gravityAnchorMs = 0;
}
