#!/usr/bin/env node
/**
 * node --import tsx tools/export-admin-vehicle-previews.mjs [--check]
 * First capture real native vehicles with export-admin-vehicle-capture.mjs.
 * --scenes PATH overrides output/vehicle-admin/scenes; --out PATH overrides the
 * admin asset directory. Original PNGs remain audit output rather than a second
 * committed copy. --check verifies all model and manifest source hashes, every
 * lossless WebP SHA/RGBA/dimension and its ID mapping. If original PNGs are
 * present, their SHA/RGBA are verified too. No network/game/admin write occurs.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadResourceLibrary } from "./economy-export/resource-library.mjs";
import { kartCatalogIdentity } from "../src/resources/system-kart-identity.ts";
import { decodePngRgba } from "../src/resources/png-decoder.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const option = name => {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith("--")) throw Error(`${name} requires a path`);
  return path.resolve(process.argv[index + 1]);
};
const out = option("--out") ?? path.join(root, "server-go/admin-ui/src/assets/vehicle-previews");
const scenes = option("--scenes") ?? path.join(root, "output/vehicle-admin/scenes");
const check = process.argv.includes("--check");
const run = promisify(execFile);
const command = name => process.env[name.toUpperCase()] ?? (fs.existsSync(`/opt/homebrew/bin/${name}`) ? `/opt/homebrew/bin/${name}` : name);
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const writeChanged = (file, bytes) => {
  const next = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (fs.existsSync(file) && fs.readFileSync(file).equals(next)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, next);
};
const compareDocument = (name, document) => {
  const file = path.join(out, name), contents = json(document);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== contents) throw Error(`${name} is stale`);
  } else writeChanged(file, contents);
};
function decodePam(bytes) {
  const buffer = Buffer.from(bytes), marker = Buffer.from("ENDHDR\n"), separator = buffer.indexOf(marker);
  if (separator < 0) throw Error("Invalid dwebp PAM");
  const header = buffer.subarray(0, separator).toString("ascii");
  const number = field => Number(new RegExp(`^${field} (\\d+)$`, "m").exec(header)?.[1]);
  const width = number("WIDTH"), height = number("HEIGHT"), depth = number("DEPTH");
  const raw = buffer.subarray(separator + marker.length);
  if (!header.startsWith("P7\n") || width <= 0 || height <= 0 || ![3, 4].includes(depth) ||
      number("MAXVAL") !== 255 || raw.length !== width * height * depth) throw Error("Unexpected dwebp PAM layout");
  if (depth === 4) return { width, height, pixels: raw };
  const pixels = Buffer.alloc(width * height * 4, 255);
  for (let source = 0, target = 0; source < raw.length; source += 3, target += 4) raw.copy(pixels, target, source, source + 3);
  return { width, height, pixels };
}

const directory = JSON.parse(fs.readFileSync(path.join(root, "server-go/internal/data/economy/vehicle-directory.json"), "utf8"));
const saved = check ? JSON.parse(fs.readFileSync(path.join(out, "provenance.json"), "utf8")) : undefined;
const capture = check ? saved.capture : JSON.parse(fs.readFileSync(path.join(scenes, "provenance.json"), "utf8"));
if (capture.schemaVersion !== 1 || capture.directoryVersion !== directory.version || !Array.isArray(capture.vehicles))
  throw Error("Capture directory or schema version differs");
if (sha(fs.readFileSync(path.join(root, capture.resourceManifest))) !== capture.resourceManifestSha256 ||
    sha(fs.readFileSync(path.join(root, capture.rendererPage))) !== capture.rendererPageSha256)
  throw Error("Capture resource manifest or renderer page changed; recapture and review");
const rendererSources = ["client/src/generated/ui.js", "client/src/generated/library.js", "client/src/generated/formats.js",
  "client/src/ui/garage-live-panel-render.ts", "client/src/resources/garage-catalog.ts",
  "client/src/resources/system-kart-identity.ts"];
if (json(Object.keys(capture.rendererSources ?? {}).sort()) !== json([...rendererSources].sort()))
  throw Error("Capture renderer source inventory differs");
for (const file of rendererSources)
  if (sha(fs.readFileSync(path.join(root, file))) !== capture.rendererSources[file])
    throw Error(`${file}: native renderer source changed since capture; recapture and review`);
const expectedIds = directory.vehicles.map(row => row.id);
if (json(capture.vehicles.map(row => row.id)) !== json(expectedIds)) throw Error("Capture IDs differ from complete vehicle directory");
const { library } = await loadResourceLibrary(root);
const catalog = new Map((await library.timeAttackGarageCatalog()).karts.map(kart => [kartCatalogIdentity(kart), kart]));
if (catalog.size !== expectedIds.length || expectedIds.some(id => !catalog.has(id))) throw Error("Mounted garage differs from vehicle directory");
const modelHashes = new Map(), entries = [], images = new Map();
const previous = new Map((saved?.vehicles ?? []).map(record => [record.id, record]));
for (const record of capture.vehicles) {
  const kart = catalog.get(record.id);
  if (record.requestedPath !== kart.path || record.internalId !== kart.internalId ||
      !/^(?:catalog-3-\d+|system-[\w-]+)\.png$/.test(record.file) || record.width !== 440 || record.height !== 300 ||
      record.visiblePixels <= 100 || record.triangles <= 0 || record.bounds.minX < 12 || record.bounds.minY < 12 ||
      record.bounds.maxX >= 428 || record.bounds.maxY >= 288) throw Error(`${record.id}: invalid native vehicle capture`);
  const renderMethod = ["catalog:3:323", "catalog:3:330"].includes(record.id)
    ? "native-same-model-without-driving-parameters" : "native-garage-card";
  if (record.renderMethod !== renderMethod) throw Error(`${record.id}: unexpected capture rendering method`);
  const key = `${record.modelArchive}:${record.modelPath}`;
  if (!modelHashes.has(key)) {
    const candidates = library.exactCanonicalCandidates(record.modelPath).filter(entry => entry.sourceName === record.modelArchive);
    if (candidates.length !== 1) throw Error(`${record.id}: source model is absent or ambiguous`);
    modelHashes.set(key, sha(await candidates[0].bytes()));
  }
  if (modelHashes.get(key) !== record.modelSha256) throw Error(`${record.id}: model changed since capture`);
  let original;
  const source = path.join(scenes, record.file);
  if (fs.existsSync(source)) {
    const bytes = fs.readFileSync(source);
    if (sha(bytes) !== record.imageSha256) throw Error(`${record.id}: captured PNG changed`);
    const decoded = await decodePngRgba(bytes);
    if (decoded.width !== record.width || decoded.height !== record.height) throw Error(`${record.id}: PNG dimensions differ`);
    const rgbaSha256 = sha(decoded.pixels);
    const identity = sha(Buffer.concat([Buffer.from(`${decoded.width}x${decoded.height}\0`), decoded.pixels]));
    original = { bytes, width: decoded.width, height: decoded.height, rgbaSha256, file: `${identity.slice(0, 24)}.webp` };
  } else if (!check) throw Error(`${record.id}: capture PNG is missing`);
  const old = previous.get(record.id);
  if (check && (!old || (original && (old.file !== original.file || old.rgbaSha256 !== original.rgbaSha256))))
    throw Error(`${record.id}: published image differs from capture`);
  const entry = { id: record.id, kind: "scene", width: record.width, height: record.height,
    file: original?.file ?? old.file, sourceSha256: record.imageSha256,
    rgbaSha256: original?.rgbaSha256 ?? old.rgbaSha256 };
  if (!/^[0-9a-f]{24}\.webp$/.test(entry.file) || !/^[0-9a-f]{64}$/.test(entry.rgbaSha256)) throw Error(`${record.id}: invalid image identity`);
  entries.push(entry);
  if (!images.has(entry.file)) images.set(entry.file, original ?? entry);
}
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "kart-admin-vehicle-previews-")), encoded = new Map();
try {
  const work = [...images.entries()]; let cursor = 0, completed = 0;
  await Promise.all(Array.from({ length: Math.min(6, work.length) }, async () => {
    while (cursor < work.length) {
      const [filename, original] = work[cursor++], destination = path.join(out, filename);
      if (!check && !fs.existsSync(destination)) {
        const input = path.join(temporary, filename + ".png"), output = path.join(temporary, filename);
        fs.writeFileSync(input, original.bytes);
        await run(command("cwebp"), ["-quiet", "-lossless", "-exact", "-z", "6", input, "-o", output]);
        writeChanged(destination, fs.readFileSync(output));
      }
      if (!fs.existsSync(destination)) throw Error(`Missing image ${filename}`);
      const { stdout } = await run(command("dwebp"), ["-quiet", destination, "-pam", "-o", "-"], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 });
      const decoded = decodePam(stdout);
      if (decoded.width !== original.width || decoded.height !== original.height || sha(decoded.pixels) !== original.rgbaSha256)
        throw Error(`${filename}: lossless RGBA or dimensions differ from original capture`);
      const bytes = fs.readFileSync(destination); encoded.set(filename, { sha256: sha(bytes), bytes: bytes.length });
      completed++; if (completed % 200 === 0) console.log(`${check ? "Verified" : "Exported"} ${completed}/${work.length} images`);
    }
  }));
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
const index = Object.fromEntries(entries.map(entry => [entry.id, entry.file]));
const metadata = Object.fromEntries(entries.map(entry => [entry.id, { kind: entry.kind, width: entry.width, height: entry.height }]));
const provenance = { schemaVersion: 1, generatedFrom: "client/tools/export-admin-vehicle-previews.mjs: real native same-vehicle garage card captures; never UV textures, generic icons or another vehicle's image",
  encoding: "WebP lossless; cwebp -lossless -exact -z 6; original captured PNG and decoded output RGBA hashes retained",
  capture, vehicles: entries.map(entry => ({ ...entry, outputSha256: encoded.get(entry.file).sha256, outputBytes: encoded.get(entry.file).bytes })), missingVehicleIds: [] };
compareDocument("index.json", index); compareDocument("metadata.json", metadata); compareDocument("provenance.json", provenance);
const expectedFiles = new Set(["index.json", "metadata.json", "provenance.json", ...images.keys()]);
const stale = fs.readdirSync(out).filter(name => !expectedFiles.has(name));
if (stale.length) throw Error(`Unexpected stale preview files: ${stale.join(", ")}`);
console.log(json({ status: check ? "verified" : "exported", vehicles: entries.length, uniqueImages: images.size,
  outputBytes: [...encoded.values()].reduce((sum, row) => sum + row.bytes, 0), missingVehicleIds: [] }));
