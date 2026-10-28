#!/usr/bin/env node
// Export just track settlement IDs using the index and lazily read track tables.
// Unrelated Git LFS archives need not be downloaded. Usage: node --import tsx tools/export-track-catalog.mjs [--check]
import { readFileSync, openSync, readSync, closeSync, statSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { RhoReader } from "../src/codecs/rho.ts";
import { Rho5Reader } from "../src/codecs/rho5.ts";
import { mapAssets, trackMetadataCatalog, trackTitles, timeAttackTrackCatalog, timeAttackTrackCatalogAll } from "../src/resources/track-catalog.ts";
import { timeAttackTrackRows } from "./economy-export/tracks.mjs";
import { formatDocument } from "./economy-export/canonical.mjs";

export function indexedTrackLibrary() {
  const mirror = new URL("../../mirror/", import.meta.url);
  const index = JSON.parse(inflateSync(readFileSync(new URL("__p3553/archive-index", mirror))),
    (_key, value) => value && typeof value === "object" && typeof value.$u8 === "string"
      ? Uint8Array.from(Buffer.from(value.$u8, "base64")) : value);
  const source = name => {
    const url = new URL(`p3553/${name}`, mirror);
    const size = statSync(url).size;
    const read = async (start, end) => {
      const fd = openSync(url, "r");
      try {
        const bytes = new Uint8Array(end - start);
        if (readSync(fd, bytes, 0, bytes.length, start) !== bytes.length)
          throw new Error(`${name}: incomplete resource; download its Git LFS contents`);
        return bytes.buffer;
      } finally { closeSync(fd); }
    };
    return { name, size, arrayBuffer: () => read(0, size),
      slice: (start = 0, end = size) => ({ arrayBuffer: () => read(start, end) }) };
  };
  const files = [];
  const relevant = name => /^track.*\.1s$/i.test(name) ||
    /^(track@zz|trackLocale@cn|randomTrack@cn)\.bml$/i.test(name);
  for (const archive of index.rho) {
    let reader;
    for (const entry of archive.files.filter(entry => relevant(entry.name))) {
      const virtualPath = `${archive.name.replace(/\.rho$/i, "")}/${entry.path}`;
      files.push({ ...entry, virtualPath, canonicalPath: virtualPath, sourceName: archive.name,
        bytes: () => (reader ??= new RhoReader(source(archive.name), archive)).read(entry.path) });
    }
  }
  for (const group of index.rho5) {
    let reader;
    for (const entry of group.files) {
      const name = entry.path.split("/").at(-1);
      if (!relevant(name)) continue;
      files.push({ name, extension: name.split(".").at(-1).toLowerCase(),
        virtualPath: entry.path, canonicalPath: entry.path, sourceName: group.name,
        bytes: () => (reader ??= new Rho5Reader(group, group.parts.map(part => source(part.name)))).read(entry.path) });
    }
  }
  const library = { files, mapAssets: () => mapAssets(library),
    trackTitles: () => trackTitles(library), trackMetadataCatalog: () => trackMetadataCatalog(library),
    timeAttackTrackCatalog: () => timeAttackTrackCatalog(library),
    timeAttackTrackCatalogAll: () => timeAttackTrackCatalogAll(library),
    findSibling(path, names) {
      const original = files.find(entry => entry.virtualPath === path);
      const directory = path.slice(0, path.lastIndexOf("/") + 1).toLowerCase();
      return names.flatMap(name => files.filter(entry => entry.sourceName === original?.sourceName &&
        entry.virtualPath.toLowerCase() === `${directory}${name.toLowerCase()}`))[0];
    },
  };
  return library;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = new URL("../../server-go/internal/data/economy/tracks.json", import.meta.url);
  const previous = readFileSync(target, "utf8");
  const document = JSON.parse(previous);
  // The light index and Sw enumerate containers differently. Keep existing row
  // order so a compatibility-only export does not shuffle every extra track.
  const previousOrder = new Map(document.tracks.map((row, index) => [row.id, index]));
  const choices = await indexedTrackLibrary().timeAttackTrackCatalogAll();
  const problems = [];
  document.tracks = timeAttackTrackRows(choices, message => problems.push(message));
  document.tracks.sort((a, b) =>
    (previousOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (previousOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    || a.id.localeCompare(b.id));
  if (problems.length) throw new Error(problems.join("\n"));
  const { text } = formatDocument(document);
  if (process.argv.includes("--check")) {
    if (text !== previous) throw new Error("tracks.json is stale");
  } else writeFileSync(target, text);
  console.log(`${choices.length} accepted track IDs (including hidden aliases); ${choices.filter(track => track.resourceCategory).length} expanded entries`);
}
