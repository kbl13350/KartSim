/** Character motion selection driven by kart movement and collision events. */
export interface MotionFrame {
  finishMotion?: number;
  landingTrigger: boolean;
  collisionHit: boolean;
  collisionStrength: number;
  linkedPresentationMotion?: number;
  [key: string]: unknown;
}

export interface MotionSequence<Pose> {
  update(nowMs: number): Pose;
  reset(): void;
  root(): number;
  face(): number;
  acceptsMotion(state: number): boolean;
  isPending(): boolean;
  request(state: number): void;
}

export interface MotionControllerDependencies<Source, RawMotions, MappedMotions, Pose> {
  createSequence(source: Source, motions: MappedMotions, initialState: number): MotionSequence<Pose>;
  buildMotions(raw: RawMotions): MappedMotions;
  selectDrivingMotion(current: number, frame: MotionFrame, reverse: boolean): number;
}

/** CharacterAniType 0: road and crash animation controller. */
export class StandardMotionController<Source, RawMotions, MappedMotions, Pose> {
  sequence: MotionSequence<Pose>;
  reverse: boolean;
  currentState = 3;
  lastStrongCollisionMs = 0;
  #dependencies: MotionControllerDependencies<Source, RawMotions, MappedMotions, Pose>;

  constructor(
    source: Source,
    rawMotions: RawMotions,
    reverse: boolean = false,
    dependencies: MotionControllerDependencies<Source, RawMotions, MappedMotions, Pose>,
  ) {
    this.#dependencies = dependencies;
    this.sequence = dependencies.createSequence(source, dependencies.buildMotions(rawMotions), 3);
    this.reverse = reverse;
  }

  update(nowMs: number, frame?: MotionFrame): Pose {
    const now = nowMs >>> 0;
    if (frame?.finishMotion) this.submitMotion(frame.finishMotion);
    const selected = frame ? this.selectMotion(now, frame) : this.currentState;
    this.submitMotion(selected);
    return this.sequence.update(now);
  }

  reset(): void {
    this.currentState = 3;
    this.lastStrongCollisionMs = 0;
    this.sequence.reset();
  }

  root(): number { return this.sequence.root(); }
  face(): number { return this.sequence.face(); }

  selectMotion(nowMs: number, frame: MotionFrame): number {
    if (((nowMs - this.lastStrongCollisionMs) >>> 0) < 1000) return this.currentState;
    if (frame.landingTrigger) return 11;
    if (frame.collisionHit) {
      if (frame.collisionStrength <= 30) return frame.collisionStrength > 15 ? 11 : this.currentState;
      this.lastStrongCollisionMs = nowMs;
      return 10;
    }
    return this.#dependencies.selectDrivingMotion(this.currentState, frame, this.reverse);
  }

  submitMotion(state: number): void {
    if (state === this.currentState || !this.sequence.acceptsMotion(state)) return;
    this.currentState = state;
    this.sequence.request(state);
  }
}

export interface LinkedMotionDependencies<Source, RawMotions, MappedMotions, Pose> {
  createSequence(source: Source, motions: MappedMotions, initialState: number): MotionSequence<Pose>;
  buildMotions(raw: RawMotions): MappedMotions;
  selectDrivingMotion(current: number, frame: MotionFrame, reverse: boolean, alwaysLinked: boolean): number;
}

/** CharacterAniType 2: linked kart animation controller. */
export class LinkedMotionController<Source, RawMotions, MappedMotions, Pose> {
  sequence: MotionSequence<Pose>;
  reverse: boolean;
  alwaysLinked: boolean;
  currentState = 0;
  lastStrongCollisionMs = 0;
  #dependencies: LinkedMotionDependencies<Source, RawMotions, MappedMotions, Pose>;

  constructor(
    source: Source,
    rawMotions: RawMotions,
    reverse: boolean,
    alwaysLinked: boolean,
    dependencies: LinkedMotionDependencies<Source, RawMotions, MappedMotions, Pose>,
  ) {
    this.#dependencies = dependencies;
    this.sequence = dependencies.createSequence(source, dependencies.buildMotions(rawMotions), 0);
    this.reverse = reverse;
    this.alwaysLinked = alwaysLinked;
  }

  update(nowMs: number, frame?: MotionFrame): Pose {
    const now = nowMs >>> 0;
    if (frame?.finishMotion) this.submitMotion(frame.finishMotion);
    const selected = frame ? this.selectMotion(now, frame) : this.currentState;
    this.submitMotion(selected);
    return this.sequence.update(now);
  }

  reset(): void {
    this.currentState = 0;
    this.lastStrongCollisionMs = 0;
    this.sequence.reset();
  }

  face(): number { return this.sequence.face(); }

  selectMotion(nowMs: number, frame: MotionFrame): number {
    if (frame.linkedPresentationMotion) return frame.linkedPresentationMotion;
    if (((nowMs - this.lastStrongCollisionMs) >>> 0) < 1000) return this.currentState;
    if (frame.landingTrigger) return 11;
    if (frame.collisionHit) {
      if (frame.collisionStrength <= 30) return frame.collisionStrength > 15 ? 11 : this.currentState;
      this.lastStrongCollisionMs = nowMs;
      return 10;
    }
    return this.#dependencies.selectDrivingMotion(this.currentState, frame, this.reverse, this.alwaysLinked);
  }

  submitMotion(state: number): void {
    if (state === this.currentState) return;
    this.currentState = state;
    this.sequence.request(state);
  }
}

export interface MappedMotionDependencies<Source, RawMotions, MappedMotions, Pose> {
  createSequence(source: Source, motions: MappedMotions, initialState: number): MotionSequence<Pose>;
  buildMotions(raw: RawMotions): MappedMotions;
  selectDrivingMotion(current: number, frame: MotionFrame, reverse: boolean): number;
  mapState(state: number): number;
}

/** CharacterAniType 1: maps base movement states onto a reduced clip set. */
export class MappedMotionController<Source, RawMotions, MappedMotions, Pose> {
  sequence: MotionSequence<Pose>;
  reverse: boolean;
  baseState = 3;
  mappedState = 25;
  lastStrongCollisionMs = 0;
  #dependencies: MappedMotionDependencies<Source, RawMotions, MappedMotions, Pose>;

  constructor(
    source: Source,
    rawMotions: RawMotions,
    reverse: boolean = false,
    dependencies: MappedMotionDependencies<Source, RawMotions, MappedMotions, Pose>,
  ) {
    this.#dependencies = dependencies;
    this.sequence = dependencies.createSequence(source, dependencies.buildMotions(rawMotions), 25);
    this.reverse = reverse;
  }

  update(nowMs: number, frame?: MotionFrame): Pose {
    const now = nowMs >>> 0;
    if (frame?.finishMotion) this.submitMotion(frame.finishMotion);
    const selected = frame ? this.selectBaseMotion(now, frame) : this.baseState;
    this.submitMotion(selected);
    return this.sequence.update(now);
  }

  reset(): void {
    this.baseState = 3;
    this.mappedState = 25;
    this.lastStrongCollisionMs = 0;
    this.sequence.reset();
  }

  face(): number { return this.sequence.face(); }

  selectBaseMotion(nowMs: number, frame: MotionFrame): number {
    if (((nowMs - this.lastStrongCollisionMs) >>> 0) < 1000) return this.baseState;
    if (frame.landingTrigger) return 11;
    if (frame.collisionHit) {
      if (frame.collisionStrength <= 30) return frame.collisionStrength > 15 ? 11 : this.baseState;
      this.lastStrongCollisionMs = nowMs;
      return 10;
    }
    return this.#dependencies.selectDrivingMotion(this.baseState, frame, this.reverse);
  }

  submitMotion(state: number): void {
    const mapped = this.#dependencies.mapState(state);
    if (mapped === this.mappedState || !this.sequence.acceptsMotion(mapped)) return;
    this.baseState = state;
    this.mappedState = mapped;
    this.sequence.request(mapped);
  }
}
