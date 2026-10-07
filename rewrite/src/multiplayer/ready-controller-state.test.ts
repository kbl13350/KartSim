import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { initializeReadyControllerState } from "./ready-controller-state";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class ql0 {");
const end = release.indexOf("\nfunction xl(", start);
assert.ok(start >= 0 && end > start);
const source = release.slice(start, end);

test("Ready controller initial ownership and random selection session match release", () => {
  const events: string[] = [];
  class RandomTrackSession { constructor() { events.push("session"); } }
  const Original = new Function("Tc0", `${source}\nreturn ql0;`)(
    RandomTrackSession) as new (application: unknown) => Record<string, unknown>;
  const application = { profile: "rider" };
  const old = new Original(application);
  const releaseEvents = events.splice(0);
  const modern: Record<string, unknown> = {};
  initializeReadyControllerState(modern, application,
    () => new RandomTrackSession());
  assert.deepEqual(events, releaseEvents);
  assert.deepEqual(Object.keys(modern), Object.keys(old));
  assert.deepEqual(modern, Object.assign({}, old));
  assert.equal(modern.host, application);
  assert.notEqual(modern.randomTrackSession, old.randomTrackSession);
});
