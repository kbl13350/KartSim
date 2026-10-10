import type { SurfaceDescriptor, Vector3 } from "./continuous-motion";

export interface SlipAlignmentContext {
  runtime: { forwardOneShot: boolean; driftLifecycleB44: number };
  wheels: { roadDescriptor?: SurfaceDescriptor; averageNormal: Vector3 };
  body: { right: Vector3; linearVelocity: Vector3 };
  scratch: { v0: Vector3 };
}

const float = Math.fround;
const product = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left * right);
const sum = (left: number, right: number): number =>
  Number.isNaN(right) ? float(right) : Number.isNaN(left) ? float(left) : float(left + right);

function speed(value: Vector3): number {
  return float(Math.sqrt(sum(sum(product(value.x, value.x),
    product(value.z, value.z)), product(value.y, value.y))));
}

/** Project a one-shot forward correction along the slip surface tangent. */
export function applySlipSurfaceAlignment(context: SlipAlignmentContext): void {
  const { runtime, wheels, body } = context;
  const surface = wheels.roadDescriptor?.road.attributes.find(attribute =>
    attribute.name === "surface")?.value;
  if (runtime.forwardOneShot && surface === "slip" && runtime.driftLifecycleB44 > 0) {
    const tangent = context.scratch.v0;
    const right = body.right;
    const normal = wheels.averageNormal;
    const rightX = right.x, rightY = float(-right.z), rightZ = right.y;
    const normalX = normal.x, normalY = float(-normal.z), normalZ = normal.y;
    tangent.x = float(float(rightY * normalZ) - float(rightZ * normalY));
    tangent.y = float(float(rightX * normalY) - float(rightY * normalX));
    tangent.z = float(-float(float(rightZ * normalX) - float(rightX * normalZ)));
    const magnitude = speed(body.linearVelocity);
    for (const axis of ["x", "y", "z"] as const) {
      tangent[axis] = float(tangent[axis] * magnitude);
      tangent[axis] = float(tangent[axis] * float(0.5));
      body.linearVelocity[axis] = float(body.linearVelocity[axis] * float(0.5));
      body.linearVelocity[axis] = float(body.linearVelocity[axis] + tangent[axis]);
    }
  }
  runtime.forwardOneShot = false;
}
