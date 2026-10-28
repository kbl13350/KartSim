#!/usr/bin/env node
// p3553 original Formula tables and exact PIT surface triangles.
// Run from client: node --import ./src/physics/node-raw-test-hook.mjs --import tsx tools/export-formula-data.mjs [--check]
// Required LFS: DataPack1_*.rho5, track_wkc_R01/R03/R04.rho and __p3553/archive-index.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import { RhoReader } from '../src/codecs/rho.ts';
import { decodeBinaryXml } from '../src/codecs/binary-xml.ts';
import { Rho5Reader } from '../src/codecs/rho5.ts';
import { parseResourceXml } from '../src/resources/xml-utf16-parser.ts';
import { extractTrackRoads } from '../src/resources/track-road-extraction.ts';
import { roadSurface, staticRoadIssue } from '../src/resources/track-road-descriptor.ts';
import { y9 } from '../src/generated/formats.js';

const client = fileURLToPath(new URL('../', import.meta.url));
const mirror = path.resolve(client, '../mirror');
const index = JSON.parse(inflateSync(readFileSync(path.join(mirror, '__p3553/archive-index'))));
const sources = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const source = name => {
  const bytes = readFileSync(path.join(mirror, 'p3553', name));
  return { name, size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    slice: (start = 0, end = bytes.length) => ({ arrayBuffer: async () => Uint8Array.from(bytes.subarray(start, end)).buffer }) };
};
const pack = index.rho5.find(item => item.name === 'DataPack1');
const reader = new Rho5Reader(pack, pack.parts.map(part => source(part.name)));
const readXml = async name => {
  const resource = `etc_/F1Game/${name}`;
  const bytes = await reader.read(resource);
  sources.push({ path: `DataPack1/${resource}`, sha256: hash(bytes) });
  return parseResourceXml(bytes).root;
};
const a = node => Object.fromEntries(node.attributes.map(value => [value.name, value.value]));
const numeric = node => Object.fromEntries(Object.entries(a(node)).map(([key, value]) => [key, key === 'name' ? value : Number(value)]));
const range = value => value.split('-').map(Number);
const cn = root => Object.fromEntries(root.children.filter(n => n.name === 'k').flatMap(n => {
  const translation = n.children.find(n => a(n).c === 'cn');
  return translation ? [[a(n).n, a(translation).v]] : [];
}));
const game = await readXml('F1Game@cn.xml');
const strings = cn(await readXml('F1Game_StringBag.xml'));
const groups = game.children.filter(n => n.name === 'F1RiderGroup').map(node => {
  const attrs = a(node), boost = node.children.find(n => n.name === 'BoostInterval');
  return { id: Number(attrs.id), opened: attrs.opened === 'true',
    riders: node.children.filter(n => n.name === 'F1Rider').map(numeric),
    boost: { chase: Number(a(boost).chase), yield: Number(a(boost).yield),
      intervals: boost.children.map(row => ({ grade: Number(a(row).grade), ...Object.fromEntries(['veasy','easy','normal','hard'].map(d => [d, range(a(row)[d])])) })) },
    levels: node.children.find(n => n.name === 'F1LevelWeight').children.map(numeric) };
});
const rankWeights = game.children.filter(n => n.name === 'F1RankWeight').map(node => ({
  rankGrade: range(a(node).rankGrade), riders: node.children.map(numeric),
}));
const reward = await readXml('F1GameReward@cn.xml');
const rewardTables = reward.children.filter(n => n.name === 'F1Reward').map(node => ({
  grade: a(node).grade, rewards: node.children.map(numeric),
}));
const missions = reward.children.filter(n => n.name === 'F1Mission').map(node => ({
  type: Number(a(node).type), conditions: node.children.map(n => ({ difficulty: n.name.toLowerCase(), condition: Number(a(n).condition), reward: a(n).reward })),
}));
const chat = await readXml('aiF1modeChatScript@cn.xml');
const script = node => ({ type: Number(a(node).type), message: a(node).msg, attributes: a(node) });
const chats = chat.children.filter(node => node.name === 'F1RiderGroup').map(node => ({
  groupId: Number(a(node).id), scripts: node.children.map(script),
}));
const cutscenes = chat.children.filter(node => node.name === 'scripts').map(script);
const itemArchive = new RhoReader(source('item.rho'), index.rho.find(item => item.name === 'item.rho'));
const boosterBytes = await itemArchive.read('crushBooster/item.bml');
sources.push({ path: 'item.rho/crushBooster/item.bml', sha256: hash(boosterBytes) });
const booster = decodeBinaryXml(boosterBytes);
const boostStates = booster.children.map(a);
const boosterDurations = {
  boostDurationMs: Number(boostStates.find(state => state.name === 'Use').life),
  stunDurationMs: Number(boostStates.find(state => state.name === 'Affect').life),
};
const pitSurfaces = [];
for (const trackId of ['wkc_R01', 'wkc_R03', 'wkc_R04']) {
  const name = `track_${trackId}.rho`;
  const archive = new RhoReader(source(name), index.rho.find(item => item.name === name));
  const bytes = await archive.read('track.1s');
  sources.push({ path: `${name}/track.1s`, sha256: hash(bytes) });
  const parsed = y9(bytes);
  const roads = extractTrackRoads(parsed.root.scene, staticRoadIssue);
  const triangles = roads.triangles.filter(t => roadSurface(t.roadDescriptor) === 'pit')
    .map(t => ({ mesh: t.origin.mesh.node.name, a: t.a, b: t.b, c: t.c }));
  if (!triangles.length) throw new Error(`${trackId}: no original PIT surfaces`);
  pitSurfaces.push({ trackId, triangles });
}
const document = {
  provenance: { version: 'p3553', sources,
    notes: [
      'All numeric NPC rows, boost intervals, rewards, missions and Chinese scripts are copied from the named original resources.',
      'F1Game@cn.xml rider names override the older F1Game_StringBag.xml roster; the two original files disagree.',
      'BoostInterval is annotated x 1000 in the original XML: exported interval endpoints are seconds.',
      'rankGrade is zero-based (0-19); public playerRank is one-based (1-20). The way speed/accel map into reconstructed NPC physics is not proven by the data.',
      'PIT triangles are original surface=pit collision triangles from track.1s, transformed by the same extractTrackRoads used by the client (x,z,-y).',
      'Aggressive accelerator Use life=2400 ms and Affect life=2000 ms come from item.rho/crushBooster/item.bml.',
      'Round scoring, tie breaks, player charge rates and NPC physics are not stored in these resources and require reconstructed runtime rules.',
    ],
  }, groups, rankWeights, rewardTables, missions, strings, chats, cutscenes, boosterDurations, pitSurfaces,
};
const output = `${JSON.stringify(document, null, 2)}\n`;
const target = path.join(client, 'src/formula/formula-original-data.json');
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== output) throw new Error('Formula original snapshot is stale');
  console.log('Formula tables and PIT surfaces match original p3553 resources.');
} else {
  mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, output);
  console.log(`Exported ${groups.length * 19} NPCs, ${rankWeights.length} rank grades and ${pitSurfaces.reduce((n,p) => n+p.triangles.length,0)} original PIT triangles.`);
}
