const RACE_MOTION_IDS = [0, 1, 21, 20, 8, 6, 5, 7];

function setLocalPosition(object: any, position: readonly number[]): void {
  object.matrixAutoUpdate = false;
  object.matrix.elements[12] = position[0];
  object.matrix.elements[13] = position[1];
  object.matrix.elements[14] = position[2];
  object.matrixWorldNeedsUpdate = true;
}

export interface FlyingPetPresentationDependencies {
  loadPetAsset(library: unknown, itemId: unknown): Promise<any>;
  createSkinResources(asset: any, primary: unknown, high: unknown): any;
  createAnimation(sequence: any): any;
  loadModel(model: unknown, sequences: any[], skin: any,
    environment: unknown, binding: unknown): Promise<any>;
  createIdleMotion(clips: Map<number, any>, animation: any, random: unknown): any;
  loadEffect(library: unknown, name: string,
    environment: unknown, binding: unknown): Promise<any>;
  loadAudio(asset: any, audioContext: unknown): Promise<any>;
  createRaceState(): any;
  isVisible(role: unknown, localVisible: boolean): boolean;
  createRotationMatrix(): any;
  renderNested(object: unknown, render: () => void): void;
}

/** Owns the flying pet's animations, models, sounds, and optional head effect. */
export class FlyingPetPresentation {
  readonly resources: { dispose(): void }[] = [];
  first: any;
  firstAnimation: any;
  second: any;
  secondAnimation: any;
  fired: any;
  alive: any;
  readonly headEffects: any[] = [];
  idle: any;
  audio: any;
  state: any;
  initial: any;
  equipped: any;
  firedStart: number | undefined;
  aliveStart: number | undefined;
  private previewPrevious: number | undefined;
  disposed = false;

  constructor(readonly race: any, readonly dependencies: FlyingPetPresentationDependencies) {}

  get object(): any { return this.first.object; }

  async loadPreview(options: any, atOrigin = false): Promise<this> {
    const ops = this.dependencies;
    try {
      const asset = await ops.loadPetAsset(options.library, options.item.internalId);
      const skin = ops.createSkinResources(asset, options.colors.primary, options.colors.high);
      this.resources.push(skin);
      const clips = new Map<number, any>();
      for (const motion of options.animate ? RACE_MOTION_IDS : [8])
        clips.set(motion, (await asset.clip(false, motion)).sequence);
      this.initial = clips.get(8);
      this.firstAnimation = ops.createAnimation(this.initial);
      this.first = await ops.loadModel(await asset.model(), [...clips.values()], skin,
        options.environment, options.binding);
      this.resources.push(this.first);
      if (options.animate) this.idle = ops.createIdleMotion(clips, this.firstAnimation,
        options.random ?? { next: () => Math.floor(Math.random() * 0x100000000) >>> 0 });
      setLocalPosition(this.first.object, atOrigin ? [0, 0, 0]
        : options.previewPosition ?? [0.75, -0.75, 0.5]);
      if (options.item.tuneGroupId) await this.attachHeadEffect(options, this.first);
      return this;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  async loadRace(options: any): Promise<this> {
    const ops = this.dependencies;
    try {
      const asset = await ops.loadPetAsset(options.library, options.item.internalId);
      const skin = ops.createSkinResources(asset, options.colors.primary, options.colors.high);
      this.resources.push(skin);
      const clips = new Map<number, any>();
      for (const motion of RACE_MOTION_IDS)
        clips.set(motion, (await asset.clip(false, motion)).sequence);
      this.initial = clips.get(0);
      this.equipped = (await asset.clip(true, 40)).sequence;
      this.firstAnimation = ops.createAnimation(this.initial);
      this.secondAnimation = ops.createAnimation(this.equipped);
      this.first = await ops.loadModel(await asset.model(), [...clips.values()], skin,
        options.environment, options.binding);
      this.resources.push(this.first);
      this.second = await ops.loadModel(await asset.model(true), [this.equipped], skin,
        options.environment, options.binding);
      this.resources.push(this.second);
      this.idle = ops.createIdleMotion(clips, this.firstAnimation, options.random);
      this.fired = await ops.loadEffect(options.library, "firedFx",
        options.environment, options.binding);
      this.resources.push(this.fired);
      this.alive = await ops.loadEffect(options.library, "aliveFx",
        options.environment, options.binding);
      this.resources.push(this.alive);
      this.audio = await ops.loadAudio(asset, options.audioContext);
      this.resources.push(this.audio);
      if (options.item.tuneGroupId) await this.attachHeadEffect(options, this.second);
      this.reset();
      const unsubscribe = options.listen?.((visible: boolean) =>
        visible ? this.state?.enable() : this.state?.disable());
      if (unsubscribe) this.resources.push({ dispose: unsubscribe });
      return this;
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  mount(parent: { add(...objects: unknown[]): void }): void {
    parent.add(this.first.object);
    if (this.second) parent.add(this.second.object);
    if (this.fired) parent.add(this.fired.object);
    if (this.alive) parent.add(this.alive.object);
  }

  launch(): void { this.state?.launch(); }

  reset(): void {
    this.firstAnimation.reset(this.initial);
    if (!this.race) {
      this.idle?.reset();
      this.previewPrevious = undefined;
      return;
    }
    this.state = this.dependencies.createRaceState();
    this.secondAnimation = this.dependencies.createAnimation(this.equipped);
    this.idle?.reset();
    this.firedStart = this.aliveStart = undefined;
    setLocalPosition(this.first.object, this.state.local);
    setLocalPosition(this.second.object, this.state.secondLocal);
    this.first.object.visible = false;
    this.second.object.visible = this.fired.object.visible = this.alive.object.visible = false;
  }

  update(time: number, camera: unknown, width: number, height: number, localVisible = true): void {
    if (this.disposed) return;
    if (!this.race && this.idle) {
      const now = time >>> 0;
      this.idle.update(this.previewPrevious === undefined ? 0 : (now - this.previewPrevious) >>> 0);
      this.previewPrevious = now;
    }
    const visible = !this.race || this.dependencies.isVisible(this.race.role, localVisible);
    if (this.state) {
      this.first.object.updateWorldMatrix(true, false);
      const pose = this.dependencies.createRotationMatrix()
        .makeRotationX(Math.PI / 2).multiply(this.first.object.matrixWorld);
      if (this.state.update(time, pose.elements, this.race.grandparentScale,
        (elapsed: number) => this.idle.update(elapsed)) && visible) {
        this.audio?.playAlive();
      }
      setLocalPosition(this.first.object, this.state.local);
      setLocalPosition(this.second.object, this.state.secondLocal);
      this.first.object.visible = visible && this.state.firstVisible;
      this.second.object.visible = visible && this.state.secondVisible;
      this.fired.object.visible = visible && this.state.firedVisible;
      this.alive.object.visible = visible && this.state.aliveVisible;
      if (this.state.firedVisible && this.firedStart !== this.state.firedStart) {
        this.firedStart = this.state.firedStart;
        setLocalPosition(this.fired.object, this.state.local);
        this.fired.setControllerCycleMode?.(2);
        this.fired.reset(this.firedStart);
      }
      if (this.state.aliveVisible && this.aliveStart !== this.state.aliveStart) {
        this.aliveStart = this.state.aliveStart;
        setLocalPosition(this.alive.object, this.state.local);
        this.alive.setControllerCycleMode?.(2);
        this.alive.reset(this.aliveStart);
      }
      this.second.update(this.secondAnimation, camera, width, height, time);
      if (this.state.firedVisible) this.fired.update(time, camera, width, height);
      if (this.state.aliveVisible) this.alive.update(time, camera, width, height);
    }
    this.first.update(this.firstAnimation, camera, width, height, time);
    for (const effect of this.headEffects)
      this.dependencies.renderNested(effect.object,
        () => effect.update(time, camera, width, height));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources.reverse()) resource.dispose();
    this.resources.length = 0;
  }

  async attachHeadEffect(options: any, model: any): Promise<void> {
    if (!model.headSocket) return;
    const effect = await this.dependencies.loadEffect(options.library, "effect",
      options.environment, options.binding);
    this.resources.push(effect);
    this.headEffects.push(effect);
    model.headSocket.add(effect.object);
  }
}
