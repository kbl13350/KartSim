import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending,
  DoubleSide, DynamicDrawUsage, LessEqualDepth, Mesh,
  OneMinusSrcAlphaFactor, RawShaderMaterial, SrcAlphaFactor, Vector2,
} from "three";

export interface OutlineBatchFrame {
  setBatched(value: boolean): void;
  takeFrame(after: number, through: number): boolean;
  readonly frameSortDepth: number;
  readonly frameWorldX: number;
  readonly frameWorldY: number;
  readonly frameWorldZ: number;
  readonly frameVertexCount: number;
  readonly frameTriangleCount: number;
  readonly frameViewport?: { width: number; height: number };
  readonly capacityVertexCount: number;
  readonly capacityIndexCount: number;
  copyFrameInto(positions: Float32Array, colors: Float32Array,
    indices: Uint32Array, vertexOffset: number,
    indexOffset: number, baseVertex: number): void;
}
export interface ToonOutlineBatchDependencies {
  currentSerial(): number;
  configureObject(object: Mesh, selector: number, visible: boolean): void;
}

function nextCapacity(current: number, required: number): number {
  let capacity = current;
  while (capacity < required) capacity *= 2;
  return capacity;
}

/** Combines visible kart silhouettes into one GPU draw call. */
export class ToonOutlineBatch {
  readonly geometry = new BufferGeometry();
  readonly material: RawShaderMaterial;
  readonly object: Mesh<BufferGeometry, RawShaderMaterial>;
  readonly registered = new Set<OutlineBatchFrame>();
  positions = new Float32Array(65536);
  colors = new Float32Array(65536);
  indices = new Uint32Array(16384);
  positionAttribute: BufferAttribute;
  colorAttribute: BufferAttribute;
  indexAttribute: BufferAttribute;
  lastFlushWatermark = 0;

  constructor(private readonly dependencies: ToonOutlineBatchDependencies) {
    this.material = new RawShaderMaterial({
      name: "KartRider Toon selector0 outline batch",
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
    this.positionAttribute = new BufferAttribute(this.positions, 4).setUsage(DynamicDrawUsage);
    this.colorAttribute = new BufferAttribute(this.colors, 4).setUsage(DynamicDrawUsage);
    this.indexAttribute = new BufferAttribute(this.indices, 1).setUsage(DynamicDrawUsage);
    this.geometry.setAttribute("positionD3D", this.positionAttribute);
    this.geometry.setAttribute("color", this.colorAttribute);
    this.geometry.setIndex(this.indexAttribute);
    this.geometry.setDrawRange(0, 0);
    this.object = new Mesh(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 1;
    dependencies.configureObject(this.object, 0, true);
  }

  register(frame: OutlineBatchFrame): void {
    if (this.registered.has(frame)) return;
    this.registered.add(frame);
    frame.setBatched(true);
    this.fitCapacity();
  }

  unregister(frame: OutlineBatchFrame): void {
    if (this.registered.delete(frame)) frame.setBatched(false);
  }

  flush(): void {
    const serial = this.dependencies.currentSerial();
    if (serial === this.lastFlushWatermark) return;
    const frames: OutlineBatchFrame[] = [];
    for (const frame of this.registered)
      if (frame.takeFrame(this.lastFlushWatermark, serial)) frames.push(frame);
    frames.sort((a, b) => b.frameSortDepth - a.frameSortDepth);
    if (frames.length === 0) {
      this.lastFlushWatermark = serial;
      this.geometry.setDrawRange(0, 0);
      return;
    }
    const backmost = frames[frames.length - 1]!;
    this.object.position.set(backmost.frameWorldX, backmost.frameWorldY,
      backmost.frameWorldZ);
    this.object.updateWorldMatrix(true, false);
    let vertices = 0;
    let indices = 0;
    let viewport: { width: number; height: number } | undefined;
    for (const frame of frames) {
      const count = frame.frameVertexCount;
      const triangles = frame.frameTriangleCount;
      if (count === 0 || triangles === 0) continue;
      if ((vertices + count) * 4 > this.positions.length ||
          indices + triangles > this.indices.length)
        throw new Error("Toon outline batch capacity exceeded。 ");
      frame.copyFrameInto(this.positions, this.colors, this.indices,
        vertices * 4, indices, vertices);
      if (frame.frameViewport) viewport = frame.frameViewport;
      vertices += count;
      indices += triangles;
    }
    this.lastFlushWatermark = serial;
    this.geometry.setDrawRange(0, indices);
    if (viewport) this.material.uniforms.viewportPx!.value.set(
      viewport.width, viewport.height);
    if (indices !== 0) {
      this.publish(this.positionAttribute, vertices * 4);
      this.publish(this.colorAttribute, vertices * 4);
      this.publish(this.indexAttribute, indices);
    }
  }

  dispose(): void {
    this.registered.clear();
    this.geometry.dispose();
    this.material.dispose();
    this.object.removeFromParent();
  }

  publish(attribute: BufferAttribute, count: number): void {
    attribute.clearUpdateRanges();
    attribute.updateRanges.push({ start: 0, count });
    attribute.needsUpdate = true;
  }

  fitCapacity(): void {
    let positionsNeeded = 0;
    let indicesNeeded = 0;
    for (const frame of this.registered) {
      positionsNeeded += frame.capacityVertexCount * 4;
      indicesNeeded += frame.capacityIndexCount;
    }
    if (positionsNeeded > this.positions.length) {
      this.positions = new Float32Array(nextCapacity(this.positions.length, positionsNeeded));
      this.positionAttribute = new BufferAttribute(this.positions, 4).setUsage(DynamicDrawUsage);
      this.geometry.setAttribute("positionD3D", this.positionAttribute);
    }
    if (positionsNeeded > this.colors.length) {
      this.colors = new Float32Array(nextCapacity(this.colors.length, positionsNeeded));
      this.colorAttribute = new BufferAttribute(this.colors, 4).setUsage(DynamicDrawUsage);
      this.geometry.setAttribute("color", this.colorAttribute);
    }
    if (indicesNeeded > this.indices.length) {
      this.indices = new Uint32Array(nextCapacity(this.indices.length, indicesNeeded));
      this.indexAttribute = new BufferAttribute(this.indices, 1).setUsage(DynamicDrawUsage);
      this.geometry.setIndex(this.indexAttribute);
    }
  }
}
