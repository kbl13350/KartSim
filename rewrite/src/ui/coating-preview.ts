/** A garage session for trying a coating without committing it to the kart. */
export interface CoatingChoice {
  family: string;
  resourceIndex: number;
  textureIndex: number;
  texturePath: string;
  unavailableReason?: string;
}

export interface CoatingScene<T> {
  setCoatingProjection(projection: T | {
    draws: unknown;
    texture: unknown;
  }): void;
}

export interface CoatingTextures {
  request(index: number): Promise<unknown>;
}

export class CoatingPreviewSession<T = unknown> {
  revision = 0;
  disposed = false;
  selected: CoatingChoice | undefined;

  constructor(
    readonly scene: CoatingScene<T>,
    readonly draws: unknown,
    readonly textures: CoatingTextures,
    readonly family: string,
    readonly baseline: T,
  ) {}

  get current(): CoatingChoice | undefined {
    return this.selected;
  }

  async select(choice: CoatingChoice): Promise<boolean> {
    if (this.disposed) throw new Error("车膜试穿已结束。");
    const revision = ++this.revision;
    if (choice.family !== this.family) throw new Error("车膜与车代不兼容。");
    if (choice.unavailableReason) throw new Error(choice.unavailableReason);
    if (
      !Number.isInteger(choice.resourceIndex) ||
      choice.resourceIndex < 0 || choice.resourceIndex > 65535 ||
      choice.textureIndex !== (choice.resourceIndex & 255) ||
      choice.textureIndex < 1 || choice.textureIndex >= 255 ||
      choice.texturePath !== `effect/envMap/env${choice.textureIndex}.png`
    ) {
      throw new Error("车膜资源映射尚未支持。");
    }

    let texture: unknown;
    try {
      texture = await this.textures.request(choice.textureIndex);
    } catch (error) {
      if (this.disposed || revision !== this.revision) return false;
      throw error;
    }
    if (this.disposed || revision !== this.revision) return false;
    this.scene.setCoatingProjection({ draws: this.draws, texture });
    this.selected = choice;
    return true;
  }

  cancel(): void {
    if (this.disposed) return;
    ++this.revision;
    this.scene.setCoatingProjection(this.baseline);
    this.selected = undefined;
  }

  dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.disposed = true;
  }
}
