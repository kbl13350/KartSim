import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { updateRacePresenterCamera, type RacePresenterCameraHost } from "./race-presenter-camera";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const Original = new Function("X2", `${release.slice(start, end)}\nreturn jr0;`)(
  { Racing: "Racing", Countdown: "Countdown" },
) as new () => { update(renderer: unknown, nowMs: number, actions: unknown[]): void };

interface Scenario {
  mode: "frozen" | "ready" | "surround" | "drive";
  giant?: "near" | "far" | "not-racing" | "finished";
  warpFactor?: number;
  far?: number;
}

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const presenter = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const body = { position: { x: 10, y: 20, z: 30 }, marker: "kart" };
  const physics = {
    body,
    giant: scenario.giant ? { main: 2 } : undefined,
    driveCameraRuntime() {
      events.push(["camera-runtime"]);
      return { eventScaleSecondary: { z: 1.25 }, wheel: 7 };
    },
  };
  Object.assign(presenter, {
    disposed: false,
    size: { x: 0, y: 0 },
    camera: { aspect: 0 },
    resultVisible: false,
    warpCameraFrozen: scenario.mode === "frozen",
    cameraMode: scenario.mode === "frozen" ? "drive" : scenario.mode,
    race: { roadblock: false },
    playerId: "self",
    clearGiant() { events.push(["clear-giant"]); },
    applyWarpCamera() { events.push(["warp-camera"]); },
    finishCountdown: { update() { return false; } },
    applyLocalWarpActions() {},
    lightFactor: { update() {} },
    assets: {
      participants: [{ playerId: "remote" }],
      map: {
        readyCamera: { apply(_camera: unknown, nowMs: number, kart: unknown) {
          events.push(["ready", nowMs, kart]);
        } },
        stageBinding: { beginFrame() { throw new Error("stop-after-camera"); } },
      },
    },
    runtime: {
      giantEffectsEnded: scenario.giant === "finished",
      local: {
        physics,
        lifecycle: { state: scenario.giant === "not-racing" ? "Ready" : "Racing" },
        track: {
          cameraFar: scenario.far,
          currentRouteSurface() { events.push(["route-surface"]); return "road"; },
        },
        warpNext: { fairyFovFactor() { events.push(["warp-factor"]);
          return scenario.warpFactor; } },
        consumeResetSound() { return false; },
        consumeLocalRouteTags() { return []; },
      },
      remotes: {
        giant(id: unknown) { events.push(["giant", id]); return { main: 4 }; },
        copyWebPose(id: unknown) { events.push(["pose", id]);
          return { position: scenario.giant === "far"
            ? { x: 50, y: 20, z: 30 }
            : { x: 12, y: 20, z: 30 } }; },
      },
    },
    cameraShake: {
      setGiantGate(value: unknown) { events.push(["giant-gate", value]); },
      update(nowMs: number, surface: unknown) { events.push(["shake", nowMs, surface]);
        return { x: 0.1, y: -0.2, z: 0.3 }; },
    },
    giantPresentation: { setThreatSound(value: boolean) {
      events.push(["threat-sound", value]);
    } },
    cameraWave: { update(nowMs: number, surface: unknown, kart: unknown,
      position: unknown) { events.push(["wave", nowMs, surface, kart, position]); } },
    drive: {
      update(input: unknown) { events.push(["drive-update", input]);
        return { horizontalFovDegrees: 80, far: 900, projection: "drive" }; },
      apply(_camera: unknown, view: unknown) { events.push(["drive-apply", view]); },
    },
    surround: {
      update(nowMs: number, kart: unknown, scale: unknown) {
        events.push(["surround-update", nowMs, kart, scale]); return { angle: 40 };
      },
      apply(_camera: unknown, view: unknown) { events.push(["surround-apply", view]); },
    },
  });
  const renderer = { getDrawingBufferSize(size: { x: number; y: number }) {
    size.x = 1280; size.y = 720;
  } };
  let error: string | undefined;
  try {
    if (rewritten) {
      updateRacePresenterCamera(presenter as unknown as RacePresenterCameraHost,
        1200, "Racing");
    } else {
      presenter.update(renderer, 1200, []);
    }
  } catch (failure) {
    error = (failure as Error).message;
  }
  return { events: events.filter(event => event[0] !== "clear-giant"),
    error: error === "stop-after-camera" ? undefined : error };
}

test("multiplayer presenter frozen, ready, surround and drive camera behavior matches release", () => {
  const scenarios: Scenario[] = [
    { mode: "frozen" },
    { mode: "ready" },
    { mode: "surround" },
    { mode: "drive" },
    { mode: "drive", giant: "near", warpFactor: 0.5, far: 1500 },
    { mode: "drive", giant: "far", warpFactor: 1.2 },
    { mode: "drive", giant: "not-racing" },
    { mode: "drive", giant: "finished" },
  ];
  for (const scenario of scenarios) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario),
      JSON.stringify(scenario));
  }
});
