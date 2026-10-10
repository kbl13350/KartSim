import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface RailCaptureTrack {
  rayQuery(origin: Vector3, direction: Vector3, includeRoad: boolean):
    { roadDescriptor?: SurfaceDescriptor } | undefined;
  sampleRoute?(vehicle: RailCaptureContext, lookAhead: number, lane: number):
    { sampled: boolean; point: Vector3 } | undefined;
  railCaptureDistance?(): number | undefined;
  lookupRailConfig?(railId: string): Record<string, unknown>;
}

export interface RailCaptureContext {
  body: { position: Vector3; up: Vector3 };
  wheels: {
    grounded: boolean;
    railContactDescriptor?: SurfaceDescriptor;
    roadDescriptor?: SurfaceDescriptor;
  };
  runtime: {
    motionMode: number;
    railCaptureTimeout: number;
    railCaptureDelay: number;
    railConfig?: Record<string, unknown>;
    railEntryTimerA: number;
    railEntryTimerB: number;
    bodySpeed: number;
  };
  tuning: { driftTrigTime: number };
  requestMotionMode(lift: boolean, mode: number): void;
  produceRailFrame(seconds: number, track: RailCaptureTrack): boolean;
}

const float = Math.fround;
const halfHeight = float(0.5);
const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function distance(left: Vector3, right: Vector3): number {
  const dx = float(left.x - right.x);
  const dy = float(left.y - right.y);
  const dz = float(left.z - right.z);
  return float(Math.sqrt(sum(sum(product(dx, dx), product(dz, dz)), product(dy, dy))));
}

/** Capture a rail only after road ID, delay, route proximity and frame checks pass. */
export function captureVehicleRail(
  vehicle: RailCaptureContext,
  seconds: number,
  track: RailCaptureTrack,
): void {
  const { runtime, wheels, body } = vehicle;
  if (runtime.motionMode !== 1) return;
  let road: SurfaceDescriptor | undefined;
  if (wheels.grounded) {
    road = wheels.railContactDescriptor ?? wheels.roadDescriptor;
  } else {
    const halfUp = {
      x: float(body.up.x * halfHeight),
      y: float(body.up.y * halfHeight),
      z: float(body.up.z * halfHeight),
    };
    road = track.rayQuery({
      x: float(body.position.x + halfUp.x),
      y: float(body.position.y + halfUp.y),
      z: float(body.position.z + halfUp.z),
    }, {
      x: float(halfUp.x * float(-2)),
      y: float(halfUp.y * float(-2)),
      z: float(halfUp.z * float(-2)),
    }, true)?.roadDescriptor;
  }
  const railId = road?.road.attributes.find(attribute => attribute.name === "rail")?.value;
  if (!railId) {
    runtime.railCaptureTimeout = float(runtime.railCaptureTimeout - seconds);
    if (runtime.railCaptureTimeout < 0) vehicle.requestMotionMode(false, 5);
    return;
  }

  runtime.railCaptureDelay = float(runtime.railCaptureDelay - seconds);
  if (!(runtime.railCaptureDelay < 0)) return;
  const sample = track.sampleRoute?.(vehicle, 0, 0);
  const captureDistance = track.railCaptureDistance?.();
  if (!sample || captureDistance === undefined) {
    throw new Error("rail capture 缺少原版 route sampler 或 theme distance。");
  }
  if (sample.sampled && distance(body.position, sample.point) < captureDistance &&
    sample.point.y < float(body.position.y + float(1))) {
    if (!track.lookupRailConfig) throw new Error("rail capture 缺少 rail.bml lookup。");
    if (vehicle.produceRailFrame(0, track)) {
      runtime.railConfig = { ...track.lookupRailConfig(railId) };
      runtime.railEntryTimerA = float(float(vehicle.tuning.driftTrigTime * runtime.bodySpeed) / float(20));
      runtime.railEntryTimerB = float(vehicle.tuning.driftTrigTime * float(0.5));
      runtime.motionMode = 2;
    }
  }
}
