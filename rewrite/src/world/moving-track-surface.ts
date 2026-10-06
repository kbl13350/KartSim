import type { Vec3 } from "./route";
import {
  p3553TriangleCentroid, rayTriangleFraction,
  type TriangleObbQuery,
} from "./obstacle-surface";
import type { StaticTrackTriangle, StaticTrackHit, StaticTrackOverlap } from "./static-track-surface";

export interface MovingRoadNode {
  vertexData?: { positions: readonly (readonly number[])[] };
}

export interface MovingRoadTriangle extends StaticTrackTriangle {
  origin: { mesh: { node: MovingRoadNode }; localIndices: readonly number[] };
}

export interface TrackedMovingTriangle extends MovingRoadTriangle {
  previousVertices: Vec3[];
  stagedVertices: Vec3[];
  surfaceVelocity: Vec3;
}

export interface MovingTrackSurfaceDependencies {
  p3553ObbQuery: TriangleObbQuery;
}

const f32 = Math.fround;
const CENTROID_SCALE = f32(0.3333300054);

function cloneVec(vector: Vec3): Vec3 {
  return { x: f32(vector.x), y: f32(vector.y), z: f32(vector.z) };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: f32(a.x - b.x), y: f32(a.y - b.y), z: f32(a.z - b.z) };
}

function centroid(vectors: readonly Vec3[]): Vec3 {
  const a = vectors[0]!;
  const b = vectors[1]!;
  const c = vectors[2]!;
  return {
    x: f32(f32(f32(a.x + b.x) + c.x) * CENTROID_SCALE),
    y: f32(f32(f32(a.y + b.y) + c.y) * CENTROID_SCALE),
    z: f32(f32(f32(a.z + b.z) + c.z) * CENTROID_SCALE),
  };
}

function transformedCoordinate(a: number, x: number, b: number, y: number,
  c: number, z: number): number {
  return f32(f32(f32(a * x) + f32(b * y)) + f32(c * z));
}

function transformClientVertex(output: Vec3, point: readonly number[],
  matrix: ArrayLike<number>): void {
  const x = f32(transformedCoordinate(matrix[0]!, point[0]!, matrix[4]!, point[1]!,
    matrix[8]!, point[2]!) + matrix[12]!);
  const y = f32(transformedCoordinate(matrix[1]!, point[0]!, matrix[5]!, point[1]!,
    matrix[9]!, point[2]!) + matrix[13]!);
  const z = f32(transformedCoordinate(matrix[2]!, point[0]!, matrix[6]!, point[1]!,
    matrix[10]!, point[2]!) + matrix[14]!);
  output.x = x;
  output.y = z;
  output.z = f32(-y);
}

function crossInClientCoordinates(a: Vec3, b: Vec3): Vec3 {
  const ax = a.x, ay = f32(-a.z), az = a.y;
  const bx = b.x, by = f32(-b.z), bz = b.y;
  const x = f32(f32(ay * bz) - f32(az * by));
  const y = f32(f32(az * bx) - f32(ax * bz));
  const z = f32(f32(ax * by) - f32(ay * bx));
  return { x, y: z, z: f32(-y) };
}

/** Surface of road triangles whose vertices follow live render matrices. */
export class MovingTrackSurface {
  readonly clientWorldElements: (node: MovingRoadNode) => ArrayLike<number> | undefined;
  readonly triangleObbQuery: TriangleObbQuery;
  readonly triangles: TrackedMovingTriangle[];
  lastUpdateMs = 0;
  bestTriangle: TrackedMovingTriangle | undefined;
  readonly hit: StaticTrackHit = {
    point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 },
    fraction: 0, roadDescriptor: undefined,
    auxiliaryDirection: { x: 0, y: 0, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
  };

  constructor(triangles: readonly MovingRoadTriangle[],
    clientWorldElements: (node: MovingRoadNode) => ArrayLike<number> | undefined,
    triangleObbQuery: TriangleObbQuery,
    private readonly dependencies: MovingTrackSurfaceDependencies) {
    this.clientWorldElements = clientWorldElements;
    this.triangleObbQuery = triangleObbQuery;
    this.triangles = triangles.map(triangle => ({
      ...triangle,
      a: cloneVec(triangle.a), b: cloneVec(triangle.b), c: cloneVec(triangle.c),
      normal: cloneVec(triangle.normal),
      previousVertices: [cloneVec(triangle.a), cloneVec(triangle.b), cloneVec(triangle.c)],
      surfaceVelocity: { x: 0, y: 0, z: 0 },
      stagedVertices: [cloneVec(triangle.a), cloneVec(triangle.b), cloneVec(triangle.c)],
    }));
    this.triangles.forEach(triangle => this.currentVertices(triangle));
  }

  update(timeMs: number): void {
    if (!Number.isSafeInteger(Math.trunc(timeMs)) || Math.trunc(timeMs) < 0 ||
        !Number.isSafeInteger(this.lastUpdateMs) || this.lastUpdateMs < 0) {
      throw new Error("tracked triangle timestamp 必须是非负整数毫秒。");
    }
    const timestamp = Math.trunc(timeMs) >>> 0;
    const previousTimestamp = this.lastUpdateMs >>> 0;
    const elapsed = (timestamp - (previousTimestamp === 0 ? timestamp : previousTimestamp)) >>> 0;
    const elapsedFloat = f32(elapsed);
    for (const triangle of this.triangles) {
      const staged = this.currentVertices(triangle);
      const current = staged.map(cloneVec);
      if (elapsed !== 0) {
        const displacement = subtract(centroid(current), centroid(triangle.previousVertices));
        const scaled = { x: f32(displacement.x * f32(1000)),
          y: f32(displacement.y * f32(1000)),
          z: f32(displacement.z * f32(1000)) };
        triangle.surfaceVelocity = {
          x: f32(scaled.x / elapsedFloat),
          y: f32(scaled.y / elapsedFloat),
          z: f32(scaled.z / elapsedFloat),
        };
      }
      triangle.previousVertices = current;
    }
    this.lastUpdateMs = timestamp;
    this.triangles.forEach(triangle => this.publishVertices(triangle, triangle.stagedVertices));
  }

  rebase(): void {
    this.lastUpdateMs = 0;
    for (const triangle of this.triangles) {
      const staged = this.currentVertices(triangle);
      this.publishVertices(triangle, staged);
      triangle.previousVertices = staged.map(cloneVec);
      triangle.surfaceVelocity = { x: 0, y: 0, z: 0 };
    }
  }

  queryBest(origin: Vec3, movement: Vec3, includeWalls: boolean): number {
    this.bestTriangle = undefined;
    let bestFraction = Number.POSITIVE_INFINITY;
    for (const triangle of this.triangles) {
      if (!includeWalls && Math.abs(triangle.normal.y) < 0.6499999761581421) continue;
      const fraction = rayTriangleFraction(triangle, origin, movement);
      if (fraction === undefined || fraction > bestFraction) continue;
      this.bestTriangle = triangle;
      bestFraction = fraction;
    }
    return bestFraction;
  }

  buildHit(origin: Vec3, movement: Vec3, fraction: number): StaticTrackHit {
    const triangle = this.bestTriangle;
    if (!triangle) throw new Error("MovingTrackSurface.buildHit 缺少 best triangle。");
    const hit = this.hit;
    hit.point.x = f32(origin.x + f32(movement.x * fraction));
    hit.point.y = f32(origin.y + f32(movement.y * fraction));
    hit.point.z = f32(origin.z + f32(movement.z * fraction));
    hit.normal.x = triangle.normal.x;
    hit.normal.y = triangle.normal.y;
    hit.normal.z = triangle.normal.z;
    hit.fraction = fraction;
    hit.roadDescriptor = triangle.roadDescriptor;
    hit.auxiliaryDirection.x = triangle.auxiliaryDirection.x;
    hit.auxiliaryDirection.y = triangle.auxiliaryDirection.y;
    hit.auxiliaryDirection.z = triangle.auxiliaryDirection.z;
    hit.surfaceVelocity.x = triangle.surfaceVelocity.x;
    hit.surfaceVelocity.y = triangle.surfaceVelocity.y;
    hit.surfaceVelocity.z = triangle.surfaceVelocity.z;
    return hit;
  }

  queryObb(box: unknown): StaticTrackOverlap[] | undefined {
    const matches: StaticTrackOverlap[] = [];
    for (const triangle of this.triangles) {
      if (!this.triangleObbQuery(triangle, box)) continue;
      matches.push({
        point: this.triangleObbQuery === this.dependencies.p3553ObbQuery ?
          p3553TriangleCentroid(triangle) :
          centroid([triangle.a, triangle.b, triangle.c]),
        normal: { ...triangle.normal }, roadDescriptor: triangle.roadDescriptor,
      });
    }
    return matches.length ? matches : undefined;
  }

  currentVertices(triangle: TrackedMovingTriangle): Vec3[] {
    const node = triangle.origin.mesh.node;
    const positions = node.vertexData?.positions;
    const matrix = this.clientWorldElements(node);
    if (!positions || !matrix) {
      throw new Error("moving road 缺少 local vertices 或 live client-world matrix。");
    }
    const staged = triangle.stagedVertices;
    const indices = triangle.origin.localIndices;
    for (let index = 0; index < 3; index += 1) {
      const local = positions[indices[index]!];
      if (!local) throw new Error("moving road local vertex index 越界。");
      transformClientVertex(staged[index]!, local, matrix);
    }
    return staged;
  }

  publishVertices(triangle: TrackedMovingTriangle, vertices: Vec3[]): void {
    triangle.a = vertices[0]!;
    triangle.b = vertices[1]!;
    triangle.c = vertices[2]!;
    const cross = crossInClientCoordinates(subtract(triangle.b, triangle.a),
      subtract(triangle.c, triangle.a));
    const length = f32(Math.hypot(cross.x, cross.y, cross.z));
    if (length > 0) {
      const inverse = f32(1 / length);
      triangle.normal = {
        x: f32(cross.x * inverse), y: f32(cross.y * inverse),
        z: f32(cross.z * inverse),
      };
    }
  }
}
