import type { Vector3 } from "./continuous-motion";

export interface CollisionBox {
  center: Vector3;
  axes: Vector3[];
  halfExtents: number[];
}

export interface TrackCollision {
  normal: Vector3;
}

export interface CollisionDrivingInput {
  forward: number;
  rawSteer: number;
  steeringInverted: boolean;
}

/** The AL collaborators used by its continuous track collision response. */
export interface TrackCollisionContext {
  collisionShape: {
    rawHeight: number; rawHalfWidth: number; rawHalfLength: number;
    scaleX: number; scaleY: number;
  };
  body: {
    position: Vector3; up: Vector3; right: Vector3; forward: Vector3;
    linearVelocity: Vector3; angularVelocity: Vector3;
  };
  wheels: { grounded: boolean };
  scratch: {
    v0: Vector3;
    obb: CollisionBox;
    primaryResult: { responseHit: boolean; lowHit: boolean };
  };
  runtime: {
    steeringEnvelope: number; mrContact: boolean; hwContact: boolean;
    collisionResponseMagnitudeB6C: number;
    strongLateralCollision: boolean; collisionMotionHit: boolean;
    collisionMotionStrength: number; collisionAudioStrength: number;
    activeDrift: boolean; steeringCollisionAudioGain: number;
  };
  applyHighObstacleAngularResponse(normal: Vector3): void;
  captureRail(seconds: number, track: unknown): void;
  countOrdinaryResultCrash(): void;
  applyCollisionDriftGaugePreserve(collision: boolean): void;
  applyWallObstacleAngularResponse(normal: Vector3): void;
}

export interface CollisionTrack {
  queryObb(box: CollisionBox): Iterable<TrackCollision>;
}

export interface ObstacleCollision extends TrackCollision {
  motion: Vector3;
  velFactor: number;
  pressMode?: "hard-stop" | "directional" | string;
}

export interface ObstacleTrack {
  queryObstacleObb?(box: CollisionBox): Iterable<ObstacleCollision>;
}

export interface ObstacleCollisionContext extends TrackCollisionContext {
  giantObstacleLowHit: boolean;
  runtime: TrackCollisionContext["runtime"] & { obstacleSuppressionLatch: boolean };
  secondaryCollisionBox(): CollisionBox;
  activateHardPress(): void;
  visualScaleMode(): number;
  activateDirectionalPress(direction: number): void;
}

const float = Math.fround;
const vector = (x = 0, y = 0, z = 0): Vector3 => ({ x, y, z });

function product(left: number, right: number): number {
  return Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
}

function sum(left: number, right: number): number {
  return Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);
}

// The release dot product sums x, z, y and gives NaN operands priority.
function dot(left: Vector3, right: Vector3): number {
  return sum(sum(product(left.x, right.x), product(left.z, right.z)),
    product(left.y, right.y));
}

function length(value: Vector3): number {
  return float(Math.sqrt(dot(value, value)));
}

function scale(value: Vector3, factor: number): Vector3 {
  return vector(float(value.x * factor), float(value.y * factor), float(value.z * factor));
}

function subtract(left: Vector3, right: Vector3): Vector3 {
  return vector(float(left.x - right.x), float(left.y - right.y), float(left.z - right.z));
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

/** Resolve every primary track OBB contact and update the reusable result. */
export function resolveVehicleTrackCollision(context: TrackCollisionContext,
  track: CollisionTrack, input: CollisionDrivingInput): { responseHit: boolean; lowHit: boolean } {
  let responseHit = false;
  let lowHit = false;
  const { body, collisionShape, runtime, scratch } = context;
  const verticalOffset = collisionShape.rawHeight > 1
    ? float(float(0.4) * collisionShape.rawHeight)
    : collisionShape.rawHeight;
  const box = scratch.obb;
  scratch.v0.x = float(body.up.x * verticalOffset);
  scratch.v0.y = float(body.up.y * verticalOffset);
  scratch.v0.z = float(body.up.z * verticalOffset);
  box.center.x = float(body.position.x + scratch.v0.x);
  box.center.y = float(body.position.y + scratch.v0.y);
  box.center.z = float(body.position.z + scratch.v0.z);
  box.axes[0] = body.right;
  box.axes[1] = body.forward;
  box.axes[2] = body.up;
  box.halfExtents[0] = float(collisionShape.rawHalfWidth * collisionShape.scaleX);
  box.halfExtents[1] = float(collisionShape.rawHalfLength * collisionShape.scaleY);
  box.halfExtents[2] = float(float(0.699999988079071) * verticalOffset);

  for (const hit of track.queryObb(box)) {
    const normal = scale(hit.normal, 1);
    const incidentSpeed = dot(normal, body.linearVelocity);
    if (incidentSpeed >= 0) continue;
    const incoming = scale(normal, incidentSpeed);
    const lateralVelocity = subtract(body.linearVelocity, incoming);
    responseHit = true;
    runtime.steeringEnvelope = 0;
    if (normal.y > float(0.65) || runtime.mrContact || runtime.hwContact) {
      const rebound = float(float(0.699999988079071) * Math.abs(dot(body.forward, normal)));
      body.linearVelocity = subtract(lateralVelocity, scale(incoming, rebound));
      runtime.collisionResponseMagnitudeB6C = length(incoming);
      context.applyHighObstacleAngularResponse(normal);
      context.captureRail(0, track);
      continue;
    }

    lowHit = true;
    context.countOrdinaryResultCrash();
    context.applyCollisionDriftGaugePreserve(true);
    const impact = length(incoming);
    if (impact > float(10)) runtime.strongLateralCollision = true;
    runtime.collisionMotionHit = true;
    runtime.collisionMotionStrength = Math.max(runtime.collisionMotionStrength, impact);
    runtime.collisionAudioStrength = Math.max(runtime.collisionAudioStrength, impact);

    const slideSpeed = length(lateralVelocity);
    const lateralRecoil = Math.min(float(float(1.5) * impact),
      float(float(0.6000000238418579) * slideSpeed));
    const slideDirection = slideSpeed > 0
      ? vector(float(lateralVelocity.x / slideSpeed), float(lateralVelocity.y / slideSpeed),
        float(lateralVelocity.z / slideSpeed))
      : vector();
    const recoil = subtract(scale(incoming, float(-1.5)), scale(slideDirection, lateralRecoil));
    recoil.y = 0;

    if (dot(body.linearVelocity, body.linearVelocity) < float(100) &&
        !runtime.activeDrift && context.wheels.grounded && input.forward === 1 &&
        (input.rawSteer === 1 || input.rawSteer === -1)) {
      const backward = scale(body.forward, -1);
      const backwardLength = length(backward);
      const backwardDirection = vector(float(backward.x / backwardLength),
        float(backward.y / backwardLength), float(backward.z / backwardLength));
      let alignment = dot(normal, backwardDirection);
      const turnAmplifier = dot(normal, scale(body.right, input.rawSteer)) >= 0
        ? float(float(alignment * alignment) * alignment)
        : Math.max((alignment = float(2 - alignment)), float(1.5));
      const steeringScale = float(float(float(3) * alignment) + float(1));
      const incomingDirection = vector(float(incoming.x / impact),
        float(incoming.y / impact), float(incoming.z / impact));
      subtractInto(recoil, scale(incomingDirection, steeringScale));
      const steer = input.rawSteer * (input.steeringInverted ? -1 : 1);
      addInto(recoil, scale(scale(body.right, steeringScale), steer));
      body.angularVelocity.y = float(body.angularVelocity.y +
        float(float(float(float(6) * turnAmplifier) + float(2)) * steer));
      runtime.steeringCollisionAudioGain = float(
        float(Math.max(alignment, float(1)) * float(0.30000001192092896)) +
        float(0.10000000149011612));
    }
    addInto(body.linearVelocity, recoil);
    context.applyWallObstacleAngularResponse(normal);
  }
  const result = scratch.primaryResult;
  result.responseHit = responseHit;
  result.lowHit = lowHit;
  return result;
}

/** Resolve moving obstacle impulses, hard stops and opposing directional presses. */
export function resolveVehicleObstacleCollisions(context: ObstacleCollisionContext,
  track: ObstacleTrack): boolean {
  context.giantObstacleLowHit = false;
  if (!track.queryObstacleObb || context.runtime.obstacleSuppressionLatch) return false;
  const box = context.secondaryCollisionBox();
  let responseHit = false;
  let positiveDirection = false;
  let negativeDirection = false;
  for (const obstacle of track.queryObstacleObb(box)) {
    const normal = scale(obstacle.normal, 1);
    const motion = scale(obstacle.motion, float(obstacle.velFactor));
    const drivenIntoSurface = float(float(motion.x * normal.x) +
      float(motion.z * normal.z)) < -0.7;
    const velocity = context.body.linearVelocity;
    let incoming: Vector3 | undefined;
    let lateralVelocity: Vector3 | undefined;
    if (drivenIntoSurface) {
      if (dot(normal, velocity) < 0) {
        const halfVelocity = scale(velocity, 0.5);
        incoming = scale(normal, dot(normal, halfVelocity));
        lateralVelocity = subtract(halfVelocity, incoming);
      }
    } else {
      const relativeVelocity = subtract(velocity, scale(motion, 1.6180000305175781));
      if (dot(normal, relativeVelocity) < 0) {
        incoming = scale(normal, dot(normal, relativeVelocity));
        lateralVelocity = subtract(velocity, incoming);
      }
    }
    if (incoming && lateralVelocity) {
      responseHit = true;
      if (normal.y > 0.6499999761581421) {
        const rebound = float(float(0.699999988079071) *
          Math.abs(dot(normal, context.body.forward)));
        context.body.linearVelocity = subtract(lateralVelocity, scale(incoming, rebound));
        context.runtime.collisionResponseMagnitudeB6C = length(incoming);
        context.applyHighObstacleAngularResponse(normal);
        context.captureRail(0, track);
      } else {
        context.giantObstacleLowHit = true;
        context.applyCollisionDriftGaugePreserve(false);
        const impact = length(incoming);
        if (impact > float(10)) context.runtime.strongLateralCollision = true;
        context.runtime.collisionMotionHit = true;
        context.runtime.collisionMotionStrength = Math.max(
          context.runtime.collisionMotionStrength, impact);
        context.runtime.collisionAudioStrength = Math.max(
          context.runtime.collisionAudioStrength, impact);
        const slideSpeed = length(lateralVelocity);
        const lateralRecoil = Math.min(float(float(1.5) * impact),
          float(float(0.6000000238418579) * slideSpeed));
        const slideDirection = slideSpeed > 0
          ? vector(float(lateralVelocity.x / slideSpeed),
            float(lateralVelocity.y / slideSpeed), float(lateralVelocity.z / slideSpeed))
          : vector();
        const recoil = subtract(scale(incoming, float(-1.5)),
          scale(slideDirection, lateralRecoil));
        recoil.y = 0;
        addInto(context.body.linearVelocity, recoil);
        context.applyWallObstacleAngularResponse(normal);
      }
      context.runtime.steeringEnvelope = 0;
    }
    if (obstacle.pressMode === "hard-stop") {
      context.activateHardPress();
      continue;
    }
    if (obstacle.pressMode === "directional") {
      if ((motion.z > 0 && motion.x === 0 && motion.y === 0) ||
          (motion.x < 0 && motion.z === 0 && motion.y === 0)) positiveDirection = true;
      if ((motion.z < 0 && motion.x === 0 && motion.y === 0) ||
          (motion.x > 0 && motion.z === 0 && motion.y === 0)) negativeDirection = true;
      if (motion.y < -50 && motion.x < float(0.01) && motion.z === 0) {
        if (context.visualScaleMode() === 0) context.activateDirectionalPress(1);
      } else if ((Math.abs(motion.x) > 0 || Math.abs(motion.z) > 0) &&
                 positiveDirection && negativeDirection && context.visualScaleMode() === 0) {
        context.activateDirectionalPress(2);
      }
    }
  }
  return responseHit;
}

/** Tilt response for steep or upper-body contacts. */
export function applyHighContactAngularResponse(context: TrackCollisionContext,
  normal: Vector3): void {
  const up = context.body.up;
  const axis = vector(
    float(float(normal.y * up.z) - float(normal.z * up.y)),
    float(float(normal.z * up.x) - float(normal.x * up.z)),
    float(float(normal.x * up.y) - float(normal.y * up.x)),
  );
  context.body.angularVelocity.x = float(context.body.angularVelocity.x -
    float(dot(axis, context.body.right) * float(0.1)));
  context.body.angularVelocity.z = float(context.body.angularVelocity.z -
    float(dot(axis, context.body.forward) * float(0.1)));
}

/** Yaw impulse for lateral wall hits, capped by current angular velocity. */
export function applyWallContactAngularResponse(context: TrackCollisionContext,
  normal: Vector3): void {
  const forwardContact = dot(normal, context.body.forward);
  const rightContact = dot(normal, context.body.right);
  const halfImpact = Math.abs(float(dot(normal, context.body.linearVelocity) * float(0.5)));
  const impulseScale = Math.min(float(50), Math.max(float(1), halfImpact));
  const yaw = Math.abs(float(forwardContact * float(0.8))) <= Math.abs(rightContact)
    ? float(float(forwardContact * (rightContact <= 0 ? float(1) : float(-1))) * impulseScale)
    : float(float(rightContact * (forwardContact <= 0 ? float(-1) : float(1))) * impulseScale);
  const impulse = vector(0, yaw, 0);
  if (dot(impulse, context.body.angularVelocity) <= 1)
    addInto(context.body.angularVelocity, impulse);
}
