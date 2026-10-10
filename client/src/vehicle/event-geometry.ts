/** Floating point geometry used by moving track event hitboxes. */
export interface EventPoint { x: number; y: number; z: number }
export type EventLocalPoint = [number, number, number];
export interface EventBox {
  center: EventPoint;
  axes: EventPoint[];
  halfExtents: EventLocalPoint;
}
export interface EventTriangle {
  a: EventPoint;
  b: EventPoint;
  c: EventPoint;
  normal: EventPoint;
  motion: EventPoint;
}

const f32 = Math.fround;

export function copyEventPoint(point: EventPoint): EventPoint {
  return { x: f32(point.x), y: f32(point.y), z: f32(point.z) };
}

export function squaredEventDistance(a: EventPoint, b: EventPoint): number {
  const x = f32(a.x - b.x), y = f32(a.y - b.y), z = f32(a.z - b.z);
  return f32(f32(x * x) + f32(f32(y * y) + f32(z * z)));
}

export function eventRadiusThreshold(radius: number, padding: number): number {
  const diameter = f32(f32(radius) * f32(2));
  const threshold = f32(diameter + f32(padding));
  return f32(threshold * threshold);
}

export function triangleCenter(a: EventPoint, b: EventPoint, c: EventPoint): EventPoint {
  const third = f32(0.3333300054);
  return {
    x: f32(f32(f32(a.x + b.x) + c.x) * third),
    y: f32(f32(f32(a.y + b.y) + c.y) * third),
    z: f32(f32(f32(a.z + b.z) + c.z) * third),
  };
}

export function averageTriangleCenters(centers: EventPoint[]): EventPoint {
  if (centers.length === 0) return { x: 0, y: 0, z: 0 };
  const total = centers.reduce((sum, center) => ({
    x: f32(sum.x + center.x), y: f32(sum.y + center.y), z: f32(sum.z + center.z),
  }), { x: 0, y: 0, z: 0 });
  const count = f32(centers.length);
  return { x: f32(total.x / count), y: f32(total.y / count), z: f32(total.z / count) };
}

export function triangleMotion(center: EventPoint, previous: EventPoint, deltaMs: number): EventPoint {
  const millisPerSecond = f32(1000), delta = f32(deltaMs);
  return {
    x: f32(f32(f32(center.x - previous.x) * millisPerSecond) / delta),
    y: f32(f32(f32(center.y - previous.y) * millisPerSecond) / delta),
    z: f32(f32(f32(center.z - previous.z) * millisPerSecond) / delta),
  };
}

function subtract(a: EventPoint, b: EventPoint): EventPoint {
  return { x: f32(a.x - b.x), y: f32(a.y - b.y), z: f32(a.z - b.z) };
}

function cross(a: EventPoint, b: EventPoint): EventPoint {
  return {
    x: f32(f32(a.y * b.z) - f32(a.z * b.y)),
    y: f32(f32(a.z * b.x) - f32(a.x * b.z)),
    z: f32(f32(a.x * b.y) - f32(a.y * b.x)),
  };
}

function dot(a: EventPoint, b: EventPoint): number {
  return f32(f32(f32(a.x * b.x) + f32(a.y * b.y)) + f32(a.z * b.z));
}

export function triangleNormal(a: EventPoint, b: EventPoint, c: EventPoint): EventPoint | undefined {
  const normal = cross(subtract(b, a), subtract(c, a));
  const squaredLength = dot(normal, normal);
  if (!(squaredLength > 0)) return;
  const length = f32(Math.sqrt(squaredLength));
  return {
    x: f32(normal.x / length), y: f32(normal.y / length), z: f32(normal.z / length),
  };
}

export function modelBoundingRadius<Node, Matrix>(
  points: { node: Node; local: EventLocalPoint }[],
  matrixOf: (node: Node) => Matrix,
  transformPoint: (point: EventLocalPoint, matrix: Matrix) => EventPoint,
): number {
  const worldPoints = points.map(({ node, local }) => transformPoint(local, matrixOf(node)));
  if (worldPoints.length === 0) return 0;
  let minX = worldPoints[0]!.x, minY = worldPoints[0]!.y, minZ = worldPoints[0]!.z;
  let maxX = minX, maxY = minY, maxZ = minZ;
  worldPoints.forEach(point => {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y); minZ = Math.min(minZ, point.z);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y); maxZ = Math.max(maxZ, point.z);
  });
  const width = f32(maxX - minX), height = f32(maxY - minY), depth = f32(maxZ - minZ);
  const squaredDiagonal = f32(f32(width * width) + f32(f32(height * height) + f32(depth * depth)));
  return f32(f32(Math.sqrt(squaredDiagonal)) * f32(0.5));
}

function subtractTriples(a: number[], b: number[]): EventLocalPoint {
  return [f32(a[0]! - b[0]!), f32(a[1]! - b[1]!), f32(a[2]! - b[2]!)];
}

function crossTriples(a: number[], b: number[]): EventLocalPoint {
  return [
    f32(f32(a[1]! * b[2]!) - f32(a[2]! * b[1]!)),
    f32(f32(a[2]! * b[0]!) - f32(a[0]! * b[2]!)),
    f32(f32(a[0]! * b[1]!) - f32(a[1]! * b[0]!)),
  ];
}

function dotTriples(a: number[], b: number[]): number {
  return f32(f32(f32(a[0]! * b[0]!) + f32(a[1]! * b[1]!)) + f32(a[2]! * b[2]!));
}

function projectedPoint(point: EventPoint, box: EventBox): number[] {
  const fromCenter = subtract(point, box.center);
  return box.axes.map(axis => dot(fromCenter, axis));
}

function separatesAxis(points: number[][], axis: number[], halfExtents: number[]): boolean {
  const projections = points.map(point => dotTriples(point, axis));
  const boxRadius = f32(
    f32(halfExtents[0]! * Math.abs(axis[0]!)) +
    f32(f32(halfExtents[1]! * Math.abs(axis[1]!)) +
      f32(halfExtents[2]! * Math.abs(axis[2]!))),
  );
  return Math.min(...projections) > boxRadius || -boxRadius > Math.max(...projections);
}

function separatesBoxAxes(points: number[][], halfExtents: number[]): boolean {
  for (let axis = 0; axis < 3; axis += 1) {
    const min = Math.min(points[0]![axis]!, points[1]![axis]!, points[2]![axis]!);
    const max = Math.max(points[0]![axis]!, points[1]![axis]!, points[2]![axis]!);
    if (min > halfExtents[axis]! || -halfExtents[axis]! > max) return true;
  }
  return false;
}

function intersectsTrianglePlane(points: number[][], firstEdge: number[], halfExtents: number[]): boolean {
  const normal = crossTriples(firstEdge, subtractTriples(points[2]!, points[0]!));
  const offset = f32(-dotTriples(normal, points[0]!));
  const nearest = normal.map((component, index) =>
    component >= 0 ? -halfExtents[index]! : halfExtents[index]!);
  const farthest = nearest.map(component => -component);
  return f32(dotTriples(normal, nearest) + offset) <= 0 &&
    f32(dotTriples(normal, farthest) + offset) >= 0;
}

/** Separating axis test for an oriented kart box and event triangle. */
export function eventTriangleOverlapsBox(triangle: EventTriangle, box: EventBox): boolean {
  const points = [triangle.a, triangle.b, triangle.c].map(point => projectedPoint(point, box));
  const edges = [
    subtractTriples(points[1]!, points[0]!),
    subtractTriples(points[2]!, points[1]!),
    subtractTriples(points[0]!, points[2]!),
  ];
  const boxAxes: EventLocalPoint[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (const edge of edges)
    for (const axis of boxAxes)
      if (separatesAxis(points, crossTriples(edge, axis), box.halfExtents)) return false;
  if (separatesBoxAxes(points, box.halfExtents)) return false;
  return intersectsTrianglePlane(points, edges[0]!, box.halfExtents);
}
