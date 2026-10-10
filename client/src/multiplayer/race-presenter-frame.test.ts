import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { updateRacePresenterFrame,
  type RacePresenterFrameDependencies, type RacePresenterFrameHost } from "./race-presenter-frame";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

function observe(rewritten: boolean, mode: "live" | "result" | "disposed") {
  const events: unknown[][] = [];
  const rankByProgress = () => { events.push(["rank-by-progress"]); return undefined; };
  const rankFallback = () => { events.push(["rank-fallback"]);
    return { rank: 1, rows: [] }; };
  const rankWithResults = () => { throw new Error("unexpected results"); };
  const updateTachometer = (_tachometer: unknown, _physics: unknown,
    nowMs: number) => { events.push(["tachometer", nowMs]); };
  const render = (scene: unknown, _camera: unknown, clear?: boolean) => {
    events.push(["render", scene, clear]);
  };
  const Original = new Function("X2", "_r0", "Gr0", "Br0", "QL", "e4",
    "xr0", "Mr0", `${originalClass}\nreturn jr0;`)(
    { Racing: "Racing", Countdown: "Countdown" }, rankByProgress,
    rankFallback, rankWithResults, updateTachometer, render,
    () => {}, () => {},
  ) as new () => { update(renderer: unknown, nowMs: number,
    actions: unknown[]): void };
  const host = Object.create(Original.prototype) as InstanceType<typeof Original>;
  const physics = {
    body: { position: { x: 1, y: 2, z: 3 } },
    consumeTrackEventEffectRequests() { events.push(["event-requests"]); return []; },
    consumeTeamGaugeFullAnimation() { events.push(["team-gauge"]); return false; },
    consumeTimeAttackTachometerGaugePreserve() { events.push(["gauge-preserve"]);
      return 0; },
    consumeTimeAttackTachometerNormalBooster() { events.push(["normal-boost"]);
      return false; },
  };
  const track = {
    data: { lapTarget: 3 },
    updateRender(nowMs: number, _camera: unknown, width: number,
      height: number) { events.push(["track-render", nowMs, width, height]); },
    consumeExpiredEventEffects() { events.push(["expired-effects"]); return []; },
    skydome: "sky",
  };
  const local = {
    physics,
    track,
    lifecycle: { state: "Racing" },
    scheduledStartAtMs: 500,
    consumeResetSound() { return false; },
    consumeLocalRouteTags() { return []; },
    raceProgress() { return undefined; },
  };
  Object.assign(host, {
    disposed: mode === "disposed",
    size: { x: 0, y: 0 },
    camera: { aspect: 0 },
    scene: "scene",
    resultVisible: mode === "result",
    resultComplete: undefined,
    resultView: { update(nowMs: number) { events.push(["result-update", nowMs]);
      return true; } },
    warpCameraFrozen: false,
    cameraMode: "ready",
    playerId: "local",
    race: { roadblock: false, roster: [] },
    assets: {
      map: {
        stageBinding: { beginFrame(nowMs: number) {
          events.push(["begin-frame", nowMs]);
        } },
        readyCamera: { apply(_camera: unknown, nowMs: number) {
          events.push(["ready-camera", nowMs]);
        } },
      },
      participants: [],
      draftAudio: { update() { throw new Error("unexpected draft audio"); } },
      lteCoins: { update(nowMs: number) { events.push(["coin-render", nowMs]); } },
    },
    runtime: {
      giantEffectsEnded: false,
      local,
      remotes: {
        rankDisconnected() { return false; },
        raceProgress() { return undefined; },
      },
      finishDeadline: 2500,
      finishSnapshot() { events.push(["finish-snapshot"]); return []; },
      resultSnapshot() { events.push(["result-snapshot"]); return undefined; },
      localDraftHudActive() { return false; },
    },
    trackInfoCard: { update(nowMs: number) { events.push(["track-card", nowMs]); } },
    banner: { update(nowMs: number, startAt: number, countdown: boolean) {
      events.push(["banner", nowMs, startAt, countdown]);
    } },
    bannerRequest: undefined,
    award: { update(nowMs: number) { events.push(["award", nowMs]); } },
    roadblockResult: undefined,
    hud: {
      hideTimeGap() { events.push(["hide-gap"]); },
      markerTints() { events.push(["marker-tints"]); return []; },
      startTeamBoostGaugeFull() { throw new Error("unexpected full gauge"); },
      update(_local: unknown, nowMs: number, poses: unknown, board: unknown) {
        events.push(["hud", nowMs, poses, board]);
      },
      timeGapEnabled: false,
    },
    finishCountdown: { update(nowMs: number, deadline: unknown) {
      events.push(["finish-countdown", nowMs, deadline]); return false;
    } },
    applyLocalWarpActions() { events.push(["warp-actions"]); },
    lightFactor: { update() { events.push(["light-factor"]); } },
    views: new Map(),
    initialPoses: new Map(),
    linkedPresentations: new Map(),
    giantAppearances: new Map(),
    retiredCharacterIds: new Set(),
    localRetirePending: false,
    winnerMotion: { consume() { return undefined; } },
    shadowPresentations: new Map(),
    captureRankProgress() { events.push(["capture-rank"]); },
    rankRoster: { progress() { return undefined; }, out() { return false; } },
    action2d: { setFinishDeadline(deadline: unknown) {
      events.push(["set-deadline", deadline]);
    } },
    warpHudHidden: false,
    gaugePreserve: { update(nowMs: number, preserve: unknown) {
      events.push(["preserve", nowMs, preserve]); return 0;
    } },
    tachometer: {},
    audioStarted: false,
    clearGiant() { events.push(["clear-giant"]); },
    showResult() { throw new Error("unexpected publish result"); },
  });
  const dependencies = {
    result: { countdownState: "Countdown", render },
    events: { racingState: "Racing" },
    participants: {
      updateRemoteVehicleEffects() { throw new Error("unexpected racer"); },
      updateLocalVehicleEffects() { throw new Error("unexpected racer"); },
    },
    hud: {
      rankByProgress, rankFallback, rankWithResults,
      updateTachometer, prepareScene: render, racingState: "Racing",
    },
  };
  const renderer = { getDrawingBufferSize(size: { x: number; y: number }) {
    events.push(["drawing-size"]); size.x = 1280; size.y = 720;
  } };
  let error: string | undefined;
  try {
    if (rewritten) updateRacePresenterFrame(host as unknown as RacePresenterFrameHost,
      renderer, 1200, [], dependencies as unknown as RacePresenterFrameDependencies);
    else host.update(renderer, 1200, []);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, aspect: (host as unknown as { camera: { aspect: number } }).camera.aspect,
    resultComplete: (host as unknown as { resultComplete: unknown }).resultComplete };
}

test("complete multiplayer presenter frame and result early return match release", () => {
  for (const mode of ["disposed", "result", "live"] as const) {
    assert.deepEqual(observe(true, mode), observe(false, mode), mode);
  }
});
