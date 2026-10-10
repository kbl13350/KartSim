import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface SteeringInput {
  rawSteer: number;
  steeringInverted: boolean;
  forward: number;
}

/** AL data used by its tire response and drift transition stage. */
export interface SteeringTireContext {
  tuning: {
    motorcycleType: number;
    maxSteerDeg: number;
    steerConstraint: number;
    frontGripFactor: number;
    rearGripFactor: number;
    driftTrigFactor: number;
    driftTrigTime: number;
    driftSlipFactor: number;
    driftLeanFactor: number;
    steerLeanFactor: number;
    cornerDrawFactor: number;
  };
  runtime: {
    driveSteeringSuppressed: boolean;
    massGravityForce: number;
    localForwardSpeed: number;
    localRightSpeed: number;
    steeringExponentialScale: number;
    catchupSteeringScale: number;
    steeringEnvelope: number;
    steeringAngle: number;
    oneSubstepDrift: boolean;
    activeDrift: boolean;
    triggerPhase: boolean;
    triggerTimer: number;
    triggerRawSteer: number;
    driftDecay: number;
    driftTailLatch: boolean;
    driftGaugeWindow: boolean;
    driftGaugeElapsed: number;
    pendingGauge: number;
    driftLifecycleB50: number;
    driftLifecycleB44: number;
    physicsState: number;
    stateRemainingMs: number;
    tireTransient: number;
    tireEnvelope: number;
    tireEnvelopeRate: number;
    roadTransient: number;
    currentUpdateMs: number;
    motorcycleDriftTimestampMs: number;
    motorcycleTransientTorque: number;
    bodySpeed: number;
    forwardOneShot: boolean;
  };
  body: { angularVelocity: Vector3; right: Vector3; forward: Vector3; up: Vector3 };
  wheels: { roadDescriptor?: SurfaceDescriptor };
  scratch: { v0: Vector3 };
  state: { motorcyclePresentation: number };
  speedRaceMode?: { kind: string };
  commitDriftGauge(): void;
}

const float = Math.fround;
const HALF_WHEELBASE = float(0.5);
const PI = float(3.141592025756836);
const PHYSICS_SUBSTEP = float(0.0020000000949949026);
const ROAD_BLEND = [float(2), float(0.5)];
const TIRE_ROAD_TABLE = [
  [120, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1],
  [120, 0, 0, 1, 0, 0, 1, 1, 1, 1, 1],
  [340, -1, -1, 1, 0, 0, 1, 0.6, 1, 1, 1],
  [120, 0, 0, 1, 0, 0, 1, 0.85, 1, 1, 1],
  [180, 0, 0, 0.5, 0, 0, 1, 0.6, 1, 1, 1],
  [120, -2, -2, 1, 0, 0, 1, 1, 1, 1, 1],
] as const;

// These retain the release's NaN comparisons, unlike Math.min/Math.max.
const minimum = (limit: number, value: number): number => value < limit ? value : limit;
const maximum = (limit: number, value: number): number => limit < value ? value : limit;

function surfaceKind(descriptor?: SurfaceDescriptor): string | undefined {
  return descriptor?.road.attributes.find(attribute => attribute.name === "surface")?.value;
}

/** Apply tire lateral grip, steering yaw and drift transitions for one slice. */
export function applySteeringTireForces(context: SteeringTireContext, seconds: number,
  input: SteeringInput, force: Vector3, torque: Vector3): void {
  const { runtime, tuning, body } = context;
  if (runtime.driveSteeringSuppressed) return;
  const motorcycle = tuning.motorcycleType;
  const gravityForce = runtime.massGravityForce;
  const forwardSpeed = runtime.localForwardSpeed;
  const lateralSpeed = runtime.localRightSpeed;
  const groundSpeed = float(Math.sqrt(float(float(forwardSpeed * forwardSpeed) +
    float(lateralSpeed * lateralSpeed))));
  const direction = forwardSpeed > 0 ? float(1) : float(-1);
  const rawSteer = float(input.rawSteer);
  const steer = float(rawSteer * (input.steeringInverted ? float(-1) : float(1)));
  const maxSteerRadians = float(float(PI * float(tuning.maxSteerDeg)) / float(180));
  let steeringAngle = float(steer * maxSteerRadians);
  const speedConstraint = float(Math.abs(float(float(
    float(forwardSpeed / float(tuning.steerConstraint)) *
    float(runtime.steeringExponentialScale)) * float(runtime.catchupSteeringScale))));
  steeringAngle = float(float(Math.exp(float(-speedConstraint))) * steeringAngle);
  if (input.forward !== 0 && float(runtime.steeringEnvelope * steeringAngle) > 0 &&
      Math.abs(runtime.steeringEnvelope) < Math.abs(steeringAngle))
    steeringAngle = runtime.steeringEnvelope;
  else
    runtime.steeringEnvelope = steeringAngle;
  runtime.steeringAngle = steeringAngle;

  let frontGrip = float(0);
  let rearGrip = float(0);
  let leanTorque = float(0);
  let ordinaryTurn = false;
  let road = surfaceKind(context.wheels.roadDescriptor) === "dirt" ? 1
    : surfaceKind(context.wheels.roadDescriptor) === "slip" ? 2 : 0;
  const firstDriftSlice = runtime.oneSubstepDrift;
  const driftingAtEntry = runtime.activeDrift || firstDriftSlice;
  runtime.oneSubstepDrift = false;

  if (groundSpeed > float(5)) {
    const frontYaw = float(float(body.angularVelocity.y * HALF_WHEELBASE) / groundSpeed);
    const rearYaw = float(float(body.angularVelocity.y * HALF_WHEELBASE) / groundSpeed);
    let lateralRatio = float(lateralSpeed / groundSpeed);
    if (motorcycle) {
      const transient = minimum(float(Math.abs(runtime.tireTransient) * float(2)),
        float(0.9900000095367432));
      lateralRatio = float(lateralRatio /
        float(float(float(0.9000000357627869) * transient) + float(1.1399999856948853)));
    }
    if (road > 0 && runtime.forwardOneShot) {
      const roadValues = TIRE_ROAD_TABLE[road * 2]!;
      if (Math.abs(lateralRatio) > float(roadValues[7]) &&
          !(runtime.driftLifecycleB44 > 0) && context.speedRaceMode?.kind !== "grip") {
        road = 0;
        runtime.driftLifecycleB50 = 0;
        runtime.driftLifecycleB44 = float(0.5);
        runtime.physicsState = 2;
        runtime.stateRemainingMs = 0;
      }
    }
    if (!runtime.activeDrift && !runtime.triggerPhase &&
        Math.abs(lateralSpeed) > float(Math.abs(forwardSpeed) * float(1.2)) &&
        groundSpeed > float(15)) runtime.oneSubstepDrift = true;

    if (runtime.triggerPhase) {
      runtime.tireEnvelope = 0;
      runtime.tireEnvelopeRate = 0;
      frontGrip = 0;
      rearGrip = float(float(float(-gravityForce * float(tuning.frontGripFactor)) *
        float(steer * maxSteerRadians)) * float(tuning.driftTrigFactor));
      if (motorcycle) rearGrip = float(rearGrip * float(1.0800000429153442));
      const timerActive = runtime.triggerTimer > 0;
      if (timerActive) {
        runtime.triggerTimer = float(runtime.triggerTimer - seconds);
        if (!(runtime.triggerTimer > 0)) {
          runtime.triggerTimer = 0;
          runtime.triggerPhase = false;
          if (!runtime.driftGaugeWindow) {
            runtime.driftGaugeWindow = true;
            runtime.driftGaugeElapsed = 0;
            runtime.pendingGauge = 0;
          }
        }
      } else {
        runtime.triggerTimer = float(tuning.driftTrigTime);
        runtime.driftDecay = float(runtime.triggerTimer * float(2));
        runtime.triggerRawSteer = rawSteer;
      }
      if (motorcycle && timerActive &&
          Math.abs(runtime.tireTransient) < float(float(6) * float(0.10999999940395355)))
        runtime.tireTransient = float(runtime.tireTransient +
          float(PHYSICS_SUBSTEP * runtime.triggerRawSteer));
    } else if (runtime.activeDrift || runtime.driftDecay > 0 ||
               runtime.oneSubstepDrift || runtime.roadTransient > 0) {
      runtime.motorcycleDriftTimestampMs = runtime.currentUpdateMs >>> 0;
      if (road === 1) {
        const roadValues = TIRE_ROAD_TABLE[3];
        const speedFraction = float(groundSpeed / float(roadValues[0]));
        const blend = minimum(float(speedFraction * speedFraction), float(1));
        if (runtime.activeDrift) {
          runtime.tireEnvelope = float(float(float(float(float(1) - runtime.tireEnvelope) *
            float(1e-6)) * blend) + runtime.tireEnvelope);
          runtime.tireEnvelopeRate = float(float(float(float(1) - runtime.tireEnvelopeRate) *
            float(0.005)) + runtime.tireEnvelopeRate);
          force.x = float(force.x * float(float(1) - runtime.tireEnvelopeRate));
          force.y = float(force.y * float(float(1) - runtime.tireEnvelopeRate));
          force.z = float(force.z * float(float(1) - runtime.tireEnvelopeRate));
          if (runtime.tireEnvelope > float(1)) runtime.tireEnvelope = float(1);
          const frontAngle = float(float(steer * maxSteerRadians) * float(roadValues[9]));
          const frontFactor = float(float(tuning.frontGripFactor) + float(roadValues[1]));
          const rearFactor = float(float(tuning.rearGripFactor) +
            float(roadValues[2]) - runtime.tireEnvelopeRate);
          frontGrip = float(float(gravityForce * frontFactor) *
            float(float(float(frontAngle * direction) - lateralRatio) - frontYaw));
          rearGrip = float(float(gravityForce * rearFactor) *
            float(float(-lateralRatio) + rearYaw));
          frontGrip = float(float(float(tuning.driftSlipFactor) * runtime.tireEnvelope) * frontGrip);
          rearGrip = float(float(float(tuning.driftSlipFactor) * runtime.tireEnvelope) * rearGrip);
        } else {
          runtime.tireEnvelope = float(float(float(1) - runtime.tireEnvelope) *
            float(0.001) + runtime.tireEnvelope);
          runtime.tireEnvelopeRate = 0;
          const frontAngle = float(steeringAngle * float(roadValues[10]));
          frontGrip = float(float(gravityForce *
            float(float(tuning.frontGripFactor) + float(roadValues[4]))) *
            float(float(float(frontAngle * direction) - lateralRatio) - frontYaw));
          rearGrip = float(float(gravityForce *
            float(float(tuning.rearGripFactor) + float(roadValues[5]))) *
            float(float(-lateralRatio) + rearYaw));
          frontGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[6])) * frontGrip);
          rearGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[6])) * rearGrip);
        }
        runtime.roadTransient = maximum(float(runtime.roadTransient - seconds), float(0));
      } else if (runtime.activeDrift) {
        const roadValues = TIRE_ROAD_TABLE[road * 2 + 1]!;
        frontGrip = float(float(gravityForce *
          float(float(tuning.frontGripFactor) + float(roadValues[1]))) *
          float(float(float(float(steer * maxSteerRadians) * direction) - lateralRatio) - frontYaw));
        rearGrip = float(float(gravityForce *
          float(float(tuning.rearGripFactor) + float(roadValues[2]))) *
          float(float(-lateralRatio) + rearYaw));
        frontGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[3])) * frontGrip);
        rearGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[3])) * rearGrip);
      } else {
        frontGrip = float(float(gravityForce * float(tuning.frontGripFactor)) *
          float(float(float(steeringAngle * direction) - lateralRatio) - frontYaw));
        rearGrip = float(float(gravityForce * float(tuning.rearGripFactor)) *
          float(float(-lateralRatio) + rearYaw));
        frontGrip = float(float(tuning.driftSlipFactor) * frontGrip);
        rearGrip = float(float(tuning.driftSlipFactor) * rearGrip);
      }
      leanTorque = float(float(-float(frontGrip + rearGrip)) * float(tuning.driftLeanFactor));
      if (!(runtime.bodySpeed > float(10))) leanTorque = float(leanTorque * float(0.5));
      if (motorcycle) {
        if (Math.abs(runtime.tireTransient) < float(float(6) * float(0.10999999940395355)))
          runtime.tireTransient = float(runtime.tireTransient +
            float(PHYSICS_SUBSTEP * runtime.triggerRawSteer));
        leanTorque = float(leanTorque * float(-0.3499999940395355));
        runtime.motorcycleTransientTorque = float(Math.abs(leanTorque));
      }
      runtime.driftDecay = maximum(float(runtime.driftDecay - seconds), float(0));
    } else {
      ordinaryTurn = true;
      if (runtime.tireTransient > 0)
        runtime.tireTransient = maximum(float(0), float(runtime.tireTransient - float(0.002)));
      else if (runtime.tireTransient < 0)
        runtime.tireTransient = minimum(float(0), float(runtime.tireTransient + float(0.002)));
      if (road > 0) {
        const roadValues = TIRE_ROAD_TABLE[road * 2]!;
        const speedFraction = float(groundSpeed / float(roadValues[0]));
        const blend = minimum(float(float(float(ROAD_BLEND[0]! * speedFraction) * speedFraction) +
          ROAD_BLEND[1]!), float(1));
        const surfaceAngle = float(road === 2
          ? float(steer * maxSteerRadians) * blend
          : float(float(1) + blend) * steeringAngle);
        frontGrip = float(float(gravityForce * float(tuning.frontGripFactor)) *
          float(float(float(surfaceAngle * direction) - lateralRatio) - frontYaw));
        rearGrip = float(float(gravityForce * float(tuning.rearGripFactor)) *
          float(float(-lateralRatio) + rearYaw));
        frontGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[3])) * frontGrip);
        rearGrip = float(float(float(tuning.driftSlipFactor) * float(roadValues[3])) * rearGrip);
      } else {
        frontGrip = float(float(gravityForce * float(tuning.frontGripFactor)) *
          float(float(float(steeringAngle * direction) - lateralRatio) - frontYaw));
        rearGrip = float(float(gravityForce * float(tuning.rearGripFactor)) *
          float(float(-lateralRatio) + rearYaw));
      }
      leanTorque = float(float(-float(frontGrip + rearGrip)) * float(tuning.steerLeanFactor));
      if (motorcycle) {
        const elapsed = ((runtime.currentUpdateMs >>> 0) -
          runtime.motorcycleDriftTimestampMs) >>> 0;
        leanTorque = elapsed > 700 ? float(leanTorque * float(-4)) : float(0);
        runtime.motorcycleTransientTorque = 0;
      }
      if (runtime.driftGaugeWindow) context.commitDriftGauge();
    }
  } else {
    if (runtime.tireTransient > 0)
      runtime.tireTransient = maximum(float(0), float(runtime.tireTransient - float(0.004)));
    else if (runtime.tireTransient < 0)
      runtime.tireTransient = minimum(float(0), float(runtime.tireTransient + float(0.004)));
    runtime.activeDrift = false;
    runtime.triggerTimer = 0;
    runtime.driftDecay = 0;
    runtime.triggerPhase = false;
    runtime.driftTailLatch = false;
    runtime.motorcycleTransientTorque = 0;
    if (runtime.driftGaugeWindow) context.commitDriftGauge();
    const frontYaw = float(float(body.angularVelocity.y * HALF_WHEELBASE) / float(5));
    const rearYaw = float(float(body.angularVelocity.y * HALF_WHEELBASE) / float(5));
    const lateralRatio = float(lateralSpeed / float(5));
    const nearStopAngle = groundSpeed < float(0.5) ? 0 : float(steeringAngle * direction);
    frontGrip = float(float(gravityForce * float(tuning.frontGripFactor)) *
      float(float(nearStopAngle - lateralRatio) - frontYaw));
    rearGrip = float(float(gravityForce * float(tuning.rearGripFactor)) *
      float(float(-lateralRatio) + rearYaw));
  }

  const totalGrip = float(frontGrip + rearGrip);
  const yawTorque = float(float(HALF_WHEELBASE * frontGrip) - float(HALF_WHEELBASE * rearGrip));
  const cornerDrag = float(ordinaryTurn
    ? float(-Math.abs(totalGrip)) * float(tuning.cornerDrawFactor) : 0);
  const transverseForce = context.scratch.v0;
  for (const axis of ["x", "y", "z"] as const) {
    transverseForce[axis] = float(
      float(float(body.right[axis] * totalGrip) +
        float(float(-body.forward[axis]) * cornerDrag)) +
      float(body.up[axis] * float(0)));
    force[axis] = float(force[axis] + transverseForce[axis]);
  }
  torque.y = float(torque.y + yawTorque);
  torque.z = float(torque.z - leanTorque);
  if (motorcycle)
    context.state.motorcyclePresentation = float(float(runtime.tireTransient * float(-0.5)) * float(6));
  if (runtime.driftTailLatch && driftingAtEntry && !runtime.activeDrift &&
      !runtime.oneSubstepDrift && runtime.driftLifecycleB50 === 0) {
    runtime.driftTailLatch = forwardSpeed > 0;
    runtime.driftLifecycleB50 = float(0.5);
  }
}
