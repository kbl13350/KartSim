/** Position, rotation and scale animation stored in track.1s resources. */

export interface PrsKeyTrack {
  type: number;
  records: Uint8Array[];
}

export interface PrsCompositeRotation {
  type: number;
  axes?: PrsKeyTrack[];
  components?: PrsKeyTrack[];
}

export interface ParsedTrackPrs {
  kind?: string;
  base: {
    phaseWord: number;
    frequency: number;
    cycleMode: number;
    startTimeWord?: number;
    stopTimeWord?: number;
  };
  position?: PrsKeyTrack;
  rotation?: PrsKeyTrack | PrsCompositeRotation;
  scale?: PrsKeyTrack;
  firstLastCache: number[];
}

export interface PrsRuntime {
  anchor: number;
  previousCycle: number;
  reverseHalf: boolean;
  frequencyOverride: number;
  cycleModeOverride?: number;
  frozenTime?: number;
  rangeStart: number;
  rangeStop: number;
}

export interface TrackTransform {
  position: number[];
  basis: number[][];
  scale: number[];
}

interface KeyRange { start: number; stop: number; }
interface Vec3Channel { type: number; times: Float64Array; values: Float32Array; }
interface ScalarChannel extends Vec3Channel {
  incoming: Float32Array; outgoing: Float32Array;
}
interface QuaternionChannel extends Vec3Channel { kind: 2; }
interface CompositeChannel { kind: 3; type: 4; axes: ScalarChannel[]; }
interface CompiledPrs {
  position?: Vec3Channel;
  rotation?: QuaternionChannel | CompositeChannel;
  scale?: Vec3Channel;
  rangeP: [number, number];
  rangeR: [number, number];
  rangeS: [number, number];
}

interface ParsedChannelCache {
  range?: KeyRange;
  vec3?: Array<{ time: number; value: number[] }>;
  rotation?: Array<{ time: number; value: number[] }>;
  scalar?: Array<{ time: number; value: number;
    incoming: number; outgoing: number }>;
}

const f32 = Math.fround;
const channelCache = new WeakMap<object, ParsedChannelCache>();
const compiledCache = new WeakMap<ParsedTrackPrs, CompiledPrs>();
const emptyRange: KeyRange = { start: 0, stop: 0 };
const floatWordView = new DataView(new ArrayBuffer(4));

function recordView(record: Uint8Array): DataView {
  return new DataView(record.buffer, record.byteOffset, record.byteLength);
}

function floatWord(value: number): number {
  floatWordView.setFloat32(0, value, true);
  return floatWordView.getUint32(0, true);
}

function unsignedFloat(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 4294967296)
    throw new Error(`Track PRS u32 conversion 越界：${value}。`);
  return Math.trunc(f32(value)) >>> 0;
}

function cacheFor(track: object): ParsedChannelCache {
  let cache = channelCache.get(track);
  if (!cache) {
    cache = {};
    channelCache.set(track, cache);
  }
  return cache;
}

function parsedVec3(track: PrsKeyTrack) {
  const cache = cacheFor(track);
  return cache.vec3 ??= track.records.map(record => {
    const view = recordView(record);
    return { time: view.getUint32(0, true), value: [
      view.getFloat32(4, true), view.getFloat32(8, true),
      view.getFloat32(12, true) ] };
  });
}

function parsedQuaternion(track: PrsKeyTrack) {
  const cache = cacheFor(track);
  return cache.rotation ??= track.records.map(record => {
    const view = recordView(record);
    return { time: view.getUint32(0, true), value: [
      view.getFloat32(4, true), view.getFloat32(8, true),
      view.getFloat32(12, true), view.getFloat32(16, true) ] };
  });
}

function parsedScalar(track: PrsKeyTrack) {
  const cache = cacheFor(track);
  return cache.scalar ??= track.records.map(record => {
    const view = recordView(record);
    return { time: view.getUint32(0, true), value: view.getFloat32(4, true),
      incoming: track.type === 0 ? view.getFloat32(8, true) : 0,
      outgoing: track.type === 0 ? view.getFloat32(12, true) : 0 };
  });
}

function trackRange(track: PrsKeyTrack | PrsCompositeRotation,
  property: ParsedTrackPrs, cacheIndex: number): KeyRange {
  const cache = cacheFor(track);
  if (cache.range) return cache.range;
  const records = "records" in track ? track.records
    : (track.axes ?? track.components ?? []).flatMap(axis => axis.records);
  if (records.length === 0) {
    emptyRange.start = property.firstLastCache[cacheIndex]!;
    emptyRange.stop = property.firstLastCache[cacheIndex + 1]!;
    return emptyRange;
  }
  const times = records.map(record => recordView(record).getUint32(0, true));
  return cache.range = { start: Math.min(...times), stop: Math.max(...times) };
}

function fullRange(property: ParsedTrackPrs): KeyRange {
  const index = property.scale ? 4 : property.rotation ? 2 : 0;
  const track = property.scale ?? property.rotation ?? property.position;
  return track ? trackRange(track, property, index) : { start: 0, stop: 0 };
}

export function isTrackPrs(value: unknown): value is ParsedTrackPrs {
  return !!(value && typeof value === "object" &&
    (value as { kind?: string }).kind === "prs");
}

export function createPrsRuntime(): PrsRuntime {
  return { anchor: 0, previousCycle: 0, reverseHalf: false,
    frequencyOverride: 1, cycleModeOverride: undefined,
    frozenTime: undefined, rangeStart: 0, rangeStop: 0 };
}

export function playPrs(property: ParsedTrackPrs, runtime: PrsRuntime,
  time: number, duration: number): void {
  runtime.anchor = Math.trunc(time) >>> 0;
  runtime.previousCycle = 0;
  runtime.reverseHalf = false;
  runtime.frozenTime = undefined;
  const range = fullRange(property);
  runtime.rangeStart = property.base.startTimeWord ?? range.start;
  runtime.rangeStop = property.base.stopTimeWord ?? range.stop;
  runtime.frequencyOverride = 1;
  const requested = Math.trunc(duration) >>> 0;
  if (requested !== 0 && runtime.rangeStop !== 0) {
    const span = unsignedFloat(f32(f32((runtime.rangeStop - runtime.rangeStart) >>> 0)
      * property.base.frequency));
    runtime.frequencyOverride = f32(f32(span) / f32(requested));
  }
}

export function setPrsCycleMode(runtime: PrsRuntime, mode: number): void {
  runtime.cycleModeOverride = Math.trunc(mode) >>> 0;
}

export function stopPrs(property: ParsedTrackPrs, runtime: PrsRuntime,
  time: number): void {
  if (runtime.rangeStart === 0 && runtime.rangeStop === 0) {
    const range = fullRange(property);
    runtime.rangeStart = property.base.startTimeWord ?? range.start;
    runtime.rangeStop = property.base.stopTimeWord ?? range.stop;
  }
  runtime.frozenTime = mapPrsTime(property.base, runtime,
    Math.trunc(time) >>> 0, runtime.rangeStart, runtime.rangeStop);
}

function validateVec3(track: PrsKeyTrack | undefined,
  label: string): string | undefined {
  if (!track) return undefined;
  if (!("records" in track) || ![0, 1, 3].includes(track.type))
    return `${label} Vec3 keyType ${track.type}`;
  if (track.records.length === 0) return `${label} 不含 key`;
}

export function validatePrs(property: ParsedTrackPrs): string | undefined {
  const positionError = validateVec3(property.position, "position");
  if (positionError) return positionError;
  const scaleError = validateVec3(property.scale, "scale");
  if (scaleError) return scaleError;
  const rotation = property.rotation;
  if (!rotation) return warmPrsRanges(property);
  if ("records" in rotation) {
    if (rotation.type !== 1) return `rotation keyType ${rotation.type}`;
    if (rotation.records.length === 0) return "rotation 不含 key";
    return warmPrsRanges(property);
  }
  if (rotation.type !== 4)
    return `rotation composite keyType ${rotation.type}`;
  const axes = rotation.axes ?? rotation.components;
  if (!axes || axes.length !== 3)
    return "rotation type4 缺少三个 scalar axes";
  for (const axis of axes) {
    if (axis.type !== 0 && axis.type !== 3)
      return `rotation scalar keyType ${axis.type}`;
    if (axis.records.length === 0) return "rotation scalar 不含 key";
  }
  return warmPrsRanges(property);
}

function warmPrsRanges(property: ParsedTrackPrs): undefined {
  if (property.position) {
    parsedVec3(property.position);
    trackRange(property.position, property, 0);
  }
  const rotation = property.rotation;
  if (rotation) {
    if ("records" in rotation) parsedQuaternion(rotation);
    else (rotation.axes ?? rotation.components)!.forEach(parsedScalar);
    trackRange(rotation, property, 2);
  }
  if (property.scale) {
    parsedVec3(property.scale);
    trackRange(property.scale, property, 4);
  }
  return undefined;
}

export function defaultTrackTransform(): TrackTransform {
  return { position: [0, 0, 0], basis: [
    [1, 0, 0], [0, 1, 0], [0, 0, 1] ], scale: [1, 1, 1] };
}

function mapPrsTime(base: ParsedTrackPrs["base"], runtime: PrsRuntime,
  time: number, start: number, stop: number): number {
  if (runtime.frozenTime !== undefined) return runtime.frozenTime;
  runtime.rangeStart = start;
  runtime.rangeStop = stop;
  if (runtime.anchor === 0 && time !== 0) runtime.anchor = time;
  const begin = (runtime.anchor + base.phaseWord) >>> 0;
  let elapsed = time < begin ? 0 :
    (time + base.phaseWord - runtime.anchor) >>> 0;
  const frequency = floatWord(runtime.frequencyOverride) === 1065353216
    ? base.frequency : runtime.frequencyOverride;
  if (floatWord(frequency) !== 1065353216)
    elapsed = unsignedFloat(f32(f32(elapsed) * frequency));
  const span = unsignedFloat(f32(f32((stop - start) >>> 0) * frequency));
  if (span === 0) return elapsed;
  const cycleMode = runtime.cycleModeOverride ?? base.cycleMode;
  if (cycleMode === 0) return ((elapsed % span) + start) >>> 0;
  if (cycleMode === 1) {
    const cycle = Math.floor(elapsed / span) >>> 0;
    if (cycle !== runtime.previousCycle)
      runtime.reverseHalf = !runtime.reverseHalf;
    runtime.previousCycle = cycle;
    const offset = elapsed % span;
    return runtime.reverseHalf ? (span - offset) >>> 0 : offset;
  }
  if (cycleMode === 2)
    return elapsed < start ? start : elapsed > stop ? stop : elapsed;
  return time;
}

function compileTrack(property: ParsedTrackPrs): CompiledPrs {
  let compiled = compiledCache.get(property);
  if (compiled) return compiled;
  const vec3 = (track: PrsKeyTrack | undefined): Vec3Channel | undefined => {
    if (!track) return undefined;
    if (!("records" in track) || ![0, 1, 3].includes(track.type))
      throw new Error(`Track PRS Vec3 keyType ${track.type} 尚未映射。`);
    const times = new Float64Array(track.records.length);
    const values = new Float32Array(track.records.length * 3);
    track.records.forEach((record, index) => {
      const view = recordView(record);
      times[index] = view.getUint32(0, true);
      values[index * 3] = view.getFloat32(4, true);
      values[index * 3 + 1] = view.getFloat32(8, true);
      values[index * 3 + 2] = view.getFloat32(12, true);
    });
    return { type: track.type, times, values };
  };
  const scalar = (track: PrsKeyTrack): ScalarChannel => {
    if (track.type !== 0 && track.type !== 3)
      throw new Error(`Track PRS scalar keyType ${track.type} 尚未映射。`);
    const count = track.records.length;
    const times = new Float64Array(count), values = new Float32Array(count);
    const incoming = new Float32Array(count), outgoing = new Float32Array(count);
    track.records.forEach((record, index) => {
      const view = recordView(record);
      times[index] = view.getUint32(0, true);
      values[index] = view.getFloat32(4, true);
      if (track.type === 0) {
        incoming[index] = view.getFloat32(8, true);
        outgoing[index] = view.getFloat32(12, true);
      }
    });
    return { type: track.type, times, values, incoming, outgoing };
  };
  const rotation = property.rotation;
  let compiledRotation: QuaternionChannel | CompositeChannel | undefined;
  if (rotation) {
    if ("records" in rotation) {
      if (rotation.type !== 1)
        throw new Error(`Track PRS rotation keyType ${rotation.type} 尚未映射。`);
      const times = new Float64Array(rotation.records.length);
      const values = new Float32Array(rotation.records.length * 4);
      rotation.records.forEach((record, index) => {
        const view = recordView(record);
        times[index] = view.getUint32(0, true);
        values[index * 4] = view.getFloat32(4, true);
        values[index * 4 + 1] = view.getFloat32(8, true);
        values[index * 4 + 2] = view.getFloat32(12, true);
        values[index * 4 + 3] = view.getFloat32(16, true);
      });
      compiledRotation = { kind: 2, type: rotation.type, times, values };
    } else {
      if (rotation.type !== 4)
        throw new Error(`Track PRS rotation composite keyType ${rotation.type} 尚未映射。`);
      const axes = rotation.axes ?? rotation.components;
      if (!axes || axes.length !== 3)
        throw new Error("Track PRS rotation type4 缺少三个 scalar axes。 ");
      compiledRotation = { kind: 3, type: 4, axes: axes.map(scalar) };
    }
  }
  const positionRange = property.position
    ? trackRange(property.position, property, 0) : undefined;
  const rotationRange = rotation ? trackRange(rotation, property, 2) : undefined;
  const scaleRange = property.scale
    ? trackRange(property.scale, property, 4) : undefined;
  compiled = { position: vec3(property.position),
    rotation: compiledRotation, scale: vec3(property.scale),
    rangeP: positionRange ? [positionRange.start, positionRange.stop] : [0, 0],
    rangeR: rotationRange ? [rotationRange.start, rotationRange.stop] : [0, 0],
    rangeS: scaleRange ? [scaleRange.start, scaleRange.stop] : [0, 0] };
  compiledCache.set(property, compiled);
  return compiled;
}

function keyIndex(times: Float64Array, count: number, time: number): number {
  if (count === 0) throw new Error("Track PRS track 不含 key。 ");
  let index = 0;
  while (index + 1 < count && time > times[index + 1]!) index++;
  return index;
}

function keyRatio(start: number, stop: number, time: number): number {
  const span = (stop - start) >>> 0;
  return span === 0 ? 0 : f32(f32((time - start) >>> 0) / f32(span));
}

function sampleVec3(output: number[], channel: Vec3Channel,
  time: number): void {
  const count = channel.times.length;
  const first = keyIndex(channel.times, count, time);
  const second = Math.min(first + 1, count - 1);
  if (first === second || channel.type === 3) {
    output[0] = channel.values[first * 3]!;
    output[1] = channel.values[first * 3 + 1]!;
    output[2] = channel.values[first * 3 + 2]!;
    return;
  }
  const ratio = keyRatio(channel.times[first]!, channel.times[second]!, time);
  const complement = f32(1 - ratio);
  output[0] = f32(f32(channel.values[first * 3]! * complement) +
    f32(channel.values[second * 3]! * ratio));
  output[1] = f32(f32(channel.values[first * 3 + 1]! * complement) +
    f32(channel.values[second * 3 + 1]! * ratio));
  output[2] = f32(f32(channel.values[first * 3 + 2]! * complement) +
    f32(channel.values[second * 3 + 2]! * ratio));
}

function sampleScalar(channel: ScalarChannel, time: number): number {
  const count = channel.times.length;
  const first = keyIndex(channel.times, count, time);
  const second = Math.min(first + 1, count - 1);
  if (first === second || channel.type === 3) return channel.values[first]!;
  const ratio = keyRatio(channel.times[first]!, channel.times[second]!, time);
  const delta = f32(channel.values[second]! - channel.values[first]!);
  let cubic = f32(f32(f32(channel.outgoing[first]! +
    channel.incoming[second]!) - f32(2 * delta)));
  cubic = f32(f32(cubic * ratio) + f32(f32(3 * delta) -
    f32(f32(2 * channel.outgoing[first]!) + channel.incoming[second]!)));
  cubic = f32(f32(cubic * ratio) + channel.outgoing[first]!);
  return f32(f32(cubic * ratio) + channel.values[first]!);
}

function scaleQuaternionNorm(norm: number, estimate: number): number {
  return f32(estimate * f32(
    f32(f32(f32(estimate * estimate) * norm) - f32(0.95906597))
      * f32(-0.53251559) + f32(1.0214351)));
}

/** Release approximation for interpolating and normalizing quaternion keys. */
function approximateQuaternion(output: number[],
  first: [number, number, number, number],
  second: [number, number, number, number], ratio: number): void {
  const [a0, a1, a2, a3] = first;
  const [b0, b1, b2, b3] = second;
  const dot = f32(f32(f32(f32(b1 * a1) + f32(b0 * a0)) +
    f32(a2 * b2)) + f32(a3 * b3));
  let adjustment = f32(1 - f32(dot * f32(0.82279688)));
  adjustment = f32(f32(adjustment * adjustment) * f32(0.58549219));
  let weight: number;
  if (ratio > 0.5) {
    const reverse = f32(1 - ratio);
    weight = f32(1 - f32(f32(f32(f32(f32(reverse + reverse) - 3)
      * f32(adjustment * reverse)) + 1 + adjustment) * reverse));
  } else {
    weight = f32(f32(f32(f32(f32(ratio + ratio) - 3)
      * f32(adjustment * ratio)) + 1 + adjustment) * ratio);
  }
  output[0] = f32(f32(b0 - a0) * weight + a0);
  output[1] = f32(f32(b1 - a1) * weight + a1);
  output[2] = f32(f32(b2 - a2) * weight + a2);
  output[3] = f32(f32(b3 - a3) * weight + a3);
  const norm = f32(f32(f32(output[0]! * output[0]! +
    output[1]! * output[1]!) + output[2]! * output[2]!) +
    output[3]! * output[3]!);
  let inverse = f32(f32(norm - f32(0.95906597)) *
    f32(-0.53251559) + f32(1.0214351));
  if (norm <= f32(0.91521198)) {
    inverse = scaleQuaternionNorm(norm, inverse);
    if (norm <= f32(0.6521197))
      inverse = scaleQuaternionNorm(norm, inverse);
  }
  for (let index = 0; index < 4; index++)
    output[index] = f32(output[index]! * inverse);
}

function axisQuaternion(angle: number, axis: number): number[] {
  const half = f32(angle * 0.5);
  const quaternion = [f32(Math.cos(half)), 0, 0, 0];
  quaternion[axis + 1] = f32(Math.sin(half));
  return quaternion;
}

function multiplyQuaternions(left: number[], right: number[]): number[] {
  const [a, b, c, d] = left;
  const [e, f, g, h] = right;
  return [
    f32(f32(f32(f32(a! * e!) - f32(b! * f!)) - f32(c! * g!)) - f32(d! * h!)),
    f32(f32(f32(f32(a! * f!) + f32(b! * e!)) + f32(c! * h!)) - f32(d! * g!)),
    f32(f32(f32(f32(a! * g!) - f32(b! * h!)) + f32(c! * e!)) + f32(d! * f!)),
    f32(f32(f32(f32(a! * h!) + f32(b! * g!)) - f32(c! * f!)) + f32(d! * e!)),
  ];
}

function quaternionBasis(output: number[][], quaternion: number[]): void {
  const [a, b, c, d] = quaternion;
  output[0]![0] = f32(1 - f32(2 * f32(f32(c! * c!) + f32(d! * d!))));
  output[0]![1] = f32(2 * f32(f32(b! * c!) - f32(a! * d!)));
  output[0]![2] = f32(2 * f32(f32(b! * d!) + f32(a! * c!)));
  output[1]![0] = f32(2 * f32(f32(b! * c!) + f32(a! * d!)));
  output[1]![1] = f32(1 - f32(2 * f32(f32(b! * b!) + f32(d! * d!))));
  output[1]![2] = f32(2 * f32(f32(c! * d!) - f32(a! * b!)));
  output[2]![0] = f32(2 * f32(f32(b! * d!) - f32(a! * c!)));
  output[2]![1] = f32(2 * f32(f32(c! * d!) + f32(a! * b!)));
  output[2]![2] = f32(1 - f32(2 * f32(f32(b! * b!) + f32(c! * c!))));
}

function sampleRotation(output: number[][],
  channel: QuaternionChannel | CompositeChannel, time: number): void {
  if (channel.kind === 2) {
    const count = channel.times.length;
    const first = keyIndex(channel.times, count, time);
    const second = Math.min(first + 1, count - 1);
    let quaternion: number[];
    if (first === second) {
      quaternion = Array.from(channel.values.subarray(first * 4, first * 4 + 4));
    } else {
      quaternion = [0, 0, 0, 0];
      approximateQuaternion(quaternion,
        Array.from(channel.values.subarray(first * 4, first * 4 + 4)) as
          [number, number, number, number],
        Array.from(channel.values.subarray(second * 4, second * 4 + 4)) as
          [number, number, number, number],
        keyRatio(channel.times[first]!, channel.times[second]!, time));
    }
    quaternionBasis(output, quaternion);
    return;
  }
  const x = sampleScalar(channel.axes[0]!, time);
  const y = sampleScalar(channel.axes[1]!, time);
  const z = sampleScalar(channel.axes[2]!, time);
  const zy = multiplyQuaternions(axisQuaternion(z, 2), axisQuaternion(y, 1));
  const zyx = multiplyQuaternions(zy, axisQuaternion(x, 0));
  quaternionBasis(output, zyx);
}

function copyVec3(output: number[], source: number[]): void {
  output[0] = source[0]!; output[1] = source[1]!; output[2] = source[2]!;
}

function copyBasis(output: number[][], source: number[][]): void {
  for (let row = 0; row < 3; row++)
    for (let column = 0; column < 3; column++)
      output[row]![column] = source[row]![column]!;
}

export function applyTrackPrs(output: TrackTransform, property: ParsedTrackPrs,
  runtime: PrsRuntime, time: number, fallback: TrackTransform): TrackTransform {
  const tick = Math.trunc(time) >>> 0;
  const channels = compileTrack(property);
  if (channels.position) {
    const mapped = mapPrsTime(property.base, runtime, tick,
      channels.rangeP[0], channels.rangeP[1]);
    sampleVec3(output.position, channels.position, mapped);
  } else copyVec3(output.position, fallback.position);
  if (channels.rotation) {
    const mapped = mapPrsTime(property.base, runtime, tick,
      channels.rangeR[0], channels.rangeR[1]);
    sampleRotation(output.basis, channels.rotation, mapped);
  } else copyBasis(output.basis, fallback.basis);
  if (channels.scale) {
    const mapped = mapPrsTime(property.base, runtime, tick,
      channels.rangeS[0], channels.rangeS[1]);
    sampleVec3(output.scale, channels.scale, mapped);
  } else copyVec3(output.scale, fallback.scale);
  return output;
}

export function sampleTrackPrs(property: ParsedTrackPrs, runtime: PrsRuntime,
  time: number, fallback: TrackTransform): TrackTransform {
  return applyTrackPrs(defaultTrackTransform(), property, runtime, time, fallback);
}
