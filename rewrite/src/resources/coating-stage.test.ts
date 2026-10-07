import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";
import { DataTexture, LinearFilter, NearestFilter, NoColorSpace,
  RepeatWrapping, RGBAFormat, Texture, UnsignedByteType } from "three";

import { CoatingFrameClock, CoatingTextureManager, StageTextureBinding,
  type CoatingArchive } from "./coating-stage";
import { decodePngRgba } from "./png-decoder";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseClasses() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("class vB {");
  const last = source.indexOf("\nfunction bo(", first);
  assert.ok(first >= 0 && last > first);
  const bindings = { p2: decodePngRgba, J9: DataTexture, e9: RGBAFormat,
    _9: UnsignedByteType, v9: NoColorSpace, S1: RepeatWrapping,
    u9: LinearFilter, h9: NearestFilter };
  return new Function(...Object.keys(bindings),
    `${source.slice(first, last)}\nreturn {Clock:vB, Manager:yB, Stage:ha};`)(
      ...Object.values(bindings)) as { Clock: typeof CoatingFrameClock;
      Manager: typeof CoatingTextureManager; Stage: typeof StageTextureBinding };
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

function archive(images: Map<string, Uint8Array>): CoatingArchive {
  return { exactCanonicalCandidates: filename => {
    const data = images.get(filename);
    return data ? [{ bytes: async () => data.slice() }] : [];
  } };
}

function textureSnapshot(texture: DataTexture) {
  const data = (texture.image as unknown as { data: Uint8Array }).data;
  return { name: texture.name, colorSpace: texture.colorSpace,
    format: texture.format, type: texture.type, wrapS: texture.wrapS,
    wrapT: texture.wrapT, magFilter: texture.magFilter,
    minFilter: texture.minFilter, generateMipmaps: texture.generateMipmaps,
    flipY: texture.flipY, unpackAlignment: texture.unpackAlignment,
    version: texture.version, image: { width: texture.image.width,
      height: texture.image.height, bytes: [...data] } };
}

test("车膜 uint32 时钟摆动、节流和越界与发行版一致", async () => {
  const { Clock } = await releaseClasses();
  const old = new Clock(), current = new CoatingFrameClock();
  for (let time = 0; time < 4000; time += 13) {
    assert.equal(current.advance(time), old.advance(time));
    assert.deepEqual({ position: current.position, direction: current.direction,
      deadline: current.deadline }, { position: old.position,
      direction: old.direction, deadline: old.deadline });
  }
  for (const time of [-1, 1.5, 0x1_0000_0000]) {
    assert.throws(() => current.advance(time), /uint32/);
    assert.throws(() => old.advance(time), /uint32/);
  }
});

test("车膜纹理载入、逐帧复制和释放与发行版一致", async () => {
  const { Manager } = await releaseClasses();
  const images = new Map([
    ["effect/envMap/env1.png", png(256, 128)],
    ["effect/envMap/env2.png", png(128, 128)],
    ["effect/envMap/env255.png", png(256, 256)],
  ]);
  const old = new Manager(archive(images));
  const current = new CoatingTextureManager(archive(images));
  for (const index of [1, 2, 255]) {
    const oldPending = old.request(index);
    const currentPending = current.request(index);
    assert.equal(old.request(index), oldPending);
    assert.equal(current.request(index), currentPending);
    assert.deepEqual(textureSnapshot(await currentPending),
      textureSnapshot(await oldPending), `index ${index}`);
  }
  for (const time of [0, 31, 62, 93, 94, 250]) {
    old.advance(time);
    current.advance(time);
    for (const index of [1, 2, 255])
      assert.deepEqual(textureSnapshot(current.ready.get(index)!.texture),
        textureSnapshot(old.ready.get(index)!.texture),
        `index ${index}, time ${time}`);
  }
  old.dispose();
  current.dispose();
  assert.equal(current.disposed, old.disposed);
  assert.equal(current.ready.size, old.ready.size);
  await assert.rejects(current.request(1), /已释放/);
  await assert.rejects(old.request(1), /已释放/);
});

test("共享场景绑定的事务、所有权和照明状态与发行版一致", async () => {
  const { Stage } = await releaseClasses();
  const trace = (StageClass: typeof StageTextureBinding) => {
    const binding = new StageClass();
    const first = archive(new Map());
    const second = archive(new Map());
    const events: string[] = [];
    const shared = binding.coatingTextures(first);
    const staged = binding.prepareCoatingStage();
    const next = staged.textures(first);
    const other = staged.textures(second);
    events.push(`same-clock:${shared.clock === next.clock}`);
    events.push(`same-staged:${next === staged.textures(first)}`);
    staged.commit();
    events.push(`old-disposed:${shared.disposed}`);
    binding.beginFrame(31);
    events.push(`clock:${next.clock.position},${other.clock.position}`);
    const aborted = binding.prepareCoatingStage();
    const abandoned = aborted.textures(first);
    aborted.dispose();
    events.push(`aborted:${abandoned.disposed}`);
    try { aborted.commit(); } catch (error) { events.push(String(error)); }
    const texture = new Texture();
    texture.addEventListener("dispose", () => events.push("texture.dispose"));
    const owner = { requestTexture: () => texture,
      takeBoundTexture: (bound: Texture | null) => bound === texture
        ? texture : undefined };
    events.push(`request:${binding.request(owner) === texture}`);
    binding.retain(owner);
    binding.setLightFactor(0.4);
    events.push(`light:${binding.lightFactor()}`);
    binding.release();
    events.push(`released:${next.disposed},${other.disposed},${
      binding.currentTexture() === null}`);
    binding.dispose();
    try { binding.coatingTextures(first); } catch (error) {
      events.push(String(error));
    }
    return events;
  };
  assert.deepEqual(trace(StageTextureBinding), trace(Stage));
});
