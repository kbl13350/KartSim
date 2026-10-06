import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deflateSync } from "node:zlib";

import { unzlibSync } from "fflate";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

function releaseInflate(source: string): (bytes: Uint8Array) => Uint8Array {
  const start = source.indexOf("var rt = Uint8Array,");
  const end = source.indexOf("var Hq =", start);
  assert.ok(start >= 0 && end > start);
  return new Function(`${source.slice(start, end)}\nreturn V6;`)() as
    (bytes: Uint8Array) => Uint8Array;
}

test("PNG zlib 解码和同版 fflate 一致", async () => {
  const source = await readFile(releaseFile, "utf8");
  const original = releaseInflate(source);
  const inputs = [
    Uint8Array.of(),
    Uint8Array.from({ length: 7 }, (_, i) => i * 17),
    Uint8Array.from({ length: 32_768 }, (_, i) => i % 29),
    Uint8Array.from({ length: 4_097 }, (_, i) => (i * 7919) & 255),
  ];
  for (const input of inputs) {
    for (const level of [0, 1, 6, 9]) {
      const compressed = deflateSync(input, { level });
      assert.deepEqual(unzlibSync(compressed), original(compressed),
        `input length ${input.length}, level ${level}`);
    }
  }
});
