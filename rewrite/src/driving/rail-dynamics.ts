import type { Vector3 } from "./continuous-motion";
import type { RailFrameContext, RailFrameTrack, RailMatrix } from "./rail-frame";
import { relaxMatrixTowardIdentity } from "./orientation-math";

export interface RailDynamicsConfig {
  minVelocity: number;
  maxVelocity: number;
  accelFactor: number;
  gravityFactor: number;
}

export interface RailDynamicsContext extends RailFrameContext {
  body: RailFrameContext["body"] & {
    up: Vector3;
    forward: Vector3;
    linearVelocity: Vector3;
    angularVelocity: Vector3;
  };
  runtime: RailFrameContext["runtime"] & {
    railPoint: Vector3;
    railConfig?: RailDynamicsConfig;
    motionMode: number;
    raceMotionLocked: boolean;
    pressProtected1C0: boolean;
    physicsState: number;
    animationSlot: number;
    liveForwardAccel: number;
    railScalar0: number;
    railScalar1: number;
    railScalar2: number;
    driftGaugeWindow: boolean;
    driftGaugeElapsed: number;
    pendingGauge: number;
    railEntryTimerA: number;
    railEntryTimerB: number;
    railEntryMarker: number;
    localForwardSpeed: number;
    localRightSpeed: number;
    localUpSpeed: number;
    railRelativeOrientation: RailMatrix;
    gravity: Vector3;
  };
  tuning: {
    useTransformBooster: boolean;
    transAccelFactor: number;
    boostAccelFactor: number;
    gripBrake: number;
    maxSteerDeg: number;
    mass: number;
  };
  produceRailFrame(seconds: number, track: RailFrameTrack): boolean;
  commitDriftGauge(): void;
}

export interface RailDrivingInput { forward: number; reverse: number; steer: number }

const float = Math.fround;
const releasePi = float(3.141592025756836);
const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function dot(left: Vector3, right: Vector3): number {
  return sum(sum(product(left.x, right.x), product(left.z, right.z)), product(left.y, right.y));
}

function length(vector: Vector3): number { return float(Math.sqrt(dot(vector, vector))); }
function scaled(vector: Vector3, factor: number): Vector3 {
  return { x: float(vector.x * factor), y: float(vector.y * factor), z: float(vector.z * factor) };
}
function add(target: Vector3, other: Vector3): void {
  target.x = float(target.x + other.x);
  target.y = float(target.y + other.y);
  target.z = float(target.z + other.z);
}
function subtract(target: Vector3, other: Vector3): void {
  target.x = float(target.x - other.x);
  target.y = float(target.y - other.y);
  target.z = float(target.z - other.z);
}
function scale(target: Vector3, factor: number): void {
  target.x = float(target.x * factor);
  target.y = float(target.y * factor);
  target.z = float(target.z * factor);
}

/** Apply captured rail propulsion, stabilizing torque and rail gravity. */
export function applyVehicleRailDynamics(
  vehicle: RailDynamicsContext,
  seconds: number,
  input: RailDrivingInput,
  track: RailFrameTrack,
  force: Vector3,
  torque: Vector3,
): void {
  const { body, runtime, tuning } = vehicle;
  if (!vehicle.produceRailFrame(seconds, track)) {
    if (!runtime.railFrame) throw new Error("full3D rail 首次 frame 无效，拒绝使用未初始化 BF8。");
    return;
  }
  const config = runtime.railConfig;
  if (!config) throw new Error("full3D rail 尚未安装 rail.bml config。");
  const target = {
    x: float(runtime.railPoint.x + float(body.up.x * runtime.railScalar0)),
    y: float(runtime.railPoint.y + float(body.up.y * runtime.railScalar0)),
    z: float(runtime.railPoint.z + float(body.up.z * runtime.railScalar0)),
  };
  const displacement = {
    x: float(target.x - body.position.x),
    y: float(target.y - body.position.y),
    z: float(target.z - body.position.z),
  };
  const lengthSquared = dot(displacement, displacement);
  const distance = length(displacement);
  const direction = lengthSquared > 0
    ? { x: float(displacement.x / distance), y: float(displacement.y / distance),
        z: float(displacement.z / distance) }
    : { ...body.forward };
  const speed = length(body.linearVelocity);
  const boundedSpeed = speed < config.minVelocity ? config.minVelocity
    : speed > config.maxVelocity ? config.maxVelocity : speed;
  body.linearVelocity = scaled(direction, boundedSpeed);

  if (runtime.motionMode === 3 && !runtime.raceMotionLocked && !runtime.pressProtected1C0) {
    if (input.forward > 0) {
      let boostFactor: number | undefined;
      if (runtime.physicsState >= 1 && runtime.physicsState <= 11) {
        const transformed = tuning.useTransformBooster && [2, 4, 5, 6].includes(runtime.animationSlot);
        boostFactor = float(transformed ? tuning.transAccelFactor : tuning.boostAccelFactor);
      }
      const driveForce = scaled(direction, input.forward);
      scale(driveForce, config.accelFactor);
      scale(driveForce, runtime.liveForwardAccel);
      if (boostFactor !== undefined) scale(driveForce, boostFactor);
      add(force, driveForce);
    } else if (input.reverse !== 0) {
      const brakeForce = scaled(direction, config.accelFactor);
      scale(brakeForce, tuning.gripBrake);
      subtract(force, brakeForce);
    }
  }

  if (float(runtime.railScalar0 + runtime.railScalar1) < 0) {
    runtime.railScalar0 = 0;
    runtime.railScalar1 = 0;
  } else if (runtime.railScalar2 < 0) {
    const pull = float(float(runtime.railScalar0 * runtime.railScalar0)
      * float(-9999999747378752e-21));
    runtime.railScalar1 = float(runtime.railScalar1 + pull);
    runtime.railScalar0 = float(runtime.railScalar0 + runtime.railScalar1);
  } else {
    runtime.railScalar2 = float(runtime.railScalar2 - seconds);
  }

  const maximumSteerRadians = float(float(releasePi * float(tuning.maxSteerDeg)) / float(180));
  if (runtime.motionMode === 2) {
    if (!runtime.driftGaugeWindow) {
      runtime.driftGaugeWindow = true;
      runtime.driftGaugeElapsed = 0;
      runtime.pendingGauge = 0;
    }
    torque.y = float(torque.y + float(float(input.steer * maximumSteerRadians) * float(600)));
    runtime.railEntryTimerA = float(runtime.railEntryTimerA - seconds);
    if (float(runtime.localForwardSpeed * float(0.2)) > Math.abs(runtime.localRightSpeed)) {
      runtime.railEntryTimerB = float(runtime.railEntryTimerB - seconds);
      if (runtime.railEntryTimerA < 0 && runtime.railEntryTimerB < 0) {
        runtime.motionMode = 3;
        runtime.railEntryMarker = float(0.5);
        vehicle.commitDriftGauge();
      }
    } else {
      torque.y = float(torque.y + float(runtime.localRightSpeed * float(1.6)));
      torque.x = float(torque.x + float(runtime.localUpSpeed
        * (runtime.localForwardSpeed > 0 ? float(-2) : float(2))));
      subtract(torque, scaled(body.angularVelocity, float(20)));
    }
  } else if (runtime.motionMode === 3) {
    torque.z = float(torque.z - float(float(input.steer * maximumSteerRadians) * float(200)));
    subtract(torque, scaled(body.angularVelocity, float(30)));
    runtime.railRelativeOrientation = relaxMatrixTowardIdentity(runtime.railRelativeOrientation,
      Math.min(float(seconds * float(3)), float(1)));
  }
  const gravityForce = scaled(runtime.gravity, tuning.mass);
  scale(gravityForce, config.gravityFactor);
  add(force, gravityForce);
}
