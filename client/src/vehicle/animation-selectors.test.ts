import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LinkedMotionController,
  MappedMotionController,
  StandardMotionController,
  type MotionFrame,
  type MotionSequence,
} from "./animation-selectors";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const classSource = [
  sourceBetween("class ag {", "class b10 {"),
  sourceBetween("class sk {", "class ok {"),
  sourceBetween("class ok {", "function M10("),
].join("\n");

let calls: string[] = [];
class FakeSequence implements MotionSequence<number[]> {
  requested: number[] = [];
  updates: number[] = [];
  constructor(public source: unknown, public motions: unknown, public initialState: number) {
    calls.push(`sequence:${initialState}`);
  }
  update(nowMs: number): number[] { calls.push(`update:${nowMs}`); this.updates.push(nowMs); return [this.initialState, nowMs]; }
  reset(): void { calls.push("reset"); this.requested = []; this.updates = []; }
  root(): number { calls.push("root"); return this.initialState * 10; }
  face(): number { calls.push("face"); return this.initialState * 100; }
  acceptsMotion(state: number): boolean { calls.push(`accepts:${state}`); return state !== 99; }
  isPending(): boolean { calls.push("isPending"); return false; }
  request(state: number): void { calls.push(`request:${state}`); this.requested.push(state); }
}
const helpers = {
  M10(raw: unknown) { calls.push("M10"); return { kind: "standard", raw }; },
  x10(raw: unknown) { calls.push("x10"); return { kind: "linked", raw }; },
  S10(raw: unknown) { calls.push("S10"); return { kind: "mapped", raw }; },
  ck(current: number, frame: MotionFrame, reverse: boolean): number {
    calls.push(`ck:${current}/${reverse}`);
    return Number(frame.requestedState ?? current);
  },
  T10(current: number, frame: MotionFrame, reverse: boolean, alwaysLinked: boolean): number {
    calls.push(`T10:${current}/${reverse}/${alwaysLinked}`);
    return Number(frame.requestedState ?? current);
  },
  E10(state: number): number { calls.push(`E10:${state}`); return state === 3 ? 25 : state + 20; },
};

const Original = new Function("_r", "M10", "x10", "S10", "ck", "T10", "E10",
  `${classSource}\nreturn { ag, sk, ok };`,
)(FakeSequence, helpers.M10, helpers.x10, helpers.S10, helpers.ck, helpers.T10, helpers.E10) as {
  ag: new (source: unknown, motions: unknown, reverse?: boolean) => Controller;
  sk: new (source: unknown, motions: unknown, reverse: boolean, linked: boolean) => Controller;
  ok: new (source: unknown, motions: unknown, reverse?: boolean) => Controller;
};
interface Controller {
  sequence: MotionSequence<number[]>;
  update(nowMs: number, frame?: MotionFrame): number[];
  reset(): void;
  face(): number;
  root?(): number;
  selectMotion?(nowMs: number, frame: MotionFrame): number;
  selectBaseMotion?(nowMs: number, frame: MotionFrame): number;
  submitMotion(state: number): void;
}

const standardDeps = {
  createSequence: (source: unknown, motions: unknown, initial: number) => new FakeSequence(source, motions, initial),
  buildMotions: helpers.M10,
  selectDrivingMotion: helpers.ck,
};
const linkedDeps = {
  createSequence: standardDeps.createSequence,
  buildMotions: helpers.x10,
  selectDrivingMotion: helpers.T10,
};
const mappedDeps = {
  createSequence: standardDeps.createSequence,
  buildMotions: helpers.S10,
  selectDrivingMotion: helpers.ck,
  mapState: helpers.E10,
};
const source = { clip: "idle" };
const motions = { states: [0, 3, 10, 11, 25] };
function frame(patch: Partial<MotionFrame> = {}): MotionFrame {
  return { landingTrigger: false, collisionHit: false, collisionStrength: 0, ...patch };
}

function compare(
  label: string,
  makeOriginal: () => Controller,
  makeMigrated: () => Controller,
  action: (controller: Controller) => unknown,
): void {
  calls = [];
  const expected = makeOriginal();
  const constructorCalls = [...calls];
  calls = [];
  const actual = makeMigrated();
  assert.deepEqual(calls, constructorCalls, `${label}: constructor calls`);
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: own fields`);
  calls = [];
  const releasedResult = action(expected), releasedCalls = [...calls];
  calls = [];
  const migratedResult = action(actual);
  assert.deepEqual(migratedResult, releasedResult, `${label}: result`);
  assert.deepEqual(calls, releasedCalls, `${label}: call order`);
  assert.deepEqual({ ...actual }, { ...expected }, `${label}: state`);
}

function standard(label: string, action: (controller: Controller) => unknown): void {
  compare(label, () => new Original.ag(source, motions, true),
    () => new StandardMotionController(source, motions, true, standardDeps), action);
}
function linked(label: string, action: (controller: Controller) => unknown): void {
  compare(label, () => new Original.sk(source, motions, true, false),
    () => new LinkedMotionController(source, motions, true, false, linkedDeps), action);
}
function mapped(label: string, action: (controller: Controller) => unknown): void {
  compare(label, () => new Original.ok(source, motions, true),
    () => new MappedMotionController(source, motions, true, mappedDeps), action);
}

test("standard animation controller selects drive, landing and collisions like release", () => {
  standard("drive selection", controller => controller.update(1000, frame({ requestedState: 4 })));
  standard("finish then drive", controller => controller.update(1000, frame({ finishMotion: 8, requestedState: 4 })));
  standard("small collision", controller => controller.update(1000, frame({ collisionHit: true, collisionStrength: 10 })));
  standard("medium collision", controller => controller.update(1000, frame({ collisionHit: true, collisionStrength: 20 })));
  standard("strong collision cooldown", controller => {
    controller.update(1000, frame({ collisionHit: true, collisionStrength: 31 }));
    return controller.update(1999, frame({ requestedState: 4 }));
  });
  standard("landing", controller => controller.update(1000, frame({ landingTrigger: true })));
  standard("rejected motion and reset", controller => {
    controller.submitMotion(99); controller.update(1000); controller.reset();
    return [controller.root?.(), controller.face()];
  });
});

test("linked controller honors explicit presentation motion and unconditional submit", () => {
  linked("explicit linked state", controller => controller.update(1000, frame({ linkedPresentationMotion: 18 })));
  linked("finish and strong collision", controller => controller.update(1000,
    frame({ finishMotion: 14, collisionHit: true, collisionStrength: 35 })));
  linked("rejected state still submits", controller => { controller.submitMotion(99); return controller.face(); });
  linked("reset", controller => { controller.update(1000, frame({ requestedState: 4 })); controller.reset(); });
});

test("mapped controller keeps base state and mapped clip state in sync", () => {
  mapped("drive mapped state", controller => controller.update(1000, frame({ requestedState: 4 })));
  mapped("collision mapped state", controller => controller.update(1000,
    frame({ collisionHit: true, collisionStrength: 35 })));
  mapped("finish motion", controller => controller.update(1000, frame({ finishMotion: 8, requestedState: 4 })));
  mapped("rejected mapped state", controller => { controller.submitMotion(79); return controller.face(); });
  mapped("reset", controller => { controller.update(1000, frame({ requestedState: 4 })); controller.reset(); });
});
