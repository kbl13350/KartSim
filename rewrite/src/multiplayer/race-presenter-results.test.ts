import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { showRacePresenterResults,
  type RacePresenterResultsHost } from "./race-presenter-results";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Scenario = "podium" | "roadblock" | "missing-results" |
  "missing-roadblock" | "missing-award";

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const parts = (vehicle: unknown) => [{ removeFromParent() {
    events.push(["remove-part", (vehicle as { name: string }).name]);
  } }];
  const winners = (mode: string, _roster: unknown, results: unknown[],
    team: unknown) => { events.push(["winners", mode, results.length, team]);
    return ["remote"]; };
  class VehicleView {
    constructor(_scene: unknown) { events.push(["create-view"]); }
    setModel(...args: unknown[]) { events.push(["set-model", args[0], args[1],
      Boolean(args[2]), args[3], args[4]]); }
    resetAnimation() { events.push(["remote-reset-animation"]); }
  }
  const Original = new Function("lc", "rG", "Vg",
    `${originalClass}\nreturn jr0;`)(parts, winners, VehicleView) as
    new () => { showResult(nowMs: number): void };
  const host = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const results = [{ playerId: "local", elapsedMs: 1200 },
    { playerId: "remote", elapsedMs: 1400 }];
  const snapshot = {
    roadblock: scenario === "roadblock" || scenario === "missing-roadblock"
      ? { runnerId: "local" } : undefined,
    roadblockOutcome: { runnerWon: true },
    roster: ["local", "remote"],
    winningTeam: "red",
  };
  function participant(name: string) {
    return {
      playerId: name,
      draftEffect: { reset(nowMs: number) {
        events.push(["draft-reset", name, nowMs]);
      } },
      vehicle: {
        name,
        imported: {
          object: `${name}-object`, model: `${name}-model`,
          scene: `${name}-scene`,
          animation: { reset(nowMs: number) {
            events.push(["animation-reset", name, nowMs]);
          } },
        },
        visual: `${name}-visual`,
        effects: { setState(boost: number, drift: number,
          active: boolean, collision: boolean, nowMs: number) {
          events.push(["effects-reset", name, boost, drift,
            active, collision, nowMs]);
        } },
        lampFlares: { resetInputVisibility() {
          events.push(["lamp-reset", name]);
        } },
        audio: { stopRace() { events.push(["stop-audio", name]); } },
      },
    };
  }
  const roadblockResult = {
    root: "roadblock-root", effectRoot: "roadblock-effect",
    show(_nowMs: number, _local: unknown, _assets: unknown,
      views: Map<unknown, unknown>) {
      events.push(["show-roadblock", [...views.keys()]]);
    },
  };
  const award = {
    root: "award-root", effectRoot: "award-effect",
    show(_nowMs: number, _local: unknown, _results: unknown,
      views: Map<unknown, unknown>) {
      events.push(["show-award", [...views.keys()]]);
    },
  };
  Object.assign(host, {
    playerId: "local",
    cameraShake: { leave(value: boolean) { events.push(["shake-leave", value]); } },
    cameraWave: { leave() { events.push(["wave-leave"]); } },
    scene: { add(...objects: unknown[]) { events.push(["scene-add", ...objects]); } },
    runtime: {
      local: { name: "local" },
      resultSnapshot() { events.push(["result-snapshot"]);
        return scenario === "missing-results" ? undefined : results; },
      raceSnapshot() { events.push(["race-snapshot"]); return snapshot; },
    },
    assets: {
      mode: "team",
      participants: [participant("local"), participant("remote")],
      draftAudio: { reset() { events.push(["draft-audio-reset"]); } },
    },
    views: new Map([["local", { resetAnimation() {
      events.push(["local-reset-animation"]);
    } }]]),
    linkedPresentations: new Map([["local", { setMode(mode: number) {
      events.push(["local-linked-mode", mode]);
    } }], ["remote", { setMode(mode: number) {
      events.push(["remote-linked-mode", mode]);
    } }]]),
    roadblockHud: { hide() { events.push(["hide-roadblock-hud"]); } },
    roadblockResult: scenario === "missing-roadblock" ? undefined : roadblockResult,
    award: scenario === "missing-award" ? undefined : award,
    resultView: { show(_results: unknown, nowMs: number) {
      events.push(["show-result-view", nowMs]);
    } },
    bgm: {
      playResult(won: boolean) { events.push(["result-bgm", won]); },
      playMultiplayerPodium() { events.push(["podium-bgm"]); },
    },
    roadblockFlag: { dispose() { events.push(["roadblock-flag-dispose"]); } },
    flyingPet: { dispose() { events.push(["pet-dispose"]); } },
    trackEventEffects: { dispose() { events.push(["effect-dispose"]); } },
    trackEventAudio: { dispose() { events.push(["event-audio-dispose"]); } },
    trackDummyAudio: { dispose() { events.push(["dummy-audio-dispose"]); } },
    warpCameraFrozen: true,
    warpHudHidden: true,
    resultVisible: false,
    clearGiant() { events.push(["clear-giant"]); },
    releaseShadowPresentations() { events.push(["release-shadows"]); },
  });
  let error: string | undefined;
  try {
    if (rewritten) showRacePresenterResults(host as unknown as RacePresenterResultsHost,
      1200, { vehicleParts: parts, winningPlayers: winners,
        createVehicleView: scene => new VehicleView(scene) });
    else host.showResult(1200);
  } catch (failure) { error = (failure as Error).message; }
  const state = host as unknown as RacePresenterResultsHost;
  return { events, error, resultVisible: state.resultVisible,
    warpCameraFrozen: state.warpCameraFrozen,
    warpHudHidden: state.warpHudHidden,
    roadblockFlag: state.roadblockFlag,
    flyingPet: state.flyingPet,
    trackEventEffects: state.trackEventEffects,
    trackEventAudio: state.trackEventAudio,
    trackDummyAudio: state.trackDummyAudio,
    viewIds: [...state.views.keys()] };
}

test("multiplayer podium and roadblock result transitions match release", () => {
  for (const scenario of ["podium", "roadblock", "missing-results",
    "missing-roadblock", "missing-award"] as const) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario), scenario);
  }
});
