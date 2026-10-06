import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CompressedTextureLoader, DataTextureLoader, LinearMipmapLinearFilter,
  RGBAFormat, RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format,
  RGB_BPTC_SIGNED_Format, RGB_BPTC_UNSIGNED_Format, RGB_ETC1_Format,
  RGB_S3TC_DXT1_Format,
} from "three";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

function releaseLoaders(source: string): {
  DDS: typeof DDSLoader; TGA: typeof TGALoader;
} {
  const start = source.indexOf("class Jq extends VN {");
  const end = source.indexOf("\nfunction tK(", start);
  assert.ok(start >= 0 && end > start);
  const load = new Function("VN", "ON", "u4", "Wi", "Hi", "_l", "Gl",
    "Bl", "e9", "e5", `${source.slice(start, end)}\nreturn {DDS:Jq,TGA:eK};`);
  return load(CompressedTextureLoader, DataTextureLoader, RGB_S3TC_DXT1_Format,
    RGBA_S3TC_DXT3_Format, RGBA_S3TC_DXT5_Format, RGB_ETC1_Format,
    RGB_BPTC_SIGNED_Format, RGB_BPTC_UNSIGNED_Format, RGBAFormat,
    LinearMipmapLinearFilter) as { DDS: typeof DDSLoader; TGA: typeof TGALoader };
}

function dds(fourCC: string, pixelBytes: number, dxgiFormat?: number): ArrayBuffer {
  const extra = dxgiFormat === undefined ? 0 : 20;
  const data = new ArrayBuffer(128 + extra + pixelBytes);
  const header = new Int32Array(data, 0, 31);
  header[0] = 0x20534444;
  header[1] = 124;
  header[2] = 0x20000;
  header[3] = 4;
  header[4] = 4;
  header[7] = 1;
  header[21] = Array.from(fourCC).reduce((n, char, i) =>
    n | (char.charCodeAt(0) << (8 * i)), 0);
  if (dxgiFormat !== undefined) new Int32Array(data, 128, 5)[0] = dxgiFormat;
  const bytes = new Uint8Array(data);
  for (let i = 128 + extra; i < bytes.length; i++) bytes[i] = (i * 17) & 255;
  return data;
}

function tga(type: number, bits: number, data: number[], flags = 0,
  palette: number[] = []): Uint8Array {
  const header = new Uint8Array(18);
  header[1] = palette.length ? 1 : 0;
  header[2] = type;
  header[5] = palette.length / 3;
  header[7] = palette.length ? 24 : 0;
  header[12] = 2;
  header[14] = 2;
  header[16] = bits;
  header[17] = flags;
  return Uint8Array.from([...header, ...palette, ...data]);
}

test("DDS/TGA 解码可由 Three.js 原版可读源码替代", async () => {
  const source = await readFile(releaseFile, "utf8");
  const original = releaseLoaders(source);
  const ddsFixtures = [
    dds("DXT1", 8), dds("DXT3", 16), dds("DXT5", 16), dds("ETC1", 8),
    dds("DX10", 16, 95), dds("DX10", 16, 96),
  ];
  for (const [index, bytes] of ddsFixtures.entries()) {
    assert.deepEqual(new DDSLoader().parse(bytes, true),
      new original.DDS().parse(bytes, true), `DDS fixture ${index}`);
  }
  const tgaFixtures = [
    tga(2, 24, [0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255]),
    tga(2, 32, [0, 0, 255, 255, 0, 255, 0, 128,
      255, 0, 0, 255, 255, 255, 255, 0], 0x20),
    tga(3, 8, [0, 127, 200, 255], 0x10),
    tga(9, 8, [0x83, 1], 0, [255, 0, 0, 0, 255, 0]),
    tga(10, 24, [0x83, 0, 0, 255]),
  ];
  for (const [index, bytes] of tgaFixtures.entries()) {
    const buffer = Uint8Array.from(bytes).buffer as ArrayBuffer;
    assert.deepEqual(new TGALoader().parse(buffer),
      new original.TGA().parse(buffer), `TGA fixture ${index}`);
  }
});
