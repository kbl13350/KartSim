import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

/** Legacy track surface commands that directly change kart motion. */
export interface RoadConsumerContext {
  wheels: { roadDescriptor?: SurfaceDescriptor; auxiliaryDirection: Vector3 };
  body: { position: Vector3; linearVelocity: Vector3 };
  scratch: { v0: Vector3; v1: Vector3; v2: Vector3; v3: Vector3; v4: Vector3 };
  runtime: { roadCooldown: number };
  setRoadActionState(state: number, milliseconds: number): void;
  requestMotionMode(allowRail: boolean, mode: number): void;
}

const float = Math.fround;
const JUMP_COOLDOWN = float(0.30000001192092896);
const UP = { x: 0, y: 1, z: 0 };

function surface(descriptor?: SurfaceDescriptor): string {
  return descriptor?.road.attributes.find(attribute => attribute.name === "surface")?.value ?? "";
}

function parseFloat32(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? float(parsed) : 0;
}

function pairMagnitude(text: string, tensIndex: number, unitsIndex: number): number {
  const tens = float(float(text.charCodeAt(tensIndex) - 48) * float(20));
  const units = float(float(text.charCodeAt(unitsIndex) - 48) * float(2));
  return float(tens + units);
}

function copyScaled(target: Vector3, source: Vector3, scalar: number): void {
  target.x = float(source.x * scalar);
  target.y = float(source.y * scalar);
  target.z = float(source.z * scalar);
}

function add(target: Vector3, source: Vector3): void {
  target.x = float(target.x + source.x);
  target.y = float(target.y + source.y);
  target.z = float(target.z + source.z);
}

function subtractInto(target: Vector3, left: Vector3, right: Vector3): void {
  target.x = float(left.x - right.x);
  target.y = float(left.y - right.y);
  target.z = float(left.z - right.z);
}

function length(value: Vector3): number {
  const multiply = (left: number, right: number) =>
    Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
  const sum = (left: number, right: number) =>
    Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);
  return float(Math.sqrt(sum(sum(multiply(value.x, value.x),
    multiply(value.z, value.z)), multiply(value.y, value.y))));
}

/** Apply BH/MZ/BS continuous effects and JM/DJ one-shot commands. */
export function applyRoadSurfaceConsumers(context: RoadConsumerContext,
  seconds: number, force: Vector3): void {
  const tag = surface(context.wheels.roadDescriptor);
  const { body, scratch, runtime } = context;
  if (tag.slice(0, 2) === "BH" && tag[4] === ".") {
    const strength = parseFloat32(tag.slice(3, 6));
    const target = scratch.v0;
    target.x = parseFloat32(tag.slice(7, 10));
    target.y = parseFloat32(tag.slice(15, 18));
    target.z = float(-parseFloat32(tag.slice(11, 14)));
    const offset = scratch.v1;
    subtractInto(offset, target, body.position);
    const distance = length(offset);
    const unit = scratch.v2;
    if (distance !== 0) {
      unit.x = float(offset.x / distance);
      unit.y = float(offset.y / distance);
      unit.z = float(offset.z / distance);
    } else {
      unit.x = offset.x; unit.y = offset.y; unit.z = offset.z;
    }
    const inverseDistance = scratch.v3;
    inverseDistance.x = float(unit.x / distance);
    inverseDistance.y = float(unit.y / distance);
    inverseDistance.z = float(unit.z / distance);
    const acceleration = scratch.v4;
    copyScaled(acceleration, inverseDistance, float(strength * float(25)));
    acceleration.y = 0;
    add(body.linearVelocity, acceleration);
  }
  if (tag.slice(0, 2) === "MZ" && tag[4] === ".") {
    const strength = parseFloat32(tag.slice(3, 6));
    const target = { x: parseFloat32(tag.slice(7, 10)), y: 0,
      z: float(-parseFloat32(tag.slice(11, 14))) };
    const offset = {
      x: float(target.x - body.position.x),
      y: float(target.y - body.position.y),
      z: float(target.z - body.position.z),
    };
    offset.y = 0;
    body.linearVelocity = {
      x: float(offset.x * strength),
      y: float(offset.y * strength),
      z: float(offset.z * strength),
    };
    context.setRoadActionState(16, 3_000);
  }
  if (tag.length === 5 && tag.slice(0, 2) === "BS" && tag[3] === ".") {
    const high = float(float(tag.charCodeAt(2) - 48) * float(10_000));
    const low = float(float(tag.charCodeAt(4) - 48) * float(1_000));
    const strength = float(float(high + low) * float(3));
    const speed = length(body.linearVelocity);
    const currentDirection = scratch.v0;
    if (speed > 0) {
      currentDirection.x = float(body.linearVelocity.x / speed);
      currentDirection.y = float(body.linearVelocity.y / speed);
      currentDirection.z = float(body.linearVelocity.z / speed);
    } else {
      currentDirection.x = 0; currentDirection.y = 0; currentDirection.z = 0;
    }
    const wanted = scratch.v1;
    copyScaled(wanted, context.wheels.auxiliaryDirection, strength);
    const current = scratch.v2;
    copyScaled(current, currentDirection, strength);
    const retention = float(0.699999988079071);
    current.x = float(current.x * retention);
    current.y = float(current.y * retention);
    current.z = float(current.z * retention);
    const difference = scratch.v3;
    subtractInto(difference, wanted, current);
    force.x = difference.x; force.y = difference.y; force.z = difference.z;
    context.setRoadActionState(13, 1_000);
  }

  const elapsed = float(seconds);
  runtime.roadCooldown = elapsed <= runtime.roadCooldown
    ? float(runtime.roadCooldown - elapsed) : 0;
  if (runtime.roadCooldown !== 0) return;
  if (tag.length >= 5 && tag.slice(0, 2) === "JM") {
    let vertical: number | undefined;
    let directional: number | undefined;
    if (tag.length === 9 && tag[3] === "." && tag[5] === "/" && tag[7] === ".") {
      vertical = pairMagnitude(tag, 2, 4);
      directional = pairMagnitude(tag, 6, 8);
    } else if (tag[3] === ".") {
      vertical = pairMagnitude(tag, 2, 4);
      directional = vertical;
    }
    if (vertical !== undefined && directional !== undefined) {
      copyScaled(scratch.v0, UP, vertical);
      copyScaled(scratch.v1, context.wheels.auxiliaryDirection, directional);
      add(scratch.v0, scratch.v1);
      add(body.linearVelocity, scratch.v0);
      runtime.roadCooldown = JUMP_COOLDOWN;
      context.setRoadActionState(14, 1_000);
      context.requestMotionMode(false, 6);
    }
    return;
  }
  if (tag.slice(0, 2) === "DJ") {
    const parts = tag.slice(2).split("/");
    if (parts.length < 3) return;
    const values = parts.slice(0, 3).map(parseFloat32);
    body.linearVelocity = { x: values[0]!, y: values[2]!, z: float(-values[1]!) };
    runtime.roadCooldown = JUMP_COOLDOWN;
    context.setRoadActionState(15, 1_000);
    context.requestMotionMode(false, 6);
  }
}
