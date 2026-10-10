import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import {
  getResource, initializeResourceLookup, resourceCanonicalCandidates,
  resourceEntriesUnderCanonicalPrefix, resourceExactCanonicalCandidates,
  resourceFindSibling, resourceHasManifestMount, resourcePhysicalContainerNames,
  resourceResolveContainerPath, type ResourceEntry, type ResourceLibraryInput,
  type ResourceLookup,
} from "./resource-lookup";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");

function between(start: string, end: string): string {
  const from = release.indexOf(start);
  const to = release.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `release segment ${start}`);
  return release.slice(from, to);
}

const ReleaseLibrary = new Function([
  between("class Sw {", "\nconst BZ = "),
  between("function z3(", "\nfunction sQ("),
  "return Sw;",
].join("\n"))() as new (input: ResourceLibraryInput<ResourceEntry>) => ResourceLookup<ResourceEntry> & {
  get(path: string): ResourceEntry | undefined;
  physicalContainerNames(paths: string[]): string[];
  resolveContainerPath(origin: string, target: string): unknown;
  exactCanonicalCandidates(path: string): ResourceEntry[];
  canonicalCandidates(path: string): ResourceEntry[];
  entriesUnderCanonicalPrefix(path: string): ResourceEntry[];
  hasManifestMount(path: string): boolean;
  findSibling(path: string, names: string[]): ResourceEntry | undefined;
};

class AuthoredLibrary implements ResourceLookup<ResourceEntry> {
  files!: ResourceEntry[];
  archives!: unknown[];
  errors!: string[];
  warnings!: string[];
  region!: string;
  manifestAvailable!: boolean;
  manifestMountPaths!: Set<string>;
  archiveIndexes!: unknown;
  byPath!: Map<string, ResourceEntry>;
  byCanonicalPath!: Map<string, ResourceEntry[]>;
  byExactCanonicalPath!: Map<string, ResourceEntry[]>;
  canonicalPrefixCache = new Map<string, ResourceEntry[]>();

  constructor(input: ResourceLibraryInput<ResourceEntry>) { initializeResourceLookup(this, input); }
  get(path: string) { return getResource(this, path); }
  physicalContainerNames(paths: string[]) { return resourcePhysicalContainerNames(this, paths); }
  resolveContainerPath(origin: string, target: string) { return resourceResolveContainerPath(this, origin, target); }
  exactCanonicalCandidates(path: string) { return resourceExactCanonicalCandidates(this, path); }
  canonicalCandidates(path: string) { return resourceCanonicalCandidates(this, path); }
  entriesUnderCanonicalPrefix(path: string) { return resourceEntriesUnderCanonicalPrefix(this, path); }
  hasManifestMount(path: string) { return resourceHasManifestMount(this, path); }
  findSibling(path: string, names: string[]) { return resourceFindSibling(this, path, names); }
}

function input(files: ResourceEntry[], mounts = new Set<string>()): ResourceLibraryInput<ResourceEntry> {
  return {
    files, archives: [], errors: [], warnings: [], region: "cn",
    manifestAvailable: true, manifestMountPaths: mounts,
    archiveIndexes: { rho: [], rho5: [] },
  };
}

test("索引构造、大小写、歧义、同源优先及前缀缓存保持 release 行为", () => {
  const files: ResourceEntry[] = [
    { virtualPath: "KART_/Car/model.1s", canonicalPath: "kart_/Car/model.1s",
      sourceName: "car.rho", sourceKind: "rho", containerId: "rho:1", absenceAuthoritative: true },
    { virtualPath: "kart_/Car/model.1s [collision]", canonicalPath: "kart_/Car/model.1s",
      sourceName: "other.rho", sourceKind: "rho", containerId: "rho:2" },
    { virtualPath: "kart_/Car/f00.1s", canonicalPath: "kart_/Car/f00.1s",
      sourceName: "other.rho", sourceKind: "rho", containerId: "rho:2" },
    { virtualPath: "kart_/Car/f00.1s [source]", canonicalPath: "kart_/Car/f00.1s",
      sourceName: "car.rho", sourceKind: "rho", containerId: "rho:1" },
    { virtualPath: "kart_/Car/param.xml", canonicalPath: "kart_/Car/param.xml",
      sourceName: "other.rho", sourceKind: "rho", containerId: "rho:1" },
    { virtualPath: "kart_/Car/param.xml [ambiguous]", canonicalPath: "kart_/Car/param.xml",
      sourceName: "third.rho", sourceKind: "rho", containerId: "rho:1" },
    { virtualPath: "kart_/Car/unrelated.xml", sourceName: "loose.xml", sourceKind: "loose" },
  ];
  const setup = input(files, new Set(["kart_/Car", "etc_"]));
  const original = new ReleaseLibrary(setup);
  const authored = new AuthoredLibrary(setup);
  assert.deepEqual(authored.byPath, original.byPath);
  assert.deepEqual(authored.byCanonicalPath, original.byCanonicalPath);
  assert.deepEqual(authored.byExactCanonicalPath, original.byExactCanonicalPath);

  const paths = ["KART_/CAR/MODEL.1S", "./kart_/Car/model.1s/", "kart_/Car/param.xml", "missing"];
  for (const path of paths) {
    assert.deepEqual(authored.get(path), original.get(path));
    assert.deepEqual(authored.exactCanonicalCandidates(path), original.exactCanonicalCandidates(path));
    assert.deepEqual(authored.canonicalCandidates(path), original.canonicalCandidates(path));
    assert.deepEqual(authored.entriesUnderCanonicalPrefix(path), original.entriesUnderCanonicalPrefix(path));
    assert.equal(authored.hasManifestMount(path), original.hasManifestMount(path));
  }
  assert.equal(authored.entriesUnderCanonicalPrefix("./kart_/Car"),
    authored.entriesUnderCanonicalPrefix("kart_/Car/"));
  assert.equal(authored.canonicalCandidates("KART_/car/model.1s").length, 2);
  assert.equal(authored.exactCanonicalCandidates("KART_/car/model.1s").length, 0);
  assert.deepEqual(authored.physicalContainerNames([
    "KART_/Car/model.1s", "kart_/Car/f00.1s", "kart_/Car/f00.1s",
  ]), original.physicalContainerNames([
    "KART_/Car/model.1s", "kart_/Car/f00.1s", "kart_/Car/f00.1s",
  ]));
  assert.throws(() => authored.physicalContainerNames(["missing"]), /资源库内找不到/);

  for (const [origin, target] of [
    ["KART_/Car/model.1s", "kart_/Car/f00.1s"],
    ["KART_/Car/model.1s", "kart_/Car/param.xml"],
    ["KART_/Car/model.1s", "kart_/Car/absent.xml"],
  ]) {
    assert.deepEqual(authored.resolveContainerPath(origin!, target!),
      original.resolveContainerPath(origin!, target!));
  }
  assert.throws(() => authored.resolveContainerPath("kart_/Car/unrelated.xml", "missing"), /缺少逻辑容器/);
  assert.throws(() => authored.resolveContainerPath("missing", "missing"), /资源库内找不到/);
  for (const origin of ["KART_/Car/model.1s", "missing", "kart_/Car/unrelated.xml"]) {
    assert.deepEqual(authored.findSibling(origin, ["f00.1s", "param.xml"]),
      original.findSibling(origin, ["f00.1s", "param.xml"]));
  }
});

test("真实 p3553 Rho/Rho5 索引的规范路径与资源查询逐项等同 release", () => {
  const index = JSON.parse(inflateSync(readFileSync(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as {
    rho: { name: string; files: { path: string }[] }[];
    rho5: { name: string; files: { path: string }[] }[];
  };
  const files: ResourceEntry[] = [];
  const mounts = new Set<string>();
  index.rho.forEach((archive, archiveIndex) => {
    const mount = archive.name.replace(/\.rho$/i, "");
    mounts.add(mount);
    archive.files.forEach(file => {
      const virtualPath = `${mount}/${file.path}`;
      files.push({ virtualPath, canonicalPath: virtualPath, sourceName: archive.name,
        sourceKind: "rho", containerId: `rho:${archiveIndex}`, absenceAuthoritative: true });
    });
  });
  index.rho5.forEach(archive => archive.files.forEach(file => files.push({
    virtualPath: file.path, canonicalPath: file.path, sourceName: archive.name,
    sourceKind: "rho5", containerId: `rho5:${archive.name.toLowerCase()}`,
    absenceAuthoritative: true,
  })));
  assert.equal(files.length, 137609);
  const setup = input(files, mounts);
  const original = new ReleaseLibrary(setup);
  const authored = new AuthoredLibrary(setup);
  assert.equal(authored.byPath.size, original.byPath.size);
  assert.equal(authored.byCanonicalPath.size, original.byCanonicalPath.size);
  assert.equal(authored.byExactCanonicalPath.size, original.byExactCanonicalPath.size);

  const sampled = [0, 1, 35, 100, 900, 4_000, 17_000, 40_000, 70_000, 100_000, 137_608]
    .map(index => files[index]!);
  for (const entry of sampled) {
    const path = entry.virtualPath;
    assert.deepEqual(authored.get(path.toUpperCase()), original.get(path.toUpperCase()));
    assert.deepEqual(authored.exactCanonicalCandidates(`./${path}/`),
      original.exactCanonicalCandidates(`./${path}/`));
    assert.deepEqual(authored.canonicalCandidates(path.toUpperCase()),
      original.canonicalCandidates(path.toUpperCase()));
    assert.deepEqual(authored.resolveContainerPath(path, entry.canonicalPath!),
      original.resolveContainerPath(path, entry.canonicalPath!));
    assert.deepEqual(authored.findSibling(path, ["model.1s", "param@cn.bml", "track_rvs.1s", "track.1s"]),
      original.findSibling(path, ["model.1s", "param@cn.bml", "track_rvs.1s", "track.1s"]));
  }
  for (const prefix of ["track_common", "track_ice_I01", "kart_", "etc_", "./DataPack1/"]) {
    const expected = original.entriesUnderCanonicalPrefix(prefix);
    assert.deepEqual(authored.entriesUnderCanonicalPrefix(prefix), expected);
    assert.equal(authored.entriesUnderCanonicalPrefix(prefix),
      authored.entriesUnderCanonicalPrefix(prefix));
    assert.equal(authored.hasManifestMount(prefix), original.hasManifestMount(prefix));
  }
  const names = sampled.map(entry => entry.virtualPath);
  assert.deepEqual(authored.physicalContainerNames(names), original.physicalContainerNames(names));
});
