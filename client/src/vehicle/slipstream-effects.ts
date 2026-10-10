const draftModelPath = "effect/draft/effect.1s";
const draftBurstPath = "effect/draft/slipstream_EF.1s";

export interface SlipstreamAsset {
  virtualPath: string;
  bytes(): Promise<Uint8Array>;
}
export interface SlipstreamLibrary {
  exactCanonicalCandidates(path: string): SlipstreamAsset[];
}
export interface SlipstreamScene {
  object: {
    visible: boolean;
    add(...objects: unknown[]): void;
    removeFromParent(): void;
  };
  playControllers?(timeMs: number, offset: number): void;
  stopControllers?(timeMs: number): void;
  update(timeMs: number, arg1: unknown, arg2: unknown, arg3: unknown): void;
  dispose(): void;
}
export interface SlipstreamVisualOps {
  decodeModel(bytes: Uint8Array): unknown;
  loadModel(...args: unknown[]): Promise<SlipstreamScene>;
}

/** The draft trail and its optional one-shot burst, attached to a kart. */
export class SlipstreamVisual {
  scene: SlipstreamScene;
  burst: SlipstreamScene | undefined;
  active = false;
  burstActive = false;

  constructor(scene: SlipstreamScene, burst?: SlipstreamScene) {
    this.scene = scene;
    this.burst = burst;
    scene.object.visible = false;
    if (burst) burst.object.visible = false;
  }

  update(nowMs: number, enabled: boolean, burstEnabled: boolean,
    arg1: unknown, arg2: unknown, arg3: unknown): void {
    const now = Math.trunc(nowMs) >>> 0;
    if (enabled && !this.active) {
      this.active = true;
      this.scene.object.visible = true;
      this.scene.playControllers?.(now, 0);
    }
    if (!enabled && this.active) {
      this.active = false;
      this.scene.stopControllers?.(now);
      this.scene.object.visible = false;
    }
    if (enabled) this.scene.update(now, arg1, arg2, arg3);
    if (this.burst) {
      if (burstEnabled && !this.burstActive) this.burst.playControllers?.(now, 0);
      if (!burstEnabled && this.burstActive) this.burst.stopControllers?.(now);
      this.burstActive = burstEnabled;
      this.burst.object.visible = burstEnabled;
      if (burstEnabled) this.burst.update(now, arg1, arg2, arg3);
    }
  }

  reset(nowMs = 0): void {
    this.active = false;
    this.burstActive = false;
    const now = Math.trunc(nowMs) >>> 0;
    this.scene.stopControllers?.(now);
    this.scene.object.visible = false;
    this.burst?.stopControllers?.(now);
    if (this.burst) this.burst.object.visible = false;
  }

  dispose(): void {
    this.scene.object.removeFromParent();
    this.scene.dispose();
    this.burst?.object.removeFromParent();
    this.burst?.dispose();
  }
}

export async function loadSlipstreamVisual<T extends SlipstreamVisual>(
  library: SlipstreamLibrary,
  kartScene: { object: { add(...objects: unknown[]): void } } | undefined,
  environment: unknown,
  stageBinding: unknown,
  ops: SlipstreamVisualOps,
  makeEffect: (scene: SlipstreamScene, burst?: SlipstreamScene) => T,
): Promise<T | undefined> {
  const draftSources = library.exactCanonicalCandidates(draftModelPath);
  if (draftSources.length > 1) throw new Error(`${draftModelPath} source 不唯一。`);
  if (draftSources.length === 0 || !kartScene) return;
  const burstSources = library.exactCanonicalCandidates(draftBurstPath);
  if (burstSources.length > 1) throw new Error(`${draftBurstPath} source 不唯一。`);
  const loadScene = async (source: SlipstreamAsset, id: string): Promise<SlipstreamScene> =>
    ops.loadModel(ops.decodeModel(await source.bytes()), library, source.virtualPath,
      { id }, { environment, stageBinding, advanceEnvironment: false,
        convertClientCoordinates: false });
  const scene = await loadScene(draftSources[0]!, "effect:draft");
  try {
    const burst = burstSources[0]
      ? await loadScene(burstSources[0], "effect:draft-burst") : undefined;
    kartScene.object.add(scene.object);
    if (burst) kartScene.object.add(burst.object);
    return makeEffect(scene, burst);
  } catch (error) {
    scene.dispose();
    throw error;
  }
}

export interface SlipstreamAudioSource {
  buffer: AudioBuffer | null;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}
export interface SlipstreamAudioContext {
  createBufferSource(): SlipstreamAudioSource;
}
export interface SlipstreamAudioOps {
  loop(source: SlipstreamAudioSource, enabled: boolean): void;
  connect(context: SlipstreamAudioContext, source: SlipstreamAudioSource): void;
}

/** Charging loop and draft cue. The cue is cleared only by its own ended callback. */
export class SlipstreamAudio {
  context: SlipstreamAudioContext;
  chargingBuffer: AudioBuffer | undefined;
  draftBuffer: AudioBuffer | undefined;
  charging: SlipstreamAudioSource | undefined;
  draft: SlipstreamAudioSource | undefined;
  #ops: SlipstreamAudioOps;

  constructor(context: SlipstreamAudioContext, chargingBuffer: AudioBuffer | undefined,
    draftBuffer: AudioBuffer | undefined, ops: SlipstreamAudioOps) {
    this.context = context;
    this.chargingBuffer = chargingBuffer;
    this.draftBuffer = draftBuffer;
    this.#ops = ops;
  }

  update(charging: boolean, draft: boolean): void {
    if (charging) {
      if (!this.charging && this.chargingBuffer) {
        const source = this.context.createBufferSource();
        source.buffer = this.chargingBuffer;
        this.#ops.loop(source, true);
        this.#ops.connect(this.context, source);
        source.start();
        this.charging = source;
      }
    } else this.stopCharging();
    if (draft && !this.draft && this.draftBuffer) {
      const source = this.context.createBufferSource();
      source.buffer = this.draftBuffer;
      this.#ops.connect(this.context, source);
      source.onended = () => {
        if (this.draft === source) {
          source.disconnect();
          this.draft = undefined;
        }
      };
      this.draft = source;
      source.start();
    }
  }

  reset(): void {
    this.stopCharging();
    if (this.draft) {
      try { this.draft.stop(); } catch { /* Already stopped by the audio engine. */ }
      this.draft.disconnect();
      this.draft = undefined;
    }
  }

  dispose(): void { this.reset(); }

  stopCharging(): void {
    if (!this.charging) return;
    try { this.charging.stop(); } catch { /* Already stopped by the audio engine. */ }
    this.charging.disconnect();
    this.charging = undefined;
  }
}

export async function loadSlipstreamAudio<T extends SlipstreamAudio>(
  library: SlipstreamLibrary,
  context: SlipstreamAudioContext,
  decodeAudio: (context: SlipstreamAudioContext, bytes: Uint8Array) => Promise<AudioBuffer>,
  makeAudio: (context: SlipstreamAudioContext, charging?: AudioBuffer,
    draft?: AudioBuffer) => T,
): Promise<T> {
  const optionalSource = (name: string): SlipstreamAsset | undefined => {
    const sources = library.exactCanonicalCandidates(`sound_/fx/kart/${name}.ogg`);
    if (sources.length > 1) throw new Error(`${name}.ogg source 不唯一。`);
    return sources[0];
  };
  const [chargingBytes, draftBytes] = await Promise.all([
    optionalSource("slipStream")?.bytes(), optionalSource("draft")?.bytes(),
  ]);
  const decode = (bytes: Uint8Array | undefined) =>
    bytes ? decodeAudio(context, bytes) : undefined;
  const [charging, draft] = await Promise.all([decode(chargingBytes), decode(draftBytes)]);
  return makeAudio(context, charging, draft);
}
