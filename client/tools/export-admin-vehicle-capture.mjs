#!/usr/bin/env node
// Capture original native vehicle cards for the admin preview exporter.
// Start Vite in a clean matching checkout, then run with --import tsx:
// node tools/export-admin-vehicle-capture.mjs --origin=http://127.0.0.1:8780
// Optional --source-root=/clean/checkout --output=/audit/pngs --workers=3.
// Original PNGs stay in output/ (untracked); published WebPs are lossless.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const origin = new URL(option("origin", "http://127.0.0.1:8780"));
if (!["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw Error("Capture requires local Vite");
const sourceRoot = path.resolve(option("source-root", root));
const output = path.resolve(option("output", path.join(root, "output/vehicle-admin/scenes")));
const workers = Math.max(1, Math.min(4, Number(option("workers", "3"))));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const directory = JSON.parse(fs.readFileSync(path.join(root, "server-go/internal/data/economy/vehicle-directory.json"), "utf8"));
const rendererPage = "client/tools/export-admin-vehicle-renderer.html";
const resourceManifest = "mirror/__p3553/resources";
const shared = { schemaVersion: 1, directoryVersion: directory.version,
  method: "Original native GarageLivePanels vehicle card, original model, textures, paint and toon shading; 440x300 transparent PNG, native front camera reduced only if needed to keep a 12px margin, fixed animation tick 10000.",
  rendererPage, rendererPageSha256: hash(fs.readFileSync(path.join(sourceRoot, rendererPage))),
  resourceManifest, resourceManifestSha256: hash(fs.readFileSync(path.join(sourceRoot, resourceManifest))),
  rendererSources: Object.fromEntries([
    "client/src/generated/ui.js", "client/src/generated/library.js", "client/src/generated/formats.js",
    "client/src/ui/garage-live-panel-render.ts", "client/src/resources/garage-catalog.ts",
    "client/src/resources/system-kart-identity.ts",
  ].map(file => [file, hash(fs.readFileSync(path.join(sourceRoot, file)))])),
};
const remote = await fetch(new URL("/__p3553/resources", origin), { signal: AbortSignal.timeout(10000) });
if (!remote.ok || hash(Buffer.from(await remote.arrayBuffer())) !== shared.resourceManifestSha256)
  throw Error("Vite resource manifest does not match capture source");
fs.mkdirSync(output, { recursive: true });
const manifestPath = path.join(output, "provenance.json");
const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : undefined;
if (previous && Object.keys(shared).some(key => json(previous[key]) !== json(shared[key])))
  throw Error("Capture inputs changed; choose a fresh output directory");
const records = new Map((previous?.vehicles ?? []).map(record => [record.id, record]));
for (const record of records.values()) {
  if (!directory.vehicles.some(vehicle => vehicle.id === record.id) || !/^(?:catalog-3-\d+|system-[\w-]+)\.png$/.test(record.file) ||
      hash(fs.readFileSync(path.join(output, record.file))) !== record.imageSha256)
    throw Error(`Invalid saved capture ${record.id}`);
}
const save = () => fs.writeFileSync(manifestPath, json({ ...shared,
  vehicles: [...records.values()].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }));
const work = directory.vehicles.filter(vehicle => !records.has(vehicle.id)), failures = [];
let cursor = 0;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true, args: ["--enable-webgl", "--ignore-gpu-blocklist"] });
try {
  await Promise.all(Array.from({ length: Math.min(workers, work.length) }, async () => {
    const context = await browser.newContext({ viewport: { width: 880, height: 600 }, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      let seed = 0x4b415254;
      Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto(new URL("/tools/export-admin-vehicle-renderer.html", origin).href);
      await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
      while (cursor < work.length) {
        const vehicle = work[cursor++];
        let result;
        try { result = await page.evaluate(id => window.captureVehicle(id), vehicle.id); }
        catch (error) { failures.push({ id: vehicle.id, internalId: vehicle.internalId, error: String(error) }); console.error(`Capture failed ${vehicle.id}: ${String(error).split("\n")[0]}`); continue; }
        const { png, ...record } = result;
        if (errors.length) throw Error(errors.join("; "));
        const bytes = Buffer.from(png.split(",")[1], "base64"), file = vehicle.id.replaceAll(":", "-") + ".png";
        fs.writeFileSync(path.join(output, file), bytes);
        records.set(vehicle.id, { ...record, file, imageSha256: hash(bytes), imageBytes: bytes.length });
        save();
        if (records.size % 50 === 0) console.log(`Captured ${records.size}/${directory.vehicles.length} native vehicles`);
      }
    } finally { await page.evaluate(() => window.closeCapture?.()).catch(() => {}); await context.close(); }
  }));
} finally { await browser.close(); save(); }
console.log(json({ status: "captured", vehicles: records.size,
  bytes: [...records.values()].reduce((sum, row) => sum + row.imageBytes, 0),
  adaptedCameras: [...records.values()].filter(row => row.fitScale !== 1).length, output }));
fs.writeFileSync(path.join(output, "failures.json"), json(failures));
if (failures.length || records.size !== directory.vehicles.length) process.exitCode = 1;
