import { ClampToEdgeWrapping, DataTexture, NearestFilter, NoColorSpace,
  RGBAFormat, UnsignedByteType } from "three";

import { decodePngRgba } from "./png-decoder";

const toonPath = "etc_/toon.png";

interface ToonCandidate {
  sourceKind: string;
  sourceName: string;
  containerId: string;
  bytes(): Promise<Uint8Array>;
}

export interface ToonArchive {
  exactCanonicalCandidates(path: string): ToonCandidate[];
}

/** Owns the exact DataPack1 toon ramp texture used by track materials. */
export class ToonEnvironmentTexture {
  constructor(public texture: DataTexture | undefined) {}

  static async load(library: ToonArchive): Promise<ToonEnvironmentTexture> {
    const candidates = library.exactCanonicalCandidates(toonPath);
    if (candidates.length !== 1)
      throw new Error(`${toonPath} exact source 数量应为 1，实际为 ${candidates.length}。`);
    const candidate = candidates[0]!;
    if (candidate.sourceKind !== "rho5" ||
        candidate.sourceName !== "DataPack1_00001.rho5" ||
        candidate.containerId !== "rho5:datapack1")
      throw new Error(`${toonPath} 不来自当前 P3528 DataPack1 exact owner。`);
    return this.fromBytes(await candidate.bytes());
  }

  static async fromBytes(bytes: Uint8Array): Promise<ToonEnvironmentTexture> {
    const image = await decodePngRgba(bytes);
    if (image.width !== 128 || image.height !== 64)
      throw new Error(`toon.png dimensions 应为 128x64，实际为 ${image.width}x${image.height}。`);
    const texture = new DataTexture(image.pixels, image.width, image.height,
      RGBAFormat, UnsignedByteType);
    texture.name = toonPath;
    texture.colorSpace = NoColorSpace;
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return new this(texture);
  }

  requestTexture(): DataTexture | undefined { return this.texture; }

  takeBoundTexture(texture: DataTexture | null): DataTexture | undefined {
    if (!texture || this.texture !== texture) return undefined;
    this.texture = undefined;
    return texture;
  }

  dispose(): void {
    this.texture?.dispose();
    this.texture = undefined;
  }
}
