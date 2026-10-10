/** ReSkidMark, ReDriftEffect and ReDrift2Effect as one readable owner. */

export interface DriftVector { x: number; y: number; z: number }
export interface DriftSource { x: number; y: number; z: number }
export interface DriftMarkSetup { sources: DriftSource[]; width: number }
export interface DriftRandom { next(): number }
export interface DriftFrame {
  active: boolean;
  contact: boolean;
  speedKmh: number;
  forwardSpeed: number;
  roadSurface: string;
  motionMode: number;
  position: DriftVector;
  right: DriftVector;
  forward: DriftVector;
  presentationRight: DriftVector;
  presentationForward: DriftVector;
  presentationUp: DriftVector;
  rearWheelCompression: number[];
  wheelCompressionBaseline: number;
  obstacleWheelHit: boolean;
  fullPhysicsBypass: boolean;
}
export interface DriftRaycast {
  rayQuery(origin: DriftVector, displacement: DriftVector, includeSomething: false):
    { point: DriftVector } | undefined;
}
export interface DriftTextureArchive {
  exactCanonicalCandidates(path: string): { bytes(): Promise<unknown>; canonicalPath?: string; virtualPath: string }[];
}

type Constructor = new (...args: any[]) => any;
export interface DriftEffectOps {
  Object3D: Constructor;
  DataTexture: Constructor;
  MeshBasicMaterial: Constructor;
  BufferGeometry: Constructor;
  BufferAttribute: Constructor;
  Mesh: Constructor;
  decodePng(bytes: unknown): Promise<{ pixels: unknown; width: number; height: number }>;
  configureSkidMesh(mesh: any, order: 2000, transparent: true): void;
  configureDriftMesh(mesh: any): void;
  textureFormat: unknown;
  textureType: unknown;
  colorSpace: unknown;
  wrapping: unknown;
  nearestFilter: unknown;
  dynamicUsage: unknown;
  doubleSide: unknown;
  customBlending: unknown;
  additiveEquation: unknown;
  sourceAlpha: unknown;
  oneMinusSourceAlpha: unknown;
  oneBlend: unknown;
}

const f32 = Math.fround;
const skidTextureFamilies = ["stuff2_", "stuff"];
const skidTextureExtensions = ["png", "tga", "kng"];
const effectPaths = {
  skid: "effect/drift/drift.png",
  drift: "effect/drift/drift2.png",
  drift2: "effect/drift/drift007.png",
  alternateDrift: "effect/drift/drift3.png",
  alternateDrift2: "effect/drift/drift005.png",
};
const skidGroundLift = f32(0.02);
const skidCommitMs = 30;
const skidStopDelayMs = 100;
const rearWheelCompressionMinimum = f32(-0.20000000298023224);
const rearWheelCompressionMaximum = f32(0.5);
const maxSkidPairs = 47;
const maxSkidHistories = 96;
const skidVertexCapacity = maxSkidHistories * (maxSkidPairs - 1) * 6;
const driftSpeedMinimum = f32(50);
const particleLifetimeFrames = 20;
const particlesPerChannel = 10;
const driftVertexCapacity = particlesPerChannel * 2 * 6;
const drift2RearOffset = f32(0.12);
const drift2ForwardOffset = f32(1);
const drift2Height = f32(0.05);

function vector(): DriftVector { return { x: 0, y: 0, z: 0 }; }
function copyFloatVector(value: DriftVector): DriftVector {
  return { x: f32(value.x), y: f32(value.y), z: f32(value.z) };
}
function add(a: DriftVector, b: DriftVector): DriftVector {
  return { x: f32(a.x + b.x), y: f32(a.y + b.y), z: f32(a.z + b.z) };
}
function multiply(value: DriftVector, scalar: number): DriftVector {
  return { x: f32(value.x * scalar), y: f32(value.y * scalar), z: f32(value.z * scalar) };
}
function dot(a: DriftVector, b: DriftVector): number {
  return f32(f32(f32(a.x * b.x) + f32(a.z * b.z)) + f32(a.y * b.y));
}
function distance(a: DriftVector, b: DriftVector): number {
  return f32(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z));
}
function writeScaled(out: DriftVector, origin: DriftVector, direction: DriftVector, scale: number): void {
  out.x = f32(origin.x + f32(direction.x * scale));
  out.y = f32(origin.y + f32(direction.y * scale));
  out.z = f32(origin.z + f32(direction.z * scale));
}
function writeDoubleOffset(out: DriftVector, origin: DriftVector,
  first: DriftVector, firstScale: number, second: DriftVector, secondScale: number): void {
  out.x = f32(origin.x + f32(f32(first.x * firstScale) + f32(second.x * secondScale)));
  out.y = f32(origin.y + f32(f32(first.y * firstScale) + f32(second.y * secondScale)));
  out.z = f32(origin.z + f32(f32(first.z * firstScale) + f32(second.z * secondScale)));
}

/** Exact unique skid texture selection across the two archive families and three formats. */
export function selectSkidTexture(archive: DriftTextureArchive, textureName?: string) {
  const name = textureName ?? "default";
  const matches: ReturnType<DriftTextureArchive["exactCanonicalCandidates"]> = [];
  for (const family of skidTextureFamilies) {
    for (const extension of skidTextureExtensions) {
      const path = `${family}/skidMark/texture/${name}.${extension}`;
      const candidates = archive.exactCanonicalCandidates(path);
      if (candidates.length > 1)
        throw new Error(`P3528 印迹纹理 ${path} 有多个候选。`);
      if (candidates.length === 1) matches.push(candidates[0]!);
    }
  }
  if (matches.length !== 1)
    throw new Error(`P3528 印迹纹理 skidMark/texture/${name} 在 stuff2/stuff 下需恰好命中 1 个，实际 ${matches.length}。`);
  return matches[0]!;
}

/** Convert rear wheel scene attachments into kart local skid offsets. */
export function createDriftMarkSetup(
  definition: unknown,
  scene: { object: { updateWorldMatrix(a: true, b: true): void; matrixWorld: any } },
  singleRearWheel: boolean,
  kartType: number,
  selectWheelAttachment: (definition: unknown, scene: unknown, slot: number) =>
    { object: { matrixWorld: any }; source: { bounds0: { min: number[]; max: number[] } } },
): DriftMarkSetup {
  const left = selectWheelAttachment(definition, scene, 2);
  const right = selectWheelAttachment(definition, scene, 3);
  scene.object.updateWorldMatrix(true, true);
  const inverse = scene.object.matrixWorld.clone().invert();
  const leftOffset = wheelSkidOffset(left, inverse);
  const rightOffset = wheelSkidOffset(right, inverse);
  return {
    sources: singleRearWheel && kartType === 1 ? [leftOffset] : [leftOffset, rightOffset],
    width: f32(left.source.bounds0.max[0]! - left.source.bounds0.min[0]!),
  };
}
function wheelSkidOffset(wheel: { object: { matrixWorld: any }; source: { bounds0: { min: number[]; max: number[] } } },
  inverse: any): DriftSource {
  const local = inverse.clone().multiply(wheel.object.matrixWorld);
  const bounds = wheel.source.bounds0;
  const midpoint = (min: number, max: number) => f32(f32(min + max) * f32(0.5));
  return {
    x: f32(f32(local.elements[12]) + midpoint(bounds.min[0]!, bounds.max[0]!)),
    y: f32(f32(local.elements[13]) + midpoint(bounds.min[1]!, bounds.max[1]!)),
    z: 0,
  };
}

interface SkidPair { center: DriftVector; first: DriftVector; second: DriftVector; v: number }
interface SkidHistory {
  channel: number;
  pairs: SkidPair[];
  lastCommitTick: number;
  stopDelay: number;
  stopTick?: number;
}
interface DriftParticle {
  channel: number;
  origin: DriftVector;
  right: DriftVector;
  rear: DriftVector;
  up: DriftVector;
  sideSpan?: number;
  phase: number;
  age: number;
  scale: number;
  renderScale: number;
}
interface UpdateRange { start: number; count: number }
interface MeshUpdateRanges { position: UpdateRange; uv: UpdateRange }
function newUpdateRanges(): MeshUpdateRanges {
  return { position: { start: 0, count: 0 }, uv: { start: 0, count: 0 } };
}

function makeTexture(png: { pixels: unknown; width: number; height: number },
  path: string, ops: DriftEffectOps): any {
  const texture = new ops.DataTexture(png.pixels, png.width, png.height,
    ops.textureFormat, ops.textureType);
  texture.name = path;
  texture.colorSpace = ops.colorSpace;
  texture.flipY = false;
  texture.wrapS = ops.wrapping;
  texture.wrapT = ops.wrapping;
  texture.minFilter = ops.nearestFilter;
  texture.magFilter = ops.nearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
async function loadExactTexture(archive: DriftTextureArchive, path: string,
  width: number, height: number, ops: DriftEffectOps): Promise<any> {
  const candidates = archive.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量应为 1，实际为 ${candidates.length}。`);
  const png = await ops.decodePng(await candidates[0]!.bytes());
  if (png.width !== width || png.height !== height)
    throw new Error(`${path} 应为 ${width}x${height}，实际为 ${png.width}x${png.height}。`);
  return makeTexture(png, path, ops);
}
async function loadSkidTexture(archive: DriftTextureArchive, textureName: string | undefined,
  ops: DriftEffectOps): Promise<any> {
  const selected = selectSkidTexture(archive, textureName);
  return makeTexture(await ops.decodePng(await selected.bytes()),
    selected.canonicalPath ?? selected.virtualPath, ops);
}

function makeEffectMesh(texture: any, name: string, vertexCapacity: number,
  ops: DriftEffectOps): any {
  const material = new ops.MeshBasicMaterial({
    map: texture, color: 16777215, transparent: true, depthTest: true,
    depthWrite: false, side: ops.doubleSide, fog: false,
  });
  material.blending = ops.customBlending;
  material.blendEquation = ops.additiveEquation;
  material.blendSrc = ops.sourceAlpha;
  material.blendDst = ops.oneMinusSourceAlpha;
  material.toneMapped = false;
  material.forceSinglePass = true;
  const geometry = new ops.BufferGeometry();
  geometry.setAttribute("position", new ops.BufferAttribute(new Float32Array(vertexCapacity * 3), 3)
    .setUsage(ops.dynamicUsage));
  geometry.setAttribute("uv", new ops.BufferAttribute(new Float32Array(vertexCapacity * 2), 2)
    .setUsage(ops.dynamicUsage));
  geometry.setDrawRange(0, 0);
  const mesh = new ops.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  return mesh;
}

function skidBlocked(channel: number, frame: DriftFrame): boolean {
  const compression = f32(frame.rearWheelCompression[channel]! - frame.wheelCompressionBaseline);
  return !(compression > rearWheelCompressionMinimum && compression < rearWheelCompressionMaximum) ||
    frame.obstacleWheelHit || frame.fullPhysicsBypass;
}
export function driftMode(frame: Pick<DriftFrame, "motionMode" | "roadSurface" | "speedKmh">): number {
  return frame.motionMode === 2 || frame.motionMode === 3 ? 2
    : frame.roadSurface === "slip" && frame.speedKmh > f32(25) ? 1 : 0;
}
function raycastWheelPosition(source: DriftSource, frame: DriftFrame, raycast: DriftRaycast): DriftVector {
  const position = add(add(frame.position, multiply(frame.right, source.x)),
    multiply(frame.forward, f32(-source.y)));
  const rayOrigin = { x: position.x, y: f32(position.y + f32(1)), z: position.z };
  return raycast.rayQuery(rayOrigin, { x: 0, y: f32(-2), z: 0 }, false)?.point ?? position;
}
function skidPair(position: DriftVector, frame: DriftFrame, width: number, v: number): SkidPair {
  const orientation = Math.max(dot(frame.presentationRight, frame.right), f32(0.7));
  const halfWidth = f32(f32(width * orientation) * f32(0.5));
  const lateral = multiply(frame.presentationRight, halfWidth);
  const center = { x: position.x, y: f32(position.y + skidGroundLift), z: position.z };
  return { center, first: add(center, multiply(lateral, -1)), second: add(center, lateral), v };
}

function writeVertex(positions: Float32Array, uvs: Float32Array, index: number,
  position: DriftVector, u: number, v: number): void {
  positions[index * 3] = position.x;
  positions[index * 3 + 1] = position.y;
  positions[index * 3 + 2] = position.z;
  uvs[index * 2] = u;
  uvs[index * 2 + 1] = v;
}
function writeQuad(positions: Float32Array, uvs: Float32Array, firstVertex: number,
  first: DriftVector, second: DriftVector, third: DriftVector, fourth: DriftVector,
  uv: readonly number[]): number {
  writeVertex(positions, uvs, firstVertex, first, uv[0]!, uv[1]!);
  writeVertex(positions, uvs, firstVertex + 1, second, uv[2]!, uv[3]!);
  writeVertex(positions, uvs, firstVertex + 2, third, uv[4]!, uv[5]!);
  writeVertex(positions, uvs, firstVertex + 3, third, uv[4]!, uv[5]!);
  writeVertex(positions, uvs, firstVertex + 4, second, uv[2]!, uv[3]!);
  writeVertex(positions, uvs, firstVertex + 5, fourth, uv[6]!, uv[7]!);
  return firstVertex + 6;
}
function writeSkidHistory(positions: Float32Array, uvs: Float32Array,
  firstVertex: number, history: SkidHistory): number {
  const leftU = history.channel * 0.5;
  const rightU = leftU + 0.499999;
  let vertex = firstVertex;
  for (let index = 1; index < history.pairs.length; index += 1) {
    const before = history.pairs[index - 1]!;
    const after = history.pairs[index]!;
    vertex = writeQuad(positions, uvs, vertex, before.first, before.second,
      after.first, after.second,
      [leftU, before.v, rightU, before.v, leftU, after.v, rightU, after.v]);
  }
  return vertex;
}
function checkGeometryCapacity(position: any, uv: any, vertexCount: number): void {
  if (vertexCount > position.count || vertexCount > uv.count)
    throw new Error("P3528 drift effect geometry 超出已证 native capacity。");
}
function setUpdateRange(attribute: any, range: UpdateRange, componentCount: number): void {
  attribute.clearUpdateRanges();
  if (componentCount !== 0) {
    range.count = componentCount;
    attribute.updateRanges.push(range);
    attribute.needsUpdate = true;
  }
}
function finishGeometry(geometry: any, ranges: MeshUpdateRanges, vertexCount: number): void {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  geometry.setDrawRange(0, vertexCount);
  setUpdateRange(position, ranges.position, vertexCount * 3);
  setUpdateRange(uv, ranges.uv, vertexCount * 2);
}
function clearGeometry(geometry: any): void {
  geometry.getAttribute("position").clearUpdateRanges();
  geometry.getAttribute("uv").clearUpdateRanges();
  geometry.setDrawRange(0, 0);
}
function writeParticleOffset(out: DriftVector, particle: DriftParticle,
  rightScale: number, rearScale: number, upScale: number): void {
  writeScaled(out, particle.origin, particle.right, rightScale);
  out.x = f32(out.x + f32(particle.rear.x * rearScale));
  out.y = f32(out.y + f32(particle.rear.y * rearScale));
  out.z = f32(out.z + f32(particle.rear.z * rearScale));
  out.x = f32(out.x + f32(particle.up.x * upScale));
  out.y = f32(out.y + f32(particle.up.y * upScale));
  out.z = f32(out.z + f32(particle.up.z * upScale));
}

/** Renderer constructors are injected so this owner works with the release's Three.js instance. */
export function createDriftEffectClass(ops: DriftEffectOps) {
  return class DriftEffect {
    object = new ops.Object3D();
    skidMesh: any;
    driftMesh: any;
    drift2Mesh: any;
    skidUpdateRanges = newUpdateRanges();
    driftUpdateRanges = newUpdateRanges();
    drift2UpdateRanges = newUpdateRanges();
    quadFirst = vector();
    quadSecond = vector();
    quadThird = vector();
    quadFourth = vector();
    activeSkids: (SkidHistory | undefined)[] = [undefined, undefined];
    finishedSkids: SkidHistory[] = [];
    particles: DriftParticle[] = [];
    drift2Particles: DriftParticle[] = [];
    driftSideSpans: number[];
    drift2BirthToggle = false;
    driftMode = 0;

    constructor(public random: DriftRandom, public skidMarkSetup: DriftMarkSetup,
      public skidTexture: any, public driftTexture: any, public drift2Texture: any,
      public drift007Texture: any, public drift3Texture: any, public drift005Texture: any) {
      this.object.name = "KartRider ReSkidMark, ReDriftEffect, and ReDrift2Effect";
      const leftSpan = f32(f32(-0.2) * f32(random.next() / 32767));
      random.next();
      const rightSpan = f32(f32(0.2) * f32(random.next() / 32767));
      random.next();
      this.driftSideSpans = [leftSpan, rightSpan];
      this.skidMesh = makeEffectMesh(skidTexture, "KartRider ReSkidMark", skidVertexCapacity, ops);
      this.driftMesh = makeEffectMesh(driftTexture, "KartRider ReDriftEffect", driftVertexCapacity, ops);
      this.drift2Mesh = makeEffectMesh(drift007Texture, "KartRider ReDrift2Effect", driftVertexCapacity, ops);
      this.drift2Mesh.visible = false;
      ops.configureSkidMesh(this.skidMesh, 2000, true);
      ops.configureDriftMesh(this.driftMesh);
      ops.configureDriftMesh(this.drift2Mesh);
      this.object.add(this.skidMesh, this.driftMesh, this.drift2Mesh);
    }

    static async load(archive: DriftTextureArchive, random: DriftRandom,
      setup: DriftMarkSetup, textureName?: string): Promise<DriftEffect> {
      const [skid, drift, drift2, drift007, drift3, drift005] = await Promise.all([
        loadSkidTexture(archive, textureName, ops),
        loadExactTexture(archive, effectPaths.skid, 128, 64, ops),
        loadExactTexture(archive, effectPaths.drift, 128, 64, ops),
        loadExactTexture(archive, effectPaths.drift2, 128, 128, ops),
        loadExactTexture(archive, effectPaths.alternateDrift, 128, 64, ops),
        loadExactTexture(archive, effectPaths.alternateDrift2, 128, 128, ops),
      ]);
      return new DriftEffect(random, setup, skid, drift, drift2, drift007, drift3, drift005);
    }

    update(nowMs: number, frame: DriftFrame, raycast: DriftRaycast, emitParticles: boolean): void {
      const tick = Math.trunc(nowMs) >>> 0;
      if (frame.roadSurface !== "slip") {
        this.updateSkid(0, this.skidMarkSetup.sources[0]!, tick, frame, raycast);
        const second = this.skidMarkSetup.sources[1];
        if (second) this.updateSkid(1, second, tick, frame, raycast);
      }
      const mode = driftMode(frame);
      this.setDriftMode(mode);
      this.updateDrift(frame, emitParticles, mode);
      this.writeSkidGeometry();
      this.writeDriftGeometry();
      this.writeDrift2Geometry();
    }

    reset(): void {
      this.activeSkids[0] = undefined;
      this.activeSkids[1] = undefined;
      this.finishedSkids.length = 0;
      this.particles.length = 0;
      this.drift2Particles.length = 0;
      this.drift2BirthToggle = false;
      this.setDriftMode(0);
      clearGeometry(this.skidMesh.geometry);
      clearGeometry(this.driftMesh.geometry);
      clearGeometry(this.drift2Mesh.geometry);
    }

    dispose(): void {
      this.object.removeFromParent();
      for (const mesh of [this.skidMesh, this.driftMesh, this.drift2Mesh]) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      for (const texture of [this.skidTexture, this.driftTexture, this.drift2Texture,
        this.drift007Texture, this.drift3Texture, this.drift005Texture]) texture.dispose();
    }

    updateSkid(channel: number, source: DriftSource, tick: number,
      frame: DriftFrame, raycast: DriftRaycast): void {
      const blocked = skidBlocked(channel, frame);
      const emitting = frame.active && !blocked;
      let history = this.activeSkids[channel];
      if (emitting) {
        const position = raycastWheelPosition(source, frame, raycast);
        history ??= this.startSkid(channel, tick, position, frame);
        history.stopTick = undefined;
        this.writeSkidTail(history, tick, position, frame);
        return;
      }
      if (history) {
        if (history.stopTick === undefined) {
          history.stopTick = tick;
          history.stopDelay = blocked ? 0 : skidStopDelayMs;
        }
        if (((tick - history.stopTick) >>> 0) >= history.stopDelay) {
          this.finishSkid(channel, history);
          return;
        }
        this.writeSkidTail(history, tick, raycastWheelPosition(source, frame, raycast), frame);
      }
    }

    startSkid(channel: number, tick: number, position: DriftVector, frame: DriftFrame): SkidHistory {
      const activeCount = +!!this.activeSkids[0] + +!!this.activeSkids[1];
      if (this.finishedSkids.length + activeCount >= maxSkidHistories) this.finishedSkids.shift();
      const first = skidPair(position, frame, this.skidMarkSetup.width, 0);
      const history = { channel, pairs: [first, first], lastCommitTick: tick, stopDelay: 0 };
      this.activeSkids[channel] = history;
      return history;
    }

    writeSkidTail(history: SkidHistory, tick: number, position: DriftVector, frame: DriftFrame): void {
      if (history.pairs.length >= maxSkidPairs) return;
      const previous = history.pairs[history.pairs.length - 2]!;
      const next = skidPair(position, frame, this.skidMarkSetup.width, 0);
      const withDistance = { ...next, v: f32(previous.v + distance(previous.center, next.center)) };
      history.pairs[history.pairs.length - 1] = withDistance;
      if (((tick - history.lastCommitTick) >>> 0) > skidCommitMs) {
        history.pairs.push(withDistance);
        history.lastCommitTick = tick;
      }
    }

    finishSkid(channel: number, history: SkidHistory): void {
      this.activeSkids[channel] = undefined;
      this.finishedSkids.push(history);
      if (this.finishedSkids.length > maxSkidHistories) this.finishedSkids.shift();
    }

    updateDrift(frame: DriftFrame, emitParticles: boolean, mode: number): void {
      const normalDrift = mode === 0 && frame.active && frame.contact &&
        frame.speedKmh > driftSpeedMinimum && frame.forwardSpeed > 0;
      const specialDrift = mode !== 0;
      if (emitParticles && (normalDrift || specialDrift)) {
        const scale = mode === 0 ? 1 : f32(1.5);
        this.spawnDrift(frame, -1, scale);
        this.spawnDrift(frame, 1, scale);
        if (specialDrift) this.spawnAlternatingDrift2(frame);
      }
      this.ageParticles(this.particles);
      if (mode !== 0) this.ageParticles(this.drift2Particles);
    }

    private ageParticles(particles: DriftParticle[]): void {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index]!;
        particle.age += 1;
        if (particle.age > particleLifetimeFrames) {
          particles.splice(index, 1);
          continue;
        }
        particle.renderScale = particle.scale;
        particle.scale = particle.age === 1
          ? f32(particle.scale * 2) : f32(particle.scale * f32(0.3));
      }
    }

    spawnDrift(frame: DriftFrame, side: number, scale: number): void {
      const channel = side < 0 ? 0 : 1;
      const phase = f32(this.random.next() / 32767);
      const sameChannel = this.particles.filter(particle => particle.channel === channel);
      if (sameChannel.length >= particlesPerChannel)
        this.particles.splice(this.particles.indexOf(sameChannel[0]!), 1);
      const origin = add(add(frame.position, multiply(frame.right, f32(side * 0.72))),
        multiply(frame.forward, f32(-0.7)));
      this.particles.push({ channel, origin, right: copyFloatVector(frame.presentationRight),
        rear: multiply(frame.presentationForward, -1), up: copyFloatVector(frame.presentationUp),
        sideSpan: this.driftSideSpans[channel], phase, age: 0, scale, renderScale: scale });
    }

    spawnAlternatingDrift2(frame: DriftFrame): void {
      if (!this.drift2BirthToggle) {
        this.spawnDrift2(frame, -1);
        this.spawnDrift2(frame, 1);
      }
      this.drift2BirthToggle = !this.drift2BirthToggle;
    }

    spawnDrift2(frame: DriftFrame, side: number): void {
      const channel = side < 0 ? 0 : 1;
      const phase = f32(this.random.next() / 32767);
      const sameChannel = this.drift2Particles.filter(particle => particle.channel === channel);
      if (sameChannel.length >= particlesPerChannel)
        this.drift2Particles.splice(this.drift2Particles.indexOf(sameChannel[0]!), 1);
      const origin = add(add(frame.position, multiply(frame.right, f32(side * 0.72))),
        multiply(frame.forward, f32(-0.7)));
      this.drift2Particles.push({ channel, origin, right: copyFloatVector(frame.presentationRight),
        rear: multiply(frame.presentationForward, -1), up: copyFloatVector(frame.presentationUp),
        phase, age: 0, scale: 1, renderScale: 1 });
    }

    updateDrift2Particles(): void { this.ageParticles(this.drift2Particles); }

    setDriftMode(mode: number): void {
      if (mode === this.driftMode) return;
      this.driftMode = mode;
      this.driftMesh.material.map = mode === 0 ? this.driftTexture
        : mode === 1 ? this.drift2Texture : this.drift3Texture;
      if (mode !== 0) this.drift2Mesh.material.map = mode === 1
        ? this.drift007Texture : this.drift005Texture;
      const blendDestination = mode === 2 ? ops.oneBlend : ops.oneMinusSourceAlpha;
      this.driftMesh.material.blendDst = blendDestination;
      this.drift2Mesh.material.blendDst = blendDestination;
      this.driftMesh.material.needsUpdate = true;
      this.drift2Mesh.material.needsUpdate = true;
      this.drift2Mesh.visible = mode !== 0;
    }

    writeSkidGeometry(): void {
      const geometry = this.skidMesh.geometry;
      const position = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      checkGeometryCapacity(position, uv, this.skidVertexCount());
      let vertex = 0;
      for (const history of this.finishedSkids)
        vertex = writeSkidHistory(position.array, uv.array, vertex, history);
      for (const history of this.activeSkids)
        if (history) vertex = writeSkidHistory(position.array, uv.array, vertex, history);
      finishGeometry(geometry, this.skidUpdateRanges, vertex);
    }

    writeDriftGeometry(): void {
      const geometry = this.driftMesh.geometry;
      const position = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      checkGeometryCapacity(position, uv, this.particles.length * 6);
      let vertex = 0;
      for (let channel = 0; channel < 2; channel += 1) {
        for (const particle of this.particles) {
          if (particle.channel !== channel) continue;
          const scale = particle.renderScale;
          const height = f32(f32(0.43) * particle.renderScale);
          const span = f32(particle.sideSpan! * particle.renderScale);
          writeScaled(this.quadFirst, particle.origin, particle.rear, scale);
          writeDoubleOffset(this.quadSecond, this.quadFirst, particle.right, span, particle.up, height);
          writeDoubleOffset(this.quadFourth, particle.origin, particle.right, span, particle.up, height);
          const firstV = f32(f32(0.2) + f32(f32(0.8) * particle.phase));
          const secondU = f32(particle.phase + f32(0.5));
          vertex = writeQuad(position.array, uv.array, vertex,
            this.quadFirst, this.quadSecond, particle.origin, this.quadFourth,
            [particle.phase, firstV, particle.phase, 0, secondU, firstV, secondU, 0]);
        }
      }
      finishGeometry(geometry, this.driftUpdateRanges, vertex);
    }

    writeDrift2Geometry(): void {
      const geometry = this.drift2Mesh.geometry;
      const position = geometry.getAttribute("position");
      const uv = geometry.getAttribute("uv");
      checkGeometryCapacity(position, uv, this.drift2Particles.length * 6);
      let vertex = 0;
      for (let channel = 0; channel < 2; channel += 1) {
        for (const particle of this.drift2Particles) {
          if (particle.channel !== channel) continue;
          const scale = particle.renderScale;
          const left = f32(-drift2RearOffset * scale);
          const right = f32(drift2RearOffset * scale);
          const rear = f32(drift2ForwardOffset * scale);
          const height = f32(drift2Height * scale);
          const secondU = f32(particle.phase + f32(0.5));
          writeParticleOffset(this.quadFirst, particle, left, rear, height);
          writeParticleOffset(this.quadSecond, particle, right, rear, height);
          writeParticleOffset(this.quadThird, particle, left, 0, height);
          writeParticleOffset(this.quadFourth, particle, right, 0, height);
          vertex = writeQuad(position.array, uv.array, vertex,
            this.quadFirst, this.quadSecond, this.quadThird, this.quadFourth,
            [particle.phase, 0, particle.phase, 1, secondU, 0, secondU, 1]);
        }
      }
      finishGeometry(geometry, this.drift2UpdateRanges, vertex);
    }

    skidVertexCount(): number {
      let vertices = 0;
      for (const history of this.finishedSkids) vertices += (history.pairs.length - 1) * 6;
      for (const history of this.activeSkids)
        if (history) vertices += (history.pairs.length - 1) * 6;
      return vertices;
    }
  };
}
