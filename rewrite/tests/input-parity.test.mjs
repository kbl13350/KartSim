import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { DrivingInputAccumulator } from "../src/input/driving-input.ts";

const source = readFileSync(
  fileURLToPath(new URL("../../recovered/formatted/index.js", import.meta.url)),
  "utf8",
);
const start = source.indexOf("const l2 = {");
const end = source.indexOf('const vm = "178"', start);
assert.ok(start >= 0 && end > start, "released input implementation was not found");
const context = {};
runInNewContext(`${source.slice(start, end)}\nglobalThis.ReferenceInput = sG;`, context);

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test("readable input accumulator stays equivalent to the released implementation", () => {
  const actual = new DrivingInputAccumulator();
  const reference = new context.ReferenceInput();
  const actions = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 25, 26];
  let seed = 0x61e5e6cd;
  function next() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return seed >>> 0;
  }

  for (let index = 0; index < 500; index += 1) {
    if (index % 37 === 0) {
      const forwardSwap = Boolean(next() & 1);
      const steerInvert = Boolean(next() & 1);
      const batchGate = Boolean(next() & 1);
      for (const input of [actual, reference]) {
        input.setForwardReverseSwap(forwardSwap);
        input.setSteeringInverted(steerInvert);
        input.setForwardBatchGate(batchGate);
      }
    }
    if (index % 83 === 0) {
      actual.cancel();
      reference.cancel();
    }

    const event = { action: actions[next() % actions.length], down: Boolean(next() & 1) };
    const actualEffects = [];
    const referenceEffects = [];
    assert.equal(
      actual.dispatch([event], (effect) => actualEffects.push(effect)),
      reference.dispatch([event], (effect) => referenceEffects.push(effect)),
      `consumed count at event ${index}`,
    );
    assert.deepEqual(plain(actualEffects), plain(referenceEffects), `effects at event ${index}`);
    assert.deepEqual(plain(actual.snapshot()), plain(reference.snapshot()), `snapshot at event ${index}`);
    assert.deepEqual(
      plain(actual.getDriftEdgeMetadata()),
      plain(reference.getDriftEdgeMetadata()),
      `drift metadata at event ${index}`,
    );
    assert.deepEqual(
      plain(actual.getForwardBatchState()),
      plain(reference.getForwardBatchState()),
      `batch state at event ${index}`,
    );
  }
});
