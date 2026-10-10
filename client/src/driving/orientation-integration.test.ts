import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  integrateVehicleRailOrientation,
  integrateVehicleRoadOrientation,
  type OrientationIntegrationContext,
} from "./orientation-integration";
import type { RailMatrix } from "./rail-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
function method(name: string, next: string): string {
  const start = release.indexOf(`  ${name}(`, classStart);
  const end = release.indexOf(`  ${next}(`, start);
  assert.ok(classStart > 0 && start > classStart && end > start);
  return release.slice(start, end);
}
const helpers = [
  release.slice(release.indexOf("function ti0("), release.indexOf("function ni0(")),
  release.slice(release.indexOf("function KC("), release.indexOf("function dd(")),
  release.slice(release.indexOf("function bL("), release.indexOf("function F4(")),
].join("\n");
const Original = new Function("m", `${helpers}\nreturn class Original {
${method("integrateFull3D", "applySuspension")}
${method("integrateStandardOrientation", "setRoadActionState")}
};`)(Math.fround) as new () => {
  integrateFull3D(this: OrientationIntegrationContext, seconds: number): void;
  integrateStandardOrientation(this: OrientationIntegrationContext, seconds: number): void;
};
const original = new Original();
const vector = (x: number, y: number, z: number) => ({ x, y, z });
const identity = (): RailMatrix => [vector(1, 0, 0), vector(0, 1, 0), vector(0, 0, 1)];
type Scenario = OrientationIntegrationContext & { visualMode: number; calls: string[] };
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    visualMode: 0,
    calls,
    body: {
      position: vector(3.2, 0.51, -14.3),
      linearVelocity: vector(19.3, 0.44, -2.19),
      angularVelocity: vector(0.12, 0.3, -0.09),
      right: vector(1, 0, 0),
      forward: vector(0, 0, 1),
      up: vector(0, 1, 0),
    },
    runtime: {
      motionMode: 0,
      railFrame: identity(),
      railRelativeOrientation: identity(),
      freeOrientationLatch: false,
    },
    visualScaleMode() { calls.push("visualMode"); return this.visualMode; },
  };
}

function compare(
  label: string,
  releasedCall: (state: Scenario) => void,
  migratedCall: (state: Scenario) => void,
  edit: (state: Scenario) => void = () => {},
): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  let expectedError: unknown, actualError: unknown;
  try { releasedCall(expected); } catch (error) { expectedError = error; }
  try { migratedCall(actual); } catch (error) { actualError = error; }
  assert.equal((actualError as Error | undefined)?.message, (expectedError as Error | undefined)?.message,
    `${label}: error`);
  assert.deepEqual(actual.body, expected.body, `${label}: body`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("captured and entry rail orientation match release integration", () => {
  const rail = (label: string, edit: (state: Scenario) => void) =>
    compare(label, state => original.integrateFull3D.call(state, 0.016),
      state => integrateVehicleRailOrientation(state, 0.016), edit);
  rail("captured rail", state => { state.runtime.motionMode = 3; });
  rail("rail entry", state => { state.runtime.motionMode = 2; });
  rail("tilted rail", state => {
    state.runtime.motionMode = 3;
    state.runtime.railFrame = [vector(0.8, 0.1, 0.4), vector(0, 0.9, -0.2), vector(-0.3, 0.2, 0.9)];
  });
  rail("missing frame", state => { state.runtime.railFrame = undefined; });
});

test("road orientation follows free, protected and rollover branches", () => {
  const road = (label: string, edit: (state: Scenario) => void = () => {}) =>
    compare(label, state => original.integrateStandardOrientation.call(state, 0.016),
      state => integrateVehicleRoadOrientation(state, 0.016), edit);
  road("ordinary");
  road("scale squashed", state => { state.visualMode = 1; });
  road("free orientation", state => {
    state.runtime.freeOrientationLatch = true;
    state.body.up = vector(0, -1, 0);
  });
  road("return mode", state => { state.runtime.motionMode = 6; });
  road("rollover damping", state => {
    state.body.up = vector(0, -1, 0);
    state.body.right = vector(-1, 0, 0);
    state.body.angularVelocity = vector(2.2, 0.4, -1.7);
  });
});
