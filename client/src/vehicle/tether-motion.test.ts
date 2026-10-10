import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { TetherMotion, type TetherParameters } from "./tether-motion";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function sourceBetween(start: string, end: string): string {
  const startAt = release.indexOf(start);
  const endAt = release.indexOf(end, startAt + start.length);
  assert.ok(startAt >= 0 && endAt > startAt, `${start} to ${end}`);
  return release.slice(startAt, endAt);
}
const classSource = sourceBetween("class H10 {", "function fi(");
const helperSource = sourceBetween("function fi(", "const q10 =");
const Original = new Function("W10", "U10", "$10", "kh",
  `${helperSource}\n${classSource}\nreturn H10;`,
)(Math.fround(0.001), 0.05, 0.01, 1) as new (parameters: TetherParameters) => TetherMotion;

const parameters: TetherParameters = {
  pos: [0.2, -0.3, 1.4],
  wireLengthLimit: 1.8,
  floatingForce: 2.3,
  viscousDrag: 0.27,
};
const transform = [
  0.9, 0.1, 0, 12,
  -0.1, 0.9, 0, 3,
  0, 0, 1, -4,
];

function compare(
  label: string,
  action: (motion: TetherMotion) => unknown,
  config: TetherParameters = parameters,
): void {
  const expected = new Original(config), actual = new TetherMotion(config);
  assert.deepEqual(Object.keys(actual), Object.keys(expected), `${label}: field order`);
  assert.deepEqual({ ...actual }, { ...expected }, `${label}: initial state`);
  const released = action(expected), rewritten = action(actual);
  assert.deepEqual(rewritten, released, `${label}: result`);
  assert.deepEqual({ ...actual }, { ...expected }, `${label}: state`);
}

test("tether initializes, advances and resets exactly like release", () => {
  compare("first timestamp returns input reference", motion => {
    const input = [0.4, 0.5, -0.8];
    return motion.update(transform, input, 1000) === input;
  });
  compare("several 16ms frames", motion => {
    motion.update(transform, [0.4, 0.5, -0.8], 1000);
    motion.update(transform, [0.4, 0.5, -0.8], 1016);
    return motion.update(transform, [0.4, 0.5, -0.8], 1032) === motion.output;
  });
  compare("long frame clamped to 50ms", motion => {
    motion.update(transform, [0.4, 0.5, -0.8], 1000);
    return motion.update(transform, [0.4, 0.5, -0.8], 1500);
  });
  compare("time reversal returns input", motion => {
    motion.update(transform, [0.4, 0.5, -0.8], 1000);
    const input = [9, 8, 7];
    return motion.update(transform, input, 999) === input;
  });
  compare("reset returns initial local reference", motion => {
    motion.update(transform, [0.4, 0.5, -0.8], 1000);
    motion.update(transform, [0.4, 0.5, -0.8], 1016);
    return motion.reset() === motion.initialLocal;
  });
});

test("hitch median and stretch force branches match release", () => {
  compare("30-frame median rejects outlier", motion => {
    for (let index = 0; index < 35; index += 1) motion.filterHitch(0.016);
    return motion.filterHitch(0.4);
  });
  compare("inside rest length", motion => {
    motion.world = [0.5, 0, 0];
    motion.substep([0, 0, 0], 0.01);
  });
  compare("wire stretched beyond diameter", motion => {
    motion.world = [8, 2, -4];
    motion.velocity = [1, -2, 0.5];
    motion.substep([0, 0, 0], 0.01);
  });
  compare("zero separation", motion => {
    motion.world = [0, 0, 0];
    motion.substep([0, 0, 0], 0.01);
  });
  compare("direct integration transforms output to local space", motion => {
    motion.world = [13, 4, -5];
    return motion.integrate(transform, 0.035);
  });
});
