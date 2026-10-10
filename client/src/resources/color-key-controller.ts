/** Animated ARGB material color keys from the original model format. */
export interface ParsedColorController {
  kind: string;
  base: { cycleMode: number; frequency: number; phaseWord: number };
  keys: { type: number; records: Uint8Array[] };
}

interface ColorKey {
  time: number;
  color: number;
  incoming: number;
  outgoing: number;
}

const f32 = Math.fround;

function uint32Float(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 4294967296)
    throw new Error(`ColorTontroller u32 conversion 越界：${value}。`);
  return Math.trunc(f32(value)) >>> 0;
}

function parseKey(type: number, record: Uint8Array): ColorKey {
  const expectedSize = type === 0 ? 16 : 8;
  if (record.length !== expectedSize)
    throw new Error(`ColorKey type ${type} size 应为 ${expectedSize}，实际为 ${record.length}。`);
  const view = new DataView(record.buffer, record.byteOffset, record.byteLength);
  return {
    time: view.getUint32(0, true),
    color: view.getUint32(4, true),
    incoming: type === 0 ? view.getFloat32(8, true) : 0,
    outgoing: type === 0 ? view.getFloat32(12, true) : 0,
  };
}

function sampleKeys(type: number, keys: ColorKey[], time: number,
  controller: ColorKeyController): number {
  if (keys.length === 1) return keys[0]!.color;
  let beforeIndex = controller.getCursor();
  if (time < keys[beforeIndex]!.time) beforeIndex = 0;
  let afterIndex = beforeIndex + 1;
  while (afterIndex < keys.length && time > keys[afterIndex]!.time) {
    beforeIndex++;
    afterIndex++;
  }
  controller.setCursor(beforeIndex);
  if (afterIndex >= keys.length) return keys[keys.length - 1]!.color;
  const before = keys[beforeIndex]!;
  const after = keys[afterIndex]!;
  if (type === 3) return before.color;
  const span = (after.time - before.time) >>> 0;
  const ratio = span === 0 ? 0 : f32(f32((time - before.time) >>> 0) / f32(span));
  let color = 0;
  for (let shift = 0; shift < 32; shift += 8) {
    const start = (before.color >>> shift) & 255;
    const delta = ((after.color >>> shift) & 255) - start;
    const tangentSum = f32(before.outgoing + after.incoming);
    const tangentWeight = f32(f32(before.outgoing + before.outgoing) + after.incoming);
    let channel = f32(f32(tangentSum - f32(delta * 2)) * ratio);
    channel = f32(channel + f32(f32(delta * 3) - tangentWeight));
    channel = f32(channel * ratio);
    channel = f32(channel + before.outgoing);
    channel = f32(channel * ratio);
    channel = f32(channel + start);
    color = (color | ((Math.trunc(channel) & 255) << shift)) >>> 0;
  }
  return color;
}

export class ColorKeyController {
  cursor = 0;
  epoch = 0;
  lastCycle = 0;
  pingPongReverse = false;
  output: number;

  constructor(readonly cycleMode: number, readonly frequency: number,
    readonly phase: number, readonly keyType: number, readonly keys: ColorKey[]) {
    this.output = keys[0]?.color ?? 0;
  }

  static fromParsed(parsed: ParsedColorController): ColorKeyController {
    if (!parsed || typeof parsed !== "object" || parsed.kind !== "color-controller" ||
        !parsed.base || !parsed.keys || !Array.isArray(parsed.keys.records))
      throw new Error("MtlProperty controller 不是 ColorTontroller。 ");
    if (parsed.keys.type !== 0 && parsed.keys.type !== 3)
      throw new Error(`TimeAttack material ColorKey type ${parsed.keys.type} 尚未映射。`);
    const keys = parsed.keys.records.map(record => parseKey(parsed.keys.type, record));
    if (keys.length === 0) throw new Error("ColorTontroller 缺少 key。 ");
    return new this(parsed.base.cycleMode >>> 0, f32(parsed.base.frequency),
      parsed.base.phaseWord >>> 0, parsed.keys.type, keys);
  }

  update(time: number): number {
    const now = Math.trunc(time) >>> 0;
    if (this.epoch === 0) this.epoch = now;
    const first = this.keys.length > 1 ? this.keys[0]!.time : 0;
    const last = this.keys.length > 1 ? this.keys[this.keys.length - 1]!.time : 0;
    const duration = uint32Float(f32(f32((last - first) >>> 0) * this.frequency));
    const begin = (this.phase + this.epoch) >>> 0;
    let elapsed = 0;
    if (now >= begin) {
      elapsed = (now + this.phase - this.epoch) >>> 0;
      if (this.frequency !== 1) elapsed = uint32Float(f32(f32(elapsed) * this.frequency));
    }
    let mapped: number;
    if (duration === 0) mapped = elapsed;
    else if (this.cycleMode === 0) mapped = (first + elapsed % duration) >>> 0;
    else if (this.cycleMode === 1) {
      const cycle = Math.floor(elapsed / duration) >>> 0;
      if (cycle !== this.lastCycle) this.pingPongReverse = !this.pingPongReverse;
      mapped = elapsed % duration;
      if (this.pingPongReverse) mapped = (duration - mapped) >>> 0;
      this.lastCycle = cycle;
    } else if (this.cycleMode === 2)
      mapped = elapsed < first ? first : elapsed > last ? last : elapsed;
    else mapped = now;
    this.output = sampleKeys(this.keyType, this.keys, mapped, this);
    return this.output;
  }

  reset(time: number): void {
    this.cursor = 0;
    this.epoch = Math.trunc(time) >>> 0;
    this.lastCycle = 0;
    this.pingPongReverse = false;
    this.output = this.keys[0]?.color ?? 0;
  }

  getCursor(): number { return this.cursor; }
  setCursor(index: number): void { this.cursor = index; }
}
