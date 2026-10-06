export interface RainAudioSource {
  buffer: unknown;
  onended: (() => void) | null;
  start(): void;
  stop(): void;
  disconnect(): void;
}

export interface RainAudioContext {
  createBufferSource(): RainAudioSource;
}

export interface RainAudioLibrary {
  exactCanonicalCandidates(path: string): { bytes(): Promise<Uint8Array> }[];
}

/** Finds the one rain transition cue, decodes it, and creates the playback owner. */
export async function loadRainAudioCue<T extends RainAudioCue>(
  library: RainAudioLibrary,
  context: RainAudioContext,
  decodeAudio: (context: RainAudioContext, bytes: Uint8Array) => Promise<unknown>,
  createCue: (context: RainAudioContext, buffer: unknown) => T,
): Promise<T> {
  const name = "비소리작아짐";
  const sources = library.exactCanonicalCandidates(`sound_/fx/surround/${name}.ogg`);
  if (sources.length !== 1)
    throw new Error(`surround/${name}.ogg source 数量应为 1，实际为 ${sources.length}。`);
  return createCue(context, await decodeAudio(context, await sources[0]!.bytes()));
}

/** Plays the transition cue when rain is disabled; cleans up finished sources. */
export class RainAudioCue {
  cueSource: RainAudioSource | undefined;

  constructor(
    public context: RainAudioContext,
    public cue: unknown,
    private readonly route: (context: RainAudioContext, source: RainAudioSource) => void,
  ) {}

  setRainEnabled(enabled: boolean): void {
    if (!enabled) this.playCue();
  }

  dispose(): void {
    if (this.cueSource) {
      try { this.cueSource.stop(); } catch { /* The source may already have stopped. */ }
      this.cueSource.disconnect();
      this.cueSource = undefined;
    }
  }

  playCue(): void {
    if (this.cueSource) {
      try { this.cueSource.stop(); } catch { /* The source may already have stopped. */ }
      this.cueSource.disconnect();
    }
    const source = this.context.createBufferSource();
    source.buffer = this.cue;
    this.route(this.context, source);
    source.onended = () => {
      if (this.cueSource === source) {
        source.disconnect();
        this.cueSource = undefined;
      }
    };
    source.start();
    this.cueSource = source;
  }
}
