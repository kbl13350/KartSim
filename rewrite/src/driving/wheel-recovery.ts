import type { Vector3 } from "./continuous-motion";

export interface WheelRecoveryContext {
  wheels: { grounded: boolean; hit: boolean[] };
  body: {
    position: Vector3;
    right: Vector3;
    forward: Vector3;
    up: Vector3;
    linearVelocity: Vector3;
  };
  collisionShape: { rawHalfWidth: number; rawHalfLength: number };
  scratch: { v0: Vector3; v1: Vector3; v2: Vector3 };
}

export interface WheelRecoveryTrack {
  rayQuery(origin: Vector3, direction: Vector3, includeRoad: boolean): unknown;
}

const float = Math.fround;
const wheelCorners: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];
const widthInset = float(0.800000011920929);
const originLift = float(0.5);
const restoredVerticalSpeed = float(0.18000000715255737);

function setScaled(target: Vector3, source: Vector3, scalar: number): void {
  target.x = float(source.x * scalar);
  target.y = float(source.y * scalar);
  target.z = float(source.z * scalar);
}

function scale(target: Vector3, scalar: number): void {
  target.x = float(target.x * scalar);
  target.y = float(target.y * scalar);
  target.z = float(target.z * scalar);
}

function add(target: Vector3, value: Vector3): void {
  target.x = float(target.x + value.x);
  target.y = float(target.y + value.y);
  target.z = float(target.z + value.z);
}

/** Reprobe missing wheel corners and lift the kart when all four rays find road. */
export function recoverUnconfirmedWheelContacts(
  vehicle: WheelRecoveryContext,
  track: WheelRecoveryTrack,
): void {
  if (!vehicle.wheels.grounded) return;
  let contacts = 0;
  for (let wheel = 0; wheel < 4; wheel += 1) {
    if (vehicle.wheels.hit[wheel]) contacts += 1;
  }
  if (contacts === 0 || contacts === 4) return;

  const origin = vehicle.scratch.v0;
  const offset = vehicle.scratch.v1;
  const direction = vehicle.scratch.v2;
  direction.x = 0;
  direction.y = float(-2);
  direction.z = -0;

  for (let wheel = 0; wheel < 4; wheel += 1) {
    if (vehicle.wheels.hit[wheel]) continue;
    const [widthSign, lengthSign] = wheelCorners[wheel]!;
    origin.x = vehicle.body.position.x;
    origin.y = vehicle.body.position.y;
    origin.z = vehicle.body.position.z;
    setScaled(offset, vehicle.body.right, vehicle.collisionShape.rawHalfWidth);
    scale(offset, widthSign);
    scale(offset, widthInset);
    add(origin, offset);
    setScaled(offset, vehicle.body.forward, vehicle.collisionShape.rawHalfLength);
    scale(offset, lengthSign);
    scale(offset, widthInset);
    add(origin, offset);
    setScaled(offset, vehicle.body.up, originLift);
    add(origin, offset);
    origin.y = float(origin.y + float(1));
    if (track.rayQuery(origin, direction, false)) contacts += 1;
  }

  if (contacts === 4) {
    vehicle.body.linearVelocity.y = float(
      vehicle.body.linearVelocity.y + restoredVerticalSpeed,
    );
  }
}
