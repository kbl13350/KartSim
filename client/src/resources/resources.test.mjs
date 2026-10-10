import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

import { loadResourceManifest, parseResourceManifest } from "./manifest.ts";
import { ContainerStore } from "./container-store.ts";
import { ArchiveCatalog, decodeArchiveIndex } from "./archive-index.ts";
import { Sha256, sha256Blob } from "./sha256.ts";
import { loadLegacyResourceBundle } from "./legacy-adapter.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifestPath = path.join(root, "mirror/__p3553/resources");
const archivePath = path.join(root, "mirror/__p3553/archive-index");
const SHA = "a".repeat(64);

function testManifest(size = 4) {
  return parseResourceManifest({
    version: "p3553",
    revision: SHA,
    files: [{ name: "example.rho", size, mtimeMs: 0, sha256: SHA }],
  });
}

class MemoryDirectory {
  constructor() { this.files = new Map(); this.directories = new Map(); }
  async getDirectoryHandle(name, options = {}) {
    if (!this.directories.has(name)) {
      if (!options.create) throw new DOMException("missing", "NotFoundError");
      this.directories.set(name, new MemoryDirectory());
    }
    return this.directories.get(name);
  }
  async getFileHandle(name, options = {}) {
    if (!this.files.has(name) && !options.create) {
      throw new DOMException("missing", "NotFoundError");
    }
    if (!this.files.has(name)) this.files.set(name, new Uint8Array());
    return {
      getFile: async () => new Blob([this.files.get(name)]),
      createWritable: async () => {
        const chunks = [];
        return {
          write: async bytes => { chunks.push(bytes.slice()); },
          close: async () => { this.files.set(name, Uint8Array.from(chunks.flatMap(x => [...x]))); },
          abort: async () => {},
        };
      },
    };
  }
  async removeEntry(name) { this.files.delete(name); }
}

test("真实 p3553 清单和索引相互匹配", async () => {
  const manifest = parseResourceManifest(
    JSON.parse(await readFile(manifestPath, "utf8")), "p3553",
  );
  assert.equal(manifest.files.length, 1695);
  const stream = Readable.toWeb(createReadStream(archivePath));
  const index = await decodeArchiveIndex(stream, manifest);
  assert.equal(index.rho.length, 1630);
  assert.equal(index.rho5.length, 4);

  const storage = { getDirectory: async () => new MemoryDirectory() };
  const catalog = new ArchiveCatalog(new ContainerStore({ manifest, storage }), index);
  assert.equal(catalog.rho("boss.rho").source.name, "boss.rho");
  assert.equal(catalog.rho5("datapack1").parts.length, 2);
  assert.equal(catalog.mountManifest.name, "aaa.pk");
});

test("清单拒绝错误版本、路径和大小写重复", () => {
  const plain = { version: "p3553", revision: SHA,
    files: [{ name: "example.rho", size: 4, mtimeMs: 0, sha256: SHA }] };
  assert.throws(() => parseResourceManifest(plain, "p3543"), /请求/);
  assert.throws(() => parseResourceManifest({ ...plain, files: [
    { ...plain.files[0], name: "../escape.rho" },
  ] }), /文件名/);
  assert.throws(() => parseResourceManifest({ ...plain, files: [
    plain.files[0], { ...plain.files[0], name: "EXAMPLE.rho" },
  ] }), /同名/);
});

test("默认 fetch 保持 Window 接收者", async () => {
  const original = globalThis.fetch;
  const payload = { version: "p3553", revision: SHA,
    files: [{ name: "example.rho", size: 4, mtimeMs: 0, sha256: SHA }] };
  try {
    globalThis.fetch = function () {
      assert.equal(this, globalThis);
      return Promise.resolve(new Response(JSON.stringify(payload)));
    };
    const result = await loadResourceManifest("p3553");
    assert.equal(result.files[0].name, "example.rho");
  } finally {
    globalThis.fetch = original;
  }
});

test("并发请求只下载一次，范围读取准确", async () => {
  const rootDirectory = new MemoryDirectory();
  const progress = [];
  let fetches = 0;
  const store = new ContainerStore({
    manifest: testManifest(),
    storage: { getDirectory: async () => rootDirectory },
    fetcher: async () => { fetches++; return new Response(new Uint8Array([1, 2, 3, 4])); },
    onProgress: event => progress.push(event),
  });
  const [a, b] = await Promise.all([store.ensure("example.rho"), store.ensure("EXAMPLE.RHO")]);
  assert.equal(fetches, 1);
  assert.equal(a.size, b.size);
  assert.deepEqual([...new Uint8Array(await store.readRange("example.rho", 1, 3))], [2, 3]);
  await assert.rejects(() => store.source("example.rho").slice(-1, 3).arrayBuffer(), /范围/);
  assert.equal(progress.at(-1).phase, "ready");
  assert.equal(progress.find(x => x.phase === "downloading").loadedBytes, 4);
});

test("短响应清理缓存，后续请求可重试", async () => {
  const rootDirectory = new MemoryDirectory();
  let fetches = 0;
  const store = new ContainerStore({
    manifest: testManifest(),
    storage: { getDirectory: async () => rootDirectory },
    fetcher: async () => new Response(new Uint8Array(++fetches === 1 ? [1, 2, 3] : [1, 2, 3, 4])),
  });
  await assert.rejects(() => store.ensure("example.rho"), /长度不匹配/);
  assert.equal((await store.ensure("example.rho")).size, 4);
  assert.equal(fetches, 2);
});

test("流式 SHA-256 与标准实现一致", async () => {
  assert.equal(new Sha256().hex(), createHash("sha256").digest("hex"));
  assert.equal(new Sha256().update(new TextEncoder().encode("abc")).hex(),
    createHash("sha256").update("abc").digest("hex"));
  const bytes = Uint8Array.from({ length: 10_007 }, (_, index) => index % 251);
  const hash = new Sha256();
  for (let start = 0; start < bytes.length; start += 77) hash.update(bytes.subarray(start, start + 77));
  const expected = createHash("sha256").update(bytes).digest("hex");
  assert.equal(hash.hex(), expected);
  assert.equal(await sha256Blob(new Blob([bytes])), expected);
});

test("兼容适配器复用通过 SHA-256 校验的本地 Data 文件", async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4]);
  const manifest = {
    version: "p3553", revision: SHA,
    files: [
      { name: "aaa.pk", size: 1, mtimeMs: 0, sha256: SHA },
      { name: "example.rho", size: 4, mtimeMs: 0,
        sha256: createHash("sha256").update(bytes).digest("hex") },
    ],
  };
  const index = {
    version: "p3553", revision: SHA,
    rho: [{ name: "example.rho", mediaSize: 4, files: [], blocks: [] }], rho5: [],
  };
  const compressed = deflateSync(JSON.stringify(index));
  const localDirectory = new MemoryDirectory();
  localDirectory.files.set("example.rho", bytes);
  const rootDirectory = new MemoryDirectory();
  const progress = [];
  let containerFetches = 0;
  const fetcher = async url => {
    if (url === "/__p3553/resources") return new Response(JSON.stringify(manifest));
    if (url === "/__p3553/archive-index") return new Response(compressed);
    containerFetches++;
    throw new Error(`Unexpected container request: ${url}`);
  };
  const bundle = await loadLegacyResourceBundle("p3553", x => progress.push(x),
    localDirectory, { fetcher, storage: { getDirectory: async () => rootDirectory } });
  assert.equal(bundle.version, "p3553");
  assert.equal(bundle.sources.length, 2);
  assert.equal(bundle.archiveIndexes.rho.length, 1);
  await bundle.preloadContainers(["EXAMPLE.RHO", "example.rho"]);
  assert.deepEqual([...new Uint8Array(await bundle.sources[1].arrayBuffer())], [...bytes]);
  assert.equal(containerFetches, 0);
  assert.equal(progress.at(-1).phase, "ready");
});
