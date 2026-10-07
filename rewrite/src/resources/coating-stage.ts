import {
  DataTexture, LinearFilter, NearestFilter, NoColorSpace,
  RepeatWrapping, RGBAFormat, type Texture, UnsignedByteType,
} from "three";

import { decodePngRgba, type DecodedPng } from "./png-decoder";

interface ArchiveCandidate {
  bytes(): Promise<Uint8Array>;
}

export interface CoatingArchive {
  exactCanonicalCandidates(path: string): ArchiveCandidate[];
}

interface BoundTextureOwner {
  requestTexture(): Texture | undefined;
  takeBoundTexture(texture: Texture | null): Texture | undefined;
}

function copyFrame(source: DecodedPng, column: number, height: number,
  target: Uint8Array): void {
  for (let row = 0; row < height; row++) {
    const offset = (row * source.width + column) * 4;
    target.set(source.pixels.subarray(offset, offset + 128 * 4), row * 128 * 4);
  }
}

/** Advances the 120-column coating atlas on the same uint32 clock as the game. */
export class CoatingFrameClock {
  position = 0;
  direction = 1;
  deadline = 0;

  advance(time: number): boolean {
    if (!Number.isInteger(time) || time < 0 || time > 0xffffffff)
      throw new Error("车膜时钟必须是 uint32。");
    if (time <= this.deadline) return false;
    this.deadline = (time + 30) >>> 0;
    this.position += this.direction;
    if (this.position === 120) this.direction = -1;
    else if (this.position === 0) this.direction = 1;
    return true;
  }
}

/** Owns a library's decoded coating atlases and their live GPU textures. */
export class CoatingTextureManager {
  pending = new Map<number, Promise<DataTexture>>();
  ready = new Map<number, { source: DecodedPng; texture: DataTexture }>();
  disposed = false;

  constructor(public library: CoatingArchive,
    public clock = new CoatingFrameClock()) {}

  request(index: number): Promise<DataTexture> {
    if (!Number.isInteger(index) || index < 1 || index > 255)
      return Promise.reject(new Error("车膜纹理索引尚未支持。"));
    if (this.disposed)
      return Promise.reject(new Error("车膜纹理管理器已释放。"));
    const pending = this.pending.get(index);
    if (pending) return pending;
    const load = this.load(index);
    this.pending.set(index, load);
    load.catch(() => {
      if (this.pending.get(index) === load) this.pending.delete(index);
    });
    return load;
  }

  advance(time: number): void {
    if (!Number.isInteger(time) || time < 0 || time > 0xffffffff)
      throw new Error("车膜时钟必须是 uint32。");
    if (this.disposed || !this.clock.advance(time)) return;
    for (const { source, texture } of this.ready.values()) {
      if (source.width < 256) continue;
      copyFrame(source, this.clock.position, 128,
        (texture.image as unknown as { data: Uint8Array }).data);
      texture.needsUpdate = true;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const { texture } of this.ready.values()) texture.dispose();
    this.ready.clear();
    this.pending.clear();
  }

  async load(index: number): Promise<DataTexture> {
    const path = `effect/envMap/env${index}.png`;
    const candidates = this.library.exactCanonicalCandidates(path);
    if (candidates.length !== 1)
      throw new Error(`车膜纹理缺失或不唯一：${path}`);
    const image = await decodePngRgba(await candidates[0]!.bytes());
    if (!(index === 255
      ? image.width === 256 && image.height === 256
      : (image.width === 128 || image.width === 256) && image.height === 128))
      throw new Error(`车膜纹理尺寸尚未支持：${image.width}×${image.height}`);
    if (this.disposed) throw new Error("车膜纹理管理器已释放。");

    const pixels = new Uint8Array(128 * image.height * 4);
    copyFrame(image, 0, image.height, pixels);
    const texture = new DataTexture(pixels, 128, image.height,
      RGBAFormat, UnsignedByteType);
    texture.name = path;
    texture.colorSpace = NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    this.ready.set(index, { source: image, texture });
    return texture;
  }
}

interface CoatingStage {
  validate(): void;
  textures(library: CoatingArchive): CoatingTextureManager;
  commit(): void;
  dispose(): void;
}

/** Shared texture ownership and staged coating replacement for a track scene. */
export class StageTextureBinding {
  current: Texture | null = null;
  retained: Texture | null = null;
  light = 1;
  coatings = new Map<CoatingArchive, CoatingTextureManager>();
  coatingClocks = new Map<CoatingArchive, CoatingFrameClock>();
  coatingTransitions = new Set<CoatingStage>();
  coatingRevision = 0;
  coatingsDisposed = false;

  coatingTextures(library: CoatingArchive): CoatingTextureManager {
    if (this.coatingsDisposed)
      throw new Error("共享车膜渲染绑定已释放。");
    let textures = this.coatings.get(library);
    if (!textures) {
      textures = this.newCoatingTextures(library);
      this.coatings.set(library, textures);
    }
    return textures;
  }

  newCoatingTextures(library: CoatingArchive): CoatingTextureManager {
    let clock = this.coatingClocks.get(library);
    if (!clock) {
      clock = new CoatingFrameClock();
      this.coatingClocks.set(library, clock);
    }
    return new CoatingTextureManager(library, clock);
  }

  prepareCoatingStage(): CoatingStage {
    if (this.coatingsDisposed)
      throw new Error("共享车膜渲染绑定已释放。");
    const revision = this.coatingRevision;
    const next = new Map<CoatingArchive, CoatingTextureManager>();
    let active = true;
    const validate = () => {
      if (!active || this.coatingsDisposed || revision !== this.coatingRevision)
        throw new Error("车膜阶段事务已失效。");
    };
    const stage: CoatingStage = {
      validate,
      textures: library => {
        validate();
        let textures = next.get(library);
        if (!textures) {
          textures = this.newCoatingTextures(library);
          next.set(library, textures);
        }
        return textures;
      },
      commit: () => {
        validate();
        const previous = this.coatings;
        this.coatings = next;
        ++this.coatingRevision;
        active = false;
        this.coatingTransitions.delete(stage);
        for (const textures of previous.values()) textures.dispose();
      },
      dispose: () => {
        if (!active) return;
        active = false;
        this.coatingTransitions.delete(stage);
        for (const textures of next.values()) textures.dispose();
      },
    };
    this.coatingTransitions.add(stage);
    return stage;
  }

  request(owner: BoundTextureOwner): Texture | null {
    const texture = owner.requestTexture();
    if (texture && texture !== this.current) {
      this.retained?.dispose();
      this.retained = null;
      this.current = texture;
    }
    return this.current;
  }

  currentTexture(): Texture | null { return this.current; }

  beginFrame(time: number): void {
    const frame = Math.trunc(time) >>> 0;
    for (const [library, clock] of this.coatingClocks) {
      const textures = this.coatings.get(library);
      if (textures) textures.advance(frame);
      else clock.advance(frame);
    }
  }

  retain(owner: BoundTextureOwner): void {
    const texture = owner.takeBoundTexture(this.current);
    if (texture) {
      this.retained?.dispose();
      this.retained = texture;
    }
  }

  setLightFactor(value: number): void { this.light = value; }
  lightFactor(): number { return this.light; }

  release(): void {
    for (const transition of [...this.coatingTransitions]) transition.dispose();
    for (const textures of this.coatings.values()) textures.dispose();
    this.coatings.clear();
    this.coatingClocks.clear();
    this.retained?.dispose();
    this.retained = null;
    this.current = null;
    ++this.coatingRevision;
  }

  dispose(): void {
    this.coatingsDisposed = true;
    this.release();
  }
}
