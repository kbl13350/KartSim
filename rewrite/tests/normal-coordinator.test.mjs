import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { LapTiming, NormalObjectCoordinator } from "../src/vehicle/normal-coordinator.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const originals = Object.fromEntries(parse(source, { sourceType: "module" }).program.body
  .filter(node => node.type === "ClassDeclaration" && ["vL", "U40"].includes(node.id.name))
  .map(node => [node.id.name,
    new Function(`${source.slice(node.start, node.end)}; return ${node.id.name};`)()]));
assert.equal(Object.keys(originals).length, 2);

function exerciseTiming(Type) {
  const timer = new Type();
  const states = [];
  for (const [at, lap] of [
    [0, 0], [100, 1], [220, 2], [400, 4], [450, 3],
    [0xfffffffe, 4], [3, 5],
  ]) states.push({ completed: timer.update(at, lap),
    best: timer.bestLapMs, lap: timer.timedLap, start: timer.lapStartedAtMs });
  timer.reset();
  states.push({ best: timer.bestLapMs, lap: timer.timedLap, start: timer.lapStartedAtMs });
  return states;
}

test("lap timing, skipped laps and unsigned wrap match release", () => {
  assert.deepEqual(exerciseTiming(LapTiming), exerciseTiming(originals.vL));
});

function exerciseCoordinator(Type) {
  const calls = [];
  const eligible = (source, peer) => {
    calls.push(["eligible", source.name, peer.name]);
    return peer.category <= 2;
  };
  const coordinator = new Type(eligible);
  const object = (name, category, active, removeAt) => ({
    name, category, active, removeRequested: false,
    slot12(time) { calls.push(["slot12", name, time]);
      if (time === removeAt) this.removeRequested = true; },
    slot13(peer, time) { calls.push(["slot13", name, peer.name, time]); },
    commit() { calls.push(["commit", name]); },
    destroy() { calls.push(["destroy", name]); },
  });
  const a = object("a", 2, true, 20);
  const b = object("b", 0, true);
  const c = object("c", 3, false);
  const d = object("d", 7, true);
  coordinator.queue(a); coordinator.queue(b); coordinator.queue(c);
  let duplicate;
  try { coordinator.queue(a); } catch (error) { duplicate = error.message; }
  coordinator.run(10);
  const first = coordinator.categoryOrderedActive().map(item => item.name);
  coordinator.queue(d);
  coordinator.run(20);
  const second = coordinator.categoryOrderedActive().map(item => item.name);
  coordinator.dispose();
  coordinator.dispose();
  return { duplicate, first, second, calls,
    pending: coordinator.pending.length,
    active: coordinator.active.length,
    owned: coordinator.owned.size };
}

test("normal object update, pair order, removal and disposal match release", () => {
  assert.deepEqual(exerciseCoordinator(NormalObjectCoordinator),
    exerciseCoordinator(originals.U40));
});
