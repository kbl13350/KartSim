import type { Vector3 } from "./continuous-motion";

/** State consumed by the suspension and airborne force stages. */
export interface SurfaceForceContext {
  body: { up: Vector3; right: Vector3; forward: Vector3; angularVelocity: Vector3 };
  wheels: {
    hit: boolean[]; compression: number[]; compressionDelta: number[];
    normals: Vector3[];
  };
  collisionShape: { rawHalfWidth: number; rawHalfLength: number };
  tuning: { mass: number };
  runtime: {
    suspensionSpring?: number;
    suspensionPositiveDamping?: number;
    suspensionNegativeDamping?: number;
    gravity: Vector3;
    gravityDivisor: number;
    freeOrientationLatch: boolean;
    motionMode: number;
  };
  scratch: {
    v0: Vector3; v1: Vector3; v2: Vector3; v3: Vector3;
    v4: Vector3; v5: Vector3; v6: Vector3; v7: Vector3;
  };
}

const float = Math.fround;
const WHEEL_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];

function scaleInto(target: Vector3, value: Vector3, factor: number): void {
  target.x = float(value.x * factor);
  target.y = float(value.y * factor);
  target.z = float(value.z * factor);
}

function addInto(target: Vector3, value: Vector3): void {
  target.x = float(target.x + value.x);
  target.y = float(target.y + value.y);
  target.z = float(target.z + value.z);
}

function subtractInto(target: Vector3, value: Vector3): void {
  target.x = float(target.x - value.x);
  target.y = float(target.y - value.y);
  target.z = float(target.z - value.z);
}

function dot(left: Vector3, right: Vector3): number {
  return float(float(float(left.x * right.x) + float(left.y * right.y)) +
    float(left.z * right.z));
}

function crossInto(target: Vector3, left: Vector3, right: Vector3): void {
  const x = float(float(left.y * right.z) - float(left.z * right.y));
  const y = float(float(left.z * right.x) - float(left.x * right.z));
  const z = float(float(left.x * right.y) - float(left.y * right.x));
  target.x = x; target.y = y; target.z = z;
}

/** Sum four wheel spring forces, wheel torques and vehicle gravity. */
export function applySuspensionForce(context: SurfaceForceContext, seconds: number,
  force: Vector3, torque: Vector3): void {
  const spring = context.runtime.suspensionSpring;
  const positiveDamping = context.runtime.suspensionPositiveDamping;
  const negativeDamping = context.runtime.suspensionNegativeDamping;
  if (spring === undefined || positiveDamping === undefined || negativeDamping === undefined)
    throw new Error("P3528 suspension 系数 producer 尚未由冻结运行时证据闭合。");

  const worldForce = context.scratch.v0;
  const worldTorque = context.scratch.v1;
  const worldUp = context.scratch.v2;
  worldForce.x = force.x;
  worldForce.y = float(-force.z);
  worldForce.z = force.y;
  worldTorque.x = torque.x;
  worldTorque.y = float(-torque.z);
  worldTorque.z = torque.y;
  worldUp.x = context.body.up.x;
  worldUp.y = float(-context.body.up.z);
  worldUp.z = context.body.up.y;

  const normal = context.scratch.v3;
  const projectedForce = context.scratch.v4;
  const wheelOffset = context.scratch.v5;
  const wheelForce = context.scratch.v6;
  const torqueContribution = context.scratch.v7;
  for (let wheel = 0; wheel < 4; wheel += 1) {
    let springForce = float(0);
    if (context.wheels.hit[wheel]) {
      const compressionDelta = context.wheels.compressionDelta[wheel]!;
      const damping = compressionDelta > 0 ? positiveDamping : negativeDamping;
      springForce = float(float(spring * context.wheels.compression[wheel]!) +
        float(float(compressionDelta / seconds) * damping));
    }
    let verticalForce = float(0);
    if (springForce > 0) {
      const wheelNormal = context.wheels.normals[wheel]!;
      normal.x = wheelNormal.x;
      normal.y = float(-wheelNormal.z);
      normal.z = wheelNormal.y;
      verticalForce = float(dot(normal, worldUp) * springForce);
    }
    scaleInto(projectedForce, worldUp, verticalForce);
    addInto(worldForce, projectedForce);
    const [side, front] = WHEEL_OFFSETS[wheel]!;
    wheelOffset.x = float(context.collisionShape.rawHalfWidth * side);
    wheelOffset.y = float(float(-context.collisionShape.rawHalfLength) * front);
    wheelOffset.z = float(0);
    wheelForce.x = float(0);
    wheelForce.y = float(0);
    wheelForce.z = verticalForce;
    crossInto(torqueContribution, wheelOffset, wheelForce);
    const leverage = float(0.10000000149011612);
    torqueContribution.x = float(torqueContribution.x * leverage);
    torqueContribution.y = float(torqueContribution.y * leverage);
    torqueContribution.z = float(torqueContribution.z * leverage);
    addInto(worldTorque, torqueContribution);
  }
  const gravity = context.runtime.gravity;
  wheelForce.x = gravity.x;
  wheelForce.y = float(-gravity.z);
  wheelForce.z = gravity.y;
  scaleInto(torqueContribution, wheelForce, float(context.tuning.mass));
  addInto(worldForce, torqueContribution);
  force.x = worldForce.x;
  force.y = worldForce.z;
  force.z = float(-worldForce.y);
  torque.x = worldTorque.x;
  torque.y = worldTorque.z;
  torque.z = float(-worldTorque.y);
}

/** Apply gravity and airborne angular damping, including upright recovery. */
export function applyAirborneForces(context: SurfaceForceContext,
  force: Vector3, torque: Vector3): void {
  const mass = float(context.tuning.mass);
  for (const axis of ["x", "y", "z"] as const) {
    const gravityForce = float(context.runtime.gravity[axis] * mass);
    force[axis] = float(force[axis] + float(gravityForce / context.runtime.gravityDivisor));
  }
  scaleInto(context.scratch.v0, context.body.angularVelocity, float(30));
  subtractInto(torque, context.scratch.v0);
  if (!context.runtime.freeOrientationLatch && context.runtime.motionMode !== 6) return;

  const upY = float(context.body.up.y);
  if (upY < float(0.5)) {
    const correction = float(float(float(1) - upY) *
      (context.body.right.y > 0 ? float(90) : float(-90)));
    torque.z = float(torque.z - correction);
  }
  const forwardY = float(context.body.forward.y);
  if (forwardY > float(0.5))
    torque.x = float(torque.x + float(float(forwardY + float(1)) * float(90)));
  else if (forwardY < float(-0.5))
    torque.x = float(torque.x - float(float(float(1) - forwardY) * float(90)));
}
