#!/usr/bin/env node

// Make verbatim reference slices of the formatted KartSim v39.11 main bundle.
// Boundaries were checked against the bundle's top-level AST declarations.
// The fixed hash and offsets make this dependency-free splitter safe for this
// exact release; recheck the AST before updating it for a different build.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourcePath = path.resolve(here, '../formatted/index.js');
const destination = path.resolve(here, '../modules');
const source = await readFile(sourcePath, 'utf8');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const expectedHash = '688ec0b3caad96d5e29ea2dcdb827d3f45ff6467c5654b6165a779b0de1832f6';
if (hash(source) !== expectedHash) {
  throw new Error('The formatted bundle changed. Revalidate top-level AST boundaries before splitting.');
}

// These offsets are UTF-16 code-unit positions in the decoded formatted file.
// Every named boundary is the start of a top-level declaration, as verified
// with Acorn during analysis. The omitted h10→f10 span is one large data
// declaration plus five top-level Map mutations; it is extracted separately.
const boundaries = [
  { symbol: 'start', offset: 0, marker: '(function () {' },
  { symbol: 's2', offset: 678960, marker: 'function s2(n) {' },
  { symbol: 'Sw', offset: 1078192, marker: 'class Sw {' },
  { symbol: 'h10', offset: 1452503, marker: 'const h10 = `' },
  { symbol: 'f10', offset: 4369296, marker: 'function f10(n, e) {' },
  { symbol: 'AL', offset: 4808523, marker: 'class AL {' },
  { symbol: '_L', offset: 4935967, marker: 'class _L {' },
  { symbol: 'Ma0', offset: 5290029, marker: 'class Ma0 {' },
  { symbol: 'll0', offset: 5550877, marker: 'class ll0 {' },
  { symbol: 'GF', offset: 5775467, marker: 'class GF {' },
  { symbol: 'Bf0', offset: 6099176, marker: 'class Bf0 {' },
  { symbol: 'end', offset: 6142501, marker: '' },
];
for (const boundary of boundaries) {
  if (!source.startsWith(boundary.marker, boundary.offset) ||
      (boundary.offset !== 0 && boundary.offset !== source.length && source[boundary.offset - 1] !== '\n')) {
    throw new Error(`Boundary ${boundary.symbol} failed validation at ${boundary.offset}.`);
  }
}
if (source.length !== boundaries.at(-1).offset) {
  throw new Error(`Unexpected formatted bundle length ${source.length}.`);
}

const files = [
  ['00-vendor-three.js', 0, 1, 'module preload helper and bundled Three.js r178'],
  ['01-formats-and-scene.js', 1, 2, 'resource decoders, track formats, scene helpers'],
  ['02-asset-library-and-hud.js', 2, 3, 'asset library, metadata, UI and HUD'],
  ['03-vehicle-parameters-and-effects.js', 4, 5, 'vehicle parameters, visual and audio effects'],
  ['04-driving-simulation.js', 5, 6, 'driving simulation and nearby helpers'],
  ['05-race-world.js', 6, 7, 'track world, race coordinators, diagnostics'],
  ['06-ui-selection.js', 7, 8, 'menu rendering, vehicle and track selection'],
  ['07-multiplayer.js', 8, 9, 'transport, lobby, room UI, coordination'],
  ['08-time-attack-and-replay.js', 9, 10, 'time attack, controls, replay and race controller'],
  ['09-app-bootstrap.js', 10, 11, 'app root, startup side effects, garage exports'],
];
await mkdir(destination, { recursive: true });
const entries = [];
for (const [filename, startIndex, endIndex, description] of files) {
  const start = boundaries[startIndex].offset;
  const end = boundaries[endIndex].offset;
  const content = source.slice(start, end);
  await writeFile(path.join(destination, filename), content, 'utf8');
  entries.push({ file: filename, range: [start, end], startsAt: boundaries[startIndex].symbol,
    endsBefore: boundaries[endIndex].symbol, description, sha256: hash(content) });
}
const omittedStart = boundaries[3].offset;
const omittedEnd = boundaries[4].offset;
const omitted = source.slice(omittedStart, omittedEnd);
if (!omitted.startsWith('const h10 = `') || !omitted.includes('hn.set(')) {
  throw new Error('The omitted vehicle data region did not match the inspected source.');
}
const sumOfLengths = entries.reduce((sum, entry) => sum + entry.range[1] - entry.range[0], 0);
if (sumOfLengths + omitted.length !== source.length) {
  throw new Error('Slice ranges do not cover the formatted source exactly.');
}
const manifest = {
  source: '../formatted/index.js',
  sourceSha256: expectedHash,
  sourceLength: source.length,
  sourceOffsets: 'UTF-16 code-unit offsets in the decoded JavaScript string; end exclusive',
  referenceOnly: true,
  slices: entries,
  omitted: {
    range: [omittedStart, omittedEnd],
    description: 'Embedded vehicle CSV literals and 436-key override Map; see ../embedded-data/',
    sha256: hash(omitted),
  },
};
await writeFile(path.join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Wrote ${entries.length} verbatim reference slices; omitted ${omitted.length} data code units.`);
