import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { bundledVehicleSpecCatalog } from './bundled';
import { applyManagedVehicleSpec, managedVehicleMetadata } from './managed-vehicle';
import { parseVehicleDisplaySettings, refreshVehicleDisplaySettings, type ManagedVehicleOverrides } from '../resources/vehicle-display-settings';
import { itemRaceVehicleSpec } from './item-race-tuning';
import { PART_LOCK_FIELDS } from './fields';

const payload = (overrides: Record<string, ManagedVehicleOverrides> = {}) => ({
  disabledVehicleIds: [], version: 'test', updatedAt: 1, vehicleOverrides: overrides,
});

test('managed parameters preserve the original and isolate speed/identity with aliases and locks', () => {
  const original = bundledVehicleSpecCatalog().lookup(387, 7);
  const settings = parseVehicleDisplaySettings(payload({ 'catalog:3:387': { metadata: {}, profiles: {
    '7': { forwardAccel: 2500.25, partsEngineLock: 1, chargerSystemBoosterUseCount: 5, boostAccelFactorOnlyItem: 2.5 },
    '4': { forwardAccel: 2700 },
  } } }));
  const modified = applyManagedVehicleSpec(original, { itemId: 387 }, 7, '国服', settings);
  assert.equal(modified.spec.forwardAccel, 2500.25);
  assert.equal(modified.spec.partsLocks[0], 1);
  assert.equal(modified.spec.vehicleFunctionChargerBranchValue, 5);
  assert.notEqual(original.spec.forwardAccel, 2500.25);
  assert.notEqual(original.spec.partsLocks, modified.spec.partsLocks);
  assert.equal(applyManagedVehicleSpec(original, { itemId: 388 }, 7, '国服', settings), original);
  assert.equal(applyManagedVehicleSpec(original, { itemId: 387 }, 4, '国服', settings).spec.forwardAccel, 2700);
  assert.equal(applyManagedVehicleSpec(original, { itemId: 387 }, 4, '韩服复古', settings).spec.forwardAccel, 2500.25);
  const item = itemRaceVehicleSpec({ ...modified.spec }, { kind: 'item' }, { BoosterAccelFactorItem: '1.6' }, undefined);
  assert.equal(item.boostAccelFactorOnlyItem, 2.5, 'item mode cannot overwrite the admin factor');
  assert.equal(JSON.stringify(modified.spec).includes('managedVehiclePhysics'), false);
});

test('settings reject malformed numeric overrides instead of replacing a valid snapshot', () => {
  for (const change of [{ mass: null }, { mass: Infinity }, { speedSlotCapacity: 2.5 }, { partsWheelLock: 256 }, { unknown: 1 }]) {
    assert.throws(() => parseVehicleDisplaySettings(payload({ 'catalog:3:387': { metadata: {}, profiles: { '7': change as never } } })), /Invalid/);
  }
  assert.deepEqual(parseVehicleDisplaySettings({ disabledVehicleIds: [], version: 'old', updatedAt: 0 }).vehicleOverrides, {});
});

test('cached catalog metadata, physics lookups, old missing fields and reset use the current backend snapshot', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldFetch = globalThis.fetch;
  let current = payload();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://vehicle-details.test' } } });
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => current }) as Response;
  try {
    const cached = managedVehicleMetadata({ itemId: 387, title: '原车名', engineGrade: 4 });
    await refreshVehicleDisplaySettings(true);
    assert.deepEqual({ ...cached }, { itemId: 387, title: '原车名', engineGrade: 4 }, 'absent optional metadata keeps its original enumerable shape');
    const original = bundledVehicleSpecCatalog().lookup(387, 7).spec.forwardAccel;
    current = payload({ 'catalog:3:387': { metadata: { title: '新车名', engineGrade: 8 }, profiles: { '7': { forwardAccel: 2468 } } } });
    await refreshVehicleDisplaySettings(true);
    assert.equal(cached.title, '新车名');
    assert.equal(structuredClone(cached).engineGrade, 8);
    assert.equal(bundledVehicleSpecCatalog().lookup(387, 7).spec.forwardAccel, 2468);
    assert.throws(() => bundledVehicleSpecCatalog().lookup(323, 7), /missing/);
    const row = bundledVehicleSpecCatalog().supplemental.get('323:7')!;
    const reference = bundledVehicleSpecCatalog().lookup(387, 7).spec as unknown as Record<string, number>;
    const schema = JSON.parse(readFileSync(new URL('../../../server-go/internal/data/economy/vehicle-details.json', import.meta.url), 'utf8'));
    const missing = Object.fromEntries(schema.physicsFields.filter((field: { key: string }) =>
      !(field.key in row.values) && field.key in reference).map((field: { key: string }) => [field.key, reference[field.key]]));
    current = payload({ 'catalog:3:323': { metadata: {}, profiles: { '7': missing } } });
    await refreshVehicleDisplaySettings(true);
    assert.doesNotThrow(() => bundledVehicleSpecCatalog().lookup(323, 7));
    current = payload();
    await refreshVehicleDisplaySettings(true);
    assert.equal(cached.title, '原车名');
    assert.equal(bundledVehicleSpecCatalog().lookup(387, 7).spec.forwardAccel, original);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('exported details match runtime specifications for every complete vehicle and both profiles', () => {
  const data = JSON.parse(readFileSync(new URL('../../../server-go/internal/data/economy/vehicle-details.json', import.meta.url), 'utf8'));
  const catalog = bundledVehicleSpecCatalog();
  let complete = 0, incomplete = 0;
  for (const vehicle of data.vehicles) for (const speed of [7, 4]) {
    const values = { ...vehicle.profiles['7'], ...vehicle.profiles[String(speed)] };
    let result;
    try { result = catalog.createVehicleParameters(vehicle.identity, speed, vehicle.body); }
    catch { incomplete++; continue; }
    const expected = { ...result.spec } as unknown as Record<string, unknown>;
    PART_LOCK_FIELDS.forEach((key, index) => { expected[key] = result.spec.partsLocks[index]; });
    delete expected.partsLocks;
    const factor = vehicle.body.BoostAccelFactorOnlyItem ?? vehicle.body.BoosterAccelFactorItem;
    if (factor !== undefined) expected.boostAccelFactorOnlyItem = Math.fround(Number(factor));
    assert.deepEqual(values, expected, `${vehicle.id}:${speed}`);
    complete++;
  }
  assert.ok(complete > 3200);
  assert.equal(complete + incomplete, 1651 * 2);
});
