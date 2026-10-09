import { Group, type Camera, type Object3D } from "three";
import { ITEM_COMMON_TEXTURE_SOURCE } from "./item-cubes";
import { ITEM_FX_TUNING, type FxModel, type FxSound } from "./item-fx-plan";

/**
 * Model and sound ownership of the item race presenter. Every model of the
 * item set is decoded once at race load; each shown copy is an assembled
 * scene (`c5`, the cube field's loader) in its own mount, pooled per model:
 * one copy is preloaded, more are assembled in the background when several
 * karts need the same model at once, up to `maxInstances`. Textures are
 * shared by all copies through one cache. Sounds are decoded at load and
 * played through the race audio route.
 */

/** A decoded `.1s` model (`y9`); only the node tree is read here. */
export interface FxModelData {
  root: FxModelNode;
  settings?: unknown;
}

export interface FxModelNode {
  kind: string;
  className?: string;
  name: string;
  children: FxModelNode[];
  transform: number[][];
  position: number[];
  scale: number[];
  slots: unknown[];
  slotOccurrences: unknown[];
  [field: string]: unknown;
}

/** The part of an assembled scene (`c5`) the presenter drives. */
export interface FxRenderedScene {
  object: Object3D;
  reset(nowMs: number): void;
  playControllers?(nowMs: number, durationMs: number): void;
  update(nowMs: number, camera?: Camera, width?: number, height?: number): void;
  dispose(): void;
}

export interface FxAudioParam { setValueAtTime(value: number, time: number): unknown }
export interface FxAudioNode { disconnect(): void }
export interface FxAudioSource extends FxAudioNode {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
}
export interface FxGain extends FxAudioNode { gain: FxAudioParam }
export interface FxPanner extends FxAudioNode { pan: FxAudioParam }
export interface FxAudioContext {
  currentTime: number;
  createBufferSource(): FxAudioSource;
  createGain(): FxGain;
  createStereoPanner?(): FxPanner;
}

export interface ItemFxOps<Archive> {
  originalAsset(archive: Archive, path: string): { bytes(): Promise<unknown> };
  decodeModel(bytes: unknown): FxModelData;
  decodeAudio(context: FxAudioContext, bytes: unknown): Promise<unknown> | unknown;
  loadModel(
    data: FxModelData,
    archive: Archive,
    path: string,
    identity: { id: string },
    options: {
      advertisementSources?: readonly object[];
      environment: unknown;
      stageBinding: unknown;
      advanceEnvironment: false;
      textureCache: Map<unknown, { dispose(): void }>;
    },
  ): Promise<FxRenderedScene>;
  /** The race audio route (`S9`): source → [panner] → gain → destination, fx group. */
  routeAudio(context: FxAudioContext, source: FxAudioSource, group: "fx", gain?: FxGain,
    panner?: FxPanner): void;
  /** Volume of a routed gain (`he`), scaled by the player's fx volume. */
  setGain(param: FxAudioParam, value: number, time: number): void;
}

const COLOR_KEY_TIME_COLOR_BYTES = 8;
const COLOR_KEY_HERMITE_BYTES = 16;

/**
 * The release's scene assembler only maps color keys of type 0 (Hermite) and
 * 3 (step). The UFO models animate material colors with type 1 keys (time and
 * color, 8 bytes) and would not assemble; such keys (and type 2) become
 * type 0 keys with flat tangents, which is a smoothstep between the same
 * colors ([还原]: the original's linear blend is not reachable through the
 * shared assembler). Returns how many controllers changed.
 */
export function convertUnmappedColorKeys(root: FxModelNode): number {
  let converted = 0;
  const visit = (node: FxModelNode) => {
    for (const slot of [...node.slots, ...node.slotOccurrences]) {
      const value = (slot as { value?: unknown } | undefined)?.value ?? slot;
      const controllers = (value as { controllers?: unknown[] } | undefined)?.controllers;
      if (!Array.isArray(controllers)) continue;
      for (const controller of controllers) {
        const color = controller as { kind?: string; keys?: { type: number; records: Uint8Array[] } };
        if (color?.kind !== "color-controller" || !color.keys) continue;
        if (color.keys.type !== 1 && color.keys.type !== 2) continue;
        color.keys = {
          type: 0,
          records: color.keys.records.map(record => {
            const hermite = new Uint8Array(COLOR_KEY_HERMITE_BYTES);
            hermite.set(record.subarray(0, COLOR_KEY_TIME_COLOR_BYTES));
            return hermite;
          }),
        };
        converted += 1;
      }
    }
    node.children.forEach(visit);
  };
  visit(root);
  return converted;
}

const IDENTITY = (): number[][] => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

function withoutSlots(node: FxModelNode, indices: readonly number[]): FxModelNode {
  const slots = [...node.slots];
  const occurrences = [...node.slotOccurrences];
  for (const index of indices) {
    slots[index] = undefined;
    occurrences[index] = undefined;
  }
  return { ...node, slots, slotOccurrences: occurrences };
}

/** The water bomb's falling balloon in waterBomb item00, and its fall sheath and streaks. */
const FALLING_BALLOON = "물방울-중심";
const FALL_TRAIL_PREFIX = "풍선낙하";

/**
 * The time bomb's carried balloon ([还原]): the water bomb's falling balloon
 * (`물방울-중심` of waterBomb item00, 1.2× the size of the thrown one) held
 * still at the kart origin — only its balloon billboard: no fall track, no
 * fall sheath or streaks, no visibility switches; the presenter lifts and
 * pulses it.
 */
export function carriedBalloon(model: FxModelData): FxModelData {
  const falling = model.root.children.find(child => child.name === FALLING_BALLOON);
  if (!falling) throw Error(`水炸弹模型缺少 ${FALLING_BALLOON}，无法组成定时水炸弹。`);
  const strip = (node: FxModelNode): FxModelNode => ({
    ...withoutSlots(node, [0, 1]),
    children: node.children.filter(child => !child.name.startsWith(FALL_TRAIL_PREFIX)).map(strip),
  });
  const balloon: FxModelNode = { ...strip(falling), transform: IDENTITY(), position: [0, 0, 0] };
  return { root: { ...model.root, children: [balloon] }, settings: model.settings };
}

/** One shown copy of a model. */
export interface FxInstance {
  readonly pool: FxModelPool;
  readonly mount: Group;
  readonly scene: FxRenderedScene;
  busy: boolean;
}

export class FxModelPool {
  readonly instances: FxInstance[] = [];
  building = 0;
  failure: unknown;

  constructor(readonly bank: FxModelBank<unknown>, readonly model: FxModel, readonly data: FxModelData) {}

  /** A free copy, or undefined while every copy is busy. */
  acquire(): FxInstance | undefined {
    const free = this.instances.find(instance => !instance.busy);
    if (free) free.busy = true;
    return free;
  }

  /** Assemble copies in the background until `demand` exist or are on the way (at most the cap). */
  reserve(demand: number): void {
    const wanted = Math.min(demand, ITEM_FX_TUNING.maxInstances);
    while (this.instances.length + this.building < wanted && this.grow()) { /* one build per copy */ }
  }

  release(instance: FxInstance): void {
    instance.busy = false;
    instance.mount.visible = false;
  }

  /** Every allowed copy exists: a new visual can only take over a running one. */
  get full(): boolean {
    return this.instances.length >= ITEM_FX_TUNING.maxInstances;
  }

  grow(): boolean {
    if (this.instances.length + this.building >= ITEM_FX_TUNING.maxInstances ||
      this.failure !== undefined || this.bank.disposed) return false;
    this.building += 1;
    this.bank.build(this).then(instance => {
      if (instance) this.instances.push(instance);
    }, error => {
      // A model that cannot assemble is skipped for the rest of the race.
      this.failure = error;
      console.warn(`道具表现模型 ${this.model.path} 组装失败：`, error);
    }).finally(() => { this.building -= 1; });
    return true;
  }
}

export class FxModelBank<Archive> {
  readonly pools = new Map<string, FxModelPool>();
  readonly textures = new Map<unknown, { dispose(): void }>();
  readonly root = new Group();
  disposed = false;
  pending = 0;

  constructor(
    readonly archive: Archive,
    readonly environment: unknown,
    readonly stageBinding: unknown,
    readonly ops: ItemFxOps<Archive>,
  ) {
    this.root.name = "itemRacePresenter";
  }

  /** Decode every model (each file once) and assemble the preloaded copies. */
  async load(models: readonly FxModel[]): Promise<void> {
    const decoded = new Map<string, Promise<FxModelData>>();
    const decode = (path: string) => {
      let data = decoded.get(path);
      if (!data) {
        data = Promise.resolve(this.ops.originalAsset(this.archive, path).bytes()).then(bytes => {
          const model = this.ops.decodeModel(bytes);
          convertUnmappedColorKeys(model.root);
          return model;
        });
        decoded.set(path, data);
      }
      return data;
    };
    const entries = await Promise.all(models.map(async model => {
      const data = await decode(model.path);
      return [model, model.derive === "carriedBalloon" ? carriedBalloon(data) : data] as const;
    }));
    for (const [model, data] of entries) {
      if (this.pools.has(model.key)) continue;
      const pool = new FxModelPool(this as FxModelBank<unknown>, model, data);
      this.pools.set(model.key, pool);
      for (let index = 0; index < (model.preload ?? ITEM_FX_TUNING.preloadInstances); index += 1) {
        const instance = await this.build(pool);
        if (instance) pool.instances.push(instance);
      }
    }
  }

  /** Assemble one more copy of a pool's model in its own hidden mount. */
  async build(pool: FxModelPool): Promise<FxInstance | undefined> {
    this.pending += 1;
    try {
      const scene = await this.ops.loadModel(pool.data, this.archive, pool.model.path, { id: "item" }, {
        environment: this.environment, stageBinding: this.stageBinding,
        advanceEnvironment: false, textureCache: this.textures,
        // Item effects borrow textures from item/common, like the cube's fired01.
        advertisementSources: [ITEM_COMMON_TEXTURE_SOURCE],
      });
      if (this.disposed) {
        scene.dispose();
        return undefined;
      }
      const mount = new Group();
      mount.name = `itemFx:${pool.model.key}#${pool.instances.length + pool.building}`;
      mount.matrixAutoUpdate = false;
      mount.visible = false;
      mount.add(scene.object);
      this.root.add(mount);
      return { pool, mount, scene, busy: false };
    } finally {
      this.pending -= 1;
      this.releaseTextures();
    }
  }

  pool(model: FxModel | undefined): FxModelPool | undefined {
    return model ? this.pools.get(model.key) : undefined;
  }

  releaseTextures(): void {
    if (!this.disposed || this.pending !== 0) return;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    for (const pool of this.pools.values()) {
      for (const instance of pool.instances) {
        instance.mount.removeFromParent();
        instance.scene.dispose();
      }
      pool.instances.length = 0;
    }
    this.pools.clear();
    this.releaseTextures();
  }
}

/** One playing sound. */
export interface FxPlayingSound {
  readonly path: FxSound;
  readonly source: FxAudioSource;
  readonly gain: FxGain;
  readonly panner?: FxPanner;
  key?: string;
}

/** Decoded item sounds and the sources playing them. */
export class FxSoundBank<Archive> {
  readonly buffers = new Map<FxSound, unknown>();
  readonly loading = new Map<FxSound, Promise<unknown>>();
  readonly playing = new Set<FxPlayingSound>();
  readonly failed = new Set<FxSound>();
  disposed = false;

  constructor(readonly archive: Archive, readonly context: FxAudioContext | undefined,
    readonly ops: ItemFxOps<Archive>) {}

  async load(paths: readonly FxSound[]): Promise<void> {
    await Promise.all(paths.map(path => this.fetch(path)));
  }

  /** Decode a sound once; failures are logged and the sound stays silent. */
  fetch(path: FxSound): Promise<unknown> {
    const context = this.context;
    if (!context) return Promise.resolve(undefined);
    let loading = this.loading.get(path);
    if (!loading) {
      loading = Promise.resolve(this.ops.originalAsset(this.archive, path).bytes())
        .then(bytes => this.ops.decodeAudio(context, bytes))
        .then(buffer => {
          this.buffers.set(path, buffer);
          return buffer;
        }, error => {
          this.failed.add(path);
          console.warn(`道具音效 ${path} 解码失败：`, error);
          return undefined;
        });
      this.loading.set(path, loading);
    }
    return loading;
  }

  /** A decode of this sound is in flight. */
  decoding(path: FxSound): boolean {
    return !this.disposed && this.context !== undefined && this.loading.has(path) && !this.buffers.has(path) &&
      !this.failed.has(path);
  }

  /** Start a decoded sound now; undefined when silent (no audio, not decoded yet). */
  play(path: FxSound, volume: number, pan: number, loop: boolean): FxPlayingSound | undefined {
    const context = this.context;
    const buffer = this.buffers.get(path);
    if (this.disposed || !context || buffer === undefined) {
      if (!this.loading.has(path)) void this.fetch(path);
      return undefined;
    }
    if (this.playing.size >= ITEM_FX_TUNING.maxSounds) {
      const oldest = [...this.playing].find(sound => !sound.source.loop);
      if (oldest) this.stop(oldest);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = pan !== 0 || loop ? context.createStereoPanner?.() : undefined;
    source.buffer = buffer;
    source.loop = loop;
    this.ops.setGain(gain.gain, volume, context.currentTime);
    panner?.pan.setValueAtTime(pan, context.currentTime);
    this.ops.routeAudio(context, source, "fx", gain, panner);
    const playing: FxPlayingSound = { path, source, gain, panner };
    this.playing.add(playing);
    source.onended = () => this.release(playing);
    source.start();
    return playing;
  }

  /** Follow a looping sound's source. */
  steer(playing: FxPlayingSound, volume: number, pan: number): void {
    const context = this.context;
    if (!context) return;
    this.ops.setGain(playing.gain.gain, volume, context.currentTime);
    playing.panner?.pan.setValueAtTime(pan, context.currentTime);
  }

  stop(playing: FxPlayingSound): void {
    playing.source.onended = null;
    try { playing.source.stop(); } catch { /* A finished source throws on stop. */ }
    this.release(playing);
  }

  release(playing: FxPlayingSound): void {
    if (!this.playing.delete(playing)) return;
    playing.source.onended = null;
    playing.source.disconnect();
    playing.panner?.disconnect();
    playing.gain.disconnect();
  }

  stopAll(): void {
    for (const playing of [...this.playing]) this.stop(playing);
  }

  dispose(): void {
    if (this.disposed) return;
    this.stopAll();
    this.disposed = true;
    this.buffers.clear();
  }
}
