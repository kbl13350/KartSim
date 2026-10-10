import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  advanceRacePresenterEvents,
  type RacePresenterAction, type RacePresenterEventsHost,
} from "./race-presenter-events";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Presenter = RacePresenterEventsHost & {
  disposed: boolean;
  size: { x: number; y: number };
  camera: { aspect: number };
  resultVisible: boolean;
  warpCameraFrozen: boolean;
  applyWarpCamera(): void;
  update(renderer: { getDrawingBufferSize(size: { x: number; y: number }): void },
    nowMs: number, actions: RacePresenterAction[]): void;
};

function makeFixture(rewritten: boolean, mode: {
  roadblock?: boolean;
  missingLaps?: boolean;
  racing?: boolean;
  reset?: boolean;
} = {}) {
  const events: unknown[][] = [];
  const Original = new Function("X2", `${originalClass}\nreturn jr0;`)(
    { Racing: "Racing", Countdown: "Countdown" },
  ) as new () => Presenter;
  const presenter = Object.create(Original.prototype) as Presenter;
  presenter.disposed = false;
  presenter.size = { x: 0, y: 0 };
  presenter.camera = { aspect: 0 };
  presenter.resultVisible = false;
  presenter.warpCameraFrozen = true;
  presenter.applyWarpCamera = () => { throw new Error("stop-after-actions"); };
  presenter.race = { roadblock: mode.roadblock ?? false };
  presenter.runtime = {
    local: {
      lifecycle: { state: mode.racing === false ? "Ready" : "Racing" },
      track: { data: { lapTarget: mode.missingLaps ? undefined : 3 } },
      consumeResetSound() { events.push(["reset-sound"]);
        return mode.reset ?? true; },
      consumeLocalRouteTags() { events.push(["route-tags"]); return ["route-a"]; },
    },
    finishDeadline: 5000,
    roadBlockRemaining(nowMs) { events.push(["roadblock-remaining", nowMs]);
      return 3; },
    roadBlockRunnerProgress() { events.push(["runner-progress"]);
      return { lap: 2 }; },
  };
  // The released update reaches the event phase after these early owners.
  Object.assign(presenter, {
    trackInfoCard: undefined,
    banner: undefined,
    showResult() { throw new Error("unexpected result"); },
  });
  presenter.roadblockHud = {
    setRemaining(value) { events.push(["set-remaining", value]); },
    setRunnerLaps(lap, target) { events.push(["set-laps", lap, target]); },
  };
  presenter.finishCountdown = { update(nowMs, deadline) {
    events.push(["finish-countdown", nowMs, deadline]); return true;
  } };
  presenter.countdown = {
    playFinishNumber() { events.push(["finish-number"]); },
    playNumber() { events.push(["count-number"]); },
    playLap() { events.push(["lap-audio"]); },
    playFinalLap() { events.push(["final-lap-audio"]); },
  };
  presenter.cameraShake = { leave(force) { events.push(["shake-leave", force]); } };
  presenter.cameraWave = { leave() { events.push(["wave-leave"]); } };
  presenter.lightFactor = { update() { events.push(["light-update"]); } };
  presenter.linkedPresentations = new Map([["self", {
    setMode(value) { events.push(["linked-mode", value]); },
  }]]);
  presenter.views = new Map([["self", {
    resetAnimation() { events.push(["reset-animation"]); },
  }]]);
  presenter.flyingPet = { launch() { events.push(["pet-launch"]); } };
  presenter.assets = { participants: [{ vehicle: { accessories: [
    { kind: "aura", render: {
      requestDespawn() { events.push(["aura-despawn"]); },
    } },
  ] } }] };
  presenter.cameraMode = "ready";
  presenter.drive = { reset() { events.push(["drive-reset"]); } };
  presenter.surround = { reset() { events.push(["surround-reset"]); } };
  presenter.action2d = {
    scheduleStart(value) { events.push(["start-effect", value]); },
    showLap(value, nowMs) { events.push(["show-lap", value, nowMs]); },
    showFinalLap(nowMs) { events.push(["show-final-lap", nowMs]); },
    showRetire(nowMs) { events.push(["show-retire", nowMs]); },
    showWinner(nowMs) { events.push(["show-winner", nowMs]); },
    showFinish(nowMs) { events.push(["show-finish", nowMs]); },
    showRaceOver(nowMs) { events.push(["show-raceover", nowMs]); },
  };
  presenter.localRetirePending = false;
  presenter.finishBlackBar = { start(nowMs) { events.push(["black-bar", nowMs]); } };
  presenter.bgm = {
    playResult(won) { events.push(["result-bgm", won]); },
    playMultiplayerFinish(won) { events.push(["multi-finish-bgm", won]); },
  };
  presenter.winnerMotion = { acceptLocalFinish(outcome) {
    events.push(["winner-motion", outcome]);
  } };
  presenter.playReset = () => { events.push(["play-reset"]); };
  presenter.handleRouteTag = tag => { events.push(["route-tag", tag]); };
  presenter.applyLocalWarpActions = () => { events.push(["warp-actions"]); };
  presenter.playGoAndHideTrackInfo = () => { events.push(["count-go"]); };
  if (rewritten) {
    presenter.update = (_renderer, nowMs, actions) => {
      advanceRacePresenterEvents(presenter, nowMs, actions,
        { racingState: "Racing" });
    };
  }
  const renderer = { getDrawingBufferSize(size: { x: number; y: number }) {
    size.x = 1280; size.y = 720;
  } };
  return { presenter, renderer, events };
}

function observe(rewritten: boolean, mode: Parameters<typeof makeFixture>[1],
  actions: RacePresenterAction[]) {
  const { presenter, renderer, events } = makeFixture(rewritten, mode);
  let error: string | undefined;
  try { presenter.update(renderer, 1200, actions); }
  catch (failure) { error = (failure as Error).message; }
  const phaseStart = events.findIndex(event =>
    event[0] === "roadblock-remaining" || event[0] === "finish-countdown");
  return { events: events.slice(phaseStart),
    error: error === "stop-after-actions" ? undefined : error,
    cameraMode: presenter.cameraMode,
    localRetirePending: presenter.localRetirePending };
}

test("multiplayer presenter countdown, lap, camera and finish events match release", () => {
  const actions: RacePresenterAction[] = [
    { kind: "countdown", step: 2 }, { kind: "countdown", step: 3 },
    { kind: "count-go" }, { kind: "lap", value: 2 },
    { kind: "final-lap" }, { kind: "switch-drive-camera" },
    { kind: "switch-surround-camera" }, { kind: "start-effect", atMs: 100 },
    { kind: "forced-finish" }, { kind: "natural-finish", outcome: "winner" },
    { kind: "natural-finish", outcome: "loser" }, { kind: "raceover" },
  ];
  for (const mode of [{}, { roadblock: true }, { racing: false, reset: false },
    { roadblock: true, missingLaps: true }]) {
    assert.deepEqual(observe(true, mode, actions),
      observe(false, mode, actions), JSON.stringify(mode));
  }
});
