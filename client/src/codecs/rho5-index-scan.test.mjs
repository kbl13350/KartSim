import assert from "node:assert/strict";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { scanRho5ArchiveIndex } from "./rho5-index-scan.ts";
import { originalFormats } from "./original-format-oracle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function source(name) {
  const filename = path.join(root, "mirror/p3553", name);
  const size = statSync(filename).size;
  return {
    name, size,
    arrayBuffer: async () => Uint8Array.from(await readFile(filename)).buffer,
    slice: (start = 0, end = size) => ({
      arrayBuffer: async () => {
        const bytes = new Uint8Array(end - start);
        const fd = openSync(filename, "r");
        try {
          let cursor = 0;
          while (cursor < bytes.length) {
            const count = readSync(fd, bytes, cursor, bytes.length - cursor, start + cursor);
            assert.ok(count > 0);
            cursor += count;
          }
          return bytes.buffer;
        } finally { closeSync(fd); }
      },
    }),
  };
}

test("真实 DataPack1 双分包扫描索引与发行版逐字段一致", async () => {
  const { MY } = await originalFormats();
  const parts = [source("DataPack1_00000.rho5"), source("DataPack1_00001.rho5")];
  const original = (await MY(parts, "CN")).index;
  const rewritten = await scanRho5ArchiveIndex(parts, "CN");
  assert.deepEqual(rewritten, original);
  assert.ok(rewritten.files.length > 0);
});

test("无地区提示时自动识别真实 Rho5 分包", async () => {
  const { MY } = await originalFormats();
  const part = source("DataPack4_00004.rho5");
  const original = (await MY([part])).index;
  const rewritten = await scanRho5ArchiveIndex([part]);
  assert.deepEqual(rewritten, original);
});
