import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { TrackEventOwner } from "../src/vehicle/track-event-owner.ts";
import { EventCollisionLatch } from "../src/vehicle/event-collision-latch.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const klass = parse(source, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "Kn0");
assert.ok(klass);
const originalText = source.slice(klass.start, klass.end);

function newAnimator(log) {
  return {
    shouldThrottle(now, position) {
      log.push(["throttle", now, position]);
      return now === 45;
    },
    update(now, transform) { log.push(["update", now, transform]); },
    isInsideRegistrationRadius(position) {
      log.push(["inside", position]);
      return position.x > 0;
    },
    firstOverlap(hitbox) {
      log.push(["overlap", hitbox]);
      return hitbox.hit;
    },
    reset() { log.push(["reset"]); },
  };
}

function exercise(Owner, initial, effect) {
  const projection = {
    renderRoot: { id: "scene" }, rearmAnchorInitial: initial,
    effect, scalePercent: 180, gravity: -3, sound: "hit",
  };
  const owner = new Owner(projection);
  const timeline = [];
  const record = (operation, output) => timeline.push({
    operation, output, armed: owner.state.armed,
    anchor: owner.state.rearmAnchor,
    residue: owner.state.unresolvedResidueSince,
    position: owner.cachedKartPosition,
    effectTimes: [...owner.effectTimesMs],
  });
  record("register", owner.registerKartPair({ x: 2 }));
  record("miss", owner.firstOverlap({ hit: false }, 10));
  record("hit", owner.firstOverlap({ hit: true }, 20));
  record("second hit", owner.firstOverlap({ hit: true }, 25));
  for (const time of [40, 45, 3041, 3042, 6043])
    record(`tick ${time}`, owner.slot12(time, { frame: time }));
  record("rearmed hit", owner.firstOverlap({ hit: true }, 6044));
  record("expire early", owner.expireEffects(6045));
  record("expire late", owner.expireEffects(10000));
  owner.reset();
  record("reset", undefined);
  record("post-reset hit", owner.firstOverlap({ hit: true }, 10001));
  return { timeline, calls: owner.testLog };
}

test("moving event owner collision, cooldown, throttling and reset match release", () => {
  for (const initial of [0, 100, "uninitialized-target-heap"])
    for (const effect of [undefined, { id: "spark", tickMs: 50 }]) {
      let currentLog;
      const Original = new Function("EC", "qn0", "xg",
        `${originalText}\nreturn Kn0;`)(EventCollisionLatch,
        class { constructor() { return newAnimator(currentLog); } },
        position => ({ ...position }));
      const OriginalFactory = class extends Original {
        constructor(projection) { currentLog = []; super(projection); this.testLog = currentLog; }
      };
      const rewritten = class extends TrackEventOwner {
        constructor(projection) {
          const log = [];
          super(projection, {
            createAnimator: () => newAnimator(log),
            copyPosition: position => ({ ...position }),
          });
          this.testLog = log;
        }
      };
      const before = exercise(OriginalFactory, initial, effect);
      const after = exercise(rewritten, initial, effect);
      assert.deepEqual(after, before, `${initial}/${effect?.id}`);
    }
});
