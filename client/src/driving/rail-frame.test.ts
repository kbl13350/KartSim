import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  produceVehicleRailFrame,
  type RailFrameContext,
  type RailFrameSample,
  type RailFrameTrack,
} from "./rail-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class AL {");
const start = release.indexOf("  produceRailFrame(", classStart);
const end = release.indexOf("  applyFull3DRail(", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const methods = release.slice(start, end);
const helpers = [
  release.slice(release.indexOf("function O9("), release.indexOf("function ai0(")),
  release.slice(release.indexOf("function ML("), release.indexOf("function xL(")),
  release.slice(release.indexOf("function JC("), release.indexOf("function vi(")),
].join("\n");
const Original = new Function("m", `${helpers}\nreturn class Original { ${methods} };`)(Math.fround) as new () => {
  produceRailFrame(this: RailFrameContext, seconds: number, track: RailFrameTrack): boolean;
};
const original = new Original();
const vector = (x: number, y: number, z: number) => ({ x, y, z });

type Scenario = RailFrameContext & { calls: string[] };
function scenario(): Scenario {
  const calls: string[] = [];
  return {
    calls,
    body: { position: vector(1.1, 0.4, -3.2) },
    runtime: { railBadGeometryTimer: 0.1, railResetRequest: false },
    requestMotionMode(lift, mode) { calls.push(`mode:${lift}/${mode}`); },
  };
}

type Options = {
  sample?: Partial<RailFrameSample>;
  noProjection?: boolean;
  noSampler?: boolean;
};
function trackFor(vehicle: Scenario, options: Options): RailFrameTrack {
  const sample: RailFrameSample = {
    sampled: true,
    point: vector(1.8, 0.9, -1.7),
    direction: vector(0.2, 0.1, 0.97),
    up: vector(0.03, 0.99, -0.08),
    surface: "rail-main",
    ...options.sample,
  };
  const track: RailFrameTrack = {};
  if (!options.noProjection) track.refreshRouteProjection = (_vehicle, position) => {
    vehicle.calls.push(`project:${position.x}`);
  };
  if (!options.noSampler) track.sampleRoute = (_vehicle, ahead, lane) => {
    vehicle.calls.push(`sample:${ahead}/${lane}`);
    return sample;
  };
  return track;
}

function compare(label: string, options: Options = {}, edit: (state: Scenario) => void = () => {}): void {
  const expected = scenario(), actual = scenario();
  edit(expected); edit(actual);
  const releasedTrack = trackFor(expected, options);
  const migratedTrack = trackFor(actual, options);
  let expectedResult: boolean | undefined, actualResult: boolean | undefined;
  let expectedError: unknown, actualError: unknown;
  try { expectedResult = original.produceRailFrame.call(expected, 0.016, releasedTrack); }
  catch (error) { expectedError = error; }
  try { actualResult = produceVehicleRailFrame(actual, 0.016, migratedTrack); }
  catch (error) { actualError = error; }
  assert.equal(actualResult, expectedResult, `${label}: result`);
  assert.equal((actualError as Error | undefined)?.message, (expectedError as Error | undefined)?.message,
    `${label}: error`);
  assert.deepEqual(actual.runtime, expected.runtime, `${label}: runtime`);
  assert.deepEqual(actual.body, expected.body, `${label}: body`);
  assert.deepEqual(actual.calls, expected.calls, `${label}: calls`);
}

test("valid rail frame matches release projection, orientation and rounding", () => {
  compare("skewed frame");
  compare("existing frame replaced", {}, state => {
    state.runtime.railFrame = [vector(1, 0, 0), vector(0, 1, 0), vector(0, 0, 1)];
  });
});

test("missing route services and missing adjacent frame match release failures", () => {
  compare("no projector", { noProjection: true });
  compare("no sampler", { noSampler: true });
  compare("unsampled", { sample: { sampled: false } });
});

test("leaving rail and bad geometry preserve transition order and reset timer", () => {
  compare("ordinary road", { sample: { surface: "road" } });
  compare("near rail", { sample: { point: vector(1.12, 0.41, -3.19) } });
  compare("direction reversed", { sample: { direction: vector(-0.2, -0.1, -0.97) } });
  compare("bad geometry timeout", { sample: { point: vector(1.12, 0.41, -3.19) } },
    state => { state.runtime.railBadGeometryTimer = 0.49; });
});
