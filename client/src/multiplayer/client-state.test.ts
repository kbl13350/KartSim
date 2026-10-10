import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeMultiplayerClientState } from "./client-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class LT {");
const end = release.indexOf("\nconst ml0 =", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

test("multiplayer client instance owners and field order match release", () => {
  const events: string[] = [];
  class Decoder { constructor() { events.push("decoder"); } }
  class Latency { constructor() { events.push("latency"); } }
  class Clock { constructor() { events.push("clock"); } }
  const Original = new Function("d6", "gl0", "L40",
    `${source}\nreturn LT;`)(Decoder, Latency, Clock) as new () =>
      Record<string, unknown>;
  const old = new Original();
  const releaseEvents = events.splice(0);
  const modern: Record<string, unknown> = {};
  initializeMultiplayerClientState(modern, {
    createDecoder: () => new Decoder(),
    createLatencyTracker: () => new Latency(),
    createClock: () => new Clock(),
  });
  assert.deepEqual(events, releaseEvents);
  assert.deepEqual(Object.keys(modern), Object.keys(old));
  assert.deepEqual(modern, Object.assign({}, old));
  for (const name of ["raceLatencies", "motionListeners", "pending",
    "listeners", "closeListeners"]) {
    assert.notEqual(modern[name], old[name], name);
  }
});
