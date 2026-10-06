import type { Vector3 } from "./continuous-motion";

export interface CollisionResetContext {
  runtime: {
    automaticResetLowCollisionTime: number;
    automaticResetHighCollisionTime: number;
    automaticResetObstacleTime: number;
    automaticResetRequest: boolean;
    pressState: number;
    obstacleSuppressionRemainingMs: number;
    pressProtected1C0: boolean;
    collisionResponseMagnitudeB6C: number;
    obstacleSuppressionLatch: boolean;
  };
  body: { linearVelocity: Vector3; angularVelocity: Vector3 };
  flyingPetListeners: Array<(active: boolean) => void>;
  setVisualScaleMode(mode: number): void;
  advanceAutomaticResetTimer(elapsed: number, interrupted: boolean,
    seconds: number, threshold: number): number;
}

const float = Math.fround;

/** Count continuous low/high vehicle-wall contact separately. */
export function updatePrimaryCollisionResetTimers(
  vehicle: CollisionResetContext,
  collision: { responseHit: boolean; lowHit: boolean },
  seconds: number,
): void {
  vehicle.runtime.automaticResetLowCollisionTime = vehicle.advanceAutomaticResetTimer(
    vehicle.runtime.automaticResetLowCollisionTime,
    !collision.responseHit || !collision.lowHit,
    seconds,
    float(1),
  );
  vehicle.runtime.automaticResetHighCollisionTime = vehicle.advanceAutomaticResetTimer(
    vehicle.runtime.automaticResetHighCollisionTime,
    !collision.responseHit || collision.lowHit,
    seconds,
    float(1),
  );
}

/** Count a sustained obstacle collision toward an automatic reset. */
export function updateObstacleCollisionResetTimer(
  vehicle: CollisionResetContext,
  collided: boolean,
  seconds: number,
): void {
  vehicle.runtime.automaticResetObstacleTime = vehicle.advanceAutomaticResetTimer(
    vehicle.runtime.automaticResetObstacleTime,
    !collided,
    seconds,
    float(0.4),
  );
}

export function advanceCollisionResetTimer(
  vehicle: Pick<CollisionResetContext, "runtime">,
  elapsed: number,
  interrupted: boolean,
  seconds: number,
  threshold: number,
): number {
  if (interrupted) return 0;
  const next = float(elapsed + seconds);
  if (next > threshold) vehicle.runtime.automaticResetRequest = true;
  return next;
}

/** Enter the directional squash presentation and request a reset. */
export function activateDirectionalCollisionPress(
  vehicle: CollisionResetContext,
  mode: number,
): void {
  vehicle.runtime.pressState = mode;
  vehicle.setVisualScaleMode(mode);
  vehicle.flyingPetListeners.forEach(listener => listener(false));
  vehicle.runtime.obstacleSuppressionRemainingMs = 2_000;
  vehicle.runtime.automaticResetRequest = true;
}

/** Enter a hard press and stop both linear and angular motion. */
export function activateHardCollisionPress(vehicle: CollisionResetContext): void {
  vehicle.runtime.pressState = 1;
  vehicle.setVisualScaleMode(1);
  vehicle.flyingPetListeners.forEach(listener => listener(false));
  vehicle.runtime.obstacleSuppressionRemainingMs = 500;
  vehicle.runtime.pressProtected1C0 = true;
  vehicle.body.linearVelocity.x = 0;
  vehicle.body.linearVelocity.y = 0;
  vehicle.body.linearVelocity.z = 0;
  vehicle.body.angularVelocity.x = 0;
  vehicle.body.angularVelocity.y = 0;
  vehicle.body.angularVelocity.z = 0;
  vehicle.runtime.collisionResponseMagnitudeB6C = 0;
  vehicle.runtime.obstacleSuppressionLatch = true;
}
