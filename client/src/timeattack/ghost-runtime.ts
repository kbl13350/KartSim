/** Playback, recording, and route progress for solo-race Ghosts. */

export interface PlaybackStamp {
  time: number;
  [key: string]: unknown;
}

export interface GhostPlaybackRecord {
  stamps: PlaybackStamp[];
}

export type GhostPlaybackMode = "c1" | "c2" | "native-smooth" | string;

export interface GhostPlaybackDependencies<Sample = unknown> {
  decodeRouteStamp(stamp: PlaybackStamp): GhostRouteStamp;
  sampleC1(record: GhostPlaybackRecord, elapsedMs: number): Sample;
  sampleC2(record: GhostPlaybackRecord, elapsedMs: number): Sample;
  sampleNative(record: GhostPlaybackRecord, elapsedMs: number): Sample;
  createSmoothSampler(record: GhostPlaybackRecord): {
    sample(elapsedMs: number): Sample;
  };
}

export interface GhostRouteStamp {
  x: number;
  y: number;
  z: number;
}

export class GhostPlayback<Sample = unknown> {
  readonly record: GhostPlaybackRecord;
  readonly lastTimeMs: number;
  readonly mode: () => GhostPlaybackMode;
  smooth?: { sample(elapsedMs: number): Sample };

  constructor(record: GhostPlaybackRecord, mode: () => GhostPlaybackMode,
    private readonly dependencies: GhostPlaybackDependencies<Sample>) {
    if (record.stamps.length === 0) {
      throw new Error("KSV playback 记录没有任何帧。");
    }
    this.record = record;
    this.lastTimeMs = record.stamps[record.stamps.length - 1]!.time * 100;
    this.mode = mode;
  }

  get durationMs(): number {
    return this.lastTimeMs;
  }

  /** Visit stamps after the old time, up to and including the new time. */
  visitRouteStamps(fromMs: number, toMs: number,
    visit: (stamp: GhostRouteStamp) => void): void {
    const stamps = this.record.stamps;
    let lower = 0;
    let upper = stamps.length;
    while (lower < upper) {
      const middle = (lower + upper) >>> 1;
      if (stamps[middle]!.time * 100 <= fromMs) lower = middle + 1;
      else upper = middle;
    }
    for (let index = lower;
      index < stamps.length && stamps[index]!.time * 100 <= toMs;
      index += 1) {
      visit(this.dependencies.decodeRouteStamp(stamps[index]!));
    }
  }

  sample(elapsedMs: number): Sample {
    switch (this.mode()) {
      case "c1": return this.dependencies.sampleC1(this.record, elapsedMs);
      case "c2": return this.dependencies.sampleC2(this.record, elapsedMs);
      case "native-smooth":
        return (this.smooth ??= this.dependencies.createSmoothSampler(this.record))
          .sample(elapsedMs);
      default: return this.dependencies.sampleNative(this.record, elapsedMs);
    }
  }
}

export interface GhostSampleStream<Frame = unknown, Recording = unknown> {
  begin(frame: Frame): unknown;
  update(frame: Frame): unknown;
  finish(): Recording;
  finishRuntime(): unknown;
}

export interface GhostRuntimePose {
  timeMs: number;
  status?: unknown;
  [key: string]: unknown;
}

export interface GhostPoseRecorderDependencies<Pose extends GhostRuntimePose, Stamp> {
  interpolatePose(previous: Pose, current: Pose, fraction: number): Pose;
  encodeStamp(pose: Pose, zCeiling: number): Stamp;
}

/** Record at 100 ms grid points, with the release's float32 interpolation. */
export class GhostPoseRecorder<Pose extends GhostRuntimePose, Stamp> {
  readonly zCeiling: number;
  readonly runtimeStamps: Pose[] = [];
  started = false;
  stopped = false;
  baseTime = 0;
  nextGrid = 0;
  previousTime = 0;
  previous?: Pose;

  constructor(zCeiling: number,
    private readonly dependencies: GhostPoseRecorderDependencies<Pose, Stamp>) {
    this.zCeiling = zCeiling;
  }

  begin(pose: Pose): void {
    this.runtimeStamps.push({ ...pose, timeMs: 0, status: 0 });
  }

  update(pose: Pose): boolean {
    if (this.stopped) return false;
    if (!this.started) {
      this.started = true;
      this.baseTime = pose.timeMs;
      this.nextGrid = pose.timeMs;
      this.previousTime = pose.timeMs;
      this.previous = pose;
      this.runtimeStamps.push({ ...pose, timeMs: 0 });
      return true;
    }
    if (pose.timeMs - this.baseTime >= 600_000) {
      this.stopped = true;
      return false;
    }
    if (pose.timeMs - this.nextGrid < 100) {
      this.previousTime = pose.timeMs;
      this.previous = pose;
      return false;
    }

    const gridAdvance = Math.floor((pose.timeMs - this.nextGrid) / 100) * 100;
    this.nextGrid += gridAdvance;
    const previous = this.previous;
    if (!previous) throw new Error("KSV recorder missing previous pose");
    const interval = pose.timeMs - this.previousTime;
    const fraction = interval <= 0 ? 1 : Math.fround(
      Math.fround(this.nextGrid - this.previousTime) / Math.fround(interval),
    );
    const interpolated = this.dependencies.interpolatePose(previous, pose, fraction);
    this.runtimeStamps.push({ ...interpolated, timeMs: this.nextGrid - this.baseTime });
    this.previousTime = this.nextGrid;
    return true;
  }

  finish(): { stamps: Stamp[] } {
    return { stamps: this.runtimeStamps.map(pose =>
      this.dependencies.encodeStamp(pose, this.zCeiling)) };
  }

  finishRuntime(): Pose[] {
    return this.runtimeStamps.slice();
  }
}

/** The participant stream delegates to its pose sampler. */
export class GhostParticipantStream<Pose, Recording> implements GhostSampleStream<Pose, Recording> {
  constructor(readonly sampler: GhostSampleStream<Pose, Recording>) {}

  begin(pose: Pose): void { this.sampler.begin(pose); }
  update(pose: Pose): unknown { return this.sampler.update(pose); }
  finish(): Recording { return this.sampler.finish(); }
  finishRuntime(): unknown { return this.sampler.finishRuntime(); }
}

export interface GhostParticipant<Frame = unknown> {
  equipment: unknown;
  startSlot: unknown;
  sample(elapsedMs: number): Frame;
  [key: string]: unknown;
}

export class GhostRecorder<Frame = unknown, Recording = unknown> {
  readonly zCeiling: number;
  readonly participants: Array<GhostParticipant<Frame> & {
    stream: GhostSampleStream<Frame, Recording>;
  }> = [];

  constructor(zCeiling: number,
    private readonly createStream: (zCeiling: number) => GhostSampleStream<Frame, Recording>) {
    this.zCeiling = zCeiling;
  }

  get count(): number {
    return this.participants.length;
  }

  addParticipant(participant: GhostParticipant<Frame>): void {
    const stream = this.createStream(this.zCeiling);
    stream.begin(participant.sample(0));
    this.participants.push({ ...participant, stream });
  }

  update(elapsedMs: number): void {
    for (const participant of this.participants) {
      participant.stream.update(participant.sample(elapsedMs));
    }
  }

  finish(): Array<{
    equipment: unknown;
    startSlot: unknown;
    record: Recording;
    runtimeStamps: unknown;
  }> {
    return this.participants.map(participant => ({
      equipment: participant.equipment,
      startSlot: participant.startSlot,
      record: participant.stream.finish(),
      runtimeStamps: participant.stream.finishRuntime(),
    }));
  }

  reset(): void {
    this.participants.length = 0;
  }
}

export interface GhostRouteTrack<Owner extends object> {
  resetRouteState(owner: Owner, position: GhostRouteStamp): unknown;
  updateRoute(owner: Owner, previous: GhostRouteStamp, next: GhostRouteStamp): unknown;
  getRouteState(owner: Owner): { distance: number };
}

interface GhostRouteHistory {
  start: GhostRouteStamp;
  previous: GhostRouteStamp;
  elapsedMs: number;
}

export class GhostRouteProgress<Owner extends object> {
  readonly owners = new WeakMap<Owner, GhostRouteHistory>();

  constructor(readonly track: GhostRouteTrack<Owner>) {}

  seed(owner: Owner, position: GhostRouteStamp): void {
    this.track.resetRouteState(owner, position);
    this.owners.set(owner, {
      start: { ...position },
      previous: { ...position },
      elapsedMs: -Infinity,
    });
  }

  update(owner: Owner, playback: Pick<GhostPlayback, "visitRouteStamps">,
    elapsedMs: number, position: GhostRouteStamp): void {
    let history = this.owners.get(owner);
    if (!history) throw new Error("Ghost route owner must be seeded at race start.");
    if (elapsedMs < history.elapsedMs) {
      this.seed(owner, history.start);
      history = this.owners.get(owner)!;
    }
    if (elapsedMs === history.elapsedMs) return;

    const advance = (next: GhostRouteStamp): void => {
      if (next.x === history.previous.x && next.y === history.previous.y &&
        next.z === history.previous.z) return;
      this.track.updateRoute(owner, history.previous, next);
      history.previous = { ...next };
    };
    playback.visitRouteStamps(history.elapsedMs, elapsedMs, stamp => {
      advance({ x: stamp.x, y: stamp.z, z: Math.fround(-stamp.y) });
    });
    advance(position);
    history.elapsedMs = elapsedMs;
  }

  distance(owner: Owner): number {
    if (!this.owners.has(owner)) {
      throw new Error("Ghost route owner has no race history.");
    }
    return this.track.getRouteState(owner).distance;
  }
}
