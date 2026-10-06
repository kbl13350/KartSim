#!/usr/bin/env node

// Extract the literal vehicle tables and override expressions from the
// exact KartSim v39.11 bundle archived in ../../mirror/assets/.
// This script has no package dependencies and intentionally changes no values.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, '../../mirror/assets/index-DoW2rQpI.js');
const source = await readFile(sourcePath, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const expectedSourceHash = 'd753ab83d0007826b7275a7b4e4288d7b0f2a60662e967eac374ec3a1e0fb354';

if (hash(source) !== expectedSourceHash) {
  throw new Error('The bundle hash changed. Reinspect its syntax before extracting data.');
}

function uniqueIndex(marker) {
  const position = source.indexOf(marker);
  if (position < 0 || source.indexOf(marker, position + marker.length) >= 0) {
    throw new Error(`Expected exactly one ${JSON.stringify(marker)} marker.`);
  }
  return position;
}

const firstMarker = 'const h10=`';
const secondMarker = '`,d10=`';
const thirdMarker = '`,hn=new Map(';
const fourthMarker = 'function f10(';
const hStart = uniqueIndex(firstMarker) + firstMarker.length;
const hEnd = uniqueIndex(secondMarker);
const dStart = hEnd + secondMarker.length;
const dEnd = uniqueIndex(thirdMarker);
const mapStart = dEnd + 2; // The `hn=` after the closing backtick and comma.
const mapEnd = uniqueIndex(fourthMarker);

if (!(hStart < hEnd && hEnd < dStart && dStart < dEnd && dEnd < mapStart && mapStart < mapEnd)) {
  throw new Error('The source ranges are out of order.');
}

const tables = [
  { symbol: 'h10', filename: 'vehicle-physics-h10.csv', content: source.slice(hStart, hEnd), range: [hStart, hEnd] },
  { symbol: 'd10', filename: 'vehicle-physics-d10.csv', content: source.slice(dStart, dEnd), range: [dStart, dEnd] },
];

function inspectCsv(content) {
  if (content.includes('`') || content.includes('${') || !content.endsWith('\n')) {
    throw new Error('The CSV is no longer a plain, newline-terminated template literal.');
  }
  const lines = content.slice(0, -1).split('\n');
  const header = lines.shift().split(',');
  const sources = {};
  for (const [index, line] of lines.entries()) {
    const columns = line.split(',');
    if (columns.length !== header.length) {
      throw new Error(`CSV row ${index + 2} has ${columns.length} columns, expected ${header.length}.`);
    }
    const label = columns[2];
    sources[label] = (sources[label] ?? 0) + 1;
  }
  return { columns: header.length, dataRows: lines.length, sources };
}

const expectedCounts = { h10: 2374, d10: 3276 };
for (const table of tables) {
  table.stats = inspectCsv(table.content);
  if (table.stats.columns !== 91 || table.stats.dataRows !== expectedCounts[table.symbol]) {
    throw new Error(`Unexpected row or column count for ${table.symbol}.`);
  }
  await writeFile(path.join(here, table.filename), table.content, 'utf8');
}

const mapBody = source.slice(mapStart, mapEnd);
if (!mapBody.startsWith('hn=new Map(') || !mapBody.includes('),jI=') || !mapBody.includes(',XI=') ||
    (mapBody.match(/hn\.set\(/g) ?? []).length !== 5) {
  throw new Error('The override expression no longer matches the inspected bundle.');
}
const mapFilename = 'vehicle-physics-overrides.mjs';
const mapSource = [
  '// The initializer, supporting literals, and five final assignments below are copied',
  '// verbatim from the archived bundle. Only the const prefix and export are added.',
  `const ${mapBody}`,
  'export { hn as vehiclePhysicsOverrides };',
  '',
].join('\n');
const mapPath = path.join(here, mapFilename);
await writeFile(mapPath, mapSource, 'utf8');

const { vehiclePhysicsOverrides } = await import(`${pathToFileURL(mapPath).href}?source=${expectedSourceHash}`);
if (!(vehiclePhysicsOverrides instanceof Map)) {
  throw new Error('The extracted override module did not export a Map.');
}
const metadata = {
  source: '../../mirror/assets/index-DoW2rQpI.js',
  sourceSha256: expectedSourceHash,
  sourceOffsets: 'UTF-16 code-unit offsets in the decoded JavaScript string; end exclusive',
  tables: Object.fromEntries(tables.map((table) => [table.symbol, {
    file: table.filename,
    sha256: hash(table.content),
    range: table.range,
    ...table.stats,
  }])),
  overrides: {
    file: mapFilename,
    sha256: hash(mapSource),
    range: [mapStart, mapEnd],
    finalKeys: vehiclePhysicsOverrides.size,
  },
};
await writeFile(path.join(here, 'manifest.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
console.log(`Extracted ${tables.map((table) => `${table.symbol}: ${table.stats.dataRows} rows`).join(', ')}; ${vehiclePhysicsOverrides.size} override keys.`);
