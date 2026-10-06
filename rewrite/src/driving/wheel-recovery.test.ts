import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  recoverUnconfirmedWheelContacts,
  type WheelRecoveryContext,
  type WheelRecoveryTrack,
} from "./wheel-recovery";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  applySupplementalWheelRecovery(", classStart);
const end = release.indexOf("  enterRailMode(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const method = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function c9("), release.indexOf("function bt(")),
  release.slice(release.indexOf("function L2("), release.indexOf("function ii0(")),
].join("\n");
const OriginalRecovery = new Function("m", `${helpers}
const od=[[1,1],[-1,1],[1,-1],[-1,-1]];
const zC=m(0.800000011920929),x5=m(0.5),j40=m(0.18000000715255737);
return class OriginalRecovery { ${method} };`)(Math.fround) as new () => {
  applySupplementalWheelRecovery(this: WheelRecoveryContext, track: WheelRecoveryTrack): void;
};
const original = new OriginalRecovery();

const vector = (x = 0, y = 0, z = 0) => ({ x, y, z });
function scenario(): WheelRecoveryContext {
  return {
    wheels: { grounded: true, hit: [true, false, false, false] },
    body: {
      position: vector(12.1, -3.25, 8.77),
      right: vector(0.9, 0.1, 0.2),
      forward: vector(-0.15, 0.4, 0.85),
      up: vector(0.2, 0.97, 0.11),
      linearVelocity: vector(4, -1.5, 7),
    },
    collisionShape: { rawHalfWidth: 0.85, rawHalfLength: 1.35 },
    scratch: { v0: vector(), v1: vector(), v2: vector() },
  };
}

function compare(
  label: string,
  hitResults: boolean[],
  edit: (vehicle: WheelRecoveryContext) => void = () => {},
): void {
  const expected = scenario(); edit(expected);
  const actual = scenario(); edit(actual);
  const expectedRays: unknown[] = [];
  const actualRays: unknown[] = [];
  const trackFor = (rays: unknown[]): WheelRecoveryTrack => ({
    rayQuery(origin, direction, includeRoad) {
      rays.push({ origin: { ...origin }, direction: { ...direction }, includeRoad });
      return hitResults[rays.length - 1];
    },
  });
  original.applySupplementalWheelRecovery.call(expected, trackFor(expectedRays));
  recoverUnconfirmedWheelContacts(actual, trackFor(actualRays));
  assert.deepEqual(actual, expected, `${label}: state`);
  assert.deepEqual(actualRays, expectedRays, `${label}: ray queries`);
}

test("missing wheel rays and recovery impulse match the released vehicle", () => {
  compare("three missing wheels all restored", [true, true, true]);
  compare("one failed ray", [true, false, true]);
  compare("two existing contacts", [true, true], vehicle => {
    vehicle.wheels.hit = [true, true, false, false];
  });
  compare("zero existing contacts", [], vehicle => {
    vehicle.wheels.hit = [false, false, false, false];
  });
  compare("all contacts", [], vehicle => { vehicle.wheels.hit = [true, true, true, true]; });
  compare("airborne", [], vehicle => { vehicle.wheels.grounded = false; });
});
