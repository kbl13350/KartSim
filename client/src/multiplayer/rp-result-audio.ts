/** Original RP box-opening sound bank and active voice lifecycle. */

interface AudioEntry { bytes(): Promise<Uint8Array> }
interface AudioLibrary { get(path: string): AudioEntry | undefined }

interface AudioVoice {
  buffer: unknown;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

interface AudioContextLike {
  state: string;
  resume(): Promise<void>;
  createBufferSource(): AudioVoice;
}

export interface RpResultAudioDependencies {
  decode(context: AudioContextLike, bytes: Uint8Array): Promise<unknown>;
  route(context: AudioContextLike, voice: AudioVoice, channel: string): void;
}

const soundPaths = {
  opening: "sound_/fx/etc/복불복 상자 사운드.ogg",
  lucky: "sound_/fx/etc/복불복 대박 사운드.ogg",
  unlucky: "sound_/fx/etc/복불복 꽝 사운드.ogg",
} as const;

export class RpResultAudio {
  readonly voices = new Set<AudioVoice>();
  disposed = false;

  constructor(readonly context: AudioContextLike | undefined,
    readonly buffers: Map<string, unknown>,
    readonly dependencies: RpResultAudioDependencies) {}

  static async load<T extends RpResultAudio>(
    this: new (context: AudioContextLike | undefined,
      buffers: Map<string, unknown>,
      dependencies: RpResultAudioDependencies) => T,
    library: AudioLibrary, context: AudioContextLike | undefined,
    dependencies: RpResultAudioDependencies): Promise<T> {
    const buffers = new Map<string, unknown>();
    for (const path of Object.values(soundPaths)) {
      const source = library.get(path);
      if (!source) throw new Error(`RP 原音效缺失：${path}`);
      if (context) buffers.set(path,
        await dependencies.decode(context, await source.bytes()));
    }
    return new this(context, buffers, dependencies);
  }

  async prepare(): Promise<void> {
    if (this.context?.state === "suspended") await this.context.resume();
  }

  play(kind: keyof typeof soundPaths): void {
    if (this.disposed || !this.context) return;
    const buffer = this.buffers.get(soundPaths[kind]);
    if (!buffer) throw new Error("RP 音效未预解码。");
    const voice = this.context.createBufferSource();
    voice.buffer = buffer;
    this.dependencies.route(this.context, voice, "fx");
    this.voices.add(voice);
    voice.onended = () => {
      voice.disconnect();
      this.voices.delete(voice);
    };
    try {
      voice.start();
    } catch (error) {
      voice.onended = null;
      voice.disconnect();
      this.voices.delete(voice);
      throw error;
    }
  }

  stop(): void {
    for (const voice of this.voices) {
      voice.onended = null;
      try { voice.stop(); } catch { /* A finished voice may reject stop. */ }
      voice.disconnect();
    }
    this.voices.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
  }
}
