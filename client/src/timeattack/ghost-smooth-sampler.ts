/** Samples replay poses and smooths velocity for Ghost presentation. */

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface SmoothGhostFrame extends Vec3 {
  quaternion: unknown;
}

export interface SmoothGhostRecord {
  stamps: unknown[];
}

export interface GhostSmoothSamplerDependencies {
  sampleNative(record: SmoothGhostRecord, timeMs: number): SmoothGhostFrame;
  smoothVelocity(tail: Vec3, head: Vec3, prior: Vec3,
    elapsedMs: number): Vec3;
  magnitude(velocity: Vec3): number;
  float32(value: number): number;
  renderBasis(velocity: Vec3, speed: number, quaternion: unknown): unknown;
}

export class GhostSmoothSampler {
  readonly record: SmoothGhostRecord;
  lastTimeMs?: number;
  head?: Vec3;
  tail?: Vec3;
  velocity: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(record: SmoothGhostRecord,
    private readonly dependencies: GhostSmoothSamplerDependencies) {
    if (record.stamps.length === 0) {
      throw new Error("KSV 平滑采样记录没有任何帧。");
    }
    this.record = record;
  }

  sample(timeMs: number): {
    sample: SmoothGhostFrame;
    velocity: Vec3;
    speedKmh: number;
    renderBasisClient: unknown;
  } {
    const sample = this.dependencies.sampleNative(this.record, timeMs);
    this.tail = this.head;
    this.head = { x: sample.x, y: sample.y, z: sample.z };
    const elapsedMs = this.lastTimeMs === undefined
      ? 0 : timeMs - this.lastTimeMs;
    this.lastTimeMs = timeMs;
    if (elapsedMs > 0 && this.tail) {
      this.velocity = this.dependencies.smoothVelocity(
        this.tail, this.head, this.velocity, elapsedMs);
    }
    const speed = this.dependencies.magnitude(this.velocity);
    return {
      sample,
      velocity: this.velocity,
      speedKmh: this.dependencies.float32(speed * 3.6),
      renderBasisClient: this.dependencies.renderBasis(
        this.velocity, speed, sample.quaternion),
    };
  }
}
