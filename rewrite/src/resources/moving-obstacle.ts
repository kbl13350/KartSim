import { isTrackPrs, validatePrs } from "./track-prs-animation";

export interface ObstaclePoint { x: number; y: number; z: number }
export interface ObstacleBounds {
  kind: "ordinary" | "canonical" | "invalid" | "non-finite";
  min?: number[];
  max?: number[];
}
export interface TrackAttribute { name: string; value: string }
export interface TrackPropertyNode {
  name: string;
  attributes: TrackAttribute[];
  children: TrackPropertyNode[];
}
export interface ObstacleTrackNode {
  kind: string;
  name: string;
  className: string;
  children: ObstacleTrackNode[];
  slotOccurrences: Array<{ value: unknown } | undefined>;
  additionalProperty?: TrackPropertyNode;
  vertexData?: { positions: number[][]; indices: number[] };
}
export interface MovingObstacleObject {
  property?: TrackPropertyNode;
  object: ObstacleTrackNode;
}
export interface ObstacleTriangleBinding {
  node: ObstacleTrackNode;
  localA: number[];
  localB: number[];
  localC: number[];
  normal: ObstaclePoint;
  motion: ObstaclePoint;
  previousCenter?: ObstaclePoint;
}
export interface MovingObstacleTriangle {
  a: ObstaclePoint;
  b: ObstaclePoint;
  c: ObstaclePoint;
  normal: ObstaclePoint;
  motion: ObstaclePoint;
  velFactor: number;
  pressMode?: "directional" | "hard-stop";
}
export type ObstacleAdmission =
  | { status: "block"; reason: string }
  | { status: "admit"; animator: MovingObstacleAnimator;
      renderRoot: ObstacleTrackNode; hasPrs: boolean;
      pressMode?: "directional" | "hard-stop";
      collisionTriangleCount: number; markerProfile: string[] };

const f32 = Math.fround;

/** Track bounds use the same single-precision radius as their collision mesh. */
export function obstacleBoundsRadius(bounds: ObstacleBounds): number {
  if (bounds.kind !== "ordinary") {
    if (bounds.kind === "canonical") return 0;
    if (bounds.kind === "invalid") return Infinity;
    return NaN;
  }
  const min = bounds.min!;
  const max = bounds.max!;
  const halfSpan = max.map((value, axis) =>
    f32(value - f32(f32(min[axis]! + value) * 0.5)));
  const squared = f32(f32(f32(halfSpan[0]! * halfSpan[0]!)
    + f32(halfSpan[1]! * halfSpan[1]!)) + f32(halfSpan[2]! * halfSpan[2]!));
  return f32(Math.sqrt(squared));
}

/** Resource names can contain a trailing NUL and payload bytes. */
export function trackNameEquals(name: string, expected: string): boolean {
  const terminator = name.indexOf("\0");
  return name.slice(0, terminator < 0 ? name.length : terminator) === expected;
}

export function findTrackPropertyChild(parent: TrackPropertyNode,
  name: string): TrackPropertyNode | undefined {
  return parent.children.find(child => trackNameEquals(child.name, name));
}

export function trackObjectType(property?: TrackPropertyNode): string | undefined {
  const value = property?.children
    .find(child => trackNameEquals(child.name, "object"))
    ?.attributes.find(attribute => trackNameEquals(attribute.name, "type"))?.value;
  if (value === undefined) return undefined;
  const terminator = value.indexOf("\0");
  return value.slice(0, terminator < 0 ? value.length : terminator);
}

export function isTrackModelNode(value: unknown): value is ObstacleTrackNode {
  return !!(value && typeof value === "object" &&
    (value as { kind?: string }).kind === "node");
}

function dot3Float32(a: number, x: number, b: number, y: number,
  c: number, z: number): number {
  return f32(f32(f32(a * x) + f32(b * y)) + f32(c * z));
}

/** Convert the model's y-up matrix and vertices to the game's collision axes. */
export function transformObstaclePoint(point: number[], matrix: number[]): ObstaclePoint {
  const x = f32(dot3Float32(matrix[0]!, point[0]!, matrix[4]!, point[1]!,
    matrix[8]!, point[2]!) + matrix[12]!);
  const y = f32(dot3Float32(matrix[1]!, point[0]!, matrix[5]!, point[1]!,
    matrix[9]!, point[2]!) + matrix[13]!);
  const z = f32(dot3Float32(matrix[2]!, point[0]!, matrix[6]!, point[1]!,
    matrix[10]!, point[2]!) + matrix[14]!);
  return { x, y: z, z: f32(-y) };
}

export function obstacleTriangleNormal(a: ObstaclePoint, b: ObstaclePoint,
  c: ObstaclePoint): ObstaclePoint | undefined {
  const ab = { x: f32(b.x - a.x), y: f32(b.y - a.y), z: f32(b.z - a.z) };
  const ac = { x: f32(c.x - a.x), y: f32(c.y - a.y), z: f32(c.z - a.z) };
  const cross = {
    x: f32(f32(ab.y * ac.z) - f32(ab.z * ac.y)),
    y: f32(f32(ab.z * ac.x) - f32(ab.x * ac.z)),
    z: f32(f32(ab.x * ac.y) - f32(ab.y * ac.x)),
  };
  const length = f32(Math.sqrt(f32(f32(f32(cross.x * cross.x)
    + f32(cross.z * cross.z)) + f32(cross.y * cross.y))));
  if (length > 0) return {
    x: f32(cross.x / length), y: f32(cross.y / length),
    z: f32(cross.z / length),
  };
  return undefined;
}

export function obstacleTriangleCenter(a: ObstaclePoint, b: ObstaclePoint,
  c: ObstaclePoint): ObstaclePoint {
  const third = f32(0.3333300054);
  return {
    x: f32(f32(f32(a.x + b.x) + c.x) * third),
    y: f32(f32(f32(a.y + b.y) + c.y) * third),
    z: f32(f32(f32(a.z + b.z) + c.z) * third),
  };
}

/** Keeps last-frame triangles so collision and rendering see one coherent pose. */
export class MovingObstacleAnimator {
  lastUpdateMs = 0;
  center: ObstaclePoint = { x: 0, y: 0, z: 0 };
  radius = 0;
  currentTriangles: MovingObstacleTriangle[] = [];

  constructor(
    public bindings: ObstacleTriangleBinding[],
    public renderRoot: ObstacleTrackNode,
    public velFactor: number,
    public pressMode?: "directional" | "hard-stop",
  ) {}

  update(timeMs: number,
    previousWorldMatrix: (node: ObstacleTrackNode) => number[] | undefined,
    previousWorldBounds: (node: ObstacleTrackNode) => ObstacleBounds | undefined,
    camera?: ObstaclePoint): MovingObstacleTriangle[] {
    const now = Math.trunc(timeMs) >>> 0;
    const requiredMatrix = (node: ObstacleTrackNode) => {
      const matrix = previousWorldMatrix(node);
      if (!matrix)
        throw new Error(`${node.name || node.className} 缺少上一轮 scene world matrix。`);
      return matrix;
    };
    const bounds = previousWorldBounds(this.renderRoot);
    if (!bounds)
      throw new Error(`${this.renderRoot.name} 缺少上一轮 scene world bounds。`);
    this.radius = obstacleBoundsRadius(bounds);
    if (this.lastUpdateMs === 0) this.lastUpdateMs = now;
    return this.shouldThrottle(now, camera)
      ? this.currentTriangles : this.updateTriangles(now, requiredMatrix);
  }

  shouldThrottle(now: number, camera?: ObstaclePoint): boolean {
    if (!camera || ((now - this.lastUpdateMs) >>> 0) >= 333) return false;
    const range = f32(f32(this.radius * 4) + 10);
    const dx = f32(this.center.x - camera.x);
    const dy = f32(this.center.y - camera.y);
    const dz = f32(this.center.z - camera.z);
    return f32(f32(f32(dx * dx) + f32(dz * dz)) + f32(dy * dy))
      > f32(range * range);
  }

  updateTriangles(now: number,
    requiredMatrix: (node: ObstacleTrackNode) => number[]): MovingObstacleTriangle[] {
    const elapsed = (now - this.lastUpdateMs) >>> 0;
    const triangles = this.bindings.map(binding => {
      const matrix = requiredMatrix(binding.node);
      const a = transformObstaclePoint(binding.localA, matrix);
      const b = transformObstaclePoint(binding.localB, matrix);
      const c = transformObstaclePoint(binding.localC, matrix);
      binding.normal = obstacleTriangleNormal(a, b, c) ?? binding.normal;
      const center = obstacleTriangleCenter(a, b, c);
      if (binding.previousCenter && elapsed !== 0) {
        binding.motion = {
          x: f32(f32(f32(center.x - binding.previousCenter.x) * 1e3) / f32(elapsed)),
          y: f32(f32(f32(center.y - binding.previousCenter.y) * 1e3) / f32(elapsed)),
          z: f32(f32(f32(center.z - binding.previousCenter.z) * 1e3) / f32(elapsed)),
        };
      }
      binding.previousCenter = center;
      return { a, b, c, normal: binding.normal, motion: binding.motion,
        velFactor: this.velFactor, pressMode: this.pressMode };
    });
    const centers = this.bindings.map(binding => binding.previousCenter!);
    this.center = { x: 0, y: 0, z: 0 };
    if (centers.length > 0) {
      const count = f32(centers.length);
      this.center = {
        x: f32(centers.reduce((sum, point) => f32(sum + point.x), 0) / count),
        y: f32(centers.reduce((sum, point) => f32(sum + point.y), 0) / count),
        z: f32(centers.reduce((sum, point) => f32(sum + point.z), 0) / count),
      };
    }
    this.lastUpdateMs = now;
    this.currentTriangles = triangles;
    return triangles;
  }

  updateSnapshot(): MovingObstacleTriangle[] { return this.currentTriangles; }
  registrationCenter(): ObstaclePoint { return this.center; }
  modelRadius(): number { return this.radius; }
}

/** Admit track obstacle meshes, preserving PRS and collision marker decisions. */
export function admitMovingObstacle(object: MovingObstacleObject): ObstacleAdmission {
  if (trackObjectType(object.property) !== "obstacle")
    return { status: "block", reason: "not-obstacle" };
  if (!isTrackModelNode(object.object))
    return { status: "block", reason: "nested object 不是 Relement" };

  const bindings: ObstacleTriangleBinding[] = [];
  let problem: string | undefined;
  let hasPrs = false;
  let pressMode: "directional" | "hard-stop" | undefined;
  const markers = new Set<string>();

  const walk = (node: ObstacleTrackNode, insideObstacle: boolean,
    inheritedCull: number) => {
    const prs = node.slotOccurrences[1];
    if (prs) {
      if (!isTrackPrs(prs.value))
        problem ??= `${node.name || node.className} PRS 类型不受支持`;
      else {
        const diagnostic = validatePrs(prs.value);
        if (diagnostic) problem ??= `${node.name || node.className} ${diagnostic}`;
        else hasPrs = true;
      }
    }
    const extra = node.additionalProperty;
    if (extra) {
      for (const marker of ["effect", "gravity", "inv", "ob", "scale"])
        if (findTrackPropertyChild(extra, marker)) markers.add(marker);
      if (findTrackPropertyChild(extra, "press")) pressMode = "directional";
      else if (findTrackPropertyChild(extra, "press100")) pressMode = "hard-stop";
    }
    const backface = node.slotOccurrences[4]?.value as
      { kind?: string; cull?: number } | undefined;
    const cull = backface?.kind === "backface" && backface.cull !== undefined
      ? backface.cull : inheritedCull;
    if (insideObstacle && (node.className === "ReTriList"
      || node.className === "ReTriStrip")) {
      const vertices = node.vertexData;
      if (!vertices?.positions)
        problem ??= `${node.name || node.className} obstacle geometry 缺少 positions`;
      else {
        const addTriangle = (first: number, second: number, third: number) => {
          if (first === second || second === third || first === third) return;
          let b = second;
          let c = third;
          if (cull === 3) [b, c] = [c, b];
          const aPoint = vertices.positions[first];
          const bPoint = vertices.positions[b];
          const cPoint = vertices.positions[c];
          if (!aPoint || !bPoint || !cPoint) {
            problem ??= `${node.name || node.className} obstacle index 越界`;
            return;
          }
          bindings.push({ node, localA: aPoint, localB: bPoint,
            localC: cPoint, normal: { x: 0, y: 0, z: 0 },
            motion: { x: 0, y: 0, z: 0 } });
        };
        const indices = vertices.indices;
        if (node.className === "ReTriList") {
          for (let index = 0; index + 2 < indices.length; index += 3)
            addTriangle(indices[index]!, indices[index + 1]!, indices[index + 2]!);
        } else {
          for (let index = 0; index + 2 < indices.length; index++)
            addTriangle(index % 2 === 0 ? indices[index]! : indices[index + 1]!,
              index % 2 === 0 ? indices[index + 1]! : indices[index]!,
              indices[index + 2]!);
        }
      }
    }
    const childInsideObstacle = !!(extra && findTrackPropertyChild(extra, "ob"));
    node.children.forEach(child => walk(child, childInsideObstacle, cull));
  };
  walk(object.object, false, 2);
  if (problem) return { status: "block", reason: problem };

  const factorText = object.property?.children
    .find(child => trackNameEquals(child.name, "object"))
    ?.attributes.find(attribute => trackNameEquals(attribute.name, "velFactor"))?.value;
  const factor = factorText === undefined ? 1 : Number.parseFloat(factorText);
  if (!Number.isFinite(factor))
    return { status: "block", reason: `velFactor=${factorText} 无效` };
  return {
    status: "admit",
    animator: new MovingObstacleAnimator(bindings, object.object,
      f32(factor), pressMode),
    renderRoot: object.object, hasPrs, pressMode,
    collisionTriangleCount: bindings.length,
    markerProfile: [...markers].sort(),
  };
}
