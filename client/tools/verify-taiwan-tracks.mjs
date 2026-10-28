#!/usr/bin/env node
// Runs the actual resource library, model/route decoder and texture resolver.
// node --import tsx tools/verify-taiwan-tracks.mjs [--out report.json] [--render]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadResourceLibrary } from './economy-export/resource-library.mjs';
import { TAIWAN_TRACKS } from '../src/resources/taiwan-tracks.ts';
import { extraTrackCategory, resourceTracks } from '../src/resources/extra-tracks.ts';
import { invisibleTrackGeometry } from '../src/resources/moving-obstacle.ts';
import { raceBgmArchiveTracks, selectRaceBgmTheme } from '../src/timeattack/race-bgm-resources.ts';
const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i+1]; };
const project = fileURLToPath(new URL('../../', import.meta.url));
const { library, formats } = await loadResourceLibrary(project);
const catalog = await library.timeAttackTrackCatalog();
const resources = new Map(resourceTracks(library).map(r => [r.id, r]));
const result = [];
const start = Number(option('--start') ?? 0), end = Number(option('--end') ?? TAIWAN_TRACKS.length);
for (const track of TAIWAN_TRACKS.slice(start,end)) {
  const row = { id: track.id, path: track.canonicalPath, errors: [], textureProblems: [] };
  let scene;
  try {
    const choice = catalog.find(entry => entry.id === track.id);
    if (!choice) throw new Error('Missing selectable choice');
    const metadata = await library.trackMetadata(track.id);
    if (choice.title !== track.title || metadata?.laps !== track.laps || metadata?.folder !== track.folder)
      throw new Error('Metadata/title/folder does not match the TW source');
    const entry = library.get(choice.path);
    if (!entry) throw new Error('Selected model is not mounted');
    row.containerId = entry.containerId;
    const model = formats.y9(await entry.bytes());
    if (model.root.kind !== 'track') throw new Error('Model is not TrackContainer');
    const route = formats.YW(model, 'time-attack', {forceReverse: choice.reverse === true, consistentUvTangents: true});
    row.sections = route.sections.length;
    row.collisionTriangles = route.collisionTriangles.length;
    row.start = route.start.position;
    row.minimaps = model.root.trackObjects.filter(object => object.kind === 'ToMinimap').length;
    if (row.minimaps !== 1) throw new Error(`Expected one minimap, found ${row.minimaps}`);
    const config = await library.loadTrackConfig(choice.path);
    row.config = config.root?.name ?? 'authoritative default';
    if (!config.root && !config.model.absenceAuthoritative) throw new Error('No authoritative track config/default');
    if (config.root && config.root.name !== 'trackInfo') throw new Error('Invalid track config root');
    const bgmTheme = selectRaceBgmTheme(metadata);
    const bgm = [bgmTheme, `${bgmTheme}2`].flatMap(theme => raceBgmArchiveTracks(library, theme));
    row.bgmTheme = bgmTheme;
    row.bgmTracks = bgm.length;
    if (!bgm.length) throw new Error(`No BGM resources for ${bgmTheme}`);
    const nested = model.root.trackObjects.flatMap(object => object.object?.kind === 'node' ? [object.object] : []);
    const names = new Map();
    for (const root of [model.root.scene, ...nested]) {
      const inspection = formats.hB(root);
      for (const candidate of inspection.candidates) {
        if (candidate.issues.length) row.errors.push(`render ${candidate.node.name}: ${candidate.issues[0]}`);
        if (candidate.state.fog.value.selector !== 0) row.errors.push(`render ${candidate.node.name}: unsupported fog pass`);
        const texture = candidate.state.texture.value;
        if (texture.name !== undefined) names.set(texture.name, texture);
      }
    }
    row.textureCount = names.size;
    const textureEntries = new Map();
    for (const [name, texture] of names) {
      const resolved = formats.sn(library, choice.path, metadata, texture);
      if (resolved.status === 'found') textureEntries.set(resolved.entry.virtualPath, {entry:resolved.entry, texture});
      else if (resolved.status !== 'none') row.textureProblems.push({ name, status: resolved.status, reason: resolved.reason });
    }
    // Reading each resolved dependency catches corrupt/truncated/mismatched imports.
    for (const { entry } of textureEntries.values()) await entry.bytes();
    row.readTextureFiles = textureEntries.size;
    if (process.argv.includes('--render')) {
      scene = await formats.c5(model, library, choice.path, metadata, {
        hiddenNodes: invisibleTrackGeometry([model.root.scene]),
      });
      row.rendered = true;
    }
    row.resourceCategory = extraTrackCategory(resources.get(track.id));
  } catch (error) { row.errors.push(error instanceof Error ? error.message : String(error)); }
  finally { scene?.dispose(); }
  result.push(row);
  if (result.length % 20 === 0) console.log(`verified ${start+result.length}/${end}`);
}
const summary = { selected: result.length, catalogTotal: catalog.length,
  failed: result.filter(row=>row.errors.length).length,
  textureProblems: result.filter(row=>row.textureProblems.length).length,
  rendered: result.filter(row=>row.rendered).length };
const out = option('--out') ?? path.join(project, 'output/taiwan-track-validation.json');
fs.mkdirSync(path.dirname(out), {recursive:true});
fs.writeFileSync(out, JSON.stringify({summary,tracks:result}, null, 2)+'\n');
console.log(JSON.stringify(summary));
if (summary.failed || summary.textureProblems) process.exitCode=1;
