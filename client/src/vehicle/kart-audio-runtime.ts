/** Audio resources that vary with the surface under the kart. */
export interface RoadSound {
  name: string;
  filename: string;
  spacing: boolean;
  spacingLen: number;
  volume0: number;
  volume100: number;
  buffer: AudioBuffer;
}

export type RoadSoundConfig = Omit<RoadSound, "buffer">;

export interface RoadConfigNode {
  name: string;
  children: RoadConfigNode[];
}

/** Reads the authoritative road.bml entries, preserving float32 thresholds. */
export function parseRoadSoundConfig(
  bytes: Uint8Array,
  parseBml: (bytes: Uint8Array) => RoadConfigNode,
  attribute: (node: RoadConfigNode, key: string) => string | undefined,
): RoadSoundConfig[] {
  const root = parseBml(bytes);
  if (root.name !== "road")
    throw new Error(`road sound root ${root.name} 不是 road。`);
  return root.children.map(node => {
    if (node.name !== "sound")
      throw new Error(`road sound child ${node.name} 不是 sound。`);
    const required = (key: string): string => {
      const value = attribute(node, key);
      if (!value) throw new Error(`road sound ${key} 缺失。`);
      return value;
    };
    const finiteFloat = (key: string, fallback: number): number => {
      const text = attribute(node, key);
      const value = text === undefined ? fallback : Number(text);
      if (!Number.isFinite(value))
        throw new Error(`road sound ${key} 不是 finite。`);
      return Math.fround(value);
    };
    const spacing = attribute(node, "spacing") ?? "false";
    if (spacing !== "true" && spacing !== "false")
      throw new Error("road sound spacing 不是 bool。");
    return {
      name: required("name"),
      filename: required("filename"),
      spacing: spacing === "true",
      spacingLen: finiteFloat("spacingLen", 5),
      volume0: finiteFloat("volume0", 0),
      volume100: finiteFloat("volume100", 1),
    };
  });
}

/** Converts the game's decoded interleaved 16-bit motor PCM into Web Audio. */
export async function decodeMotorAudio(
  context: AudioContext,
  bytes: Uint8Array,
  decodeVorbis: (
    bytes: Uint8Array,
    makeBuffer: (pcm: DataView, channels: number, frames: number,
      sampleRate: number) => AudioBuffer,
  ) => Promise<AudioBuffer>,
): Promise<AudioBuffer> {
  return decodeVorbis(bytes, (pcm, channels, frames, sampleRate) => {
    const buffer = context.createBuffer(channels, frames, sampleRate);
    for (let channel = 0; channel < channels; channel++) {
      const samples = buffer.getChannelData(channel);
      for (let frame = 0; frame < frames; frame++)
        samples[frame] = pcm.getInt16((frame * channels + channel) * 2, true) / 32768;
    }
    return buffer;
  });
}

export interface KartAudioOps {
  route(context: AudioContext, source: AudioBufferSourceNode, group?: string,
    gain?: GainNode): void;
  setGain(gain: AudioParam | undefined, value: number, time: number): void;
  setLoop(source: AudioBufferSourceNode, enabled: boolean): void;
  roadSoundEnabled(context: AudioContext): boolean;
}

export interface KartAudioAsset {
  bytes(): Promise<Uint8Array>;
}

export interface KartAudioLibrary {
  exactCanonicalCandidates(path: string): KartAudioAsset[];
}

export interface KartAudioLoadOps {
  decodeMotor(context: AudioContext, bytes: Uint8Array): Promise<AudioBuffer>;
  decodeAudio(context: AudioContext, bytes: Uint8Array): Promise<AudioBuffer>;
  parseRoadConfig(bytes: Uint8Array): Omit<RoadSound, "buffer">[];
  createContext(): AudioContext;
}

export type KartAudioFactory<T> = (
  context: AudioContext, motor: AudioBuffer, collision: AudioBuffer,
  landingShock: AudioBuffer, drift: AudioBuffer, reset: AudioBuffer,
  stateBuffers: Map<number, AudioBuffer>, boosterDeliveryEnabled: boolean,
  dualBoosterReady: AudioBuffer | undefined, dualBooster: AudioBuffer | undefined,
  charger: AudioBuffer | undefined, exceed: AudioBuffer | undefined,
  transforming: AudioBuffer, chargeBoostBySpeed: number,
  roadSounds: Map<string, RoadSound>,
) => T;

function requireOne(library: KartAudioLibrary, path: string): KartAudioAsset {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量 ${candidates.length}。`);
  return candidates[0]!;
}

function optionalEngineSound(library: KartAudioLibrary, engine: string,
  name: string): KartAudioAsset | undefined {
  const specific = library.exactCanonicalCandidates(
    `sound_/fx/kart/engine_${engine}/${name}.ogg`);
  if (specific.length > 1)
    throw new Error(`engine_${engine}/${name}.ogg source 不唯一。`);
  if (specific.length === 1) return specific[0];
  const common = library.exactCanonicalCandidates(
    `sound_/fx/kart/engine_common/${name}.ogg`);
  if (common.length > 1)
    throw new Error(`engine_common/${name}.ogg source 不唯一。`);
  return common[0];
}

/** Resolves optional engine sounds with common-engine fallback and road samples. */
export async function loadKartAudio<T>(
  library: KartAudioLibrary,
  engineName: string | undefined,
  generation: number,
  chargeBoostBySpeed: number,
  suppliedContext: AudioContext | undefined,
  kartName: string | undefined,
  ops: KartAudioLoadOps,
  create: KartAudioFactory<T>,
): Promise<T> {
  const context = suppliedContext ?? ops.createContext();
  const ownsContext = suppliedContext === undefined;
  const engine = engineName || "common";
  const motorPath = `sound_/fx/kart/engine_${engine}/motor.ogg`;
  let motorSources = library.exactCanonicalCandidates(motorPath);
  if (motorSources.length === 0 && engine !== "common")
    motorSources = library.exactCanonicalCandidates(
      "sound_/fx/kart/engine_common/motor.ogg");
  if (motorSources.length !== 1) {
    if (ownsContext) await context.close();
    throw new Error(`${motorPath} / engine_common motor source 数量应为 1，实际为 ${motorSources.length}。`);
  }

  try {
    const collisionSources = library.exactCanonicalCandidates("sound_/fx/kart/crash.ogg");
    if (collisionSources.length !== 1)
      throw new Error("sound_/fx/kart/crash.ogg source 不唯一。 ");
    const shock = requireOne(library, "sound_/fx/kart/shock.ogg");
    const driftSources = library.exactCanonicalCandidates("sound_/fx/kart/drift.ogg");
    if (driftSources.length !== 1)
      throw new Error("sound_/fx/kart/drift.ogg source 不唯一。 ");
    const reset = requireOne(library, "sound_/fx/etc/reset.flac");
    const stateSources = new Map<number, KartAudioAsset | undefined>([
      [1, optionalEngineSound(library, engine, "boosterStart")],
      [2, optionalEngineSound(library, engine, "boosterDrift")],
      [3, optionalEngineSound(library, engine, "booster")],
      [4, optionalEngineSound(library, engine, "booster")],
      [13, optionalEngineSound(library, engine, "boosterZone")],
      [14, optionalEngineSound(library, engine, "boosterJumpZone")],
      [15, optionalEngineSound(library, engine, "boosterDelivery")],
      [16, requireOne(library, "sound_/fx/item/magnet/using.ogg")],
      [18, optionalEngineSound(library, engine, "boosterPlay")],
    ]);
    const dualReady = generation > 6
      ? optionalEngineSound(library, engine, "dualBoosterReady") : undefined;
    const dual = generation > 6
      ? optionalEngineSound(library, engine, "dualBooster") : undefined;
    const charger = generation > 6
      ? optionalEngineSound(library, engine, "charger") : undefined;
    const exceed = optionalEngineSound(library, engine, "exceed");
    const transforming = optionalEngineSound(library, engine, "transforming")
      ?? requireOne(library, "sound_/fx/kart/transforming.ogg");
    const roadIndex = library.exactCanonicalCandidates("sound_/fx/road/road.bml");
    if (roadIndex.length !== 1)
      throw new Error(`sound_/fx/road/road.bml source 数量 ${roadIndex.length}。`);
    const roadEntries = ops.parseRoadConfig(await roadIndex[0]!.bytes()).flatMap(config => {
      const assets = library.exactCanonicalCandidates(
        `sound_/fx/road/${config.filename}.flac`);
      if (assets.length > 1)
        throw new Error(`road/${config.filename}.flac source 不唯一。`);
      return assets.length === 1 ? [{ config, asset: assets[0]! }] : [];
    });

    const [motorBytes, collisionBytes, shockBytes, driftBytes, resetBytes,
      ...optionalBytes] = await Promise.all([
      motorSources[0]!.bytes(), collisionSources[0]!.bytes(), shock.bytes(),
      driftSources[0]!.bytes(), reset.bytes(),
      ...[...stateSources.values()].map(asset => asset?.bytes()),
      dualReady?.bytes(), dual?.bytes(), charger?.bytes(), exceed?.bytes(),
      transforming.bytes(), ...roadEntries.map(({ asset }) => asset.bytes()),
    ]);
    const mainOptionalBytes = optionalBytes.slice(0, stateSources.size + 5);
    const roadBytes = optionalBytes.slice(mainOptionalBytes.length);
    const [motor, collision, landingShock, drift, resetBuffer,
      ...decodedOptional] = await Promise.all([
      ops.decodeMotor(context, motorBytes),
      ops.decodeAudio(context, collisionBytes),
      ops.decodeAudio(context, shockBytes),
      ops.decodeAudio(context, driftBytes),
      ops.decodeAudio(context, resetBytes),
      ...mainOptionalBytes.map(bytes => bytes ? ops.decodeAudio(context, bytes) : undefined),
      ...roadBytes.map(bytes => ops.decodeAudio(context, bytes!)),
    ]);
    const states = new Map([...stateSources.keys()]
      .map((key, index) => [key, decodedOptional[index]] as const)
      .filter((entry): entry is readonly [number, AudioBuffer] => !!entry[1]));
    const roadSounds = new Map(roadEntries.map(({ config }, index) => [
      config.name, { ...config, buffer: decodedOptional[mainOptionalBytes.length + index]! },
    ]));
    return create(context, motor, collision, landingShock, drift, resetBuffer,
      states, kartName !== undefined &&
        !["castle_I01", "nymph_I01", "nymph_I02"].includes(kartName),
      decodedOptional[stateSources.size], decodedOptional[stateSources.size + 1],
      decodedOptional[stateSources.size + 2], decodedOptional[stateSources.size + 3],
      decodedOptional[stateSources.size + 4]!, chargeBoostBySpeed, roadSounds);
  } catch (error) {
    if (ownsContext && context.state !== "closed") await context.close();
    throw error;
  }
}

export function motorLevel(speed: number): { pitch: number; gain: number } {
  const value = Math.max(0, speed);
  return {
    pitch: value < 128
      ? Math.fround(Math.fround(value * 0.01171875) + 0.25) : 1.5,
    gain: value < 64
      ? Math.fround(Math.fround(value * 0.01171875) + 0.25) : 1,
  };
}

export function collisionLevel(strength: number): number {
  return Math.min(1, Math.max(0.1, Math.fround(strength * 0.1)));
}

export function roadLevel(speed: number, zero: number, full: number): number {
  return speed >= zero
    ? speed < full
      ? Math.fround(Math.fround(speed - zero) / Math.fround(full - zero)) : 1
    : 0;
}

export function collisionCooldownElapsed(now: number, previous: number | undefined): boolean {
  return previous === undefined || (((now >>> 0) - (previous >>> 0)) >>> 0) > 2_000;
}

/** Owns every sound source for one live kart. */
export class KartAudioRuntime {
  context: AudioContext;
  motor: AudioBuffer;
  collision: AudioBuffer;
  landingShock: AudioBuffer;
  drift: AudioBuffer;
  reset: AudioBuffer;
  stateBuffers: Map<number, AudioBuffer>;
  boosterDeliveryEnabled: boolean;
  dualBoosterReady: AudioBuffer | undefined;
  dualBooster: AudioBuffer | undefined;
  charger: AudioBuffer | undefined;
  exceed: AudioBuffer | undefined;
  transforming: AudioBuffer;
  chargeBoostBySpeed: number;
  roadSounds: Map<string, RoadSound>;
  protected ops: KartAudioOps;
  source?: AudioBufferSourceNode;
  gain?: GainNode;
  collisionSource?: AudioBufferSourceNode;
  collisionGain?: GainNode;
  stateSource?: AudioBufferSourceNode;
  stateGain?: GainNode;
  state = 0;
  dualSource?: AudioBufferSourceNode;
  dualGain?: GainNode;
  dualSourceMode = 0;
  dualBoosterState = 0;
  chargerSource?: AudioBufferSourceNode;
  exceedSource?: AudioBufferSourceNode;
  transformingSource?: AudioBufferSourceNode;
  driftSource?: AudioBufferSourceNode;
  roadSource?: AudioBufferSourceNode;
  roadGain?: GainNode;
  roadName?: string;
  roadSpacingElapsed?: number;
  landingShockSource?: AudioBufferSourceNode;
  landingShockGain?: GainNode;
  resetSources = new Set<AudioBufferSourceNode>();
  steeringCollisionSources = new Set<AudioBufferSourceNode>();
  lastCollisionMs?: number;
  lastUpdateMs = 0;
  motorInterrupted = false;

  constructor(
    context: AudioContext,
    motor: AudioBuffer,
    collision: AudioBuffer,
    landingShock: AudioBuffer,
    drift: AudioBuffer,
    reset: AudioBuffer,
    stateBuffers: Map<number, AudioBuffer>,
    boosterDeliveryEnabled: boolean,
    dualBoosterReady: AudioBuffer | undefined,
    dualBooster: AudioBuffer | undefined,
    charger: AudioBuffer | undefined,
    exceed: AudioBuffer | undefined,
    transforming: AudioBuffer,
    chargeBoostBySpeed: number,
    roadSounds: Map<string, RoadSound>,
    ops: KartAudioOps,
  ) {
    this.context = context;
    this.motor = motor;
    this.collision = collision;
    this.landingShock = landingShock;
    this.drift = drift;
    this.reset = reset;
    this.stateBuffers = stateBuffers;
    this.boosterDeliveryEnabled = boosterDeliveryEnabled;
    this.dualBoosterReady = dualBoosterReady;
    this.dualBooster = dualBooster;
    this.charger = charger;
    this.exceed = exceed;
    this.transforming = transforming;
    this.chargeBoostBySpeed = chargeBoostBySpeed;
    this.roadSounds = roadSounds;
    this.ops = ops;
  }

  start(): void {
    if (this.source) return;
    this.motorInterrupted = false;
    void this.context.resume();
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.motor;
    this.ops.setLoop(source, true);
    source.playbackRate.value = 0.25;
    this.ops.setGain(gain.gain, 0, this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    source.start();
    this.source = source;
    this.gain = gain;
    this.lastUpdateMs = 0;
  }

  update(timeMs: number, speed: number): void {
    if (this.motorInterrupted && !this.source) {
      this.motorInterrupted = false;
      this.start();
    }
    if (!this.source || !this.gain) return;
    const now = Math.trunc(timeMs) >>> 0;
    if (((now - this.lastUpdateMs) >>> 0) <= 64) return;
    const { pitch, gain } = motorLevel(speed);
    this.source.playbackRate.setValueAtTime(pitch, this.context.currentTime);
    this.ops.setGain(this.gain.gain, gain, this.context.currentTime);
    this.lastUpdateMs = now;
  }

  async setPaused(paused: boolean): Promise<void> {
    if (paused) { this.stopEffectSources(); return; }
    await this.context.resume();
  }

  resetRace(): void { this.stopResetSources(); }

  stopRace(): void {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = undefined;
    }
    if (this.gain) { this.gain.disconnect(); this.gain = undefined; }
    this.stopEffectSources();
    this.motorInterrupted = false;
  }

  playReset(): void {
    const source = this.context.createBufferSource();
    source.buffer = this.reset;
    this.ops.route(this.context, source);
    source.onended = () => {
      if (this.resetSources.delete(source)) source.disconnect();
    };
    this.resetSources.add(source);
    source.start();
  }

  playCollision(strength: number, timeMs: number): void {
    const now = Math.trunc(timeMs) >>> 0;
    if (this.collisionSource || !(strength > 0) ||
      !collisionCooldownElapsed(now, this.lastCollisionMs)) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.collision;
    this.ops.setGain(gain.gain, collisionLevel(strength), this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    source.onended = () => {
      if (this.collisionSource === source) {
        source.disconnect();
        gain.disconnect();
        this.collisionSource = undefined;
        this.collisionGain = undefined;
      }
    };
    this.collisionSource = source;
    this.collisionGain = gain;
    this.lastCollisionMs = now;
    source.start();
  }

  playSteeringCollision(gainValue: number): void {
    if (!(gainValue > 0)) return;
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.gain?.disconnect();
      this.source = undefined;
      this.gain = undefined;
      this.motorInterrupted = true;
    }
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.collision;
    this.ops.setGain(gain.gain, gainValue, this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    source.onended = () => {
      if (this.steeringCollisionSources.delete(source)) {
        source.disconnect(); gain.disconnect();
      }
    };
    this.steeringCollisionSources.add(source);
    source.start();
  }

  playLandingShock(enabled: boolean, strength: number): void {
    if (!enabled || this.landingShockSource) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.landingShock;
    this.ops.setGain(gain.gain,
      Math.min(1, Math.max(0.1, Math.fround(strength * 0.04))),
      this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    source.onended = () => {
      if (this.landingShockSource === source) {
        source.disconnect(); gain.disconnect();
        this.landingShockSource = undefined;
        this.landingShockGain = undefined;
      }
    };
    this.landingShockSource = source;
    this.landingShockGain = gain;
    source.start();
  }

  setState(state: number, dualBoosterState: number): void {
    if (state === this.state && dualBoosterState === this.dualBoosterState) return;
    if (!(this.state === 10 && (state === 3 || state === 4) && dualBoosterState === 4))
      this.updateStateSource(state);
    this.updateDualSource(state, dualBoosterState);
    this.state = state;
    this.dualBoosterState = dualBoosterState;
  }

  setExceedActive(active: boolean): void {
    if (active === !!this.exceedSource) return;
    if (!active) { this.stopExceedSource(); return; }
    if (!this.exceed)
      throw new Error("当前车辆的原版引擎音效资源缺少 exceed.ogg。");
    const source = this.context.createBufferSource();
    source.buffer = this.exceed;
    this.ops.route(this.context, source);
    source.start();
    this.exceedSource = source;
  }

  setChargerActive(active: boolean): void {
    if (active === !!this.chargerSource) return;
    if (!active) { this.stopChargerSource(); return; }
    if (!this.charger) return;
    const source = this.context.createBufferSource();
    source.buffer = this.charger;
    this.ops.route(this.context, source);
    source.start();
    this.chargerSource = source;
  }

  setTransformingState(state: number): void {
    if (Math.fround(this.chargeBoostBySpeed) === 0 || state !== 1 ||
      this.transformingSource) return;
    const source = this.context.createBufferSource();
    source.buffer = this.transforming;
    this.ops.route(this.context, source);
    source.onended = () => {
      if (this.transformingSource === source) {
        source.disconnect(); this.transformingSource = undefined;
      }
    };
    this.transformingSource = source;
    source.start();
  }

  updateStateSource(state: number): void {
    if (state === this.state || state === 10) return;
    this.stopStateSource();
    this.startStateSource(state === 15 && !this.boosterDeliveryEnabled
      ? undefined : this.stateBuffers.get(state));
  }

  updateDualSource(state: number, dualBoosterState: number): void {
    if (state === 10) { this.enterDualBooster(); return; }
    if (this.dualSourceMode === 3) this.stopDualSource();
    if (dualBoosterState === 6) this.enterDualBoosterReady();
  }

  enterDualBooster(): void {
    const previous = this.dualSourceMode === 1 ? this.dualSource : undefined;
    const previousGain = this.dualGain;
    if (this.dualSourceMode !== 3) this.startDualSource(this.dualBooster, 3);
    if (previous) this.stopDualSource(previous, previousGain);
  }

  enterDualBoosterReady(): void {
    if (this.dualSourceMode === 0)
      this.startDualSource(this.dualBoosterReady, 1);
  }

  startStateSource(buffer: AudioBuffer | undefined): void {
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    this.ops.route(this.context, source, "fx", gain);
    source.start();
    this.stateSource = source;
    this.stateGain = gain;
  }

  startDualSource(buffer: AudioBuffer | undefined, mode: number): void {
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    this.ops.route(this.context, source, "fx", gain);
    source.start();
    this.dualSource = source;
    this.dualGain = gain;
    this.dualSourceMode = mode;
  }

  stopStateSource(): void {
    if (!this.stateSource) return;
    try { this.stateSource.stop(); } catch { /* Source may already have ended. */ }
    this.stateSource.disconnect();
    this.stateGain?.disconnect();
    this.stateSource = undefined;
    this.stateGain = undefined;
  }

  stopDualSource(source = this.dualSource, gain = this.dualGain): void {
    if (!source) return;
    try { source.stop(); } catch { /* Source may already have ended. */ }
    source.disconnect();
    gain?.disconnect();
    if (source === this.dualSource) {
      this.dualSource = undefined;
      this.dualGain = undefined;
      this.dualSourceMode = 0;
    }
  }

  stopExceedSource(): void {
    if (!this.exceedSource) return;
    try { this.exceedSource.stop(); } catch { /* Source may already have ended. */ }
    this.exceedSource.disconnect();
    this.exceedSource = undefined;
  }

  stopChargerSource(): void {
    if (!this.chargerSource) return;
    try { this.chargerSource.stop(); } catch { /* Source may already have ended. */ }
    this.chargerSource.disconnect();
    this.chargerSource = undefined;
  }

  stopTransformingSource(): void {
    if (!this.transformingSource) return;
    try { this.transformingSource.stop(); } catch { /* Source may already have ended. */ }
    this.transformingSource.disconnect();
    this.transformingSource = undefined;
  }

  setDriftActive(active: boolean): void {
    if (active === !!this.driftSource) return;
    if (!active) {
      this.driftSource!.stop();
      this.driftSource!.disconnect();
      this.driftSource = undefined;
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = this.drift;
    this.ops.setLoop(source, true);
    this.ops.route(this.context, source);
    source.start();
    this.driftSource = source;
  }

  updateRoad(name: string | undefined, speed: number, elapsed: number): void {
    const road = this.selectRoad(name);
    if (!road) return;
    const positiveSpeed = Math.fround(Math.max(0, speed));
    const volume = roadLevel(positiveSpeed, road.volume0, road.volume100);
    if (!road.spacing) {
      if (!this.roadSource) this.startRoad(road, true, volume);
      this.ops.setGain(this.roadGain?.gain, volume, this.context.currentTime);
      return;
    }
    this.updateSpacedRoad(road, positiveSpeed, volume, elapsed);
  }

  selectRoad(name: string | undefined): RoadSound | undefined {
    if (!this.ops.roadSoundEnabled(this.context)) name = undefined;
    if (name !== this.roadName) {
      this.stopRoad();
      this.roadName = name;
    }
    return name ? this.roadSounds.get(name) : undefined;
  }

  updateSpacedRoad(road: RoadSound, speed: number, volume: number,
    elapsed: number): void {
    if (this.roadSource) {
      this.ops.setGain(this.roadGain?.gain, volume, this.context.currentTime);
      return;
    }
    if (this.roadSpacingElapsed === undefined) {
      this.startRoad(road, false, volume);
      return;
    }
    this.roadSpacingElapsed += Math.max(0, elapsed);
    const samples = speed < 1 ? 1_048_576
      : Math.round((road.buffer.length * 5) / speed);
    if (this.roadSpacingElapsed >= samples / road.buffer.sampleRate)
      this.startRoad(road, false, volume);
  }

  startRoad(road: RoadSound, loop: boolean, volume: number): void {
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = road.buffer;
    this.ops.setLoop(source, loop);
    this.ops.setGain(gain.gain, volume, this.context.currentTime);
    this.ops.route(this.context, source, "fx", gain);
    source.onended = () => {
      if (this.roadSource === source) {
        source.disconnect(); gain.disconnect();
        this.roadSource = undefined;
        this.roadGain = undefined;
        this.roadSpacingElapsed = loop ? undefined : 0;
      }
    };
    this.roadSource = source;
    this.roadGain = gain;
    this.roadSpacingElapsed = undefined;
    source.start();
  }

  stopRoad(): void {
    if (this.roadSource) {
      try { this.roadSource.stop(); } catch { /* Source may already have ended. */ }
      this.roadSource.disconnect();
      this.roadGain?.disconnect();
    }
    this.roadSource = undefined;
    this.roadGain = undefined;
    this.roadSpacingElapsed = undefined;
  }

  async dispose(closeContext = true): Promise<void> {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.gain?.disconnect();
      this.source = undefined;
      this.gain = undefined;
    }
    this.stopEffectSources();
    this.motorInterrupted = false;
    if (closeContext) await this.context.close();
  }

  stopEffectSources(): void {
    if (this.collisionSource) {
      this.collisionSource.stop();
      this.collisionSource.disconnect();
      this.collisionGain?.disconnect();
      this.collisionSource = undefined;
      this.collisionGain = undefined;
    }
    this.stopStateSource();
    this.stopDualSource();
    this.stopChargerSource();
    this.stopExceedSource();
    this.stopTransformingSource();
    this.state = 0;
    this.dualBoosterState = 0;
    if (this.driftSource) {
      this.driftSource.stop();
      this.driftSource.disconnect();
      this.driftSource = undefined;
    }
    this.stopRoad();
    if (this.landingShockSource) {
      try { this.landingShockSource.stop(); } catch { /* Already ended. */ }
      this.landingShockSource.disconnect();
      this.landingShockGain?.disconnect();
      this.landingShockSource = undefined;
      this.landingShockGain = undefined;
    }
    for (const source of this.steeringCollisionSources) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.steeringCollisionSources.clear();
    this.stopResetSources();
  }

  stopResetSources(): void {
    for (const source of this.resetSources) {
      try { source.stop(); } catch { /* Already ended. */ }
      source.disconnect();
    }
    this.resetSources.clear();
  }
}
