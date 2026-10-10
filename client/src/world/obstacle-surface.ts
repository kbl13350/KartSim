import type { Vec3 } from "./route";

export interface ObstacleTriangle {
  a: Vec3;
  b: Vec3;
  c: Vec3;
  normal: Vec3;
  motion?: Vec3;
  velFactor?: number;
  pressMode?: unknown;
}

export interface ObstacleHit {
  point: Vec3;
  normal: Vec3;
  fraction: number;
  auxiliaryDirection: Vec3;
  surfaceVelocity: Vec3;
  obstacleSource: true;
}

export interface ObstacleOverlap {
  point: Vec3;
  normal: Vec3;
  motion: Partial<Vec3>;
  velFactor: number | undefined;
  pressMode: unknown;
}

export type TriangleObbQuery = (triangle: ObstacleTriangle, box: unknown) => boolean;
const f32 = Math.fround;
const PARALLEL_EPSILON = f32(0.0001);
const LEGACY_CENTROID_SCALE = f32(0.3333300054);

/** Released triangle ray test, including the float32 rounding at each stage. */
export function rayTriangleFraction(triangle: ObstacleTriangle,
  origin: Vec3, movement: Vec3): number | undefined {
  const edgeAB = {
    x: f32(triangle.b.x - triangle.a.x),
    y: f32(triangle.b.y - triangle.a.y),
    z: f32(triangle.b.z - triangle.a.z),
  };
  const edgeAC = {
    x: f32(triangle.c.x - triangle.a.x),
    y: f32(triangle.c.y - triangle.a.y),
    z: f32(triangle.c.z - triangle.a.z),
  };
  const perpendicular = {
    x: f32(f32(movement.y * edgeAC.z) - f32(movement.z * edgeAC.y)),
    y: f32(f32(movement.z * edgeAC.x) - f32(movement.x * edgeAC.z)),
    z: f32(f32(movement.x * edgeAC.y) - f32(movement.y * edgeAC.x)),
  };
  const determinant = f32(f32(f32(edgeAB.x * perpendicular.x) +
    f32(edgeAB.y * perpendicular.y)) + f32(edgeAB.z * perpendicular.z));
  if (determinant > -PARALLEL_EPSILON && determinant < PARALLEL_EPSILON) return undefined;
  const inverseDeterminant = f32(1 / determinant);
  const offset = {
    x: f32(origin.x - triangle.a.x),
    y: f32(origin.y - triangle.a.y),
    z: f32(origin.z - triangle.a.z),
  };
  const barycentricU = f32(f32(f32(f32(offset.x * perpendicular.x) +
    f32(offset.y * perpendicular.y)) + f32(offset.z * perpendicular.z)) * inverseDeterminant);
  if (barycentricU < 0 || barycentricU > 1) return undefined;
  const cross = {
    x: f32(f32(offset.y * edgeAB.z) - f32(offset.z * edgeAB.y)),
    y: f32(f32(offset.z * edgeAB.x) - f32(offset.x * edgeAB.z)),
    z: f32(f32(offset.x * edgeAB.y) - f32(offset.y * edgeAB.x)),
  };
  const barycentricV = f32(f32(f32(f32(movement.x * cross.x) +
    f32(movement.y * cross.y)) + f32(movement.z * cross.z)) * inverseDeterminant);
  if (barycentricV < 0 || f32(barycentricU + barycentricV) > 1) return undefined;
  const fraction = f32(f32(f32(f32(edgeAC.x * cross.x) +
    f32(edgeAC.y * cross.y)) + f32(edgeAC.z * cross.z)) * inverseDeterminant);
  return fraction >= 0 && fraction <= 1 ? fraction : undefined;
}

export function p3553TriangleCentroid(triangle: ObstacleTriangle): Vec3 {
  const scale = f32(0.3333300054073334);
  return {
    x: f32(f32(f32(f32(triangle.a.x) + f32(triangle.b.x)) + f32(triangle.c.x)) * scale),
    y: f32(f32(f32(f32(triangle.a.y) + f32(triangle.b.y)) + f32(triangle.c.y)) * scale),
    z: f32(-f32(f32(f32(f32(-triangle.a.z) + f32(-triangle.b.z)) +
      f32(-triangle.c.z)) * scale)),
  };
}

function legacyCentroid(triangle: ObstacleTriangle): Vec3 {
  return {
    x: (triangle.a.x + triangle.b.x + triangle.c.x) * LEGACY_CENTROID_SCALE,
    y: (triangle.a.y + triangle.b.y + triangle.c.y) * LEGACY_CENTROID_SCALE,
    z: (triangle.a.z + triangle.b.z + triangle.c.z) * LEGACY_CENTROID_SCALE,
  };
}

/** Collision surface created from animated and static obstacle triangles. */
export class ObstacleSurface {
  readonly triangles: readonly ObstacleTriangle[];
  readonly triangleObbQuery: TriangleObbQuery;
  private readonly isP3553Query: boolean;
  bestTriangle: ObstacleTriangle | undefined;
  readonly hit: ObstacleHit = {
    point: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 0 },
    fraction: 0,
    auxiliaryDirection: { x: 0, y: 1, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
    obstacleSource: true,
  };

  constructor(triangles: readonly ObstacleTriangle[], triangleObbQuery: TriangleObbQuery,
    p3553Query: TriangleObbQuery | boolean) {
    this.triangles = triangles;
    this.triangleObbQuery = triangleObbQuery;
    this.isP3553Query = typeof p3553Query === "boolean" ?
      p3553Query : triangleObbQuery === p3553Query;
  }

  queryBest(origin: Vec3, movement: Vec3, includeWalls: boolean): number {
    this.bestTriangle = undefined;
    let bestFraction = Number.POSITIVE_INFINITY;
    for (const triangle of this.triangles) {
      if (!includeWalls && Math.abs(triangle.normal.y) < 0.6499999761581421) continue;
      const fraction = rayTriangleFraction(triangle, origin, movement);
      if (fraction === undefined || fraction >= bestFraction) continue;
      this.bestTriangle = triangle;
      bestFraction = fraction;
    }
    return bestFraction;
  }

  buildHit(origin: Vec3, movement: Vec3, fraction: number): ObstacleHit {
    const triangle = this.bestTriangle;
    if (!triangle) throw new Error("ObstacleSurface.buildHit 缺少 best triangle。");
    const hit = this.hit;
    hit.point.x = f32(origin.x + f32(movement.x * fraction));
    hit.point.y = f32(origin.y + f32(movement.y * fraction));
    hit.point.z = f32(origin.z + f32(movement.z * fraction));
    hit.normal.x = triangle.normal.x;
    hit.normal.y = triangle.normal.y;
    hit.normal.z = triangle.normal.z;
    hit.fraction = fraction;
    hit.auxiliaryDirection.x = 0;
    hit.auxiliaryDirection.y = 1;
    hit.auxiliaryDirection.z = 0;
    hit.surfaceVelocity.x = triangle.motion?.x ?? 0;
    hit.surfaceVelocity.y = triangle.motion?.y ?? 0;
    hit.surfaceVelocity.z = triangle.motion?.z ?? 0;
    return hit;
  }

  queryObb(box: unknown): ObstacleOverlap[] {
    const matches: ObstacleOverlap[] = [];
    for (const triangle of this.triangles) {
      if (!this.triangleObbQuery(triangle, box)) continue;
      matches.push({
        point: this.isP3553Query ?
          p3553TriangleCentroid(triangle) : legacyCentroid(triangle),
        normal: { ...triangle.normal },
        motion: "motion" in triangle ? { ...triangle.motion } : { x: 0, y: 0, z: 0 },
        velFactor: "velFactor" in triangle ? triangle.velFactor : 1,
        pressMode: triangle.pressMode,
      });
    }
    return matches;
  }
}
