import assert from "node:assert/strict";
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { readMountManifestDetails } from "./mount-manifest.ts";
import { rhoXor } from "./mount-manifest.ts";
import { rhoAdler32 } from "./common.ts";
import { scanRhoArchiveIndex } from "./rho-index-scan.ts";
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

test("真实 p3553 Rho 1.1 头、数据块和目录索引与发行版逐字段一致", async () => {
  const { PX } = await originalFormats();
  const mounts = (await readMountManifestDetails(source("aaa.pk"))).mounts;
  for (const name of ["stage_.rho", "track_fairy_I01.rho", "zeta_cn_ppl.rho"]) {
    const archive = source(name);
    const mount = mounts.find(item => item.fileName === name);
    const key = mount?.key === 0 ? undefined : mount?.key;
    const original = (await PX(archive, key)).index;
    const rewritten = await scanRhoArchiveIndex(archive, key);
    assert.deepEqual(rewritten, original, name);
    assert.ok(rewritten.files.length > 0, name);
  }
});

test("合成 Rho 1.0 根目录扫描与发行版一致", async () => {
  const { PX } = await originalFormats();
  const key = 0x12345678;
  const bytes = new Uint8Array(520);
  const signature = "Rh layer spec 1.0";
  for (let index = 0; index < signature.length; index++)
    new DataView(bytes.buffer).setUint16(index * 2, signature.charCodeAt(index), true);
  const header = new Uint8Array(128);
  const view = new DataView(header.buffer);
  view.setUint32(4, 65536, true);
  view.setUint32(8, 1, true);
  view.setUint32(12, 0x10203040, true);
  const mask = Uint8Array.from({ length: 32 }, (_, index) => index * 7 + 1);
  header.set(mask, 16);
  view.setUint32(48, 4229928824, true);
  view.setUint32(0, rhoAdler32(header.subarray(4)), true);
  bytes.set(rhoXor(header, key), 128);
  const block = new Uint8Array(32);
  const record = new DataView(block.buffer);
  record.setUint32(0, 0xffffffff, true);
  record.setUint32(4, 2, true);
  record.setUint32(8, 8, true);
  record.setUint32(12, 8, true);
  bytes.set(block.map((byte, index) => byte ^ mask[index]), 256);
  const archive = {
    name: "fixture.rho", size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer,
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => bytes.slice(start, end).buffer,
    }),
  };
  const original = (await PX(archive, key)).index;
  const rewritten = await scanRhoArchiveIndex(archive, key);
  assert.deepEqual(rewritten, original);
  assert.equal(rewritten.version, "1.0");
  assert.deepEqual(rewritten.files, []);
});
