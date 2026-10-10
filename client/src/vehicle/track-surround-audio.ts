import { Vector3, type Object3D } from "three";

const soundDirectory = "sound_/fx/surround";
const soundExtensions = ["ogg", "wav", "flac"];
const float32 = Math.fround;

export interface SurroundSoundConfig {
  filename: string;
  maxVolume: number;
  maxRadius: number;
  minVolume: number;
  minRadius: number;
  spacing: number;
  panning: boolean;
  timeLineOffset: number;
  timeLine: number[];
}

export interface DummySound {
  name: string;
  position: [number, number, number];
  config: SurroundSoundConfig;
}

interface Attribute { name: string; value: string }
interface Property { name: string; attributes: Attribute[]; children: Property[] }
interface TrackSoundObject {
  kind: string;
  name: string;
  property?: Property;
  transform: { position: [number, number, number] };
}
interface TrackSoundModel {
  root: { kind: string; trackObjects?: TrackSoundObject[] };
}

/** Read sound* ToDummy metadata from a track model. */
export function collectDummySounds(model: TrackSoundModel): DummySound[] {
  if (model.root.kind !== "track") return [];
  const sounds: DummySound[] = [];
  for (const object of model.root.trackObjects ?? []) {
    if (object.kind !== "ToDummy" || !object.name.startsWith("sound") || !object.property) continue;
    const soundProperty = object.property.children.find(child => child.name === "sound");
    if (!soundProperty) continue;
    const config = parseDummySoundConfig(soundProperty);
    if (config) sounds.push({ name: object.name, position: object.transform.position, config });
  }
  return sounds;
}

/** Preserve the release parser's defaults and integer-prefix rules. */
export function parseDummySoundConfig(property: Property): SurroundSoundConfig | undefined {
  const attributes = property.attributes;
  const attribute = (name: string) => attributes.find(entry => entry.name === name)?.value;
  const filename = attribute("filename");
  if (!filename) return;
  const finiteNumber = (name: string, fallback: number): number => {
    const value = attribute(name);
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${filename} ${name} 无效。`);
    return parsed;
  };
  const integerPrefix = (name: string, fallback: number): number => {
    const value = attribute(name);
    if (value === undefined) return fallback;
    const prefix = /^\s*[+-]?\d+/.exec(value);
    if (!prefix) return fallback;
    const parsed = Number(prefix[0]);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  };
  const panning = attribute("panning");
  const timeLine = attributes
    .filter(entry => entry.name !== "timeLineOffset" && entry.name.slice(0, 8) === "timeLine")
    .map(entry => {
      const prefix = /^\s*[+-]?\d+/.exec(entry.value);
      const value = prefix ? Number(prefix[0]) : 0;
      return Number.isSafeInteger(value) ? value : 0;
    });
  return {
    filename,
    maxVolume: float32(finiteNumber("maxVolume", 1)),
    maxRadius: float32(finiteNumber("maxRadius", 0)),
    minVolume: float32(finiteNumber("minVolume", 0)),
    minRadius: float32(finiteNumber("minRadius", 1)),
    spacing: integerPrefix("spacing", 0),
    panning: panning === undefined || !["false", "0", "off", "no"].includes(panning.toLowerCase()),
    timeLineOffset: integerPrefix("timeLineOffset", -1),
    timeLine,
  };
}

export interface SurroundAsset { bytes(): Promise<Uint8Array> }
export interface SurroundLibrary {
  exactCanonicalCandidates(path: string): SurroundAsset[];
}
export interface SurroundBuffer {
  duration: number;
  sampleRate: number;
  length: number;
}
export interface SurroundSource {
  buffer: SurroundBuffer | null;
  loop?: boolean;
  loopEnd?: number;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}
export interface SurroundAudioParam {
  setValueAtTime(value: number, time: number): void;
}
export interface SurroundGain {
  gain: SurroundAudioParam;
  disconnect(): void;
}
export interface SurroundPanner {
  pan: SurroundAudioParam;
  disconnect(): void;
}
export interface SurroundContext {
  currentTime: number;
  createBufferSource(): SurroundSource;
  createGain(): SurroundGain;
  createStereoPanner(): SurroundPanner;
}
export interface SurroundAudioOps {
  decode(context: SurroundContext, bytes: Uint8Array): Promise<SurroundBuffer>;
  route(context: SurroundContext, source: SurroundSource, group: "fx", gain: SurroundGain, panner?: SurroundPanner): void;
  setGain(param: SurroundAudioParam, gain: number, time: number): void;
  setLoop(source: SurroundSource, enabled: boolean): void;
}

export interface PlayingDummySound extends DummySound {
  worldPosition: Vector3;
  buffer: SurroundBuffer;
  repeatIntervalMs: number;
  active: boolean;
  lastTriggerMs: number;
  timelineElapsedMs: number;
  timelineIndex: number;
  source?: SurroundSource;
  gain?: SurroundGain;
  panner?: SurroundPanner;
}

/** Audio-clock-driven sound dummy owner for track ambience. */
export class TrackDummySurroundAudio {
  right = new Vector3();
  delta = new Vector3();
  lastUpdateMs: number | undefined;
  disposed = false;

  constructor(public context: SurroundContext, public sounds: PlayingDummySound[], private readonly ops: SurroundAudioOps) {}

  static async load(library: SurroundLibrary, sounds: DummySound[], context: SurroundContext,
    ops: SurroundAudioOps): Promise<TrackDummySurroundAudio> {
    const decoded = new Map<string, SurroundBuffer>();
    const playing: PlayingDummySound[] = [];
    for (const sound of sounds) {
      const filename = sound.config.filename;
      if (sound.config.timeLineOffset !== -1)
        throw new Error(`${sound.name} timeLineOffset 消费顺序尚未接入。`);
      let buffer = decoded.get(filename.toLowerCase());
      if (!buffer) {
        const candidates = soundExtensions.flatMap(extension =>
          library.exactCanonicalCandidates(`${soundDirectory}/${filename}.${extension}`));
        if (candidates.length > 1) throw new Error(`${filename} surround 音频来源不唯一。`);
        if (candidates.length === 0) continue;
        buffer = await ops.decode(context, await candidates[0]!.bytes());
        decoded.set(filename.toLowerCase(), buffer);
      }
      const [x, y, z] = sound.position;
      const repeatIntervalMs = (sound.config.spacing +
        (sound.config.spacing !== 0 && sound.config.timeLine.length === 0
          ? Math.trunc(buffer.duration * 1e3) : 0)) >>> 0;
      playing.push({ ...sound, worldPosition: new Vector3(x, z, -y), buffer,
        repeatIntervalMs, active: false, lastTriggerMs: 0,
        timelineElapsedMs: 0, timelineIndex: -1 });
    }
    return new this(context, playing, ops);
  }

  update(listener: Pick<Object3D, "quaternion" | "position">): void {
    if (this.disposed) return;
    const now = Math.trunc(this.context.currentTime * 1e3) >>> 0;
    const elapsed = this.lastUpdateMs === undefined ? 100 : (now - this.lastUpdateMs) >>> 0;
    if (elapsed < 100) return;
    this.lastUpdateMs = now;
    this.right.set(1, 0, 0).applyQuaternion(listener.quaternion);
    for (const sound of this.sounds) this.updateSound(sound, listener.position, now, elapsed);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sound of this.sounds) this.stop(sound);
    this.sounds.length = 0;
  }

  updateSound(sound: PlayingDummySound, listenerPosition: Vector3, now: number, elapsed: number): void {
    const distance = float32(this.delta.subVectors(sound.worldPosition, listenerPosition).length());
    const config = sound.config;
    const scheduled = config.spacing !== 0 || config.timeLine.length !== 0;
    let timelineTriggered = false;
    if (config.timeLine.length > 0) {
      sound.timelineElapsedMs = (sound.timelineElapsedMs + elapsed) >>> 0;
      let index = -1;
      for (let i = 0; i < config.timeLine.length; i += 1) {
        if (sound.timelineElapsedMs >= config.timeLine[i]! &&
          (i === config.timeLine.length - 1 || sound.timelineElapsedMs < config.timeLine[i + 1]!)) {
          index = i;
          break;
        }
      }
      timelineTriggered = index >= 0 && index !== sound.timelineIndex;
      if (timelineTriggered) sound.timelineIndex = index;
      const end = config.timeLine.at(-1)!;
      if (sound.timelineElapsedMs >= end + config.spacing) {
        sound.timelineElapsedMs = 0;
        sound.timelineIndex = -1;
      }
    }
    if (distance > config.minRadius) {
      this.stop(sound);
      return;
    }
    const volume = distance <= config.maxRadius ? config.maxVolume : float32(
      config.maxVolume - float32(
        float32(float32(config.maxVolume - config.minVolume) /
          float32(config.minRadius - config.maxRadius)) * float32(distance - config.maxRadius)));
    if (sound.gain) this.ops.setGain(sound.gain.gain, volume, this.context.currentTime);
    const pan = config.panning && distance > 0 ? float32(this.right.dot(this.delta) / distance) : 0;
    if (sound.panner) sound.panner.pan.setValueAtTime(pan, this.context.currentTime);
    if (!sound.active || (scheduled && (((now - sound.lastTriggerMs) >>> 0) > sound.repeatIntervalMs || timelineTriggered))) {
      if (sound.active && !scheduled) return;
      this.restart(sound, volume, pan, !scheduled, now);
    }
  }

  restart(sound: PlayingDummySound, volume: number, pan: number, loop: boolean, now: number): void {
    this.stopSource(sound);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const panner = sound.config.panning ? this.context.createStereoPanner() : undefined;
    source.buffer = sound.buffer;
    this.ops.setLoop(source, loop);
    this.ops.setGain(gain.gain, volume, this.context.currentTime);
    panner?.pan.setValueAtTime(pan, this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain, panner);
    sound.source = source;
    sound.gain = gain;
    sound.panner = panner;
    sound.active = true;
    sound.lastTriggerMs = now;
    source.onended = () => {
      if (sound.source !== source) return;
      sound.source = undefined;
      sound.gain = undefined;
      sound.panner = undefined;
      source.disconnect();
      panner?.disconnect();
      gain.disconnect();
    };
    source.start();
  }

  stop(sound: PlayingDummySound): void {
    sound.active = false;
    this.stopSource(sound);
  }

  stopSource(sound: PlayingDummySound): void {
    const source = sound.source;
    if (!source) return;
    const panner = sound.panner;
    const gain = sound.gain;
    source.onended = null;
    sound.source = undefined;
    sound.gain = undefined;
    sound.panner = undefined;
    try { source.stop(); } catch { /* A finished AudioBufferSourceNode throws on stop. */ }
    source.disconnect();
    panner?.disconnect();
    gain?.disconnect();
  }
}

export interface EventSound {
  sound?: SurroundSoundConfig;
  renderRoot: unknown;
}
export interface PlayingEventSound {
  config: SurroundSoundConfig;
  position: { x: number; y: number; z: number };
  buffer: SurroundBuffer;
  source?: SurroundSource;
  gain?: SurroundGain;
}
export interface EventSoundOps extends SurroundAudioOps {
  worldMatrix(root: unknown): unknown;
  transformPoint(origin: [number, number, number], matrix: unknown): { x: number; y: number; z: number };
}

/** Frame-time-driven standalone sound effects attached to moving track events. */
export class StandaloneEventSurroundAudio {
  lastUpdateMs: number | undefined;
  disposed = false;

  constructor(public context: SurroundContext, public sounds: PlayingEventSound[], private readonly ops: SurroundAudioOps) {}

  static async load(library: SurroundLibrary, events: EventSound[], context: SurroundContext,
    ops: EventSoundOps): Promise<StandaloneEventSurroundAudio> {
    const decoded = new Map<string, SurroundBuffer>();
    const sounds: PlayingEventSound[] = [];
    for (const event of events) {
      const config = event.sound;
      if (!config) continue;
      const unsupported = unsupportedEventSound(config);
      if (unsupported) throw new Error(`${config.filename} standalone event sound: ${unsupported}。`);
      const matrix = ops.worldMatrix(event.renderRoot);
      if (!matrix) throw new Error(`${config.filename} standalone event sound 缺少 root world matrix。`);
      const candidates = soundExtensions.flatMap(extension =>
        library.exactCanonicalCandidates(`${soundDirectory}/${config.filename}.${extension}`));
      if (candidates.length > 1)
        throw new Error(`${soundDirectory}/${config.filename} sound source 数量 ${candidates.length}。`);
      const candidate = candidates[0];
      if (!candidate) continue;
      const key = config.filename.toLowerCase();
      let buffer = decoded.get(key);
      if (!buffer) {
        buffer = await ops.decode(context, await candidate.bytes());
        decoded.set(key, buffer);
      }
      sounds.push({ config, position: ops.transformPoint([0, 0, 0], matrix), buffer });
    }
    return new this(context, sounds, ops);
  }

  update(nowMs: number, listenerPosition: { x: number; y: number; z: number }): void {
    if (this.disposed) return;
    const now = Math.trunc(nowMs) >>> 0;
    if (this.lastUpdateMs !== undefined && ((now - this.lastUpdateMs) >>> 0) < 100) return;
    this.lastUpdateMs = now;
    for (const sound of this.sounds) this.updateSound(sound, listenerPosition);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const sound of this.sounds) this.stop(sound);
    this.sounds.length = 0;
  }

  updateSound(sound: PlayingEventSound, listenerPosition: { x: number; y: number; z: number }): void {
    const distance = eventDistance(sound.position, listenerPosition);
    if (distance > sound.config.minRadius) {
      this.stop(sound);
      return;
    }
    const volume = eventVolume(sound.config, distance);
    if (sound.source) this.ops.setGain(sound.gain!.gain, volume, this.context.currentTime);
    else this.start(sound, volume);
  }

  start(sound: PlayingEventSound, volume: number): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = sound.buffer;
    this.ops.setLoop(source, true);
    this.ops.setGain(gain.gain, volume, this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    sound.source = source;
    sound.gain = gain;
    source.onended = () => this.releaseEnded(sound, source, gain);
    source.start();
  }

  stop(sound: PlayingEventSound): void {
    const source = sound.source;
    const gain = sound.gain;
    if (!source || !gain) return;
    sound.source = undefined;
    sound.gain = undefined;
    source.onended = null;
    try { source.stop(); } catch { /* A finished AudioBufferSourceNode throws on stop. */ }
    source.disconnect();
    gain.disconnect();
  }

  releaseEnded(sound: PlayingEventSound, source: SurroundSource, gain: SurroundGain): void {
    if (sound.source !== source) return;
    sound.source = undefined;
    sound.gain = undefined;
    source.disconnect();
    gain.disconnect();
  }
}

export function unsupportedEventSound(config: SurroundSoundConfig): string | undefined {
  if (config.panning) return "panning=true owner 尚未接入";
  if (config.spacing !== 0) return "spacing scheduler 尚未接入";
  if (config.timeLine.length !== 0) return "timeline scheduler 尚未接入";
  if ((Math.trunc(config.timeLineOffset) >>> 0) !== 4294967295)
    return "timeline offset scheduler 尚未接入";
}

export function eventVolume(config: SurroundSoundConfig, distance: number): number {
  if (distance <= config.maxRadius) return float32(config.maxVolume);
  const radiusRange = float32(config.minRadius - config.maxRadius);
  const volumeRange = float32(config.maxVolume - config.minVolume);
  const ratio = float32(float32(distance - config.maxRadius) / radiusRange);
  return float32(config.maxVolume - float32(volumeRange * ratio));
}

export function eventDistance(a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number }): number {
  const x = float32(a.x - b.x);
  const y = float32(a.y - b.y);
  const z = float32(a.z - b.z);
  return float32(Math.sqrt(float32(float32(x * x) + float32(float32(y * y) + float32(z * z)))));
}
