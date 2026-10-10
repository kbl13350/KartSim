/** The three client axes used by the giant/flattened kart presentation. */
export interface Scale3 { x: number; y: number; z: number }

export interface GiantPacket { main: number; extra: number; status: number }
export type GiantVisual =
  | { kind: "press" | "reset" | "scale"; atMs: number }
  | { kind: "stage"; cells: number; atMs: number };

const f32 = Math.fround;
const unitScale = (): Scale3 => ({ x: 1, y: 1, z: 1 });
const stageScale = [1, 1.5, f32(2.1), f32(2.8), f32(4.4)];
const growTimes = [0, 400, 500, 600, 700, 800, 850, 900, 950];
const growCurve = [
  [1, 1, 1], [7, 7, 7], [9, 7, 5], [5, 7, 9],
  [8, 7, 6], [6, 7, 8], [7.5, 7, 6.5], [7, 7, 7],
];
const restoreCurve: Scale3[] = [
  [0.9, 0.9, 1.4], [1.4, 1, 0.6], [0.7, 1, 1.3],
  [1.1, 1, 0.9], [0.8, 1, 1.2], [1.2, 1, 0.8], [1.2, 1.2, 1.2],
].map(([x, y, z]) => ({ x: f32(x!), y: f32(y!), z: f32(z!) }));

/** Interpolation preserves the release's float32 operations and endpoint copies. */
function interpolateScale(nodes: readonly Scale3[], times: readonly number[], elapsed: number): Scale3 {
  const next = times.findIndex((time) => time > elapsed);
  if (next < 0) return { ...nodes[nodes.length - 1]! };
  if (next === 0) return { ...nodes[0]! };
  const previous = next - 1;
  const ratio = f32((elapsed - times[previous]!) / (times[next]! - times[previous]!));
  const remaining = f32(1 - ratio);
  const value = (axis: keyof Scale3) =>
    f32(f32(nodes[previous]![axis] * remaining) + f32(nodes[next]![axis] * ratio));
  return { x: value("x"), y: value("y"), z: value("z") };
}

/** Local and remote giant-kart stage, squash, and visual event state. */
export class GiantKartEffect {
  main = 0;
  extra = 0;
  stamp = 0;
  mainScale = unitScale();
  cameraScale = unitScale();
  flatten = unitScale();
  frozen = false;
  sizePending = false;
  sizeAnchor = 0;
  sizeNodes: Scale3[] = [];
  sizeStart = unitScale();
  target = 1;
  pressDuration = 0;
  pressStart = 0;
  restoreRequested = false;
  restoreAnchor: number | undefined;
  resets: { start: number; latched: boolean }[] = [];
  packets: GiantPacket[] = [];
  visuals: GiantVisual[] = [];
  released = false;
  behind = false;
  publishedScale = unitScale();
  drivingActive = false;

  constructor(public local: boolean, public compensate?: () => void) {}

  get cells(): number { return this.main + this.extra; }

  get flattened(): boolean {
    return this.flatten.y !== f32(0.2) &&
      this.flatten.x !== f32(0.2) && this.flatten.z === f32(0.2);
  }

  get forceBonus(): number { return this.behind ? this.main * 500 : 0; }

  setRank(rank: number | undefined): void { this.behind = rank !== undefined && rank > 0; }
  setDrivingActive(active: boolean): void { this.drivingActive = active; }
  nativeFlattenWritten(scale: Scale3): void { this.flatten = { ...scale }; }
  nativeRestoreRequested(): void { this.restoreRequested = true; }

  nativeFlattenMode(mode: number): void {
    if (this.released) return;
    if (mode === 0) {
      if ([this.flatten.x, this.flatten.y, this.flatten.z].includes(f32(0.2)))
        this.restoreRequested = true;
      return;
    }
    const expanded = f32(1 + f32(0.2));
    const compressed = f32(0.2);
    this.nativeFlattenWritten({
      x: mode === 2 ? compressed : expanded,
      y: mode === 3 ? compressed : expanded,
      z: mode === 1 ? compressed : expanded,
    });
  }

  gate(timestampMs: number, collisionKind: number): boolean {
    return !!(this.local && this.drivingActive && !this.released &&
      !(this.main === 4 && collisionKind === 1) &&
      (this.stamp === 0 || ((timestampMs - this.stamp) >>> 0) >= 800));
  }

  processWallCollision(timestampMs: number, collisionCode: number, suppressed = false): void {
    if (this.gate(timestampMs, [1, 2, 3, 7, 8, 11].includes(collisionCode) ? 1 : 0) &&
        !suppressed) this.grow(timestampMs);
  }

  processKartContact(other: GiantKartEffect, otherValue: number, ownValue: number,
    timestampMs: number, suppressed = false): void {
    if (!this.gate(timestampMs, 0)) return;
    if (otherValue > ownValue && this.main === 4 && this.main > other.main) {
      this.stamp = timestampMs >>> 0;
      if (suppressed) return;
      other.pressVisual();
      this.visuals.push({ kind: "press", atMs: timestampMs });
    } else if (ownValue > otherValue && other.main === 4 && other.main > this.main) {
      this.stamp = timestampMs >>> 0;
      if (suppressed) return;
      this.pressTimed();
      this.visuals.push({ kind: "press", atMs: timestampMs });
      this.packets.push({ main: this.main, extra: this.extra, status: 1 });
    } else if (!suppressed) {
      this.grow(timestampMs);
    }
  }

  grow(timestampMs: number): void {
    const cells = (this.cells + 1) % 7;
    this.main = Math.min(cells, 4);
    this.extra = Math.max(0, cells - 4);
    this.stamp = timestampMs >>> 0;
    this.applyStage(timestampMs);
    this.packets.push({ main: this.main, extra: this.extra, status: 0 });
    this.visuals.push({ kind: "stage", cells: this.cells, atMs: timestampMs });
  }

  applyStage(timestampMs: number): void {
    if (this.extra !== 0) return;
    if (this.main === 0) {
      this.resets.push({ start: timestampMs >>> 0, latched: this.local });
      if (this.local) { this.frozen = true; this.compensate?.(); }
      this.visuals.push({ kind: "reset", atMs: timestampMs });
    } else {
      this.visuals.push({ kind: "scale", atMs: timestampMs });
    }
    this.target = stageScale[this.main]!;
    this.sizeAnchor = 0;
    this.sizeNodes = [];
    this.sizePending = true;
  }

  receive(packet: GiantPacket, timestampMs: number): void {
    if (this.released || this.local) return;
    if (packet.status === 1) this.pressTimed();
    else {
      this.main = packet.main;
      this.extra = packet.extra;
      this.applyStage(timestampMs);
    }
  }

  pressVisual(): void {
    this.flatten = {
      x: f32(1 + f32(0.2)), y: f32(1 + f32(0.2)), z: f32(0.2),
    };
  }

  pressTimed(): void {
    this.pressVisual();
    this.pressDuration = 500;
    this.pressStart = 0;
    if (this.local) this.frozen = true;
  }

  updateVehicle(timestampMs: number, apply: (main: Scale3, camera: Scale3, flatten: Scale3) => void): void {
    if (this.released) return;
    timestampMs = Math.trunc(timestampMs) >>> 0;
    if (this.restoreRequested) {
      if (this.restoreAnchor === undefined) this.restoreAnchor = timestampMs;
      this.flatten = interpolateScale(restoreCurve, [0, 100, 200, 300, 400, 500, 600],
        timestampMs < this.restoreAnchor ? 0 : timestampMs - this.restoreAnchor);
      if (this.flatten.x >= 1 && this.flatten.y >= 1 && this.flatten.z >= 1) {
        this.flatten = unitScale();
        this.restoreRequested = false;
        this.restoreAnchor = undefined;
      }
    }
    if (this.sizePending) {
      if (this.sizeAnchor === 0) {
        this.sizeAnchor = timestampMs;
        this.sizeStart = { ...this.mainScale };
        this.cameraScale = { ...this.sizeStart };
        const point = (curve: number[]): Scale3 => {
          const axis = (key: keyof Scale3, index: number) => {
            const increment = f32(f32(this.target - this.sizeStart[key]) / 7);
            return f32(this.sizeStart[key] + increment * curve[index]!);
          };
          return { x: axis("x", 0), y: axis("y", 1), z: axis("z", 2) };
        };
        this.sizeNodes = [...growCurve.map(point),
          { x: this.target, y: this.target, z: this.target }];
      }
      const elapsedUnsigned = (timestampMs - this.sizeAnchor) >>> 0;
      const elapsed = timestampMs < this.sizeAnchor ? 0 : timestampMs - this.sizeAnchor;
      this.mainScale = interpolateScale(this.sizeNodes, growTimes, elapsed);
      this.cameraScale = interpolateScale([
        this.sizeStart, { x: this.target, y: this.target, z: this.target },
      ], [0, 600], elapsed);
      if (elapsedUnsigned > 950) {
        this.mainScale = { x: this.target, y: this.target, z: this.target };
        this.cameraScale = { ...this.mainScale };
        this.sizePending = false;
        this.sizeAnchor = 0;
      }
    }
    apply(this.mainScale, this.cameraScale, this.flatten);
    this.publishedScale = {
      x: f32(this.flatten.x * this.mainScale.x),
      y: f32(this.flatten.z * this.mainScale.z),
      z: f32(this.flatten.y * this.mainScale.y),
    };
    if (this.pressDuration > 0) {
      if (this.pressStart === 0) this.pressStart = timestampMs;
      if (((timestampMs - this.pressStart) >>> 0) > this.pressDuration) {
        if ([this.flatten.x, this.flatten.y, this.flatten.z].includes(f32(0.2)))
          this.restoreRequested = true;
        this.pressDuration = 0;
        this.pressStart = 0;
        if (this.local) this.frozen = false;
      }
    }
  }

  updateEffects(timestampMs: number): void {
    for (const reset of this.resets) {
      if (reset.latched && ((timestampMs - reset.start) >>> 0) > 100) {
        this.frozen = false;
        reset.latched = false;
      }
    }
    for (let index = this.resets.length - 1; index >= 0; index--) {
      if (((timestampMs - this.resets[index]!.start) >>> 0) >= 1000)
        this.resets.splice(index, 1);
    }
  }

  visualScale(): Scale3 { return { ...this.publishedScale }; }
  consumePackets(): GiantPacket[] { return this.packets.splice(0); }
  consumeVisuals(): GiantVisual[] { return this.visuals.splice(0); }

  reset(): void {
    this.main = 0;
    this.extra = 0;
    this.stamp = 0;
    this.mainScale = unitScale();
    this.cameraScale = unitScale();
    this.flatten = unitScale();
    this.frozen = false;
    this.publishedScale = unitScale();
    this.sizePending = false;
    this.sizeAnchor = 0;
    this.sizeNodes = [];
    this.target = 1;
    this.pressDuration = 0;
    this.pressStart = 0;
    this.restoreRequested = false;
    this.restoreAnchor = undefined;
    this.resets.length = 0;
    this.packets.length = 0;
    this.visuals.length = 0;
    this.behind = false;
    this.drivingActive = false;
  }

  dispose(): void { this.reset(); this.released = true; }
}
