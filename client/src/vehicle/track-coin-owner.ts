import type { CoinPosition, CoinView } from "./track-coin";
import type { TrackCoinDescriptor, TrackCoinResources } from "./track-coin-source";

export interface CoinSceneObject {
  visible: boolean;
  position: { copy(position: CoinPosition): void };
  rotation: { y: number };
  add(...objects: CoinSceneObject[]): void;
  removeFromParent(): void;
}

export interface CoinRenderedModel {
  object: CoinSceneObject;
  reset(nowMs: number): void;
  playControllers?(nowMs: number, elapsedMs: number): void;
  update(nowMs: number, frameMs: number, frame: unknown, options: unknown): void;
  dispose(): void;
}

export interface CoinAudioSource {
  buffer: unknown;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface CoinAudioContext {
  createBufferSource(): CoinAudioSource;
}

export interface CoinOwnerSource {
  resources: TrackCoinResources;
  coins: TrackCoinDescriptor[];
}

export interface CoinRenderedView {
  descriptor: TrackCoinDescriptor;
  stay: CoinRenderedModel;
  eaten: CoinRenderedModel;
  root: CoinSceneObject;
  used: boolean;
}

export interface CoinOwnerOps<Archive, ModelData> {
  createObject(): CoinSceneObject;
  originalAsset(archive: Archive, path: string): { bytes(): Promise<unknown> };
  decodeModel(bytes: unknown): ModelData;
  decodeAudio(context: CoinAudioContext, bytes: unknown): Promise<unknown> | unknown;
  loadModel(
    data: ModelData,
    archive: Archive,
    path: string,
    identity: { id: "lucci" },
    options: {
      environment: unknown;
      stageBinding: unknown;
      advanceEnvironment: false;
      textureCache: Map<unknown, { dispose(): void }>;
    },
  ): Promise<CoinRenderedModel>;
  createContact(
    name: string,
    position: CoinPosition,
    resources: TrackCoinResources,
    view: CoinView,
    kartPeer: (candidate: unknown) => boolean,
    kartPosition: () => CoinPosition,
    canCollect: () => boolean,
  ): unknown;
  routeAudio(context: CoinAudioContext, source: CoinAudioSource, group: "fx"): void;
}

export interface CoinContactWorld {
  queueKartPairObject(contact: unknown): void;
  isKartPeer(candidate: unknown): boolean;
}

/** Owns all rendered coin instances for one track, including audio and contacts. */
export class TrackCoinOwner<Archive, ModelData> {
  source: CoinOwnerSource;
  context: CoinAudioContext;
  audio: unknown;
  object: CoinSceneObject;
  views: CoinRenderedView[] = [];
  textures = new Map<unknown, { dispose(): void }>();
  sources = new Set<CoinAudioSource>();
  attached = false;
  disposed = false;
  #ops: CoinOwnerOps<Archive, ModelData>;

  constructor(source: CoinOwnerSource, context: CoinAudioContext, audio: unknown, ops: CoinOwnerOps<Archive, ModelData>) {
    this.source = source;
    this.context = context;
    this.audio = audio;
    this.#ops = ops;
    this.object = ops.createObject();
  }

  static async load<Archive, ModelData>(
    archive: Archive,
    source: CoinOwnerSource,
    environment: unknown,
    stageBinding: unknown,
    context: CoinAudioContext,
    ops: CoinOwnerOps<Archive, ModelData>,
  ): Promise<TrackCoinOwner<Archive, ModelData>> {
    const [stayData, eatenData, audio] = await Promise.all([
      ops.originalAsset(archive, source.resources.stayModel).bytes().then(ops.decodeModel),
      ops.originalAsset(archive, source.resources.eatenModel).bytes().then(ops.decodeModel),
      ops.originalAsset(archive, `sound_/fx/item/lucci/${source.resources.audioStem}.ogg`)
        .bytes().then(bytes => ops.decodeAudio(context, bytes)),
    ]);
    const owner = new this(source, context, audio, ops);
    try {
      for (const coin of source.coins) {
        const options = {
          environment, stageBinding, advanceEnvironment: false as const,
          textureCache: owner.textures,
        };
        const stay = await ops.loadModel(stayData, archive, source.resources.stayModel, { id: "lucci" }, options);
        let eaten: CoinRenderedModel;
        try {
          eaten = await ops.loadModel(eatenData, archive, source.resources.eatenModel, { id: "lucci" }, options);
        } catch (error) {
          stay.dispose();
          throw error;
        }
        const root = ops.createObject();
        root.position.copy(coin.position);
        root.add(stay.object, eaten.object);
        eaten.object.visible = false;
        owner.object.add(root);
        owner.views.push({ descriptor: coin, stay, eaten, root, used: false });
      }
      return owner;
    } catch (error) {
      owner.dispose();
      throw error;
    }
  }

  attach(world: CoinContactWorld, kartPosition: () => CoinPosition, canCollect: () => boolean): void {
    if (this.disposed || this.attached) throw Error("LTE 金币 owner 已释放或重复绑定。");
    this.attached = true;
    for (const entry of this.views) {
      world.queueKartPairObject(this.#ops.createContact(
        entry.descriptor.name,
        entry.descriptor.position,
        this.source.resources,
        {
          stay: rotation => { entry.root.rotation.y = rotation; },
          eaten: (position, nowMs) => {
            if (!entry.used) {
              entry.used = true;
              entry.stay.object.visible = false;
              entry.eaten.object.visible = true;
              entry.eaten.reset(nowMs);
              entry.eaten.playControllers?.(nowMs, 0);
              this.play();
            }
            entry.root.rotation.y = 0;
            entry.root.position.copy(position);
          },
          hide: () => { entry.root.visible = false; },
          destroy: () => { entry.root.visible = false; },
        },
        candidate => world.isKartPeer(candidate),
        kartPosition,
        canCollect,
      ));
    }
  }

  update(nowMs: number, frameMs: number, frame: unknown, options: unknown): void {
    if (this.disposed) return;
    for (const entry of this.views) {
      if (entry.root.visible) (entry.used ? entry.eaten : entry.stay).update(nowMs, frameMs, frame, options);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.object.removeFromParent();
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* An already stopped source is safe to release. */ }
      source.disconnect();
    }
    this.sources.clear();
    for (const entry of this.views) {
      entry.root.removeFromParent();
      entry.stay.dispose();
      entry.eaten.dispose();
    }
    this.views.length = 0;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  play(): void {
    const source = this.context.createBufferSource();
    source.buffer = this.audio;
    this.#ops.routeAudio(this.context, source, "fx");
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    source.start();
  }
}
