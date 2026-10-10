export interface FlyingPetMediaDependencies {
  directory: string;
  parseScene(bytes: Uint8Array): unknown;
  buildScene(parsed: unknown, library: unknown, name: string,
    resolve: (reference: { name: string }) => unknown, options: unknown): Promise<any>;
  decodeAudio(context: unknown, bytes: Uint8Array): Promise<unknown>;
  connectAudio(context: unknown, source: any, category: string): void;
}

/** Load a public flying pet effect and resolve textures only from its own folder. */
export async function loadFlyingPetEffect(library: any, name: string,
  environment: unknown, binding: unknown,
  ops: FlyingPetMediaDependencies): Promise<any> {
  const entry = (filename: string) => {
    const found = library.get(`${ops.directory}/${filename}`);
    if (!found) throw new Error(`飞宠公共效果缺少 ${filename}。`);
    return found;
  };
  return ops.buildScene(
    ops.parseScene(await entry(`${name}.1s`).bytes()),
    library, `flyingPet:${name}`,
    reference => ({ status: "found", entry: entry(`${reference.name}.png`) }),
    {
      environment, stageBinding: binding, advanceEnvironment: false,
      convertClientCoordinates: false,
    },
  );
}

/** Read the pet's "head mounted" cue only when an audio context exists. */
export async function loadFlyingPetAliveSound(asset: any, context: unknown,
  ops: FlyingPetMediaDependencies): Promise<unknown> {
  const entry = context && asset.sound("펫머리얹기");
  const bytes = entry && await entry.bytes();
  const decoded = bytes && await ops.decodeAudio(context, bytes);
  return decoded || undefined;
}

export class FlyingPetAudio {
  readonly active = new Set<any>();
  disposed = false;

  constructor(readonly context: any, readonly alive: unknown,
    readonly dependencies: FlyingPetMediaDependencies) {}

  playAlive(): void {
    if (this.disposed || !this.context || !this.alive) return;
    const source = this.context.createBufferSource();
    source.buffer = this.alive;
    this.dependencies.connectAudio(this.context, source, "fx");
    this.active.add(source);
    source.addEventListener("ended", () => {
      source.disconnect();
      this.active.delete(source);
    }, { once: true });
    source.start();
  }

  dispose(): void {
    this.disposed = true;
    for (const source of this.active) {
      source.stop();
      source.disconnect();
    }
    this.active.clear();
  }
}
