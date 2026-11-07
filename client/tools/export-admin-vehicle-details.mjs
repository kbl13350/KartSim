#!/usr/bin/env node
// node --import ./src/physics/node-raw-test-hook.mjs --import tsx tools/export-admin-vehicle-details.mjs [--check]
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadResourceLibrary, utf16Bytes, normalizeAttributeWhitespace } from './economy-export/resource-library.mjs';
import { bundledVehicleSpecCatalog } from '../src/physics/bundled.ts';
import { PART_LOCK_FIELDS } from '../src/physics/fields.ts';
import { VEHICLE_METADATA_FIELDS, VEHICLE_PHYSICS_FIELDS } from '../src/physics/vehicle-detail-schema.ts';
import { kartCatalogIdentity } from '../src/resources/system-kart-identity.ts';
import { kartItemBoosterAccelFactor } from '../src/physics/item-race-tuning.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = new URL('../../server-go/internal/data/economy/vehicle-details.json', import.meta.url);
const { library, xml } = await loadResourceLibrary(root);
const { karts } = await library.timeAttackGarageCatalog();
const catalog = bundledVehicleSpecCatalog();
const vehicles = [];
for (const kart of karts) {
  let body = { name: 'BodyParam', attributes: [], children: [], text: '' };
  let parameterPath = '';
  if (!['legacyPractice', 'legacyPracticeBlackline'].includes(kart.systemKey)) {
    const model = library.get(kart.path);
    const modelPath = model?.canonicalPath ?? kart.path;
    const directory = modelPath.slice(0, modelPath.lastIndexOf('/'));
    const candidates = ['param@cn.kml', 'param@cn.xml', 'param.kml', 'param.xml']
      .flatMap(name => library.exactCanonicalCandidates(`${directory}/${name}`));
    const entry = candidates[0];
    if (entry) {
      parameterPath = entry.canonicalPath ?? entry.virtualPath;
      const bytes = new Uint8Array(await entry.bytes());
      const text = new TextDecoder(bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : 'utf-8', { fatal: true })
        .decode(bytes).replace(/^\uFEFF/, '').trimStart().replace(/^<\?xml[^>]*\?>/, '');
      body = xml.parseResourceXml(utf16Bytes(`<?xml version="1.0" encoding="UTF-16"?>${normalizeAttributeWhitespace(text)}`)).root;
      if (body.name !== 'BodyParam') throw new Error(`Unexpected parameter: ${parameterPath}`);
    } else if (kart.itemId === 0) throw new Error(`Missing system BodyParam: ${directory}`);
  }
  const parameter = { body };
  const profiles = {}, sources = {};
  for (const speed of [7, 4]) {
    let values, source;
    try {
      const result = catalog.createVehicleParameters(kart, speed, parameter);
      source = result.source;
      values = { ...result.spec };
      PART_LOCK_FIELDS.forEach((key, index) => { values[key] = result.spec.partsLocks[index]; });
      delete values.partsLocks;
    } catch (error) {
      const key = `${kart.itemId}:${speed}`;
      const row = catalog.captured.get(key) ?? catalog.supplemental.get(key);
      if (!row) throw error;
      // Older captured rows really have empty columns. Keep them absent rather
      // than inventing performance numbers; the editor can fill the gaps.
      values = { ...row.values };
      if (values.chargerSystemBoosterUseCount !== undefined) values.vehicleFunctionChargerBranchValue = values.chargerSystemBoosterUseCount;
      if (values.wallCollGaugeMaxVelLoss !== undefined) values.vehicleFunctionWallCollisionGaugeValue = values.wallCollGaugeMaxVelLoss;
      source = `${row.source}（原始参数表存在空值）`;
    }
    // The item race assembly reads this value from the kart's own XML.
    values.boostAccelFactorOnlyItem = kartItemBoosterAccelFactor(parameter) ?? values.boostAccelFactorOnlyItem;
    if (Object.values(values).some(value => !Number.isFinite(value)))
      throw new Error(`Non-finite physics for ${kartCatalogIdentity(kart)}:${speed}`);
    profiles[speed] = speed === 7 ? values : Object.fromEntries(Object.entries(values)
      .filter(([key, value]) => value !== profiles[7][key]));
    sources[speed] = source;
  }
  vehicles.push({ id: kartCatalogIdentity(kart), identity: kart, parameterPath,
    body: Object.fromEntries(body.attributes.map(a => [a.name, a.value])), profiles, sources });
}
vehicles.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const content = { metadataFields: VEHICLE_METADATA_FIELDS, physicsFields: VEHICLE_PHYSICS_FIELDS, vehicles };
const version = createHash('sha256').update(JSON.stringify(content)).digest('hex');
const text = JSON.stringify({ version, ...content }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== text) throw Error('vehicle-details.json is stale');
} else fs.writeFileSync(target, text);
console.log(JSON.stringify({ vehicles: vehicles.length, fields: VEHICLE_PHYSICS_FIELDS.length, version, bytes: text.length }));
