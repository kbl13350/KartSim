/** Legacy MQ tachometer renderer: cached HUD textures and pooled screen quads. */

type Constructor = new (...args: any[]) => any;
export interface MqTachometerOps {
  Scene: Constructor;
  Camera: Constructor;
  Geometry: Constructor;
  BufferAttribute: Constructor;
  Mesh: Constructor;
  BoundingSphere: Constructor;
  Vector3: Constructor;
  Vector2: Constructor;
  DataTexture: Constructor;
  ShaderMaterial: Constructor;
  drawCommands(definition: any, speed: number, width: number, height: number,
    preserve: unknown): MqDrawCommand[];
  systemUiSmoothing(): boolean;
  resamplePixels(pixels: Uint8ClampedArray, width: number, height: number): unknown;
  finishResampledPixels(value: unknown): unknown;
  depth: number;
  rgbaFormat: unknown;
  unsignedByteType: unknown;
  srgbColorSpace: unknown;
  clampWrapping: unknown;
  linearFilter: unknown;
  nearestFilter: unknown;
  lessEqualDepth: unknown;
  customBlending: unknown;
  additiveEquation: unknown;
  sourceAlpha: unknown;
  oneMinusSourceAlpha: unknown;
}

interface MqRect {
  left: number; top: number; right: number; bottom: number;
}
interface MqQuad extends MqRect {
  u0: number; v0: number; u1: number; v1: number;
}
interface MqTextureSource { pixels: ArrayLike<number>; width: number; height: number }
export type MqDrawCommand =
  | { kind: "panel"; framebufferRect: MqRect; uv: MqRect; texture: MqTextureSource }
  | { kind: "char-panel"; framebufferQuads: MqQuad[]; texture: MqTextureSource };

interface MqPoolEntry {
  mesh: any;
  geometry: any;
  positions: any;
  uvs: any;
  indices: any;
}

const quadCapacity = 4096;
const f32 = Math.fround;

/** The release compares this quantized gauge count alongside speed and viewport size. */
export function mqGaugeCount(speed: number): number {
  return Math.trunc(f32(f32(speed) * f32(19 / 350))) >>> 0;
}

const vertexShader = `
      precision highp float;
      attribute vec3 position;
      attribute vec2 uv;
      uniform vec2 viewport;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.x * 2.0 / viewport.x - 1.0, 1.0 - position.y * 2.0 / viewport.y, position.z * 2.0 - 1.0, 1.0);
      }
    `;
const fragmentShader = `
      precision highp float;
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(map, vUv);
        #ifdef HUD_ALPHA_WEIGHTED
        gl_FragColor.rgb = gl_FragColor.a > 0.0 ? gl_FragColor.rgb / gl_FragColor.a : vec3(0.0);
        #endif
      }
    `;

export function createMqMaterial(texture: any, width: number, height: number,
  ops: MqTachometerOps): any {
  return new ops.ShaderMaterial({
    name: "KartRider MqTacho",
    defines: texture.magFilter === ops.linearFilter ? { HUD_ALPHA_WEIGHTED: 1 } : {},
    uniforms: { map: { value: texture }, viewport: { value: new ops.Vector2(width, height) } },
    vertexShader, fragmentShader,
    transparent: true, depthTest: true, depthWrite: true,
    depthFunc: ops.lessEqualDepth, blending: ops.customBlending,
    blendSrc: ops.sourceAlpha, blendDst: ops.oneMinusSourceAlpha,
    blendEquation: ops.additiveEquation, toneMapped: false,
  });
}

/** One scene retains geometry slots and texture/material caches across updates. */
export function createMqTachometerClass(ops: MqTachometerOps) {
  return class MqTachometerRenderer {
    scene = new ops.Scene();
    camera = new ops.Camera();
    textures = new Map<MqTextureSource, any>();
    smoothTextures = false;
    materials = new Map<MqTextureSource, any>();
    pool: MqPoolEntry[] = [];
    speed = -1;
    gaugeCount = -1;
    width = -1;
    height = -1;
    preserve: unknown;

    constructor(public definition: { type: string }) {
      if (definition.type !== "MqTacho")
        throw new Error(`${definition.type} 的 P3528 Tachometer Web backend 尚未闭合。`);
    }

    enableUiSmoothing(): void { this.smoothTextures = true; }

    update(speed: number, width: number, height: number, preserve: unknown): void {
      const integerSpeed = Math.trunc(speed);
      const gaugeCount = mqGaugeCount(speed);
      if (integerSpeed === this.speed && gaugeCount === this.gaugeCount &&
        width === this.width && height === this.height && preserve === this.preserve) return;
      this.speed = integerSpeed;
      this.gaugeCount = gaugeCount;
      this.width = width;
      this.height = height;
      this.preserve = preserve;
      const commands = ops.drawCommands(this.definition, speed, width, height, preserve);
      for (let index = 0; index < commands.length; index += 1) {
        const command = commands[index]!;
        const entry = this.poolEntry(index);
        this.fillGeometry(entry, command);
        entry.mesh.material = this.material(command.texture, width, height);
        entry.mesh.renderOrder = index;
        entry.mesh.visible = true;
      }
      for (let index = commands.length; index < this.pool.length; index += 1)
        this.pool[index]!.mesh.visible = false;
    }

    render(renderer: { autoClear: boolean; render(scene: any, camera: any): void }): void {
      const previousAutoClear = renderer.autoClear;
      renderer.autoClear = false;
      try { renderer.render(this.scene, this.camera); }
      finally { renderer.autoClear = previousAutoClear; }
    }

    dispose(): void {
      for (const entry of this.pool) {
        entry.geometry.dispose();
        entry.mesh.removeFromParent();
      }
      this.pool.length = 0;
      this.materials.forEach(material => material.dispose());
      this.textures.forEach(texture => texture.dispose());
    }

    poolEntry(index: number): MqPoolEntry {
      let entry = this.pool[index];
      if (entry) return entry;
      const geometry = new ops.Geometry();
      const positions = new ops.BufferAttribute(new Float32Array(quadCapacity * 4 * 3), 3);
      const uvs = new ops.BufferAttribute(new Float32Array(quadCapacity * 4 * 2), 2);
      const indices = new ops.BufferAttribute(new Uint16Array(quadCapacity * 6), 1);
      geometry.setAttribute("position", positions);
      geometry.setAttribute("uv", uvs);
      geometry.setIndex(indices);
      geometry.boundingSphere = new ops.BoundingSphere(new ops.Vector3(), Infinity);
      const mesh = new ops.Mesh(geometry);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      entry = { mesh, geometry, positions, uvs, indices };
      this.pool.push(entry);
      return entry;
    }

    fillGeometry(entry: MqPoolEntry, command: MqDrawCommand): void {
      const positions = entry.positions.array;
      const uvs = entry.uvs.array;
      const indices = entry.indices.array;
      const count = command.kind === "panel" ? 1 : command.framebufferQuads.length;
      for (let quadIndex = 0; quadIndex < count; quadIndex += 1) {
        const quad: MqQuad = command.kind === "panel"
          ? {
              left: command.framebufferRect.left, top: command.framebufferRect.top,
              right: command.framebufferRect.right, bottom: command.framebufferRect.bottom,
              u0: command.uv.left, v0: command.uv.top,
              u1: command.uv.right, v1: command.uv.bottom,
            }
          : command.framebufferQuads[quadIndex]!;
        const firstVertex = quadIndex * 4;
        let positionOffset = firstVertex * 3;
        positions[positionOffset] = quad.left;
        positions[positionOffset + 1] = quad.top;
        positions[positionOffset + 2] = ops.depth;
        positionOffset += 3;
        positions[positionOffset] = quad.left;
        positions[positionOffset + 1] = quad.bottom;
        positions[positionOffset + 2] = ops.depth;
        positionOffset += 3;
        positions[positionOffset] = quad.right;
        positions[positionOffset + 1] = quad.top;
        positions[positionOffset + 2] = ops.depth;
        positionOffset += 3;
        positions[positionOffset] = quad.right;
        positions[positionOffset + 1] = quad.bottom;
        positions[positionOffset + 2] = ops.depth;
        let uvOffset = firstVertex * 2;
        uvs[uvOffset] = quad.u0;
        uvs[uvOffset + 1] = quad.v0;
        uvOffset += 2;
        uvs[uvOffset] = quad.u0;
        uvs[uvOffset + 1] = quad.v1;
        uvOffset += 2;
        uvs[uvOffset] = quad.u1;
        uvs[uvOffset + 1] = quad.v0;
        uvOffset += 2;
        uvs[uvOffset] = quad.u1;
        uvs[uvOffset + 1] = quad.v1;
        const indexOffset = quadIndex * 6;
        indices[indexOffset] = firstVertex;
        indices[indexOffset + 1] = firstVertex + 1;
        indices[indexOffset + 2] = firstVertex + 2;
        indices[indexOffset + 3] = firstVertex + 2;
        indices[indexOffset + 4] = firstVertex + 1;
        indices[indexOffset + 5] = firstVertex + 3;
      }
      entry.geometry.setDrawRange(0, count * 6);
      entry.positions.needsUpdate = true;
      entry.uvs.needsUpdate = true;
      entry.indices.needsUpdate = true;
    }

    material(source: MqTextureSource, width: number, height: number): any {
      let material = this.materials.get(source);
      if (material) {
        material.uniforms.viewport.value.set(width, height);
        return material;
      }
      const smoothing = this.smoothTextures || ops.systemUiSmoothing();
      const pixels = smoothing
        ? ops.finishResampledPixels(ops.resamplePixels(
            new Uint8ClampedArray(source.pixels), source.width, source.height))
        : source.pixels;
      const texture = new ops.DataTexture(pixels, source.width, source.height,
        ops.rgbaFormat, ops.unsignedByteType);
      texture.colorSpace = ops.srgbColorSpace;
      texture.flipY = false;
      texture.wrapS = texture.wrapT = ops.clampWrapping;
      texture.magFilter = texture.minFilter = smoothing ? ops.linearFilter : ops.nearestFilter;
      texture.generateMipmaps = false;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;
      this.textures.set(source, texture);
      material = createMqMaterial(texture, width, height, ops);
      this.materials.set(source, material);
      return material;
    }
  };
}
