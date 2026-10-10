interface DisposableScene {
  object: unknown;
  reset(time: number): void;
  update(time: number, camera: unknown, width: number, height: number): void;
  dispose(): void;
}

interface BuiltEffect {
  parsed: unknown;
  scene: DisposableScene;
}

interface GroupNode {
  matrixAutoUpdate: boolean;
  visible: boolean;
  matrixWorldNeedsUpdate: boolean;
  matrix: { set(...values: number[]): void };
  add(child: unknown): void;
  removeFromParent(): void;
}

interface GiantActor {
  id: unknown;
  logic: {
    local: boolean;
    main: number;
    mainScale: { z: number };
    consumeVisuals(): { kind: string; atMs: number; cells?: unknown }[];
  };
  pose(): {
    right: { x: number; y: number; z: number };
    forward: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
    position: { x: number; y: number; z: number };
  } | undefined;
}

interface GiantWarning {
  mesh: unknown;
  update(local: unknown, others: unknown[], visibility: unknown, camera: unknown): void;
  dispose(): void;
}

interface SoundSource {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface GiantRaceEffectDependencies {
  parseBml(bytes: Uint8Array): { children: { name: string }[] };
  attribute(node: unknown, name: string): string | undefined;
  exactEntry(library: unknown, path: string): { bytes(): Promise<Uint8Array> };
  createGroup(): GroupNode;
  decodeSound(audio: unknown, bytes: Uint8Array): Promise<unknown>;
  connectSound(audio: unknown, source: SoundSource, category: string): void;
  decodeImage(bytes: Uint8Array): Promise<{ pixels: Uint8Array; width: number; height: number }>;
  createTexture(pixels: Uint8Array, width: number, height: number): {
    flipY: boolean; needsUpdate: boolean;
  };
  createWarning(texture: unknown): GiantWarning;
  build(library: unknown, path: string, textures: Map<string, { dispose(): void }>,
    options: unknown, advance: boolean, parsed?: unknown): Promise<BuiltEffect>;
}

interface ActorEffects {
  actor: GiantActor;
  arrow: BuiltEffect;
  mount: GroupNode;
  spare: BuiltEffect[];
  arrowStart?: number;
}

interface ActiveExplosion {
  model: BuiltEffect;
  mount: GroupNode;
  actor: ActorEffects;
  start: number;
}

/** Giant item's race scene, warnings, cloned bursts, and sound ownership. */
export class GiantRaceEffects {
  disposed = false;
  pending = 0;
  failure: unknown;
  readonly textures = new Map<string, { dispose(): void }>();
  readonly actors: ActorEffects[] = [];
  readonly explosions: ActiveExplosion[] = [];
  readonly sounds = new Map<string, unknown>();
  readonly sources = new Set<SoundSource>();
  threat: SoundSource | undefined;
  warning: GiantWarning | undefined;
  firePath = "";
  arrowLife = 0;
  fireLife = 0;

  constructor(
    readonly library: unknown,
    readonly world: { add(object: unknown): void },
    readonly options: unknown,
    readonly audio: { createBufferSource(): SoundSource },
    readonly stage: (cells: unknown, atMs: number) => void,
    readonly dependencies: GiantRaceEffectDependencies,
  ) {}

  async loadActors(actors: GiantActor[]): Promise<this> {
    const ops = this.dependencies;
    try {
      const state = ops.parseBml(
        await ops.exactEntry(this.library, "item/giantEffect/item.bml").bytes(),
      ).children.filter(node => node.name === "state" && ops.attribute(node, "name") === "Affect");
      if (state.length !== 2 || ops.attribute(state[0], "fired") !== "fired00" ||
        ops.attribute(state[1], "item") !== "arrow") {
        throw new Error("巨人效果原状态表不匹配。");
      }
      this.fireLife = Number(ops.attribute(state[0], "life"));
      this.arrowLife = Number(ops.attribute(state[1], "life"));
      if (this.fireLife !== 1000 || this.arrowLife !== 30000)
        throw new Error("巨人效果原生命周期未核准。");

      this.firePath = `item/giantEffect/${ops.attribute(state[0], "fired")}.1s`;
      for (const actor of actors) {
        const arrow = await this.build("item/giantEffect/arrow.1s");
        const mount = ops.createGroup();
        mount.matrixAutoUpdate = false;
        mount.visible = false;
        mount.add(arrow.scene.object);
        this.world.add(mount);
        const effects: ActorEffects = { actor, arrow, mount, spare: [] };
        this.actors.push(effects);
        effects.spare.push(await this.build(this.firePath));
      }

      const soundPaths: [string, string][] = [
        ["scale", "sound_/fx/etc/giantScale.ogg"],
        ["press", "sound_/fx/etc/press.ogg"],
        ["reset", `sound_/fx/item/giantEffect/${ops.attribute(state[0], "itemFx")}.ogg`],
        ["threat", "sound_/fx/surround/mo_돌구르기.ogg"],
      ];
      for (const [name, path] of soundPaths) {
        this.sounds.set(name, await ops.decodeSound(this.audio,
          await ops.exactEntry(this.library, path).bytes()));
      }

      const shadow = await ops.decodeImage(
        await ops.exactEntry(this.library, "effect/giantShadow/giantShadow.png").bytes(),
      );
      const texture = ops.createTexture(shadow.pixels, shadow.width, shadow.height);
      texture.flipY = false;
      texture.needsUpdate = true;
      this.warning = ops.createWarning(texture);
      this.world.add(this.warning.mesh);
      return this;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  build(path: string, parsed?: unknown): Promise<BuiltEffect> {
    return this.dependencies.build(this.library, path, this.textures, this.options, false, parsed);
  }

  replenish(actor: ActorEffects, parsed: unknown): void {
    this.pending += 1;
    this.build(this.firePath, parsed)
      .then(model => { if (this.disposed) model.scene.dispose(); else actor.spare.push(model); })
      .catch(error => { if (!this.disposed) this.failure = error; })
      .finally(() => { this.pending -= 1; this.releaseTextures(); });
  }

  play(name: string, loop = false): SoundSource {
    const buffer = this.sounds.get(name);
    if (!buffer) throw new Error(`巨人声音未装配：${name}`);
    const source = this.audio.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    this.dependencies.connectSound(this.audio, source, "fx");
    this.sources.add(source);
    source.onended = () => { source.disconnect(); this.sources.delete(source); };
    source.start();
    return source;
  }

  setThreatSound(enabled: boolean): void {
    if (this.disposed) return;
    if (enabled && !this.threat) this.threat = this.play("threat", true);
    else if (!enabled && this.threat) {
      this.stop(this.threat);
      this.threat = undefined;
    }
  }

  stop(source: SoundSource): void {
    source.onended = null;
    source.stop();
    source.disconnect();
    this.sources.delete(source);
  }

  /** Position a billboard in the actor's native race coordinate system. */
  pose(mount: GroupNode, effects: ActorEffects, elevation: number): boolean {
    const pose = effects.actor.pose();
    if (!pose) return false;
    const { right, forward, up, position } = pose;
    mount.matrix.set(
      right.x, up.x, -forward.x, Math.fround(position.x + up.x * elevation),
      right.y, up.y, -forward.y, Math.fround(position.y + up.y * elevation),
      right.z, up.z, -forward.z, Math.fround(position.z + up.z * elevation),
      0, 0, 0, 1,
    );
    mount.matrixWorldNeedsUpdate = true;
    return true;
  }

  update(time: number, camera: unknown, width: number, height: number, visibility: unknown): void {
    if (this.disposed) return;
    if (this.failure) throw this.failure;
    const local = this.actors.find(entry => entry.actor.logic.local)!;
    for (const effects of this.actors) {
      for (const visual of effects.actor.logic.consumeVisuals()) {
        if (visual.kind === "stage") {
          if (effects.actor.logic.local) this.stage(visual.cells, visual.atMs);
          continue;
        }
        if (visual.kind === "reset") {
          const burst = effects.spare.pop();
          if (!burst) throw new Error("巨人爆炸原模型克隆尚未补回。");
          const mount = this.dependencies.createGroup();
          mount.matrixAutoUpdate = false;
          mount.add(burst.scene.object);
          this.world.add(mount);
          burst.scene.reset(visual.atMs);
          this.explosions.push({ model: burst, mount, actor: effects, start: visual.atMs });
          this.replenish(effects, burst.parsed);
        }
        if (effects.actor.logic.local) this.play(visual.kind);
      }
      const showArrow = local.actor.logic.main === 4 && effects.actor.logic.main !== 4;
      if (showArrow && effects.arrowStart === undefined) {
        effects.arrowStart = time;
        effects.arrow.scene.reset(time);
      }
      if (!showArrow) effects.arrowStart = undefined;
      if (effects.arrowStart !== undefined &&
        ((time - effects.arrowStart) >>> 0) >= this.arrowLife) {
        effects.arrowStart = time;
        effects.arrow.scene.reset(time);
      }
      effects.mount.visible = showArrow && this.pose(effects.mount, effects,
        Math.fround(effects.actor.logic.mainScale.z * Math.fround(1.31)));
      if (effects.mount.visible) effects.arrow.scene.update(time, camera, width, height);
    }

    for (let index = this.explosions.length - 1; index >= 0; index -= 1) {
      const explosion = this.explosions[index]!;
      if (((time - explosion.start) >>> 0) >= this.fireLife) {
        explosion.mount.removeFromParent();
        explosion.model.scene.dispose();
        this.explosions.splice(index, 1);
        continue;
      }
      explosion.mount.visible = this.pose(explosion.mount, explosion.actor, 0);
      explosion.model.scene.update(time, camera, width, height);
    }

    const status = (entry: ActorEffects) => {
      const pose = entry.actor.pose();
      return pose ? { id: entry.actor.id, main: entry.actor.logic.main, ...pose } : undefined;
    };
    const localStatus = status(local);
    if (localStatus) {
      const others = this.actors.filter(entry => entry !== local)
        .flatMap(entry => { const value = status(entry); return value ? [value] : []; });
      this.warning?.update(localStatus, others, visibility, camera);
    }
  }

  releaseTextures(): void {
    if (!this.disposed || this.pending !== 0) return;
    for (const texture of this.textures.values()) texture.dispose();
    this.textures.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.warning?.dispose();
    this.warning = undefined;
    for (const source of [...this.sources]) this.stop(source);
    this.threat = undefined;
    this.sounds.clear();
    for (const actor of this.actors) {
      actor.mount.removeFromParent();
      actor.arrow.scene.dispose();
      for (const model of actor.spare) model.scene.dispose();
      actor.spare.length = 0;
    }
    for (const explosion of this.explosions) {
      explosion.mount.removeFromParent();
      explosion.model.scene.dispose();
    }
    this.explosions.length = 0;
    this.actors.length = 0;
    this.releaseTextures();
  }
}
