#!/usr/bin/env node
// Rebuild the eight preview images whose source archives contain no artwork.
// Start Vite in a checkout matching provenance.codeRevision, then from client:
// node --import tsx tools/capture-admin-track-scenes.mjs --origin=http://127.0.0.1:8780
// Requires Playwright, Chrome and Pillow. Optional env: PLAYWRIGHT_MODULE,
// CHROME_PATH, TRACK_PREVIEW_PYTHON. This writes audit output, never source assets.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {indexedTrackLibrary} from './export-track-catalog.mjs';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const origin = new URL(option('origin', 'http://127.0.0.1:8780'));
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)) throw Error('Use a local Vite server matching the recorded code revision');
const manifestPath = path.resolve(option('manifest', path.join(project, 'client/assets/track-preview-scenes/provenance.json')));
const output = path.resolve(option('output', path.join(project, 'output/track-admin-thumbnail-audit/recaptured')));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.tracks)) throw Error('Unsupported scene provenance');
if (hash(fs.readFileSync(path.join(project, manifest.rendererPage))) !== manifest.rendererPageSha256) throw Error('Renderer changed: review it against the recorded revision before capturing');
if (hash(fs.readFileSync(path.join(project, manifest.resourceManifest))) !== manifest.resourceManifestSha256) throw Error('Resource manifest changed: explicitly review source provenance before capturing');
const remoteManifest = await fetch(new URL('/__p3553/resources', origin), {signal: AbortSignal.timeout(10000)});
if (!remoteManifest.ok || hash(Buffer.from(await remoteManifest.arrayBuffer())) !== manifest.resourceManifestSha256) throw Error('Local Vite serves different resources');
const library = indexedTrackLibrary();
for (const track of manifest.tracks) {
  if (!/^[\w-]+\.png$/.test(track.file) || track.width !== 352 || track.height !== 198) throw Error(`Invalid preview output: ${track.id}`);
  const model = library.files.find(file => file.virtualPath === track.indexedModelPath);
  if (!model || hash(await model.bytes()) !== track.modelSha256) throw Error(`Model changed: ${track.id}`);
  if (hash(fs.readFileSync(path.join(path.dirname(manifestPath), track.file))) !== track.imageSha256) throw Error(`Reference preview changed: ${track.id}`);
  if (track.cameraPlan.views.length !== 1 || track.cameraPlan.views[0].key !== track.camera.key) throw Error(`Invalid camera plan: ${track.id}`);
}
fs.mkdirSync(output, {recursive: true});
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--ignore-gpu-blocklist']});
const context = await browser.newContext({viewport: {width: 960, height: 540}, deviceScaleFactor: 1});
await context.addInitScript(() => {
  const NativeDate = Date, fixed = Date.UTC(2026, 9, 28);
  class CaptureDate extends NativeDate { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }
  globalThis.Date = CaptureDate;
  let seed = 0x4b415254;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
});
const report = {schemaVersion: 1, codeRevision: manifest.codeRevision, method: manifest.method, tracks: []};
const save = () => fs.writeFileSync(path.join(output, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n');
try {
  for (const track of manifest.tracks) {
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(new URL('/tests/browser/track-dedup.html', origin).href);
      await page.waitForFunction(() => window.ready, null, {timeout: 30000});
      const loaded = await page.evaluate(({id, plan}) => window.loadComparisonTrack({id}, plan), {id: track.id, plan: track.cameraPlan});
      if (loaded.requestedPath !== track.runtimeModelPath) throw Error(`Runtime model path changed: ${track.id}`);
      const rendered = await page.evaluate(key => window.renderComparisonView(key), track.camera.key);
      if (!rendered.nonuniform || rendered.triangles <= 0 || errors.length) throw Error(`Invalid render: ${track.id}; ${errors.join('; ')}`);
      const full = path.join(output, `${track.id}.full.png`), final = path.join(output, track.file);
      await page.locator('canvas').screenshot({path: full});
      const converted = spawnSync(process.env.TRACK_PREVIEW_PYTHON ?? 'python3', ['-c', [
        'from PIL import Image,ImageChops,ImageStat',
        'import sys,json',
        'im=Image.open(sys.argv[1]).convert("RGB").resize((352,198),Image.Resampling.LANCZOS)',
        'im.save(sys.argv[2],optimize=True)',
        'ref=Image.open(sys.argv[3]).convert("RGB")',
        'delta=ImageChops.difference(im,ref)',
        'changed=sum(1 for p in delta.get_flattened_data() if p!=(0,0,0)) if hasattr(delta,"get_flattened_data") else sum(1 for p in delta.getdata() if p!=(0,0,0))',
        'maximum=max(value[1] for value in delta.getextrema())',
        'print(json.dumps({"changedPixels":changed,"changedPixelRatio":changed/(352*198),"maxChannelDifference":maximum,"meanChannelDifference":sum(ImageStat.Stat(delta).mean)/3,"withinPixelTolerance":maximum<=2 and changed/(352*198)<=0.001}))',
      ].join('\n'), full, final, path.join(path.dirname(manifestPath), track.file)], {encoding: 'utf8'});
      if (converted.status !== 0) throw Error(`Pillow resize failed: ${converted.stderr || converted.error}`);
      const imageSha256 = hash(fs.readFileSync(final));
      const comparison = JSON.parse(converted.stdout);
      report.tracks.push({id: track.id, file: track.file, modelSha256: track.modelSha256, imageSha256, matchesRecordedImage: imageSha256 === track.imageSha256, comparison, width: 352, height: 198, rendered, pageErrors: errors});
      console.log(`${track.id}: ${imageSha256 === track.imageSha256 ? 'exact image match' : comparison.withinPixelTolerance ? 'matches within GPU edge tolerance (recorded in report)' : 'pixels differ; review GPU/browser version before adopting'}`);
      save();
    } finally {
      try { await page.evaluate(() => window.closeComparison?.()); } catch {}
      await page.close();
    }
  }
} finally { await context.close(); await browser.close(); save(); }
if (report.tracks.some(track => !track.comparison.withinPixelTolerance)) process.exitCode = 1;
