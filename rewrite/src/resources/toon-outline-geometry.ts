/** The released toon edge tracer, split from its Three.js scene owner. */

export interface OutlinePoint {
  x: number; y: number; z: number; rhw: number; invalid: boolean;
}
export interface OutlineFace {
  positionIndices: [number, number, number];
  adjacentFaceIndices: [number, number, number];
  outlineOpenEdge: number;
}
export interface OutlineProfileEntry { x: number; y: number; valid: boolean }
export interface OutlineAttribute<T extends Float32Array | Uint16Array> {
  array: T;
  count: number;
  updateRanges: Array<{ start: number; count: number }>;
  clearUpdateRanges(): void;
  needsUpdate: boolean;
}
export interface OutlineGeometry {
  setDrawRange(start: number, count: number): void;
}
export interface ToonOutlineWorkspace {
  source: { faces: OutlineFace[] };
  projected: OutlinePoint[];
  classificationFaces: Array<{
    a: OutlinePoint; b: OutlinePoint; c: OutlinePoint; doubleSided: boolean;
  }>;
  classes: Uint8Array;
  links: Array<{ predecessor: number; successor: number }>;
  conflicts: Uint32Array;
  consumed: Uint8Array;
  section: Uint32Array;
  conflictValueCount: number;
  sectionCount: number;
  vertexCount: number;
  stripCount: number;
  triangleCount: number;
  frameProfile: OutlineProfileEntry[];
  centerColor: number[];
  outerColor: number[];
  positionAttribute: OutlineAttribute<Float32Array>;
  colorAttribute: OutlineAttribute<Float32Array>;
  indexAttribute: OutlineAttribute<Uint16Array>;
  strip: Uint16Array;
  geometry: OutlineGeometry;
  positionUpdateRange: { start: number; count: number };
  colorUpdateRange: { start: number; count: number };
  indexUpdateRange: { start: number; count: number };
  edgeSelected(face: number, edge: number, faceClass: number): boolean;
  linkOrRecordConflict(from: number, to: number): void;
  appendSection(closed: boolean): void;
  sectionOutgoingDirection(index: number, fallback: number, closed: boolean): number;
  emitJoin(vertex: number, incoming: number, outgoing: number, bridge: boolean): void;
  emitVertex(vertex: number, offset: OutlineProfileEntry | undefined, center: boolean): void;
  requireVertexCapacity(additional: number): void;
  bridge(first: number): void;
  appendStrip(index: number): void;
}

const f32 = Math.fround;

/** The original uses round-to-even; Math.round differs at exact half bins. */
function roundToEven(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  return fraction < 0.5 ? floor : fraction > 0.5 ? floor + 1
    : floor % 2 === 0 ? floor : floor + 1;
}

export function outlineDirection(from: OutlinePoint, to: OutlinePoint): number {
  const dx = roundToEven((to.x - from.x) * 128);
  const dy = roundToEven((to.y - from.y) * 128);
  let octant: number;
  if (dx === 0) octant = 8;
  else {
    const slope = Math.trunc((dy * 16) / dx);
    const magnitude = Math.abs(slope);
    octant = magnitude > 127 ? 8 : magnitude === 0 ? 0 : 32 - Math.clz32(magnitude);
  }
  return dx < 0 ? (dy >= 0 ? 16 - octant : 16 + octant)
    : dy >= 0 ? octant : -octant & 31;
}

export function classifyOutlineFaces(host: ToonOutlineWorkspace): void {
  for (let index = 0; index < host.classificationFaces.length; index++) {
    const face = host.classificationFaces[index]!;
    const { a, b, c } = face;
    if (!a || !b || !c || a.invalid || b.invalid || c.invalid) {
      host.classes[index] = 3;
      continue;
    }
    const left = f32(f32(b.x - a.x) * f32(c.y - b.y));
    const right = f32(f32(b.y - a.y) * f32(c.x - b.x));
    host.classes[index] = left > right ? face.doubleSided ? 1 : 2 : 0;
  }
}

export function resetOutlineWorkspace(host: ToonOutlineWorkspace): void {
  for (const link of host.links) {
    link.predecessor = -1;
    link.successor = -1;
  }
  host.consumed.fill(0);
  host.conflictValueCount = 0;
  host.sectionCount = 0;
  host.vertexCount = 0;
  host.stripCount = 0;
  host.triangleCount = 0;
}

export function buildOutlineLinks(host: ToonOutlineWorkspace): void {
  for (let faceIndex = 0; faceIndex < host.source.faces.length; faceIndex++) {
    const faceClass = host.classes[faceIndex]!;
    if (faceClass !== 0 && faceClass !== 1) continue;
    const face = host.source.faces[faceIndex]!;
    for (let edge = 0; edge < 3; edge++) {
      if (!host.edgeSelected(faceIndex, edge, faceClass)) continue;
      const start = face.positionIndices[edge]!;
      const end = face.positionIndices[(edge + 1) % 3]!;
      host.linkOrRecordConflict(faceClass === 0 ? start : end,
        faceClass === 0 ? end : start);
    }
  }
}

export function selectOutlineEdge(host: ToonOutlineWorkspace,
  faceIndex: number, edge: number, faceClass: number): boolean {
  const face = host.source.faces[faceIndex]!;
  const adjacent = face.adjacentFaceIndices[edge]!;
  if (adjacent === 65535) return face.outlineOpenEdge !== 0;
  const adjacentClass = host.classes[adjacent]!;
  return faceClass === 0 && adjacentClass === 1 || adjacentClass === 2;
}

export function linkOutlineEdge(host: ToonOutlineWorkspace, from: number, to: number): void {
  if (host.links[from]!.successor === -1 && host.links[to]!.predecessor === -1) {
    host.links[from]!.successor = to;
    host.links[to]!.predecessor = from;
    return;
  }
  host.conflicts[host.conflictValueCount] = from;
  host.conflicts[host.conflictValueCount + 1] = to;
  host.conflictValueCount += 2;
}

export function emitOpenOutlineSections(host: ToonOutlineWorkspace): void {
  for (let start = 0; start < host.links.length; start++) {
    const link = host.links[start]!;
    if (link.predecessor !== -1 || link.successor === -1 || host.consumed[start])
      continue;
    host.sectionCount = 0;
    let vertex = start;
    while (vertex !== -1 && !host.consumed[vertex]) {
      host.consumed[vertex] = 1;
      host.section[host.sectionCount++] = vertex;
      vertex = host.links[vertex]!.successor;
    }
    host.appendSection(false);
  }
}

export function emitClosedOutlineSections(host: ToonOutlineWorkspace): void {
  for (let start = 0; start < host.links.length; start++) {
    if (host.links[start]!.successor === -1 || host.consumed[start]) continue;
    host.sectionCount = 0;
    let vertex = start;
    do {
      host.consumed[vertex] = 1;
      host.section[host.sectionCount++] = vertex;
      vertex = host.links[vertex]!.successor;
    } while (vertex !== start && vertex !== -1 && !host.consumed[vertex]);
    host.appendSection(vertex === start);
  }
}

export function appendOutlineSection(host: ToonOutlineWorkspace, closed: boolean): void {
  if (host.sectionCount < 2) return;
  const firstVertex = host.vertexCount;
  let incoming = outlineDirection(host.projected[host.section[0]!]!,
    host.projected[host.section[1]!]!);
  let first = true;
  for (let index = 0; index < host.sectionCount; index++) {
    const vertex = host.section[index]!;
    const outgoing = host.sectionOutgoingDirection(index, incoming, closed);
    host.emitJoin(vertex, index === 0 && !closed ? outgoing : incoming,
      outgoing, first && host.stripCount > 0);
    first = false;
    incoming = outgoing;
  }
  if (closed) {
    host.appendStrip(firstVertex);
    host.appendStrip(firstVertex + 1);
  }
}

export function outlineSectionOutgoingDirection(host: ToonOutlineWorkspace,
  index: number, fallback: number, closed: boolean): number {
  const vertex = host.section[index]!;
  return index + 1 < host.sectionCount
    ? outlineDirection(host.projected[vertex]!,
      host.projected[host.section[index + 1]!]!)
    : closed ? outlineDirection(host.projected[vertex]!,
      host.projected[host.section[0]!]!) : fallback;
}

export function emitOutlineJoin(host: ToonOutlineWorkspace,
  vertex: number, incoming: number, outgoing: number, bridge: boolean): void {
  const join = host.frameProfile[incoming * 32 + outgoing]!;
  const first = host.vertexCount;
  if (join.valid) {
    host.requireVertexCapacity(2);
    host.emitVertex(vertex, undefined, true);
    host.emitVertex(vertex, join, false);
    if (bridge) host.bridge(first);
    host.appendStrip(first);
    host.appendStrip(first + 1);
    return;
  }
  host.requireVertexCapacity(3);
  const incomingOffset = host.frameProfile[incoming * 32 + incoming]!;
  const outgoingOffset = host.frameProfile[outgoing * 32 + outgoing]!;
  host.emitVertex(vertex, incomingOffset, true);
  host.emitVertex(vertex, incomingOffset, false);
  host.emitVertex(vertex, outgoingOffset, false);
  if (bridge) host.bridge(first);
  host.appendStrip(first);
  host.appendStrip(first + 1);
  host.appendStrip(first);
  host.appendStrip(first + 2);
}

export function emitOutlineVertex(host: ToonOutlineWorkspace,
  vertex: number, offset: OutlineProfileEntry | undefined, center: boolean): void {
  const point = host.projected[vertex]!;
  const position = host.positionAttribute.array;
  const color = host.colorAttribute.array;
  const at = host.vertexCount * 4;
  position[at] = f32(point.x + (offset && !center ? offset.x : 0));
  position[at + 1] = f32(point.y + (offset && !center ? offset.y : 0));
  position[at + 2] = point.z;
  position[at + 3] = point.rhw;
  const selectedColor = center ? host.centerColor : host.outerColor;
  color[at] = selectedColor[0]!;
  color[at + 1] = selectedColor[1]!;
  color[at + 2] = selectedColor[2]!;
  color[at + 3] = selectedColor[3]!;
  host.vertexCount++;
}

export function emitOutlineConflicts(host: ToonOutlineWorkspace): void {
  for (let index = 0; index < host.conflictValueCount; index += 2) {
    const from = host.conflicts[index]!;
    const to = host.conflicts[index + 1]!;
    const direction = outlineDirection(host.projected[from]!, host.projected[to]!);
    const offset = host.frameProfile[direction * 32 + direction]!;
    const first = host.vertexCount;
    host.requireVertexCapacity(4);
    host.emitVertex(from, undefined, true);
    host.emitVertex(from, offset, false);
    host.emitVertex(to, undefined, true);
    host.emitVertex(to, offset, false);
    host.bridge(first);
    host.appendStrip(first);
    host.appendStrip(first + 1);
    host.appendStrip(first + 2);
    host.appendStrip(first + 3);
  }
}

export function requireOutlineVertexCapacity(host: ToonOutlineWorkspace,
  additional: number): void {
  if (host.vertexCount + additional > host.positionAttribute.count)
    throw new Error("Toon outline 16-bit buffer capacity exceeded。 ");
}

export function bridgeOutlineStrip(host: ToonOutlineWorkspace, first: number): void {
  if (host.stripCount === 0) return;
  const last = host.strip[host.stripCount - 1]!;
  host.appendStrip(last);
  host.appendStrip(first);
}

export function appendOutlineStrip(host: ToonOutlineWorkspace, vertex: number): void {
  if (host.stripCount >= host.strip.length)
    throw new Error("Toon outline strip capacity exceeded。 ");
  host.strip[host.stripCount++] = vertex;
}

export function expandOutlineStrip(host: ToonOutlineWorkspace): void {
  const indices = host.indexAttribute.array;
  host.triangleCount = 0;
  for (let index = 2; index < host.stripCount; index++) {
    const a = host.strip[index % 2 === 0 ? index - 2 : index - 1]!;
    const b = host.strip[index % 2 === 0 ? index - 1 : index - 2]!;
    const c = host.strip[index]!;
    if (a === b || b === c || a === c) continue;
    if (host.triangleCount + 3 > indices.length)
      throw new Error("Toon outline index capacity exceeded。 ");
    indices[host.triangleCount] = a;
    indices[host.triangleCount + 1] = b;
    indices[host.triangleCount + 2] = c;
    host.triangleCount += 3;
  }
}

function publishAttribute(attribute: OutlineAttribute<Float32Array | Uint16Array>,
  range: { start: number; count: number }, count: number): void {
  attribute.clearUpdateRanges();
  if (count !== 0) {
    range.count = count;
    attribute.updateRanges.push(range);
    attribute.needsUpdate = true;
  }
}

export function publishOutlineGeometry(host: ToonOutlineWorkspace): void {
  host.geometry.setDrawRange(0, host.triangleCount);
  publishAttribute(host.positionAttribute, host.positionUpdateRange, host.vertexCount * 4);
  publishAttribute(host.colorAttribute, host.colorUpdateRange, host.vertexCount * 4);
  publishAttribute(host.indexAttribute, host.indexUpdateRange, host.triangleCount);
}
