import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface SpecialRoadHit {
  roadDescriptor?: SurfaceDescriptor;
  normal: Vector3;
}

export interface SpecialRoadTrack {
  rayQuery(origin: Vector3, direction: Vector3, includeRoad: boolean): SpecialRoadHit | undefined;
}

export interface SpecialRoadContext {
  body: { position: Vector3; right: Vector3; forward: Vector3; up: Vector3 };
  wheels: { roadDescriptor?: SurfaceDescriptor };
  runtime: {
    mrContact: boolean;
    hwContact: boolean;
    contactWorking: boolean;
    specialNormal: Vector3;
    gravity: Vector3;
    cachedDisplaySpeedKmh: number;
  };
  scratch: {
    v0: Vector3; v1: Vector3; v2: Vector3; v3: Vector3;
    v4: Vector3; v5: Vector3; v6: Vector3; v7: Vector3;
    v8: Vector3; v9: Vector3; v10: Vector3; v11: Vector3;
  };
  collisionShape: { rawHalfWidth: number; rawHalfLength: number };
  scanSpecialRoadPrefix(track: SpecialRoadTrack, prefix: string, rayLength: number): boolean;
}

const float = Math.fround;
const bodyHalfHeight = float(0.5);
const rayWidth = float(0.800000011920929);
const standardGravity = float(-58.80000305175781);
const roadGravity = float(-9.800000190734863);

function copyInto(target: Vector3, source: Vector3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function scaledInto(target: Vector3, source: Vector3, amount: number): void {
  target.x = float(source.x * amount);
  target.y = float(source.y * amount);
  target.z = float(source.z * amount);
}

function sumInto(target: Vector3, left: Vector3, right: Vector3): void {
  target.x = float(left.x + right.x);
  target.y = float(left.y + right.y);
  target.z = float(left.z + right.z);
}

function add(target: Vector3, source: Vector3): void {
  target.x = float(target.x + source.x);
  target.y = float(target.y + source.y);
  target.z = float(target.z + source.z);
}

function cross(left: Vector3, right: Vector3): Vector3 {
  return {
    x: float(float(left.y * right.z) - float(left.z * right.y)),
    y: float(float(left.z * right.x) - float(left.x * right.z)),
    z: float(float(left.x * right.y) - float(left.y * right.x)),
  };
}

const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);
function length(value: Vector3): number {
  return float(Math.sqrt(sum(sum(product(value.x, value.x), product(value.z, value.z)),
    product(value.y, value.y))));
}

function normalized(value: Vector3): Vector3 {
  const magnitude = length(value);
  return magnitude === 0 ? { x: 1, y: 1, z: 1 } : {
    x: float(value.x / magnitude),
    y: float(value.y / magnitude),
    z: float(value.z / magnitude),
  };
}

/** Scan magnet-road first, then high-wall road if no magnet-road is found. */
export function scanSpecialRoadSurfaces(vehicle: SpecialRoadContext, track: SpecialRoadTrack): void {
  vehicle.scanSpecialRoadPrefix(track, "MR", float(-2)) ||
    vehicle.scanSpecialRoadPrefix(track, "HW", float(-10));
}

/** Sample an MR/HW road strip and align the vehicle and gravity to its normal. */
export function scanSpecialRoadStrip(
  vehicle: SpecialRoadContext,
  track: SpecialRoadTrack,
  prefix: string,
  rayLength: number,
): boolean {
  const { body, wheels, runtime, scratch, collisionShape } = vehicle;
  const right = scratch.v0, forward = scratch.v1, up = scratch.v2;
  copyInto(right, body.right);
  copyInto(forward, body.forward);
  copyInto(up, body.up);
  const halfUp = scratch.v3;
  scaledInto(halfUp, up, bodyHalfHeight);
  const probeOrigin = scratch.v4;
  scaledInto(scratch.v11, forward, collisionShape.rawHalfLength);
  scaledInto(scratch.v11, scratch.v11, rayWidth);
  sumInto(probeOrigin, body.position, scratch.v11);
  add(probeOrigin, halfUp);
  const initialRay = scratch.v10;
  scaledInto(initialRay, halfUp, float(-2));
  const initialHit = track.rayQuery(probeOrigin, initialRay, true);
  if (initialHit) wheels.roadDescriptor = initialHit.roadDescriptor;
  const surface = wheels.roadDescriptor?.road.attributes.find(attribute =>
    attribute.name === "surface")?.value;
  if (surface?.slice(0, 2) !== prefix) {
    if (prefix === "MR") runtime.mrContact = false;
    else runtime.hwContact = false;
    runtime.gravity = { x: 0, y: standardGravity, z: -0 };
    return false;
  }

  runtime.contactWorking = true;
  if (prefix === "MR") runtime.mrContact = true;
  else runtime.hwContact = true;
  runtime.specialNormal = { x: 0, y: 0, z: -0 };
  const sampleCount = runtime.cachedDisplaySpeedKmh <= 50 ? 25
    : runtime.cachedDisplaySpeedKmh <= 100 ? 18
      : runtime.cachedDisplaySpeedKmh <= 180 ? 14 : 10;
  const halfWidth = scratch.v5;
  scaledInto(halfWidth, right, collisionShape.rawHalfWidth);
  scaledInto(halfWidth, halfWidth, rayWidth);
  const halfLength = scratch.v6;
  scaledInto(halfLength, forward, collisionShape.rawHalfLength);
  scaledInto(halfLength, halfLength, rayWidth);
  const center = scratch.v7;
  sumInto(center, body.position, halfUp);
  const samplingRay = scratch.v8;
  scaledInto(samplingRay, halfUp, rayLength);
  const increment = float(float(2) / float(sampleCount - 1));
  let hits = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const along = float(increment * float(sample));
    const forwardWeight = float(float(along * float(-1)) + float(1));
    const sideWeight = sample % 2 === 0 ? float(along - float(1)) : forwardWeight;
    const sampleOrigin = scratch.v9;
    scaledInto(scratch.v10, halfLength, forwardWeight);
    sumInto(sampleOrigin, center, scratch.v10);
    scaledInto(scratch.v11, halfWidth, sideWeight);
    add(sampleOrigin, scratch.v11);
    const hit = track.rayQuery(sampleOrigin, samplingRay, true);
    if (hit) {
      add(runtime.specialNormal, hit.normal);
      hits += 1;
    }
  }
  if (hits !== 0) {
    runtime.specialNormal.x = float(runtime.specialNormal.x / float(hits));
    runtime.specialNormal.y = float(runtime.specialNormal.y / float(hits));
    runtime.specialNormal.z = float(runtime.specialNormal.z / float(hits));
    body.up = { ...runtime.specialNormal };
    body.forward = cross(right, runtime.specialNormal);
    if (prefix === "HW") body.right = normalized(cross(runtime.specialNormal, body.forward));
    runtime.gravity = {
      x: float(float(runtime.specialNormal.x * roadGravity) * float(6)),
      y: float(float(runtime.specialNormal.y * roadGravity) * float(6)),
      z: float(float(runtime.specialNormal.z * roadGravity) * float(6)),
    };
  }
  return true;
}
