export interface FlyingPetTextureDependencies {
  decodePng(bytes: Uint8Array): Promise<{ pixels: Uint8Array; width: number; height: number }>;
  paintColors(low: Uint8Array, high: Uint8Array, primary: unknown,
    highlight: unknown): Uint8Array;
  createTexture(pixels: Uint8Array, width: number, height: number, format: unknown): any;
  format: unknown;
  colorSpace: unknown;
  wrapping: unknown;
  filtering: unknown;
}

/** Loads and caches pet body and face textures, applying the owned paint mask. */
export class FlyingPetTextures {
  readonly textures = new Map<string, Promise<any>>();
  disposed = false;

  constructor(readonly assets: any, readonly primary: unknown, readonly high: unknown,
    readonly dependencies: FlyingPetTextureDependencies) {}

  body(): Promise<any> {
    return this.load("body").then(texture => {
      if (!texture) throw new Error("飞宠缺少主体贴图。");
      return texture;
    });
  }

  face(index: unknown): Promise<any> {
    return this.load(`f${String(index).padStart(2, "0")}`);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.textures.values())
      pending.then(texture => texture?.dispose(), () => {});
    this.textures.clear();
  }

  load(name: string): Promise<any> {
    if (this.disposed) throw new Error("飞宠贴图owner已释放。");
    let pending = this.textures.get(name);
    if (!pending) {
      pending = this.create(name);
      this.textures.set(name, pending);
    }
    return pending;
  }

  async create(name: string): Promise<any> {
    const painted = name === "body" || !!this.assets.find("f00_0.png");
    const paint = painted
      ? this.assets.find(name === "body" ? "0.png" : `${name}_0.png`)
      : undefined;
    const image = this.assets.find(name === "body" ? "1.png" :
      painted ? `${name}_1.png` : `${name}.png`);
    if (!image) return;
    const imageBytes = await image.bytes();
    const decoded = await this.dependencies.decodePng(imageBytes);
    let pixels = decoded.pixels;
    if (paint) {
      const paintBytes = await paint.bytes();
      const isRgba = (bytes: Uint8Array) => bytes[24] === 8 && bytes[25] === 6;
      if (isRgba(paintBytes) && isRgba(imageBytes)) {
        const mask = await this.dependencies.decodePng(paintBytes);
        if (mask.width === decoded.width && mask.height === decoded.height)
          pixels = this.dependencies.paintColors(mask.pixels, pixels, this.primary, this.high);
        else if (name !== "body") return;
      } else if (name !== "body") return;
    } else if (painted && name !== "body") return;
    const texture = this.dependencies.createTexture(
      pixels, decoded.width, decoded.height, this.dependencies.format);
    texture.name = `${this.assets.name}:${name}`;
    texture.colorSpace = this.dependencies.colorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = this.dependencies.wrapping;
    texture.minFilter = texture.magFilter = this.dependencies.filtering;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }
}
