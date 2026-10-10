import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface RailTransitionTrack {
  rayQuery(origin: Vector3, direction: Vector3, includeRoad: boolean):
    { roadDescriptor?: SurfaceDescriptor } | undefined;
  associateRoute?(vehicle: RailTransitionContext, position: Vector3): unknown;
}

export interface RailTransitionContext {
  body: { position: Vector3; up: Vector3 };
  wheels: { grounded: boolean; roadDescriptor?: SurfaceDescriptor };
  runtime: {
    motionMode: number;
    bodySpeed: number;
    railCaptureDelay: number;
    railCaptureTimeout: number;
    railRelativeOrientation: Vector3[];
    railScalar0: number;
    railScalar1: number;
    railScalar2: number;
    railBadGeometryTimer: number;
    stagedExternalForce: Vector3;
    railReturnTimer: number;
    railResetRequest: boolean;
  };
}

const float = Math.fround;
const halfHeight = float(0.5);

/** Start the rail-capture grace period from the current body speed. */
export function enterVehicleRailMode(vehicle: RailTransitionContext): void {
  const { runtime } = vehicle;
  if (runtime.motionMode === 2 || runtime.motionMode === 3) return;
  runtime.motionMode = 1;
  runtime.railCaptureDelay = float(0.009999999776482582);
  runtime.railCaptureTimeout = float(1.6180000305175781);
  const speedKmh = float(runtime.bodySpeed * float(3.5999999046325684));
  if (speedKmh < 100) {
    const difference = float(float(100) - speedKmh);
    runtime.railCaptureTimeout = float(runtime.railCaptureTimeout +
      float(float(difference * difference) / float(1_000)));
  }
  runtime.railRelativeOrientation = [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ];
  runtime.railScalar0 = 0;
  runtime.railScalar1 = 0;
  runtime.railScalar2 = 0;
  runtime.railBadGeometryTimer = 0;
}

/** Request a rail-state change and stage lift when leaving a captured rail. */
export function requestVehicleMotionMode(
  vehicle: RailTransitionContext,
  liftFromRail: boolean,
  nextMode: number,
): void {
  const { runtime } = vehicle;
  const previousMode = runtime.motionMode;
  if (liftFromRail && (previousMode === 2 || previousMode === 3)) {
    runtime.stagedExternalForce = {
      x: float(vehicle.body.up.x * float(600_000)),
      y: float(vehicle.body.up.y * float(600_000)),
      z: float(vehicle.body.up.z * float(600_000)),
    };
  }
  if (previousMode !== 0) {
    runtime.railReturnTimer = float(nextMode === 5 ? 1 : 0.10000000149011612);
    runtime.motionMode = nextMode;
  }
}

/** Leave return mode once ordinary road is found and the grace timer expires. */
export function returnVehicleToRoad(
  vehicle: RailTransitionContext,
  seconds: number,
  track: RailTransitionTrack,
): void {
  const { runtime, wheels, body } = vehicle;
  if (runtime.motionMode !== 5 && runtime.motionMode !== 6) return;
  let road = wheels.roadDescriptor;
  if (!wheels.grounded) {
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
    }, false)?.roadDescriptor;
  }
  const rail = road?.road.attributes.find(attribute => attribute.name === "rail")?.value;
  if (!road || rail) return;
  runtime.railReturnTimer = float(runtime.railReturnTimer - seconds);
  if (runtime.railReturnTimer < 0) {
    if (runtime.motionMode === 5 &&
      (!track.associateRoute || !track.associateRoute(vehicle, body.position))) {
      runtime.railResetRequest = true;
    }
    runtime.motionMode = 0;
  }
}
