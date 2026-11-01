import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { buildReleaseVehicleData } from "./release-data-builder";
import { d10 as runtimeD10, h10 as runtimeH10, hn as runtimeHn } from "../generated/data.js";

const local = (name: string) => readFileSync(new URL(`./data/${name}`, import.meta.url), "utf8");
const extracted = (name: string) => readFileSync(
  new URL(`../../../recovered/embedded-data/${name}`, import.meta.url), "utf8",
);
const referenceFiles = ["vehicle-physics-h10.csv", "vehicle-physics-d10.csv", "vehicle-physics-overrides.mjs"];
const missingReferences = referenceFiles.filter(name => !existsSync(
  new URL(`../../../recovered/embedded-data/${name}`, import.meta.url),
));
// Private release captures are not included in public checkouts. Keep their
// comparisons available when installed, without making them a build dependency.
const releaseComparison = { skip: missingReferences.length > 0
  ? `Private recovered/embedded-data fixtures unavailable: ${missingReferences.join(", ")}` : false };
const referenceUrl = new URL("../../../recovered/embedded-data/vehicle-physics-overrides.mjs", import.meta.url);
const originalMap = missingReferences.length === 0
  ? (await import(referenceUrl.href) as { vehiclePhysicsOverrides: Map<string, Record<string, number>> }).vehiclePhysicsOverrides
  : undefined;

function referenceAliases(map: Map<string, object>): Record<string, string> {
  const firstKey = new Map<object, string>();
  const aliases: Record<string, string> = {};
  for (const [key, value] of map) {
    const target = firstKey.get(value);
    if (target === undefined) firstKey.set(value, key);
    else aliases[key] = target;
  }
  return aliases;
}

test("editable CSV strings exactly match the immutable extracted release", releaseComparison, () => {
  assert.equal(local("vehicle-physics-h10.csv"), extracted("vehicle-physics-h10.csv"));
  assert.equal(local("vehicle-physics-d10.csv"), extracted("vehicle-physics-d10.csv"));
});

test("editable JSON reconstructs every original Map key, value and alias", releaseComparison, () => {
  assert.ok(originalMap);
  const aliasesJson = local("vehicle-physics-aliases.json");
  const data = buildReleaseVehicleData(
    local("vehicle-physics-h10.csv"),
    local("vehicle-physics-d10.csv"),
    local("vehicle-physics-overrides.json"),
    aliasesJson,
  );

  assert.equal(data.h10, extracted("vehicle-physics-h10.csv"));
  assert.equal(data.d10, extracted("vehicle-physics-d10.csv"));
  assert.equal(data.hn.size, originalMap.size);
  assert.deepEqual([...data.hn.keys()], [...originalMap.keys()], "Map iteration order");
  for (const [key, expected] of originalMap) {
    const actual = data.hn.get(key);
    assert.ok(actual, `missing ${key}`);
    assert.deepEqual(Object.keys(actual), Object.keys(expected), `${key} field order`);
    assert.deepEqual(actual, expected, `${key} fields`);
    for (const field of Object.keys(expected)) {
      assert.ok(Object.is(actual[field], expected[field]), `${key}.${field} exact number`);
    }
  }
  const aliases = JSON.parse(aliasesJson) as Record<string, string>;
  assert.deepEqual(aliases, referenceAliases(originalMap));
  assert.deepEqual(referenceAliases(data.hn), referenceAliases(originalMap));
});

test("generated data module exposes the readable files with release semantics", releaseComparison, () => {
  assert.ok(originalMap);
  assert.equal(runtimeH10, extracted("vehicle-physics-h10.csv"));
  assert.equal(runtimeD10, extracted("vehicle-physics-d10.csv"));
  assert.deepEqual([...runtimeHn.keys()], [...originalMap.keys()]);
  assert.deepEqual(runtimeHn, originalMap);
  assert.deepEqual(referenceAliases(runtimeHn), referenceAliases(originalMap));
});

test("generated data includes every public vehicle override and preserves declared aliases", () => {
  const overrides = JSON.parse(local("vehicle-physics-overrides.json")) as Record<string, Record<string, number>>;
  const aliases = JSON.parse(local("vehicle-physics-aliases.json")) as Record<string, string>;
  assert.equal(runtimeH10, local("vehicle-physics-h10.csv"));
  assert.equal(runtimeD10, local("vehicle-physics-d10.csv"));
  assert.deepEqual([...runtimeHn.keys()], Object.keys(overrides));
  for (const [key, expected] of Object.entries(overrides)) assert.deepEqual(runtimeHn.get(key), expected, key);
  assert.deepEqual(referenceAliases(runtimeHn), aliases);
  for (const [alias, target] of Object.entries(aliases)) assert.equal(runtimeHn.get(alias), runtimeHn.get(target));
});

test("alias metadata rejects a missing or divergent target", () => {
  const csv = "example\n";
  const json = JSON.stringify({ "1466:4": { speed: 1 }, "1466:7": { speed: 2 } });
  assert.throws(
    () => buildReleaseVehicleData(csv, csv, json, '{"1466:7":"1466:4"}'),
    /differs/,
  );
  assert.throws(
    () => buildReleaseVehicleData(csv, csv, json, '{"1466:7":"missing"}'),
    /missing vehicle override alias/,
  );
});
