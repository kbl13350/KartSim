import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { RainAudioCue, loadRainAudioCue } from "../src/vehicle/rain-audio-cue.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const originalClass = declarations.find(node => node.type === "ClassDeclaration" && node.id.name === "y7");
const originalSource = declarations.find(node => node.type === "FunctionDeclaration" && node.id.name === "l40");
assert.ok(originalClass && originalSource);

function harness() {
  const log = [];
  const sources = [];
  const context = {
    createBufferSource() {
      const id = sources.length;
      const source = {
        buffer: null, onended: null,
        start() { log.push(`start:${id}`); },
        stop() { log.push(`stop:${id}`); if (id === 1) throw new Error("already stopped"); },
        disconnect() { log.push(`disconnect:${id}`); },
      };
      sources.push(source);
      return source;
    },
  };
  const route = (_, source) => log.push(`route:${sources.indexOf(source)}`);
  const Original = new Function("decode", "route", `const Q9 = decode, S9 = route;
    ${release.slice(originalSource.start, originalSource.end)}
    ${release.slice(originalClass.start, originalClass.end)}
    return y7;`)(async (_, bytes) => ({ data: [...bytes] }), route);
  class Rewritten extends RainAudioCue {
    constructor(audioContext, buffer) { super(audioContext, buffer, route); }
  }
  const library = {
    exactCanonicalCandidates(path) {
      log.push(`lookup:${path}`);
      return [{ bytes: async () => new Uint8Array([2, 4, 6]) }];
    },
  };
  return { log, sources, context, library, Original, Rewritten };
}

async function exercise(rewritten) {
  const state = harness();
  const { Original, Rewritten, context, library, log, sources } = state;
  const cue = rewritten
    ? await loadRainAudioCue(library, context,
      async (_, bytes) => ({ data: [...bytes] }),
      (audioContext, buffer) => new Rewritten(audioContext, buffer))
    : await Original.load(library, context);
  cue.setRainEnabled(true);
  cue.setRainEnabled(false);
  const first = sources[0];
  cue.playCue();
  first.onended();
  const second = sources[1];
  const activeAfterStaleEnd = cue.cueSource === second;
  cue.dispose();
  return { log, cue: cue.cue, activeAfterStaleEnd, disposed: cue.cueSource === undefined };
}

test("rain cue loading, replay, stale completion and disposal match release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});

test("rain cue source must be unique", async () => {
  await assert.rejects(loadRainAudioCue(
    { exactCanonicalCandidates: () => [] },
    { createBufferSource: () => { throw new Error("unreachable"); } },
    async () => { throw new Error("unreachable"); },
    () => { throw new Error("unreachable"); },
  ), /source 数量应为 1/);
});
