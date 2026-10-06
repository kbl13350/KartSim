import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { TimeAttackLifecycle } from "../src/timeattack/lifecycle.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const wanted = new Set(["GF", "vL", "NR", "Yr", "Qp", "fL", "OT", "Z1"]);
const declarations = parse(source, { sourceType: "module" }).program.body
  .filter(node => ["ClassDeclaration", "FunctionDeclaration"].includes(node.type) && wanted.has(node.id?.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(declarations.length, wanted.size);
const context = {};
runInNewContext(`${declarations.join("\n")}\nglobalThis.ReleasedLifecycle = GF;`, context);
const ReleasedLifecycle = context.ReleasedLifecycle;

function snapshot(lifecycle) {
  return JSON.parse(JSON.stringify({
    phase: lifecycle.phase,
    countdownSubstate: lifecycle.countdownSubstate,
    startAtMs: lifecycle.startAtMs,
    finishAtMs: lifecycle.finishAtMs,
    finishElapsedMs: lifecycle.finishElapsedMs,
    bestLapMs: lifecycle.bestLapMs,
    pausedTotalMs: lifecycle.pausedTotalMs,
    pauseAnchorRawMs: lifecycle.pauseAnchorRawMs,
    finalLapShown: lifecycle.finalLapShown,
    returnedToReady: lifecycle.returnedToReady,
    lapTiming: {
      timedLap: lifecycle.lapTiming.timedLap,
      lapStartedAtMs: lifecycle.lapTiming.lapStartedAtMs,
      bestLapMs: lifecycle.lapTiming.bestLapMs,
    },
  }));
}

function compare(actual, expected, operation, label) {
  const normalize = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  assert.deepEqual(normalize(actual), normalize(expected), label + " action " + operation);
}

function runTimeline(startMs, priorBestMs) {
  const actual = new TimeAttackLifecycle(priorBestMs);
  const expected = new ReleasedLifecycle(priorBestMs);
  const input = (offset, overrides = {}) => ({
    rawNowMs: startMs + offset,
    currentLap: 1,
    totalLaps: 3,
    routeProgress: 0,
    finishThreshold: 100,
    ...overrides,
  });
  const steps = [
    ["tick", input(0)],
    ["tick", input(1000)],
    ["tick", input(4000)],
    ["tick", input(5000)],
    ["tick", input(6000)],
    ["tick", input(7000)],
    ["booster", startMs + 7000],
    ["tick", input(8000)],
    ["pause", startMs + 8100],
    ["effective", startMs + 8200],
    ["tick", input(8300)],
    ["tick", input(8500)],
    ["pause", startMs + 9000],
    ["tick", input(10000, { currentLap: 2 })],
    ["tick", input(11000, { currentLap: 3 })],
    ["tick", input(12000, { currentLap: 3, routeProgress: 110 })],
    ["accept"],
    ["tick", input(14999)],
    ["tick", input(15001)],
    ["tick", input(20001)],
    ["tick", input(21000)],
    ["reset"],
  ];
  for (const [operation, value] of steps) {
    const invoke = lifecycle => {
      switch (operation) {
        case "tick": return lifecycle.tick(value);
        case "pause": return lifecycle.togglePause(value);
        case "effective": return lifecycle.effectiveTime(value);
        case "booster": return lifecycle.isStartBoosterWindow(value);
        case "accept": return lifecycle.acceptLocalCompletion();
        case "reset": return lifecycle.reset();
      }
    };
    compare(invoke(actual), invoke(expected), operation, `start ${startMs}`);
    assert.deepEqual(snapshot(actual), snapshot(expected), `start ${startMs} ${operation}`);
  }
}

test("countdown, racing, lap timing, pause, result and Ready return match release", () => {
  for (const start of [0, 1000, 12345, 0xfffff000]) {
    for (const priorBest of [null, 100, 5000, 60000]) runTimeline(start, priorBest);
  }
});

test("deterministic mixed clock and lap events preserve release state", () => {
  const actual = new TimeAttackLifecycle(12500);
  const expected = new ReleasedLifecycle(12500);
  let seed = 0x2c578891;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 0x100000000);
  let now = 1000;
  for (let index = 0; index < 1500; index++) {
    now += Math.floor(random() * 2000);
    const input = {
      rawNowMs: now + random(),
      currentLap: 1 + Math.floor(random() * 5),
      totalLaps: 3,
      routeProgress: random() > 0.95 ? 120 : 20,
      finishThreshold: 100,
    };
    compare(actual.tick(input), expected.tick(input), "tick", `event ${index}`);
    if (random() > 0.95) compare(actual.togglePause(now), expected.togglePause(now), "pause", `event ${index}`);
    if (random() > 0.975) {
      actual.acceptLocalCompletion();
      expected.acceptLocalCompletion();
    }
    assert.deepEqual(snapshot(actual), snapshot(expected), `event ${index}`);
  }
});
