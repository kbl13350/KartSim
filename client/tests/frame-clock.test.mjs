import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { VehicleFrameClock, normalizeVehicleTime } from "../src/vehicle/frame-clock.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(source, { sourceType: "module" }).program.body.filter(node =>
  (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
  ["$40", "DC"].includes(node.id.name));
assert.equal(nodes.length, 2);
const original = new Function(`${nodes.map(node => source.slice(node.start, node.end)).join("\n")}; return { Clock: $40, normalize: DC };`)();

function snapshot(clock, result) {
  return { result: result && { ...result, slicesMs: [...result.slicesMs] },
    lastMs: clock.lastMs, accumulator: clock.rhythmAccumulator,
    enabled: clock.rhythmEnabled, tick: clock.rhythmTick,
    pending: clock.pendingRhythmPreviousMs,
    slices: [...clock.slicesBuffer], rhythm: clock.getRhythmState() };
}

function exercise(Type) {
  const clock = new Type();
  const states = [];
  states.push(snapshot(clock, clock.advance(100)));
  states.push(snapshot(clock, clock.advance(107)));
  clock.enableRhythmCheck();
  states.push(snapshot(clock, clock.advance(120)));
  clock.synchronize(200, true);
  states.push(snapshot(clock));
  states.push(snapshot(clock, clock.advance(220)));
  clock.synchronize(230, true);
  clock.synchronize(240, true);
  states.push(snapshot(clock, clock.advance(260)));
  states.push(snapshot(clock, clock.advance(1000)));
  clock.reset(true);
  states.push(snapshot(clock, clock.advance(0xfffffffe)));
  states.push(snapshot(clock, clock.advance(3)));
  clock.reset();
  states.push(snapshot(clock));
  return states;
}

test("vehicle frame slices, rhythm synchronization and reset match release", () => {
  assert.deepEqual(exercise(VehicleFrameClock), exercise(original.Clock));
});

test("vehicle clock input validation and unsigned conversion match release", () => {
  for (const value of [-1, -1.5, 0, 3.5, 2 ** 32 + 4, NaN, Infinity, -Infinity]) {
    const evaluate = normalize => {
      try { return normalize(value); } catch (error) { return error.message; }
    };
    assert.equal(evaluate(normalizeVehicleTime), evaluate(original.normalize), String(value));
  }
});
