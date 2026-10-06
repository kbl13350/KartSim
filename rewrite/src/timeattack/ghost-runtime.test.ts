import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GhostParticipantStream, GhostPlayback, GhostPoseRecorder, GhostRecorder, GhostRouteProgress,
  type GhostPlaybackDependencies, type GhostRouteStamp,
  type GhostRouteTrack, type GhostSampleStream,
} from "./ghost-runtime";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function releasedClass(name: string, next: string): string {
  const start = release.indexOf(`class ${name} {`);
  const end = release.indexOf(`\n${next}`, start);
  assert.ok(start >= 0 && end > start, `${name} moved in the release`);
  return release.slice(start, end);
}
const playbackSource = releasedClass("nf0", "class if0");
const samplerSource = releasedClass("kD", "class Rh0");
const streamSource = releasedClass("af0", "class cf0");
const recorderSource = releasedClass("cf0", "const lf0");
const routeSource = releasedClass("hf0", "class df0");

test("Ghost playback stamp bounds, live mode selection and smooth sampler match release", () => {
  function inspect(rewritten: boolean): unknown {
    const events: unknown[][] = [];
    const record = { stamps: [
      { time: 0, x: 0, y: 0, z: 0 },
      { time: 1, x: 1, y: 2, z: 3 },
      { time: 1, x: 4, y: 5, z: 6 },
      { time: 3, x: 7, y: 8, z: 9 },
      { time: 6, x: 10, y: 11, z: 12 },
    ] };
    const decodeRouteStamp = (stamp: typeof record.stamps[number]) => {
      events.push(["decode", stamp.time, stamp.x]);
      return { x: stamp.x, y: stamp.y, z: stamp.z };
    };
    const sampleC1 = (_record: unknown, elapsedMs: number) => {
      events.push(["c1", elapsedMs]); return { kind: "c1", elapsedMs };
    };
    const sampleC2 = (_record: unknown, elapsedMs: number) => {
      events.push(["c2", elapsedMs]); return { kind: "c2", elapsedMs };
    };
    const sampleNative = (_record: unknown, elapsedMs: number) => {
      events.push(["native", elapsedMs]); return { kind: "native", elapsedMs };
    };
    class SmoothSampler {
      constructor(_record: unknown) { events.push(["new-smooth"]); }
      sample(elapsedMs: number) {
        events.push(["smooth", elapsedMs]); return { kind: "smooth", elapsedMs };
      }
    }
    const dependencies: GhostPlaybackDependencies<{ kind: string; elapsedMs: number }> = {
      decodeRouteStamp, sampleC1, sampleC2, sampleNative,
      createSmoothSampler: source => new SmoothSampler(source),
    };
    const Original = new Function("By", "Jh0", "ed0", "Yh0", "FD",
      `${playbackSource}\nreturn nf0;`)(decodeRouteStamp, sampleC1,
      sampleC2, SmoothSampler, sampleNative) as new (
        source: typeof record, mode: () => string,
      ) => GhostPlayback<{ kind: string; elapsedMs: number }>;
    let currentMode = "native";
    const mode = () => { events.push(["mode", currentMode]); return currentMode; };
    const playback = rewritten
      ? new GhostPlayback(record, mode, dependencies)
      : new Original(record, mode);
    const stamps: GhostRouteStamp[] = [];
    for (const [fromMs, toMs] of [[-1, 0], [0, 100], [100, 300], [300, 600], [600, 800]]) {
      playback.visitRouteStamps(fromMs!, toMs!, stamp => stamps.push(stamp));
    }
    const samples = [];
    for (const variant of ["c1", "c2", "native-smooth", "native-smooth", "native", "unknown"]) {
      currentMode = variant;
      samples.push(playback.sample(125));
    }
    return { durationMs: playback.durationMs, lastTimeMs: playback.lastTimeMs,
      stamps, samples, events };
  }
  assert.deepEqual(inspect(true), inspect(false));
  const invalid = { stamps: [] };
  const deps = { decodeRouteStamp: () => ({ x: 0, y: 0, z: 0 }),
    sampleC1: () => 0, sampleC2: () => 0, sampleNative: () => 0,
    createSmoothSampler: () => ({ sample: () => 0 }) };
  assert.throws(() => new GhostPlayback(invalid, () => "native", deps),
    /KSV playback 记录没有任何帧/);
});

test("multi-participant recording, finish order and reset match release", () => {
  function inspect(rewritten: boolean): unknown {
    const events: unknown[][] = [];
    class Stream implements GhostSampleStream<number, { frames: number[] }> {
      private frames: number[] = [];
      constructor(readonly zCeiling: number) { events.push(["new-stream", zCeiling]); }
      begin(frame: number) { events.push(["begin", frame]); this.frames.push(frame); }
      update(frame: number) { events.push(["update", frame]); this.frames.push(frame); }
      finish() { events.push(["finish"]); return { frames: this.frames.slice() }; }
      finishRuntime() { events.push(["finish-runtime"]); return this.frames.slice(); }
    }
    const Original = new Function("af0", `${recorderSource}\nreturn cf0;`)(Stream) as new (
      zCeiling: number,
    ) => GhostRecorder<number, { frames: number[] }>;
    const recorder = rewritten
      ? new GhostRecorder(900, value => new Stream(value))
      : new Original(900);
    const first = { equipment: "kart-A", startSlot: 1,
      sample(time: number) { events.push(["sample-A", time]); return time + 1; } };
    const second = { equipment: "kart-B", startSlot: 2,
      sample(time: number) { events.push(["sample-B", time]); return time + 2; } };
    recorder.addParticipant(first);
    recorder.addParticipant(second);
    const before = recorder.count;
    recorder.update(100);
    const finished = recorder.finish();
    recorder.reset();
    const after = recorder.count;
    recorder.update(200);
    return { before, finished, after, events };
  }
  assert.deepEqual(inspect(true), inspect(false));
});

test("Ghost pose recording grid, time limit, runtime copies and encoding match release", () => {
  function inspect(rewritten: boolean): unknown {
    const events: unknown[][] = [];
    type Pose = { timeMs: number; x: number; status: number };
    const interpolatePose = (previous: Pose, current: Pose, fraction: number): Pose => {
      events.push(["interpolate", previous.timeMs, current.timeMs, fraction]);
      return { timeMs: current.timeMs, x: Math.fround(previous.x +
        Math.fround((current.x - previous.x) * fraction)), status: current.status };
    };
    const encodeStamp = (pose: Pose, zCeiling: number) => {
      events.push(["encode", pose.timeMs, pose.x, zCeiling]);
      return { timeMs: pose.timeMs, x: pose.x, zCeiling };
    };
    const Original = new Function("Ih0", "xD", "Vf", "Bh0",
      `${samplerSource}\nreturn kD;`)(interpolatePose, encodeStamp, 100, 600_000) as new (
        zCeiling: number,
      ) => GhostPoseRecorder<Pose, ReturnType<typeof encodeStamp>>;
    const sampler = rewritten
      ? new GhostPoseRecorder(900, { interpolatePose, encodeStamp })
      : new Original(900);
    sampler.begin({ timeMs: -20, x: 1, status: 7 });
    const outcomes = [
      { timeMs: 1000, x: 2, status: 1 },
      { timeMs: 1030, x: 3, status: 2 },
      { timeMs: 1100, x: 4, status: 3 },
      { timeMs: 1150, x: 5, status: 4 },
      { timeMs: 1233, x: 6, status: 5 },
      { timeMs: 1301, x: 7, status: 6 },
      { timeMs: 601000, x: 8, status: 7 },
      { timeMs: 601100, x: 9, status: 8 },
    ].map(pose => sampler.update(pose));
    const runtime = sampler.finishRuntime();
    const copy = runtime !== sampler.runtimeStamps;
    const encoded = sampler.finish();
    return { outcomes, runtime, copy, encoded,
      started: sampler.started, stopped: sampler.stopped,
      baseTime: sampler.baseTime, nextGrid: sampler.nextGrid,
      previousTime: sampler.previousTime, previous: sampler.previous, events };
  }
  assert.deepEqual(inspect(true), inspect(false));

  function missingPrevious(rewritten: boolean): string {
    const interpolatePose = (previous: { timeMs: number }, current: { timeMs: number }) => current;
    const encodeStamp = (pose: { timeMs: number }) => pose;
    const Original = new Function("Ih0", "xD", "Vf", "Bh0",
      `${samplerSource}\nreturn kD;`)(interpolatePose, encodeStamp, 100, 600_000) as new (
        zCeiling: number,
      ) => GhostPoseRecorder<{ timeMs: number }, { timeMs: number }>;
    const sampler = rewritten
      ? new GhostPoseRecorder(900, { interpolatePose, encodeStamp })
      : new Original(900);
    sampler.update({ timeMs: 1000 });
    sampler.previous = undefined;
    try { sampler.update({ timeMs: 1100 }); }
    catch (error) { return (error as Error).message; }
    return "no error";
  }
  assert.equal(missingPrevious(true), missingPrevious(false));
});

test("Ghost participant stream delegates its sampler calls like release", () => {
  function inspect(rewritten: boolean): unknown {
    const events: unknown[][] = [];
    class Sampler implements GhostSampleStream<number, { frames: number[] }> {
      frames: number[] = [];
      constructor(zCeiling: number) { events.push(["new", zCeiling]); }
      begin(frame: number) { events.push(["begin", frame]); this.frames.push(frame); }
      update(frame: number) { events.push(["update", frame]); this.frames.push(frame); return true; }
      finish() { events.push(["finish"]); return { frames: this.frames.slice() }; }
      finishRuntime() { events.push(["finish-runtime"]); return this.frames.slice(); }
    }
    const Original = new Function("kD", `${streamSource}\nreturn af0;`)(Sampler) as new (
      zCeiling: number,
    ) => GhostParticipantStream<number, { frames: number[] }>;
    const stream = rewritten
      ? new GhostParticipantStream(new Sampler(900))
      : new Original(900);
    stream.begin(0);
    const updated = stream.update(100);
    const runtime = stream.finishRuntime();
    const finished = stream.finish();
    return { updated, runtime, finished, events };
  }
  assert.deepEqual(inspect(true), inspect(false));
});

test("Ghost route progression, rewind, duplicate poses and missing owners match release", () => {
  function inspect(rewritten: boolean): unknown {
    const events: unknown[][] = [];
    const owner = {};
    let distance = 0;
    const track: GhostRouteTrack<object> = {
      resetRouteState(_owner, position) {
        events.push(["reset", position]); distance = 0;
      },
      updateRoute(_owner, previous, next) {
        events.push(["route", previous, next]); distance += 1;
      },
      getRouteState(_owner) { events.push(["distance"]); return { distance }; },
    };
    const Original = new Function(`${routeSource}\nreturn hf0;`)() as new (
      value: GhostRouteTrack<object>,
    ) => GhostRouteProgress<object>;
    const route = rewritten ? new GhostRouteProgress(track) : new Original(track);
    const playback = {
      visitRouteStamps(fromMs: number, toMs: number,
        visit: (stamp: GhostRouteStamp) => void) {
        events.push(["visit", fromMs, toMs]);
        for (const [time, stamp] of [
          [100, { x: 1, y: 2.1, z: 3 }],
          [200, { x: 2, y: 5.6, z: 4 }],
        ] as const) {
          if (time > fromMs && time <= toMs) visit(stamp);
        }
      },
    };
    const errors: string[] = [];
    try { route.update(owner, playback, 100, { x: 1, y: 3, z: Math.fround(-2.1) }); }
    catch (error) { errors.push((error as Error).message); }
    try { route.distance(owner); }
    catch (error) { errors.push((error as Error).message); }
    route.seed(owner, { x: 0, y: 0, z: 0 });
    route.update(owner, playback, 100, { x: 1, y: 3, z: Math.fround(-2.1) });
    const afterFirst = route.distance(owner);
    route.update(owner, playback, 100, { x: 99, y: 99, z: 99 });
    route.update(owner, playback, 200, { x: 3, y: 4, z: 5 });
    const afterSecond = route.distance(owner);
    route.update(owner, playback, 50, { x: 0, y: 0, z: 0 });
    const afterRewind = route.distance(owner);
    return { errors, afterFirst, afterSecond, afterRewind, events };
  }
  assert.deepEqual(inspect(true), inspect(false));
});
