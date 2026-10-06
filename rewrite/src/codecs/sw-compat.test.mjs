import assert from "node:assert/strict";
import { createReadStream, openSync, readSync, closeSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { decodeArchiveIndex } from "../resources/archive-index.ts";
import { SwQueryIndex } from "./sw-compat.ts";
import { originalFormats } from "./original-format-oracle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");

function source(spec) {
  const filename = path.join(mirror, "p3553", spec.name);
  return {
    name: spec.name,
    size: spec.size,
    arrayBuffer: () => readFile(filename).then(bytes => Uint8Array.from(bytes).buffer),
    slice: (start = 0, end = spec.size) => ({
      arrayBuffer: async () => {
        const bytes = new Uint8Array(end - start);
        const fd = openSync(filename, "r");
        try {
          let cursor = 0;
          while (cursor < bytes.length) {
            const read = readSync(fd, bytes, cursor, bytes.length - cursor, start + cursor);
            assert.ok(read > 0);
            cursor += read;
          }
          return bytes.buffer;
        } finally { closeSync(fd); }
      },
    }),
  };
}

let releaseClass;
async function originalLibraryClass() {
  if (releaseClass) return releaseClass;
  const { KX, PX, lR, MY, gR, bY } = await originalFormats();
  const release = await readFile(path.join(root, "recovered/formatted/index.js"), "utf8");
  const section = (start, end) => {
    const from = release.indexOf(start);
    const to = release.indexOf(end, from + start.length);
    assert.ok(from >= 0 && to > from, `release segment ${start}`);
    return release.slice(from, to);
  };
  // Keep the original class and its local load helpers available for a real
  // differential after generated Sw.load is redirected to handwritten code.
  const sourceCode = [
    section("class Sw {", "\nconst BZ = "),
    section("function YZ(", "\nfunction O3("),
    section("function nQ(", "\nfunction sQ("),
    "return Sw;",
  ].join("\n");
  releaseClass = new Function("KX", "PX", "lR", "MY", "gR", "bY", sourceCode)(
    KX, PX, lR, MY, gR, bY,
  );
  return releaseClass;
}

function entryMetadata(file) {
  return {
    name: file.name, extension: file.extension, size: file.size,
    sourceName: file.sourceName, sourceKind: file.sourceKind,
    containerId: file.containerId, absenceAuthoritative: file.absenceAuthoritative,
    sourceOrdinal: file.sourceOrdinal, canonicalPath: file.canonicalPath,
    virtualPath: file.virtualPath,
  };
}

function memorySource(name, bytes, webkitRelativePath = "") {
  const data = Uint8Array.from(bytes);
  const buffer = chunk => Uint8Array.from(chunk).buffer;
  return {
    name, size: data.length, webkitRelativePath,
    arrayBuffer: async () => buffer(data),
    slice: (start = 0, end = data.length) => ({
      arrayBuffer: async () => buffer(data.subarray(start, end)),
    }),
  };
}

test("手写 codec 生成的 Sw 条目与发行版 Sw.load 相同", async () => {
  // The generated vendor module probes modulepreload during import.
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  const { Sw } = await import("../generated/library.js");
  const ReleaseSw = await originalLibraryClass();
  const manifest = parseResourceManifest(JSON.parse(await readFile(
    path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
  const index = await decodeArchiveIndex(Readable.toWeb(createReadStream(
    path.join(mirror, "__p3553/archive-index"))), manifest);
  const selected = new Set(["aaa.pk", "stage_.rho", "zeta_cn_ppl.rho",
    "DataPack1_00000.rho5", "DataPack1_00001.rho5"]);
  const sources = manifest.files.filter(spec => selected.has(spec.name)).map(source);
  const original = await ReleaseSw.load(sources, undefined, index);
  const rewritten = await Sw.load(sources, undefined, index);

  assert.deepEqual(rewritten.errors, original.errors);
  assert.equal(rewritten.region, original.region);
  assert.equal(rewritten.manifestAvailable, original.manifestAvailable);
  assert.deepEqual(rewritten.archives, original.archives);
  assert.deepEqual([...rewritten.manifestMountPaths], [...original.manifestMountPaths]);
  const metadata = file => ({
    name: file.name, extension: file.extension, size: file.size,
    sourceName: file.sourceName, sourceKind: file.sourceKind,
    containerId: file.containerId, absenceAuthoritative: file.absenceAuthoritative,
    sourceOrdinal: file.sourceOrdinal, canonicalPath: file.canonicalPath,
    virtualPath: file.virtualPath,
  });
  assert.deepEqual(rewritten.files.map(metadata), original.files.map(metadata));

  const queries = new SwQueryIndex(rewritten.files, rewritten.manifestMountPaths);
  const samples = ["stage_/stageClassNameList.bml", "zeta_/cn/ppl/ppl.bml",
    "etc_/defaultMacroChat@cn.xml"];
  for (const name of samples) {
    assert.deepEqual(queries.get(name)?.virtualPath, original.get(name)?.virtualPath);
    assert.deepEqual(queries.canonicalCandidates(name).map(x => x.virtualPath),
      original.canonicalCandidates(name).map(x => x.virtualPath));
    assert.deepEqual(queries.exactCanonicalCandidates(name).map(x => x.virtualPath),
      original.exactCanonicalCandidates(name).map(x => x.virtualPath));
    assert.deepEqual(queries.entriesUnderCanonicalPrefix(name).map(x => x.virtualPath),
      original.entriesUnderCanonicalPrefix(name).map(x => x.virtualPath));
  }
  assert.deepEqual(queries.mapAssets().map(x => x.virtualPath),
    original.mapAssets().map(x => x.virtualPath));
  assert.deepEqual(queries.vehicleAssets().map(x => x.virtualPath),
    original.vehicleAssets().map(x => x.virtualPath));
  assert.deepEqual(queries.bodyParams().map(x => x.virtualPath),
    (await original.bodyParams()).map(x => x.virtualPath));

  const entry = rewritten.get("stage_/stageClassNameList.bml");
  assert.ok(entry);
  const oldEntry = original.get(entry.virtualPath);
  assert.deepEqual(await entry.bytes(), await oldEntry.bytes());
});

test("完整 p3553 虚拟路径及优先级与发行版一致", async () => {
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  const { Sw } = await import("../generated/library.js");
  const ReleaseSw = await originalLibraryClass();
  const manifest = parseResourceManifest(JSON.parse(await readFile(
    path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
  const index = await decodeArchiveIndex(Readable.toWeb(createReadStream(
    path.join(mirror, "__p3553/archive-index"))), manifest);
  const sources = manifest.files.map(source);
  const original = await ReleaseSw.load(sources, undefined, index);
  const rewritten = await Sw.load(sources, undefined, index);
  assert.equal(rewritten.files.length, original.files.length);
  assert.deepEqual(rewritten.errors, original.errors);
  assert.deepEqual(rewritten.warnings, original.warnings);
  assert.deepEqual(rewritten.archives, original.archives);
  assert.equal(rewritten.region, original.region);

  function digest(library) {
    const hash = createHash("sha256");
    for (const file of library.files) {
      hash.update(JSON.stringify([
        file.name, file.extension, file.size, file.sourceName,
        file.sourceKind, file.containerId, file.absenceAuthoritative,
        file.sourceOrdinal, file.canonicalPath, file.virtualPath,
      ]));
      hash.update("\n");
    }
    return hash.digest("hex");
  }
  assert.equal(digest(rewritten), digest(original));
  const queries = new SwQueryIndex(rewritten.files, rewritten.manifestMountPaths);
  for (const pathToCheck of ["etc_/itemTable.kml", "kart_/mancarXUN/f01.1s",
    "track_/ice_D01/track.1s", "stage_/stageClassNameList.bml"]) {
    assert.deepEqual(queries.canonicalCandidates(pathToCheck).map(file => file.virtualPath),
      original.canonicalCandidates(pathToCheck).map(file => file.virtualPath));
  }
  assert.deepEqual(queries.mapAssets().map(file => file.virtualPath),
    original.mapAssets().map(file => file.virtualPath));
});

test("无预建索引时扫描真实 p3553 Rho/Rho5 与原版一致", async () => {
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  const { Sw } = await import("../generated/library.js");
  const ReleaseSw = await originalLibraryClass();
  const manifest = parseResourceManifest(JSON.parse(await readFile(
    path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
  const selected = new Set(["aaa.pk", "stage_.rho",
    "DataPack1_00000.rho5", "DataPack1_00001.rho5"]);
  const sources = manifest.files.filter(spec => selected.has(spec.name)).map(source);
  const expectedProgress = [];
  const actualProgress = [];
  const original = await ReleaseSw.load(sources, event => expectedProgress.push(event));
  const rewritten = await Sw.load(sources, event => actualProgress.push(event));
  assert.deepEqual(actualProgress, expectedProgress);
  assert.deepEqual(rewritten.errors, original.errors);
  assert.deepEqual(rewritten.warnings, original.warnings);
  assert.deepEqual(rewritten.archives, original.archives);
  assert.equal(rewritten.region, original.region);
  assert.equal(rewritten.manifestAvailable, original.manifestAvailable);
  assert.deepEqual([...rewritten.manifestMountPaths], [...original.manifestMountPaths]);
  assert.deepEqual(rewritten.files.map(entryMetadata), original.files.map(entryMetadata));
  assert.deepEqual(rewritten.archiveIndexes.rho.map(item => [item.name, item.files.length]),
    original.archiveIndexes.rho.map(item => [item.name, item.files.length]));
  assert.deepEqual(rewritten.archiveIndexes.rho5.map(item => [item.name, item.files.length]),
    original.archiveIndexes.rho5.map(item => [item.name, item.files.length]));
  const sample = rewritten.files.find(file => file.sourceKind === "rho5" && file.size > 0 && file.size < 100_000);
  assert.ok(sample);
  assert.deepEqual(await sample.bytes(), await original.get(sample.virtualPath).bytes());
});

test("散文件、同名冲突与文本解码和原版一致", async () => {
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  const { Sw } = await import("../generated/library.js");
  const ReleaseSw = await originalLibraryClass();
  const sources = [
    memorySource("panel.txt", [80, 97, 110, 101, 108], "Data/ui/panel.txt"),
    memorySource("panel.txt", [67, 111, 112, 121], "Data/ui/panel.txt"),
    memorySource("汉字.txt", new TextEncoder().encode("A\0B\0C\0D\0"), "Data/ui/汉字.txt"),
    memorySource("local.bin", [1, 2, 3, 4]),
  ];
  const expectedProgress = [];
  const actualProgress = [];
  const original = await ReleaseSw.load(sources, event => expectedProgress.push(event));
  const rewritten = await Sw.load(sources, event => actualProgress.push(event));
  assert.deepEqual(actualProgress, expectedProgress);
  assert.deepEqual(rewritten.errors, original.errors);
  assert.deepEqual(rewritten.warnings, original.warnings);
  assert.deepEqual(rewritten.files.map(entryMetadata), original.files.map(entryMetadata));
  for (const entry of rewritten.files) {
    const released = original.get(entry.virtualPath);
    assert.deepEqual(await entry.bytes(), await released.bytes());
    assert.equal(await entry.text(), await released.text());
  }
});

test("重复 aaa.pk 只解析首个，进度与告警和原版一致", async () => {
  globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
  const { Sw } = await import("../generated/library.js");
  const ReleaseSw = await originalLibraryClass();
  const manifest = parseResourceManifest(JSON.parse(await readFile(
    path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
  const index = await decodeArchiveIndex(Readable.toWeb(createReadStream(
    path.join(mirror, "__p3553/archive-index"))), manifest);
  const first = source(manifest.files.find(item => item.name === "aaa.pk"));
  const stage = source(manifest.files.find(item => item.name === "stage_.rho"));
  const sources = [first, { ...first }, stage];
  const expectedProgress = [];
  const actualProgress = [];
  const original = await ReleaseSw.load(sources, event => expectedProgress.push(event), index);
  const rewritten = await Sw.load(sources, event => actualProgress.push(event), index);
  assert.deepEqual(actualProgress, expectedProgress);
  assert.deepEqual(rewritten.errors, original.errors);
  assert.deepEqual(rewritten.warnings, original.warnings);
  assert.deepEqual(rewritten.archives, original.archives);
  assert.deepEqual(rewritten.files.map(entryMetadata), original.files.map(entryMetadata));
});
