import type { Vector3 } from "./continuous-motion";

export interface CollisionBox {
  center: Vector3;
  axes: Vector3[];
  halfExtents: number[];
}

export interface TrackCollisionEvent {
  scalePercent?: number;
  gravity?: number;
  effect?: string;
}

export interface CollisionEventTrack {
  queryEventObb?(box: CollisionBox, nowMs: number): Iterable<TrackCollisionEvent>;
}

export interface CollisionEventContext {
  body: { position: Vector3; right: Vector3; forward: Vector3; up: Vector3 };
  collisionShape: {
    rawHeight: number;
    rawHalfWidth: number;
    rawHalfLength: number;
    scaleX: number;
    scaleY: number;
  };
  scratch: { v0: Vector3; obb: CollisionBox };
  runtime: {
    currentUpdateMs: number;
    raceMotionLocked: boolean;
    resultCrashAnchorMs: number;
    resultCrashCount: number;
    collisionMotionHit: boolean;
  };
  trackEventEffectRequests: Array<{ effect: string; atMs: number }>;
  secondaryCollisionBox(): CollisionBox;
  triggerEventScale(scalePercent: number): boolean;
  triggerEventGravity(gravity: number): boolean;
  beginWallCollision(): void;
  beginInstantWallCharge(nowMs: number): void;
}

const float = Math.fround;

/** Count a crash at most once per two second result window. */
export function countVehicleResultCrash(vehicle: CollisionEventContext): void {
  const runtime = vehicle.runtime;
  if (runtime.raceMotionLocked) return;
  const now = runtime.currentUpdateMs >>> 0;
  if (runtime.resultCrashAnchorMs !== 4294967295
    && ((now - runtime.resultCrashAnchorMs) >>> 0) <= 2_000) return;
  runtime.resultCrashCount = (runtime.resultCrashCount + 1) >>> 0;
  runtime.resultCrashAnchorMs = now;
}

/** Dispatch course scale/gravity/effect events hit by the vehicle's second OBB. */
export function resolveVehicleTrackEvents(vehicle: CollisionEventContext, track: CollisionEventTrack): void {
  if (!track.queryEventObb) return;
  const now = Math.trunc(vehicle.runtime.currentUpdateMs) >>> 0;
  for (const event of track.queryEventObb(vehicle.secondaryCollisionBox(), now)) {
    if (event.scalePercent !== undefined && !vehicle.triggerEventScale(event.scalePercent)) {
      throw new Error(`event scale ${event.scalePercent} 不在已证 P3528 语料。`);
    }
    if (event.gravity !== undefined && !vehicle.triggerEventGravity(event.gravity)) {
      throw new Error(`event gravity ${event.gravity} 不在已证 P3528 语料。`);
    }
    if (event.effect) vehicle.trackEventEffectRequests.push({ effect: event.effect, atMs: now });
  }
}

/** Position the event query box above the wheel contact plane. */
export function makeSecondaryCollisionBox(vehicle: CollisionEventContext): CollisionBox {
  const height = float(vehicle.collisionShape.rawHeight);
  const { body, scratch } = vehicle;
  scratch.v0.x = float(body.up.x * height);
  scratch.v0.y = float(body.up.y * height);
  scratch.v0.z = float(body.up.z * height);
  const box = scratch.obb;
  box.center.x = float(body.position.x + scratch.v0.x);
  box.center.y = float(body.position.y + scratch.v0.y);
  box.center.z = float(body.position.z + scratch.v0.z);
  box.axes[0] = body.right;
  box.axes[1] = body.forward;
  box.axes[2] = body.up;
  box.halfExtents[0] = float(vehicle.collisionShape.rawHalfWidth * vehicle.collisionShape.scaleX);
  box.halfExtents[1] = float(vehicle.collisionShape.rawHalfLength * vehicle.collisionShape.scaleY);
  box.halfExtents[2] = float(float(0.699999988079071) * height);
  return box;
}

/** Start both collision charge windows on a motion or supplied contact hit. */
export function updateVehicleCollisionGaugeOwners(vehicle: CollisionEventContext, contactHit: boolean): void {
  if (!vehicle.runtime.collisionMotionHit && !contactHit) return;
  vehicle.beginWallCollision();
  vehicle.beginInstantWallCharge(vehicle.runtime.currentUpdateMs);
}
