import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { attribute, decodeBinaryXml, type BinaryXmlNode } from "../codecs/binary-xml";
import { RhoReader } from "../codecs/rho";
import type { RhoArchiveIndex } from "./archive-index";
import {
  mapAssets, mapCatalog, timeAttackRandomTrackGroups,
  timeAttackRandomTrackNames, timeAttackTrackCatalog, trackMetadata,
  trackMetadataCatalog, trackTitles, type TrackLibrary, type TrackResource,
} from "./track-catalog";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");

function between(start: string, end: string): string {
  const from = release.indexOf(start);
  const to = release.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `release segment ${start}`);
  return release.slice(from, to);
}

// Evaluate the original release class and its track helpers. Binary XML decoding
// and attribute access are held equal so this compares catalog behavior itself.
const source = [
  between("class Sw {", "\nconst BZ = "),
  between("const BZ = ", "\nasync function NZ("),
  between("function O3(", "\nfunction nQ("),
  between("function Ge(", "\nfunction iQ("),
  "return Sw;",
].join("\n");
const ReleaseLibrary = new Function("s2", "T", source)(decodeBinaryXml, attribute) as new (input: {
  files: TrackResource[];
  archives: unknown[];
  errors: unknown[];
  warnings: unknown[];
  region: string;
  manifestAvailable: boolean;
  manifestMountPaths: Set<string>;
  archiveIndexes: { rho: unknown[]; rho5: unknown[] };
}) => TrackLibrary;

class AuthoredLibrary extends ReleaseLibrary {
  mapAssets() { return mapAssets(this); }
  mapCatalog() { return mapCatalog(this); }
  trackMetadataCatalog() { return trackMetadataCatalog(this); }
  trackTitles() { return trackTitles(this); }
  trackMetadata(id: string) { return trackMetadata(this, id); }
  timeAttackTrackCatalog() { return timeAttackTrackCatalog(this); }
  timeAttackRandomTrackGroups() { return timeAttackRandomTrackGroups(this); }
  timeAttackRandomTrackNames() { return timeAttackRandomTrackNames(this); }
}

function encode(node: BinaryXmlNode): Uint8Array {
  const pieces: Buffer[] = [];
  const integer = (value: number) => {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32LE(value);
    pieces.push(bytes);
  };
  const string = (value: string) => {
    integer(value.length);
    pieces.push(Buffer.from(value, "utf16le"));
  };
  const write = (value: BinaryXmlNode) => {
    string(value.name);
    string(value.text);
    integer(value.attributes.length);
    for (const item of value.attributes) {
      string(item.name);
      string(item.value);
    }
    integer(value.children.length);
    value.children.forEach(write);
  };
  write(node);
  return new Uint8Array(Buffer.concat(pieces));
}

function node(name: string, attributes: Record<string, string> = {}, children: BinaryXmlNode[] = []): BinaryXmlNode {
  return { name, text: "", attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children };
}

function file(virtualPath: string, bytes: Uint8Array = new Uint8Array(), canonicalPath = virtualPath): TrackResource {
  const name = virtualPath.split("/").at(-1)!;
  return {
    name,
    extension: name.split(".").at(-1)!.toLowerCase(),
    virtualPath,
    canonicalPath,
    sourceName: virtualPath.split("/")[0] + ".rho",
    bytes: async () => bytes,
  };
}

function fixtureFiles(): TrackResource[] {
  const track = node("trackList", {}, [
    node("track", { id: "ice_peak", folder: "ice_peak", gameType: "speed", laps: "3", difficulty: "2" }),
    node("track", { id: "desert_town", folder: "desert_town", gameType: "item", laps: "2", difficulty: "1", theme: "desert" }),
    node("track", { id: "ice_hidden", gameType: "speed", laps: "3", difficulty: "3", blocked: "true" }),
    node("track", { id: "ice_training", gameType: "speed", laps: "1", difficulty: "0", isOnlyTraining: "true" }),
    node("track", { id: "ice_lapless", gameType: "speed", difficulty: "2" }),
  ]);
  const locale = node("trackLocale", {}, [
    node("track", { id: "ice_peak", name: "冰峰" }),
    node("track", { id: "desert_town", name: "沙漠镇" }),
    node("track", { id: "ice_training", name: "训练道" }),
  ]);
  const random = node("randomTrack", {}, [
    node("RandomTrackList", { randomType: "new" }, [
      node("track", { id: "ice_peak" }), node("track", { id: "desert_town" }),
      node("track", { id: "ice_peak" }), node("track", { id: "absent" }),
    ]),
    node("RandomTrackSet", { randomType: "hot1", gameType: "speed", level: "1" }, [
      node("track", { id: "ice_peak" }), node("track", { id: "desert_town" }),
    ]),
    node("RandomTrackList", { randomType: "reverse" }, [
      node("track", { id: "ice_peak_rvs" }),
    ]),
  ]);
  return [
    file("track_/common/bad/track@zz.bml", Uint8Array.of(0)),
    file("track_/common/track@zz.bml", encode(track)),
    file("track_/common/trackLocale@cn.bml", encode(locale)),
    file("track_/common/randomTrack@cn.bml", encode(random)),
    file("track_/ice_peak/track.1s"),
    file("track_/ice_peak/track_rvs.1s"),
    file("track_/desert_town/track.1s"),
    file("track_/ice_training/track.1s"),
    file("track_/unused/track.1s"),
    file("other_/duplicate/track.1s", new Uint8Array(), "track_/unused/track.1s"),
  ];
}

function library<T extends TrackLibrary>(Constructor: new (input: any) => T, files: TrackResource[]): T {
  return new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set<string>(), archiveIndexes: { rho: [], rho5: [] },
  });
}

test("Sw 赛道资产、目录、随机组选项与原始 release 行为一致", async () => {
  const files = fixtureFiles();
  const original = library(ReleaseLibrary, files) as TrackLibrary & {
    mapCatalog(): Promise<unknown>;
    trackMetadata(id: string): Promise<unknown>;
    timeAttackRandomTrackGroups(): Promise<unknown>;
    timeAttackRandomTrackNames(): Promise<unknown>;
  };
  const authored = library(AuthoredLibrary, files);
  assert.deepEqual(authored.mapAssets(), original.mapAssets());
  assert.deepEqual(await authored.mapCatalog(), await original.mapCatalog());
  assert.deepEqual(await authored.trackMetadataCatalog(), await original.trackMetadataCatalog());
  assert.deepEqual(await authored.trackTitles(), await original.trackTitles());
  assert.deepEqual(await authored.trackMetadata("ice_peak_rvs"), await original.trackMetadata("ice_peak_rvs"));
  assert.deepEqual(await authored.trackMetadata("desert_town"), await original.trackMetadata("desert_town"));
  const tracks = await authored.timeAttackTrackCatalog();
  assert.deepEqual(tracks, await original.timeAttackTrackCatalog());
  assert.ok(tracks.some(track => track.id === "ice_peak_rvs"));
  assert.ok(tracks.some(track => track.id === "desert_town"));
  const groups = await authored.timeAttackRandomTrackGroups();
  assert.deepEqual(groups, await original.timeAttackRandomTrackGroups());
  assert.ok(groups.some(group => group.id === "speed:hot1:1"));
  assert.ok(groups.some(group => group.id === "speed:reverse:0"));
  assert.deepEqual(await authored.timeAttackRandomTrackNames(), await original.timeAttackRandomTrackNames());
  assert.equal(authored.trackMetadataCatalog(), authored.trackMetadataCatalog());
  assert.equal(authored.trackTitles(), authored.trackTitles());
});

test("Sw 对无效布尔赛道表与缺失随机表保持 release 回退行为", async () => {
  const invalid = file("track_/common/track@zz.bml", encode(node("trackList", {}, [
    node("track", { id: "ice_peak", laps: "3", blocked: "maybe" }),
  ])));
  const files = [invalid, file("track_/ice_peak/track.1s")];
  const original = library(ReleaseLibrary, files);
  const authored = library(AuthoredLibrary, files);
  assert.deepEqual(await authored.trackMetadataCatalog(), await original.trackMetadataCatalog());
  assert.deepEqual(await authored.timeAttackRandomTrackGroups(), []);
});

test("真实 p3553 赛道档案索引及 BML 与原始 release 生成相同赛道目录", async () => {
  const rawIndex = JSON.parse(inflateSync(readFileSync(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as { rho: RhoArchiveIndex[] };
  const common = rawIndex.rho.find(archive => archive.name === "track_common.rho");
  assert.ok(common);
  const archiveBytes = readFileSync(path.resolve(project, "../mirror/p3553/track_common.rho"));
  const arrayBuffer = (bytes: Uint8Array): ArrayBuffer => Uint8Array.from(bytes).buffer as ArrayBuffer;
  const commonReader = new RhoReader({
    name: common.name,
    size: archiveBytes.length,
    arrayBuffer: async () => arrayBuffer(archiveBytes),
    slice: (start = 0, end = archiveBytes.length) => ({
      arrayBuffer: async () => arrayBuffer(archiveBytes.subarray(start, end)),
    }),
  }, common);

  const files: TrackResource[] = [];
  for (const archive of rawIndex.rho) {
    const mount = archive.name.replace(/\.rho$/i, "");
    for (const raw of archive.files as { path: string; name: string; extension: string }[]) {
      if (!/^(?:track(?:_rvs)?\.1s|track@zz\.bml|trackLocale@cn\.bml|randomTrack@cn\.bml)$/i.test(raw.name)) continue;
      const virtualPath = `${mount}/${raw.path}`;
      files.push({
        name: raw.name,
        extension: raw.extension,
        virtualPath,
        canonicalPath: virtualPath,
        sourceName: archive.name,
        bytes: () => archive.name === common.name
          ? commonReader.read(raw.path)
          : Promise.reject(new Error(`Unexpected model decode: ${virtualPath}`)),
      });
    }
  }
  const original = library(ReleaseLibrary, files) as TrackLibrary & {
    mapCatalog(): Promise<unknown>;
    timeAttackRandomTrackGroups(): Promise<unknown>;
    timeAttackRandomTrackNames(): Promise<unknown>;
  };
  const authored = library(AuthoredLibrary, files);
  const originalMetadata = await original.trackMetadataCatalog();
  const authoredMetadata = await authored.trackMetadataCatalog();
  assert.deepEqual(authoredMetadata, originalMetadata);
  const originalTracks = await original.timeAttackTrackCatalog();
  const authoredTracks = await authored.timeAttackTrackCatalog();
  assert.deepEqual(authoredTracks, originalTracks);
  assert.equal(authoredMetadata.length, 391);
  assert.equal(authoredTracks.length, 262);
  assert.deepEqual(await authored.mapCatalog(), await original.mapCatalog());
  assert.deepEqual(await authored.timeAttackRandomTrackGroups(), await original.timeAttackRandomTrackGroups());
  assert.deepEqual(await authored.timeAttackRandomTrackNames(), await original.timeAttackRandomTrackNames());
  assert.ok(authoredTracks.some(track => track.id === "forest_I01" && track.title === "森林 木桶"));
  assert.ok(authoredTracks.some(track => track.id.endsWith("_rvs") && track.reverse === true));
});
