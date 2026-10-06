import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending,
  DoubleSide, DynamicDrawUsage, LessEqualDepth, Mesh,
  OneMinusSrcAlphaFactor, RawShaderMaterial, SrcAlphaFactor, Vector2,
  type Camera, type Matrix4,
} from "three";

import {
  appendOutlineSection, appendOutlineStrip, bridgeOutlineStrip, buildOutlineLinks,
  classifyOutlineFaces, emitClosedOutlineSections, emitOpenOutlineSections,
  emitOutlineConflicts, emitOutlineJoin, emitOutlineVertex, expandOutlineStrip,
  linkOutlineEdge, outlineSectionOutgoingDirection, publishOutlineGeometry,
  requireOutlineVertexCapacity, resetOutlineWorkspace, selectOutlineEdge,
  type OutlineFace, type OutlinePoint, type OutlineProfileEntry,
  type ToonOutlineWorkspace,
} from "./toon-outline-geometry";
import {
  copyToonFrameInto, disposeToonFrame, dropToonFrame, prepareToonBodyIndex,
  rememberToonRigidFrame, setToonBatched, takeToonFrame,
  updateToonBodyGeometry, type ToonFrameHost,
} from "./toon-outline-frame";
import {
  updateToonOutline, type ToonBody, type ToonFrameCache,
  type ToonOutlineUpdateDependencies, type ToonOverride,
} from "./toon-outline-update";

export interface ToonSource {
  positions: Array<ArrayLike<number>>;
  faces: Array<OutlineFace & { winding: number }>;
}
export interface ToonBatch {
  register(outline: ToonOutlineController): void;
  unregister(outline: ToonOutlineController): void;
}
export interface ToonProjectionMath {
  generation(): number;
  prepare(camera: Camera, width: number, height: number): ToonFrameCache;
  transpose(output: Float32Array, matrix: Matrix4): void;
  multiply(output: Float32Array, a: Float32Array, b: Float32Array): void;
  transform(output: Float32Array, matrix: Float32Array, position: ArrayLike<number>): void;
  model: Float32Array;
  combined: Float32Array;
  screen: Float32Array;
  clip: Float32Array;
}
export interface ToonOutlineDependencies {
  defaultProfile(): OutlineProfileEntry[];
  update(): ToonOutlineUpdateDependencies;
  nextSerial(): number;
  enabled(): boolean;
  projection: ToonProjectionMath;
}

export function toonColorFromArgb(argb: number): number[] {
  return [((argb >>> 16) & 255) / 255, ((argb >>> 8) & 255) / 255,
    (argb & 255) / 255, ((argb >>> 24) & 255) / 255];
}

/** Scene owner for a single kart's silhouette and its batched frame output. */
export class ToonOutlineController implements ToonOutlineWorkspace, ToonFrameHost {
  source: ToonSource;
  drawOutline: boolean;
  object: Mesh<BufferGeometry, RawShaderMaterial>;
  geometry = new BufferGeometry();
  material: RawShaderMaterial;
  centerColor: number[];
  outerColor: number[];
  originalCenterColor: number[];
  originalOuterColor: number[];
  frameProfile: OutlineProfileEntry[];
  frameOverride?: ToonOverride;
  projected: OutlinePoint[];
  classificationFaces: ToonOutlineWorkspace["classificationFaces"];
  classes: Uint8Array;
  bodySourceIndices?: Uint32Array;
  bodyIndex?: BufferAttribute;
  links: ToonOutlineWorkspace["links"];
  conflicts: Uint32Array;
  consumed: Uint8Array;
  section: Uint32Array;
  positionUpdateRange = { start: 0, count: 0 };
  colorUpdateRange = { start: 0, count: 0 };
  indexUpdateRange = { start: 0, count: 0 };
  bodyIndexUpdateRange = { start: 0, count: 0 };
  positionAttribute: BufferAttribute & ToonOutlineWorkspace["positionAttribute"];
  colorAttribute: BufferAttribute & ToonOutlineWorkspace["colorAttribute"];
  indexAttribute: BufferAttribute & ToonOutlineWorkspace["indexAttribute"];
  strip: Uint16Array;
  updateSerial = 0;
  frameEmitted = false;
  frameViewportValue?: { width: number; height: number };
  frameSortZ = 0;
  frameWorldX = 0;
  frameWorldY = 0;
  frameWorldZ = 0;
  batchDisposer?: (host: ToonFrameHost) => void;
  batched = false;
  conflictValueCount = 0;
  sectionCount = 0;
  vertexCount = 0;
  stripCount = 0;
  triangleCount = 0;
  cachedProjection?: Float32Array;
  cachedBody?: ToonBody;
  cachedPosition?: BufferAttribute;
  cachedPositionVersion = -1;
  cachedIndexVersion = -1;
  cachedWidth = 0;
  cachedHeight = 0;
  cachedProfile?: OutlineProfileEntry[];
  cachedEnabled = false;
  cachedEmitted = false;
  cachedViewport?: { width: number; height: number };

  constructor(source: ToonSource, centerArgb: number, outerArgb: number,
    drawOutline = true, batch?: ToonBatch, cacheRigidProjection = false,
    private readonly deps: ToonOutlineDependencies = null!) {
    this.source = source;
    this.drawOutline = drawOutline;
    this.cachedProjection = cacheRigidProjection ? new Float32Array(16) : undefined;
    this.material = new RawShaderMaterial({
      name: "KartRider Toon selector0 outline",
      uniforms: { viewportPx: { value: new Vector2(1, 1) } },
      vertexShader: `
        precision highp float;
        attribute vec4 positionD3D;
        attribute vec4 color;
        uniform vec2 viewportPx;
        varying vec4 vColor;
        void main() {
          float clipW = 1.0 / positionD3D.w;
          vec3 ndc = vec3(
            2.0 * positionD3D.x / viewportPx.x - 1.0,
            1.0 - 2.0 * positionD3D.y / viewportPx.y,
            2.0 * positionD3D.z - 1.0
          );
          gl_Position = vec4(ndc * clipW, clipW);
          vColor = color;
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec4 vColor;
        void main() { gl_FragColor = vColor; }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      depthFunc: LessEqualDepth,
      side: DoubleSide,
      blending: CustomBlending,
      blendSrc: SrcAlphaFactor,
      blendDst: OneMinusSrcAlphaFactor,
      blendEquation: AddEquation,
      toneMapped: false,
    });
    this.material.forceSinglePass = true;
    this.centerColor = toonColorFromArgb(centerArgb);
    this.outerColor = toonColorFromArgb(outerArgb);
    this.originalCenterColor = [...this.centerColor];
    this.originalOuterColor = [...this.outerColor];
    this.material.userData.centerColor = this.centerColor;
    this.material.userData.outerColor = this.outerColor;
    this.frameProfile = deps.defaultProfile();
    this.projected = source.positions.map(() =>
      ({ x: 0, y: 0, z: 0, rhw: 0, invalid: true }));
    this.classificationFaces = source.faces.map(face => ({
      a: this.projected[face.positionIndices[0]]!,
      b: this.projected[face.positionIndices[1]]!,
      c: this.projected[face.positionIndices[2]]!,
      doubleSided: face.winding !== 0,
    }));
    this.classes = new Uint8Array(source.faces.length);
    this.links = source.positions.map(() => ({ predecessor: -1, successor: -1 }));
    this.conflicts = new Uint32Array(source.faces.length * 6);
    this.consumed = new Uint8Array(source.positions.length);
    this.section = new Uint32Array(source.positions.length);
    const capacity = Math.min(32767,
      Math.max(1, source.positions.length * 3 + source.faces.length * 12));
    this.strip = new Uint16Array(capacity * 2);
    this.positionAttribute = new BufferAttribute(new Float32Array(capacity * 4), 4)
      .setUsage(DynamicDrawUsage) as typeof this.positionAttribute;
    this.colorAttribute = new BufferAttribute(new Float32Array(capacity * 4), 4)
      .setUsage(DynamicDrawUsage) as typeof this.colorAttribute;
    this.indexAttribute = new BufferAttribute(new Uint16Array(capacity * 6), 1)
      .setUsage(DynamicDrawUsage) as typeof this.indexAttribute;
    this.geometry.setAttribute("positionD3D", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setIndex(this.indexAttribute);
    this.geometry.setDrawRange(0, 0);
    this.object = new Mesh(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 1;
    if (batch) {
      batch.register(this);
      this.batchDisposer = host => batch.unregister(host as ToonOutlineController);
    }
  }

  setBatched(batched: boolean): void { setToonBatched(this, batched); }
  isBatched(): boolean { return this.batched; }
  dropFrame(): void { dropToonFrame(this, this.deps.nextSerial); }
  get frameVertexCount(): number { return this.vertexCount; }
  get frameTriangleCount(): number { return this.triangleCount; }
  get frameViewport() { return this.frameViewportValue; }
  get frameSortDepth(): number { return this.frameSortZ; }
  get capacityVertexCount(): number { return this.positionAttribute.count; }
  get capacityIndexCount(): number { return this.indexAttribute.array.length; }
  takeFrame(after: number, through: number): boolean {
    return takeToonFrame(this, after, through);
  }
  copyFrameInto(positions: Float32Array, colors: Float32Array,
    indices: Uint32Array, vertexOffset: number, indexOffset: number,
    baseVertex: number): void {
    copyToonFrameInto(this, positions, colors, indices, vertexOffset, indexOffset, baseVertex);
  }
  update(body: ToonBody, camera: Camera, width: number, height: number,
    progress?: (phase: string) => void, projectionCache?: ToonFrameCache): void {
    updateToonOutline(this, body, camera, width, height, progress,
      projectionCache, this.deps.update());
  }
  rememberRigidFrame(body: ToonBody, width: number, height: number): void {
    rememberToonRigidFrame(this, body, width, height, this.deps.enabled());
  }
  updateBodyGeometry(geometry: BufferGeometry): void { updateToonBodyGeometry(this, geometry); }
  prepareBodyIndex(geometry: BufferGeometry): BufferAttribute {
    return prepareToonBodyIndex(this, geometry);
  }
  dispose(): void { disposeToonFrame(this); }

  projectVertices(matrixWorld: Matrix4, camera: Camera, width: number, height: number,
    cache?: ToonFrameCache, rigid = false): boolean {
    const math = this.deps.projection;
    if (!cache || cache.generation !== math.generation() ||
        cache.width !== width || cache.height !== height)
      math.prepare(camera, width, height);
    math.transpose(math.model, matrixWorld);
    math.multiply(math.combined, math.screen, math.model);
    if (rigid) {
      let same = true;
      for (let index = 0; index < 16; index++) {
        if (!Object.is(this.cachedProjection![index], math.combined[index])) {
          same = false;
          break;
        }
      }
      if (same) return true;
    }
    this.cachedProjection?.set(math.combined);
    for (let index = 0; index < this.source.positions.length; index++) {
      math.transform(math.clip, math.combined, this.source.positions[index]!);
      const inverseW = Math.fround(1 / math.clip[3]!);
      const depth = Math.fround(math.clip[2]! * inverseW);
      const point = this.projected[index]!;
      point.x = Math.fround(math.clip[0]! * inverseW);
      point.y = Math.fround(math.clip[1]! * inverseW);
      point.z = depth;
      point.rhw = inverseW;
      point.invalid = !(inverseW > 0) || Number.isNaN(depth) || depth < 0 || depth > 1;
    }
    return false;
  }

  classifyFaces(): void { classifyOutlineFaces(this); }
  resetFrameWorkspace(): void { resetOutlineWorkspace(this); }
  buildLinks(): void { buildOutlineLinks(this); }
  edgeSelected(face: number, edge: number, faceClass: number): boolean {
    return selectOutlineEdge(this, face, edge, faceClass);
  }
  linkOrRecordConflict(from: number, to: number): void { linkOutlineEdge(this, from, to); }
  emitOpenSections(): void { emitOpenOutlineSections(this); }
  emitClosedSections(): void { emitClosedOutlineSections(this); }
  appendSection(closed: boolean): void { appendOutlineSection(this, closed); }
  sectionOutgoingDirection(index: number, fallback: number, closed: boolean): number {
    return outlineSectionOutgoingDirection(this, index, fallback, closed);
  }
  emitJoin(vertex: number, incoming: number, outgoing: number, bridge: boolean): void {
    emitOutlineJoin(this, vertex, incoming, outgoing, bridge);
  }
  emitVertex(vertex: number, offset: OutlineProfileEntry | undefined, center: boolean): void {
    emitOutlineVertex(this, vertex, offset, center);
  }
  emitConflicts(): void { emitOutlineConflicts(this); }
  requireVertexCapacity(additional: number): void { requireOutlineVertexCapacity(this, additional); }
  bridge(first: number): void { bridgeOutlineStrip(this, first); }
  appendStrip(vertex: number): void { appendOutlineStrip(this, vertex); }
  expandStrip(): void { expandOutlineStrip(this); }
  publishGeometry(): void { publishOutlineGeometry(this); }
}
