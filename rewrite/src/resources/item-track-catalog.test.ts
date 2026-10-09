import assert from "node:assert/strict";
import test from "node:test";

import { mirrorArchives } from "./mirror-archives.test-support";
import {
  itemRandomTrackGroups, itemTrackCatalog, mapAssets, timeAttackTrackCatalog,
  trackMetadataCatalog, type TrackLibrary, type TrackResource,
} from "./track-catalog";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) } as unknown as Document;
const { y9 } = await import("../generated/formats.js") as { y9(bytes: Uint8Array): {
  root: { kind: string; trackObjects: Array<{ kind: string; property?: unknown }> } } };

const archives = mirrorArchives();
const TRACK_FILES = /^(?:track(?:_rvs)?\.1s|track@zz\.bml|trackLocale@cn\.bml|randomTrack@cn\.bml)$/i;

/** The p3553 track files of every Rho archive and Rho5 group, read on demand. */
function mirrorTrackLibrary(): TrackLibrary {
  const files: TrackResource[] = [];
  for (const archive of archives.index.rho) {
    const mount = archive.name.replace(/\.rho$/i, "");
    for (const raw of archive.files as Array<{ path: string; name: string; extension: string }>) {
      if (!TRACK_FILES.test(raw.name)) continue;
      const virtualPath = `${mount}/${raw.path}`;
      files.push({ name: raw.name, extension: raw.extension, virtualPath,
        canonicalPath: virtualPath, sourceName: archive.name,
        bytes: () => archives.read(archive.name, raw.path) });
    }
  }
  for (const group of archives.index.rho5) {
    for (const raw of group.files as Array<{ path: string }>) {
      const name = raw.path.split("/").at(-1)!;
      if (!TRACK_FILES.test(name)) continue;
      files.push({ name, extension: name.split(".").at(-1)!.toLowerCase(),
        virtualPath: raw.path, canonicalPath: raw.path, sourceName: group.name,
        bytes: () => archives.read(group.name, raw.path) });
    }
  }
  const library: TrackLibrary = {
    files,
    mapAssets: () => mapAssets(library),
    trackTitles: () => { throw new Error("unused"); },
    trackMetadataCatalog: () => trackMetadataCatalog(library),
    timeAttackTrackCatalog: () => timeAttackTrackCatalog(library),
    findSibling: (path, names) => {
      const origin = files.find(entry => entry.virtualPath === path);
      const directory = path.slice(0, path.lastIndexOf("/") + 1).toLowerCase();
      for (const name of names) {
        const sibling = files.find(entry => entry.sourceName === origin?.sourceName &&
          entry.virtualPath.toLowerCase() === `${directory}${name.toLowerCase()}`);
        if (sibling) return sibling;
      }
      return undefined;
    },
  };
  return library;
}

const library = mirrorTrackLibrary();
const items = await itemTrackCatalog(library);
const ids = new Set(items.map(track => track.id));

test("p3553 道具赛赛道目录：158 条道具赛道与 29 条反向赛道", async () => {
  assert.equal(items.filter(track => !track.reverse).length, 158);
  assert.equal(items.filter(track => track.reverse).length, 29);
  assert.ok(items.every(track => track.gameType === "item"));
  // The five isOnlyItemTrack tracks (track@zz.bml) are item rooms' own.
  for (const id of ["village_C01", "mine_C04", "china_C01", "world_C02", "nemo_C02"])
    assert.ok(ids.has(id), id);
  // trackLocale@cn blocked="true", choosable="false" and the practice track.
  for (const id of ["village_I13", "tomb_I05", "nymph_I03", "beach_I02", "desert_I09",
    "china_I08", "village_I12", "factory_I08", "pirate_I05", "world_I04", "village_I11",
    // track@zz choosable="false"
    "village_I06", "tomb_I02",
    // speed tracks, even those with item cubes
    "village_R01", "village_I02", "village_R02"]) assert.ok(!ids.has(id), id);
  // Reverse tracks follow the trackLocale@cn track_rvs rows.
  assert.ok(ids.has("forest_I01_rvs"));
  assert.ok(!ids.has("forest_I03_rvs"), "track_rvs blocked");
  assert.ok(!ids.has("village_I02_rvs"), "speed reverse");
  // Time attack still has the same catalog without the item-only tracks.
  const timeAttack = await library.timeAttackTrackCatalog();
  assert.ok(!timeAttack.some(track => track.id === "village_C01"));
  assert.ok(timeAttack.some(track => track.id === "tomb_I05"));
});

test("p3553 道具赛随机组：人气 1-5、全部、新图、反向都只抽道具赛道", async () => {
  const groups = await itemRandomTrackGroups(library);
  assert.deepEqual(groups.map(group => group.id).sort(), [
    "item:all:0", "item:hot1:1", "item:hot2:2", "item:hot3:3", "item:hot4:4", "item:hot5:5",
    "item:new:0", "item:reverse:0",
  ]);
  for (const group of groups) {
    assert.ok(group.trackIds.length > 0, group.id);
    assert.ok(group.trackIds.every(id => ids.has(id)), group.id);
  }
  assert.equal(groups.find(group => group.id === "item:all:0")!.trackIds.length, 158);
  assert.ok(groups.find(group => group.id === "item:reverse:0")!.trackIds
    .every(id => id.endsWith("_rvs")));
});

test("p3553 道具赛赛道的 track.1s 都放有道具箱", async () => {
  const empty: string[] = [];
  for (const track of items) {
    const file = library.files.find(entry => entry.virtualPath === track.path)!;
    const model = y9(await file.bytes());
    assert.equal(model.root.kind, "track", track.id);
    const cubes = model.root.trackObjects.filter(object => object.kind === "ToItemCube" ||
      (object.kind === "ToMovableObject" && JSON.stringify(object.property ?? {})
        .includes("itemCube"))).length;
    if (cubes === 0) empty.push(track.id);
  }
  assert.deepEqual(empty, []);
});
