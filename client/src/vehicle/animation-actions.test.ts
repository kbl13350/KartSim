import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ActionSetMotionController,
  ResultMotionController,
  SingleActionMotionController,
  type MotionPlan,
} from "./animation-actions";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const classes = [
  sourceBetween("class b10 {", "class bS {"),
  sourceBetween("class bS {", "class rk {"),
  sourceBetween("class rk {", "class sk {"),
].join("\n");

let calls: string[] = [];
class FakeSequence {
  requested: number[] = [];
  pending = false;
  updates: number[] = [];
  constructor(public source: unknown, public motions: Map<number, MotionPlan<unknown>>, public initialState: number) {
    calls.push(`sequence:${initialState}`);
  }
  update(nowMs: number): number[] { calls.push(`update:${nowMs}`); this.updates.push(nowMs); return [this.initialState, nowMs]; }
  reset(): void { calls.push("sequence.reset"); this.requested = []; this.pending = false; this.updates = []; }
  root(): number { calls.push("root"); return this.initialState * 10; }
  face(): number { calls.push("sequence.face"); return this.initialState * 100; }
  acceptsMotion(state: number): boolean { calls.push(`accepts:${state}`); return state !== 99; }
  isPending(): boolean { calls.push("isPending"); return this.pending; }
  request(state: number): void { calls.push(`request:${state}`); this.requested.push(state); }
}
const helpers = {
  m1(animation: unknown, enterBlendMs: number): MotionPlan<unknown> {
    calls.push(`m1:${String(animation)}/${enterBlendMs}`);
    return { animation, enterBlendMs };
  },
  h5(animation: unknown, enterBlendMs: number, returnBlendMs: number): MotionPlan<unknown> {
    calls.push(`h5:${String(animation)}/${enterBlendMs}/${returnBlendMs}`);
    return { animation, enterBlendMs, returnBlendMs };
  },
};
const Original = new Function("_r", "m1", "h5", `${classes}\nreturn { b10, bS, rk };`)(
  FakeSequence, helpers.m1, helpers.h5,
) as {
  b10: new (gameplay: Gameplay, base: unknown, clips: Record<number, unknown>, optional?: unknown) => ResultLike;
  bS: new (base: unknown, clip: unknown, action: number) => SingleLike;
  rk: new (base: unknown, clip: unknown, extra: Map<number, unknown>) => ActionSetLike;
};
const dependencies = {
  createSequence: (source: unknown, motions: Map<number, MotionPlan<unknown>>, initial: number) =>
    new FakeSequence(source, motions, initial),
  oneWay: helpers.m1,
  returnable: helpers.h5,
};
interface Gameplay {
  update(nowMs: number, frame?: unknown): number[];
  face(): number;
  reset(): void;
}
interface ResultLike {
  sequence: FakeSequence;
  gameplay: Gameplay;
  active: boolean;
  last?: number;
  enter(): void;
  enterResult(state: number): void;
  request(state: number): void;
  update(nowMs: number, frame?: unknown): number[];
  face(): number;
  reset(): void;
}
interface SingleLike {
  sequence: FakeSequence;
  update(nowMs: number): number[];
  reset(): void;
  face(): number;
}
interface ActionSetLike extends SingleLike {
  actions: Set<number>;
  request(state: number): void;
}
function gameplay(): Gameplay {
  return {
    update(nowMs, frame) { calls.push(`gameplay.update:${nowMs}/${String(frame)}`); return [0, nowMs]; },
    face() { calls.push("gameplay.face"); return 9; },
    reset() { calls.push("gameplay.reset"); },
  };
}
const clips = { 3: "third", 4: "fourth", 5: "fifth", 12: "twelfth" };

function compare<T extends { sequence: FakeSequence }>(
  label: string,
  makeOriginal: () => T,
  makeMigrated: () => T,
  action: (controller: T) => unknown = () => undefined,
): void {
  calls = [];
  const expected = makeOriginal();
  const constructorCalls = [...calls];
  calls = [];
  const actual = makeMigrated();
  assert.deepEqual(calls, constructorCalls, `${label}: construction calls`);
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: own fields`);
  assert.deepEqual(actual.sequence.motions, expected.sequence.motions, `${label}: motion map`);
  calls = [];
  const releasedResult = action(expected), releasedCalls = [...calls];
  calls = [];
  const migratedResult = action(actual);
  assert.deepEqual(migratedResult, releasedResult, `${label}: result`);
  assert.deepEqual(calls, releasedCalls, `${label}: call order`);
  assert.deepEqual(actual.sequence.requested, expected.sequence.requested, `${label}: requests`);
  assert.deepEqual(actual.sequence.updates, expected.sequence.updates, `${label}: updates`);
  if ("active" in actual && "active" in expected && "last" in actual && "last" in expected) {
    assert.equal(actual.active, expected.active, `${label}: active`);
    assert.equal(actual.last, expected.last, `${label}: last action`);
  }
  if ("actions" in actual && "actions" in expected) assert.deepEqual(actual.actions, expected.actions, `${label}: actions`);
}

function result(label: string, action: (controller: ResultLike) => unknown, optional?: unknown) {
  compare<ResultLike>(label,
    () => new Original.b10(gameplay(), "base", clips, optional),
    () => new ResultMotionController(gameplay(), "base", clips, optional, dependencies) as unknown as ResultLike,
    action);
}

test("result controller delegates live and celebration phases like release", () => {
  result("initial live presentation", controller => [controller.update(1000, "frame"), controller.face()]);
  result("optional clip plan", controller => controller.sequence.motions.get(13), "optional");
  result("enter and request", controller => {
    controller.enter(); controller.request(12); controller.request(12);
    return [controller.update(1000, "frame"), controller.face()];
  });
  result("pending suppresses request but records last", controller => {
    controller.enter(); controller.sequence.pending = true;
    controller.request(13); controller.request(13); return controller.last;
  }, "optional");
  result("enter result and reset", controller => {
    controller.enterResult(12); controller.update(1200);
    controller.reset(); return [controller.update(1300), controller.face()];
  });
});

test("single action and action whitelist wrappers preserve release behavior", () => {
  compare<SingleLike>("single action", () => new Original.bS("base", "action", 7),
    () => new SingleActionMotionController("base", "action", 7, dependencies) as SingleLike,
    controller => { const output = controller.update(2000); controller.reset(); return [output, controller.face()]; });
  const extra = new Map<number, unknown>([[8, "eighth"], [9, "ninth"]]);
  compare<ActionSetLike>("action whitelist", () => new Original.rk("base", "special", extra),
    () => new ActionSetMotionController("base", "special", extra, dependencies) as ActionSetLike,
    controller => {
      controller.request(404); controller.request(99); controller.request(8);
      const output = controller.update(3000);
      controller.reset(); return [output, controller.face()];
    });
});
