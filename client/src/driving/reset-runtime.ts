import type { Vector3 } from "./continuous-motion";
import type { VehicleRuntime } from "./initial-state";
import { setBodyBasis } from "./orientation-math";

type VehicleBody = {
  position: Vector3;
  linearVelocity: Vector3;
  angularVelocity: Vector3;
  right: Vector3;
  forward: Vector3;
  up: Vector3;
};

export interface VehicleResetContext {
  body: VehicleBody;
  state: object;
  wheels: object;
  runtime: VehicleRuntime;
  scratch: { force: Vector3; torque: Vector3 };
  trackEventEffectRequests: unknown[];
  nitroSeamlessRequest: boolean;
  checkClientFramerate: boolean;
  clock: { reset(checkClientFramerate: boolean): void };
  tuning: { wallCollGaugeCooldownTime: number; driftMaxGauge: number };
  /** Item races: victim effects end with every reset. */
  itemEffects?: { clear(): void; resetState(): void };
  createBody(): VehicleBody;
  createState(): object;
  createWheelRuntime(): object;
  createRuntime(): VehicleRuntime;
  syncPresentationFields(): void;
  reset(x: number, y: number, z: number, heading: number): void;
  clearResetGaugeRefill(): void;
  commitDriftGauge(): void;
  stepSubstep(seconds: number, input: unknown, track: unknown): void;
  updateCachedDisplaySpeed(): void;
}

export interface RoutePose {
  position: Vector3;
  forward: Vector3;
  up: Vector3;
}

const f32 = Math.fround;
function cloneVector(vector: Vector3): Vector3 {
  return { x: vector.x, y: vector.y, z: vector.z };
}
function zeroVector(vector: Vector3): void {
  vector.x = 0;
  vector.y = 0;
  vector.z = 0;
}
function cross(left: Vector3, right: Vector3): Vector3 {
  return {
    x: f32(f32(left.y * right.z) - f32(left.z * right.y)),
    y: f32(f32(left.z * right.x) - f32(left.x * right.z)),
    z: f32(f32(left.x * right.y) - f32(left.y * right.x)),
  };
}
function normalize(vector: Vector3): Vector3 {
  const lengthSquared = f32(f32(f32(vector.x * vector.x) + f32(vector.y * vector.y)) + f32(vector.z * vector.z));
  const length = f32(Math.sqrt(lengthSquared));
  return length === 0
    ? { x: 1, y: 1, z: 1 }
    : { x: f32(vector.x / length), y: f32(vector.y / length), z: f32(vector.z / length) };
}

/** Reinitialize all simulation state while retaining public body/state/wheel object references. */
export function resetVehicle(vehicle: VehicleResetContext, x: number, y: number, z: number, heading: number): void {
  Object.assign(vehicle.body, vehicle.createBody());
  vehicle.body.position = { x, y, z };
  vehicle.body.right = { x: Math.cos(heading), y: 0, z: -Math.sin(heading) };
  vehicle.body.forward = { x: Math.sin(heading), y: 0, z: Math.cos(heading) };
  vehicle.body.up = { x: 0, y: 1, z: 0 };
  Object.assign(vehicle.state, vehicle.createState());
  Object.assign(vehicle.wheels, vehicle.createWheelRuntime());
  vehicle.runtime = vehicle.createRuntime();
  vehicle.itemEffects?.resetState();
  zeroVector(vehicle.scratch.force);
  zeroVector(vehicle.scratch.torque);
  vehicle.trackEventEffectRequests = [];
  vehicle.nitroSeamlessRequest = false;
  vehicle.clock.reset(vehicle.checkClientFramerate);
  vehicle.syncPresentationFields();
}

/** Align a fresh vehicle to a route sample after clearing its old motion. */
export function resetVehicleFromRoute(vehicle: VehicleResetContext, frame: Pick<RoutePose, "position" | "forward">): void {
  vehicle.reset(frame.position.x, frame.position.y, frame.position.z, 0);
  const forward = { x: frame.forward.x, y: f32(-frame.forward.z), z: frame.forward.y };
  const reverse = { x: f32(-forward.x), y: f32(-forward.y), z: f32(-forward.z) };
  const right = normalize(cross(reverse, { x: 0, y: 0, z: 1 }));
  const up = normalize(cross(right, reverse));
  setBodyBasis(vehicle.body, [
    { x: right.x, y: reverse.x, z: up.x },
    { x: right.y, y: reverse.y, z: up.y },
    { x: right.z, y: reverse.z, z: up.z },
  ]);
  vehicle.syncPresentationFields();
}

/** Enter a checkpoint reset and schedule gauge refund only when eligible. */
export function beginVehicleReset(vehicle: VehicleResetContext, immediate: boolean): boolean {
  const runtime = vehicle.runtime;
  if (immediate && runtime.fullPhysicsBypass) return false;
  vehicle.itemEffects?.clear();
  runtime.fullPhysicsBypass = true;
  runtime.automaticResetInteractionActive = false;
  runtime.interactionActive = false;
  if (!(vehicle.tuning.wallCollGaugeCooldownTime >>> 0)) return true;
  runtime.wallCollisionAnchorMs = 0;
  if (immediate) {
    vehicle.clearResetGaugeRefill();
    return true;
  }
  if (runtime.driftGaugeWindow) vehicle.commitDriftGauge();
  runtime.resetRefillAnchorMs = runtime.currentUpdateMs;
  if (runtime.committedGauge !== f32(vehicle.tuning.driftMaxGauge)) {
    runtime.resetRefillInitial = f32(1.01);
    runtime.resetRefillRemaining = f32(1.01);
  } else {
    vehicle.clearResetGaugeRefill();
  }
  return true;
}

export function prepareVehicleLowHeightReset(vehicle: VehicleResetContext): void {
  vehicle.body.position.y = 0;
  zeroVector(vehicle.body.linearVelocity);
  zeroVector(vehicle.body.angularVelocity);
  vehicle.syncPresentationFields();
}

/** Copy a checkpoint pose; optionally clear the previous linear and angular velocity. */
export function placeVehicleAtCheckpoint(vehicle: VehicleResetContext, frame: RoutePose, clearMotion: boolean): void {
  const body = vehicle.body;
  body.position = cloneVector(frame.position);
  body.forward = cloneVector(frame.forward);
  body.up = cloneVector(frame.up);
  const forward = { x: frame.forward.x, y: f32(-frame.forward.z), z: frame.forward.y };
  const up = { x: frame.up.x, y: f32(-frame.up.z), z: frame.up.y };
  const side = cross(forward, up);
  const reverseSide = { x: f32(-side.x), y: f32(-side.y), z: f32(-side.z) };
  body.right = { x: reverseSide.x, y: reverseSide.z, z: f32(-reverseSide.y) };
  if (clearMotion) {
    zeroVector(body.linearVelocity);
    zeroVector(body.angularVelocity);
  }
  vehicle.syncPresentationFields();
}

export function warpVehiclePosition(vehicle: VehicleResetContext, position: Vector3): void {
  vehicle.body.position = cloneVector(position);
  vehicle.syncPresentationFields();
}

/** Run one neutral physics substep to settle a newly placed kart. */
export function settleVehicle(
  vehicle: VehicleResetContext,
  seconds: number,
  track: unknown,
  neutralInput: unknown,
): void {
  vehicle.stepSubstep(seconds, neutralInput, track);
  vehicle.updateCachedDisplaySpeed();
  vehicle.syncPresentationFields();
}
