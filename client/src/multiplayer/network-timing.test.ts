import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ClockSynchronizer, MotionRoundTripTracker } from "./network-timing";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function releasedClass<T>(start: string, end: string): new () => T {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first);
  const name = start.slice("class ".length, -2);
  return new Function(`${source.slice(first, last)}; return ${name};`)() as new () => T;
}

test("clock offset validation, bounded samples and capture match release", () => {
  const Original = releasedClass<ClockSynchronizer>("class L40 {", "const Y3 =");
  const run = (clock: ClockSynchronizer) => {
    const result: unknown[] = [];
    result.push(clock.record(-1, 5, 10));
    result.push(clock.record(0, 1, 10_001));
    result.push(clock.record(10, 21, 20));
    result.push(clock.capture(20));
    for (let index = 0; index < 12; index++) {
      result.push(clock.record(100 + index * 10, 120 + index * 10,
        108 + index * 10));
    }
    result.push(clock.capture(220));
    result.push(clock.record(10, 20, 15));
    result.push(clock.capture(Number.NaN));
    result.push(clock.capture(30_221));
    clock.reset();
    result.push(clock.capture(220));
    return result;
  };
  assert.deepEqual(run(new ClockSynchronizer()), run(new Original()));
});

test("motion RTT pending, acknowledgement, failure and report reset match release", () => {
  const Original = releasedClass<MotionRoundTripTracker>("class gl0 {", "class LT {");
  const run = (tracker: MotionRoundTripTracker) => {
    const result: unknown[] = [];
    const snapshot = () => result.push({ milliseconds: tracker.milliseconds,
      sent: tracker.sent, replied: tracker.replied });
    snapshot();
    tracker.begin("a", 100.8); snapshot();
    tracker.reply("wrong", 110); snapshot();
    tracker.reply("a", 99); snapshot();
    tracker.reply("a", 112.5); snapshot();
    tracker.begin("b", 120); snapshot();
    tracker.failed("wrong"); snapshot();
    tracker.failed("b"); snapshot();
    tracker.begin("c", 150); tracker.reply("c", 175); snapshot();
    tracker.reportAndReset(); snapshot();
    tracker.begin("d", 200); tracker.reportAndReset(); snapshot();
    tracker.clear(); snapshot();
    return result;
  };
  assert.deepEqual(run(new MotionRoundTripTracker()), run(new Original()));
});
