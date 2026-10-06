import {
  averageTriangleCenters, copyEventPoint, eventRadiusThreshold,
  eventTriangleOverlapsBox, modelBoundingRadius, squaredEventDistance,
  triangleCenter, triangleMotion, triangleNormal,
  type EventBox, type EventLocalPoint, type EventPoint, type EventTriangle,
} from "./event-geometry";

export interface EventSceneNode {
  name?: string;
  className?: string;
  children: EventSceneNode[];
  vertexData?: { positions: EventLocalPoint[] };
  rigidGeometry?: { positions: EventLocalPoint[] };
}

export interface EventTriangleBinding {
  nodePreorderPath: number[];
  indices: [number, number, number];
}

export interface MovingEventProjection {
  triangleBindings: EventTriangleBinding[];
}

export interface MovingEventOps<Matrix> {
  transformPoint(point: EventLocalPoint, matrix: Matrix): EventPoint;
}

interface BoundTriangle {
  node: EventSceneNode;
  localA: EventLocalPoint;
  localB: EventLocalPoint;
  localC: EventLocalPoint;
  normal: EventPoint;
  motion: EventPoint;
  previousCenter?: EventPoint;
}

function nodeAtPath(root: EventSceneNode, path: number[]): EventSceneNode {
  if (path[0] !== 0)
    throw new Error(`event node path 缺少 root 0：${path.join("/")}`);
  let node = root;
  for (const index of path.slice(1)) {
    const child = node.children[index];
    if (!child) throw new Error(`event node path 越界：${path.join("/")}`);
    node = child;
  }
  return node;
}

function collectModelPoints(root: EventSceneNode): { node: EventSceneNode; local: EventLocalPoint }[] {
  const points: { node: EventSceneNode; local: EventLocalPoint }[] = [];
  const visit = (node: EventSceneNode): void => {
    node.vertexData?.positions?.forEach(local => points.push({ node, local }));
    node.rigidGeometry?.positions.forEach(local => points.push({ node, local }));
    node.children.forEach(visit);
  };
  visit(root);
  return points;
}

/** Tracks moving event triangles and tests kart collision against their current pose. */
export class MovingTrackEvent<Matrix> {
  bindings: BoundTriangle[];
  modelPoints: { node: EventSceneNode; local: EventLocalPoint }[];
  lastUpdateMs = 0;
  center: EventPoint = { x: 0, y: 0, z: 0 };
  radius = 0;
  triangles: EventTriangle[] = [];
  #ops: MovingEventOps<Matrix>;

  constructor(root: EventSceneNode, projection: MovingEventProjection, ops: MovingEventOps<Matrix>) {
    this.bindings = projection.triangleBindings.map(binding => {
      const node = nodeAtPath(root, binding.nodePreorderPath);
      const positions = node.vertexData?.positions;
      const [localA, localB, localC] = binding.indices.map(index => positions?.[index]);
      if (!localA || !localB || !localC)
        throw new Error(`${node.name || node.className} event binding 缺少原始顶点。`);
      return {
        node, localA, localB, localC,
        normal: { x: 0, y: 0, z: 0 },
        motion: { x: 0, y: 0, z: 0 },
      };
    });
    this.modelPoints = collectModelPoints(root);
    this.#ops = ops;
  }

  update(nowMs: number, matrixOf: (node: EventSceneNode) => Matrix | undefined): void {
    const now = Math.trunc(nowMs) >>> 0;
    const previous = this.lastUpdateMs === 0 ? now : this.lastUpdateMs;
    const deltaMs = (now - previous) >>> 0;
    const centers: EventPoint[] = [];
    const requiredMatrix = (node: EventSceneNode): Matrix => {
      const matrix = matrixOf(node);
      if (!matrix)
        throw new Error(`${node.name || node.className} event 缺少上一轮 scene world matrix。`);
      return matrix;
    };
    this.triangles = this.bindings.map(binding => {
      const matrix = requiredMatrix(binding.node);
      const a = this.#ops.transformPoint(binding.localA, matrix);
      const b = this.#ops.transformPoint(binding.localB, matrix);
      const c = this.#ops.transformPoint(binding.localC, matrix);
      const center = triangleCenter(a, b, c);
      centers.push(center);
      const normal = triangleNormal(a, b, c);
      if (normal) binding.normal = normal;
      if (deltaMs !== 0 && binding.previousCenter)
        binding.motion = triangleMotion(center, binding.previousCenter, deltaMs);
      binding.previousCenter = center;
      return {
        a, b, c,
        normal: copyEventPoint(binding.normal),
        motion: copyEventPoint(binding.motion),
      };
    });
    this.center = averageTriangleCenters(centers);
    this.radius = modelBoundingRadius(this.modelPoints, requiredMatrix, this.#ops.transformPoint);
    this.lastUpdateMs = now;
  }

  shouldThrottle(nowMs: number, kartPosition: EventPoint | undefined): boolean {
    if (!kartPosition || (((Math.trunc(nowMs) >>> 0) - this.lastUpdateMs) >>> 0) >= 333)
      return false;
    return squaredEventDistance(this.center, kartPosition) > eventRadiusThreshold(this.radius, 10);
  }

  isInsideRegistrationRadius(position: EventPoint): boolean {
    return squaredEventDistance(this.center, position) < eventRadiusThreshold(this.radius, 0);
  }

  firstOverlap(box: EventBox): boolean {
    return this.triangles.some(triangle => eventTriangleOverlapsBox(triangle, box));
  }

  registrationCenter(): EventPoint { return this.center; }
  modelRadius(): number { return this.radius; }

  reset(): void {
    this.lastUpdateMs = 0;
    this.center = { x: 0, y: 0, z: 0 };
    this.radius = 0;
    this.triangles = [];
    this.bindings.forEach(binding => {
      binding.normal = { x: 0, y: 0, z: 0 };
      binding.motion = { x: 0, y: 0, z: 0 };
      binding.previousCenter = undefined;
    });
  }
}
