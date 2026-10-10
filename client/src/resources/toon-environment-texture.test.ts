import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { ClampToEdgeWrapping, DataTexture, NearestFilter, NoColorSpace,
  RGBAFormat, UnsignedByteType } from "three";

import { decodePngRgba } from "./png-decoder";
import { ToonEnvironmentTexture, type ToonArchive } from "./toon-environment-texture";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseClass() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf('const u8 = "etc_/toon.png";');
  const last = source.indexOf("\nclass vB {", first);
  assert.ok(first >= 0 && last > first);
  const bindings = { p2: decodePngRgba, J9: DataTexture,
    e9: RGBAFormat, _9: UnsignedByteType, v9: NoColorSpace,
    F1: ClampToEdgeWrapping, h9: NearestFilter };
  return new Function(...Object.keys(bindings),
    `${source.slice(first, last)}\nreturn rn;`)(...Object.values(bindings)) as
      typeof ToonEnvironmentTexture;
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

function png(width: number, height: number): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  const rows = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * (width * 4 + 1) + 1 + x * 4;
      rows.set([x & 255, y & 255, (x + y) & 255, 255], i);
    }
  const parts = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", header), chunk("IDAT", deflateSync(rows)),
    chunk("IEND", new Uint8Array())];
  return Uint8Array.from(parts.flatMap(part => [...part]));
}

function snapshot(owner: ToonEnvironmentTexture) {
  const texture = owner.requestTexture();
  if (!texture) return undefined;
  return { name: texture.name, colorSpace: texture.colorSpace,
    width: texture.image.width, height: texture.image.height,
    pixels: [...(texture.image as unknown as { data: Uint8Array }).data],
    wrapS: texture.wrapS, wrapT: texture.wrapT,
    magFilter: texture.magFilter, minFilter: texture.minFilter,
    generateMipmaps: texture.generateMipmaps, flipY: texture.flipY,
    unpackAlignment: texture.unpackAlignment, version: texture.version };
}

test("DataPack1 toon ramp 载入、参数和所有权与发行版一致", async () => {
  const Original = await releaseClass();
  const bytes = png(128, 64);
  const candidate = { sourceKind: "rho5", sourceName: "DataPack1_00001.rho5",
    containerId: "rho5:datapack1", bytes: async () => bytes };
  const archive: ToonArchive = { exactCanonicalCandidates: () => [candidate] };
  const old = await Original.load(archive);
  const current = await ToonEnvironmentTexture.load(archive);
  assert.deepEqual(snapshot(current), snapshot(old));
  assert.equal(current.takeBoundTexture(null), old.takeBoundTexture(null));
  const oldTexture = old.requestTexture()!;
  const currentTexture = current.requestTexture()!;
  assert.equal(current.takeBoundTexture(currentTexture), currentTexture);
  assert.equal(old.takeBoundTexture(oldTexture), oldTexture);
  assert.deepEqual(snapshot(current), snapshot(old));
  old.dispose();
  current.dispose();
  assert.deepEqual(snapshot(current), snapshot(old));
});

test("toon ramp 资源来源和尺寸约束与发行版一致", async () => {
  const Original = await releaseClass();
  const capture = async (run: () => Promise<unknown>) =>
    run().then(() => "success", error => String(error));
  const bytes = png(16, 16);
  for (const candidates of [[], [{ sourceKind: "rho5", sourceName: "wrong",
    containerId: "rho5:datapack1", bytes: async () => bytes }]]) {
    const archive = { exactCanonicalCandidates: () => candidates } as ToonArchive;
    assert.equal(await capture(() => ToonEnvironmentTexture.load(archive)),
      await capture(() => Original.load(archive)));
  }
  assert.equal(await capture(() => ToonEnvironmentTexture.fromBytes(bytes)),
    await capture(() => Original.fromBytes(bytes)));
});
