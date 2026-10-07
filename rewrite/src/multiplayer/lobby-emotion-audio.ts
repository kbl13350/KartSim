/** Lazy character emotion sound playback shared by lobby avatar previews. */

interface AudioEntry { bytes(): Promise<Uint8Array> }
interface AudioLibrary { get(path: string): AudioEntry | undefined }
interface AudioVoice {
  buffer: unknown;
  addEventListener(type: "ended", listener: () => void,
    options: { once: true }): void;
  start(): void;
  stop(): void;
  disconnect(): void;
}
interface AudioContextLike {
  state: string;
  resume(): Promise<void>;
  createBufferSource(): AudioVoice;
}

export interface LobbyEmotionAudioDependencies {
  decode(context: AudioContextLike, bytes: Uint8Array): Promise<unknown>;
  route(context: AudioContextLike, voice: AudioVoice, channel: "fx"): void;
}

export class LobbyEmotionAudio {
  readonly buffers = new Map<string, Promise<unknown>>();
  readonly active = new Set<AudioVoice>();
  disposed = false;

  constructor(readonly library: AudioLibrary,
    readonly context: AudioContextLike | undefined,
    readonly failed: ((error: unknown) => void) | undefined,
    readonly dependencies: LobbyEmotionAudioDependencies) {}

  play(characterPath: string, soundName: string): void {
    if (this.disposed || !this.context) return;
    if (this.context.state === "suspended") {
      this.context.resume().catch(error => this.failed?.(error));
    }
    const character = /^character_\/([^/]+)\//i.exec(characterPath)?.[1];
    if (!character || !soundName || soundName.includes("/") ||
      soundName.includes("\\")) return;
    const path = `sound_/character/${character}/${soundName}.ogg`;
    let buffer = this.buffers.get(path);
    if (!buffer) {
      const entry = this.library.get(path);
      if (!entry) return;
      buffer = entry.bytes().then(bytes => this.dependencies.decode(this.context!, bytes));
      this.buffers.set(path, buffer);
    }
    buffer.then(decoded => {
      if (!decoded || this.disposed || !this.context) return;
      const voice = this.context.createBufferSource();
      voice.buffer = decoded;
      this.dependencies.route(this.context, voice, "fx");
      this.active.add(voice);
      voice.addEventListener("ended", () => {
        voice.disconnect();
        this.active.delete(voice);
      }, { once: true });
      voice.start();
    }).catch(error => {
      if (!this.disposed) this.failed?.(error);
    });
  }

  dispose(): void {
    this.disposed = true;
    for (const voice of this.active) {
      voice.stop();
      voice.disconnect();
    }
    this.active.clear();
    this.buffers.clear();
  }
}
