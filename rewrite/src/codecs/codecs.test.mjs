import assert from "node:assert/strict";
import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { ArchiveCatalog, decodeArchiveIndex } from "../resources/archive-index.ts";
import { md5 } from "./md5.ts";
import { readMountManifest } from "./mount-manifest.ts";
import { openVirtualFileLibrary } from "./virtual-files.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");
const fixtures = path.join(root, "recovered/data-full");

function localSource(spec) {
  const filename = path.join(mirror, "p3553", spec.name);
  return {
    name: spec.name,
    size: spec.size,
    arrayBuffer: () => readFile(filename).then(bytes => Uint8Array.from(bytes).buffer),
    slice: (start = 0, end = spec.size) => ({
      arrayBuffer: async () => {
        const length = end - start;
        const bytes = new Uint8Array(length);
        const descriptor = openSync(filename, "r");
        try {
          let filled = 0;
          while (filled < length) {
            const count = readSync(descriptor, bytes, filled, length - filled, start + filled);
            assert.ok(count > 0, `${spec.name} short read`);
            filled += count;
          }
          return bytes.buffer;
        } finally { closeSync(descriptor); }
      },
    }),
  };
}

test("纯 TypeScript MD5 与标准实现一致", () => {
  for (const value of ["", "a", "abc", "message digest", "a".repeat(1000)]) {
    const bytes = new TextEncoder().encode(value);
    const expected = createHash("md5").update(bytes).digest("hex");
    const actual = [...md5(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    assert.equal(actual, expected);
  }
});

test("真实 aaa.pk 挂载与 Rho/Rho5 解码结果匹配已导出的 XML", async () => {
  const manifest = parseResourceManifest(JSON.parse(await readFile(
    path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
  const index = await decodeArchiveIndex(Readable.toWeb(createReadStream(
    path.join(mirror, "__p3553/archive-index"))), manifest);
  const specs = new Map(manifest.files.map(spec => [spec.name.toLowerCase(), spec]));
  const store = { source(name) {
    const spec = specs.get(name.toLowerCase());
    assert.ok(spec, `missing source ${name}`);
    return localSource(spec);
  } };
  const catalog = new ArchiveCatalog(store, index);
  const mounts = await readMountManifest(catalog.mountManifest);
  assert.ok(mounts.length > 1000);
  const library = await openVirtualFileLibrary(catalog);
  assert.ok(library.files.length > 20_000);

  const cases = [
    { container: "stage_.rho", path: "stageClassNameList.bml" },
    { container: "zeta_cn_ppl.rho", path: "ppl.bml" },
    { container: "DataPack1", path: "etc_/defaultMacroChat@cn.xml" },
    { container: "DataPack2", path: "kart_/bike57/param.xml" },
    { container: "DataPack4", path: "zeta_/cn/loading/tip.xml" },
  ];
  for (const { container, path: resourcePath } of cases) {
    const file = library.files.find(item =>
      (item.sourceName.toLowerCase() === container.toLowerCase() ||
        item.sourceName.toLowerCase().startsWith(`${container.toLowerCase()}_`)) &&
      item.canonicalPath.endsWith(resourcePath));
    assert.ok(file, `${container}:${resourcePath} not mounted`);
    let actual;
    try { actual = await file.readXml(); }
    catch (error) { throw new Error(`${container}:${resourcePath}: ${error.message}`, { cause: error }); }
    const fixturePath = path.join(fixtures, container, resourcePath +
      (resourcePath.endsWith(".bml") ? ".xml" : ""));
    const expected = await readFile(fixturePath, "utf8");
    assert.equal(actual, expected, `${container}:${resourcePath}`);
    assert.equal((await file.readBytes()).length, file.size);
  }
});
