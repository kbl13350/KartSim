export const INTERFACE_AUDIO_PATHS = {
  click: "sound_/fx/interface/click.flac",
  start: "sound_/fx/interface/startButton.flac",
  hover: "sound_/fx/interface/mouseOver.flac",
  slotChanger: "sound_/fx/etc/slot_changer.flac",
} as const;

export interface InterfaceAudioDependencies {
  decode(context: AudioContext, bytes: Uint8Array): Promise<AudioBuffer>;
  route(context: AudioContext, source: AudioBufferSourceNode): void;
}

export interface InterfaceAudioLibrary {
  exactCanonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

export async function loadRequiredInterfaceAudio(
  library: InterfaceAudioLibrary, context: AudioContext, path: string,
  dependencies: InterfaceAudioDependencies,
): Promise<AudioBuffer> {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`${path} source 数量 ${candidates.length}。`);
  return dependencies.decode(context, await candidates[0]!.bytes());
}

export async function loadOptionalInterfaceAudio(
  library: InterfaceAudioLibrary, context: AudioContext, path: string,
  dependencies: InterfaceAudioDependencies,
): Promise<AudioBuffer | undefined> {
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length > 1)
    throw new Error(`${path} source 数量 ${candidates.length}。`);
  if (!candidates.length) return undefined;
  return dependencies.decode(context, await candidates[0]!.bytes());
}

/** Plays one instance of each interface cue at a time. */
export class InterfaceAudio {
  activeStart?: AudioBufferSourceNode;
  activeClick?: AudioBufferSourceNode;
  activeHover?: AudioBufferSourceNode;
  activeSlotChanger?: AudioBufferSourceNode;

  constructor(
    readonly context: AudioContext,
    readonly clickBuffer: AudioBuffer,
    readonly hoverBuffer: AudioBuffer | undefined,
    readonly slotChangerBuffer: AudioBuffer,
    readonly startBuffer: AudioBuffer,
    readonly dependencies: InterfaceAudioDependencies,
  ) {}

  static async load<T extends InterfaceAudio>(
    library: InterfaceAudioLibrary, context: AudioContext,
    dependencies: InterfaceAudioDependencies,
    create: (click: AudioBuffer, hover: AudioBuffer | undefined,
      slotChanger: AudioBuffer, start: AudioBuffer) => T,
  ): Promise<T> {
    const [click, hover, slotChanger, start] = await Promise.all([
      loadRequiredInterfaceAudio(library, context,
        INTERFACE_AUDIO_PATHS.click, dependencies),
      loadOptionalInterfaceAudio(library, context,
        INTERFACE_AUDIO_PATHS.hover, dependencies),
      loadRequiredInterfaceAudio(library, context,
        INTERFACE_AUDIO_PATHS.slotChanger, dependencies),
      loadRequiredInterfaceAudio(library, context,
        INTERFACE_AUDIO_PATHS.start, dependencies),
    ]);
    return create(click, hover, slotChanger, start);
  }

  private play(key: "activeStart" | "activeClick" | "activeHover" |
    "activeSlotChanger", buffer: AudioBuffer | undefined): void {
    if (!buffer || this[key]) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    this.dependencies.route(this.context, source);
    source.onended = () => {
      source.disconnect();
      if (this[key] === source) this[key] = undefined;
    };
    this[key] = source;
    source.start();
  }

  playStart(): void { this.play("activeStart", this.startBuffer); }
  playClick(): void { this.play("activeClick", this.clickBuffer); }
  playHover(): void { this.play("activeHover", this.hoverBuffer); }
  playSlotChanger(): void {
    this.play("activeSlotChanger", this.slotChangerBuffer);
  }

  dispose(): void {
    for (const source of [this.activeClick, this.activeHover,
      this.activeSlotChanger, this.activeStart]) {
      if (!source) continue;
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.activeStart = undefined;
    this.activeClick = undefined;
    this.activeHover = undefined;
    this.activeSlotChanger = undefined;
  }
}
