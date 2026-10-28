#!/usr/bin/env node
/**
 * Export real map previews without mounting game archives in the admin UI.
 * Run from client/: node --import tsx tools/export-admin-track-previews.mjs [--check]
 * Requires libwebp cwebp and dwebp (brew install webp), or CWEBP/DWEBP paths.
 * Encoding uses -lossless -exact so all RGBA pixels survive, even transparent RGB.
 * --check verifies original PNG SHA-256, exported WebP SHA-256 and decoded RGBA,
 * index, metadata and provenance. --out PATH selects a separate output directory.
 * --scene-dir PATH overrides client/assets/track-preview-scenes; its PNGs and
 * provenance.json hold real scene captures for maps without authored preview art.
 * --allow-missing-scenes is for preparing an incomplete extraction only.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadResourceLibrary } from "./economy-export/resource-library.mjs";
import { timeAttackTrackCatalogAll } from "../src/resources/track-catalog.ts";
import { deduplicateTrackChoices } from "../src/resources/track-duplicates.ts";
import { decodePngRgba } from "../src/resources/png-decoder.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const option = name => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith("--"))
    throw new Error(`${name} requires a path`);
  return path.resolve(process.argv[index + 1]);
};
const out = option("--out") ?? path.join(root, "server-go/admin-ui/src/assets/track-previews");
const sceneDir = option("--scene-dir") ?? path.join(root, "client/assets/track-preview-scenes");
const check = process.argv.includes("--check");
const allowMissing = process.argv.includes("--allow-missing-scenes");
const run = promisify(execFile);
const command = name => process.env[name.toUpperCase()] ??
  (fs.existsSync(`/opt/homebrew/bin/${name}`) ? `/opt/homebrew/bin/${name}` : name);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const relative = file => path.relative(root, file).split(path.sep).join("/");
const writeChanged = (file, bytes) => {
  const next = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(next)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
};
const compareDocument = (name, document) => {
  const file = path.join(out, name), contents = json(document);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== contents)
      throw new Error(`${name} is stale; run export-admin-track-previews.mjs`);
  } else writeChanged(file, contents);
};

/** PAM retains all decoded RGBA bytes without a second PNG encoding step. */
function decodePam(bytes) {
  const buffer = Buffer.from(bytes), marker = Buffer.from("ENDHDR\n");
  const separator = buffer.indexOf(marker);
  if (separator < 0) throw new Error("dwebp returned an invalid PAM header");
  const header = buffer.subarray(0, separator).toString("ascii");
  if (!header.startsWith("P7\n")) throw new Error("dwebp did not return PAM");
  const number = field => Number(new RegExp(`^${field} (\\d+)$`, "m").exec(header)?.[1]);
  const width = number("WIDTH"), height = number("HEIGHT"), depth = number("DEPTH");
  const raw = buffer.subarray(separator + marker.length);
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0 ||
      ![3, 4].includes(depth) || number("MAXVAL") !== 255 || raw.length !== width * height * depth)
    throw new Error("dwebp returned an unexpected PAM layout");
  if (depth === 4) return { width, height, pixels: raw };
  const pixels = Buffer.alloc(width * height * 4, 255);
  for (let source = 0, target = 0; source < raw.length; source += 3, target += 4)
    raw.copy(pixels, target, source, source + 3);
  return { width, height, pixels };
}

const sourceOrder = [
  ["xt_trackCard.png", "card"], ["xt_trackThumb.png", "thumbnail"],
  ["xt_bigmap.png", "map"], ["xt_minimap.png", "map"], ["xt_minimap_single.png", "map"],
];
const { library } = await loadResourceLibrary(root);
const tracks = deduplicateTrackChoices(await timeAttackTrackCatalogAll(library))
  .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const directory = JSON.parse(fs.readFileSync(path.join(root,
  "server-go/internal/data/economy/track-directory.json"), "utf8"));
const expectedIds = directory.tracks.map(track => track.id).sort();
const actualIds = tracks.map(track => track.id);
if (new Set(expectedIds).size !== expectedIds.length || json(actualIds) !== json(expectedIds))
  throw new Error("Mounted preview catalog differs from the admin track directory; regenerate its catalog first");
const sceneManifestPath = path.join(sceneDir, "provenance.json");
const sceneManifest = fs.existsSync(sceneManifestPath)
  ? JSON.parse(fs.readFileSync(sceneManifestPath, "utf8")) : undefined;
if (sceneManifest && (sceneManifest.schemaVersion !== 1 || !Array.isArray(sceneManifest.tracks)))
  throw new Error("Scene provenance must have schemaVersion 1 and a tracks array");
const sceneRecords = new Map((sceneManifest?.tracks ?? []).map(record => [record.id, record]));
if (sceneManifest && sceneRecords.size !== sceneManifest.tracks.length)
  throw new Error("Scene provenance contains duplicate IDs");
const sourceCache = new Map(), imageCache = new Map(), entries = [], missing = [];

for (const track of tracks) {
  const model = library.get(track.path);
  if (!model) throw new Error(`${track.id}: missing track model ${track.path}`);
  const modelPath = model.canonicalPath ?? model.virtualPath;
  const directory = modelPath.slice(0, modelPath.lastIndexOf("/") + 1);
  let source, kind;
  for (const [name, candidateKind] of sourceOrder) {
    const result = library.resolveContainerPath(track.path, `${directory}${name}`);
    if (result.status === "ambiguous") throw new Error(`${track.id}: ambiguous ${name}`);
    if (result.status === "found") { source = result.entry; kind = candidateKind; break; }
  }
  let sourceDescription, sourceKey, bytes, sceneRecord;
  if (source) {
    sourceKey = `${source.sourceName}:${source.virtualPath}`;
    sourceDescription = { archive: source.sourceName, path: source.canonicalPath ?? source.virtualPath };
    if (!sourceCache.has(sourceKey)) bytes = Buffer.from(await source.bytes());
  } else {
    const sceneFile = path.join(sceneDir, `${track.id}.png`);
    if (!fs.existsSync(sceneFile)) { missing.push(track.id); continue; }
    sceneRecord = sceneRecords.get(track.id);
    if (!sceneRecord) throw new Error(`${track.id}: missing its scene provenance record`);
    const modelSha256 = sha(await model.bytes());
    bytes = fs.readFileSync(sceneFile);
    if (sceneRecord.file !== `${track.id}.png` || sceneRecord.modelArchive !== model.sourceName ||
        sceneRecord.modelPath !== modelPath || sceneRecord.modelSha256 !== modelSha256 ||
        sceneRecord.imageSha256 !== sha(bytes))
      throw new Error(`${track.id}: scene PNG or source model no longer matches its capture provenance; recapture it`);
    kind = "scene";
    sourceKey = `scene:${track.id}`;
    sourceDescription = { path: relative(sceneFile), modelArchive: model.sourceName,
      modelPath, modelSha256 };
  }
  let original = sourceCache.get(sourceKey);
  if (!original) {
    const decoded = await decodePngRgba(bytes);
    if (sceneRecord && (sceneRecord.width !== decoded.width || sceneRecord.height !== decoded.height))
      throw new Error(`${track.id}: scene dimensions differ from its capture provenance`);
    const pixelSha256 = sha(decoded.pixels);
    const identity = sha(Buffer.concat([Buffer.from(`${decoded.width}x${decoded.height}\0`), decoded.pixels]));
    original = { bytes, width: decoded.width, height: decoded.height,
      pixelSha256, sourceSha256: sha(bytes), filename: `${identity.slice(0, 24)}.webp` };
    sourceCache.set(sourceKey, original);
    if (!imageCache.has(original.filename)) imageCache.set(original.filename, original);
  }
  entries.push({ id: track.id, kind, width: original.width, height: original.height,
    file: original.filename, source: sourceDescription,
    sourceSha256: original.sourceSha256, rgbaSha256: original.pixelSha256 });
}
if (missing.length && !allowMissing)
  throw new Error(`${missing.length} maps need real scene captures: ${missing.join(", ")}`);

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kart-admin-track-previews-"));
const encoded = new Map();
try {
  const work = [...imageCache.entries()];
  let cursor = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(6, work.length) }, async () => {
    while (cursor < work.length) {
      const [filename, original] = work[cursor++];
      const destination = path.join(out, filename);
      if (!check && !fs.existsSync(destination)) {
        const input = path.join(temporary, filename + ".png");
        const output = path.join(temporary, filename);
        fs.writeFileSync(input, original.bytes);
        await run(command("cwebp"), ["-quiet", "-lossless", "-exact", "-z", "6", input, "-o", output]);
        writeChanged(destination, fs.readFileSync(output));
      }
      if (!fs.existsSync(destination)) throw new Error(`Missing exported image ${filename}`);
      const { stdout } = await run(command("dwebp"), ["-quiet", destination, "-pam", "-o", "-"],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 });
      const decoded = decodePam(stdout);
      if (decoded.width !== original.width || decoded.height !== original.height ||
          sha(decoded.pixels) !== original.pixelSha256)
        throw new Error(`${filename}: decoded WebP RGBA differs from the source PNG`);
      const bytes = fs.readFileSync(destination);
      encoded.set(filename, { sha256: sha(bytes), bytes: bytes.length });
      completed++;
      if (completed % 100 === 0) console.log(`${check ? "Verified" : "Exported"} ${completed}/${work.length} images`);
    }
  }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }

const index = Object.fromEntries(entries.map(entry => [entry.id, entry.file]));
const metadata = Object.fromEntries(entries.map(entry => [entry.id,
  { kind: entry.kind, width: entry.width, height: entry.height }]));
const provenance = {
  schemaVersion: 1,
  generatedFrom: "client/tools/export-admin-track-previews.mjs: deduplicated mounted built-in maps; same-container authored card, thumbnail, route map, then recorded real scene capture",
  encoding: "WebP lossless; cwebp -lossless -exact -z 6; dwebp RGBA verified against original PNG pixels",
  sceneManifestSha256: entries.some(entry => entry.kind === "scene") ? sha(fs.readFileSync(sceneManifestPath)) : null,
  tracks: entries.map(entry => ({ ...entry, outputSha256: encoded.get(entry.file).sha256,
    outputBytes: encoded.get(entry.file).bytes })),
  missingTrackIds: missing,
};
compareDocument("index.json", index);
compareDocument("metadata.json", metadata);
compareDocument("provenance.json", provenance);
const expected = new Set(["index.json", "metadata.json", "provenance.json", ...imageCache.keys()]);
const unexpected = fs.readdirSync(out).filter(name => !expected.has(name));
if (unexpected.length) throw new Error(`Unexpected stale preview files: ${unexpected.join(", ")}`);
const counts = Object.fromEntries(["card", "thumbnail", "map", "scene"].map(kind =>
  [kind, entries.filter(entry => entry.kind === kind).length]));
console.log(json({ status: check ? "verified" : "exported", maps: entries.length,
  catalogMaps: tracks.length, uniqueImages: imageCache.size, counts,
  originalUniquePngBytes: [...imageCache.values()].reduce((sum, image) => sum + image.bytes.length, 0),
  outputBytes: [...encoded.values()].reduce((sum, image) => sum + image.bytes, 0), missingTrackIds: missing }));
