import type { Vec3 } from "./route";
import {
  p3553TriangleCentroid, rayTriangleFraction,
  type ObstacleTriangle, type TriangleObbQuery,
} from "./obstacle-surface";

export interface StaticTrackTriangle extends ObstacleTriangle {
  roadDescriptor: unknown;
  auxiliaryDirection: Vec3;
}

interface IndexedTrackTriangle extends StaticTrackTriangle {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface StaticTrackHit {
  point: Vec3;
  normal: Vec3;
  fraction: number;
  roadDescriptor: unknown;
  auxiliaryDirection: Vec3;
  surfaceVelocity: Vec3;
}

export interface StaticTrackOverlap {
  point: Vec3;
  normal: Vec3;
  roadDescriptor: unknown;
}

export interface StaticTrackSurfaceDependencies {
  p3553ObbQuery: TriangleObbQuery;
  p3553ObbBounds(box: unknown, result: number[]): void;
  roadDescriptorIssue(descriptor: unknown): string | undefined;
}

interface Point2 { x: number; y: number }

const f32 = Math.fround;
const CELL_FACTOR = 67108864;
const CELL_SIZE = 4;
const LEGACY_CENTROID_SCALE = 0.3333300054;

function cellCoordinate(value: number): number {
  return Math.trunc(f32(value * f32(0.25)));
}

function cellStart(value: number): number {
  return cellCoordinate(value) * CELL_SIZE;
}

function cellKey(x: number, y: number): number {
  return x * CELL_FACTOR + y;
}

function min3(a: number, b: number, c: number): number {
  let result = a;
  if (b < result) result = b;
  if (c < result) result = c;
  return result;
}

function max3(a: number, b: number, c: number): number {
  let result = a;
  if (b > result) result = b;
  if (c > result) result = c;
  return result;
}

function classifyAgainstEdge(points: readonly Point2[], start: Point2, end: Point2): number {
  const dx = f32(end.x - start.x);
  const dy = f32(end.y - start.y);
  const negativeDx = f32(-dx);
  let positive = false;
  let negative = false;
  for (const point of points) {
    const relativeY = f32(point.y - end.y);
    const relativeX = f32(point.x - end.x);
    const cross = f32(f32(relativeY * negativeDx) + f32(relativeX * dy));
    if (cross === 0) return 0;
    if (cross > 0) positive = true;
    if (cross < 0) negative = true;
    if (positive && negative) return 0;
  }
  return positive ? 1 : -1;
}

function separatedByEdge(first: readonly Point2[], second: readonly Point2[]): boolean {
  let previous = first[first.length - 1]!;
  for (const point of first) {
    if (classifyAgainstEdge(second, previous, point) > 0) return true;
    previous = point;
  }
  return false;
}

function intersectsCell(cell: readonly Point2[], triangle: readonly Point2[]): boolean {
  return !separatedByEdge(cell, triangle) && !separatedByEdge(triangle, cell);
}

/** Four-unit grid used by the released static road collision surface. */
export class StaticTrackSurface {
  readonly triangleObbQuery: TriangleObbQuery;
  readonly triangles: IndexedTrackTriangle[];
  readonly cells = new Map<number, number[]>();
  readonly rayCandidates = new Set<number>();
  readonly obbCandidates: number[] = [];
  readonly obbVisited = new Set<number>();
  readonly obbClientBounds = [0, 0, 0, 0, 0, 0];
  bestTriangle: IndexedTrackTriangle | undefined;
  readonly hit: StaticTrackHit = {
    point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 0 },
    fraction: 0, roadDescriptor: undefined,
    auxiliaryDirection: { x: 0, y: 0, z: 0 },
    surfaceVelocity: { x: 0, y: 0, z: 0 },
  };

  constructor(triangles: readonly StaticTrackTriangle[],
    triangleObbQuery: TriangleObbQuery,
    private readonly dependencies: StaticTrackSurfaceDependencies) {
    this.triangleObbQuery = triangleObbQuery;
    if (triangles.length === 0) throw new Error("导入赛道不含可用碰撞路面。");
    this.triangles = triangles.map(triangle => ({
      ...triangle,
      minX: Math.min(triangle.a.x, triangle.b.x, triangle.c.x),
      maxX: Math.max(triangle.a.x, triangle.b.x, triangle.c.x),
      minZ: Math.min(triangle.a.z, triangle.b.z, triangle.c.z),
      maxZ: Math.max(triangle.a.z, triangle.b.z, triangle.c.z),
    }));
    this.triangles.forEach((triangle, index) => {
      const issue = dependencies.roadDescriptorIssue(triangle.roadDescriptor);
      if (issue) throw new Error(`静态网格拒绝 road descriptor：${issue}。`);
      const projected: Point2[] = [triangle.a, triangle.b, triangle.c]
        .map(point => ({ x: point.x, y: -point.z }));
      const firstX = cellStart(min3(projected[0]!.x, projected[1]!.x, projected[2]!.x));
      const firstY = cellStart(min3(projected[0]!.y, projected[1]!.y, projected[2]!.y));
      const lastX = cellStart(max3(projected[0]!.x, projected[1]!.x, projected[2]!.x));
      const lastY = cellStart(max3(projected[0]!.y, projected[1]!.y, projected[2]!.y));
      const oriented = triangle.normal.y < 0 ?
        [projected[0]!, projected[2]!, projected[1]!] : projected;
      for (let x = firstX; x <= lastX; x += CELL_SIZE) {
        for (let y = firstY; y <= lastY; y += CELL_SIZE) {
          const square = [
            { x, y }, { x: x + CELL_SIZE, y },
            { x: x + CELL_SIZE, y: y + CELL_SIZE }, { x, y: y + CELL_SIZE },
          ];
          if (!intersectsCell(square, oriented)) continue;
          const key = cellKey(x >> 2, y >> 2);
          const occupants = this.cells.get(key);
          if (occupants) occupants.push(index);
          else this.cells.set(key, [index]);
        }
      }
    });
  }

  queryBest(origin: Vec3, movement: Vec3, includeWalls: boolean): number {
    this.bestTriangle = undefined;
    const endX = f32(origin.x + movement.x);
    const endZ = f32(origin.z + movement.z);
    const minX = cellCoordinate(Math.min(origin.x, endX));
    const maxX = cellCoordinate(Math.max(origin.x, endX));
    const minY = cellCoordinate(-Math.max(origin.z, endZ));
    const maxY = cellCoordinate(-Math.min(origin.z, endZ));
    const candidates = this.rayCandidates;
    candidates.clear();
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const occupants = this.cells.get(cellKey(x, y));
        if (occupants) for (const index of occupants) candidates.add(index);
      }
    }
    let bestFraction = Number.POSITIVE_INFINITY;
    for (const index of candidates) {
      const triangle = this.triangles[index]!;
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
    if (!triangle) throw new Error("TrackSurface.buildHit 缺少 best triangle。");
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
    hit.surfaceVelocity.x = 0;
    hit.surfaceVelocity.y = 0;
    hit.surfaceVelocity.z = 0;
    return hit;
  }

  queryObb(box: { center: Vec3; axes: Vec3[]; halfExtents: number[] }): StaticTrackOverlap[] {
    const p3553 = this.triangleObbQuery === this.dependencies.p3553ObbQuery;
    let minX: number, maxX: number, minY: number, maxY: number;
    if (p3553) {
      this.dependencies.p3553ObbBounds(box, this.obbClientBounds);
      minX = cellCoordinate(this.obbClientBounds[0]!);
      maxX = cellCoordinate(this.obbClientBounds[3]!);
      minY = cellCoordinate(this.obbClientBounds[1]!);
      maxY = cellCoordinate(this.obbClientBounds[4]!);
    } else {
      const halfX = box.halfExtents.reduce((sum, half, index) =>
        sum + half * Math.abs(box.axes[index]!.x), 0);
      const halfZ = box.halfExtents.reduce((sum, half, index) =>
        sum + half * Math.abs(box.axes[index]!.z), 0);
      minX = cellCoordinate(box.center.x - halfX);
      maxX = cellCoordinate(box.center.x + halfX);
      minY = cellCoordinate(-(box.center.z + halfZ));
      maxY = cellCoordinate(-(box.center.z - halfZ));
    }
    const candidates = this.obbCandidates;
    const visited = this.obbVisited;
    candidates.length = 0;
    visited.clear();
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const occupants = this.cells.get(cellKey(x, y));
        if (!occupants) continue;
        for (const index of occupants) {
          if (visited.has(index)) continue;
          if (p3553) {
            const triangle = this.triangles[index]!;
            if (max3(triangle.a.y, triangle.b.y, triangle.c.y) <
                this.obbClientBounds[2]! ||
                this.obbClientBounds[5]! <
                min3(triangle.a.y, triangle.b.y, triangle.c.y)) continue;
          }
          visited.add(index);
          candidates.push(index);
        }
      }
    }
    const matches: StaticTrackOverlap[] = [];
    for (const index of candidates) {
      const triangle = this.triangles[index]!;
      if (!this.triangleObbQuery(triangle, box)) continue;
      matches.push({
        point: p3553 ? p3553TriangleCentroid(triangle) : {
          x: (triangle.a.x + triangle.b.x + triangle.c.x) * LEGACY_CENTROID_SCALE,
          y: (triangle.a.y + triangle.b.y + triangle.c.y) * LEGACY_CENTROID_SCALE,
          z: (triangle.a.z + triangle.b.z + triangle.c.z) * LEGACY_CENTROID_SCALE,
        },
        normal: { ...triangle.normal }, roadDescriptor: triangle.roadDescriptor,
      });
    }
    return matches;
  }
}
