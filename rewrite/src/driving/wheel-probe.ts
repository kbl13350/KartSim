import type { Vector3 } from "./continuous-motion";

export interface WheelRoadDescriptor {
  road?: { attributes: Array<{ name: string; value: string }> };
}

export interface WheelRayHit {
  normal: Vector3;
  point: Vector3;
  auxiliaryDirection: Vector3;
  surfaceVelocity: Vector3;
  obstacleSource?: boolean;
  roadDescriptor?: WheelRoadDescriptor;
}

export interface WheelProbeTrack {
  rayQuery(origin: Vector3, direction: Vector3, includeRoad: boolean): WheelRayHit | undefined;
}

export interface WheelProbeContext {
  runtime: {
    contactWorking: boolean;
    mrContact: boolean;
    hwContact: boolean;
    contactRisingEdge: boolean;
    landingMotionTrigger: boolean;
    shockWaveRequest: boolean;
    freeOrientationLatch: boolean;
  };
  wheels: {
    compression: number[];
    compressionDelta: number[];
    hit: boolean[];
    normals: Vector3[];
    zeroNormals: Vector3[];
    averageNormal: Vector3;
    grounded: boolean;
    roadDescriptor?: WheelRoadDescriptor;
    railContactDescriptor?: WheelRoadDescriptor;
    auxiliaryDirection: Vector3;
    obstacleRayHit: boolean;
    surfaceVelocity: Vector3;
  };
  scratch: {
    oldCompression: number[];
    v0: Vector3;
    v1: Vector3;
    v2: Vector3;
    v3: Vector3;
    v4: Vector3;
    zeroNormals: Vector3[];
  };
  body: { position: Vector3; right: Vector3; forward: Vector3; up: Vector3 };
  collisionShape: {
    scaleX: number;
    scaleY: number;
    rawHeight: number;
    rawHalfWidth: number;
    rawHalfLength: number;
  };
  tuning: { wheelPosition: number };
  visualScaleMode(): number;
}

const float = Math.fround;
const wheelCorners: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];
const wheelHeight = float(0.5);

function scaleInto(target: Vector3, source: Vector3, amount: number): void {
  target.x = float(source.x * amount);
  target.y = float(source.y * amount);
  target.z = float(source.z * amount);
}

function add(target: Vector3, source: Vector3): void {
  target.x = float(target.x + source.x);
  target.y = float(target.y + source.y);
  target.z = float(target.z + source.z);
}

const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function roadDot(left: Vector3, right: Vector3): number {
  return sum(sum(product(left.x, right.x), product(left.z, right.z)),
    product(left.y, right.y));
}

/** Cast all four wheel rays and update contact, surface and suspension state. */
export function probeVehicleWheels(
  vehicle: WheelProbeContext,
  track: WheelProbeTrack,
  roadOnly: boolean,
): void {
  const { runtime, wheels, scratch, body, collisionShape } = vehicle;
  const wasWorkingContact = runtime.contactWorking;
  for (let wheel = 0; wheel < 4; wheel += 1) {
    scratch.oldCompression[wheel] = wheels.compression[wheel]!;
  }
  runtime.contactWorking = false;
  wheels.grounded = false;
  wheels.hit.fill(false);
  wheels.averageNormal.x = 0;
  wheels.averageNormal.y = 0;
  wheels.averageNormal.z = 0;
  wheels.roadDescriptor = undefined;
  wheels.railContactDescriptor = undefined;
  wheels.auxiliaryDirection = { x: 0, y: 1, z: 0 };
  wheels.obstacleRayHit = false;

  let contacts = 0;
  const unscaledShape = collisionShape.scaleX === 1 &&
    collisionShape.scaleY === 1 && collisionShape.rawHeight === 1;
  const wheelPosition = float(unscaledShape
    ? vehicle.tuning.wheelPosition
    : float(vehicle.tuning.wheelPosition) * float(collisionShape.scaleY));
  const side = scratch.v0;
  scaleInto(scratch.v4, body.right, float(collisionShape.rawHalfWidth));
  scaleInto(side, scratch.v4, wheelPosition);
  const forward = scratch.v1;
  scaleInto(scratch.v4, body.forward, float(collisionShape.rawHalfLength));
  scaleInto(forward, scratch.v4, wheelPosition);

  for (let wheel = 0; wheel < 4; wheel += 1) {
    const [sideSign, forwardSign] = wheelCorners[wheel]!;
    const origin = scratch.v2;
    scaleInto(scratch.v4, body.up, wheelHeight);
    origin.x = float(body.position.x + scratch.v4.x);
    origin.y = float(body.position.y + scratch.v4.y);
    origin.z = float(body.position.z + scratch.v4.z);
    scaleInto(scratch.v4, side, sideSign);
    add(origin, scratch.v4);
    scaleInto(scratch.v4, forward, forwardSign);
    add(origin, scratch.v4);
    const direction = scratch.v3;
    scaleInto(direction, body.up, float(-2 * wheelHeight));
    const specialContact = runtime.mrContact || runtime.hwContact;
    const hit = track.rayQuery(origin, direction, specialContact ? !roadOnly : roadOnly);
    if (!hit) {
      wheels.compression[wheel] = 0;
      wheels.compressionDelta[wheel] = 0;
      const emptyNormal = scratch.zeroNormals[wheel]!;
      emptyNormal.x = 0;
      emptyNormal.y = 0;
      emptyNormal.z = 0;
      wheels.normals[wheel] = emptyNormal;
      continue;
    }

    wheels.hit[wheel] = true;
    wheels.grounded = true;
    runtime.contactWorking = true;
    wheels.obstacleRayHit = hit.obstacleSource === true;
    contacts += 1;
    wheels.normals[wheel] = { ...hit.normal };
    add(wheels.averageNormal, hit.normal);
    if (!wheels.railContactDescriptor && hit.roadDescriptor?.road &&
      hit.roadDescriptor.road.attributes.find(attribute => attribute.name === "rail")?.value) {
      wheels.railContactDescriptor = hit.roadDescriptor;
    }
    if (!wheels.roadDescriptor) {
      wheels.roadDescriptor = hit.roadDescriptor;
      wheels.auxiliaryDirection = { ...hit.auxiliaryDirection };
    }
    const penetration = float(roadDot(hit.point, body.up) -
      float(roadDot(body.position, body.up) - wheelHeight));
    const adjusted = vehicle.visualScaleMode() === 1
      ? float(penetration + float(0.001)) : penetration;
    const compression = Math.min(float(2 * wheelHeight), Math.max(0, adjusted));
    wheels.compression[wheel] = compression;
    wheels.compressionDelta[wheel] = float(compression - scratch.oldCompression[wheel]!);
    if (wheel === 0) add(wheels.surfaceVelocity, hit.surfaceVelocity);
  }

  if (contacts > 0) {
    wheels.averageNormal.x = float(wheels.averageNormal.x / float(contacts));
    wheels.averageNormal.y = float(wheels.averageNormal.y / float(contacts));
    wheels.averageNormal.z = float(wheels.averageNormal.z / float(contacts));
  }
  runtime.contactRisingEdge = wheels.grounded && !wasWorkingContact;
  runtime.landingMotionTrigger ||= runtime.contactRisingEdge;
  runtime.shockWaveRequest ||= runtime.contactRisingEdge;
  if (contacts > 2) runtime.freeOrientationLatch = false;
}
