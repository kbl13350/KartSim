/** A source entry exposed by the game's canonical asset library. */
export interface EventAssetEntry {
  bytes(): Promise<Uint8Array>;
}

export interface EventAssetLibrary {
  exactCanonicalCandidates(path: string): EventAssetEntry[];
}

export interface TrackEventEffect {
  model: string;
  soundName: string;
  soundType: number;
  distance: number;
}

export interface EventEffectScene {
  object: { removeFromParent(): void };
  reset(time: number): void;
  update(time: number, camera: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface EventSoundSource {
  buffer: unknown;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface EventAudioContext {
  createBufferSource(): EventSoundSource;
}

export interface TrackEventEffectDependencies {
  parseScene(bytes: Uint8Array): unknown;
  buildScene(
    parsed: unknown,
    library: EventAssetLibrary,
    name: string,
    resolve: (reference: { name?: string }) => unknown,
    options: Record<string, unknown>,
  ): Promise<EventEffectScene>;
  resolveTextureSource(
    library: EventAssetLibrary,
    assetPath: string,
    reference: { name?: string },
  ): { status: string; source?: { canonicalPrefix: string; kind: string }; entry?: unknown };
  decodeSound(context: EventAudioContext, bytes: Uint8Array): Promise<unknown>;
  connectSound(context: EventAudioContext, source: EventSoundSource): void;
}

export interface EventEffectTemplate {
  model: string;
  path: string;
  parsed: unknown;
  spare: EventEffectScene[];
}

const EFFECT_DIRECTORY = "item/eventObject";
const SOUND_DIRECTORIES = [EFFECT_DIRECTORY, "sound_/fx/surround"];
const SOUND_EXTENSIONS = ["ogg", "wav", "flac"];

function assetKey(name: string): string {
  return name.toLowerCase();
}

function canonicalDirectory(prefix: string): string {
  return prefix.replaceAll("\\", "/").replace(/^\.\//, "")
    .replace(/^\/+|\/+$/g, "").toLowerCase();
}

/** Only these native event sound modes have a playable cue. */
export function hasEventSound(effect: TrackEventEffect): boolean {
  return effect.soundType === 0 || effect.soundType === 1 ||
    (effect.soundType === 2 && effect.distance >= 0);
}

/** Count model instances while retaining the first spelling of each name. */
export function eventTemplateCounts(effects: readonly TrackEventEffect[]): Map<string, number> {
  const unique = new Map<string, { model: string; count: number }>();
  for (const effect of effects) {
    const key = assetKey(effect.model);
    const group = unique.get(key);
    if (group) group.count += 1;
    else unique.set(key, { model: effect.model, count: 1 });
  }
  return new Map([...unique.values()].map(({ model, count }) => [model, count]));
}

/** Runtime owner of the preloaded event scene clones and their sounds. */
export class TrackEventEffectPool {
  readonly templates = new Map<string, EventEffectTemplate>();
  readonly activeScenes: { effect: TrackEventEffect; scene: EventEffectScene }[] = [];
  readonly textures = new Map<string, { dispose(): void }>();
  readonly soundBuffers = new Map<string, unknown>();
  readonly playingSounds = new Map<string, EventSoundSource>();
  pendingBuilds = 0;
  disposed = false;
  texturesDisposed = false;
  failure: Error | undefined;

  constructor(
    readonly library: EventAssetLibrary,
    readonly mount: { add(object: EventEffectScene["object"]): void },
    readonly environment: unknown,
    readonly stageBinding: unknown,
    readonly audioContext: EventAudioContext,
    readonly dependencies: TrackEventEffectDependencies,
  ) {}

  /** Load one clone for each reference in the map's event list. */
  async loadEvents(events: readonly { effect?: TrackEventEffect }[]): Promise<this> {
    try {
      const effects = events.flatMap(event => event.effect ? [event.effect] : []);
      await this.loadTemplates(effects);
      await this.loadSounds(effects);
      return this;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  trigger(effect: TrackEventEffect, time: number): void {
    this.throwFailure();
    const template = this.templates.get(assetKey(effect.model));
    if (!template) return;
    const scene = template.spare.pop();
    if (!scene) throw new Error(`${template.path} event effect clone pool 尚未补回。`);
    scene.reset(Math.trunc(time) >>> 0);
    this.mount.add(scene.object);
    this.activeScenes.push({ effect, scene });
    this.playSound(effect);
    this.replenish(template);
  }

  remove(effect: TrackEventEffect): void {
    const index = this.activeScenes.findIndex(active => active.effect === effect);
    if (index < 0) return;
    const { scene } = this.activeScenes.splice(index, 1)[0]!;
    scene.object.removeFromParent();
    scene.dispose();
  }

  update(time: number, camera: unknown, width: number, height: number): void {
    this.throwFailure();
    for (const { scene } of this.activeScenes) scene.update(time, camera, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sound of this.playingSounds.values()) {
      sound.onended = null;
      try { sound.stop(); } catch { /* A completed source cannot be stopped twice. */ }
      sound.disconnect();
    }
    this.playingSounds.clear();
    for (const { scene } of this.activeScenes) {
      scene.object.removeFromParent();
      scene.dispose();
    }
    this.activeScenes.length = 0;
    for (const template of this.templates.values()) {
      for (const scene of template.spare) scene.dispose();
      template.spare.length = 0;
    }
    this.templates.clear();
    if (this.pendingBuilds === 0) this.disposeTextures();
  }

  async loadTemplates(effects: readonly TrackEventEffect[]): Promise<void> {
    for (const [model, count] of eventTemplateCounts(effects)) {
      const path = `${EFFECT_DIRECTORY}/${model}.1s`;
      const entries = this.library.exactCanonicalCandidates(path);
      if (entries.length > 1) throw new Error(`${path} source 数量 ${entries.length}。`);
      if (entries.length === 0) continue;
      const template: EventEffectTemplate = {
        model, path, parsed: this.dependencies.parseScene(await entries[0]!.bytes()), spare: [],
      };
      for (let index = 0; index < count; index += 1)
        template.spare.push(await this.buildScene(template));
      this.templates.set(assetKey(model), template);
    }
  }

  async loadSounds(effects: readonly TrackEventEffect[]): Promise<void> {
    const names = new Set(effects
      .filter(effect => this.templates.has(assetKey(effect.model)) && hasEventSound(effect))
      .map(effect => effect.soundName));
    for (const name of names) {
      const source = this.findSound(name);
      if (!source) continue;
      this.soundBuffers.set(assetKey(name),
        await this.dependencies.decodeSound(this.audioContext, await source.bytes()));
    }
  }

  buildScene(template: EventEffectTemplate): Promise<EventEffectScene> {
    return this.dependencies.buildScene(
      template.parsed, this.library, `event:${template.model}:TrackEventEffect`,
      reference => this.resolveTexture(template.path, reference),
      { environment: this.environment, stageBinding: this.stageBinding,
        advanceEnvironment: false, textureCache: this.textures },
    );
  }

  replenish(template: EventEffectTemplate): void {
    this.pendingBuilds += 1;
    this.buildScene(template)
      .then(scene => { if (this.disposed) scene.dispose(); else template.spare.push(scene); })
      .catch(error => { if (!this.disposed) this.failure = error instanceof Error ? error : new Error(String(error)); })
      .finally(() => {
        this.pendingBuilds -= 1;
        if (this.disposed && this.pendingBuilds === 0) this.disposeTextures();
      });
  }

  playSound(effect: TrackEventEffect): void {
    if (!hasEventSound(effect)) return;
    const name = assetKey(effect.soundName);
    const buffer = this.soundBuffers.get(name);
    if (!buffer || this.playingSounds.has(name)) return;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    this.dependencies.connectSound(this.audioContext, source);
    source.onended = () => {
      if (this.playingSounds.get(name) === source) {
        source.disconnect();
        this.playingSounds.delete(name);
      }
    };
    this.playingSounds.set(name, source);
    source.start();
  }

  throwFailure(): void {
    if (this.failure) throw this.failure;
  }

  disposeTextures(): void {
    if (this.texturesDisposed) return;
    this.texturesDisposed = true;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  private findSound(name: string): EventAssetEntry | undefined {
    for (const directory of SOUND_DIRECTORIES) {
      const candidates = SOUND_EXTENSIONS.flatMap(extension =>
        this.library.exactCanonicalCandidates(`${directory}/${name}.${extension}`));
      if (candidates.length > 1) throw new Error(`${directory}/${name} sound source 数量 ${candidates.length}。`);
      if (candidates.length === 1) return candidates[0];
    }
    return undefined;
  }

  private resolveTexture(path: string, reference: { name?: string }): unknown {
    const result = this.dependencies.resolveTextureSource(this.library, path, reference);
    if (result.status !== "found") return result;
    const directory = canonicalDirectory(result.source!.canonicalPrefix);
    return result.source!.kind !== "track" || directory !== EFFECT_DIRECTORY.toLowerCase()
      ? { status: "unresolved", reason: `${reference.name ?? "<unnamed>"} escaped item/eventObject source。` }
      : { status: "found", entry: result.entry };
  }
}
