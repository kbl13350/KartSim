import {
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  MathUtils,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from "three";

const maximumSnowflakes = 200;
const texturePath = "theme_/ice/texture/snow.png";
const textureHash = "1688e1d0cc36f0b19ca1f4e49771c006cc318704e7f2897ca362cbd543d48d23";
const float32 = Math.fround;

interface Snowflake {
  active: boolean;
  position: Vector3;
  size: number;
  speed: number;
  lifeMs: number;
  u0: number;
  u1: number;
}

export interface SnowRandom { next(): number }
export interface SnowResource { sourceName: string; bytes(): Promise<Uint8Array> }
export interface SnowLibrary { exactCanonicalCandidates(path: string): SnowResource[] }
export interface SnowImage { pixels: Uint8Array; width: number; height: number }
export interface ProjectedSnowflake { particle: Snowflake; projected: Vector3; alpha: number }

/** Decodes the one vetted snow texture and creates its screen particle renderer. */
export async function loadSnowScreenEffect<T extends SnowScreenEffect>(
  library: SnowLibrary,
  random: SnowRandom,
  decodeImage: (bytes: Uint8Array) => Promise<SnowImage>,
  makeEffect: (random: SnowRandom, texture: DataTexture) => T,
): Promise<T> {
  const candidates = library.exactCanonicalCandidates(texturePath);
  if (candidates.length !== 1)
    throw new Error(`${texturePath} exact source 数量应为1，实际为 ${candidates.length}。`);
  const source = candidates[0]!;
  if (source.sourceName.toLowerCase() !== "theme_ice.rho")
    throw new Error(`${texturePath} 必须来自 theme_ice.rho。`);
  const bytes = await source.bytes();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer));
  const hash = [...digest].map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (hash !== textureHash) throw new Error(`snow.png SHA-256 不匹配：${hash}。`);
  const image = await decodeImage(bytes);
  if (image.width !== 32 || image.height !== 128)
    throw new Error(`snow.png dimensions 应为32x128，实际为 ${image.width}x${image.height}。`);
  const texture = new DataTexture(image.pixels, image.width, image.height, RGBAFormat);
  texture.name = texturePath;
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return makeEffect(random, texture);
}

/** Falling snow projected to screen quads; all positions retain release float32 rounding. */
export class SnowScreenEffect {
  random: SnowRandom;
  texture: DataTexture;
  object: Mesh<BufferGeometry, ShaderMaterial>;
  particles: Snowflake[] = Array.from({ length: maximumSnowflakes }, () => ({
    active: false, position: new Vector3(), size: 0, speed: 0,
    lifeMs: 0, u0: 0, u1: 0,
  }));
  positions = new Float32Array(maximumSnowflakes * 4 * 3);
  colors = new Float32Array(maximumSnowflakes * 4 * 4);
  uvs = new Float32Array(maximumSnowflakes * 4 * 2);
  enabled = false;
  previousMs = 0;
  spawnAccumulatorMs = 0;
  fadeRemainingMs = 0;
  queuedSpawns = 0;

  constructor(random: SnowRandom, texture: DataTexture, setRenderKey: (object: Mesh, key: number) => void) {
    this.random = random;
    this.texture = texture;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(this.colors, 4));
    geometry.setAttribute("uv", new BufferAttribute(this.uvs, 2));
    const indices = new Uint16Array(maximumSnowflakes * 6);
    for (let index = 0; index < maximumSnowflakes; index++) {
      const vertex = index * 4;
      indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], index * 6);
    }
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      name: "KartRider ReSnow screen quad",
      uniforms: { map: { value: texture } },
      vertexColors: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: NormalBlending,
      vertexShader: `
        attribute vec4 color;
        varying vec4 vColor;
        varying vec2 vUv;
        void main() {
          vColor = color;
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D map;
        varying vec4 vColor;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(map, vUv) * vColor; }
      `,
    });
    material.toneMapped = false;
    this.object = new Mesh(geometry, material);
    setRenderKey(this.object, -1000);
    this.object.name = "__snowEffect__";
    this.object.frustumCulled = false;
    this.reset();
  }

  reset(): void {
    for (const particle of this.particles) particle.active = false;
    this.object.geometry.setDrawRange(0, 0);
    this.enabled = false;
    this.previousMs = 0;
    this.spawnAccumulatorMs = 0;
    this.fadeRemainingMs = 0;
    this.queuedSpawns = 0;
    this.enabled = true;
  }

  setEnabled(enabled: boolean): void {
    if (enabled) {
      if (!this.enabled) this.fadeRemainingMs = 1500;
    } else this.fadeRemainingMs = 0;
    this.enabled = enabled;
  }

  update(nowMs: number, camera: PerspectiveCamera, width: number, height: number): void {
    const timestamp = Math.trunc(nowMs) >>> 0;
    if (timestamp === this.previousMs) return;
    const elapsed = Math.min(1000, (timestamp - this.previousMs) >>> 0);
    this.previousMs = timestamp;
    let fade = float32(1);
    if (this.fadeRemainingMs > 0) {
      if (this.fadeRemainingMs > elapsed) {
        this.fadeRemainingMs -= elapsed;
        fade = float32(float32(1500 - this.fadeRemainingMs) * float32(1 / 1500));
      } else this.fadeRemainingMs = 0;
    }
    this.spawnAccumulatorMs += elapsed;
    let spawnCount = this.queuedSpawns;
    if (this.spawnAccumulatorMs > 500) {
      spawnCount += this.spawnAccumulatorMs >>> 7;
      this.spawnAccumulatorMs = 0;
    }
    this.queuedSpawns = 0;
    if (this.enabled) this.spawn(spawnCount, camera);
    const wind = float32(float32((this.random.next() % 50) - 25) * float32(elapsed) * float32(0.001));
    const visible: ProjectedSnowflake[] = [];
    for (const particle of this.particles) {
      if (!particle.active) continue;
      if (particle.lifeMs <= elapsed) {
        particle.active = false;
        this.queuedSpawns++;
        continue;
      }
      particle.lifeMs -= elapsed;
      particle.position.y = float32(particle.position.y - float32(particle.speed * elapsed) * float32(0.001));
      const driftZ = float32(wind * (this.random.next() % 20) * float32(0.05));
      const driftX = float32(wind * (this.random.next() % 20) * float32(0.05));
      particle.position.z = float32(particle.position.z - driftZ);
      particle.position.x = float32(particle.position.x + driftX);
      const projected = particle.position.clone().project(camera);
      if (projected.z < -1 || projected.z > 1 || projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1) {
        particle.lifeMs = 0;
        this.queuedSpawns++;
        continue;
      }
      const remaining = particle.lifeMs >= 1000 ? 1 : particle.lifeMs * 0.001;
      visible.push({ particle, projected, alpha: float32(remaining * fade) });
    }
    this.writeQuads(visible, width, height);
  }

  activeParticleCount(): number { return this.particles.filter(particle => particle.active).length; }

  dispose(): void {
    this.object.removeFromParent();
    this.object.geometry.dispose();
    this.object.material.dispose();
    this.texture.dispose();
  }

  spawn(count: number, camera: PerspectiveCamera): void {
    camera.updateMatrixWorld(true);
    const halfHeight = Math.tan(MathUtils.degToRad(camera.fov) * 0.5);
    const halfWidth = halfHeight * camera.aspect;
    for (const particle of this.particles) {
      if (count <= 0) break;
      if (particle.active) continue;
      particle.active = true;
      particle.size = 5 + (this.random.next() % 7);
      const depth = float32(10 + float32(this.random.next() % 100) * float32(0.01) * float32(190));
      const horizontal = float32(float32(this.random.next() % 200) * float32(0.01) - 1);
      const vertical = float32(float32(this.random.next() % 200) * float32(0.01) - 1);
      particle.position.set(horizontal * halfWidth * depth, vertical * halfHeight * depth, -depth).applyMatrix4(camera.matrixWorld);
      particle.position.set(float32(particle.position.x), float32(particle.position.y), float32(particle.position.z));
      particle.speed = 40 + (this.random.next() % 40);
      particle.u1 = float32((this.random.next() % 2) * 0.5);
      particle.u0 = float32(particle.u1 - 0.5);
      particle.lifeMs = 2000 + (this.random.next() % 5000);
      count--;
    }
  }

  writeQuads(visible: readonly ProjectedSnowflake[], width: number, height: number): void {
    let vertex = 0;
    for (const { particle, projected, alpha } of visible) {
      const depth = float32(float32(projected.z + 1) * float32(0.5));
      const size = float32(float32(1.8 - depth) * particle.size);
      const halfWidth = size * 2 / Math.max(1, width);
      const halfHeight = size * 2 / Math.max(1, height);
      const corners = [
        [projected.x - halfWidth, projected.y + halfHeight, particle.u0, 0],
        [projected.x - halfWidth, projected.y - halfHeight, particle.u0, 0.5],
        [projected.x + halfWidth, projected.y - halfHeight, particle.u1, 0.5],
        [projected.x + halfWidth, projected.y + halfHeight, particle.u1, 0],
      ];
      for (const [x, y, u, v] of corners) {
        this.positions.set([x!, y!, projected.z], vertex * 3);
        this.colors.set([1, 1, 1, alpha], vertex * 4);
        this.uvs.set([u!, v!], vertex * 2);
        vertex++;
      }
    }
    this.object.geometry.getAttribute("position").needsUpdate = true;
    this.object.geometry.getAttribute("color").needsUpdate = true;
    this.object.geometry.getAttribute("uv").needsUpdate = true;
    this.object.geometry.setDrawRange(0, visible.length * 6);
  }
}
