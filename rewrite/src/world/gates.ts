import { routeDot, subtract, type RouteGate, type Vec3 } from "./route";

const f32 = Math.fround;
const lowerParallelLimit = f32(0.0001);
const upperParallelLimit = 0.0001;

/** Cross product in the client coordinate convention (negative stored z). */
function clientCross(a: Vec3, b: Vec3): Vec3 {
  const ax = a.x;
  const az = f32(-a.z);
  const ay = a.y;
  const bx = b.x;
  const bz = f32(-b.z);
  const by = b.y;
  const x = f32(f32(az * by) - f32(ay * bz));
  const encodedZ = f32(f32(ay * bx) - f32(ax * by));
  const y = f32(f32(ax * bz) - f32(az * bx));
  return { x, y, z: f32(-encodedZ) };
}

/** Segment/triangle intersection used by the original route gate. */
function crossesTriangle(triangle: readonly Vec3[], start: Vec3, motion: Vec3): boolean {
  const first = triangle[0]!;
  const edgeA = subtract(triangle[1]!, first);
  const edgeB = subtract(triangle[2]!, first);
  const perpendicular = clientCross(motion, edgeB);
  const divisor = routeDot(edgeA, perpendicular);
  if (divisor > -lowerParallelLimit && divisor < upperParallelLimit) return false;
  const reciprocal = f32(1 / divisor);
  const fromFirst = subtract(start, first);
  const u = f32(routeDot(fromFirst, perpendicular) * reciprocal);
  if (u < 0 || u > 1) return false;
  const cross = clientCross(fromFirst, edgeA);
  const v = f32(routeDot(motion, cross) * reciprocal);
  if (v < 0 || f32(u + v) > 1) return false;
  const fraction = f32(routeDot(edgeB, cross) * reciprocal);
  return fraction >= 0 && fraction <= 1;
}

/** 1 = forward, -1 = reverse, 0 = no gate crossing. */
export function routeGateCrossing(gate: RouteGate, previous: Vec3, current: Vec3): -1 | 0 | 1 {
  const motion = subtract(current, previous);
  if (!crossesTriangle(gate.triangles[0], previous, motion) &&
      !crossesTriangle(gate.triangles[1], previous, motion)) return 0;
  return routeDot(motion, gate.normal) >= 0 ? 1 : -1;
}
