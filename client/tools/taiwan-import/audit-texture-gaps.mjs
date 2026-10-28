#!/usr/bin/env node
// Read-only resource audit; the JSON report is separate from the game assets.
// From client/: node --import tsx tools/taiwan-import/audit-texture-gaps.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadResourceLibrary } from '../economy-export/resource-library.mjs';

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const project = path.dirname(client);
const audit = path.resolve(project, '../台服资源提取与对比-2026-10-28');
const receipt = JSON.parse(fs.readFileSync(path.join(client, 'tools/taiwan-import/import-manifest.json'), 'utf8'));
const tracks = JSON.parse(fs.readFileSync(path.join(client, 'src/resources/taiwan-tracks.json'), 'utf8')).tracks;
const validation = JSON.parse(fs.readFileSync(path.join(client, 'output/taiwan-track-validation.json'), 'utf8'));
const sourceFiles = JSON.parse(fs.readFileSync(path.join(audit, 'tw-virtual-files.json'), 'utf8'));
const { library, manifest } = await loadResourceLibrary(project);
const owned = new Set(receipt.containers.map(c => c.name.toLowerCase()));
const originalWebFiles = library.files.filter(f => !owned.has(f.sourceName.toLowerCase()));
const isTexture = p => /\.(dds|png|jpg|tga|kng)$/i.test(p);
const stem = p => path.parse(p).name.toLowerCase();
const missing = validation.tracks.filter(t => t.textureProblems.length);
const names = [...new Set(receipt.unresolvedTextures.map(t => t.texture))].sort();
const evidence = names.map(name => {
  const sourceMatches = sourceFiles.filter(f => isTexture(f.path) && stem(f.path) === name.toLowerCase())
    .map(f => ({ path: f.path, sourceName: f.sourceName }));
  const webMatches = originalWebFiles.filter(f => isTexture(f.canonicalPath) && stem(f.canonicalPath) === name.toLowerCase())
    .map(f => ({ path: f.canonicalPath, sourceName: f.sourceName }));
  const references = receipt.unresolvedTextures.filter(t => t.texture === name);
  const runtimeMaps = missing.filter(t => t.textureProblems.some(p => p.name === name))
    .map(t => ({ id: t.id, importedPath: t.path, original: tracks.find(row => row.id === t.id)?.source }));
  return { texture: name, sourceMatches, webMatches, sourceFolderReferences: references.map(r => r.folder), runtimeMaps };
});
const report = {
  revision: manifest.revision,
  scope: 'Exact case-insensitive texture stem search across every Taiwan extracted archive and every pre-import web resource; supported DDS/PNG/JPG/TGA/KNG formats.',
  summary: {
    importedTracks: tracks.length, validatedTracks: validation.summary.selected,
    structuralOrRouteFailures: validation.summary.failed,
    affectedPlayableMapEntries: missing.length,
    runtimeMissingTextureReferences: missing.reduce((n, t) => n + t.textureProblems.length, 0),
    distinctMissingTextureNames: names.length,
    sourceFolderTexturePairs: receipt.unresolvedTextures.length,
    sourceFolders: new Set(receipt.unresolvedTextures.map(t => t.folder)).size,
    exactMatchesFoundInTaiwanOrOriginalWeb: evidence.reduce((n, e) => n + e.sourceMatches.length + e.webMatches.length, 0),
  },
  policy: 'No fabricated textures or guessed near-name substitutions were inserted. Original geometry and playable routes remain intact; missing source textures use the renderer fallback.',
  evidence,
};
const destination = path.join(project, 'output/taiwan-resource-import/source-texture-gaps.json');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ ...report.summary, report: destination }));
