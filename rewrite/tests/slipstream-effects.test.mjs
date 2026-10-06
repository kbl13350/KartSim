import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  SlipstreamAudio, SlipstreamVisual, loadSlipstreamAudio, loadSlipstreamVisual,
} from "../src/vehicle/slipstream-effects.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const classes = parse(source, { sourceType: "module" }).program.body.filter(node =>
  node.type === "ClassDeclaration" && ["mv", "wv"].includes(node.id.name));
assert.equal(classes.length, 2);
const classText = Object.fromEntries(classes.map(node =>
  [node.id.name, source.slice(node.start, node.end)]));

function visualFixture(options = {}) {
  const calls = [];
  const resource = (path, id) => ({ virtualPath: path,
    async bytes() { calls.push(["bytes", id]); return new Uint8Array([id]); } });
  const library = { exactCanonicalCandidates(path) {
    calls.push(["candidate", path]);
    const id = path.includes("slipstream_EF") ? 2 : 1;
    const missing = id === 2 ? options.noBurst : options.noDraft;
    const duplicate = id === 2 ? options.duplicateBurst : options.duplicateDraft;
    return missing ? [] : duplicate ? [resource(path, id), resource(path, id)] : [resource(path, id)];
  } };
  const makeScene = id => ({
    id,
    object: { visible: true,
      add(...objects) { calls.push(["scene add", id, objects.map(object => object.id)]); },
      removeFromParent() { calls.push(["remove", id]); } },
    playControllers(...args) { calls.push(["play", id, ...args]); },
    stopControllers(...args) { calls.push(["stop", id, ...args]); },
    update(...args) { calls.push(["update", id, ...args]); },
    dispose() { calls.push(["dispose", id]); },
  });
  const deps = {
    y9: bytes => { calls.push(["decode", [...bytes]]); return { id: bytes[0] }; },
    c5: async (model, _library, _path, identity, settings) => {
      calls.push(["load", model.id, identity, settings]);
      if (options.burstFails && model.id === 2) throw new Error("burst fail");
      return makeScene(model.id);
    },
  };
  const Original = new Function("deps", `with (deps) { const PC = "effect/draft/effect.1s", FC = "effect/draft/slipstream_EF.1s"; ${classText.mv}; return mv; }`)(deps);
  const kart = options.noKart ? undefined : { object: {
    add(...objects) { calls.push(["kart add", objects.map(object => object.id)]); },
  } };
  return { calls, deps, library, Original, kart };
}

async function exerciseVisual(kind, options) {
  const { calls, deps, library, Original, kart } = visualFixture(options);
  try {
    const effect = kind === "original"
      ? await Original.load(library, kart, "environment", "stage")
      : await loadSlipstreamVisual(library, kart, "environment", "stage",
        { decodeModel: deps.y9, loadModel: deps.c5 },
        (scene, burst) => new SlipstreamVisual(scene, burst));
    if (effect) {
      for (const [now, enabled, burst] of [
        [1, true, false], [2, true, true], [3, true, true],
        [4, false, false], [5, true, true],
      ]) effect.update(now, enabled, burst, "a", "b", "c");
      effect.reset(10);
      effect.dispose();
    }
    return { present: !!effect, calls };
  } catch (error) { return { error: error.message, calls }; }
}

test("slipstream visual loading, transitions and cleanup match release", async () => {
  for (const options of [
    {}, { noBurst: true }, { noDraft: true }, { noKart: true },
    { duplicateDraft: true }, { duplicateBurst: true }, { burstFails: true },
  ]) assert.deepEqual(await exerciseVisual("rewritten", options),
    await exerciseVisual("original", options), JSON.stringify(options));
});

function audioFixture(options = {}) {
  const calls = [];
  let id = 0;
  const context = { createBufferSource() {
    const source = { id: ++id, buffer: null, onended: null,
      start() { calls.push(["start", source.id]); },
      stop() { calls.push(["stop", source.id]); if (options.stopFails) throw new Error("already stopped"); },
      disconnect() { calls.push(["disconnect", source.id]); },
    };
    calls.push(["source", source.id]);
    return source;
  } };
  const library = { exactCanonicalCandidates(path) {
    calls.push(["candidate", path]);
    const name = path.includes("slipStream") ? "charging" : "draft";
    if (options[`missing${name}`]) return [];
    const source = { async bytes() { calls.push(["bytes", name]); return new Uint8Array([name.length]); } };
    return options[`duplicate${name}`] ? [source, source] : [source];
  } };
  const deps = {
    Q9: async (_context, bytes) => { calls.push(["decode", [...bytes]]); return { id: bytes[0] }; },
    w4: (source, enabled) => calls.push(["loop", source.id, enabled]),
    S9: (_context, source) => calls.push(["route", source.id]),
  };
  const Original = new Function("deps", `with (deps) { ${classText.wv}; return wv; }`)(deps);
  return { calls, context, library, deps, Original };
}

async function exerciseAudio(kind, options) {
  const { calls, context, library, deps, Original } = audioFixture(options);
  try {
    const audio = kind === "original"
      ? await Original.load(library, context)
      : await loadSlipstreamAudio(library, context, deps.Q9,
        (ctx, charge, draft) => new SlipstreamAudio(ctx, charge, draft,
          { loop: deps.w4, connect: deps.S9 }));
    audio.update(true, true);
    audio.update(true, true);
    audio.draft?.onended?.();
    audio.update(false, true);
    audio.reset();
    audio.dispose();
    return { charging: !!audio.charging, draft: !!audio.draft, calls };
  } catch (error) { return { error: error.message, calls }; }
}

test("slipstream audio loops, one-shot cue and source validation match release", async () => {
  for (const options of [
    {}, { missingcharging: true }, { missingdraft: true },
    { duplicatecharging: true }, { duplicatedraft: true }, { stopFails: true },
  ]) assert.deepEqual(await exerciseAudio("rewritten", options),
    await exerciseAudio("original", options), JSON.stringify(options));
});
