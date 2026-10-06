/** Converts an input clock to the game's unsigned millisecond range. */
export function normalizeVehicleTime(value: number): number {
  if (!Number.isFinite(value)) throw new Error("车辆更新时间必须是有限毫秒值。");
  return Math.max(0, Math.trunc(value)) >>> 0;
}

/** Caps a vehicle frame at 500 ms, emits 2 ms slices, and tracks rhythm pulses. */
export class VehicleFrameClock {
  lastMs = 0;
  rhythmAccumulator = 0;
  rhythmEnabled = false;
  rhythmTick = true;
  pendingRhythmPreviousMs: number | undefined;
  slicesBuffer: number[] = [];

  advance(inputMs: number): {
    nowMs: number; elapsedMs: number; slicesMs: number[]; rhythmTick: boolean;
  } {
    const now = normalizeVehicleTime(inputMs);
    const rhythmPrevious = this.pendingRhythmPreviousMs ?? this.lastMs;
    this.pendingRhythmPreviousMs = undefined;
    if (this.rhythmEnabled && rhythmPrevious !== 0) {
      const elapsed = (now - rhythmPrevious) >>> 0;
      const seconds = Math.fround(Math.fround(elapsed) * Math.fround(0.0010000000474974513));
      this.rhythmAccumulator = Math.fround(this.rhythmAccumulator + seconds);
      if (this.rhythmAccumulator < 0) this.rhythmTick = false;
      else {
        this.rhythmAccumulator = Math.fround(
          this.rhythmAccumulator - Math.fround(0.01666666753590107));
        this.rhythmTick = true;
      }
    }
    const elapsedMs = this.lastMs !== 0 && now > this.lastMs
      ? Math.min(now - this.lastMs, 500) : 0;
    this.lastMs = now;
    const slices = this.slicesBuffer;
    slices.length = 0;
    let remaining = elapsedMs;
    while (remaining !== 0) {
      const slice = Math.min(remaining, 2);
      slices.push(slice);
      remaining -= slice;
    }
    return { nowMs: now, elapsedMs, slicesMs: slices, rhythmTick: this.rhythmTick };
  }

  synchronize(inputMs: number, preserveRhythm = false): void {
    if (preserveRhythm && this.rhythmEnabled)
      this.pendingRhythmPreviousMs ??= this.lastMs;
    else this.pendingRhythmPreviousMs = undefined;
    this.lastMs = normalizeVehicleTime(inputMs);
  }

  reset(preserveRhythm = false): void {
    this.lastMs = 0;
    this.pendingRhythmPreviousMs = undefined;
    if (!preserveRhythm) {
      this.rhythmAccumulator = 0;
      this.rhythmEnabled = false;
      this.rhythmTick = true;
    }
  }

  enableRhythmCheck(): void { this.rhythmEnabled = true; }

  getRhythmState(): { enabled: boolean; tick: boolean; accumulator: number } {
    return { enabled: this.rhythmEnabled, tick: this.rhythmTick,
      accumulator: this.rhythmAccumulator };
  }
}
