import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  countVehicleResultCrash,
  makeSecondaryCollisionBox,
  resolveVehicleTrackEvents,
  updateVehicleCollisionGaugeOwners,
  type CollisionEventContext,
  type CollisionEventTrack,
  type TrackCollisionEvent,
} from "./collision-events";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const methods = [
  method("countOrdinaryResultCrash", "resolveStaticObstacles"),
  method("resolveTrackEvents", "secondaryCollisionBox"),
  method("secondaryCollisionBox", "updateCollisionGaugeOwners"),
  method("updateCollisionGaugeOwners", "updatePrimaryAutomaticResetTimers"),
].join("\n");
const helpers = release.slice(release.indexOf("function KC("), release.indexOf("function ii0("));
const Original = new Function("m", `${helpers}\nreturn class Original { ${methods} };`)(Math.fround) as new () => {
  countOrdinaryResultCrash(this: CollisionEventContext): void;
  resolveTrackEvents(this: CollisionEventContext, track: CollisionEventTrack): void;
  secondaryCollisionBox(this: CollisionEventContext): ReturnType<CollisionEventContext["secondaryCollisionBox"]>;
  updateCollisionGaugeOwners(this: CollisionEventContext, contactHit: boolean): void;
};
const original = new Original();
const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
type Scenario = CollisionEventContext & {
  calls: string[];
  scaleAllowed: boolean;
  gravityAllowed: boolean;
};
function scenario(released: boolean): Scenario {
  const calls: string[] = [];
  return {
    calls,
    scaleAllowed: true,
    gravityAllowed: true,
    body: {
      position: vector(2.3, 0.5, -8.1),
      right: vector(1, 0, 0), forward: vector(0, 0, 1), up: vector(0.02, 0.99, 0.01),
    },
    collisionShape: {
      rawHeight: 0.58, rawHalfWidth: 0.43, rawHalfLength: 0.9, scaleX: 1.2, scaleY: 0.8,
    },
    scratch: {
      v0: vector(),
      obb: { center: vector(), axes: [vector(), vector(), vector()], halfExtents: [0, 0, 0] },
    },
    runtime: {
      currentUpdateMs: 3400.9,
      raceMotionLocked: false,
      resultCrashAnchorMs: 4294967295,
      resultCrashCount: 2,
      collisionMotionHit: false,
    },
    trackEventEffectRequests: [],
    secondaryCollisionBox() {
      calls.push("box");
      return released ? original.secondaryCollisionBox.call(this) : makeSecondaryCollisionBox(this);
    },
    triggerEventScale(percent) { calls.push(`scale:${percent}`); return this.scaleAllowed; },
    triggerEventGravity(gravity) { calls.push(`gravity:${gravity}`); return this.gravityAllowed; },
    beginWallCollision() { calls.push("wall"); },
    beginInstantWallCharge(now) { calls.push(`instant:${now}`); },
  };
}

function snapshot(state: Scenario): unknown {
  return { calls: state.calls, body: state.body, scratch: state.scratch,
    runtime: state.runtime, effects: state.trackEventEffectRequests };
}

function compare(
  label: string,
  releasedCall: (state: Scenario) => unknown,
  migratedCall: (state: Scenario) => unknown,
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(true), actual = scenario(false);
  edit(expected); edit(actual);
  let expectedResult: unknown, actualResult: unknown;
  let expectedError: unknown, actualError: unknown;
  try { expectedResult = releasedCall(expected); } catch (error) { expectedError = error; }
  try { actualResult = migratedCall(actual); } catch (error) { actualError = error; }
  assert.equal((actualError as Error | undefined)?.message, (expectedError as Error | undefined)?.message,
    `${label}: error`);
  assert.deepEqual(actualResult, expectedResult, `${label}: result`);
  assert.deepEqual(snapshot(actual), snapshot(expected), `${label}: state`);
}

test("result crash cooldown and unsigned clock arithmetic match release", () => {
  const check = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.countOrdinaryResultCrash.call(state), countVehicleResultCrash, edit);
  check("first crash");
  check("inside cooldown", state => { state.runtime.resultCrashAnchorMs = 3000; });
  check("cooldown elapsed", state => { state.runtime.resultCrashAnchorMs = 1000; });
  check("locked", state => { state.runtime.raceMotionLocked = true; });
  check("unsigned wrap", state => {
    state.runtime.currentUpdateMs = 200;
    state.runtime.resultCrashAnchorMs = 0xffff_ff00;
  });
});

test("secondary collision box copies shape, axis references and float32 center", () => {
  compare("box", state => original.secondaryCollisionBox.call(state), makeSecondaryCollisionBox);
  const actual = scenario(false);
  const box = makeSecondaryCollisionBox(actual);
  assert.strictEqual(box, actual.scratch.obb);
  assert.strictEqual(box.axes[0], actual.body.right);
  assert.strictEqual(box.axes[1], actual.body.forward);
  assert.strictEqual(box.axes[2], actual.body.up);
});

test("track event dispatch and event rejection match release", () => {
  function dispatch(state: Scenario, events: TrackCollisionEvent[] | undefined, released: boolean): void {
    const track: CollisionEventTrack = {};
    if (events) track.queryEventObb = (box, now) => {
      state.calls.push(`query:${box.center.y}/${now}`);
      return events;
    };
    if (released) original.resolveTrackEvents.call(state, track);
    else resolveVehicleTrackEvents(state, track);
  }
  const check = (label: string, events: TrackCollisionEvent[] | undefined,
    edit: (state: Scenario) => void = () => {}) => compare(label,
      state => dispatch(state, events, true), state => dispatch(state, events, false), edit);
  check("query missing", undefined);
  check("scale gravity effect", [
    { scalePercent: 90, gravity: 4.5, effect: "spark" }, { effect: "jump" }, {},
  ]);
  check("scale rejected", [{ scalePercent: 95, effect: "spark" }],
    state => { state.scaleAllowed = false; });
  check("gravity rejected", [{ gravity: 8, effect: "spark" }],
    state => { state.gravityAllowed = false; });
});

test("collision gauge owner starts both charge windows only on hit", () => {
  const check = (label: string, hit: boolean, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.updateCollisionGaugeOwners.call(state, hit),
      state => updateVehicleCollisionGaugeOwners(state, hit), edit);
  check("idle", false);
  check("explicit hit", true);
  check("motion hit", false, state => { state.runtime.collisionMotionHit = true; });
});
