import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { GarageModelCache, type GarageCachedModel,
  type GarageModelSource } from "./garage-model-cache";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Qi");
assert.ok(view && view.type === "ClassDeclaration");
const source = release.slice(view.start!, view.end!);

type Cache = GarageModelCache<GarageCachedModel>;
const Original = new Function(`${source}; return Qi;`)() as new (
  load: (source: GarageModelSource) => Promise<GarageCachedModel>,
  onError: (path: string, error: unknown) => void,
) => Cache;

function fixture(released: boolean) {
  const events: unknown[] = [];
  const pending: Array<{ path: string; resolve(model: GarageCachedModel): void;
    reject(error: unknown): void }> = [];
  const load = (source: GarageModelSource) => new Promise<GarageCachedModel>((resolve, reject) => {
    events.push(["load", source.path]);
    pending.push({ path: source.path, resolve, reject });
  });
  const onError = (path: string, error: unknown) => {
    events.push(["error", path, String(error)]);
  };
  const cache = released ? new Original(load, onError) : new GarageModelCache(load, onError);
  const resolve = (path: string) => {
    const request = pending.shift();
    assert.equal(request?.path, path);
    request.resolve({ dispose: () => { events.push(["dispose-model", path]); } });
  };
  const reject = (path: string, error: unknown) => {
    const request = pending.shift();
    assert.equal(request?.path, path);
    request.reject(error);
  };
  const snapshot = () => ({ events: structuredClone(events),
    ready: [...cache.panels.keys()], loading: [...cache.loading], failed: [...cache.failed],
    generation: cache.generation, disposed: cache.disposed });
  return { cache, resolve, reject, snapshot };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test("Garage model loads once, returns ready models and clears by generation like Qi", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const source = { path: "body.rho" };
    const first = f.cache.get(source);
    const duplicate = f.cache.get(source);
    const loading = f.snapshot();
    f.resolve("body.rho");
    await settle();
    const ready = f.cache.get(source);
    const loaded = f.snapshot();
    f.cache.clear();
    const cleared = f.snapshot();
    f.cache.get(source);
    f.cache.clear();
    f.resolve("body.rho");
    await settle();
    return { first, duplicate, loading, ready: !!ready, loaded, cleared,
      final: f.snapshot() };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("Garage model failure, retry, stale success and disposal match Qi", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    const source = { path: "wheel.rho" };
    f.cache.get(source);
    f.reject("wheel.rho", new Error("decode failed"));
    await settle();
    f.cache.get(source);
    const failed = f.snapshot();
    f.cache.clear();
    f.cache.get(source);
    f.cache.dispose();
    f.resolve("wheel.rho");
    await settle();
    f.cache.get(source);
    f.cache.clear();
    return { failed, final: f.snapshot() };
  };
  assert.deepEqual(await run(false), await run(true));
});
