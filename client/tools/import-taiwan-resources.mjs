#!/usr/bin/env node
/**
 * Import the audited Taiwan additions without replacing any CN resource path.
 * From client/: node --import tsx tools/import-taiwan-resources.mjs [--audit DIR]
 * Verification: node --import tsx tools/import-taiwan-resources.mjs --check
 * Owned output containers, aaa.pk additions and catalog hashes are deterministic;
 * a second import preserves identical file bytes and modification times.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packRhoArchive } from '../src/codecs/rho-writer.ts';
import { scanRhoArchiveIndex } from '../src/codecs/rho-index-scan.ts';
import { RhoReader } from '../src/codecs/rho.ts';
import { readMountManifestDetails } from '../src/codecs/mount-manifest.ts';
import { serializeBinaryXml, exportXml } from '../src/codecs/binary-xml.ts';
import { parseResourceManifest } from '../src/resources/manifest.ts';
import { validateArchiveIndex } from '../src/resources/archive-index.ts';
import { diskSource, decodeIndexJson, encodeIndexJson, indexJson, sha256Hex } from './city/register-container.mjs';
import { loadResourceLibrary } from './economy-export/resource-library.mjs';
import { decodeMountTree, encodeMountTree, installMounts, textureStems, writeChanged } from './taiwan-import/archive-tools.mjs';

const client = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = path.dirname(client), version = 'p3553';
const args = process.argv.slice(2), check = args.includes('--check');
const option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--audit') { if (!args[++i]) throw new Error('--audit needs a directory'); }
  else if (args[i] !== '--check') throw new Error(`Unknown option: ${args[i]}`);
}
const auditDir = path.resolve(option('--audit') ?? path.join(project, '../台服资源提取与对比-2026-10-28'));
const toolsDir = path.join(client, 'tools/taiwan-import');
const outputDir = path.join(project, 'output/taiwan-resource-import');
const manifestPath = path.join(project, `mirror/__${version}/resources`);
const indexPath = path.join(project, `mirror/__${version}/archive-index`);
const dataDir = path.join(project, `mirror/${version}`);
const receiptPath = path.join(toolsDir, 'import-manifest.json');
const baselinePath = path.join(toolsDir, 'baseline.json');
const tracks = JSON.parse(fs.readFileSync(path.join(client, 'src/resources/taiwan-tracks.json'), 'utf8')).tracks;
const vehicleCatalog = JSON.parse(fs.readFileSync(path.join(client, 'src/resources/taiwan-vehicles.json'), 'utf8')).vehicles;
const vehicles = vehicleCatalog.filter(v => v.source !== 'web-existing');
if (tracks.length !== 362 || vehicles.length !== 96) throw new Error('Expected all 362 tracks and 96 vehicle additions');
const json = value => JSON.stringify(value, null, 2) + '\n';
const lower = value => value.toLowerCase();
const digestIndex = archive => sha256Hex(indexJson(archive));

async function verify() {
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const manifest = parseResourceManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), version);
  const index = decodeIndexJson(fs.readFileSync(indexPath));
  validateArchiveIndex(index, manifest);
  if (manifest.revision !== receipt.revision) throw new Error('Import receipt revision differs from current resource manifest');
  const current = new Map(manifest.files.map(f => [lower(f.name), f]));
  const owned = new Set(receipt.containers.map(c => lower(c.name)));
  for (const original of baseline.files) {
    if (original.name === 'aaa.pk') continue;
    if (JSON.stringify(current.get(lower(original.name))) !== JSON.stringify(original))
      throw new Error(`Existing manifest entry changed: ${original.name}`);
  }
  for (const archive of [...index.rho, ...index.rho5]) {
    if (owned.has(lower(archive.name))) continue;
    if (digestIndex(archive) !== baseline.indexHashes[lower(archive.name)])
      throw new Error(`Existing archive index changed: ${archive.name}`);
  }
  const mounts = await readMountManifestDetails(diskSource(path.join(dataDir, 'aaa.pk')));
  if (JSON.stringify(mounts.mounts.filter(m => !owned.has(lower(m.fileName)))) !== JSON.stringify(baseline.mounts))
    throw new Error('An existing aaa.pk mount changed');
  if (sha256Hex(fs.readFileSync(path.join(dataDir, 'aaa.pk'))) !== current.get('aaa.pk').sha256)
    throw new Error('aaa.pk SHA-256 differs from resource manifest');
  let checkedFiles = 0, checkedBytes = 0;
  for (const archive of receipt.containers) {
    const file = path.join(dataDir, archive.name), bytes = fs.readFileSync(file);
    const spec = current.get(lower(archive.name));
    if (!spec || spec.size !== bytes.length || spec.sha256 !== sha256Hex(bytes))
      throw new Error(`${archive.name}: manifest does not describe file bytes`);
    const fresh = await scanRhoArchiveIndex(diskSource(file));
    const stored = index.rho.find(i => lower(i.name) === lower(archive.name));
    if (indexJson(fresh) !== indexJson(stored)) throw new Error(`${archive.name}: archive index differs from a fresh scan`);
    const reader = new RhoReader(diskSource(file), fresh);
    const expected = new Map(archive.files.map(f => [lower(f.path), f]));
    if (expected.size !== reader.files.length) throw new Error(`${archive.name}: file count differs`);
    for (const record of reader.files) {
      const ref = expected.get(lower(record.path));
      const content = await reader.readRecord(record);
      if (!ref || content.length !== ref.size || sha256Hex(content) !== ref.sha256)
        throw new Error(`${archive.name}/${record.path}: decoded bytes differ from import receipt`);
      reader.decoded.delete(lower(record.path));
      checkedFiles++; checkedBytes += content.length;
    }
  }
  const { library } = await loadResourceLibrary(project);
  const expectedPaths = [
    ...tracks.map(t => t.canonicalPath),
    ...vehicles.flatMap(v => [`kart_/${v.definition.internalId}/model.1s`, `kart_/${v.definition.internalId}/param.xml`]),
  ];
  for (const p of expectedPaths) {
    if (library.canonicalCandidates(p).length !== 1) throw new Error(`${p}: missing or ambiguous canonical path`);
  }
  // Every newly registered path must be globally unique, including textures.
  for (const c of receipt.containers) for (const f of c.files) {
    const canonical = [c.mountPath, f.path].filter(Boolean).join('/');
    if (library.canonicalCandidates(canonical).length !== 1)
      throw new Error(`${canonical}: imported path is not unique`);
  }
  const summary = { status: 'ok', revision: manifest.revision, containers: receipt.containers.length,
    checkedFiles, checkedBytes, tracks: tracks.length, vehicles: vehicles.length,
    existingManifestEntriesPreserved: baseline.files.length - 1, existingMountsPreserved: baseline.mounts.length,
    libraryErrors: library.errors, libraryWarnings: library.warnings.length,
    unresolvedSourceTextures: receipt.unresolvedTextures.length };
  // --check is strictly read-only: print its report instead of updating a file.
  console.log(JSON.stringify(summary));
  return summary;
}

if (check) { await verify(); process.exit(0); }

const originalManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const originalIndex = decodeIndexJson(fs.readFileSync(indexPath));
validateArchiveIndex(originalIndex, parseResourceManifest(originalManifest, version));
const oldReceipt = fs.existsSync(receiptPath) ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : undefined;
const previousOwned = new Set(oldReceipt?.containers.map(c => lower(c.name)) ?? []);
if (!fs.existsSync(baselinePath)) {
  const details = await readMountManifestDetails(diskSource(path.join(dataDir, 'aaa.pk')));
  writeChanged(baselinePath, json({ revision: originalManifest.revision, files: originalManifest.files,
    mounts: details.mounts, indexHashes: Object.fromEntries([...originalIndex.rho, ...originalIndex.rho5].map(a => [lower(a.name), digestIndex(a)])) }));
}
const { library: originalLibrary, formats } = await loadResourceLibrary(project);
const baselineFiles = originalLibrary.files.filter(f => !previousOwned.has(lower(f.sourceName)));
const webPaths = new Set(baselineFiles.map(f => lower(f.canonicalPath ?? f.virtualPath)));
const sourceRows = fs.readFileSync(path.join(auditDir, 'tw-extraction-manifest.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l));
const sourcePaths = new Map(), sourceDirectories = new Map(), texturesByName = new Map(), allTexturesByName = new Map();
for (const row of sourceRows) {
  const key = lower(row.path), directory = key.slice(0, key.lastIndexOf('/'));
  sourcePaths.set(key, [...(sourcePaths.get(key) ?? []), row]);
  sourceDirectories.set(directory, [...(sourceDirectories.get(directory) ?? []), row]);
  if (/\.(dds|png|jpg|tga|kng)$/i.test(row.path)) {
    const name = lower(path.basename(row.path));
    allTexturesByName.set(name, [...(allTexturesByName.get(name) ?? []), row]);
  }
  if (/^theme_\/.*\/texture\/.*\.(dds|png|jpg|tga|kng)$/i.test(row.path)) {
    const name = lower(path.basename(row.path));
    texturesByName.set(name, [...(texturesByName.get(name) ?? []), row]);
  }
}
const sourceChoices = [], unresolvedTextures = [], dependencyFallbacks = [], changes = [];
const containers = [], prepared = new Map(), parsedTextureCache = new Map();
const stage = path.join(outputDir, 'staged'); fs.mkdirSync(stage, { recursive: true });
function readSource(row) {
  const content = fs.readFileSync(path.join(auditDir, row.extractedPath));
  if (content.length !== row.size || sha256Hex(content) !== row.sha256) throw new Error(`Extracted source changed: ${row.extractedPath}`);
  return content;
}
function parameterDocument(row) {
  let text = exportXml(readSource(row), row.path).trimStart();
  if (!text.startsWith('<?xml')) text = '<?xml version="1.0" encoding="UTF-16"?>\n' + text;
  text = text.replace(/(<\?xml[^>]*encoding\s*=\s*['"])[^'"]+(['"])/i, '$1UTF-16$2');
  return formats.x1(Buffer.concat([Buffer.from([255, 254]), Buffer.from(text, 'utf16le')]));
}
function pick(rows, preferred) {
  if (!rows?.length) return undefined;
  const ordered = [...rows].sort((a, b) => {
    const rank = r => r.sourceName === preferred ? 0 : /^(track|kart_|theme_)\.rho$/i.test(r.sourceName) ? 1 : r.sourceKind === 'rho' ? 2 : 3;
    return rank(a) - rank(b) || a.sourceName.localeCompare(b.sourceName);
  });
  if (new Set(ordered.map(r => r.sha256)).size > 1)
    sourceChoices.push({ path: ordered[0].path, selected: ordered[0].sourceName, candidates: ordered.map(r => ({ source: r.sourceName, sha256: r.sha256 })), policy: 'Prefer the model/parameter source; otherwise the expanded Taiwan Rho, then named Rho, then Rho5.' });
  return ordered[0];
}
function exact(sourcePath, sourceName) {
  const rows = sourcePaths.get(lower(sourcePath)) ?? [];
  const row = sourceName ? rows.find(r => r.sourceName === sourceName) : pick(rows);
  if (!row) throw new Error(`Missing source: ${sourceName ?? '*'}/${sourcePath}`);
  return row;
}
function directoryRows(directory, preferred) {
  const grouped = new Map();
  for (const row of sourceDirectories.get(lower(directory)) ?? []) grouped.set(lower(row.path), [...(grouped.get(lower(row.path)) ?? []), row]);
  return [...grouped.values()].map(rows => pick(rows, preferred));
}
function sourced(row, destination = path.basename(row.path), reason = 'directory dependency') {
  return { path: destination, bytes: readSource(row), sourcePath: row.path, sourceName: row.sourceName, sourceSha256: row.sha256, reason };
}
function addFile(files, entry, replace = false) {
  const key = lower(entry.path);
  if (!files.has(key) || replace) files.set(key, entry);
}
async function stageContainer(name, mountPath, files) {
  if (prepared.has(lower(name))) throw new Error(`Duplicate output container ${name}`);
  if (originalManifest.files.some(f => lower(f.name) === lower(name)) && !previousOwned.has(lower(name)))
    throw new Error(`Refusing to replace existing container ${name}`);
  const ordered = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  const fileReceipt = ordered.map(({ bytes, ...meta }) => ({ ...meta, size: bytes.length, sha256: sha256Hex(bytes) }));
  const previous = oldReceipt?.containers.find(c => lower(c.name) === lower(name));
  const destination = path.join(dataDir, name);
  if (previous && previous.mountPath === mountPath && JSON.stringify(previous.files) === JSON.stringify(fileReceipt) &&
      fs.existsSync(destination) && sha256Hex(fs.readFileSync(destination)) === previous.sha256) {
    const scanned = originalIndex.rho.find(a => lower(a.name) === lower(name));
    if (!scanned) throw new Error(`${name}: imported container is missing its index`);
    containers.push(previous); prepared.set(lower(name), { receipt: previous, scanned, file: destination });
    console.log(JSON.stringify({ unchanged: name, files: ordered.length, bytes: previous.size }));
    return;
  }
  const bytes = await packRhoArchive(name, ordered.map(({ path, bytes }) => ({ path, bytes })));
  if (bytes.length > 512 * 1024 * 1024) throw new Error(`${name} exceeds the Rho scanner limit`);
  const file = path.join(stage, name); writeChanged(file, bytes);
  const scanned = await scanRhoArchiveIndex(diskSource(file));
  const receipt = { name, mountPath, size: bytes.length, sha256: sha256Hex(bytes), files: fileReceipt };
  containers.push(receipt); prepared.set(lower(name), { receipt, scanned, file });
  console.log(JSON.stringify({ staged: name, files: ordered.length, bytes: bytes.length }));
}

const mapGroups = new Map();
for (const t of tracks) mapGroups.set(t.folder, [...(mapGroups.get(t.folder) ?? []), t]);
const extensions = ['dds', 'png', 'jpg', 'tga', 'kng'];
for (const [folder, group] of mapGroups) {
  const representative = group[0], preferred = representative.source.archive;
  const files = new Map();
  const sourceDirectory = `track_/${representative.sourceFolder}`;
  const wantedModels = new Set(group.map(t => lower(t.source.path)));
  for (const row of directoryRows(sourceDirectory, preferred)) {
    const name = path.basename(row.path);
    if (/^track(?:[_ ].*|0)?\.1s$/i.test(name)) continue;
    addFile(files, sourced(row));
  }
  // Keep exactly one configuration, so loadTrackConfig is unambiguous.
  if (files.has('track.bml') && files.has('track.xml')) files.delete('track.xml');
  for (const t of group) {
    const row = exact(t.source.path, t.source.archive);
    if (row.sha256 !== t.source.sha256) throw new Error(`${t.id}: source model hash differs from reviewed inventory`);
    addFile(files, sourced(row, t.modelFile, 'selected missing track model'), true);
  }
  const themes = [...new Set(group.flatMap(t => [t.theme, ...(t.texTheme ?? '').split('|'), 'common']).filter(Boolean))];
  const wanted = new Set();
  for (const file of files.values()) if (/\.1s$/i.test(file.path)) {
    const hash = sha256Hex(file.bytes);
    let stems = parsedTextureCache.get(hash);
    if (!stems) {
      try { stems = textureStems(formats.y9(file.bytes)); parsedTextureCache.set(hash, stems); }
      catch (error) {
        // Non-track animation fragments need not be standalone scene files.
        if (group.some(t => lower(t.modelFile) === lower(file.path))) throw error;
        dependencyFallbacks.push({ folder, sourcePath: file.sourcePath, type: 'non-scene auxiliary model', detail: error.message });
        continue;
      }
    }
    for (const stem of stems) wanted.add(stem);
  }
  for (const stem of [...wanted].sort()) {
    const stems = stem.endsWith('@zz') ? [stem.replace(/@zz$/, '@tw'), stem] : [stem];
    let local;
    for (const s of stems) for (const ext of extensions) {
      const existing = files.get(lower(`${s}.${ext}`));
      if (existing && !local) local = { existing, ext };
    }
    if (local) {
      if (lower(local.existing.path) !== lower(`${stem}.${local.ext}`))
        addFile(files, { ...local.existing, path: `${stem}.${local.ext}`, reason: 'Taiwan regional texture mapped to the scene texture stem' });
      continue;
    }
    let selected, selectedName;
    for (const theme of themes) {
      for (const s of stems) for (const ext of extensions) {
        const rows = sourcePaths.get(lower(`theme_/${theme}/texture/${s}.${ext}`));
        if (rows?.length && !selected) { selected = pick(rows); selectedName = `${stem}.${ext}`; }
      }
      if (selected) break;
    }
    if (!selected) {
      for (const s of stems) for (const ext of extensions) {
        const candidates = texturesByName.get(lower(`${s}.${ext}`)) ?? [];
        if (candidates.length && new Set(candidates.map(r => r.sha256)).size === 1) {
          selected = pick(candidates); selectedName = `${stem}.${ext}`;
          dependencyFallbacks.push({ folder, texture: stem, sourcePath: selected.path, type: 'unique Taiwan texture outside declared themes' });
          break;
        }
      }
    }
    if (!selected) {
      for (const s of stems) for (const ext of extensions) {
        const candidates = allTexturesByName.get(lower(`${s}.${ext}`)) ?? [];
        if (candidates.length && new Set(candidates.map(r => r.sha256)).size === 1) {
          selected = pick(candidates); selectedName = `${stem}.${ext}`;
          dependencyFallbacks.push({ folder, texture: stem, sourcePath: selected.path, type: 'unique Taiwan texture in another resource directory' });
          break;
        }
      }
    }
    if (selected) { addFile(files, sourced(selected, selectedName, 'referenced Taiwan theme texture')); continue; }
    let web;
    for (const theme of themes) for (const s of stems) for (const ext of extensions) {
      const matches = baselineFiles.filter(f => lower(f.canonicalPath ?? f.virtualPath) === lower(`theme_/${theme}/texture/${s}.${ext}`));
      if (matches.length === 1 && !web) web = matches[0];
    }
    if (web) {
      const bytes = await web.bytes();
      addFile(files, { path: `${stem}.${web.extension}`, bytes, sourcePath: web.canonicalPath, sourceName: web.sourceName, sourceSha256: sha256Hex(bytes), reason: 'existing web theme texture absent in Taiwan source' });
      dependencyFallbacks.push({ folder, texture: stem, sourcePath: web.canonicalPath, type: 'existing web theme texture' });
    } else unresolvedTextures.push({ folder, texture: stem, themes, status: 'No corresponding texture exists in the selected Taiwan source or existing web themes.' });
  }
  // Alias directory gets its own source thumbnail when one exists.
  const thumbnail = pick(sourcePaths.get(lower(`trackThumb/${representative.sourceFolder}/xt_trackThumb.png`)), preferred);
  if (thumbnail && !files.has('xt_trackthumb.png')) addFile(files, sourced(thumbnail, 'xt_trackThumb.png', 'track selection thumbnail'));
  await stageContainer(`track_${folder}.rho`, `track_/${folder}`, files);
}

// Every Taiwan catalog row is a complete, isolated vehicle folder. Model
// inheritance is flattened here, avoiding any cross-region item ID meaning.
const kartFiles = new Map();
for (const vehicle of vehicles) {
  const own = `kart_/${vehicle.sourceInternalId}`, preferred = vehicle.sourceParameter.source;
  const parameterRow = exact(vehicle.sourceParameter.path, preferred);
  const parameter = parameterDocument(parameterRow).root;
  if (parameter.name !== 'BodyParam') throw new Error(`${own}: invalid BodyParam`);
  const merged = new Map();
  const providers = [], seen = new Set();
  let provider = vehicle.body.addModelFolder;
  while (provider) {
    if (!/^[A-Za-z0-9_]+$/.test(provider) || seen.has(lower(provider))) throw new Error(`${own}: invalid/cyclic inherited model ${provider}`);
    seen.add(lower(provider)); providers.unshift(`kart_/${provider}`);
    const next = pick(sourcePaths.get(lower(`kart_/${provider}/param@tw.xml`)), preferred) ?? pick(sourcePaths.get(lower(`kart_/${provider}/param.xml`)), preferred);
    if (!next) break;
    const root = parameterDocument(next).root;
    provider = root.attributes.find(a => a.name === 'addModelFolder')?.value;
  }
  for (const directory of [...providers, own]) for (const row of directoryRows(directory, preferred)) {
    const name = path.basename(row.path);
    if (/^param(?:@[^.]*)?\.(?:xml|bml|eml|kml)$/i.test(name)) continue;
    addFile(merged, sourced(row, name, directory === own ? 'Taiwan vehicle directory' : 'flattened model provider'), true);
  }
  for (let n = 0; n < 7; n++) {
    const name = `f0${n}.1s`;
    if (!merged.has(name)) {
      const row = pick(sourcePaths.get(`kart_/common/${name}`));
      if (row) addFile(merged, sourced(row, name, 'Taiwan common kart animation'));
    }
  }
  if (!merged.has('model.1s')) throw new Error(`${own}: flattened model.1s missing`);
  if (!merged.has(lower(`${vehicle.definition.textureKey ?? '1'}.png`))) throw new Error(`${own}: selected paint ${vehicle.definition.textureKey} missing`);
  parameter.attributes = parameter.attributes.filter(a => a.name !== 'addModelFolder');
  const tachometer = parameter.attributes.find(a => a.name === 'TachometerName');
  // NineTacho has a closed set of folder names in the renderer; its existing
  // web "nine" gauge is complete. An absent name retains legacy MqTacho.
  if (tachometer?.value && vehicle.body.TachometerType !== 'NineTacho') tachometer.value = `tw_${tachometer.value}`;
  const xml = serializeBinaryXml(parameter).replace('encoding="UTF-8"', 'encoding="UTF-16"');
  const paramBytes = Buffer.concat([Buffer.from([255, 254]), Buffer.from(xml, 'utf16le')]);
  addFile(merged, { path: 'param.xml', bytes: paramBytes, sourcePath: parameterRow.path, sourceName: parameterRow.sourceName,
    sourceSha256: parameterRow.sha256, reason: 'effective Taiwan BodyParam; model inheritance flattened; original child nodes retained' }, true);
  for (const file of merged.values()) addFile(kartFiles, { ...file, path: `${vehicle.definition.internalId}/${file.path}` });
}
await stageContainer('kart_taiwan_import.rho', 'kart_', kartFiles);

// BML tachometers resolve all textures and animated subscenes relative to their
// directory. Isolate the Taiwan layout, including its regional texture sheets,
// rather than changing the CN default gauge used by existing vehicles.
const tachometerFiles = new Map();
const tachometerNames = [...new Set(vehicles.filter(v => v.body.TachometerType !== 'NineTacho')
  .map(v => v.body.TachometerName).filter(Boolean))].sort();
for (const name of tachometerNames) {
  const prefix = `gui_/tachometer/${name}`;
  const rows = directoryRows(prefix);
  if (!rows.some(r => /\/tacho\.bml$/i.test(r.path))) throw new Error(`${prefix}: source tachometer layout missing`);
  for (const row of rows) addFile(tachometerFiles, sourced(row, `tw_${name}/${path.basename(row.path)}`, 'complete Taiwan tachometer dependency'));
}
await stageContainer('gui_taiwan_tachometer.rho', 'gui_/tachometer', tachometerFiles);

// Music and vehicle/effect sounds are path-based, so add only absent originals.
const soundFiles = new Map();
const bgmThemes = new Set(sourceRows.filter(r => /^sound_\/bgm\//i.test(r.path)).map(r => r.path.split('/')[2]));
const missingBgmThemes = new Set([...bgmThemes].filter(theme => !originalLibrary.archives.some(a =>
  lower(a.mountPath) === lower(`sound_/bgm/${theme}`) && !previousOwned.has(lower(a.name)))));
for (const [key, candidates] of sourcePaths) {
  if (!key.startsWith('sound_/') || webPaths.has(key)) continue;
  if (key.startsWith('sound_/bgm/')) continue;
  const row = pick(candidates);
  addFile(soundFiles, sourced(row, row.path.slice('sound_/'.length), 'missing Taiwan sound/BGM dependency'));
}
if (soundFiles.size) await stageContainer('sound_taiwan_import.rho', 'sound_', soundFiles);
for (const theme of [...missingBgmThemes].sort()) {
  const prefix = `sound_/bgm/${theme}`, files = new Map();
  for (const row of directoryRows(prefix)) {
    if (webPaths.has(lower(row.path))) throw new Error(`${row.path}: BGM exists without its required unique theme mount`);
    addFile(files, sourced(row, path.basename(row.path), 'complete missing BGM theme'));
  }
  if (files.size) await stageContainer(`sound_bgm_taiwan_${theme}.rho`, prefix, files);
}

// Dark Tyranno's mandatory linked character uses the unchanged CN identity 184.
if (vehicles.some(v => v.definition.alwaysLinkCharacter && v.definition.linkCharacterId === 184)) {
  const prefix = 'character_/tyrannoBlack';
  if (!baselineFiles.some(f => lower(f.canonicalPath ?? f.virtualPath).startsWith(lower(prefix + '/')))) {
    const files = new Map();
    for (const row of directoryRows(prefix, 'character_tyrannoBlack.rho')) addFile(files, sourced(row));
    if (!files.size) throw new Error('Missing required linked character tyrannoBlack');
    await stageContainer('character_tyrannoBlack.rho', prefix, files);
  }
}

const manifest = structuredClone(originalManifest), index = originalIndex;
const owned = new Set(containers.map(c => lower(c.name)));
for (const old of previousOwned) if (!owned.has(old)) throw new Error(`Import would silently remove previously owned container ${old}`);
const mountTree = installMounts(decodeMountTree(fs.readFileSync(path.join(dataDir, 'aaa.pk'))), containers);
const mountBytes = encodeMountTree(mountTree);
const mountSha = sha256Hex(mountBytes);
function setManifest(name, size, sha256) {
  const position = manifest.files.findIndex(f => lower(f.name) === lower(name)), previous = manifest.files[position];
  const entry = { name, size, mtimeMs: previous?.sha256 === sha256 ? previous.mtimeMs : Date.now(), sha256 };
  if (position < 0) manifest.files.push(entry); else manifest.files[position] = entry;
}
for (const c of containers) {
  setManifest(c.name, c.size, c.sha256);
  const position = index.rho.findIndex(a => lower(a.name) === lower(c.name));
  if (position < 0) index.rho.push(prepared.get(lower(c.name)).scanned);
  else index.rho[position] = prepared.get(lower(c.name)).scanned;
}
setManifest('aaa.pk', mountBytes.length, mountSha);
// This content-derived revision invalidates OPFS's version-revision directory.
// mtime is deliberately excluded, making a repeated import byte-stable.
manifest.revision = sha256Hex(JSON.stringify(manifest.files.map(({ name, size, sha256 }) => ({ name, size, sha256 })).sort((a, b) => a.name.localeCompare(b.name))));
index.revision = manifest.revision;
validateArchiveIndex(index, parseResourceManifest(manifest, version));
for (const c of containers) {
  if (writeChanged(path.join(dataDir, c.name), fs.readFileSync(prepared.get(lower(c.name)).file))) changes.push(c.name);
}
if (writeChanged(path.join(dataDir, 'aaa.pk'), mountBytes)) changes.push('aaa.pk');
if (writeChanged(indexPath, encodeIndexJson(index))) changes.push('archive-index');
if (writeChanged(manifestPath, json(manifest))) changes.push('resources');
const receipt = { version, revision: manifest.revision, source: 'KartRider_TW/Data extracted and SHA-256 verified inventory',
  tracks: tracks.map(({ id, canonicalPath, source }) => ({ id, canonicalPath, source })),
  vehicles: vehicles.map(v => ({ itemId: v.definition.itemId, internalId: v.definition.internalId, sourceInternalId: v.sourceInternalId })),
  containers, sourceChoices, dependencyFallbacks, unresolvedTextures };
writeChanged(receiptPath, json(receipt));
writeChanged(path.join(toolsDir, 'map-paths.json'), json(tracks.map(t => ({ id: t.id, sourceFolder: t.sourceFolder, folder: t.folder,
  sourcePath: t.source.path, sourceName: t.source.archive, sourceSha256: t.source.sha256, modelFile: t.modelFile, canonicalPath: t.canonicalPath }))));
const summary = await verify();
writeChanged(path.join(outputDir, 'report.json'), json({ ...summary, changedFiles: changes, unresolvedTextures, dependencyFallbacks, sourceChoices }));
console.log(JSON.stringify({ complete: true, changedFiles: changes.length, report: path.join(outputDir, 'report.json') }));
