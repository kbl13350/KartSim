import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { LteDodgeMotion, LteDodgeInput } from "../src/vehicle/lte-dodge.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = statements.find(item =>
    (item.type === "FunctionDeclaration" || item.type === "ClassDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const Original = new Function("deps", `with (deps) {
  const H9 = Math.fround, P40 = 4;
  ${original("F40")}
  ${original("D40")}
  return { F40, D40 };
}`);

function state(motion) {
  return { direction: motion.direction, pending: motion.pending,
    elapsed: motion.elapsed, active: motion.active, disposed: motion.disposed,
    interrupted: motion.interrupted };
}
function exerciseMotion(kind) {
  const original = Original({ l2: {}, Ql: {} });
  const motion = kind === "original" ? new original.F40() : new LteDodgeMotion();
  const states = [state(motion)];
  const results = [];
  const velocity = { x: 0, y: 0, z: 0 };
  const act = (name, ...args) => {
    try { results.push(motion[name](...args)); }
    catch (error) { results.push(error.message); }
    states.push(state(motion));
    states.push({ ...velocity });
  };
  act("begin", 1);
  act("begin", -1);
  act("step", 0.002, { x: 1, y: 0.5, z: -0.25 }, 12, 0.8, false, velocity);
  act("step", 0.001, { x: 1, y: 0.5, z: -0.25 }, 12, 0.8, false, velocity);
  act("step", 0.002, { x: 1, y: 0.5, z: -0.25 }, 12, 0.8, true, velocity);
  act("step", 0.003, { x: 1, y: 0.5, z: -0.25 }, 12, 0.8, false, velocity);
  act("step", 0.001, { x: NaN, y: 0, z: 0 }, 12, 0.8, false, velocity);
  act("interrupt");
  act("consumeInterrupted");
  act("consumeInterrupted");
  act("begin", -1);
  for (let i = 0; i < 305; i++) motion.step(0.002, { x: 1, y: 0, z: 0 }, 1, 1, false, velocity);
  states.push(state(motion));
  act("dispose");
  act("dispose");
  act("begin", 1);
  return { results, states, velocity };
}

test("LTE dodge impulse integration and lifetime match release", () => {
  assert.deepEqual(exerciseMotion("rewritten"), exerciseMotion("original"));
});

function exerciseInput(kind) {
  const deps = { l2: { ModeImpulsePositive: 11, ModeImpulseNegative: 12 }, Ql: { lockMs: 500 } };
  const original = Original(deps);
  const input = kind === "original" ? new original.D40()
    : new LteDodgeInput({ positiveAction: 11, negativeAction: 12, lockMs: 500 });
  const states = [];
  const results = [];
  const record = () => states.push({ disposed: input.disposed, lockTick: input.lockTick ?? null,
    motion: state(input.motion) });
  const call = (name, ...args) => {
    try { results.push(input[name](...args)); }
    catch (error) { results.push(error.message); }
    record();
  };
  record();
  call("dispatch", { kind: "other", action: 11 }, 100, true);
  call("dispatch", { kind: "unsupported-action", action: 11 }, 100, false);
  call("dispatch", { kind: "unsupported-action", action: 11 }, 100, true);
  call("dispatch", { kind: "unsupported-action", action: 12 }, 120, true);
  call("update", 400, true);
  call("update", 700, true);
  call("start", 12, 800);
  call("update", 900, false);
  input.motion.interrupt(); record();
  call("updateAvailability", true);
  call("start", 11, -1);
  call("dispose");
  call("dispatch", { kind: "unsupported-action", action: 12 }, 1000, true);
  call("dispose");
  return { results, states };
}

test("LTE dodge action dispatch, lockout, and disposal match release", () => {
  assert.deepEqual(exerciseInput("rewritten"), exerciseInput("original"));
});
