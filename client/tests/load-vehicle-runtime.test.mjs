import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { loadVehicleRuntime } from "../src/vehicle/load-vehicle-runtime.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const klass = parse(source, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "ul");
assert.ok(klass);
const method = klass.body.body.find(node => node.key?.name === "loadVehicleRuntime");
assert.ok(method);
const methodText = source.slice(method.start, method.end);

function fixture(options = {}) {
  const calls = [];
  const record = (name, ...args) => calls.push([name, ...args]);
  const profile = {
    equipment: { itemIds: { 2: options.paintId ?? 4, 3: 7, 4: 8 }, kartSerial: 42 },
    garage: { name: "garage" }, initial: { level: 1 },
  };
  const library = { name: "library" };
  const bundle = {
    parameter: { value: "param" },
    find(paths) {
      record("find", paths);
      if (options.missingModel) return undefined;
      return { extension: options.badExtension ? "xml" : "1s",
        async bytes() { record("model bytes"); return new Uint8Array([1]); } };
    },
  };
  const renderScene = options.noRenderScene ? undefined : {
    name: "render", dispose() { record("render dispose"); },
  };
  const imported = { object: { name: "kart" }, model: { name: "model" }, renderScene };
  const visual = { isWheelOutline: true, name: "visual" };
  const garageItem = options.noGarageItem ? undefined : {
    cosmetics: options.coating ? { coating: 1 } : {},
    factory: { active: !!options.factory },
    progression: { kind: options.xun ? "xun" : "other", level: 5 },
  };
  const dependencies = {
    t3: async (...args) => { record("resources", ...args); return bundle; },
    yw: (...args) => {
      record("wheels", ...args);
      return [{ async bytes() { record("wheel bytes"); return new Uint8Array([2]); } }];
    },
    We: async (...args) => { record("palette", ...args); return { primary: 10, high: 20 }; },
    vw: async (...args) => { record("appearance", ...args); return "appearance"; },
    p5: (...args) => { record("garage item", ...args); return garageItem; },
    wk: async (...args) => { record("visual", ...args); if (options.visualFails) throw new Error("visual fail"); return visual; },
    cv: value => { record("params", value); return "parsed"; },
    a40: path => { record("short name", path); return "kart"; },
    d7: { load: async (...args) => {
      record("coating", ...args);
      if (options.coatingFails) throw new Error("coating fail");
      return { name: "coating" };
    } },
    Bk: (...args) => { record("needs modification", ...args); return !!options.modification; },
    Do: { loadXun: async (...args) => {
      record("xun modification", ...args);
      if (options.modificationFails) throw new Error("modification fail");
      return { name: "xun modification" };
    } },
    c6: { load: async (...args) => {
      record("normal modification", ...args);
      if (options.modificationFails) throw new Error("modification fail");
      return { name: "normal modification" };
    } },
    u5: object => record("dispose object", object),
  };
  const host = {
    userProfile: profile,
    importer: { async importVehicleRender(...args) {
      record("import", ...args);
      return imported;
    } },
  };
  const stage = { coatingTextures(archive) {
    record("coating textures", archive); return { name: "coating textures" };
  } };
  const Original = new Function("deps",
    `with (deps) { return class { constructor(assetHost) { this.assetHost = assetHost; } ${methodText} }; }`)(dependencies);
  const owner = new Original(host);
  const ops = {
    resolveResources: dependencies.t3,
    wheelAssets: dependencies.yw,
    palette: dependencies.We,
    prepareAppearance: dependencies.vw,
    garageKart: dependencies.p5,
    parseParameters: dependencies.cv,
    makeVisual: dependencies.wk,
    shortAssetName: dependencies.a40,
    loadCoating: dependencies.d7.load,
    needsParticleModification: dependencies.Bk,
    loadXunModification: dependencies.Do.loadXun,
    loadParticleModification: dependencies.c6.load,
    disposeObject: dependencies.u5,
  };
  return { calls, owner, ops, profile, library, stage };
}

async function exercise(implementation, options) {
  const { calls, owner, ops, profile, library, stage } = fixture(options);
  const args = ["kart/item.1s", "texture", 3, library,
    { env: 1 }, stage, profile, 7, options.grade ?? 9,
    options.override ? { name: "override" } : undefined, "scope", true, false];
  try {
    const value = implementation === "original"
      ? await owner.loadVehicleRuntime(...args)
      : await loadVehicleRuntime(owner, ...args, ops);
    return { value: JSON.parse(JSON.stringify(value)), calls: JSON.parse(JSON.stringify(calls)) };
  } catch (error) {
    return { error: error.message, calls: JSON.parse(JSON.stringify(calls)) };
  }
}

test("vehicle model, paint, coating, effects and cleanup match release", async () => {
  for (const options of [
    {}, { paintId: 0, noGarageItem: true, grade: 5 },
    { coating: true, factory: true, modification: true, xun: true },
    { coating: true, modification: true, grade: 8, override: true },
    { coating: true, noRenderScene: true },
    { coating: true, coatingFails: true },
    { modification: true, modificationFails: true },
    { missingModel: true }, { badExtension: true }, { visualFails: true },
  ]) assert.deepEqual(await exercise("rewritten", options),
    await exercise("original", options), JSON.stringify(options));
});
