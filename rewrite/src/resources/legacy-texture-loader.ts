import {
  ClampToEdgeWrapping,
  type CompressedPixelFormat,
  CompressedTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  RGBA_S3TC_DXT1_Format,
  RGB_S3TC_DXT1_Format,
  Texture,
  UnsignedByteType,
} from "three";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";

import { decodePngRgba } from "./png-decoder";
import { normalizeLegacyTextureAlpha } from "./texture-alpha";

export interface TextureResource {
  extension: string;
  virtualPath: string;
  canonicalPath?: string;
  bytes(): Promise<Uint8Array>;
}

/** D3D9 sampler fields stored alongside each legacy texture reference. */
export interface LegacyTextureSampler {
  addressU: number;
  addressV: number;
  magFilter: number;
  minFilter: number;
  mipFilter: number;
  maxAnisotropy: number;
}

function wrapping(address: number) {
  if (address === 1) return RepeatWrapping;
  if (address === 2) return MirroredRepeatWrapping;
  if (address === 3) return ClampToEdgeWrapping;
  throw new Error(`D3DTEXTUREADDRESS ${address} 尚未映射。`);
}

function magnificationFilter(filter: number) {
  if (filter === 0 || filter === 1) return NearestFilter;
  if ([2, 3, 4, 5].includes(filter)) return LinearFilter;
  throw new Error(`D3DTEXF mag ${filter} 尚未映射。`);
}

function minificationFilter(filter: number, mipFilter: number) {
  if (filter !== 1 && filter !== 2 && filter !== 3)
    throw new Error(`D3DTEXF min ${filter} 尚未映射。`);
  const linear = filter !== 1;
  if (mipFilter === 0) return linear ? LinearFilter : NearestFilter;
  if (mipFilter === 1)
    return linear ? LinearMipmapNearestFilter : NearestMipmapNearestFilter;
  if ([2, 3, 4, 5].includes(mipFilter))
    return linear ? LinearMipmapLinearFilter : NearestMipmapLinearFilter;
  throw new Error(`D3DTEXF mip ${mipFilter} 尚未映射。`);
}

/** Loads the four image formats used by the D3D9 resource archives. */
export async function loadLegacyTexture(resource: TextureResource,
  sampler: LegacyTextureSampler, skipPngDecode = false): Promise<Texture> {
  const extension = resource.extension.toLowerCase();
  const bytes = await resource.bytes();
  let texture: Texture;

  if (extension === "png") {
    // The third argument is retained for compatibility with the release
    // signature. Callers normally omit it; true leaves the original decode
    // bypass behavior intact.
    let image: Awaited<ReturnType<typeof decodePngRgba>> | undefined;
    try {
      if (!skipPngDecode) image = await decodePngRgba(bytes);
    } catch (error) {
      throw new Error(`${resource.virtualPath} PNG decode：${error instanceof Error ? error.message : String(error)}`);
    }
    const path = resource.canonicalPath ?? resource.virtualPath;
    if (/^(?:stuff|stuff2_)\/boostereffect\/[^/]+\//i.test(path) ||
        /(^|\/)effect\/enchant\/front\.png$/i.test(path.replaceAll("\\", "/")))
      normalizeLegacyTextureAlpha(image!.pixels, image!.width, image!.height);
    texture = new DataTexture(image!.pixels, image!.width, image!.height,
      RGBAFormat, UnsignedByteType);
    texture.premultiplyAlpha = false;
  } else if (extension === "dds") {
    const layout = new DDSLoader().parse(bytes.slice().buffer, true);
    if (!layout.format || layout.width <= 0 || layout.height <= 0 ||
        layout.mipmapCount <= 0)
      throw new Error(`${resource.virtualPath} DDS layout 无效。`);
    if (layout.format === RGBAFormat) {
      texture = new DataTexture(layout.mipmaps[0]!.data, layout.width,
        layout.height, RGBAFormat, UnsignedByteType);
    } else {
      const format = layout.format === RGBA_S3TC_DXT1_Format
        ? RGB_S3TC_DXT1_Format : layout.format;
      texture = new CompressedTexture(layout.mipmaps, layout.width,
        layout.height, format as CompressedPixelFormat, UnsignedByteType);
    }
  } else if (extension === "tga") {
    // The addon returns decoded pixel data, although @types/three currently
    // describes its parse result as a DataTexture instance.
    const image = new TGALoader().parse(bytes.slice().buffer) as unknown as
      { data: Uint8Array; width: number; height: number };
    texture = new DataTexture(image.data, image.width, image.height,
      RGBAFormat, UnsignedByteType);
    texture.flipY = false;
  } else if (extension === "jpg") {
    const bitmap = await createImageBitmap(new Blob([bytes.slice().buffer],
      { type: "image/jpeg" }), {
      colorSpaceConversion: "none", imageOrientation: "none",
      premultiplyAlpha: "none",
    });
    texture = new Texture(bitmap);
    texture.flipY = true;
  } else {
    throw new Error(`${resource.virtualPath} 的 ${extension || "unknown"} decoder 尚未闭合。`);
  }

  texture.name = resource.canonicalPath ?? resource.virtualPath;
  texture.colorSpace = NoColorSpace;
  if (extension !== "tga" && extension !== "jpg") texture.flipY = false;
  texture.generateMipmaps = sampler.mipFilter !== 0 &&
    !(texture instanceof CompressedTexture);
  texture.wrapS = wrapping(sampler.addressU);
  texture.wrapT = wrapping(sampler.addressV);
  texture.magFilter = magnificationFilter(sampler.magFilter);
  texture.minFilter = minificationFilter(sampler.minFilter, sampler.mipFilter);
  texture.anisotropy = sampler.minFilter === 3 || sampler.magFilter === 3
    ? sampler.maxAnisotropy : 1;
  texture.needsUpdate = true;
  return texture;
}
