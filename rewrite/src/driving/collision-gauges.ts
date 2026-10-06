/** Vehicle gauge changes driven by speed, wall contacts, and reset recovery. */

export interface GaugeVector { x: number; y: number; z: number }

export interface CollisionGaugeContext {
  tuning: {
    driftMaxGauge: number;
    instAccelGaugeLength: number;
    autoChargeLowSpeed: number;
    chargeInstAccelGaugeByGrip: number;
    chargeInstAccelGaugeByBoost: number;
    chargeInstAccelGaugeByBoostAdded: number;
    instAccelGaugeCooldownTime: number;
    instAccelGaugeMinVelLoss: number;
    instAccelGaugeMinVelBound: number;
    chargeInstAccelGaugeByWall: number;
    chargeInstAccelGaugeByWallAdded: number;
    wallCollGaugeCooldownTime: number;
    wallCollGaugeMaxVelLoss: number;
    wallCollGaugeMinVelLoss: number;
  };
  runtime: {
    committedGauge: number;
    pendingGauge: number;
    instantGauge: number;
    instantAccelerationActive: boolean;
    cachedDisplaySpeedKmh: number;
    physicsState: number;
    chargerEnabled: boolean;
    chargerActive: boolean;
    instantWallCollisionAnchorMs: number;
    instantWallCooldownAnchorMs: number;
    instantWallPreSpeedKmh: number;
    resetRefillRemaining: number;
    resetRefillInitial: number;
    resetRefillAnchorMs: number;
    wallCollisionAnchorMs: number;
    wallCollisionPreSpeedKmh: number;
    currentUpdateMs: number;
  };
  state: { boostGauge: number; driftEnergy: number };
  body: { linearVelocity: GaugeVector };
  mainGaugeRatio(): number;
  timeAttackTachometerCollision(): { crash: boolean };
  setWallGaugeRefill(amount: number): void;
  clearResetGaugeRefill(): void;
}

export interface VehiclePresentationContext extends Omit<CollisionGaugeContext, "runtime" | "state" | "body"> {
  runtime: CollisionGaugeContext["runtime"] & {
    localForwardSpeed: number;
    localRightSpeed: number;
    visualScaleA: GaugeVector;
    steeringAngle: number;
  };
  state: CollisionGaugeContext["state"] & {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    heading: number; yawRate: number;
    right: GaugeVector; forward: GaugeVector; up: GaugeVector;
    visualScale: GaugeVector;
    forwardSpeed: number; lateralSpeed: number; slipAngle: number;
    steering: number; wheelCompression: number[];
  };
  body: CollisionGaugeContext["body"] & {
    position: GaugeVector;
    angularVelocity: GaugeVector;
    right: GaugeVector;
    forward: GaugeVector;
    up: GaugeVector;
  };
  wheels: { compression: number[] };
  collisionShape: { scaleX: number; scaleY: number; rawHeight: number };
  updatePublicGauge(): void;
}

const float = Math.fround;

/** Publish the normalized main gauge and still-pending drift charge. */
export function publishVehicleGauge(vehicle: Pick<CollisionGaugeContext, "state" | "runtime" | "mainGaugeRatio">): void {
  vehicle.state.boostGauge = vehicle.mainGaugeRatio();
  vehicle.state.driftEnergy = vehicle.runtime.pendingGauge;
}

export function mainVehicleGaugeRatio(vehicle: Pick<CollisionGaugeContext, "tuning" | "runtime">): number {
  const capacity = float(Math.max(vehicle.tuning.driftMaxGauge, 1));
  return float(Math.min(capacity,
    float(vehicle.runtime.committedGauge + vehicle.runtime.pendingGauge)) / capacity);
}

/** Charge at speed, or drain the meter while instant acceleration is active. */
export function updateInstantAccelerationCharge(vehicle: CollisionGaugeContext, seconds: number): void {
  const { runtime, tuning } = vehicle;
  const capacity = float(tuning.instAccelGaugeLength);
  if (!(capacity > 0)) return;
  if (runtime.instantAccelerationActive) {
    runtime.instantGauge = float(Math.max(0,
      float(runtime.instantGauge - float(float(1_000) * seconds))));
    if (!(runtime.instantGauge > 0)) runtime.instantAccelerationActive = false;
    return;
  }
  if (!(float(runtime.cachedDisplaySpeedKmh) >= float(tuning.autoChargeLowSpeed))) return;
  let rate = runtime.physicsState === 0
    ? tuning.chargeInstAccelGaugeByGrip : tuning.chargeInstAccelGaugeByBoost;
  if (runtime.physicsState !== 0 && runtime.chargerEnabled && runtime.chargerActive) {
    rate = float(rate + tuning.chargeInstAccelGaugeByBoostAdded);
  }
  const charge = float(float(float(rate) * seconds) * capacity);
  runtime.instantGauge = float(Math.min(capacity, float(runtime.instantGauge + charge)));
}

/** Settle a wall-speed-loss sample after its 500 ms observation window. */
export function settleInstantWallCharge(vehicle: CollisionGaugeContext, nowMs: number): void {
  const { runtime, tuning } = vehicle;
  const cooldown = tuning.instAccelGaugeCooldownTime >>> 0;
  const capacity = float(tuning.instAccelGaugeLength);
  if (cooldown === 0 || !(capacity > 0)) return;
  const now = nowMs >>> 0;
  const anchor = runtime.instantWallCollisionAnchorMs >>> 0;
  if (anchor === 0) {
    runtime.instantWallPreSpeedKmh = runtime.cachedDisplaySpeedKmh;
    return;
  }
  if (runtime.instantWallCooldownAnchorMs !== 0 || now < ((anchor + 500) >>> 0)) return;
  runtime.instantWallCollisionAnchorMs = 0;
  runtime.instantWallCooldownAnchorMs = now;
  if (float(runtime.instantWallPreSpeedKmh - runtime.cachedDisplaySpeedKmh) < tuning.instAccelGaugeMinVelLoss) {
    runtime.instantWallCooldownAnchorMs = 0;
    return;
  }
  const rate = runtime.chargerEnabled && runtime.chargerActive
    ? float(tuning.chargeInstAccelGaugeByWall + tuning.chargeInstAccelGaugeByWallAdded)
    : tuning.chargeInstAccelGaugeByWall;
  const charge = float(float(rate) * capacity);
  runtime.instantGauge = float(Math.min(capacity, float(runtime.instantGauge + charge)));
}

/** Start a new wall-speed observation when the cooldown and speed gates pass. */
export function beginInstantWallChargeWindow(vehicle: CollisionGaugeContext, nowMs: number): void {
  const { runtime, tuning } = vehicle;
  const cooldown = tuning.instAccelGaugeCooldownTime >>> 0;
  if (cooldown === 0 || !(tuning.instAccelGaugeLength > 0)
    || !(float(runtime.cachedDisplaySpeedKmh) >= float(tuning.instAccelGaugeMinVelBound))
    || runtime.instantWallCollisionAnchorMs !== 0) return;
  const now = nowMs >>> 0;
  if (now <= ((runtime.instantWallCooldownAnchorMs + cooldown) >>> 0)) return;
  runtime.instantWallCooldownAnchorMs = 0;
  runtime.instantWallCollisionAnchorMs = now;
}

/** Return the promised fraction of the gauge over the first 500 ms after a reset. */
export function advanceResetGaugeRefill(vehicle: CollisionGaugeContext, seconds: number, nowMs: number): void {
  const { runtime, tuning } = vehicle;
  const cooldown = tuning.wallCollGaugeCooldownTime >>> 0;
  if (cooldown === 0 || !(runtime.resetRefillRemaining > 0)) return;
  const now = nowMs >>> 0;
  const anchor = runtime.resetRefillAnchorMs >>> 0;
  if (!(now < ((anchor + cooldown) >>> 0))) {
    vehicle.clearResetGaugeRefill();
    return;
  }
  const capacity = float(Math.max(tuning.driftMaxGauge, 1));
  let amount: number;
  if (!(now < ((anchor + 500) >>> 0))) {
    amount = float(runtime.resetRefillRemaining * capacity);
    vehicle.clearResetGaugeRefill();
  } else {
    const fraction = float(float(runtime.resetRefillInitial * seconds) * float(2));
    const remaining = runtime.resetRefillRemaining;
    if (fraction < remaining) {
      amount = float(fraction * capacity);
      runtime.resetRefillRemaining = float(remaining - fraction);
    } else {
      amount = float(remaining * capacity);
      vehicle.clearResetGaugeRefill();
    }
  }
  runtime.committedGauge = float(Math.min(capacity, float(runtime.committedGauge + amount)));
}

/** Begin the wall collision observation used by the post-crash gauge refund. */
export function beginWallGaugeWindow(vehicle: CollisionGaugeContext): void {
  const { runtime, tuning } = vehicle;
  const cooldown = tuning.wallCollGaugeCooldownTime >>> 0;
  const capacity = float(Math.max(float(tuning.driftMaxGauge), float(1)));
  if (cooldown === 0 || !vehicle.timeAttackTachometerCollision().crash
    || capacity === float(1) || runtime.wallCollisionAnchorMs !== 0) return;
  const now = runtime.currentUpdateMs >>> 0;
  if (now <= ((runtime.resetRefillAnchorMs + cooldown) >>> 0)) return;
  runtime.resetRefillAnchorMs = 0;
  runtime.wallCollisionAnchorMs = now;
}

/** Convert observed speed loss to a gauge refund fraction. */
export function settleWallGaugeWindow(vehicle: CollisionGaugeContext, nowMs: number): void {
  const { runtime, tuning } = vehicle;
  if (!(tuning.wallCollGaugeCooldownTime >>> 0)) return;
  const anchor = runtime.wallCollisionAnchorMs >>> 0;
  if (anchor === 0) {
    runtime.wallCollisionPreSpeedKmh = runtime.cachedDisplaySpeedKmh;
    return;
  }
  if (runtime.resetRefillAnchorMs !== 0 || (nowMs >>> 0) < ((anchor + 500) >>> 0)) return;
  runtime.wallCollisionAnchorMs = 0;
  runtime.resetRefillAnchorMs = nowMs >>> 0;
  const loss = float(runtime.wallCollisionPreSpeedKmh - runtime.cachedDisplaySpeedKmh);
  const maxLoss = float(tuning.wallCollGaugeMaxVelLoss);
  const minLoss = float(tuning.wallCollGaugeMinVelLoss);
  if (Number.isNaN(loss) || Number.isNaN(minLoss)) {
    runtime.resetRefillAnchorMs = 0;
    return;
  }
  if (loss >= maxLoss) vehicle.setWallGaugeRefill(float(1.01));
  else if (loss < minLoss) runtime.resetRefillAnchorMs = 0;
  else vehicle.setWallGaugeRefill(float(float(loss - minLoss) / float(maxLoss - minLoss)));
}

export function setWallGaugeRefund(vehicle: CollisionGaugeContext, fraction: number): void {
  vehicle.runtime.resetRefillInitial = float(fraction);
  vehicle.runtime.resetRefillRemaining = float(fraction);
}

export function clearWallGaugeRefund(vehicle: CollisionGaugeContext): void {
  vehicle.runtime.resetRefillInitial = 0;
  vehicle.runtime.resetRefillRemaining = 0;
}

/** Cache linear speed in km/h at the release's float32 calculation points. */
export function cacheDisplaySpeed(vehicle: Pick<CollisionGaugeContext, "runtime" | "body">): void {
  const { x, y, z } = vehicle.body.linearVelocity;
  const add = (left: number, right: number) => Number.isNaN(right) ? float(right)
    : Number.isNaN(left) ? float(left) : float(left + right);
  const multiply = (left: number, right: number) => Number.isNaN(right) ? float(right)
    : Number.isNaN(left) ? float(left) : float(left * right);
  const squared = add(add(multiply(x, x), multiply(z, z)), multiply(y, y));
  const speed = float(Math.sqrt(float(squared)));
  vehicle.runtime.cachedDisplaySpeedKmh = float(speed * float(3.5999999046325684));
}

/** Copy the completed physics slice into the public vehicle presentation state. */
export function syncVehiclePresentation(vehicle: VehiclePresentationContext): void {
  const { runtime, body, state, wheels, collisionShape } = vehicle;
  const forwardSpeed = runtime.localForwardSpeed;
  const lateralSpeed = runtime.localRightSpeed;
  state.x = body.position.x;
  state.y = body.position.y;
  state.z = body.position.z;
  state.vx = body.linearVelocity.x;
  state.vy = body.linearVelocity.y;
  state.vz = body.linearVelocity.z;
  state.heading = Math.atan2(body.forward.x, body.forward.z);
  state.yawRate = body.angularVelocity.y;
  state.right = { ...body.right };
  state.forward = { ...body.forward };
  state.up = { ...body.up };
  state.visualScale = {
    x: float(runtime.visualScaleA.x * collisionShape.scaleX),
    y: float(runtime.visualScaleA.z * collisionShape.rawHeight),
    z: float(runtime.visualScaleA.y * collisionShape.scaleY),
  };
  state.forwardSpeed = forwardSpeed;
  state.lateralSpeed = lateralSpeed;
  state.slipAngle = Math.atan2(lateralSpeed, Math.abs(forwardSpeed) + 1e-4);
  state.steering = runtime.steeringAngle;
  state.wheelCompression = [...wheels.compression];
  vehicle.updatePublicGauge();
}
