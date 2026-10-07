import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

// Exercise the actual generated storage boundary, including migration of old
// saves, without loading the renderer and its browser-only dependencies.
const source = readFileSync(new URL("../src/generated/world.js", import.meta.url), "utf8");
const names = new Set(["_P", "la0", "ua0", "RP"]);
const declarations = parse(source, { sourceType: "module" }).program.body.filter(node =>
  names.has(node.id?.name ?? node.declarations?.[0]?.id?.name));
assert.equal(declarations.length, 4);

function optionsStore(serialized = null) {
  let stored = serialized;
  return new Function("localStorage", "Br", "TP", "ta0", "aa0",
    `${declarations.map(node => source.slice(node.start, node.end)).join("\n")}
    return { load: la0, save: ua0 };`)(
    { getItem: () => stored, setItem: (_key, value) => { stored = value; } },
    {}, {}, () => {}, () => {});
}

test("new and existing saves default to unlocked presentation and preserve other settings", () => {
  const fresh = optionsStore().load();
  assert.equal(fresh.verticalSync, false);
  const { verticalSync, ...legacy } = fresh;
  legacy.bgmVolume = 0.25;
  legacy.shadow = false;
  const migrated = optionsStore(JSON.stringify(legacy)).load();
  assert.equal(migrated.verticalSync, false);
  assert.equal(migrated.bgmVolume, 0.25);
  assert.equal(migrated.shadow, false);
});

test("an explicit sync preference survives save/load and invalid values are rejected", () => {
  const store = optionsStore();
  const options = { ...store.load(), verticalSync: true };
  store.save(options);
  assert.equal(store.load().verticalSync, true);
  assert.throws(() => store.save({ ...options, verticalSync: "false" }), /verticalSync/);
});
