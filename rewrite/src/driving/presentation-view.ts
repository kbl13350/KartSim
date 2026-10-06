import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

/** Mutable views reused by the camera and drift renderer on every frame. */
export interface VehiclePresentationContext {
  body: {
    position: Vector3;
    right: Vector3;
    forward: Vector3;
    up: Vector3;
    linearVelocity: Vector3;
  };
  wheels: {
    grounded: boolean;
    averageNormal: Vector3;
    roadDescriptor?: SurfaceDescriptor;
    compression: number[];
    obstacleRayHit: boolean;
  };
  tuning: { motorcycleType: boolean };
  state: { drifting: boolean };
  runtime: {
    eventScaleSecondary: Vector3;
    physicsState: number;
    motionMode: number;
    instantAccelerationActive: boolean;
    mrContact: boolean;
    hwContact: boolean;
    tireTransient: number;
    currentReverseSnapshot: number;
    landingMotionTrigger: boolean;
    landingShockAudioStrength: number;
    collisionMotionHit: boolean;
    collisionMotionStrength: number;
    cachedDisplaySpeedKmh: number;
    localForwardSpeed: number;
    contactWorking: boolean;
    fullPhysicsBypass: boolean;
  };
  cameraRuntimeView: {
    wheelContact: boolean;
    averageWheelHitNormal: Vector3;
    eventScaleSecondary: Vector3;
    stateCode: number;
    motionMode: number;
    action8: boolean;
    mrContact: boolean;
    hwContact: boolean;
    motorcycleType: boolean;
    tireTransient: number;
    effectiveReverseScalar: number;
    landingMotionTrigger: boolean;
    landingShockAudioStrength: number;
    collisionMotionHit: boolean;
    collisionMotionStrength: number;
    visualScaleMode: number;
  };
  driftVisualView: {
    active: boolean;
    contact: boolean;
    speedKmh: number;
    forwardSpeed: number;
    motionMode: number;
    roadSurface?: string;
    rearWheelCompression: number[];
    wheelCompressionBaseline: number;
    obstacleWheelHit: boolean;
    fullPhysicsBypass: boolean;
    position: Vector3;
    right: Vector3;
    forward: Vector3;
    up: Vector3;
    presentationRight: Vector3;
    presentationForward: Vector3;
    presentationUp: Vector3;
  };
  driftVisualScratch: Vector3;
  visualScaleMode(): number;
}

const f32 = Math.fround;

function copyVector(target: Vector3, source: Vector3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

// The release rounds individual products, then accumulates x, z, y.
function float32Multiply(left: number, right: number): number {
  return Number.isNaN(right) ? f32(right) : Number.isNaN(left) ? f32(left) : f32(left * right);
}

function float32Add(left: number, right: number): number {
  return Number.isNaN(right) ? f32(right) : Number.isNaN(left) ? f32(left) : f32(left + right);
}

function vectorLength(vector: Vector3): number {
  const square = float32Add(
    float32Add(float32Multiply(vector.x, vector.x), float32Multiply(vector.z, vector.z)),
    float32Multiply(vector.y, vector.y),
  );
  return f32(Math.sqrt(square));
}

function normalizeInto(target: Vector3, source: Vector3): void {
  const length = vectorLength(source);
  if (length === 0) {
    copyVector(target, source);
    return;
  }
  target.x = f32(source.x / length);
  target.y = f32(source.y / length);
  target.z = f32(source.z / length);
}

// The source uses a road-space cross product with (x, -z, y) coordinates.
function roadCrossInto(target: Vector3, left: Vector3, right: Vector3): void {
  const leftX = left.x, leftY = f32(-left.z), leftZ = left.y;
  const rightX = right.x, rightY = f32(-right.z), rightZ = right.y;
  const x = f32(f32(leftY * rightZ) - f32(leftZ * rightY));
  const y = f32(f32(leftZ * rightX) - f32(leftX * rightZ));
  const z = f32(f32(leftX * rightY) - f32(leftY * rightX));
  target.x = x;
  target.y = z;
  target.z = f32(-y);
}

export function updateCameraRuntimeView(vehicle: VehiclePresentationContext) {
  const view = vehicle.cameraRuntimeView;
  const { runtime, wheels } = vehicle;
  view.wheelContact = wheels.grounded;
  copyVector(view.averageWheelHitNormal, wheels.averageNormal);
  copyVector(view.eventScaleSecondary, runtime.eventScaleSecondary);
  view.stateCode = runtime.physicsState;
  view.motionMode = runtime.motionMode;
  view.action8 = runtime.instantAccelerationActive;
  view.mrContact = runtime.mrContact;
  view.hwContact = runtime.hwContact;
  view.motorcycleType = vehicle.tuning.motorcycleType;
  view.tireTransient = runtime.tireTransient;
  view.effectiveReverseScalar = runtime.currentReverseSnapshot;
  view.landingMotionTrigger = runtime.landingMotionTrigger;
  view.landingShockAudioStrength = runtime.landingShockAudioStrength;
  view.collisionMotionHit = runtime.collisionMotionHit;
  view.collisionMotionStrength = runtime.collisionMotionStrength;
  view.visualScaleMode = vehicle.visualScaleMode();
  return view;
}

export function updateDriftVisualView(vehicle: VehiclePresentationContext) {
  const view = vehicle.driftVisualView;
  const scratch = vehicle.driftVisualScratch;
  const { body, wheels, runtime } = vehicle;
  copyVector(view.presentationUp, body.up);
  if (vectorLength(body.linearVelocity) === 0) {
    copyVector(view.presentationForward, body.forward);
    copyVector(view.presentationRight, body.right);
  } else {
    normalizeInto(view.presentationForward, body.linearVelocity);
    scratch.x = f32(view.presentationForward.x * -1);
    scratch.y = f32(view.presentationForward.y * -1);
    scratch.z = f32(view.presentationForward.z * -1);
    roadCrossInto(view.presentationRight, scratch, view.presentationUp);
  }
  view.active = vehicle.state.drifting;
  view.contact = runtime.contactWorking;
  view.speedKmh = runtime.cachedDisplaySpeedKmh;
  view.forwardSpeed = runtime.localForwardSpeed;
  view.motionMode = runtime.motionMode;
  view.roadSurface = wheels.roadDescriptor?.road.attributes.find(attribute => attribute.name === "surface")?.value;
  view.rearWheelCompression[0] = wheels.compression[2]!;
  view.rearWheelCompression[1] = wheels.compression[3]!;
  view.wheelCompressionBaseline = f32(0.5);
  view.obstacleWheelHit = wheels.obstacleRayHit;
  view.fullPhysicsBypass = runtime.fullPhysicsBypass;
  copyVector(view.position, body.position);
  copyVector(view.right, body.right);
  copyVector(view.forward, body.forward);
  copyVector(view.up, body.up);
  return view;
}
