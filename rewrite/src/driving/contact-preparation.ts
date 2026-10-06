import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface ContactPreparationContext {
  body: { linearVelocity: Vector3; forward: Vector3; right: Vector3; up: Vector3 };
  wheels: {
    grounded: boolean;
    roadDescriptor?: SurfaceDescriptor;
    surfaceVelocity: Vector3;
  };
  runtime: {
    stagedExternalForce: Vector3;
    stagedExternalTorque: Vector3;
    localForwardSpeed: number;
    localRightSpeed: number;
    localUpSpeed: number;
    bodySpeed: number;
    committedGauge: number;
    tachometerIncGauge: boolean;
    contactWorking: boolean;
    physicsState: number;
    driftGaugeWindow: boolean;
    cachedDisplaySpeedKmh: number;
    liveForwardAccel: number;
    liveDragFactor: number;
    railResetRequest: boolean;
  };
  tuning: {
    driftMaxGauge: number;
    chargeBoostBySpeed: number;
    autoChargeLowSpeed: number;
  };
}

const float = Math.fround;
const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function roadDot(left: Vector3, right: Vector3): number {
  return sum(sum(product(left.x, right.x), product(left.z, right.z)),
    product(left.y, right.y));
}

function clear(vector: Vector3): void {
  vector.x = 0;
  vector.y = 0;
  vector.z = 0;
}

function surface(vehicle: Pick<ContactPreparationContext, "wheels">): string | undefined {
  return vehicle.wheels.roadDescriptor?.road.attributes.find(attribute =>
    attribute.name === "surface")?.value;
}

/** Consume staged impulses and refresh velocity projections before ray probing. */
export function rebuildVehicleBodyState(
  vehicle: ContactPreparationContext,
  force: Vector3,
  torque: Vector3,
): void {
  const { body, wheels, runtime } = vehicle;
  Object.assign(force, runtime.stagedExternalForce);
  Object.assign(torque, runtime.stagedExternalTorque);
  clear(runtime.stagedExternalForce);
  clear(runtime.stagedExternalTorque);
  clear(wheels.surfaceVelocity);
  runtime.localForwardSpeed = roadDot(body.linearVelocity, body.forward);
  runtime.localRightSpeed = roadDot(body.linearVelocity, body.right);
  runtime.localUpSpeed = roadDot(body.linearVelocity, body.up);
  runtime.bodySpeed = float(Math.sqrt(roadDot(body.linearVelocity, body.linearVelocity)));
}

/** Apply the bcharge road tile's immediate drift meter fill. */
export function applyBoosterChargeRoad(vehicle: ContactPreparationContext): void {
  if (surface(vehicle) !== "bcharge") return;
  const limit = float(Math.max(vehicle.tuning.driftMaxGauge, 1));
  vehicle.runtime.committedGauge = float(Math.min(limit,
    float(vehicle.runtime.committedGauge + float(1.6))));
}

/** Decide whether speed charging is available for this physics slice. */
export function updateSpeedChargeEligibility(
  vehicle: ContactPreparationContext,
  full3DRail: boolean,
): void {
  const { runtime, tuning } = vehicle;
  const maximum = float(Math.max(float(tuning.driftMaxGauge), float(1)));
  runtime.tachometerIncGauge = float(tuning.chargeBoostBySpeed) !== 0 &&
    maximum !== float(1) &&
    (full3DRail || runtime.contactWorking) &&
    runtime.physicsState === 0 &&
    !runtime.driftGaugeWindow &&
    float(runtime.cachedDisplaySpeedKmh) >= float(tuning.autoChargeLowSpeed);
}

/** A jump surface supplies a short acceleration and lower drag factor. */
export function applyJumpRoadTuning(vehicle: ContactPreparationContext): void {
  if (!vehicle.wheels.grounded || surface(vehicle) !== "점프") return;
  vehicle.runtime.liveForwardAccel = float(6_000);
  vehicle.runtime.liveDragFactor = float(0.5);
}

export function requestResetRoad(vehicle: ContactPreparationContext): void {
  if (surface(vehicle) === "리셋") vehicle.runtime.railResetRequest = true;
}
