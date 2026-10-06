import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  KartAudioRuntime, loadKartAudio, motorLevel, collisionLevel,
  roadLevel, collisionCooldownElapsed, parseRoadSoundConfig, decodeMotorAudio,
} from "../src/vehicle/kart-audio-runtime.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const textOf = name => {
  const node = declarations.find(item =>
    (item.type === "ClassDeclaration" || item.type === "FunctionDeclaration") &&
    item.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};
const helpers = ["E30", "T30", "_30", "R30"].map(textOf).join("\n");

function fixture(options = {}) {
  const log = [];
  let nextSource = 0;
  let nextGain = 0;
  const sources = [];
  const context = {
    currentTime: 12.5, state: "running",
    createBufferSource() {
      const source = {
        id: ++nextSource, buffer: null, onended: null,
        playbackRate: {
          value: 1,
          setValueAtTime(value, time) { log.push(["rate", source.id, value, time]); },
        },
        start() { log.push(["start", source.id]); },
        stop() {
          log.push(["stop", source.id]);
          if (options.stopThrows?.includes(source.id)) throw new Error("stopped");
        },
        disconnect() { log.push(["disconnect", source.id]); },
      };
      sources.push(source);
      log.push(["source", source.id]);
      return source;
    },
    createGain() {
      const gain = { id: ++nextGain, gain: { id: nextGain },
        disconnect() { log.push(["gain disconnect", gain.id]); } };
      log.push(["gain", gain.id]);
      return gain;
    },
    async resume() { log.push(["resume"]); },
    async close() { log.push(["close"]); context.state = "closed"; },
  };
  const ops = {
    route(_context, source, group = "fx", gain) {
      log.push(["route", source.id, group, gain?.id ?? null]);
    },
    setGain(param, value, time) {
      log.push(["set gain", param?.id ?? null, value, time]);
    },
    setLoop(source, enabled) { log.push(["loop", source.id, enabled]); },
    roadSoundEnabled() { return !options.roadDisabled; },
  };
  const deps = { S9: ops.route, he: ops.setGain, w4: ops.setLoop,
    BQ: ops.roadSoundEnabled };
  const Original = new Function("deps", `with (deps) { ${helpers}\n${textOf("pv")}\nreturn pv; }`)(deps);
  const buffer = name => ({ name, length: 12_000, sampleRate: 48_000 });
  const roadSounds = new Map([
    ["road", { name: "road", filename: "road", spacing: false,
      volume0: 10, volume100: 110, buffer: buffer("road") }],
    ["spaced", { name: "spaced", filename: "spaced", spacing: true,
      volume0: 0, volume100: 100, buffer: buffer("spaced") }],
  ]);
  const args = [context, buffer("motor"), buffer("collision"),
    buffer("shock"), buffer("drift"), buffer("reset"),
    new Map([[1, buffer("boost start")], [3, buffer("boost")],
      [4, buffer("boost")], [15, buffer("delivery")]]),
    !options.disableDelivery, buffer("dual ready"), buffer("dual"),
    buffer("charger"), options.noExceed ? undefined : buffer("exceed"),
    buffer("transforming"), options.noTransform ? 0 : 2.5, roadSounds];
  return { log, sources, context, ops, Original, args };
}

function snapshot(owner) {
  const sourceFields = ["source", "collisionSource", "stateSource", "dualSource",
    "chargerSource", "exceedSource", "transformingSource", "driftSource",
    "roadSource", "landingShockSource"];
  return {
    ...Object.fromEntries(sourceFields.map(name => [name, owner[name]?.id ?? null])),
    state: owner.state,
    dualBoosterState: owner.dualBoosterState,
    dualSourceMode: owner.dualSourceMode,
    lastCollisionMs: owner.lastCollisionMs ?? null,
    lastUpdateMs: owner.lastUpdateMs,
    motorInterrupted: owner.motorInterrupted,
    roadName: owner.roadName ?? null,
    roadSpacingElapsed: owner.roadSpacingElapsed ?? null,
    resetSources: [...owner.resetSources].map(source => source.id),
    steeringCollisionSources: [...owner.steeringCollisionSources].map(source => source.id),
  };
}

async function runRuntime(kind, options = {}) {
  const f = fixture(options);
  const owner = kind === "original"
    ? new f.Original(...f.args)
    : new KartAudioRuntime(...f.args, f.ops);
  const states = [];
  const record = () => states.push(snapshot(owner));
  const step = (method, ...args) => { owner[method](...args); record(); };
  step("start");
  step("start");
  step("update", 40, 30);
  step("update", 70, 60);
  step("update", 150, 140);
  step("playReset");
  f.sources.at(-1).onended(); record();
  step("playCollision", 4, 1000);
  step("playCollision", 10, 1100);
  f.sources.at(-1).onended(); record();
  step("playCollision", 5, 2000);
  step("playCollision", 7, 3100);
  step("playSteeringCollision", 0.5);
  step("update", 400, 20);
  step("playLandingShock", true, 12);
  step("setState", 1, 0);
  step("setState", 3, 6);
  step("setState", 10, 4);
  step("setState", 3, 4);
  step("setState", 15, 0);
  step("setExceedActive", true);
  step("setExceedActive", false);
  step("setChargerActive", true);
  step("setChargerActive", false);
  step("setTransformingState", 1);
  step("setDriftActive", true);
  step("updateRoad", "road", 20, 0.1);
  step("updateRoad", "road", 70, 0.1);
  step("updateRoad", "spaced", 80, 0.1);
  if (owner.roadSource) { owner.roadSource.onended(); record(); }
  step("updateRoad", "spaced", 80, 0.1);
  step("updateRoad", "spaced", 80, 2);
  step("updateRoad", undefined, 80, 0.1);
  await owner.setPaused(true); record();
  step("playReset");
  step("resetRace");
  step("stopRace");
  await owner.setPaused(false); record();
  await owner.dispose(false); record();
  return { log: f.log, states };
}

test("kart audio runtime source transitions match the release", async () => {
  for (const options of [{}, { roadDisabled: true },
    { disableDelivery: true, noTransform: true }]) {
    assert.deepEqual(await runRuntime("rewritten", options),
      await runRuntime("original", options), JSON.stringify(options));
  }
});

test("kart audio numeric curves match the release", () => {
  const Original = new Function(`${helpers}; return { E30, T30, _30, R30 };`)();
  for (const speed of [-100, 0, 1, 63.9, 64, 100, 127.9, 128, 200])
    assert.deepEqual(motorLevel(speed), Original.R30(speed));
  for (const strength of [-5, 0, 1, 10, 40])
    assert.equal(collisionLevel(strength), Original.E30(strength));
  for (const speed of [0, 10, 50, 100, 150])
    assert.equal(roadLevel(speed, 10, 100), Original.T30(speed, 10, 100));
  for (const [now, previous] of [[0, undefined], [1000, 100],
    [2001, 0], [100, 0xffff_fff0]])
    assert.equal(collisionCooldownElapsed(now, previous), Original._30(now, previous));
});

test("road config and motor PCM decoding match the release", async () => {
  const original = new Function("deps", `with (deps) {
    ${textOf("G30")}\n${textOf("C30")}
    return { G30, C30 };
  }`)({
    s2: bytes => bytes.root,
    T: (node, key) => node.attributes[key],
    S30: (_bytes, makeBuffer) => makeBuffer(
      new DataView(new Int16Array([-32768, 32767, 0, 16384]).buffer),
      2, 2, 48_000),
  });
  const parse = bytes => bytes.root;
  const attr = (node, key) => node.attributes[key];
  const bytes = { root: { name: "road", children: [
    { name: "sound", attributes: { name: "paved", filename: "paved",
      spacing: "true", spacingLen: "4.3", volume0: "0.1", volume100: "2.8" } },
  ] } };
  assert.deepEqual(parseRoadSoundConfig(bytes, parse, attr), original.G30(bytes));
  for (const bad of [
    { root: { name: "wrong", children: [] } },
    { root: { name: "road", children: [{ name: "bad", attributes: {} }] } },
    { root: { name: "road", children: [{ name: "sound", attributes: {} }] } },
    { root: { name: "road", children: [{ name: "sound", attributes: {
      name: "x", filename: "x", spacing: "maybe" } }] } },
  ]) {
    let releaseError, rewrittenError;
    try { original.G30(bad); } catch (error) { releaseError = error.message; }
    try { parseRoadSoundConfig(bad, parse, attr); }
    catch (error) { rewrittenError = error.message; }
    assert.equal(rewrittenError, releaseError);
  }
  const context = { createBuffer(channels, frames, sampleRate) {
    const data = Array.from({ length: channels }, () => new Float32Array(frames));
    return { channels, frames, sampleRate, data,
      getChannelData(index) { return data[index]; } };
  } };
  const decoder = (_bytes, makeBuffer) => makeBuffer(
    new DataView(new Int16Array([-32768, 32767, 0, 16384]).buffer),
    2, 2, 48_000);
  const rewritten = await decodeMotorAudio(context, new Uint8Array([1]), decoder);
  const released = await original.C30(context, new Uint8Array([1]));
  assert.deepEqual({ channels: rewritten.channels, frames: rewritten.frames,
    sampleRate: rewritten.sampleRate, data: rewritten.data },
  { channels: released.channels, frames: released.frames,
    sampleRate: released.sampleRate, data: released.data });
});

function loadFixture(options = {}) {
  const calls = [];
  const context = { state: "running", async close() { calls.push(["close"]); context.state = "closed"; } };
  const source = path => ({ async bytes() { calls.push(["bytes", path]); return new Uint8Array([path.length]); } });
  const library = { exactCanonicalCandidates(path) {
    calls.push(["candidate", path]);
    if (options.missing?.includes(path)) return [];
    if (options.duplicate?.includes(path)) return [source(path), source(path)];
    if (path.includes("sound_/fx/kart/engine_") &&
      !path.includes("engine_common") && options.commonOnly) return [];
    return [source(path)];
  } };
  const decode = async (_context, bytes) => {
    calls.push(["decode", bytes[0]]);
    return { id: bytes[0] };
  };
  const parseRoad = bytes => {
    calls.push(["parse road", bytes[0]]);
    return [{ name: "asphalt", filename: "asphalt", spacing: false,
      spacingLen: 5, volume0: 0, volume100: 1 }];
  };
  const make = (...args) => {
    calls.push(["make", args.map(arg => arg instanceof Map
      ? [...arg].map(([key, value]) => [key, value?.id ?? value?.buffer?.id])
      : typeof arg === "object" ? arg?.id ?? "context" : arg)]);
    return { made: true };
  };
  const deps = { C30: decode, Q9: decode, G30: parseRoad,
    AudioContext: class { constructor() { return context; } } };
  const Original = new Function("deps", `with (deps) { ${["Be", "B30", "ll"].map(textOf).join("\n")}\n${textOf("pv")}\nreturn pv; }`)(deps);
  const ops = { decodeMotor: decode, decodeAudio: decode,
    parseRoadConfig: parseRoad, createContext: () => context };
  return { calls, context, library, make, Original, ops };
}

async function runLoad(kind, options = {}) {
  const f = loadFixture(options);
  try {
    const context = options.ownContext ? undefined : f.context;
    if (kind === "original") {
      // The release constructs pv directly; intercept its constructor output.
      const result = await f.Original.load(f.library, "blue", 7, 2.5,
        context, "blue_kart");
      f.make(result.context, result.motor, result.collision,
        result.landingShock, result.drift, result.reset, result.stateBuffers,
        result.boosterDeliveryEnabled, result.dualBoosterReady,
        result.dualBooster, result.charger, result.exceed,
        result.transforming, result.chargeBoostBySpeed, result.roadSounds);
    } else {
      await loadKartAudio(f.library, "blue", 7, 2.5, context,
        "blue_kart", f.ops, f.make);
    }
    return { calls: f.calls };
  } catch (error) { return { calls: f.calls, error: error.message }; }
}

test("kart audio resource resolution and cleanup match the release", async () => {
  const crash = "sound_/fx/kart/crash.ogg";
  const motor = "sound_/fx/kart/engine_blue/motor.ogg";
  const road = "sound_/fx/road/road.bml";
  for (const options of [{}, { commonOnly: true },
    { missing: [motor] }, { missing: [motor], ownContext: true },
    { missing: [crash], ownContext: true },
    { duplicate: [crash] }, { duplicate: [road] }]) {
    assert.deepEqual(await runLoad("rewritten", options),
      await runLoad("original", options), JSON.stringify(options));
  }
});
