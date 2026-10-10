import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { EventCollisionLatch } from "../src/vehicle/event-collision-latch.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const klass = parse(source, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "EC");
assert.ok(klass);
const Original = new Function(`${source.slice(klass.start, klass.end)}\nreturn EC;`)();

function snapshot(latch, action) {
  return {
    armed: latch.armed,
    anchor: latch.rearmAnchor,
    unknownSince: latch.unresolvedResidueSince,
    collisionReady: latch.isCollisionReady(),
    action,
  };
}

function exercise(Type, initial, explicitAnchor) {
  const projection = {
    rearmAnchorInitial: initial,
    effect: { id: "spark" }, scalePercent: 140, gravity: -2, sound: "bell",
  };
  const latch = new Type(projection, explicitAnchor);
  const states = [snapshot(latch, latch.firstOverlap())];
  for (const [at, throttled] of [
    [10, true], [10, false], [20, false], [3010, false],
    [3011, false], [3012, false], [6012, false], [6013, false],
  ]) {
    states.push(snapshot(latch, latch.slot21(at, throttled)));
    states.push(snapshot(latch, latch.firstOverlap()));
  }
  return states;
}

test("event overlap, unknown residue and rearm clocks match release", () => {
  for (const [initial, anchor] of [
    [0, undefined], ["uninitialized-target-heap", undefined],
    [800, undefined], ["uninitialized-target-heap", 0],
  ]) assert.deepEqual(exercise(EventCollisionLatch, initial, anchor),
    exercise(Original, initial, anchor), `${initial}/${anchor}`);
});
