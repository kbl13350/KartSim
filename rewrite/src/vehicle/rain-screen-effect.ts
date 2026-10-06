import {
  BufferAttribute, BufferGeometry, MathUtils, Mesh, NormalBlending,
  PerspectiveCamera, ShaderMaterial, Vector3,
} from "three";
import type { SnowRandom } from "./snow-screen-effect";

const maximumRaindrops = 200;
const float32 = Math.fround;

interface Raindrop {
  active: boolean;
  position: Vector3;
  size: number;
  speed: number;
  lifeMs: number;
}

interface ProjectedRaindrop { particle: Raindrop; projected: Vector3; alpha: number }

/** Rain streaks are screen quads driven by world-space positions and camera projection. */
export class RainScreenEffect {
  random: SnowRandom;
  object: Mesh<BufferGeometry, ShaderMaterial>;
  particles: Raindrop[] = Array.from({ length: maximumRaindrops }, () => ({
    active: false, position: new Vector3(), size: 0, speed: 0, lifeMs: 0,
  }));
  positions = new Float32Array(maximumRaindrops * 4 * 3);
  colors = new Float32Array(maximumRaindrops * 4 * 4);
  enabled = false;
  previousMs = 0;
  spawnAccumulatorMs = 0;
  fadeRemainingMs = 0;
  queuedSpawns = 0;

  constructor(random: SnowRandom, rainOnStart: boolean, setRenderKey: (object: Mesh, key: number) => void) {
    this.random = random;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
    geometry.setAttribute("color", new BufferAttribute(this.colors, 4));
    const indices = new Uint16Array(maximumRaindrops * 6);
    for (let index = 0; index < maximumRaindrops; index++) {
      const vertex = index * 4;
      indices.set([vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3], index * 6);
    }
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    const material = new ShaderMaterial({
      name: "KartRider ReRain screen quad",
      vertexColors: true,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: NormalBlending,
      vertexShader: `
        attribute vec4 color;
        varying vec4 vColor;
        void main() {
          vColor = color;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec4 vColor;
        void main() { gl_FragColor = vColor; }
      `,
    });
    material.toneMapped = false;
    this.object = new Mesh(geometry, material);
    setRenderKey(this.object, -1000);
    this.object.name = "__rainEffect__";
    this.object.frustumCulled = false;
    this.reset(rainOnStart);
  }

  reset(rainOnStart: boolean): void {
    for (const particle of this.particles) particle.active = false;
    this.positions.fill(0);
    this.colors.fill(0);
    this.object.geometry.setDrawRange(0, 0);
    this.enabled = false;
    this.previousMs = 0;
    this.spawnAccumulatorMs = 0;
    this.fadeRemainingMs = 0;
    this.queuedSpawns = 0;
    this.setEnabled(rainOnStart);
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
    if (this.spawnAccumulatorMs > 300) {
      spawnCount += this.spawnAccumulatorMs >>> 7;
      this.spawnAccumulatorMs = 0;
    }
    this.queuedSpawns = 0;
    if (this.enabled) this.spawn(spawnCount, camera);
    const wind = float32(float32((this.random.next() % 50) - 25) * float32(elapsed) * float32(0.001));
    const visible: ProjectedRaindrop[] = [];
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
      if (projected.z < -1 || projected.z > 1 || projected.x < -1.2 || projected.x > 1.2 || projected.y < -1 || projected.y > 1.5) {
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
  }

  spawn(count: number, camera: PerspectiveCamera): void {
    camera.updateMatrixWorld(true);
    const halfHeight = Math.tan(MathUtils.degToRad(camera.fov) * 0.5);
    const halfWidth = halfHeight * camera.aspect;
    for (const particle of this.particles) {
      if (count <= 0) break;
      if (particle.active) continue;
      particle.active = true;
      particle.size = 10 + (this.random.next() % 14);
      const depth = float32(10 + float32(this.random.next() % 100) * float32(0.01) * float32(190));
      const horizontal = float32(float32(this.random.next() % 200) * float32(0.01) - float32(1));
      const vertical = float32(float32(this.random.next() % 200) * float32(0.01) - float32(0.5));
      particle.position.set(horizontal * halfWidth * depth, vertical * halfHeight * depth, -depth).applyMatrix4(camera.matrixWorld);
      particle.position.set(float32(particle.position.x), float32(particle.position.y), float32(particle.position.z));
      particle.speed = 300 + (this.random.next() % 300);
      if (vertical < 0.5) this.random.next();
      particle.lifeMs = 2000 + (this.random.next() % 3000);
      count--;
    }
  }

  writeQuads(visible: readonly ProjectedRaindrop[], width: number, height: number): void {
    let vertex = 0;
    for (const { particle, projected, alpha } of visible) {
      const depth = float32(float32(projected.z + 1) * float32(0.5));
      const size = float32(float32(1.8 - depth) * particle.size);
      const halfWidth = size * 2 / Math.max(1, width);
      const halfHeight = size * 2.4 * 2 / Math.max(1, height);
      const corners = [
        [projected.x - halfWidth, projected.y + halfHeight],
        [projected.x - halfWidth, projected.y - halfHeight],
        [projected.x + halfWidth, projected.y - halfHeight],
        [projected.x + halfWidth, projected.y + halfHeight],
      ];
      for (const [x, y] of corners) {
        this.positions.set([x!, y!, projected.z], vertex * 3);
        this.colors.set([1, 1, 1, alpha], vertex * 4);
        vertex++;
      }
    }
    this.object.geometry.getAttribute("position").needsUpdate = true;
    this.object.geometry.getAttribute("color").needsUpdate = true;
    this.object.geometry.setDrawRange(0, visible.length * 6);
  }
}
