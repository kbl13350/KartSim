import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { updateRacePresenterEffects, type RacePresenterEffectsHost } from "./race-presenter-effects";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class jr0 {");
const start = release.indexOf("    const h = o.consumeTrackEventEffectRequests();", classStart);
const end = release.indexOf("    const d = _r0(", start);
assert.ok(classStart >= 0 && start > classStart && end > start);
const originalEffects = new Function("o", "a", "t", "r", "s",
  release.slice(start, end));

interface Scenario {
  requests?: boolean;
  manager?: boolean;
  shadow?: boolean;
  sparse?: boolean;
}

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const camera = { name: "camera" };
  const physics = {
    body: { position: { x: 1, y: 2, z: 3 } },
    consumeTrackEventEffectRequests() {
      events.push(["consume-requests"]);
      return scenario.requests === false ? []
        : [{ effect: "spark", atMs: 1100 }, { effect: "dust", atMs: 1190 }];
    },
    giantSourceProtected() { events.push(["giant-source"]); return true; },
  };
  const track = { consumeExpiredEventEffects() {
    events.push(["consume-expired"]); return ["old-spark"];
  } };
  const host = {
    camera,
    assets: { drivingMode: scenario.shadow ? { kind: "shadow" } : { kind: "item" } },
    runtime: { local: { physics, track } },
    roadblockFlag: scenario.sparse ? undefined : { update(nowMs: number) {
      events.push(["roadblock", nowMs]);
    } },
    giantPresentation: scenario.sparse ? undefined : {
      update(nowMs: number, _camera: unknown, width: number, height: number,
        protectedSource: boolean) {
        events.push(["giant", nowMs, width, height, protectedSource]);
      },
    },
    shadowPresentations: new Map([["a", { update() { events.push(["shadow-a"]); } }],
      ["b", { update() { events.push(["shadow-b"]); } }]]),
    trackEventEffects: scenario.manager === false ? undefined : {
      trigger(effect: unknown, atMs: number) {
        events.push(["trigger", effect, atMs]);
      },
      remove(effect: unknown) { events.push(["remove", effect]); },
      update(nowMs: number) { events.push(["effects", nowMs]); },
    },
    flyingPet: scenario.sparse ? undefined : {
      update(nowMs: number, _camera: unknown, width: number, height: number,
        visible: boolean) {
        events.push(["pet", nowMs, width, height, visible]);
      },
    },
    trackEventAudio: scenario.sparse ? undefined : {
      update(nowMs: number, position: unknown) {
        events.push(["event-audio", nowMs, position]);
      },
    },
    trackDummyAudio: scenario.sparse ? undefined : {
      update(activeCamera: unknown) { events.push(["dummy-audio", activeCamera]); },
    },
    petVisible() { events.push(["pet-visible"]); return false; },
    captureRankProgress() { events.push(["rank-progress"]); },
  };
  let error: string | undefined;
  try {
    if (rewritten) updateRacePresenterEffects(
      host as unknown as RacePresenterEffectsHost, 1200, 1280, 720);
    else originalEffects.call(host, physics, track, 1200, 1280, 720);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error };
}

test("multiplayer track effects, weather and missing owner match release", () => {
  for (const scenario of [{}, { requests: false }, { manager: false },
    { requests: false, manager: false, sparse: true },
    { shadow: true }]) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario),
      JSON.stringify(scenario));
  }
});
