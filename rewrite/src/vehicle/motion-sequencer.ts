/** Raw character animation before its channels have been prepared for sampling. */
export interface RawCharacterClip {
  root: { value: unknown };
}

export interface PreparedCharacterClip {
  root: unknown;
  sequence: {
    header: number[];
    rootChannel: { value: unknown };
  };
}

export interface CharacterSample {
  translation: number[];
  rotation: number[];
}

export interface CharacterMotionDefinition<Raw extends RawCharacterClip> {
  animation: Raw;
  enterBlendMs: number;
  returnBlendMs?: number;
  spanOverrideMs?: number;
}

export interface CharacterMotionOps<
  Raw extends RawCharacterClip,
  Clip extends PreparedCharacterClip,
  Sample extends CharacterSample,
> {
  prepare(rootValue: Raw["root"]["value"]): Clip;
  sample(clip: Clip, elapsedMs: number): { samples: Sample[]; pose: number[][]; root: number };
  cloneSample(sample: Sample): Sample;
  faceAt(clip: Clip, root: number): number;
  advanceSamples(clip: Clip, elapsedMs: number, output: Sample[]): void;
  writePose(pose: number[], rotation: number[], translation: number[]): void;
  resetClip(clip: Clip): void;
  sampleRoot(rootChannel: unknown, root: unknown, elapsedMs: number): number;
  float(value: number): number;
  blendSample(target: Sample, from: Sample, to: Sample, weight: number): void;
}

interface ReadyMotion<Clip> {
  clip: Clip;
  enterBlendMs: number;
  returnBlendMs?: number;
  spanOverrideMs?: number;
}

interface PendingReturn<Clip> {
  target: Clip;
  returnBlendMs: number;
  thresholdMs: number;
  startedAt?: number;
}

/** Blends between character motion clips and schedules their return animations. */
export class CharacterMotionSequencer<
  Raw extends RawCharacterClip,
  Clip extends PreparedCharacterClip,
  Sample extends CharacterSample,
> {
  #ops: CharacterMotionOps<Raw, Clip, Sample>;
  source: Clip;
  motions: Map<number, ReadyMotion<Clip>>;
  initialState: number;
  target: Clip;
  transitionSource: Sample[];
  transitionTarget: Sample[];
  outputSamples: Sample[];
  outputPose: number[][];
  blendMs: number;
  hasPreviousTime = false;
  previousAbsolute = 0;
  elapsed = 0;
  rootValue = 0;
  faceValue = 0;
  transitioned = false;
  pending: PendingReturn<Clip> | undefined;

  constructor(
    rawSource: Raw,
    rawMotions: ReadonlyMap<number, CharacterMotionDefinition<Raw>>,
    initialState: number,
    ops: CharacterMotionOps<Raw, Clip, Sample>,
  ) {
    this.#ops = ops;
    const preparedByRoot = new Map<unknown, Clip>();
    const prepare = (raw: Raw): Clip => {
      const key = raw.root.value;
      const cached = preparedByRoot.get(key);
      if (cached) return cached;
      const clip = ops.prepare(key);
      preparedByRoot.set(key, clip);
      return clip;
    };
    this.source = prepare(rawSource);
    this.motions = new Map([...rawMotions].map(([state, motion]) => [
      state,
      {
        clip: prepare(motion.animation),
        enterBlendMs: motion.enterBlendMs,
        returnBlendMs: motion.returnBlendMs,
        spanOverrideMs: motion.spanOverrideMs,
      },
    ]));
    this.initialState = initialState;
    const initialMotion = this.motion(initialState);
    this.target = initialMotion.clip;
    this.blendMs = initialMotion.enterBlendMs;
    const sourceAtStart = ops.sample(this.source, 0);
    const targetAtStart = ops.sample(this.target, 0);
    this.transitionSource = sourceAtStart.samples;
    this.transitionTarget = targetAtStart.samples;
    this.outputSamples = sourceAtStart.samples.map(sample => ops.cloneSample(sample));
    this.outputPose = sourceAtStart.pose.map(pose => [...pose]);
    this.rootValue = targetAtStart.root;
    this.faceValue = ops.faceAt(this.target, targetAtStart.root);
  }

  request(state: number): void {
    const motion = this.motion(state);
    this.armReturn(motion);
    this.beginTarget(motion);
  }

  acceptsMotion(state: number): boolean {
    return !this.pending || this.motion(state).returnBlendMs !== undefined;
  }

  isPending(): boolean {
    return this.pending !== undefined;
  }

  update(absoluteMs: number): number[][] {
    const now = absoluteMs >>> 0;
    this.updatePending(now);
    const frameMs = !this.hasPreviousTime || this.transitioned
      ? 1 : (now - this.previousAbsolute) >>> 0;
    this.elapsed = (this.elapsed + frameMs) >>> 0;
    this.previousAbsolute = now;
    this.hasPreviousTime = true;
    this.transitioned = false;
    if (this.elapsed <= this.blendMs) return this.evaluateBlend();

    const clipElapsedMs = (this.elapsed - this.blendMs) >>> 0;
    this.#ops.advanceSamples(this.target, clipElapsedMs, this.outputSamples);
    for (let index = 0; index < this.outputSamples.length; index += 1) {
      const sample = this.outputSamples[index]!;
      this.#ops.writePose(this.outputPose[index]!, sample.rotation, sample.translation);
    }
    const root = this.#ops.sampleRoot(this.target.sequence.rootChannel.value, this.target.root, clipElapsedMs);
    this.rootValue = root;
    this.faceValue = this.#ops.faceAt(this.target, root);
    return this.outputPose;
  }

  reset(): void {
    this.#ops.resetClip(this.source);
    new Set([...this.motions.values()].map(motion => motion.clip)).forEach(clip => this.#ops.resetClip(clip));
    const sourceAtStart = this.#ops.sample(this.source, 0);
    const initialMotion = this.motion(this.initialState);
    this.target = initialMotion.clip;
    this.#ops.resetClip(this.target);
    const targetAtStart = this.#ops.sample(this.target, 0);
    this.transitionSource = sourceAtStart.samples;
    this.transitionTarget = targetAtStart.samples;
    this.outputSamples = sourceAtStart.samples.map(sample => this.#ops.cloneSample(sample));
    for (let index = 0; index < this.outputSamples.length; index += 1) {
      const sample = this.outputSamples[index]!;
      this.#ops.writePose(this.outputPose[index]!, sample.rotation, sample.translation);
    }
    this.blendMs = initialMotion.enterBlendMs;
    this.hasPreviousTime = false;
    this.previousAbsolute = 0;
    this.elapsed = 0;
    this.rootValue = targetAtStart.root;
    this.faceValue = this.#ops.faceAt(this.target, targetAtStart.root);
    this.transitioned = false;
    this.pending = undefined;
  }

  root(): number { return this.rootValue; }
  face(): number { return this.faceValue; }

  motion(state: number): ReadyMotion<Clip> {
    const motion = this.motions.get(state);
    if (!motion) throw new Error(`人物状态 ${state} 缺少已闭合动作。`);
    return motion;
  }

  armReturn(motion: ReadyMotion<Clip>): void {
    if (motion.returnBlendMs === undefined) {
      this.pending = undefined;
      return;
    }
    const span = motion.spanOverrideMs ?? motion.clip.sequence.header[2]!;
    if (!this.pending) {
      this.pending = {
        target: this.target,
        returnBlendMs: motion.returnBlendMs,
        thresholdMs: (motion.enterBlendMs + span) >>> 0,
      };
      return;
    }
    this.pending.thresholdMs = (motion.enterBlendMs + span) >>> 0;
    this.pending.startedAt = undefined;
  }

  beginTarget(motion: ReadyMotion<Clip>): void {
    this.transitionSource = this.outputSamples.map(sample => this.#ops.cloneSample(sample));
    this.target = motion.clip;
    this.#ops.resetClip(this.target);
    const targetAtStart = this.#ops.sample(this.target, 0);
    this.transitionTarget = targetAtStart.samples;
    this.rootValue = targetAtStart.root;
    this.faceValue = this.#ops.faceAt(this.target, targetAtStart.root);
    this.blendMs = motion.enterBlendMs;
    this.elapsed = 0;
    this.transitioned = true;
  }

  updatePending(nowMs: number): void {
    const pending = this.pending;
    if (!pending) return;
    if (pending.startedAt === undefined) {
      pending.startedAt = nowMs;
      return;
    }
    if (((nowMs - pending.startedAt) >>> 0) < pending.thresholdMs) return;
    this.pending = undefined;
    this.beginTarget({ clip: pending.target, enterBlendMs: pending.returnBlendMs });
  }

  evaluateBlend(): number[][] {
    const weight = this.blendMs === 0 ? 1 : this.#ops.float(this.elapsed / this.blendMs);
    for (let index = 0; index < 24; index += 1) {
      const sample = this.outputSamples[index]!;
      this.#ops.blendSample(sample, this.transitionSource[index]!, this.transitionTarget[index]!, weight);
      this.#ops.writePose(this.outputPose[index]!, sample.rotation, sample.translation);
    }
    return this.outputPose;
  }
}
