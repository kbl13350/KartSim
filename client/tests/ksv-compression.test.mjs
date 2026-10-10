import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ksvCompression } from "../src/codecs/ksv-compression.ts";

const releaseSource = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const first = releaseSource.indexOf("const d60 = 4,");
const last = releaseSource.indexOf("const ah0 = 12,", first);
assert.ok(first >= 0 && last > first);
const releaseCompression = new Function(
  `${releaseSource.slice(first, last)}\nreturn fD;`)();

test("standalone Pako produces release-identical KSV zlib bytes", () => {
  for (const length of [0, 1, 2, 32, 255, 1024, 8192, 65536]) {
    const samples = [
      new Uint8Array(length),
      Uint8Array.from({ length }, (_, index) => (index * index + index * 17) & 255),
    ];
    for (const sample of samples) {
      for (const level of [0, 1, 6, 9]) {
        const expected = releaseCompression.deflate(sample, { level });
        const actual = ksvCompression.deflate(sample, { level });
        assert.deepEqual(actual, expected, `length ${length}, level ${level}`);
        assert.deepEqual(ksvCompression.inflate(expected), sample);
        assert.deepEqual(releaseCompression.inflate(actual), sample);
      }
    }
  }
});
