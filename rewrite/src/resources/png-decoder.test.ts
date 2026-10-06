import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";

import { decodePngRgba } from "./png-decoder";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

function originalDecoder(source: string): (bytes: Uint8Array) => Promise<unknown> {
  const start = source.indexOf("var rt = Uint8Array,");
  const end = source.indexOf("\nconst u8 =", start);
  assert.ok(start >= 0 && end > start);
  return new Function(`${source.slice(start, end)}\nreturn p2;`)() as
    (bytes: Uint8Array) => Promise<unknown>;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++)
      value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(12 + data.length);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set([...type].map(char => char.charCodeAt(0)), 4);
  result.set(data, 8);
  view.setUint32(8 + data.length, crc32(result.subarray(4, 8 + data.length)));
  return result;
}
function paeth(left: number, above: number, diagonal: number): number {
  const value = left + above - diagonal;
  const a = Math.abs(value - left), b = Math.abs(value - above), c = Math.abs(value - diagonal);
  return a <= b && a <= c ? left : b <= c ? above : diagonal;
}

function png(width: number, height: number, channels: 3 | 4,
  interlace: boolean, filter: number): Uint8Array {
  const pixels = Uint8Array.from({ length: width * height * channels },
    (_, index) => (index * 43 + 17) & 255);
  const passes: Array<[number, number, number, number]> = interlace ? [
    [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
    [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
  ] : [[0, 0, 1, 1]];
  const rows: number[] = [];
  for (const [startX, startY, stepX, stepY] of passes) {
    const columns = startX >= width ? 0 : Math.ceil((width - startX) / stepX);
    const lines = startY >= height ? 0 : Math.ceil((height - startY) / stepY);
    if (columns === 0 || lines === 0) continue;
    const previous = new Uint8Array(columns * channels);
    for (let row = 0; row < lines; row++) {
      const values = new Uint8Array(columns * channels);
      for (let column = 0; column < columns; column++) {
        const source = ((startY + row * stepY) * width + startX + column * stepX) * channels;
        values.set(pixels.subarray(source, source + channels), column * channels);
      }
      rows.push(filter);
      for (let index = 0; index < values.length; index++) {
        const left = index >= channels ? values[index - channels]! : 0;
        const above = previous[index]!;
        const diagonal = index >= channels ? previous[index - channels]! : 0;
        const predicted = filter === 1 ? left : filter === 2 ? above
          : filter === 3 ? Math.floor((left + above) / 2)
            : filter === 4 ? paeth(left, above, diagonal) : 0;
        rows.push((values[index]! - predicted) & 255);
      }
      previous.set(values);
    }
  }
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = channels === 4 ? 6 : 2;
  header[12] = interlace ? 1 : 0;
  const compressed = deflateSync(Uint8Array.from(rows));
  const middle = Math.max(1, Math.floor(compressed.length / 2));
  const pieces = [
    Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10),
    chunk("IHDR", header),
    chunk("IDAT", compressed.subarray(0, middle)),
    chunk("IDAT", compressed.subarray(middle)),
    chunk("IEND", new Uint8Array()),
  ];
  const output = new Uint8Array(pieces.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of pieces) { output.set(part, offset); offset += part.length; }
  return output;
}

test("RGB/RGBA、5 种滤镜和 Adam7 PNG 与发行版逐字节一致", async () => {
  const original = originalDecoder(await readFile(releaseFile, "utf8"));
  for (const channels of [3, 4] as const) {
    for (const interlace of [false, true]) {
      for (const filter of [0, 1, 2, 3, 4]) {
        const bytes = png(10, 9, channels, interlace, filter);
        assert.deepEqual(await decodePngRgba(bytes), await original(bytes),
          `channels=${channels} interlace=${interlace} filter=${filter}`);
      }
    }
  }
});

test("PNG 签名、CRC 和不支持的颜色格式保持发行版错误", async () => {
  const original = originalDecoder(await readFile(releaseFile, "utf8"));
  const valid = png(2, 2, 4, false, 0);
  const badSignature = valid.slice(); badSignature[0] = 0;
  const badCrc = valid.slice(); badCrc[29] = (badCrc[29] ?? 0) ^ 1;
  const badColor = valid.slice(); badColor[25] = 3;
  new DataView(badColor.buffer).setUint32(29, crc32(badColor.subarray(12, 29)));
  const outcome = async (decode: (bytes: Uint8Array) => Promise<unknown>, bytes: Uint8Array) => {
    try { return { value: await decode(bytes) }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  };
  for (const bytes of [badSignature, badCrc, badColor])
    assert.deepEqual(await outcome(decodePngRgba, bytes), await outcome(original, bytes));
});
