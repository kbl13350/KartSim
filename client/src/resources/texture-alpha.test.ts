import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { normalizeLegacyTextureAlpha } from "./texture-alpha";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

test("旧增压与强化贴图的透明度和边缘扩散与发行版一致", async () => {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("function aK(");
  const end = source.indexOf("\nfunction uK(", start);
  assert.ok(start >= 0 && end > start);
  const original = new Function(`${source.slice(start, end)}\nreturn {aK,cK};`)() as {
    aK: (pixels: Uint8Array, width: number, height: number) => void;
    cK: (pixels: Uint8Array, width: number, height: number) => void;
  };
  const fixtures: Array<[number, number, number[]]> = [
    [1, 1, [0, 0, 0, 255]],
    [2, 1, [120, 60, 0, 255, 0, 0, 0, 255]],
    [3, 2, [255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 255, 255, 0, 0, 0, 0]],
    [2, 2, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    [0, 0, []],
    [2, 2, [255, 0, 0, 255]], // Invalid image size preserves the released early return.
  ];
  let random = 0x12345678;
  for (let sample = 0; sample < 24; sample++) {
    const pixels: number[] = [];
    for (let index = 0; index < 7 * 5 * 4; index++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      pixels.push((random >>> 16) & 255);
    }
    fixtures.push([7, 5, pixels]);
  }
  for (const [index, [width, height, pixels]] of fixtures.entries()) {
    for (const originalMethod of [original.aK, original.cK]) {
      const expected = Uint8Array.from(pixels);
      const actual = Uint8Array.from(pixels);
      originalMethod(expected, width, height);
      normalizeLegacyTextureAlpha(actual, width, height);
      assert.deepEqual(actual, expected, `texture fixture ${index}`);
    }
  }
});
