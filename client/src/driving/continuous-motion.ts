/** Mutating float32 vehicle dynamics stages used by each AL physics substep. */

export interface Vector3 { x: number; y: number; z: number }

export interface DrivingInput { forward: number; reverse: number }

export interface SurfaceDescriptor {
  road: { attributes: Array<{ name: string; value: string }> };
}

export interface ContinuousMotionContext {
  body: {
    linearVelocity: Vector3;
    angularVelocity: Vector3;
    forward: Vector3;
    right: Vector3;
    up: Vector3;
  };
  wheels: {
    grounded: boolean;
    averageNormal: Vector3;
    roadDescriptor?: SurfaceDescriptor;
  };
  tuning: {
    backwardAccel: number;
    boostAccelFactor: number;
    driftBoostMulAccelFactor: number;
    driftEscapeForce: number;
    dualMulAccelFactor: number;
    gripBrake: number;
    instAccelFactor: number;
    mass: number;
    slipBrake: number;
    startForwardAccelSpeed: number;
    /** Item races only; missing values fall back to the speed-race fields. */
    startForwardAccelItem?: number;
    boostAccelFactorOnlyItem?: number;
    transAccelFactor: number;
    useTransformBooster: number;
    wallCollGaugeMinVelBound: number;
    airFriction: number;
  };
  runtime: {
    localForwardSpeed: number;
    localRightSpeed: number;
    hwContact: boolean;
    specialNormal: Vector3;
    raceMotionLocked: boolean;
    pressProtected1C0: boolean;
    liveForwardAccel: number;
    liveDragFactor: number;
    driveScale: number;
    dragScale: number;
    catchupDragScale: number;
    physicsState: number;
    animationSlot: number;
    draftAccelerationScale: number;
    instantAccelerationActive: boolean;
    cachedDisplaySpeedKmh: number;
    oneSubstepDrift: boolean;
    activeDrift: boolean;
    bodySpeed: number;
    massGravityForce: number;
    reverseAccumulator: number;
  };
  scratch: { v0: Vector3; v1: Vector3; v2: Vector3; v3: Vector3 };
  giant?: { forceBonus?: number };
  speedRaceMode?: { kind: string };
  itemMode?: boolean;
}

const f32 = Math.fround;

function clear(vector: Vector3): void {
  vector.x = 0; vector.y = 0; vector.z = 0;
}

function setScaled(target: Vector3, source: Vector3, scalar: number): void {
  target.x = f32(source.x * scalar);
  target.y = f32(source.y * scalar);
  target.z = f32(source.z * scalar);
}

function scale(vector: Vector3, scalar: number): void {
  vector.x = f32(vector.x * scalar);
  vector.y = f32(vector.y * scalar);
  vector.z = f32(vector.z * scalar);
}

function add(target: Vector3, source: Vector3): void {
  target.x = f32(target.x + source.x);
  target.y = f32(target.y + source.y);
  target.z = f32(target.z + source.z);
}

function subtract(target: Vector3, source: Vector3): void {
  target.x = f32(target.x - source.x);
  target.y = f32(target.y - source.y);
  target.z = f32(target.z - source.z);
}

// The released dot product accumulates x, z, y and rounds after each operation.
function dot(a: Vector3, b: Vector3): number {
  const product = (left: number, right: number) =>
    Number.isNaN(right) ? f32(right) : Number.isNaN(left) ? f32(left) : f32(left * right);
  const sum = (left: number, right: number) =>
    Number.isNaN(right) ? f32(right) : Number.isNaN(left) ? f32(left) : f32(left + right);
  return sum(sum(product(a.x, b.x), product(a.z, b.z)), product(a.y, b.y));
}

function length(vector: Vector3): number { return f32(Math.sqrt(dot(vector, vector))); }

function normalizeInto(target: Vector3, source: Vector3): void {
  const magnitude = length(source);
  if (magnitude > 0) {
    target.x = f32(source.x / magnitude);
    target.y = f32(source.y / magnitude);
    target.z = f32(source.z / magnitude);
  } else {
    target.x = 1; target.y = 1; target.z = 1;
  }
}

// Road-space vectors use (x, -z, y) before taking a cross product.
function crossRoadSpace(target: Vector3, left: Vector3, right: Vector3): void {
  const leftVertical = f32(-left.z);
  const rightVertical = f32(-right.z);
  const x = f32(f32(leftVertical * right.y) - f32(left.y * rightVertical));
  const vertical = f32(f32(left.y * right.x) - f32(left.x * right.y));
  const y = f32(f32(left.x * rightVertical) - f32(leftVertical * right.x));
  target.x = x; target.y = y; target.z = f32(-vertical);
}

function crossInto(target: Vector3, left: Vector3, right: Vector3): void {
  const x = f32(f32(left.y * right.z) - f32(left.z * right.y));
  const y = f32(f32(left.z * right.x) - f32(left.x * right.z));
  const z = f32(f32(left.x * right.y) - f32(left.y * right.x));
  target.x = x; target.y = y; target.z = z;
}

function surfaceTag(descriptor?: SurfaceDescriptor): string | undefined {
  return descriptor?.road.attributes.find((attribute) => attribute.name === "surface")?.value;
}

/** Drive, reverse and braking force for one float32 substep. */
export function applyLongitudinalForce(context: ContinuousMotionContext, seconds: number,
  input: DrivingInput, force: Vector3): void {
  const { body, wheels, runtime, tuning, scratch } = context;
  const forwardSpeed = runtime.localForwardSpeed;
  const rightSpeed = runtime.localRightSpeed;
  const forwardAxis = scratch.v0;
  if (runtime.hwContact && !wheels.grounded) {
    setScaled(forwardAxis, runtime.specialNormal, f32(-10));
  } else {
    crossRoadSpace(forwardAxis, body.right, wheels.averageNormal);
  }
  const controlsLocked = runtime.raceMotionLocked || runtime.pressProtected1C0;

  if (input.forward > 0 && !controlsLocked) {
    let driveForce = f32(f32(runtime.liveForwardAccel + (context.giant?.forceBonus ?? 0)) *
      f32(runtime.driveScale));
    // Item races use the item start acceleration and booster factor.
    if (runtime.physicsState === 1) driveForce = f32(context.itemMode
      ? tuning.startForwardAccelItem ?? tuning.startForwardAccelSpeed : tuning.startForwardAccelSpeed);
    let boosterFactor = f32(1);
    if (runtime.physicsState >= 1 && runtime.physicsState <= 11) {
      const transformAnimation = runtime.physicsState !== 2 &&
        [2, 4, 5, 6].includes(runtime.animationSlot);
      boosterFactor = tuning.useTransformBooster && transformAnimation
        ? f32(tuning.transAccelFactor) : f32(context.itemMode
          ? tuning.boostAccelFactorOnlyItem ?? tuning.boostAccelFactor : tuning.boostAccelFactor);
    }
    if (runtime.physicsState === 2 && context.speedRaceMode?.kind !== "grip") {
      boosterFactor = f32(boosterFactor * f32(tuning.driftBoostMulAccelFactor));
    }
    boosterFactor = f32(boosterFactor * f32(runtime.draftAccelerationScale));
    if (runtime.physicsState === 10) {
      boosterFactor = f32(boosterFactor * f32(tuning.dualMulAccelFactor));
    }
    if (runtime.instantAccelerationActive) {
      let instantFactor = f32(tuning.instAccelFactor);
      if (f32(tuning.wallCollGaugeMinVelBound) > runtime.cachedDisplaySpeedKmh) {
        instantFactor = f32(instantFactor * f32(2));
      }
      boosterFactor = f32(boosterFactor * instantFactor);
    }
    if (runtime.oneSubstepDrift) driveForce = f32(tuning.driftEscapeForce);
    const driveVector = scratch.v1;
    setScaled(driveVector, forwardAxis, driveForce);
    scale(driveVector, input.forward);
    scale(driveVector, boosterFactor);
    add(force, driveVector);
    if (forwardSpeed < 0) {
      const recoverySpeed = runtime.activeDrift || runtime.oneSubstepDrift
        ? runtime.bodySpeed : Math.min(f32(5), runtime.bodySpeed);
      setScaled(driveVector, body.forward, recoverySpeed);
      scale(driveVector, runtime.massGravityForce);
      add(force, driveVector);
    }
    runtime.reverseAccumulator = 0;
    return;
  }

  let braking = controlsLocked;
  if (input.reverse > 0 || controlsLocked) {
    braking = true;
    if (forwardSpeed < 0.5) {
      runtime.reverseAccumulator = f32(runtime.reverseAccumulator + seconds);
      if (forwardSpeed < -0.5) runtime.reverseAccumulator = 1;
      if (runtime.reverseAccumulator > 0.2 && !controlsLocked) {
        const reverseVector = scratch.v1;
        setScaled(reverseVector, forwardAxis, f32(-f32(
          f32(tuning.backwardAccel + (context.giant?.forceBonus ?? 0)) * f32(runtime.driveScale))));
        scale(reverseVector, input.reverse);
        add(force, reverseVector);
        braking = false;
      }
      const reverseReady = runtime.reverseAccumulator > 0.2;
      if (braking && ((!reverseReady && Math.abs(rightSpeed) < 0.2) ||
        (reverseReady && controlsLocked && forwardSpeed >= -0.5))) {
        clear(body.linearVelocity);
        braking = false;
      }
    }
  } else if (forwardSpeed >= -0.5 && forwardSpeed <= 0.5) {
    runtime.reverseAccumulator = f32(runtime.reverseAccumulator + seconds);
  }
  if (!braking) return;

  const travelDirection = scratch.v2;
  normalizeInto(travelDirection, body.linearVelocity);
  setScaled(scratch.v3, body.up, dot(travelDirection, body.up));
  subtract(travelDirection, scratch.v3);
  const brakeForce = dot(travelDirection, forwardAxis) > f32(0.800000011920929)
    ? f32(tuning.gripBrake) : f32(tuning.slipBrake);
  setScaled(scratch.v3, travelDirection, brakeForce);
  subtract(force, scratch.v3);
}

/** Air drag, angular drag and grounded road drag. */
export function applyVelocityDrag(context: ContinuousMotionContext, force: Vector3,
  torque: Vector3, full3DRail: boolean): void {
  const { body, wheels, runtime, tuning, scratch } = context;
  const airFriction = f32(tuning.airFriction);
  const linearDrag = scratch.v0;
  const angularDrag = scratch.v1;
  const scaled = scratch.v2;
  clear(linearDrag);
  clear(angularDrag);
  setScaled(scaled, body.linearVelocity, airFriction);
  subtract(linearDrag, scaled);
  setScaled(scaled, body.angularVelocity, airFriction);
  subtract(angularDrag, scaled);
  if (full3DRail || wheels.grounded) {
    const surface = surfaceTag(wheels.roadDescriptor) ?? "";
    const roadFactor = surface.length === 5 && surface.slice(0, 2) === "DF" &&
      surface[3] === "."
      ? f32(f32(surface.charCodeAt(2) - 48) +
        f32(f32(surface.charCodeAt(4) - 48) * f32(0.1)))
      : f32(1);
    setScaled(scaled, body.linearVelocity, length(body.linearVelocity));
    scale(scaled, f32(runtime.liveDragFactor));
    scale(scaled, f32(runtime.dragScale));
    scale(scaled, f32(runtime.catchupDragScale));
    scale(scaled, roadFactor);
    subtract(linearDrag, scaled);
  }
  add(force, linearDrag);
  add(torque, angularDrag);
}

/** Semi-implicit linear/angular velocity integration with released float32 order. */
export function integrateVehicleVelocity(context: ContinuousMotionContext, seconds: number,
  force: Vector3, torque: Vector3, extraForce: Vector3): void {
  const { body, scratch, tuning } = context;
  add(force, extraForce);
  if (![force.x, force.y, force.z].every(Number.isFinite)) clear(body.linearVelocity);
  const mass = f32(tuning.mass);
  body.linearVelocity.x = f32(body.linearVelocity.x + f32(f32(force.x / mass) * seconds));
  body.linearVelocity.y = f32(body.linearVelocity.y + f32(f32(force.y / mass) * seconds));
  body.linearVelocity.z = f32(body.linearVelocity.z + f32(f32(force.z / mass) * seconds));
  const inverseInertia = f32(f32(12) / mass);
  const inertiaVelocity = scratch.v0;
  const gyroscopicTorque = scratch.v1;
  const angularChange = scratch.v2;
  // This mirrors the release's diagonal inertia matrix multiplication.
  inertiaVelocity.x = f32(f32(f32(inverseInertia * body.angularVelocity.x) +
    f32(0 * body.angularVelocity.y)) + f32(0 * body.angularVelocity.z));
  inertiaVelocity.y = f32(f32(f32(0 * body.angularVelocity.x) +
    f32(inverseInertia * body.angularVelocity.y)) + f32(0 * body.angularVelocity.z));
  inertiaVelocity.z = f32(f32(f32(0 * body.angularVelocity.x) +
    f32(0 * body.angularVelocity.y)) + f32(inverseInertia * body.angularVelocity.z));
  crossInto(gyroscopicTorque, body.angularVelocity, inertiaVelocity);
  angularChange.x = f32(torque.x - gyroscopicTorque.x);
  angularChange.y = f32(torque.y - gyroscopicTorque.y);
  angularChange.z = f32(torque.z - gyroscopicTorque.z);
  // The released helper scales an aliased input and output in place.
  const deltaX = f32(f32(f32(inverseInertia * angularChange.x) +
    f32(0 * angularChange.y)) + f32(0 * angularChange.z));
  const deltaY = f32(f32(f32(0 * angularChange.x) +
    f32(inverseInertia * angularChange.y)) + f32(0 * angularChange.z));
  const deltaZ = f32(f32(f32(0 * angularChange.x) +
    f32(0 * angularChange.y)) + f32(inverseInertia * angularChange.z));
  angularChange.x = deltaX;
  angularChange.y = deltaY;
  angularChange.z = deltaZ;
  scale(angularChange, seconds);
  add(body.angularVelocity, angularChange);
}
