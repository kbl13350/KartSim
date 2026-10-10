import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { loadCharacterAsset } from "../src/vehicle/load-character-asset.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const klass = parse(source, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "ul");
assert.ok(klass);
const method = klass.body.body.find(node => node.key?.name === "loadCharacterAsset");
assert.ok(method);
const methodText = source.slice(method.start, method.end);

function fixture(options = {}) {
  const calls = [];
  const record = (name, ...args) => calls.push([name, ...args]);
  const asset = (name, sourceName = "character_alice.rho", containerId = "character1") => ({
    containerId, canonicalPath: `character_alice/${name}`,
    virtualPath: `character_alice/${name}`, sourceName,
    name: name.split("/").at(-1),
    async bytes() { record("bytes", name); return new Uint8Array([name.length]); },
  });
  const root = asset("character_alice.rho");
  const names = ["costume/model.1s", "costume/body.png", "costume/high.png",
    "costume/face.png", "costume/base.png", "costume/overlay.png"];
  const files = names.filter(name => !(options.missingModel && name.endsWith("model.1s")) &&
    !(options.missingBody && name.endsWith("body.png")) &&
    !(options.missingHigh && name.endsWith("high.png")) &&
    !(options.missingFace && name.endsWith("face.png")))
    .map(name => asset(name));
  for (const name of ["f00", "f49", "f50", "f54", "f40", "f41", "f42"])
    if (options.missingMotion !== name)
      files.push(asset(`${name}.1s`, "character_common.rho", "common"));
  const library = { files };
  const profile = { equipment: { itemIds: { 2: 6, 70: options.colorId ?? 0 } } };
  const host = {
    userProfile: profile,
    getLibrary() { record("library"); return options.noLibrary ? undefined : library; },
    requireAsset(path) { record("source", path); return root; },
  };
  const identity = {
    model: "costume/model.1s", body: "costume/body.png",
    high: options.high ? "costume/high.png" : undefined,
    motionFolder: undefined,
  };
  const dependencies = {
    pk: async (...args) => { record("identity", ...args); return { source: "item" }; },
    CR: (...args) => { record("costume", ...args); return identity; },
    FI: bytes => { record("motion", [...bytes]); return { name: `motion-${bytes[0]}` }; },
    qp: ["f00", "f49", "f50", "f54"],
    HY: ["f00", "f49", "f50", "f54"],
    WY: ["f00", "f49", "f50", "f54"],
    s40: (...args) => { record("linked controller", ...args); return { kind: "linked" }; },
    o40: (...args) => { record("special controller", ...args); return { kind: "special" }; },
    r40: (...args) => { record("standard controller", ...args); return { kind: "standard" }; },
    b10: class { constructor(...args) { record("award controller", ...args); this.kind = "award"; } },
    g9: (motions, name) => {
      const value = motions.get(name);
      if (!value) throw new Error(`人物动作集合缺少 ${name}。`);
      return value;
    },
    SR: (...args) => {
      record("face sources", ...args);
      return new Map([
        ["base", { kind: "direct", image: "costume/face.png" }],
        ["overlay", { kind: "split", base: "costume/base.png", overlay: "costume/overlay.png" }],
      ]);
    },
    xR: motions => { record("face motions", motions); return "face motion assets"; },
    We: async (...args) => { record("palette", ...args); return { primary: 1, high: 2 }; },
    xa: bytes => { record("model parse", [...bytes]); return { parsed: true }; },
    TR: async (...args) => { record("scene", ...args); return { object: { visible: true } }; },
  };
  const Original = new Function("deps",
    `with (deps) { return class { constructor(assetHost) { this.assetHost = assetHost; } ${methodText} }; }`)(dependencies);
  const owner = new Original(host);
  const ops = {
    resolveIdentity: dependencies.pk,
    chooseCostume: dependencies.CR,
    decodeMotion: dependencies.FI,
    linkedMotionNames: dependencies.qp,
    specialMotionNames: dependencies.HY,
    standardMotionNames: dependencies.WY,
    linkedController: dependencies.s40,
    specialController: dependencies.o40,
    standardController: dependencies.r40,
    awardController: (...args) => new dependencies.b10(...args),
    faceTextureSources: dependencies.SR,
    collectFaceMotionAssets: dependencies.xR,
    palette: dependencies.We,
    parseModel: dependencies.xa,
    createScene: dependencies.TR,
  };
  return { calls, owner, ops, profile };
}

async function exercise(implementation, options) {
  const { calls, owner, ops, profile } = fixture(options);
  const args = ["character_alice.rho", { internalId: 1, uniform: "a" },
    { motionSource: 1 }, options.animationType ?? 0, !!options.includeF54,
    { environment: 1 }, { stage: 2 }, options.linkMode,
    profile, { outline: true }, !!options.award];
  try {
    const value = implementation === "original"
      ? await owner.loadCharacterAsset(...args)
      : await loadCharacterAsset(owner, ...args, ops);
    return JSON.parse(JSON.stringify({ value, calls }));
  } catch (error) {
    return JSON.parse(JSON.stringify({ error: error.message, calls }));
  }
}

test("character provenance, motions, face textures and rider colors match release", async () => {
  for (const options of [
    {}, { colorId: 7, includeF54: true, high: true },
    { linkMode: "always", award: true, includeF54: true },
    { linkMode: "conditional", colorId: 5 },
    { animationType: 1 }, { animationType: 1, award: true },
    { animationType: 2 }, { noLibrary: true },
    { missingModel: true }, { missingBody: true },
    { missingHigh: true, high: true }, { missingMotion: "f00" },
    { missingFace: true },
  ]) assert.deepEqual(await exercise("rewritten", options),
    await exercise("original", options), JSON.stringify(options));
});
