#!/usr/bin/env node
// node tools/export-taiwan-track-metadata.mjs --audit /path/to/maps-comparison.json
// Read the audited TW tables without replacing CN metadata or random pools.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const option = name => { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1]; };
const auditPath = option('--audit');
if (!auditPath) throw new Error('--audit maps-comparison.json is required');
const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const target = option('--out') ?? fileURLToPath(new URL('../src/resources/taiwan-tracks.json', import.meta.url));
const rows = audit.tableSources.filter(source => /track@zz\./i.test(source.path))
  .flatMap(source => source.rows.map(row => ({ ...row, sourceName: source.sourceName })));
const choices = audit.webCatalog.timeattack;
const lower = value => String(value ?? '').toLowerCase();
function sourceMetadata(folder) {
  // An exact ID takes priority over other tracks that alias this folder.
  const exact = rows.filter(row => lower(row.id) === lower(folder));
  const candidates = exact.length ? exact : rows.filter(row => lower(row.folder) === lower(folder));
  const byRegion = candidates.find(row => row.sourceName === 'track.rho') ?? candidates[0];
  if (byRegion) return byRegion;
  // Some duplicate model folders have no table row. Their decoded model and
  // original folder name provide a regional base, without guessing a new theme.
  const base = folder.replace(/^facelift_/i, '').replace(/_(?:old|night|new)$/i, '');
  return rows.find(row => lower(row.id) === lower(base) && row.sourceName === 'track.rho') ??
    rows.find(row => lower(row.id) === lower(base)) ?? {};
}
function themeOf(folder, metadata) {
  if (metadata.theme) return metadata.theme;
  const candidate = folder.replace(/^facelift_/i, '').split('_')[0];
  return candidate === 'kartcity' ? 'village' : candidate;
}
function entry(row, unusual = false) {
  const sourceFolder = unusual ? row.path.split('/')[1] : row.folder;
  const variant = unusual ? '_boost_charge' : row.variant;
  const reverse = /(?:^|_)rvs(?:_|$)/i.test(variant);
  const variantName = variant.replace(/^_/, '').split('_').filter(part => part !== 'rvs').join('_');
  const id = !variant ? sourceFolder : variant === '_rvs' ? `${sourceFolder}_rvs`
    : `${sourceFolder}__${variantName}${reverse ? '_rvs' : ''}`;
  const baseRow = unusual ? audit.missingResourceEntries.find(entry => entry.folder === sourceFolder && !entry.variant) : row;
  let metadata = sourceMetadata(sourceFolder);
  if (!Object.keys(metadata).length) {
    // Three renamed crazy-map copies have no TW table row. Their exact model
    // hash identifies the original course whose table supplies laps/type.
    const originalFolder = baseRow?.samePayloadWeb?.[0]?.key.split('/')[0];
    if (originalFolder) metadata = sourceMetadata(originalFolder);
  }
  const baseTitle = baseRow?.title ?? sourceFolder;
  const variantTitle = variant && variant !== '_rvs' ? ` (${variant.replace(/^_/, '')})` : '';
  const title = `${reverse ? '[反]' : ''}${baseTitle}${variantTitle}`;
  const modelFile = `track${variant}.1s`;
  const folder = `tw_${sourceFolder}`;
  const laps = Number(metadata.laps);
  const difficulty = Number(metadata.difficulty);
  const theme = themeOf(sourceFolder, metadata);
  // A missing table row can be a byte-identical regional alias. Reuse the
  // identified base track only for metadata fields the TW table does not carry.
  const sameModel = baseRow?.samePayloadWeb?.map(match => choices.find(c => c.id === match.id)).find(Boolean);
  const data = { id, sourceFolder, folder, modelFile, canonicalPath: `track_/${folder}/${modelFile}`,
    title, gameType: metadata.gameType === 'item' ? 'item' : 'speed',
    laps: Number.isInteger(laps) && laps > 0 ? laps : 1,
    difficulty: Number.isInteger(difficulty) && difficulty >= 0 ? difficulty : sameModel?.difficulty ?? 0,
    theme, reverse, ...(metadata.texTheme ? { texTheme: metadata.texTheme } : {}),
    ...(metadata.bgmTheme ? { bgmTheme: metadata.bgmTheme } : {}),
    ...(metadata.bgmFile ? { bgmFile: metadata.bgmFile } : {}),
    ...(metadata.showLapUI !== undefined ? { showLapUi: lower(metadata.showLapUI) === 'true' } : {}),
    sourceMetadata: Object.fromEntries(Object.entries(metadata).filter(([key]) => !['sourceName', 'path', 'tag'].includes(key))),
    source: { archive: unusual ? row.sourceName : row.sources[0].sourceName,
      path: unusual ? row.path : row.sources[0].path,
      sha256: unusual ? row.sha256 : row.sources[0].sha256 } };
  return data;
}
const tracks = [...audit.missingResourceEntries.map(row => entry(row)), ...audit.nonstandardModels.map(row => entry(row, true))];
if (new Set(tracks.map(track => lower(track.id))).size !== tracks.length) throw new Error('Duplicate Taiwanese track IDs');
if (new Set(tracks.map(track => lower(track.canonicalPath))).size !== tracks.length) throw new Error('Duplicate Taiwanese model paths');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify({ version: 1, tracks }, null, 2) + '\n');
console.log(`${tracks.length} Taiwanese track models -> ${target}`);
