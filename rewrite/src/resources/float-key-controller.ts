/** P3528 float animation keys used by textures, cameras, and award effects. */

export interface ParsedFloatController {
  kind: string;
  base: {
    cycleMode: number; frequency: number; phaseWord: number;
    startTimeWord?: number; stopTimeWord?: number;
  };
  keys: { type: number; records: Uint8Array[] };
}
interface FloatKey {
  time: number;
  value: number;
  incoming?: number;
  outgoing?: number;
}

const f32 = Math.fround;
const wordBuffer = new DataView(new ArrayBuffer(4));
function floatBits(value: number): number {
  wordBuffer.setFloat32(0, value, true);
  return wordBuffer.getUint32(0, true);
}
function unsignedFloat(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 4294967296)
    throw new Error(`FloatTontroller u32 conversion 越界：${value}。`);
  return Math.trunc(f32(value)) >>> 0;
}
function parseKey(type: number, record: Uint8Array): FloatKey {
  const expected = type === 0 ? 16 : 8;
  if (record.length !== expected)
    throw new Error(`FloatKey type ${type} size 应为 ${expected}，实际为 ${record.length}。`);
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  return type === 0 ? {
    time: view.getUint32(0, true), value: view.getFloat32(4, true),
    incoming: view.getFloat32(8, true), outgoing: view.getFloat32(12, true),
  } : { time: view.getUint32(0, true), value: view.getFloat32(4, true) };
}

/** Matches the original cursor search, step/linear/Hermite interpolation. */
function sampleKeys(type: number, keys: FloatKey[], time: number,
  controller: FloatKeyController): number {
  if (keys.length === 1) return f32(keys[0]!.value);
  let left = controller.getCursor();
  if (time < keys[left]!.time) left = 0;
  let right = left + 1;
  while (right < keys.length && time > keys[right]!.time) {
    left++;
    right++;
  }
  controller.setCursor(left);
  if (right >= keys.length) return f32(keys[keys.length - 1]!.value);
  const before = keys[left]!;
  const after = keys[right]!;
  if (type === 3) return f32(before.value);
  const interval = (after.time - before.time) >>> 0;
  const ratio = interval === 0 ? 0 : f32(f32((time - before.time) >>> 0) / f32(interval));
  if (type === 1) return f32(f32(before.value * f32(1 - ratio)) +
    f32(after.value * ratio));
  const outgoing = before.outgoing!;
  const incoming = after.incoming!;
  const delta = f32(after.value - before.value);
  const cubic = f32(f32(outgoing + incoming) - f32(delta + delta));
  const quadratic = f32(f32(delta * f32(3)) - f32(f32(outgoing + outgoing) + incoming));
  let result = f32(cubic * ratio);
  result = f32(result + quadratic);
  result = f32(result * ratio);
  result = f32(result + outgoing);
  result = f32(result * ratio);
  return f32(result + before.value);
}

export class FloatKeyController {
  cursor = 0;
  epoch = 0;
  lastCycle = 0;
  pingPongReverse = false;
  output = 0;
  frequencyOverride = 1;
  cycleModeOverride?: number;
  frozenTime?: number;
  mappedTime = 0;

  constructor(readonly cycleMode: number, readonly frequency: number,
    readonly phase: number, readonly authoredStart: number | undefined,
    readonly authoredStop: number | undefined, readonly keyType: number,
    readonly keys: FloatKey[]) {
    this.output = f32(keys[0]?.value ?? 0);
  }

  static fromParsed(parsed: ParsedFloatController): FloatKeyController {
    if (!parsed || typeof parsed !== "object" ||
        parsed.kind !== "float-controller" || !parsed.base || !parsed.keys ||
        !Array.isArray(parsed.keys.records))
      throw new Error("TexProperty controller 不是 FloatTontroller。 ");
    if (parsed.keys.type !== 0 && parsed.keys.type !== 1 && parsed.keys.type !== 3)
      throw new Error(`TimeAttack texture FloatKey type ${parsed.keys.type} 尚未映射。`);
    const keys = parsed.keys.records.map(record => parseKey(parsed.keys.type, record));
    if (keys.length === 0) throw new Error("FloatTontroller 缺少 key。 ");
    return new this(parsed.base.cycleMode >>> 0, f32(parsed.base.frequency),
      parsed.base.phaseWord >>> 0, parsed.base.startTimeWord,
      parsed.base.stopTimeWord, parsed.keys.type, keys);
  }

  update(time: number): number {
    const now = Math.trunc(time) >>> 0;
    if (this.epoch === 0) this.epoch = now;
    const start = this.keys.length > 1 ? this.keys[0]!.time : 0;
    const stop = this.keys.length > 1 ? this.keys[this.keys.length - 1]!.time : 0;
    const frequency = floatBits(this.frequencyOverride) === 1065353216
      ? this.frequency : this.frequencyOverride;
    const duration = unsignedFloat(f32(f32((stop - start) >>> 0) * frequency));
    const begin = (this.phase + this.epoch) >>> 0;
    let elapsed = 0;
    if (now >= begin) {
      elapsed = (now + this.phase - this.epoch) >>> 0;
      if (floatBits(frequency) !== 1065353216)
        elapsed = unsignedFloat(f32(f32(elapsed) * frequency));
    }
    let mapped: number;
    const cycleMode = this.cycleModeOverride ?? this.cycleMode;
    if (this.frozenTime !== undefined) mapped = this.frozenTime;
    else if (duration === 0) mapped = elapsed;
    else if (cycleMode === 0) mapped = (start + elapsed % duration) >>> 0;
    else if (cycleMode === 1) {
      const cycle = Math.floor(elapsed / duration) >>> 0;
      if (cycle !== this.lastCycle) this.pingPongReverse = !this.pingPongReverse;
      mapped = elapsed % duration;
      if (this.pingPongReverse) mapped = (duration - mapped) >>> 0;
      this.lastCycle = cycle;
    } else if (cycleMode === 2)
      mapped = elapsed < start ? start : elapsed > stop ? stop : elapsed;
    else mapped = now;
    this.mappedTime = mapped;
    this.output = sampleKeys(this.keyType, this.keys, mapped, this);
    return this.output;
  }

  current(): number { return this.output; }
  getCursor(): number { return this.cursor; }
  setCursor(index: number): void { this.cursor = index; }

  reset(time: number): void {
    this.cursor = 0;
    this.epoch = Math.trunc(time) >>> 0;
    this.lastCycle = 0;
    this.pingPongReverse = false;
    this.output = f32(this.keys[0]?.value ?? 0);
    this.frequencyOverride = 1;
    this.frozenTime = undefined;
    this.mappedTime = 0;
  }

  play(time: number, duration: number): void {
    this.reset(time);
    const requested = Math.trunc(duration) >>> 0;
    const start = this.authoredStart ?? (this.keys.length > 1 ? this.keys[0]!.time : 0);
    const stop = this.authoredStop ??
      (this.keys.length > 1 ? this.keys[this.keys.length - 1]!.time : 0);
    if (requested !== 0 && stop !== 0) {
      const span = unsignedFloat(f32(f32((stop - start) >>> 0) * this.frequency));
      this.frequencyOverride = f32(f32(span) / f32(requested));
    }
  }

  setCycleMode(mode: number): void { this.cycleModeOverride = Math.trunc(mode) >>> 0; }

  stop(time: number): void {
    this.update(time);
    this.frozenTime = this.mappedTime;
  }
}
