import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";
import {
  ClampToEdgeWrapping, CompressedTexture, DataTexture, LinearFilter,
  LinearMipmapLinearFilter, LinearMipmapNearestFilter,
  MirroredRepeatWrapping, NearestFilter, NearestMipmapLinearFilter,
  NearestMipmapNearestFilter, NoColorSpace, RepeatWrapping, RGBAFormat,
  RGBA_S3TC_DXT1_Format, RGB_S3TC_DXT1_Format, Texture, UnsignedByteType,
} from "three";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";

import { loadLegacyTexture, type LegacyTextureSampler,
  type TextureResource } from "./legacy-texture-loader";
import { decodePngRgba } from "./png-decoder";
import { normalizeLegacyTextureAlpha } from "./texture-alpha";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseLoader() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("async function AB(");
  const last = source.indexOf("\nfunction aK(", first);
  assert.ok(first >= 0 && last > first);
  const bindings = {
    p2: decodePngRgba, aK: normalizeLegacyTextureAlpha,
    cK: normalizeLegacyTextureAlpha, J9: DataTexture, Pl: CompressedTexture,
    D9: Texture, Jq: DDSLoader, eK: TGALoader,
    e9: RGBAFormat, _9: UnsignedByteType,
    u4: RGBA_S3TC_DXT1_Format, $i: RGB_S3TC_DXT1_Format,
    v9: NoColorSpace,
    wb: (address: number) => {
      if (address === 1) return RepeatWrapping;
      if (address === 2) return MirroredRepeatWrapping;
      if (address === 3) return ClampToEdgeWrapping;
      throw new Error(`D3DTEXTUREADDRESS ${address} 尚未映射。`);
    },
    fK: (filter: number) => {
      if (filter === 0 || filter === 1) return NearestFilter;
      if ([2, 3, 4, 5].includes(filter)) return LinearFilter;
      throw new Error(`D3DTEXF mag ${filter} 尚未映射。`);
    },
    dK: (filter: number, mip: number) => {
      if (filter !== 1 && filter !== 2 && filter !== 3)
        throw new Error(`D3DTEXF min ${filter} 尚未映射。`);
      const linear = filter !== 1;
      if (mip === 0) return linear ? LinearFilter : NearestFilter;
      if (mip === 1) return linear ? LinearMipmapNearestFilter : NearestMipmapNearestFilter;
      if ([2, 3, 4, 5].includes(mip))
        return linear ? LinearMipmapLinearFilter : NearestMipmapLinearFilter;
      throw new Error(`D3DTEXF mip ${mip} 尚未映射。`);
    },
    _u: (bytes: Uint8Array) => bytes.slice().buffer,
  };
  return new Function(...Object.keys(bindings),
    `${source.slice(first, last)}\nreturn AB;`)(...Object.values(bindings)) as
    (resource: TextureResource, sampler: LegacyTextureSampler,
      skipPngDecode?: boolean) => Promise<Texture>;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name: string, body: Uint8Array): Uint8Array {
  const data = new Uint8Array(12 + body.length);
  const view = new DataView(data.buffer);
  view.setUint32(0, body.length);
  data.set([...name].map(char => char.charCodeAt(0)), 4);
  data.set(body, 8);
  view.setUint32(8 + body.length, crc32(data.subarray(4, 8 + body.length)));
  return data;
}

function tinyPng(): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, 2);
  view.setUint32(4, 1);
  header[8] = 8;
  header[9] = 6;
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Uint8Array.of(0, 0, 0, 0, 255,
      255, 40, 10, 255))), chunk("IEND", new Uint8Array())];
  return Uint8Array.from(parts.flatMap(part => [...part]));
}

function tinyDds(): Uint8Array {
  const buffer = new ArrayBuffer(136);
  const header = new Int32Array(buffer, 0, 31);
  header[0] = 0x20534444;
  header[1] = 124;
  header[2] = 0x20000;
  header[3] = 4;
  header[4] = 4;
  header[7] = 1;
  header[21] = 0x31545844; // DXT1
  new Uint8Array(buffer).set([0xff, 0x7f, 0, 0, 0, 0, 0, 0], 128);
  return new Uint8Array(buffer);
}

function tinyTga(): Uint8Array {
  const header = new Uint8Array(18);
  header[2] = 2;
  header[12] = 2;
  header[14] = 1;
  header[16] = 24;
  return Uint8Array.from([...header, 0, 0, 255, 0, 255, 0]);
}

function resource(extension: string, bytes: Uint8Array, virtualPath: string,
  canonicalPath?: string): TextureResource {
  return { extension, virtualPath, canonicalPath, bytes: async () => bytes.slice() };
}

function snapshot(texture: Texture) {
  const image = texture.image as { data?: Uint8Array; width?: number;
    height?: number; id?: string } | undefined;
  return {
    className: texture.constructor.name, name: texture.name,
    colorSpace: texture.colorSpace, format: texture.format,
    type: texture.type, flipY: texture.flipY,
    premultiplyAlpha: texture.premultiplyAlpha,
    generateMipmaps: texture.generateMipmaps, wrapS: texture.wrapS,
    wrapT: texture.wrapT, magFilter: texture.magFilter,
    minFilter: texture.minFilter, anisotropy: texture.anisotropy,
    version: texture.version,
    image: image && { width: image.width, height: image.height,
      id: image.id, data: image.data && [...image.data] },
    mipmaps: (texture as CompressedTexture).mipmaps?.map(mipmap => ({ width: mipmap.width,
      height: mipmap.height, data: [...mipmap.data] })),
  };
}

const sampler: LegacyTextureSampler = { addressU: 1, addressV: 3,
  minFilter: 3, magFilter: 2, mipFilter: 2, maxAnisotropy: 8 };

test("PNG 普通、补透明边和采样模式与发行版一致", async () => {
  const original = await releaseLoader();
  for (const path of ["scene/body.png", "stuff/boostereffect/smoke/a.png",
    "C:\\effect\\enchant\\front.png"]) {
    const input = resource("PNG", tinyPng(), path, path);
    const old = await original(input, sampler);
    const current = await loadLegacyTexture(input, sampler);
    assert.deepEqual(snapshot(current), snapshot(old), path);
  }
  for (const minFilter of [1, 2, 3])
    for (const mipFilter of [0, 1, 2]) {
      const state = { ...sampler, minFilter, mipFilter };
      const input = resource("png", tinyPng(), "scene/a.png");
      assert.deepEqual(snapshot(await loadLegacyTexture(input, state)),
        snapshot(await original(input, state)));
    }
});

test("DDS 压缩格式和 TGA 解码与发行版一致", async () => {
  const original = await releaseLoader();
  for (const input of [resource("dds", tinyDds(), "track/road.dds"),
    resource("tga", tinyTga(), "track/map.tga")])
    assert.deepEqual(snapshot(await loadLegacyTexture(input, sampler)),
      snapshot(await original(input, sampler)));
});

test("JPG 图像包装和失败路径与发行版一致", async () => {
  const original = await releaseLoader();
  const previous = globalThis.createImageBitmap;
  const bitmap = { id: "decoded-jpeg", width: 3, height: 5 } as unknown as ImageBitmap;
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true, value: async () => bitmap,
  });
  try {
    const input = resource("jpg", Uint8Array.of(1, 2, 3), "character/face.jpg");
    assert.deepEqual(snapshot(await loadLegacyTexture(input, sampler)),
      snapshot(await original(input, sampler)));
  } finally {
    Object.defineProperty(globalThis, "createImageBitmap", {
      configurable: true, value: previous,
    });
  }
  const capture = async (run: () => Promise<unknown>) =>
    run().then(() => "success", error => String(error));
  for (const [input, state] of [
    [resource("gif", new Uint8Array(), "odd.gif"), sampler],
    [resource("png", new Uint8Array(), "bad.png"), sampler],
    [resource("png", tinyPng(), "a.png"), { ...sampler, addressU: 99 }],
    [resource("png", tinyPng(), "a.png"), { ...sampler, minFilter: 99 }],
  ] as Array<[TextureResource, LegacyTextureSampler]>)
    assert.equal(await capture(() => loadLegacyTexture(input, state)),
      await capture(() => original(input, state)));
});
