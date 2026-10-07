/** Kart tail lamp ribbons, from attachment selection through trail simulation and rendering. */

export interface TrailVector { x: number; y: number; z: number }
export interface TailLampDefinition {
  tailLampSize: number;
  tailLampColorSource?: string;
  shortTrailTailLampSize: number;
  shortTrailTailLampColorSource?: string;
  shortTrailAttachmentSlots: number[];
  attachments: unknown[];
}
export interface TrailProjectionRecord {
  attachmentSlot: number;
  source: "tail-lamp" | "short-trail";
}
export interface TrailProjection {
  records: TrailProjectionRecord[];
  normalRecordCount: number;
  tailLampSize: number;
  tailLampColorSource?: string;
  shortTrailSize: number;
  shortTrailColorSource?: string;
  tailLampLifetimeSeconds: number;
  maximumRecords: 16;
}
export type TrailPresentation = "driving" | "shadow-driving" | "garage-preview";
export interface TrailFrame {
  attachment: TrailVector;
  orientationColumn1: TrailVector;
  scale: number;
}
export interface TrailPoint {
  left: TrailVector;
  right: TrailVector;
  ageSeconds: number;
  lifetimeFraction: number;
  center: TrailVector;
  direction: TrailVector;
  scale: number;
}
interface TrailRecordState {
  active: boolean;
  activationPending: boolean;
  activationStartedMs: number;
  lastUpdateMs: number;
  width: number;
  history: TrailPoint[];
  pool: TrailPoint[];
}

const trailCapacity = 47;
const shortTrailLifetimeFactor = Math.fround(0.6000000238418579);
const garagePreviewSpacing = Math.fround(1.3);
const garagePreviewForward = { x: 0, y: 0, z: 1 };
const emptyHistory: TrailPoint[] = [];
const f32 = Math.fround;

function vector(): TrailVector { return { x: 0, y: 0, z: 0 }; }
function trailPoint(): TrailPoint {
  return { left: vector(), right: vector(), ageSeconds: 0, lifetimeFraction: 0,
    center: vector(), direction: vector(), scale: 1 };
}

/** Select the visible tail lamp and short trail attachments, capped by the native 16-record limit. */
export function projectTailLampDefinition(definition: TailLampDefinition,
  context: "live" | "shadow" = "live"): TrailProjection {
  const records: TrailProjectionRecord[] = [];
  if (definition.tailLampSize > 0) {
    records.push({ attachmentSlot: 14, source: "tail-lamp" },
      { attachmentSlot: 15, source: "tail-lamp" });
  }
  const normalRecordCount = records.length;
  if (definition.shortTrailTailLampSize > 0) {
    for (const attachmentSlot of definition.shortTrailAttachmentSlots) {
      if (records.length < 16) records.push({ attachmentSlot, source: "short-trail" });
    }
  }
  return {
    records, normalRecordCount,
    tailLampSize: definition.tailLampSize,
    tailLampColorSource: definition.tailLampColorSource,
    shortTrailSize: definition.shortTrailTailLampSize,
    shortTrailColorSource: definition.shortTrailTailLampColorSource,
    tailLampLifetimeSeconds: f32(context === "shadow" ? 0.4 : 0.09),
    maximumRecords: 16,
  };
}

/** Initialize a trail sample with the native XZ-plane width projection and float32 rounding. */
export function setTrailPoint(point: TrailPoint, center: TrailVector, direction: TrailVector,
  scale: number, width: number): void {
  const directionLength = Math.hypot(direction.x, direction.y, direction.z);
  const normalizedX = directionLength > 0 ? f32(direction.x / directionLength) : 0;
  const normalizedZ = directionLength > 0 ? f32(direction.z / directionLength) : 0;
  const sidewaysX = f32(-normalizedZ);
  const sidewaysZ = f32(normalizedX);
  const sidewaysLength = Math.hypot(sidewaysX, sidewaysZ);
  const unitX = sidewaysLength > 0 ? f32(sidewaysX / sidewaysLength) : 0;
  const unitZ = sidewaysLength > 0 ? f32(sidewaysZ / sidewaysLength) : 0;
  const halfWidth = f32(f32(f32(width) * f32(scale)) * 0.5);
  const offsetX = f32(unitX * halfWidth);
  const offsetZ = f32(unitZ * halfWidth);
  point.left.x = f32(center.x - offsetX);
  point.left.y = center.y;
  point.left.z = f32(center.z - offsetZ);
  point.right.x = f32(center.x + offsetX);
  point.right.y = center.y;
  point.right.z = f32(center.z + offsetZ);
  point.center.x = center.x;
  point.center.y = center.y;
  point.center.z = center.z;
  point.direction.x = direction.x;
  point.direction.y = direction.y;
  point.direction.z = direction.z;
  point.scale = scale;
  point.ageSeconds = 0;
  point.lifetimeFraction = 0;
}

/** The trail's delayed activation, fixed pool, expiration and garage preview state. */
export class TailLampTrailRuntime {
  records: TrailRecordState[];
  constructor(public projection: TrailProjection,
    public presentation: TrailPresentation = "driving") {
    this.records = projection.records.map(record => ({
      active: false, activationPending: false, activationStartedMs: 0, lastUpdateMs: 0,
      width: record.source === "tail-lamp" ? projection.tailLampSize : projection.shortTrailSize,
      history: [], pool: Array.from({ length: trailCapacity }, trailPoint),
    }));
  }

  setState(state: number, nowMs: number): void {
    if (state === 1 || state === 2) return;
    const enabled = state !== 0;
    const tick = Math.trunc(nowMs) >>> 0;
    for (const record of this.records) {
      if (enabled) {
        if (record.active || record.activationPending) continue;
        if (this.presentation === "driving") {
          for (const point of record.history) record.pool.push(point);
          record.history.length = 0;
        }
        record.activationPending = true;
        record.activationStartedMs = tick;
        continue;
      }
      record.active = false;
      record.activationPending = false;
    }
  }

  restartGaragePreview(): void {
    if (this.presentation !== "garage-preview") return;
    for (const record of this.records) {
      for (const point of record.history) record.pool.push(point);
      record.history.length = 0;
      record.active = false;
      record.activationPending = false;
      record.activationStartedMs = 0;
      record.lastUpdateMs = 0;
    }
  }

  update(nowMs: number, frames: TrailFrame[]): void {
    const tick = Math.trunc(nowMs) >>> 0;
    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index]!;
      if (record.activationPending && ((tick - record.activationStartedMs) >>> 0) >= 100) {
        record.activationPending = false;
        record.active = true;
        record.lastUpdateMs = tick;
      }
      if (!record.active) continue;
      const frame = frames[index];
      if (this.presentation === "garage-preview") {
        if (frame && record.history.length === 0) {
          for (let step = 0; step < 2; step += 1) {
            // The fixed pool has 47 entries; native code assumes these two always exist.
            const point = record.pool.pop()!;
            setTrailPoint(point, {
              x: frame.attachment.x, y: frame.attachment.y,
              z: f32(frame.attachment.z - step * garagePreviewSpacing),
            }, garagePreviewForward, frame.scale, record.width);
            point.lifetimeFraction = step;
            record.history.push(point);
          }
        }
        if (frame) for (const point of record.history) point.scale = frame.scale;
        record.lastUpdateMs = tick;
        continue;
      }

      const elapsedMs = record.lastUpdateMs === 0 ? 0 : (tick - record.lastUpdateMs) >>> 0;
      record.lastUpdateMs = tick;
      const lifetime = index < this.projection.normalRecordCount
        ? this.projection.tailLampLifetimeSeconds
        : f32(this.projection.tailLampLifetimeSeconds * shortTrailLifetimeFactor);
      if (record.history.length < trailCapacity && frame) {
        const point = record.pool.pop();
        if (!point) throw new Error("KartTrailRuntime history pool exhausted.");
        setTrailPoint(point, frame.attachment, frame.orientationColumn1, frame.scale, record.width);
        record.history.push(point);
      }
      const elapsedSeconds = f32(f32(elapsedMs) * f32(0.001));
      let keep = 0;
      for (const point of record.history) {
        const age = f32(point.ageSeconds + elapsedSeconds);
        if (age >= lifetime) {
          record.pool.push(point);
          continue;
        }
        point.ageSeconds = age;
        point.lifetimeFraction = f32(Math.min(1, age / lifetime));
        record.history[keep++] = point;
      }
      record.history.length = keep;
    }
  }

  historyAt(index: number): TrailPoint[] {
    const record = this.records[index];
    return record?.active ? record.history : emptyHistory;
  }
  histories(): TrailPoint[][] {
    return this.records.map(record => record.active ? record.history : emptyHistory);
  }
}

export interface TrailGeometryRecord {
  width: number;
  geometry: { setDrawRange(start: number, count: number): void; dispose(): void };
  position: { array: Float32Array; clearUpdateRanges(): void; addUpdateRange(start: number, count: number): void; needsUpdate: boolean };
  uv: { array: Float32Array; clearUpdateRanges(): void; addUpdateRange(start: number, count: number): void; needsUpdate: boolean };
}

/** Face each ribbon pair toward the camera and write the active strip into dynamic buffers. */
export function writeTrailGeometry(record: TrailGeometryRecord, history: TrailPoint[],
  camera: TrailVector, presentation: TrailPresentation): number {
  const positions = record.position.array;
  const uvs = record.uv.array;
  let vertices = 0;
  for (let index = 0; index < history.length; index += 1) {
    const point = history[index]!;
    let directionX = point.direction.x;
    let directionY = point.direction.y;
    let directionZ = point.direction.z;
    if (presentation === "driving") {
      const before = history[index - 1] ?? point;
      const after = history[index + 1] ?? point;
      const deltaX = f32(after.center.x - before.center.x);
      const deltaY = f32(after.center.y - before.center.y);
      const deltaZ = f32(after.center.z - before.center.z);
      if (deltaX !== 0 || deltaY !== 0 || deltaZ !== 0) {
        directionX = deltaX;
        directionY = deltaY;
        directionZ = deltaZ;
      }
    }
    const viewX = f32(camera.x - point.center.x);
    const viewY = f32(camera.y - point.center.y);
    const viewZ = f32(camera.z - point.center.z);
    const crossX = f32(viewY * directionZ - viewZ * directionY);
    const crossY = f32(viewZ * directionX - viewX * directionZ);
    const crossZ = f32(viewX * directionY - viewY * directionX);
    const crossLength = Math.hypot(crossX, crossY, crossZ);
    const unitX = crossLength > 0 ? f32(crossX / crossLength) : 0;
    const unitY = crossLength > 0 ? f32(crossY / crossLength) : 0;
    const unitZ = crossLength > 0 ? f32(crossZ / crossLength) : 0;
    const halfWidth = f32(f32(f32(record.width) * f32(point.scale)) * 0.5);
    const offsetX = f32(unitX * halfWidth);
    const offsetY = f32(unitY * halfWidth);
    const offsetZ = f32(unitZ * halfWidth);
    const v = f32(Math.min(1, Math.max(0, point.lifetimeFraction)));
    const left = vertices;
    const right = vertices + 1;
    positions[left * 3] = f32(point.center.x - offsetX);
    positions[left * 3 + 1] = f32(point.center.y - offsetY);
    positions[left * 3 + 2] = f32(point.center.z - offsetZ);
    positions[right * 3] = f32(point.center.x + offsetX);
    positions[right * 3 + 1] = f32(point.center.y + offsetY);
    positions[right * 3 + 2] = f32(point.center.z + offsetZ);
    uvs[left * 2] = 0;
    uvs[left * 2 + 1] = v;
    uvs[right * 2] = 1;
    uvs[right * 2 + 1] = v;
    vertices += 2;
  }
  const triangleIndices = Math.max(0, vertices - 2) * 3;
  if (vertices === 0) {
    record.geometry.setDrawRange(0, 0);
  } else {
    record.position.clearUpdateRanges();
    record.position.addUpdateRange(0, vertices * 3);
    record.position.needsUpdate = true;
    record.uv.clearUpdateRanges();
    record.uv.addUpdateRange(0, vertices * 2);
    record.uv.needsUpdate = true;
    record.geometry.setDrawRange(0, triangleIndices);
  }
  return vertices;
}

/** The source contains four decimal tokens: a leading mode token, then RGB. */
export function parseTailLampColor(source?: string): { r: number; g: number; b: number } {
  const channels = source?.trim().split(/\s+/).map(Number);
  if (!channels || channels.length !== 4 || channels.some(value =>
    !Number.isInteger(value) || value < 0 || value > 255)) {
    return { r: 255, g: 0, b: 0 };
  }
  return { r: channels[1]!, g: channels[2]!, b: channels[3]! };
}

type Constructor = new (...args: any[]) => any;
export interface TailLampRendererOps {
  Object3D: Constructor;
  Vector3: Constructor;
  DataTexture: Constructor;
  ShaderMaterial: Constructor;
  BufferGeometry: Constructor;
  BufferAttribute: Constructor;
  Mesh: Constructor;
  decodePng(bytes: unknown): Promise<{ pixels: unknown; width: number; height: number }>;
  configureMesh(mesh: any): void;
  rgbaFormat: unknown;
  unsignedByteType: unknown;
  srgbColorSpace: unknown;
  clampToEdgeWrapping: unknown;
  linearFilter: unknown;
  dynamicDrawUsage: unknown;
  lessEqualDepth: unknown;
  doubleSide: unknown;
  customBlending: unknown;
  sourceAlpha: unknown;
  oneBlend: unknown;
  additiveEquation: unknown;
}

export function createTailLampMaterial(texture: any, ops: TailLampRendererOps): any {
  const material = new ops.ShaderMaterial({
    name: "KartRider ReTailLampEffect native additive",
    uniforms: { map: { value: texture } },
    vertexShader: `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      attribute vec4 color;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vUv = uv;
        vColor = color;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vec4 outputColor = texture2D(map, vUv) * vColor;
        gl_FragColor = outputColor;
      }
    `,
    vertexColors: true, transparent: true, depthTest: true, depthWrite: false,
    depthFunc: ops.lessEqualDepth, side: ops.doubleSide, blending: ops.customBlending,
    blendSrc: ops.sourceAlpha, blendDst: ops.oneBlend,
    blendEquation: ops.additiveEquation, toneMapped: false,
  });
  material.forceSinglePass = true;
  return material;
}

interface LoadedAttachment {
  source: { children: { value?: { className?: string } }[] };
  object: any;
}
interface TailLampRenderable extends TrailGeometryRecord {
  projection: TrailProjectionRecord;
  attachment: LoadedAttachment;
  mesh: any;
}

/** Inject the renderer constructors while keeping the effect's entire lifecycle in readable code. */
export function createTailLampEffectClass(ops: TailLampRendererOps) {
  return class TailLampEffect {
    object = new ops.Object3D();
    attachmentPosition = new ops.Vector3();
    cameraPosition: TrailVector = vector();
    runtime: TailLampTrailRuntime;
    frames: TrailFrame[];

    constructor(public projection: TrailProjection, public kartObject: any,
      public bySource: Map<unknown, any>, public records: TailLampRenderable[],
      public material: any, public texture: any, public presentation: TrailPresentation) {
      this.object.name = "KartRider ReTailLampEffect";
      this.runtime = new TailLampTrailRuntime(projection, presentation);
      this.frames = records.map(() => ({ attachment: vector(), orientationColumn1: vector(), scale: 1 }));
      records.forEach(({ mesh }) => this.object.add(mesh));
    }

    static async load(archive: { exactCanonicalCandidates(path: string): { bytes(): Promise<unknown> }[] },
      definition: TailLampDefinition,
      scene: { nodes: Map<unknown, LoadedAttachment>; object: any; bySource: Map<unknown, any> },
      presentation: TrailPresentation = "driving") {
      const originalProjection = projectTailLampDefinition(definition,
        presentation === "shadow-driving" ? "shadow" : "live");
      const available = originalProjection.records.flatMap(record => {
        const attachment = scene.nodes.get(definition.attachments[record.attachmentSlot]);
        return attachment ? [{ record, attachment }] : [];
      });
      const projection: TrailProjection = {
        ...originalProjection,
        records: available.map(({ record }) => record),
        normalRecordCount: available.filter(({ record }) => record.source === "tail-lamp").length,
      };

      const path = "effect/tailLamp/tailLamp0.png";
      const candidates = archive.exactCanonicalCandidates(path);
      if (candidates.length !== 1) {
        throw new Error(`${path} source 数量应为 1，实际为 ${candidates.length}。`);
      }
      const png = await ops.decodePng(await candidates[0]!.bytes());
      const texture = new ops.DataTexture(png.pixels, png.width, png.height,
        ops.rgbaFormat, ops.unsignedByteType);
      texture.colorSpace = ops.srgbColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = ops.clampToEdgeWrapping;
      texture.magFilter = texture.minFilter = ops.linearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
      const material = createTailLampMaterial(texture, ops);
      const records: TailLampRenderable[] = available.map(({ record, attachment }) => {
        const geometry = new ops.BufferGeometry();
        const vertexCapacity = 192;
        const position = new ops.BufferAttribute(new Float32Array(vertexCapacity * 3), 3);
        const uv = new ops.BufferAttribute(new Float32Array(vertexCapacity * 2), 2);
        const color = new ops.BufferAttribute(new Float32Array(vertexCapacity * 4), 4);
        const indices = new ops.BufferAttribute(new Uint16Array(Math.max(0, vertexCapacity - 2) * 3), 1);
        position.setUsage(ops.dynamicDrawUsage);
        uv.setUsage(ops.dynamicDrawUsage);
        geometry.setAttribute("position", position);
        geometry.setAttribute("uv", uv);
        geometry.setAttribute("color", color);
        geometry.setIndex(indices);
        geometry.setDrawRange(0, 0);
        const mesh = new ops.Mesh(geometry, material);
        ops.configureMesh(mesh);
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        const rgb = parseTailLampColor(record.source === "tail-lamp"
          ? projection.tailLampColorSource : projection.shortTrailColorSource);
        for (let vertex = 0; vertex < vertexCapacity; vertex += 1) {
          color.setXYZW(vertex, rgb.r / 255, rgb.g / 255, rgb.b / 255, 1);
        }
        for (let vertex = 0; vertex + 2 < vertexCapacity; vertex += 1) {
          const offset = vertex * 3;
          indices.array[offset] = vertex % 2 === 0 ? vertex : vertex + 1;
          indices.array[offset + 1] = vertex % 2 === 0 ? vertex + 1 : vertex;
          indices.array[offset + 2] = vertex + 2;
        }
        const width = record.source === "tail-lamp" ? projection.tailLampSize : projection.shortTrailSize;
        return { projection: record, attachment, geometry, mesh, position, uv, width };
      });
      return new TailLampEffect(projection, scene.object, scene.bySource, records,
        material, texture, presentation);
    }

    setState(state: number, nowMs: number): void { this.runtime.setState(state, nowMs); }
    restartGaragePreview(): void { this.runtime.restartGaragePreview(); }

    update(nowMs: number, camera: { position: TrailVector }, matrixAlreadyUpdated = false): void {
      if (this.records.length === 0) return;
      if (!matrixAlreadyUpdated) this.kartObject.updateMatrixWorld(true);
      const matrix = this.kartObject.matrixWorld.elements;
      const scale = this.frames.length > 0 ? Math.hypot(matrix[4], matrix[5], matrix[6]) : 1;
      for (let index = 0; index < this.records.length; index += 1) {
        const renderable = this.records[index]!;
        const attachment = renderable.attachment;
        let object = attachment.object;
        if (renderable.projection.source === "tail-lamp") {
          const rigid = attachment.source.children[0]?.value;
          if (rigid?.className === "ReToonRigid") object = this.bySource.get(rigid) ?? object;
        }
        const frame = this.frames[index]!;
        if (matrixAlreadyUpdated) {
          const elements = object.matrixWorld.elements;
          frame.attachment.x = elements[12];
          frame.attachment.y = elements[13];
          frame.attachment.z = elements[14];
        } else {
          object.getWorldPosition(this.attachmentPosition);
          frame.attachment.x = this.attachmentPosition.x;
          frame.attachment.y = this.attachmentPosition.y;
          frame.attachment.z = this.attachmentPosition.z;
        }
        frame.orientationColumn1.x = matrix[4];
        frame.orientationColumn1.y = matrix[5];
        frame.orientationColumn1.z = matrix[6];
        frame.scale = scale;
      }
      this.runtime.update(nowMs, this.frames);
      this.cameraPosition.x = camera.position.x;
      this.cameraPosition.y = camera.position.y;
      this.cameraPosition.z = camera.position.z;
      this.records.forEach((record, index) => {
        const count = writeTrailGeometry(record, this.runtime.historyAt(index),
          this.cameraPosition, this.presentation);
        record.mesh.visible = count >= 3;
      });
    }

    dispose(): void {
      this.object.removeFromParent();
      this.records.forEach(({ geometry }) => geometry.dispose());
      this.material.dispose();
      this.texture.dispose();
    }
  };
}
