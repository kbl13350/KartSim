import { BufferAttribute, DynamicDrawUsage, type BufferGeometry } from "three";

/** Frame bookkeeping and the visible body mesh for the released toon renderer. */
export interface ToonFrameHost {
  source: { faces: unknown[] };
  classes: Uint8Array;
  geometry: { setDrawRange(start: number, count: number): void };
  object: { visible: boolean };
  positionAttribute: { array: Float32Array };
  colorAttribute: { array: Float32Array };
  indexAttribute: { array: Uint16Array };
  vertexCount: number;
  stripCount: number;
  triangleCount: number;
  updateSerial: number;
  frameEmitted: boolean;
  frameViewportValue?: { width: number; height: number };
  cachedBody?: ToonBody;
  cachedPosition?: BufferAttribute;
  cachedPositionVersion: number;
  cachedIndexVersion: number;
  cachedWidth: number;
  cachedHeight: number;
  cachedProfile?: unknown;
  cachedEnabled: boolean;
  cachedEmitted: boolean;
  cachedViewport?: { width: number; height: number };
  cachedProjection?: Float32Array;
  frameProfile: unknown;
  bodySourceIndices?: Uint32Array;
  bodyIndex?: BufferAttribute;
  bodyIndexUpdateRange: { start: number; count: number };
  batched: boolean;
  batchDisposer?: (host: ToonFrameHost) => void;
  material: { dispose(): void };
  prepareBodyIndex(geometry: ToonBodyGeometry): BufferAttribute;
}
export interface ToonBodyGeometry extends Pick<BufferGeometry,
  "getAttribute" | "getIndex" | "setIndex" | "setDrawRange" | "drawRange"> {
  index: BufferAttribute | null;
}
export interface ToonBody { geometry: ToonBodyGeometry }

export function setToonBatched(host: ToonFrameHost, batched: boolean): void {
  host.batched = batched;
  host.object.visible = !batched;
}

export function dropToonFrame(host: ToonFrameHost, nextSerial: () => number): void {
  host.cachedBody = undefined;
  host.updateSerial = nextSerial();
  host.frameEmitted = false;
  host.frameViewportValue = undefined;
  host.vertexCount = 0;
  host.stripCount = 0;
  host.triangleCount = 0;
  host.geometry.setDrawRange(0, 0);
}

export function takeToonFrame(host: ToonFrameHost, after: number, through: number): boolean {
  const available = host.frameEmitted && host.updateSerial > after &&
    host.updateSerial <= through;
  if (host.updateSerial <= through) host.frameEmitted = false;
  return available;
}

export function copyToonFrameInto(host: ToonFrameHost, positions: Float32Array,
  colors: Float32Array, indices: Uint32Array, vertexOffset: number,
  indexOffset: number, baseVertex: number): void {
  positions.set(host.positionAttribute.array.subarray(0, host.vertexCount * 4), vertexOffset);
  colors.set(host.colorAttribute.array.subarray(0, host.vertexCount * 4), vertexOffset);
  const frameIndices = host.indexAttribute.array;
  for (let index = 0; index < host.triangleCount; index++)
    indices[indexOffset + index] = frameIndices[index]! + baseVertex;
}

export function rememberToonRigidFrame(host: ToonFrameHost, body: ToonBody,
  width: number, height: number, enabled: boolean): void {
  if (!host.cachedProjection) return;
  const position = body.geometry.getAttribute("position");
  if (!(position instanceof BufferAttribute)) return;
  host.cachedBody = body;
  host.cachedPosition = position;
  host.cachedPositionVersion = position.version;
  host.cachedIndexVersion = body.geometry.getIndex()?.version ?? -1;
  host.cachedWidth = width;
  host.cachedHeight = height;
  host.cachedProfile = host.frameProfile;
  host.cachedEnabled = enabled;
  host.cachedEmitted = host.frameEmitted;
  host.cachedViewport = host.frameViewportValue;
}

export function prepareToonBodyIndex(host: ToonFrameHost,
  geometry: ToonBodyGeometry): BufferAttribute {
  if (!host.bodyIndex) {
    const start = geometry.index ? 0 : geometry.drawRange.start;
    host.bodySourceIndices = geometry.index
      ? Uint32Array.from(geometry.index.array)
      : Uint32Array.from({ length: host.source.faces.length * 3 }, (_, index) => start + index);
    host.bodyIndex = new BufferAttribute(new Uint32Array(host.bodySourceIndices.length), 1);
    host.bodyIndex.setUsage(DynamicDrawUsage);
    geometry.setIndex(host.bodyIndex);
  }
  return host.bodyIndex;
}

export function updateToonBodyGeometry(host: ToonFrameHost,
  geometry: ToonBodyGeometry): void {
  const index = host.prepareBodyIndex(geometry);
  const sourceIndices = host.bodySourceIndices!;
  let count = 0;
  const output = index.array as Uint32Array;
  for (let face = 0; face < host.classes.length; face++) {
    const faceClass = host.classes[face]!;
    if (faceClass > 1) continue;
    const start = face * 3;
    output[count++] = sourceIndices[start]!;
    output[count++] = sourceIndices[start + (faceClass === 0 ? 1 : 2)]!;
    output[count++] = sourceIndices[start + (faceClass === 0 ? 2 : 1)]!;
  }
  geometry.setDrawRange(0, count);
  index.clearUpdateRanges();
  if (count !== 0) {
    host.bodyIndexUpdateRange.count = count;
    index.updateRanges.push(host.bodyIndexUpdateRange);
    index.needsUpdate = true;
  }
}

export function disposeToonFrame(host: ToonFrameHost): void {
  host.cachedBody = undefined;
  host.cachedPosition = undefined;
  host.cachedViewport = undefined;
  host.batchDisposer?.(host);
  // The scene owner disposes its actual BufferGeometry object.
  (host.geometry as ToonFrameHost["geometry"] & { dispose(): void }).dispose();
  host.material.dispose();
}
