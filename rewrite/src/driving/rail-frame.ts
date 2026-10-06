import type { Vector3 } from "./continuous-motion";

export type RailMatrix = [Vector3, Vector3, Vector3];

export interface RailFrameSample {
  sampled: boolean;
  point: Vector3;
  direction: Vector3;
  up: Vector3;
  surface: string;
}

export interface RailFrameTrack {
  refreshRouteProjection?(vehicle: RailFrameContext, position: Vector3): void;
  sampleRoute?(vehicle: RailFrameContext, lookAhead: number, lane: number): RailFrameSample;
}

export interface RailFrameContext {
  body: { position: Vector3 };
  runtime: {
    railPoint?: Vector3;
    railFrame?: RailMatrix;
    railBadGeometryTimer: number;
    railResetRequest: boolean;
  };
  requestMotionMode(lift: boolean, nextMode: number): void;
}

const float = Math.fround;
const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function dot(left: Vector3, right: Vector3): number {
  return sum(sum(product(left.x, right.x), product(left.z, right.z)), product(left.y, right.y));
}

function length(vector: Vector3): number {
  return float(Math.sqrt(dot(vector, vector)));
}

function cross(left: Vector3, right: Vector3): Vector3 {
  return {
    x: float(float(left.y * right.z) - float(left.z * right.y)),
    y: float(float(left.z * right.x) - float(left.x * right.z)),
    z: float(float(left.x * right.y) - float(left.y * right.x)),
  };
}

/** Project onto the rail and build the full 3D road frame used by rail dynamics. */
export function produceVehicleRailFrame(
  vehicle: RailFrameContext,
  seconds: number,
  track: RailFrameTrack,
): boolean {
  if (!track.refreshRouteProjection || !track.sampleRoute) {
    throw new Error("full3D rail 缺少原版 route projection/sampler。");
  }
  track.refreshRouteProjection(vehicle, vehicle.body.position);
  const sample = track.sampleRoute(vehicle, 1, 0);
  if (!sample.sampled) throw new Error("full3D rail route sample 没有相邻 frame。");
  vehicle.runtime.railPoint = { ...sample.point };
  if (!sample.surface.includes("rail")) {
    vehicle.requestMotionMode(true, 6);
    return false;
  }
  const displacement = {
    x: float(sample.point.x - vehicle.body.position.x),
    y: float(sample.point.y - vehicle.body.position.y),
    z: float(sample.point.z - vehicle.body.position.z),
  };
  if (length(displacement) < float(0.30000001192092896) || dot(displacement, sample.direction) < 0) {
    vehicle.runtime.railBadGeometryTimer = float(vehicle.runtime.railBadGeometryTimer + seconds);
    if (vehicle.runtime.railBadGeometryTimer > float(0.5)) vehicle.runtime.railResetRequest = true;
    return false;
  }
  vehicle.runtime.railBadGeometryTimer = 0;
  const reverse = {
    x: float(sample.direction.x * float(-1)),
    y: float(sample.direction.y * float(-1)),
    z: float(sample.direction.z * float(-1)),
  };
  const railRight = cross(reverse, sample.up);
  const railUp = cross(railRight, reverse);
  vehicle.runtime.railFrame = [
    { x: railRight.x, y: float(-sample.direction.x), z: railUp.x },
    { x: float(-railRight.z), y: sample.direction.z, z: float(-railUp.z) },
    { x: railRight.y, y: float(-sample.direction.y), z: railUp.y },
  ];
  return true;
}
