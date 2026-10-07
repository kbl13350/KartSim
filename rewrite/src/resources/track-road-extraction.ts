/** Extract the road mesh hierarchy carried by a track.1s scene. */

export type ModelVector3 = [number, number, number];
export interface RoadXmlNode {
  name: string;
  text: string;
  children: RoadXmlNode[];
  attributes: Array<{ name: string; value: string }>;
}
export interface ModelOccurrence<Value = unknown> { value: Value; encoding?: string }
export interface TextureSlot {
  kind: string;
  propertyOccurrence?: ModelOccurrence<RoadXmlNode>;
}
export interface RoadVertexData {
  positions?: ModelVector3[];
  indices: number[];
  uvs: number[][][];
}
export interface RoadModelNode {
  name: string;
  className: string;
  children: RoadModelNode[];
  transform: ModelVector3[];
  position: ModelVector3;
  scale: ModelVector3;
  slots: unknown[];
  slotOccurrences: Array<ModelOccurrence | undefined>;
  vertexData?: RoadVertexData;
  rigidGeometry?: unknown;
}
export interface RoadMeshRef { node: RoadModelNode; parent?: RoadMeshRef }
export interface RoadDescriptor {
  texture: ModelOccurrence<TextureSlot>;
  property: ModelOccurrence<RoadXmlNode>;
  road: RoadXmlNode;
  declaredAt: RoadMeshRef;
}
export interface RoadCollisionPoint { x: number; y: number; z: number }
export interface RoadCollisionTriangle {
  a: RoadCollisionPoint;
  b: RoadCollisionPoint;
  c: RoadCollisionPoint;
  normal: RoadCollisionPoint;
  auxiliaryDirection: RoadCollisionPoint;
  roadDescriptor: RoadDescriptor;
  origin: { mesh: RoadMeshRef; localIndices: number[] };
}
export interface RoadMeshStats {
  roadMeshCount: number;
  ownRoadMeshCount: number;
  expandedTriangleCount: number;
  registeredTriangleCount: number;
  admittedTriangleCount: number;
  deferredTriangleCount: number;
  reversedTriangleCount: number;
  roadMeshNames: string[];
}
export interface RoadExtraction {
  triangles: RoadCollisionTriangle[];
  deferredTriangles: RoadCollisionTriangle[];
  issues: Array<{ descriptor: RoadDescriptor; mesh: RoadMeshRef; reason: string }>;
  descriptorUses: Array<{ descriptor: RoadDescriptor; mesh: RoadMeshRef }>;
  stats: RoadMeshStats;
}

const f32 = Math.fround;
const identity: number[] = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

function floatDot3(a: number, x: number, b: number, y: number,
  c: number, z: number): number {
  return f32(f32(f32(a * x) + f32(b * y)) + f32(c * z));
}

function localMatrix(node: RoadModelNode): number[] {
  const [right, up, forward] = node.transform;
  const [sx, sy, sz] = node.scale;
  return [
    f32(right![0] * sx!), f32(right![1] * sy!), f32(right![2] * sz!),
    f32(node.position[0]),
    f32(up![0] * sx!), f32(up![1] * sy!), f32(up![2] * sz!),
    f32(node.position[1]),
    f32(forward![0] * sx!), f32(forward![1] * sy!),
    f32(forward![2] * sz!), f32(node.position[2]),
  ];
}

function multiplyAffine(parent: number[], local: number[]): number[] {
  const result = new Array<number>(12);
  for (let row = 0; row < 3; row++) {
    const offset = row * 4;
    for (let column = 0; column < 3; column++)
      result[offset + column] = floatDot3(parent[offset]!, local[column]!,
        parent[offset + 1]!, local[4 + column]!,
        parent[offset + 2]!, local[8 + column]!);
    result[offset + 3] = f32(floatDot3(parent[offset]!, local[3]!,
      parent[offset + 1]!, local[7]!, parent[offset + 2]!, local[11]!)
      + parent[offset + 3]!);
  }
  return result;
}

function transformVertices(vertices: ModelVector3[], matrix: number[]): ModelVector3[] {
  return vertices.map(vertex => [
    f32(floatDot3(matrix[0]!, vertex[0], matrix[1]!, vertex[1],
      matrix[2]!, vertex[2]) + matrix[3]!),
    f32(floatDot3(matrix[4]!, vertex[0], matrix[5]!, vertex[1],
      matrix[6]!, vertex[2]) + matrix[7]!),
    f32(floatDot3(matrix[8]!, vertex[0], matrix[9]!, vertex[1],
      matrix[10]!, vertex[2]) + matrix[11]!),
  ]);
}

function textureOccurrence(node: RoadModelNode):
  ModelOccurrence<TextureSlot> | undefined {
  const occurrence = node.slotOccurrences[7] as
    ModelOccurrence<TextureSlot> | undefined;
  if (!occurrence) {
    if (node.slots[7] !== undefined)
      throw new Error(`${node.name || node.className} 的 TexProperty 缺少 Object47 occurrence。`);
    return undefined;
  }
  if (occurrence.value?.kind !== "texture")
    throw new Error(`${node.name || node.className} 的 slot 8 不是 TexProperty。`);
  return occurrence;
}

function backfaceCull(node: RoadModelNode): number | undefined {
  const occurrence = node.slotOccurrences[4];
  if (!occurrence) {
    if (node.slots[4] !== undefined)
      throw new Error(`${node.name || node.className} 的 BackFaceProperty 缺少 Object47 occurrence。`);
    return undefined;
  }
  const value = occurrence.value as { kind?: string; cull?: number } | undefined;
  if (value?.kind !== "backface")
    throw new Error(`${node.name || node.className} 的 slot 5 不是 BackFaceProperty。`);
  return value.cull;
}

function roadGeometry(node: RoadModelNode):
  { kind: "strip" | "list"; positions: ModelVector3[];
    indices: number[]; uvs: number[][] } | undefined {
  if ((node.className === "ReTriList" || node.className === "ReTriStrip")
    && node.vertexData?.positions) {
    return { kind: node.className === "ReTriStrip" ? "strip" : "list",
      positions: node.vertexData.positions, indices: [...node.vertexData.indices],
      uvs: node.vertexData.uvs.flat() };
  }
  return undefined;
}

function collisionPoint(vector: ModelVector3): RoadCollisionPoint {
  return { x: vector[0], y: vector[2], z: -vector[1] };
}

function subtract(a: ModelVector3, b: ModelVector3): ModelVector3 {
  return [f32(a[0] - b[0]), f32(a[1] - b[1]), f32(a[2] - b[2])];
}
function add(a: ModelVector3, b: ModelVector3): ModelVector3 {
  return [f32(a[0] + b[0]), f32(a[1] + b[1]), f32(a[2] + b[2])];
}
function scale(a: ModelVector3, value: number): ModelVector3 {
  return [f32(a[0] * value), f32(a[1] * value), f32(a[2] * value)];
}
function cross(a: ModelVector3, b: ModelVector3): ModelVector3 {
  return [
    f32(f32(a[1] * b[2]) - f32(a[2] * b[1])),
    f32(f32(a[2] * b[0]) - f32(a[0] * b[2])),
    f32(f32(a[0] * b[1]) - f32(a[1] * b[0])),
  ];
}
function normalize(a: ModelVector3): ModelVector3 {
  const squared = f32(f32(f32(a[0] * a[0]) + f32(a[1] * a[1]))
    + f32(a[2] * a[2]));
  const length = f32(Math.sqrt(squared));
  return length !== 0 ? a.map(value => f32(value / length)) as ModelVector3
    : [1, 1, 1];
}
function triangleNormal(a: ModelVector3, b: ModelVector3,
  c: ModelVector3): ModelVector3 {
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

/** Some legacy surface families supply a tangent through UV orientation. */
function auxiliaryDirection(descriptor: RoadDescriptor, uvs: number[][],
  a: ModelVector3, b: ModelVector3, c: ModelVector3,
  ai: number, bi: number, ci: number): RoadCollisionPoint {
  const fallback: ModelVector3 = [0, 0, 1];
  const surface = descriptor.road.attributes.find(attribute =>
    attribute.name === "surface")?.value;
  if (!surface || surface.length <= 3 ||
    (surface.slice(0, 2) !== "BS" && surface.slice(0, 2) !== "JM"))
    return collisionPoint(fallback);
  const auv = uvs[ai];
  const buv = uvs[bi];
  const cuv = uvs[ci];
  if (!auv || !buv || !cuv) return collisionPoint(fallback);
  const uvSubtract = (left: number[], right: number[]) =>
    [f32(left[0]! - right[0]!), f32(left[1]! - right[1]!)];
  const abUv = uvSubtract(buv, auv);
  const acUv = uvSubtract(cuv, auv);
  const bcUv = uvSubtract(cuv, buv);
  const ab = subtract(b, a);
  const ac = subtract(c, a);
  const bc = subtract(c, b);
  const denominator = f32(acUv[0]! - abUv[0]!);
  const epsilon = f32(9999999747378752e-21);
  let tangent: ModelVector3;
  if (denominator <= epsilon && denominator >= -epsilon)
    tangent = bcUv[0]! < 0 ? scale(bc, -1) : bc;
  else {
    const ratio = f32(acUv[0]! / denominator);
    tangent = add(scale(ab, ratio), scale(ac, f32(1 - ratio)));
    if (f32(acUv[1]! + f32(ratio * f32(abUv[1]! - acUv[1]!))) < 0)
      tangent = scale(tangent, -1);
  }
  return collisionPoint(scale(normalize(tangent), -1));
}

/** Walks each model node, inheriting the nearest road declaration and cull mode. */
export function extractTrackRoads(root: RoadModelNode,
  descriptorIssue: (descriptor: RoadDescriptor) => string | undefined): RoadExtraction {
  const triangles: RoadCollisionTriangle[] = [];
  const deferredTriangles: RoadCollisionTriangle[] = [];
  const issues: RoadExtraction["issues"] = [];
  const descriptorUses: RoadExtraction["descriptorUses"] = [];
  const reportedDescriptors = new Set<RoadDescriptor>();
  const stats: RoadMeshStats = {
    roadMeshCount: 0, ownRoadMeshCount: 0,
    expandedTriangleCount: 0, registeredTriangleCount: 0,
    admittedTriangleCount: 0, deferredTriangleCount: 0,
    reversedTriangleCount: 0, roadMeshNames: [],
  };

  const walk = (node: RoadModelNode, parentMatrix: number[],
    inheritedRoad: RoadDescriptor | undefined, inheritedCull: number,
    parent?: RoadMeshRef) => {
    const mesh: RoadMeshRef = { node, parent };
    const matrix = multiplyAffine(parentMatrix, localMatrix(node));
    let descriptor = inheritedRoad;
    let declaredHere = false;
    const texture = textureOccurrence(node);
    if (texture) {
      const property = texture.value.propertyOccurrence;
      const road = property?.value.name === "property"
        ? property.value.children.find(child => child.name === "road")
        : undefined;
      descriptor = road && property
        ? { texture, property, road, declaredAt: mesh } : undefined;
      declaredHere = descriptor !== undefined;
    }
    const cull = backfaceCull(node) ?? inheritedCull;
    const geometry = roadGeometry(node);
    if (descriptor && !geometry && (node.vertexData || node.rigidGeometry))
      issues.push({ descriptor, mesh,
        reason: `road mesh class ${node.className} 不是 ReTriList/ReTriStrip` });

    if (descriptor && geometry) {
      descriptorUses.push({ descriptor, mesh });
      stats.roadMeshCount++;
      if (declaredHere) stats.ownRoadMeshCount++;
      const encoding = descriptor.property.encoding === "reference" ? "ref" : "new";
      stats.roadMeshNames.push(`${declaredHere ? encoding : "inherited"}:${node.name}`);
      const positions = transformVertices(geometry.positions, matrix);
      const diagnostic = descriptorIssue(descriptor);
      if (diagnostic && !reportedDescriptors.has(descriptor)) {
        reportedDescriptors.add(descriptor);
        issues.push({ descriptor, mesh, reason: diagnostic });
      }
      const addTriangle = (first: number, second: number, third: number) => {
        if (geometry.kind === "strip" &&
          (first === second || second === third || first === third)) return;
        let bIndex = second;
        let cIndex = third;
        stats.expandedTriangleCount++;
        if (cull === 3) {
          [bIndex, cIndex] = [cIndex, bIndex];
          stats.reversedTriangleCount++;
        }
        const a = positions[first];
        const b = positions[bIndex];
        const c = positions[cIndex];
        if (!a || !b || !c)
          throw new Error(`${node.name} 的原版 road 索引越界。`);
        if (![a, b, c].every(vertex => vertex[0] >= 0 && vertex[0] < 2e3
          && vertex[1] >= 0 && vertex[1] < 2e3)) return;
        const normal = triangleNormal(a, b, c);
        if (!normal) return;
        const triangle: RoadCollisionTriangle = {
          a: collisionPoint(a), b: collisionPoint(b), c: collisionPoint(c),
          normal: collisionPoint(normal),
          auxiliaryDirection: auxiliaryDirection(descriptor, geometry.uvs,
            a, b, c, first, bIndex, cIndex),
          roadDescriptor: descriptor,
          origin: { mesh, localIndices: [first, bIndex, cIndex] },
        };
        if (diagnostic) {
          deferredTriangles.push(triangle);
          stats.deferredTriangleCount++;
        } else {
          triangles.push(triangle);
          stats.admittedTriangleCount++;
        }
        stats.registeredTriangleCount++;
      };
      const indices = geometry.indices;
      if (geometry.kind === "list") {
        for (let index = 0; index + 2 < indices.length; index += 3)
          addTriangle(indices[index]!, indices[index + 1]!, indices[index + 2]!);
      } else {
        for (let index = 0; index + 2 < indices.length; index++)
          addTriangle(index % 2 === 0 ? indices[index]! : indices[index + 1]!,
            index % 2 === 0 ? indices[index + 1]! : indices[index]!,
            indices[index + 2]!);
      }
    }
    node.children.forEach(child => walk(child, matrix, descriptor, cull, mesh));
  };
  walk(root, identity, undefined, 2);
  return { triangles, deferredTriangles, issues, descriptorUses, stats };
}
