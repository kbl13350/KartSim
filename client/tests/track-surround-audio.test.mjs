import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { Object3D, Vector3 } from "three";
import {
  collectDummySounds, parseDummySoundConfig, TrackDummySurroundAudio,
  StandaloneEventSurroundAudio, eventDistance, eventVolume, unsupportedEventSound,
} from "../src/vehicle/track-surround-audio.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const declaration = declarations.find(node =>
    (node.type === "ClassDeclaration" || node.type === "FunctionDeclaration") && node.id.name === name);
  assert.ok(declaration, name);
  return release.slice(declaration.start, declaration.end);
}
const parser = new Function("Je", `${original("Nn0")}; ${original("Vn0")}; return { Nn0, Vn0 };`)(Math.fround);

function config(attributes) {
  return { name: "sound", attributes: Object.entries(attributes).map(([name, value]) =>
    ({ name, value: String(value) })), children: [] };
}

test("track dummy sound metadata and malformed values match release", () => {
  const examples = [
    config({ filename: "station", maxRadius: "4.7", minRadius: "10", panning: "OFF",
      spacing: " +120ms", timeLine0: " 10ms", timeLine1: "25", timeLineOffset: "-1" }),
    config({ filename: "wind", maxVolume: "0.6", minVolume: "0.1", panning: "False" }),
    config({ filename: "wind", spacing: "garbage", timeLine2: "oops" }),
    config({ maxRadius: "1" }),
  ];
  for (const example of examples)
    assert.deepEqual(parseDummySoundConfig(example), parser.Nn0(example));
  for (const invalid of ["NaN", "Infinity", "garbage"])
    assert.throws(() => parseDummySoundConfig(config({ filename: "x", maxVolume: invalid })),
      { message: `${"x"} maxVolume 无效。` });
  const model = { root: { kind: "track", trackObjects: [
    { kind: "ToDummy", name: "sound_main", property: { children: [examples[0]] },
      transform: { position: [1, 2, 3] } },
    { kind: "ToDummy", name: "sound_missing", property: { children: [examples[3]] },
      transform: { position: [4, 5, 6] } },
    { kind: "ToDummy", name: "other", property: { children: [examples[1]] },
      transform: { position: [7, 8, 9] } },
  ] } };
  assert.deepEqual(collectDummySounds(model), parser.Vn0(model));
  assert.deepEqual(collectDummySounds({ root: { kind: "node" } }), []);
});

function fixture(options = {}) {
  const log = [];
  const sources = [];
  let sourceIndex = 0;
  let gainIndex = 0;
  let panIndex = 0;
  const context = {
    currentTime: 0,
    createBufferSource() {
      const id = ++sourceIndex;
      const source = {
        id, buffer: null, loop: false, onended: null,
        start() { log.push(["start", id]); },
        stop() {
          log.push(["stop", id]);
          if (options.stopThrows) throw new Error("already stopped");
        },
        disconnect() { log.push(["disconnect source", id]); },
      };
      sources.push(source);
      log.push(["source", id]);
      return source;
    },
    createGain() {
      const id = ++gainIndex;
      log.push(["gain", id]);
      return {
        id,
        gain: { id },
        disconnect() { log.push(["disconnect gain", id]); },
      };
    },
    createStereoPanner() {
      const id = ++panIndex;
      log.push(["panner", id]);
      return {
        id,
        pan: { setValueAtTime(value, time) { log.push(["pan", id, value, time]); } },
        disconnect() { log.push(["disconnect panner", id]); },
      };
    },
  };
  const deps = {
    H: Vector3,
    Je: Math.fround,
    Fn0: "sound_/fx/surround",
    Dn0: ["ogg", "wav", "flac"],
    IC: "sound_/fx/surround",
    z30: ["ogg", "wav", "flac"],
    Q1: Math.fround,
    Q9: async (_context, bytes) => {
      log.push(["decode", [...bytes]]);
      return { duration: 0.6, sampleRate: 48_000, length: 28_800 };
    },
    w4(source, enabled) { source.loop = enabled; log.push(["loop", source.id, enabled]); },
    he(param, value, time) { log.push(["set gain", param.id, value, time]); },
    S9(_context, source, group, gain, panner) {
      log.push(["route", source.id, group, gain.id, panner?.id ?? null]);
    },
    e3(origin, matrix) {
      log.push(["transform", origin, matrix]);
      return matrix.position;
    },
  };
  const ops = {
    decode: deps.Q9, route: deps.S9, setGain: deps.he, setLoop: deps.w4,
    worldMatrix(root) { log.push(["matrix", root?.name]); return root?.matrix; },
    transformPoint: deps.e3,
  };
  const files = options.files ?? ["sound_/fx/surround/wind.ogg"];
  const library = {
    exactCanonicalCandidates(path) {
      log.push(["candidates", path]);
      return files.filter(file => file === path).map((file, index) => ({
        async bytes() { log.push(["bytes", file, index]); return new Uint8Array([4, 5, 6]); },
      }));
    },
  };
  return { log, sources, context, deps, ops, library };
}

const originalDummy = new Function("deps", `with (deps) { ${original("m7")}; return m7; }`);
function dummyState(owner) {
  return {
    disposed: owner.disposed,
    lastUpdateMs: owner.lastUpdateMs ?? null,
    sounds: owner.sounds.map(sound => ({
      name: sound.name, position: sound.worldPosition.toArray(),
      repeatIntervalMs: sound.repeatIntervalMs, active: sound.active,
      lastTriggerMs: sound.lastTriggerMs, timelineElapsedMs: sound.timelineElapsedMs,
      timelineIndex: sound.timelineIndex, source: sound.source?.id ?? null,
      gain: sound.gain?.id ?? null, panner: sound.panner?.id ?? null,
    })),
  };
}

async function exerciseDummy(kind, options = {}) {
  const f = fixture(options);
  const soundConfig = {
    filename: "wind", maxVolume: 0.9, minVolume: 0.2,
    maxRadius: 1, minRadius: 8, spacing: options.spacing ?? 0,
    panning: options.panning ?? true, timeLine: options.timeline ?? [],
    timeLineOffset: options.offset ?? -1,
  };
  const sounds = [
    { name: "sound_a", position: [2, -3, 1], config: soundConfig },
    { name: "sound_b", position: [3, 0, 0], config: { ...soundConfig, panning: false } },
  ];
  const Original = originalDummy(f.deps);
  try {
    const owner = kind === "original"
      ? await Original.load(f.library, sounds, f.context)
      : await TrackDummySurroundAudio.load(f.library, sounds, f.context, f.ops);
    const states = [dummyState(owner)];
    const listener = new Object3D();
    listener.position.set(0, 0, 0);
    for (const [time, x] of [[0, 0], [0.05, 0], [0.15, 1], [0.25, 20], [0.4, 2], [1, 0], [1.9, 0]]) {
      f.context.currentTime = time;
      listener.position.x = x;
      owner.update(listener);
      states.push(dummyState(owner));
    }
    const source = owner.sounds[0]?.source;
    if (source?.onended) { source.onended(); states.push(dummyState(owner)); }
    owner.dispose(); states.push(dummyState(owner));
    owner.dispose(); states.push(dummyState(owner));
    return { log: f.log, states };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("dummy surround playback, panning, scheduling, and cleanup match release", async () => {
  for (const options of [{}, { spacing: 250 }, { timeline: [100, 500], spacing: 700 },
    { panning: false }, { stopThrows: true }, { offset: 2 },
    { files: [] }, { files: ["sound_/fx/surround/wind.ogg", "sound_/fx/surround/wind.wav"] }]) {
    assert.deepEqual(await exerciseDummy("rewritten", options), await exerciseDummy("original", options),
      JSON.stringify(options));
  }
});

const eventHelpers = ["eL", "U30", "$30", "W30", "H30", "q30", "Q1"]
  .map(original).join("\n");
const originalEvent = new Function("deps", `with (deps) { ${eventHelpers}\n${original("v7")}; return v7; }`);
function eventState(owner) {
  return { disposed: owner.disposed, lastUpdateMs: owner.lastUpdateMs ?? null,
    sounds: owner.sounds.map(sound => ({ position: sound.position,
      source: sound.source?.id ?? null, gain: sound.gain?.id ?? null })) };
}

async function exerciseEvent(kind, options = {}) {
  const f = fixture(options);
  const sound = {
    filename: "wind", maxVolume: 0.8, minVolume: 0.1, maxRadius: 2, minRadius: 10,
    panning: !!options.panning, spacing: options.spacing ?? 0,
    timeLine: options.timeline ?? [], timeLineOffset: options.offset ?? -1,
  };
  const events = [
    { sound, renderRoot: { name: "root 1", matrix: { position: { x: 1, y: 2, z: 3 } } } },
    { sound, renderRoot: { name: "root 2", matrix: { position: { x: 3, y: 2, z: 1 } } } },
  ];
  if (options.noMatrix) events[0].renderRoot.matrix = undefined;
  const Original = originalEvent(f.deps);
  try {
    const owner = kind === "original"
      ? await Original.load(f.library, events, f.ops.worldMatrix, f.context)
      : await StandaloneEventSurroundAudio.load(f.library, events, f.context, f.ops);
    const states = [eventState(owner)];
    for (const [time, x] of [[0, 0], [50, 0], [100, 20], [200, 3], [301, 5], [450, 0]]) {
      owner.update(time, { x, y: 0, z: 0 });
      states.push(eventState(owner));
    }
    const source = owner.sounds[0]?.source;
    if (source?.onended) { source.onended(); states.push(eventState(owner)); }
    owner.dispose(); states.push(eventState(owner));
    owner.dispose(); states.push(eventState(owner));
    return { log: f.log, states };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("standalone event sound loading, falloff, lifecycle, and rejection match release", async () => {
  for (const options of [{}, { panning: true }, { spacing: 250 }, { timeline: [100] },
    { offset: 0 }, { noMatrix: true }, { files: [] },
    { files: ["sound_/fx/surround/wind.ogg", "sound_/fx/surround/wind.wav"] },
    { stopThrows: true }]) {
    assert.deepEqual(await exerciseEvent("rewritten", options), await exerciseEvent("original", options),
      JSON.stringify(options));
  }
  const functions = new Function("deps", `with (deps) { ${eventHelpers}; return { eL, H30, q30 }; }`)(
    { Q1: Math.fround });
  for (const config of [
    { panning: true, spacing: 0, timeLine: [], timeLineOffset: -1 },
    { panning: false, spacing: 12, timeLine: [], timeLineOffset: -1 },
    { panning: false, spacing: 0, timeLine: [100], timeLineOffset: -1 },
    { panning: false, spacing: 0, timeLine: [], timeLineOffset: 2 },
  ]) assert.equal(unsupportedEventSound(config), functions.eL(config));
  const falloff = { maxRadius: 2.2, minRadius: 8.9, maxVolume: 0.8, minVolume: 0.13 };
  for (const distance of [0, 2.2, 2.2001, 4.9, 8.9])
    assert.equal(eventVolume(falloff, distance), functions.H30(falloff, distance));
  for (const position of [{ x: 0, y: 0, z: 0 }, { x: 1.3, y: -2.5, z: 3 }])
    assert.equal(eventDistance(position, { x: 4.9, y: 7.8, z: -2.1 }),
      functions.q30(position, { x: 4.9, y: 7.8, z: -2.1 }));
});
