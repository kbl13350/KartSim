import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CharacterMotionSequencer,
  type CharacterMotionDefinition,
  type CharacterMotionOps,
  type CharacterSample,
  type PreparedCharacterClip,
  type RawCharacterClip,
} from "./motion-sequencer";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class _r {");
const end = release.indexOf("class ag {", start);
assert.ok(start >= 0 && end > start);

interface RawClip extends RawCharacterClip { root: { value: number } }
interface Clip extends PreparedCharacterClip {
  id: number;
  root: number;
  resetCount: number;
  sequence: { header: number[]; rootChannel: { value: number } };
}
interface Sample extends CharacterSample {
  translation: number[];
  rotation: number[];
}
type MotionDefinition = CharacterMotionDefinition<RawClip>;

let calls: string[] = [];
const logged = (name: string): void => { calls.push(name); };
const globals = {
  G10(rootValue: number): Clip {
    logged(`prepare:${rootValue}`);
    return {
      id: rootValue, root: rootValue * 10, resetCount: 0,
      sequence: { header: [0, 0, 300], rootChannel: { value: rootValue * 2 } },
    };
  },
  ts(clip: Clip, elapsed: number) {
    logged(`sample:${clip.id}/${elapsed}`);
    const samples = Array.from({ length: 24 }, (_, index): Sample => ({
      translation: [clip.id, elapsed, index], rotation: [index, clip.id, elapsed, 1],
    }));
    return {
      samples,
      pose: samples.map(sample => [sample.rotation[0]!, sample.translation[0]!, ...Array(10).fill(0)]),
      root: clip.id * 10 + elapsed,
    };
  },
  Rh(sample: Sample): Sample {
    logged("clone");
    return { translation: [...sample.translation], rotation: [...sample.rotation] };
  },
  D8(clip: Clip, root: number): number {
    logged(`face:${clip.id}/${root}`);
    return clip.id * 100 + root;
  },
  uk(clip: Clip, elapsed: number, output: Sample[]): void {
    logged(`advance:${clip.id}/${elapsed}`);
    for (let index = 0; index < output.length; index += 1) {
      output[index]!.translation = [clip.id, elapsed, index];
      output[index]!.rotation = [index, elapsed, clip.id, 1];
    }
  },
  il(pose: number[], rotation: number[], translation: number[]): void {
    logged("pose");
    pose[0] = rotation[0]!;
    pose[1] = translation[0]!;
    pose[2] = translation[1]!;
  },
  V8(clip: Clip): void { logged(`reset:${clip.id}`); clip.resetCount += 1; },
  hk(channel: unknown, root: unknown, elapsed: number): number {
    logged(`root:${String(channel)}/${String(root)}/${elapsed}`);
    return Number(channel) + Number(root) + elapsed;
  },
  f0(value: number): number { logged("float"); return Math.fround(value); },
  P10(target: Sample, from: Sample, to: Sample, weight: number): void {
    logged("blend");
    for (let index = 0; index < 3; index += 1) {
      target.translation[index] = Math.fround(from.translation[index]! * (1 - weight) + to.translation[index]! * weight);
    }
    for (let index = 0; index < 4; index += 1) {
      target.rotation[index] = Math.fround(from.rotation[index]! * (1 - weight) + to.rotation[index]! * weight);
    }
  },
};

const Original = new Function(
  "G10", "ts", "Rh", "D8", "uk", "il", "V8", "hk", "f0", "P10",
  `${release.slice(start, end)}\nreturn _r;`,
)(globals.G10, globals.ts, globals.Rh, globals.D8, globals.uk,
  globals.il, globals.V8, globals.hk, globals.f0, globals.P10) as new (
    source: RawClip,
    motions: Map<number, MotionDefinition>,
    initial: number,
  ) => Sequence;

const ops: CharacterMotionOps<RawClip, Clip, Sample> = {
  prepare: globals.G10,
  sample: globals.ts,
  cloneSample: globals.Rh,
  faceAt: globals.D8,
  advanceSamples: globals.uk,
  writePose: globals.il,
  resetClip: globals.V8,
  sampleRoot: globals.hk,
  float: globals.f0,
  blendSample: globals.P10,
};
type Sequence = Pick<CharacterMotionSequencer<RawClip, Clip, Sample>,
  "source" | "motions" | "initialState" | "target" | "transitionSource" |
  "transitionTarget" | "outputSamples" | "outputPose" | "blendMs" |
  "hasPreviousTime" | "previousAbsolute" | "elapsed" | "rootValue" |
  "faceValue" | "transitioned" | "pending" | "request" | "acceptsMotion" |
  "isPending" | "update" | "reset" | "root" | "face" | "motion" |
  "armReturn" | "beginTarget" | "updatePending" | "evaluateBlend">;

function inputs() {
  const raw = (value: number): RawClip => ({ root: { value } });
  const motions = new Map<number, MotionDefinition>([
    [0, { animation: raw(1), enterBlendMs: 100 }],
    [1, { animation: raw(2), enterBlendMs: 50, returnBlendMs: 40, spanOverrideMs: 200 }],
    [2, { animation: raw(3), enterBlendMs: 70, returnBlendMs: 30 }],
    [3, { animation: raw(2), enterBlendMs: 20 }],
  ]);
  return { source: raw(1), motions, initial: 0 };
}

function snapshot(sequence: Sequence) {
  return {
    source: sequence.source,
    motions: sequence.motions,
    initialState: sequence.initialState,
    target: sequence.target,
    transitionSource: sequence.transitionSource,
    transitionTarget: sequence.transitionTarget,
    outputSamples: sequence.outputSamples,
    outputPose: sequence.outputPose,
    blendMs: sequence.blendMs,
    hasPreviousTime: sequence.hasPreviousTime,
    previousAbsolute: sequence.previousAbsolute,
    elapsed: sequence.elapsed,
    rootValue: sequence.rootValue,
    faceValue: sequence.faceValue,
    transitioned: sequence.transitioned,
    pending: sequence.pending,
    reusedSourceClip: sequence.source === sequence.motions.get(0)?.clip,
    reusedStateClip: sequence.motions.get(1)?.clip === sequence.motions.get(3)?.clip,
  };
}

function compare(label: string, action: (sequence: Sequence) => unknown = () => undefined): void {
  calls = [];
  const sourceA = inputs();
  const expected = new Original(sourceA.source, sourceA.motions, sourceA.initial);
  const constructorCalls = [...calls];
  calls = [];
  const sourceB = inputs();
  const actual = new CharacterMotionSequencer(sourceB.source, sourceB.motions, sourceB.initial, ops);
  assert.deepEqual(calls, constructorCalls, `${label}: constructor dependency order`);
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: field order`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: constructor state`);
  calls = [];
  let releasedResult: unknown, releasedError: string | undefined;
  try { releasedResult = action(expected); } catch (error) { releasedError = (error as Error).message; }
  const releasedCalls = [...calls];
  calls = [];
  let migratedResult: unknown, migratedError: string | undefined;
  try { migratedResult = action(actual); } catch (error) { migratedError = (error as Error).message; }
  assert.equal(migratedError, releasedError, `${label}: error`);
  assert.deepEqual(migratedResult, releasedResult, `${label}: result`);
  assert.deepEqual(calls, releasedCalls, `${label}: dependency calls`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("sequencer construction, blends and normal playback match release", () => {
  compare("initial state and cache");
  compare("first blended update", sequence => sequence.update(1000));
  compare("advance after blend", sequence => { sequence.update(1000); return sequence.update(1200); });
  compare("unsigned clock wrap", sequence => {
    sequence.update(0xffff_fffa); return sequence.update(3);
  });
  compare("root and face accessors", sequence => {
    sequence.update(1000); return [sequence.root(), sequence.face()];
  });
});

test("motion requests, pending returns and reset preserve release timing", () => {
  compare("motion request", sequence => { sequence.request(1); return sequence.isPending(); });
  compare("pending accepts only returnable motion", sequence => {
    sequence.request(1); return [sequence.acceptsMotion(2), sequence.acceptsMotion(0)];
  });
  compare("pending starts and returns", sequence => {
    sequence.request(1); sequence.update(1000); sequence.update(1100);
    sequence.update(1301); return sequence.update(1400);
  });
  compare("second request re-arms pending", sequence => {
    sequence.request(1); sequence.update(1000); sequence.request(2);
    sequence.update(1100); return sequence.update(1500);
  });
  compare("request without return cancels pending", sequence => {
    sequence.request(1); sequence.request(3); return sequence.isPending();
  });
  compare("reset from running clip", sequence => {
    sequence.request(1); sequence.update(1000); sequence.update(1300);
    sequence.reset(); return [sequence.root(), sequence.face(), sequence.isPending()];
  });
});

test("missing state errors and pending short circuit match release", () => {
  compare("unknown requested state", sequence => sequence.request(99));
  compare("unknown accepted while not pending", sequence => sequence.acceptsMotion(99));
  compare("unknown accepted while pending", sequence => {
    sequence.request(1); return sequence.acceptsMotion(99);
  });
});
