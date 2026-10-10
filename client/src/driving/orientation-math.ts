import type { Vector3 } from "./continuous-motion";
import type { RailMatrix } from "./rail-frame";

/** The game's matrices are three row vectors in route coordinates. */
export interface Quaternion { w: number; x: number; y: number; z: number }
export interface OrientedBody {
  right: Vector3;
  forward: Vector3;
  up: Vector3;
  angularVelocity: Vector3;
}

const float = Math.fround;
function floatFromBits(bits: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setUint32(0, bits, true);
  return view.getFloat32(0, true);
}

// Float32 constants used by the released normalized quaternion interpolation.
const interpolationShape = floatFromBits(1062380241);
const interpolationScale = floatFromBits(1058398929);
const normOffset = floatFromBits(1064666457);
const normSlope = floatFromBits(3204993777);
const normBias = floatFromBits(1065533027);
const normFirstThreshold = floatFromBits(1063930709);
const normSecondThreshold = floatFromBits(1059516753);

export function bodyBasisMatrix(body: Pick<OrientedBody, "right" | "forward" | "up">): RailMatrix {
  const { right, forward, up } = body;
  return [
    { x: right.x, y: float(-forward.x), z: up.x },
    { x: float(-right.z), y: forward.z, z: float(-up.z) },
    { x: right.y, y: float(-forward.y), z: up.y },
  ];
}

export function setBodyBasis(body: OrientedBody, matrix: RailMatrix): void {
  body.right = { x: matrix[0].x, y: matrix[2].x, z: float(-matrix[1].x) };
  body.forward = { x: float(-matrix[0].y), y: float(-matrix[2].y), z: matrix[1].y };
  body.up = { x: matrix[0].z, y: matrix[2].z, z: float(-matrix[1].z) };
}

export function angularVelocityInRouteBasis(velocity: Vector3): Vector3 {
  return { x: velocity.x, y: float(-velocity.z), z: velocity.y };
}

export function transposeMatrix(matrix: RailMatrix): RailMatrix {
  return [
    { x: matrix[0].x, y: matrix[1].x, z: matrix[2].x },
    { x: matrix[0].y, y: matrix[1].y, z: matrix[2].y },
    { x: matrix[0].z, y: matrix[1].z, z: matrix[2].z },
  ];
}

/** Matrix multiplication keeps each multiply/add at the original float32 boundary. */
export function multiplyMatrices(left: RailMatrix, right: RailMatrix): RailMatrix {
  const row = (vector: Vector3): Vector3 => ({
    x: float(float(float(vector.x * right[0].x) + float(vector.y * right[1].x)) + float(vector.z * right[2].x)),
    y: float(float(float(vector.x * right[0].y) + float(vector.y * right[1].y)) + float(vector.z * right[2].y)),
    z: float(float(float(vector.x * right[0].z) + float(vector.y * right[1].z)) + float(vector.z * right[2].z)),
  });
  return [row(left[0]), row(left[1]), row(left[2])];
}

export function quaternionFromMatrix(matrix: RailMatrix): Quaternion {
  const [first, second, third] = matrix;
  const diagonal = [first.x, second.y, third.z];
  const trace = float(float(first.x + second.y) + third.z);
  if (trace > 0) {
    const root = float(Math.sqrt(float(trace + float(1))));
    const reciprocal = float(float(0.5) / root);
    return {
      w: float(root * float(0.5)),
      x: float(float(third.y - second.z) * reciprocal),
      y: float(float(first.z - third.x) * reciprocal),
      z: float(float(second.x - first.y) * reciprocal),
    };
  }
  let largest = 0;
  if (diagonal[1]! > diagonal[largest]!) largest = 1;
  if (diagonal[2]! > diagonal[largest]!) largest = 2;
  const next = (largest + 1) % 3;
  const last = (next + 1) % 3;
  const entries = [
    [first.x, first.y, first.z],
    [second.x, second.y, second.z],
    [third.x, third.y, third.z],
  ];
  const root = float(Math.sqrt(float(float(float(diagonal[largest]! - diagonal[next]!) - diagonal[last]!) + float(1))));
  const reciprocal = float(float(0.5) / root);
  const imaginary = [0, 0, 0];
  imaginary[largest] = float(root * float(0.5));
  imaginary[next] = float(float(entries[next]![largest]! + entries[largest]![next]!) * reciprocal);
  imaginary[last] = float(float(entries[last]![largest]! + entries[largest]![last]!) * reciprocal);
  return {
    w: float(float(entries[last]![next]! - entries[next]![last]!) * reciprocal),
    x: imaginary[0]!, y: imaginary[1]!, z: imaginary[2]!,
  };
}

export function matrixFromQuaternion(quaternion: Quaternion): RailMatrix {
  const { w, x, y, z } = quaternion;
  const xx = float(x * x), yy = float(y * y), zz = float(z * z);
  const xy = float(x * y), xz = float(x * z), yz = float(y * z);
  const wx = float(w * x), wy = float(w * y), wz = float(w * z);
  const two = float(2);
  return [
    { x: float(float(1) - float(two * float(yy + zz))),
      y: float(two * float(xy - wz)), z: float(two * float(xz + wy)) },
    { x: float(two * float(xy + wz)),
      y: float(float(1) - float(two * float(xx + zz))), z: float(two * float(yz - wx)) },
    { x: float(two * float(xz - wy)), y: float(two * float(yz + wx)),
      z: float(float(1) - float(two * float(xx + yy))) },
  ];
}

function quaternionDot(left: Quaternion, right: Quaternion): number {
  return float(float(float(float(left.x * right.x) + float(left.w * right.w))
    + float(left.y * right.y)) + float(left.z * right.z));
}

function scaleQuaternion(quaternion: Quaternion, scale: number): Quaternion {
  return { w: float(quaternion.w * scale), x: float(quaternion.x * scale),
    y: float(quaternion.y * scale), z: float(quaternion.z * scale) };
}

/** Released approximation of normalized quaternion blending. */
function blendQuaternions(from: Quaternion, to: Quaternion, proportion: number): Quaternion {
  const alignment = quaternionDot(to, from);
  const shape = float(float(1) - float(alignment * interpolationShape));
  const curve = float(float(shape * shape) * interpolationScale);
  const ease = (position: number): number => float(float(float(float(float(float(
    position + position) - float(3)) * float(curve * position)) + float(1)) + curve) * position);
  const weight = proportion > float(0.5)
    ? float(float(1) - ease(float(float(1) - proportion))) : float(ease(proportion));
  const mixed = {
    w: float(float(float(to.w - from.w) * weight) + from.w),
    x: float(float(float(to.x - from.x) * weight) + from.x),
    y: float(float(float(to.y - from.y) * weight) + from.y),
    z: float(float(float(to.z - from.z) * weight) + from.z),
  };
  const squaredLength = float(float(float(float(mixed.w * mixed.w)
    + float(mixed.x * mixed.x)) + float(mixed.y * mixed.y)) + float(mixed.z * mixed.z));
  const improveNorm = (estimate: number): number => float(float(float(float(float(estimate * estimate)
    * squaredLength) - normOffset) * normSlope) + normBias);
  let reciprocalLength = float(float(float(squaredLength - normOffset) * normSlope) + normBias);
  if (squaredLength <= normFirstThreshold) {
    reciprocalLength = float(reciprocalLength * improveNorm(reciprocalLength));
    if (squaredLength <= normSecondThreshold) {
      reciprocalLength = float(reciprocalLength * improveNorm(reciprocalLength));
    }
  }
  return scaleQuaternion(mixed, reciprocalLength);
}

export function relaxMatrixTowardIdentity(matrix: RailMatrix, proportion: number): RailMatrix {
  let current = quaternionFromMatrix(matrix);
  const identity = { w: 1, x: 0, y: 0, z: 0 };
  if (quaternionDot(identity, current) < 0) current = scaleQuaternion(current, float(-1));
  return matrixFromQuaternion(blendQuaternions(current, identity, proportion));
}

/** Integrate a body or relative rail frame using its angular velocity. */
export function integrateOrientation(matrix: RailMatrix, angularVelocity: Vector3, seconds: number): RailMatrix {
  const quaternion = quaternionFromMatrix(matrix);
  let derivativeW = float(0);
  derivativeW = float(derivativeW - float(quaternion.x * angularVelocity.x));
  derivativeW = float(derivativeW - float(quaternion.y * angularVelocity.y));
  derivativeW = float(derivativeW - float(quaternion.z * angularVelocity.z));
  let derivativeX = float(quaternion.w * angularVelocity.x);
  derivativeX = float(derivativeX + float(quaternion.y * angularVelocity.z));
  derivativeX = float(derivativeX - float(quaternion.z * angularVelocity.y));
  let derivativeY = float(quaternion.w * angularVelocity.y);
  derivativeY = float(derivativeY + float(quaternion.z * angularVelocity.x));
  derivativeY = float(derivativeY - float(quaternion.x * angularVelocity.z));
  let derivativeZ = float(quaternion.w * angularVelocity.z);
  derivativeZ = float(derivativeZ + float(quaternion.x * angularVelocity.y));
  derivativeZ = float(derivativeZ - float(quaternion.y * angularVelocity.x));
  const halfSlice = float(seconds * float(0.5));
  const next = {
    w: float(quaternion.w + float(derivativeW * halfSlice)),
    x: float(quaternion.x + float(derivativeX * halfSlice)),
    y: float(quaternion.y + float(derivativeY * halfSlice)),
    z: float(quaternion.z + float(derivativeZ * halfSlice)),
  };
  const length = float(Math.sqrt(float(float(float(float(next.w * next.w)
    + float(next.x * next.x)) + float(next.y * next.y)) + float(next.z * next.z))));
  return matrixFromQuaternion({
    w: float(next.w / length), x: float(next.x / length),
    y: float(next.y / length), z: float(next.z / length),
  });
}
