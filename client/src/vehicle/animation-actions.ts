import type { MotionSequence } from "./animation-selectors";

export interface MotionPlan<Clip> {
  animation: Clip;
  enterBlendMs: number;
  returnBlendMs?: number;
  spanOverrideMs?: number;
}

export interface ActionMotionDependencies<Clip, Pose> {
  createSequence(source: Clip, motions: Map<number, MotionPlan<Clip>>, initialState: number): MotionSequence<Pose>;
  oneWay(clip: Clip, enterBlendMs: number): MotionPlan<Clip>;
  returnable(clip: Clip, enterBlendMs: number, returnBlendMs: number): MotionPlan<Clip>;
}

export interface GameplayMotion<Pose> {
  update(nowMs: number, frame?: unknown): Pose;
  face(): number;
  reset(): void;
}

/** Switches from live kart animations to a result or celebration sequence. */
export class ResultMotionController<Clip, Pose> {
  gameplay: GameplayMotion<Pose>;
  active = false;
  last: number | undefined;
  sequence: MotionSequence<Pose>;
  #dependencies: ActionMotionDependencies<Clip, Pose>;

  constructor(
    gameplay: GameplayMotion<Pose>,
    baseClip: Clip,
    clips: Record<number, Clip>,
    optionalClip: Clip | undefined,
    dependencies: ActionMotionDependencies<Clip, Pose>,
  ) {
    this.#dependencies = dependencies;
    this.gameplay = gameplay;
    const motions = new Map<number, MotionPlan<Clip>>([
      [20, dependencies.oneWay(baseClip, 250)],
      [3, dependencies.oneWay(clips[3]!, 250)],
      [4, dependencies.oneWay(clips[4]!, 400)],
      [5, dependencies.oneWay(clips[5]!, 400)],
      [12, {
        animation: clips[12]!, enterBlendMs: 250,
        returnBlendMs: 250, spanOverrideMs: 5000,
      }],
    ]);
    if (optionalClip) motions.set(13, {
      animation: optionalClip, enterBlendMs: 250,
      returnBlendMs: 250, spanOverrideMs: 5000,
    });
    this.sequence = dependencies.createSequence(baseClip, motions, 20);
  }

  enter(): void {
    this.sequence.reset();
    this.last = undefined;
    this.active = true;
  }

  enterResult(state: number): void {
    this.enter();
    this.sequence.request(state);
  }

  request(state: number): void {
    if (!this.active || this.last === state) return;
    if (!this.sequence.isPending()) this.sequence.request(state);
    this.last = state;
  }

  update(nowMs: number, frame?: unknown): Pose {
    return this.active ? this.sequence.update(nowMs) : this.gameplay.update(nowMs, frame);
  }

  face(): number { return this.active ? this.sequence.face() : this.gameplay.face(); }

  reset(): void {
    this.active = false;
    this.last = undefined;
    this.sequence.reset();
    this.gameplay.reset();
  }
}

/** One clip bound to one action code. */
export class SingleActionMotionController<Clip, Pose> {
  sequence: MotionSequence<Pose>;

  constructor(
    baseClip: Clip,
    actionClip: Clip,
    action: number,
    dependencies: ActionMotionDependencies<Clip, Pose>,
  ) {
    this.sequence = dependencies.createSequence(
      baseClip,
      new Map([[action, dependencies.oneWay(actionClip, 250)]]),
      action,
    );
  }

  update(nowMs: number): Pose { return this.sequence.update(nowMs); }
  reset(): void { this.sequence.reset(); }
  face(): number { return this.sequence.face(); }
}

/** Whitelist of kart animation actions with per-action return blends. */
export class ActionSetMotionController<Clip, Pose> {
  sequence: MotionSequence<Pose>;
  actions: Set<number>;

  constructor(
    baseClip: Clip,
    specialClip: Clip,
    extraClips: ReadonlyMap<number, Clip>,
    dependencies: ActionMotionDependencies<Clip, Pose>,
  ) {
    const motions = new Map<number, MotionPlan<Clip>>([
      [0, dependencies.oneWay(baseClip, 250)],
      [21, dependencies.returnable(specialClip, 250, 250)],
    ]);
    for (const [action, clip] of extraClips) {
      motions.set(action, dependencies.returnable(clip, 300, 300));
    }
    this.actions = new Set(motions.keys());
    this.sequence = dependencies.createSequence(baseClip, motions, 0);
  }

  request(state: number): void {
    if (this.actions.has(state) && this.sequence.acceptsMotion(state)) this.sequence.request(state);
  }

  update(nowMs: number): Pose { return this.sequence.update(nowMs); }
  reset(): void { this.sequence.reset(); }
  face(): number { return this.sequence.face(); }
}
