export interface Vec3 { x: number; y: number; z: number }
export interface Triangle { a: Vec3; b: Vec3; c: Vec3 }
export interface OrientedBox {
  center: Vec3;
  axes: [Vec3, Vec3, Vec3];
  halfExtents: [number, number, number];
}

const f32 = Math.fround;

/**
 * Scratch vectors are reused during a vehicle physics step. The v0...v11
 * properties remain numbered because the vehicle runtime addresses them by
 * those keys; their allocations and initial zero values are centralized here.
 */
export function createVehicleCollisionScratch(newVector: () => Vec3) {
  return {
    force: newVector(),
    torque: newVector(),
    v0: newVector(), v1: newVector(), v2: newVector(), v3: newVector(),
    v4: newVector(), v5: newVector(), v6: newVector(), v7: newVector(),
    v8: newVector(), v9: newVector(), v10: newVector(), v11: newVector(),
    oldCompression: [0, 0, 0, 0],
    zeroNormals: [newVector(), newVector(), newVector(), newVector()],
    obb: {
      center: newVector(),
      axes: [newVector(), newVector(), newVector()],
      halfExtents: [0, 0, 0],
    },
    primaryResult: { responseHit: false, lowHit: false },
  };
}

/** Converts a track road descriptor only when one is present. */
export function optionalRoadSurface<T, R>(road: T | null | undefined,
  convert: (road: T) => R): R | undefined {
  return road ? convert(road) : undefined;
}

/** Centroid in physics coordinates: client Z is negated. */
export function triangleCentroid(triangle: Triangle): Vec3 {
  const third = f32(0.3333300054073334);
  return {
    x: f32(f32(f32(f32(triangle.a.x) + f32(triangle.b.x)) + f32(triangle.c.x)) * third),
    y: f32(f32(f32(f32(triangle.a.y) + f32(triangle.b.y)) + f32(triangle.c.y)) * third),
    z: f32(-f32(f32(f32(f32(-triangle.a.z) + f32(-triangle.b.z)) +
      f32(-triangle.c.z)) * third)),
  };
}

function projectVertex(x: number, z: number, y: number,
  axis: Vec3, flipSecondAxis: boolean): number {
  const ax = f32(flipSecondAxis ? -axis.x : axis.x);
  const az = f32(flipSecondAxis ? axis.z : -axis.z);
  const ay = f32(flipSecondAxis ? -axis.y : axis.y);
  return f32(f32(f32(ax * x) + f32(az * z)) + f32(ay * y));
}

function intervalsSeparated(minA: number, maxA: number, limit: number): boolean {
  const low = maxA > minA ? minA : maxA;
  const high = maxA > minA ? maxA : minA;
  return low > limit || -limit > high;
}

function edgeAgainstX(edgeY: number, edgeZ: number,
  ay: number, az: number, by: number, bz: number,
  boxY: number, boxZ: number): boolean {
  return intervalsSeparated(
    f32(f32(edgeZ * ay) - f32(edgeY * az)),
    f32(f32(edgeZ * by) - f32(edgeY * bz)),
    f32(f32(Math.abs(edgeZ) * boxY) + f32(Math.abs(edgeY) * boxZ)),
  );
}

function edgeAgainstY(edgeX: number, edgeZ: number,
  ax: number, az: number, bx: number, bz: number,
  boxX: number, boxZ: number): boolean {
  return intervalsSeparated(
    f32(f32(-edgeZ * ax) + f32(edgeX * az)),
    f32(f32(-edgeZ * bx) + f32(edgeX * bz)),
    f32(f32(Math.abs(edgeZ) * boxX) + f32(Math.abs(edgeX) * boxZ)),
  );
}

function edgeAgainstZ(edgeX: number, edgeY: number,
  ax: number, ay: number, bx: number, by: number,
  boxX: number, boxY: number): boolean {
  return intervalsSeparated(
    f32(f32(edgeY * ax) - f32(edgeX * ay)),
    f32(f32(edgeY * bx) - f32(edgeX * by)),
    f32(f32(Math.abs(edgeY) * boxX) + f32(Math.abs(edgeX) * boxY)),
  );
}

function dotF32(x: number, y: number, z: number,
  otherX: number, otherY: number, otherZ: number): number {
  return f32(f32(f32(x * otherX) + f32(y * otherY)) + f32(z * otherZ));
}

/** Separating-axis intersection test for a triangle and an axis-aligned box. */
export function projectedTriangleIntersectsBox(
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
  halfX: number, halfY: number, halfZ: number,
): boolean {
  const edgeAbX = f32(bx - ax), edgeAbY = f32(by - ay), edgeAbZ = f32(bz - az);
  const edgeBcX = f32(cx - bx), edgeBcY = f32(cy - by), edgeBcZ = f32(cz - bz);
  const edgeCaX = f32(ax - cx), edgeCaY = f32(ay - cy), edgeCaZ = f32(az - cz);
  if (
    edgeAgainstX(edgeAbY, edgeAbZ, ay, az, cy, cz, halfY, halfZ) ||
    edgeAgainstY(edgeAbX, edgeAbZ, ax, az, cx, cz, halfX, halfZ) ||
    edgeAgainstZ(edgeAbX, edgeAbY, bx, by, cx, cy, halfX, halfY) ||
    edgeAgainstX(edgeBcY, edgeBcZ, ay, az, cy, cz, halfY, halfZ) ||
    edgeAgainstY(edgeBcX, edgeBcZ, ax, az, cx, cz, halfX, halfZ) ||
    edgeAgainstZ(edgeBcX, edgeBcY, ax, ay, bx, by, halfX, halfY) ||
    edgeAgainstX(edgeCaY, edgeCaZ, ay, az, by, bz, halfY, halfZ) ||
    edgeAgainstY(edgeCaX, edgeCaZ, ax, az, bx, bz, halfX, halfZ) ||
    edgeAgainstZ(edgeCaX, edgeCaY, bx, by, cx, cy, halfX, halfY) ||
    Math.min(ax, bx, cx) > halfX || -halfX > Math.max(ax, bx, cx) ||
    Math.min(ay, by, cy) > halfY || -halfY > Math.max(ay, by, cy) ||
    Math.min(az, bz, cz) > halfZ || -halfZ > Math.max(az, bz, cz)
  ) return false;
  const normalX = f32(f32(edgeAbY * edgeBcZ) - f32(edgeAbZ * edgeBcY));
  const normalY = f32(f32(edgeAbZ * edgeBcX) - f32(edgeAbX * edgeBcZ));
  const normalZ = f32(f32(edgeAbX * edgeBcY) - f32(edgeAbY * edgeBcX));
  const planeOffset = -dotF32(normalX, normalY, normalZ, ax, ay, az);
  const nearX = normalX > 0 ? -halfX : halfX;
  const nearY = normalY > 0 ? -halfY : halfY;
  const nearZ = normalZ > 0 ? -halfZ : halfZ;
  return f32(dotF32(normalX, normalY, normalZ, nearX, nearY, nearZ) +
    planeOffset) > 0
    ? false
    : f32(dotF32(normalX, normalY, normalZ, -nearX, -nearY, -nearZ) +
      planeOffset) >= 0;
}

/** Projects a client-coordinate triangle into the physics box axes. */
export function triangleIntersectsOrientedBox(
  triangle: Triangle, box: OrientedBox): boolean {
  const [firstAxis, secondAxis, thirdAxis] = box.axes;
  const vertices = [triangle.a, triangle.b, triangle.c];
  const projected = vertices.flatMap(vertex => {
    const x = f32(f32(vertex.x) - f32(box.center.x));
    const z = f32(f32(-vertex.z) - f32(-box.center.z));
    const y = f32(f32(vertex.y) - f32(box.center.y));
    return [
      projectVertex(x, z, y, firstAxis, false),
      projectVertex(x, z, y, secondAxis, true),
      projectVertex(x, z, y, thirdAxis, false),
    ];
  });
  return projectedTriangleIntersectsBox(
    projected[0]!, projected[1]!, projected[2]!,
    projected[3]!, projected[4]!, projected[5]!,
    projected[6]!, projected[7]!, projected[8]!,
    f32(box.halfExtents[0]), f32(box.halfExtents[1]),
    f32(box.halfExtents[2]),
  );
}

function transformedCoordinate(a: number, b: number, c: number,
  x: number, y: number, z: number, offset: number): number {
  return f32(f32(f32(f32(a * x) + f32(b * y)) + f32(c * z)) + offset);
}

/** Writes the physics-coordinate AABB around an oriented client box. */
export function orientedBoxBounds(box: OrientedBox,
  bounds: [number, number, number, number, number, number] | number[]): void {
  const [axisX, axisY, axisZ] = box.axes;
  const halfX = f32(box.halfExtents[0]);
  const halfY = f32(box.halfExtents[1]);
  const halfZ = f32(box.halfExtents[2]);
  const centerX = f32(box.center.x);
  const centerY = f32(-box.center.z);
  const centerZ = f32(box.center.y);
  const xX = f32(axisX.x), xY = f32(-axisY.x), xZ = f32(axisZ.x);
  const yX = f32(-axisX.z), yY = f32(axisY.z), yZ = f32(-axisZ.z);
  const zX = f32(axisX.y), zY = f32(-axisY.y), zZ = f32(axisZ.y);
  for (let corner = 0; corner < 8; corner++) {
    const x = corner & 4 ? halfX : -halfX;
    const y = corner & 2 ? halfY : -halfY;
    const z = corner & 1 ? halfZ : -halfZ;
    const worldX = transformedCoordinate(xX, xY, xZ, x, y, z, centerX);
    const worldY = transformedCoordinate(yX, yY, yZ, x, y, z, centerY);
    const worldZ = transformedCoordinate(zX, zY, zZ, x, y, z, centerZ);
    if (corner === 0) {
      bounds[0] = bounds[3] = worldX;
      bounds[1] = bounds[4] = worldY;
      bounds[2] = bounds[5] = worldZ;
    } else {
      if (bounds[0]! > worldX) bounds[0] = worldX;
      if (bounds[1]! > worldY) bounds[1] = worldY;
      if (bounds[2]! > worldZ) bounds[2] = worldZ;
      if (worldX > bounds[3]!) bounds[3] = worldX;
      if (worldY > bounds[4]!) bounds[4] = worldY;
      if (worldZ > bounds[5]!) bounds[5] = worldZ;
    }
  }
}

export interface TrackedTriangle {
  previousVertices: unknown;
  surfaceVelocity?: Vec3;
}

/** Updates a moving triangle's surface velocity using uint32 millisecond time. */
export function updateTrackedTriangleVelocity<T extends TrackedTriangle>(
  triangles: Iterable<T>,
  verticesOf: (triangle: T) => ArrayLike<unknown>,
  timestampMs: number,
  previousTimestampMs: number,
  math: {
    cloneVector(value: unknown): Vec3;
    centroid(vertices: Vec3[]): Vec3;
    subtract(a: Vec3, b: Vec3): Vec3;
    scale(vector: Vec3, amount: number): Vec3;
    f32(value: number): number;
  },
): number {
  if (!Number.isSafeInteger(timestampMs) || timestampMs < 0 ||
      !Number.isSafeInteger(previousTimestampMs) || previousTimestampMs < 0) {
    throw new Error("tracked triangle timestamp 必须是非负整数毫秒。");
  }
  const timestamp = timestampMs >>> 0;
  const previous = previousTimestampMs >>> 0;
  const elapsed = (timestamp - (previous === 0 ? timestamp : previous)) >>> 0;
  const elapsedFloat = math.f32(elapsed);
  for (const triangle of triangles) {
    const source = verticesOf(triangle);
    const vertices = [
      math.cloneVector(source[0]),
      math.cloneVector(source[1]),
      math.cloneVector(source[2]),
    ];
    if (elapsed !== 0) {
      const displacement = math.subtract(
        math.centroid(vertices),
        math.centroid(triangle.previousVertices as Vec3[]),
      );
      const perSecond = math.scale(displacement, math.f32(1_000));
      triangle.surfaceVelocity = {
        x: math.f32(perSecond.x / elapsedFloat),
        y: math.f32(perSecond.y / elapsedFloat),
        z: math.f32(perSecond.z / elapsedFloat),
      };
    }
    triangle.previousVertices = vertices;
  }
  return timestamp;
}
