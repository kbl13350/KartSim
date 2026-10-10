import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GhostSmoothSampler,
  type GhostSmoothSamplerDependencies, type SmoothGhostRecord,
} from "./ghost-smooth-sampler";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Yh0 {");
const end = release.indexOf("\nfunction Zh0", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

function makeFixture() {
  const events: unknown[][] = [];
  const dependencies: GhostSmoothSamplerDependencies = {
    sampleNative(record, timeMs) {
      events.push(["native", record.stamps.length, timeMs]);
      return { x: timeMs / 10, y: timeMs / 20, z: -timeMs / 5,
        quaternion: { heading: timeMs } };
    },
    smoothVelocity(tail, head, prior, elapsedMs) {
      events.push(["smooth", tail, head, prior, elapsedMs]);
      return { x: (head.x - tail.x) / elapsedMs,
        y: (head.y - tail.y) / elapsedMs,
        z: (head.z - tail.z) / elapsedMs };
    },
    magnitude(velocity) {
      events.push(["magnitude", velocity]);
      return Math.hypot(velocity.x, velocity.y, velocity.z);
    },
    float32(value) { events.push(["float32", value]); return Math.fround(value); },
    renderBasis(velocity, speed, quaternion) {
      events.push(["basis", velocity, speed, quaternion]);
      return { direction: velocity.x, speed, quaternion };
    },
  };
  const Original = new Function("FD", "Zh0", "fd0", "L9", "Qh0",
    `${originalClass}\nreturn Yh0;`)(
      dependencies.sampleNative, dependencies.smoothVelocity,
      dependencies.magnitude, dependencies.float32,
      dependencies.renderBasis,
    ) as new (record: SmoothGhostRecord) => GhostSmoothSampler;
  return { Original, dependencies, events };
}

test("smooth Ghost sampler rejects empty recordings like release", () => {
  const inspect = (rewritten: boolean) => {
    const { Original, dependencies } = makeFixture();
    try {
      if (rewritten) new GhostSmoothSampler({ stamps: [] }, dependencies);
      else new Original({ stamps: [] });
      return "accepted";
    } catch (error) { return (error as Error).message; }
  };
  assert.equal(inspect(true), inspect(false));
});

test("smooth Ghost velocity, clock reversal and display basis match release", () => {
  const inspect = (rewritten: boolean) => {
    const { Original, dependencies, events } = makeFixture();
    const record = { stamps: [0, 1, 2] };
    const sampler = rewritten
      ? new GhostSmoothSampler(record, dependencies) : new Original(record);
    const outputs = [100, 200, 200, 150, 275].map(time => sampler.sample(time));
    return { outputs, events, head: sampler.head, tail: sampler.tail,
      velocity: sampler.velocity, lastTimeMs: sampler.lastTimeMs };
  };
  assert.deepEqual(inspect(true), inspect(false));
});
