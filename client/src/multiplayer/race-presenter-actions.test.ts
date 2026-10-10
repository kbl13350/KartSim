import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyPresenterWarpActions, applyPresenterWarpCamera,
  capturePresenterRankProgress, forwardPresenterAwardInput,
  handlePresenterRouteTag, playPresenterGo, playPresenterReset,
  releasePresenterShadowPresentations, startPresenterAudio,
  startPresenterBoostGaugeFull, updatePresenterRoom,
  type RacePresenterActionsHost } from "./race-presenter-actions";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Method = "award" | "warp-camera" | "warp-actions" | "route" |
  "audio" | "go" | "reset" | "boost" | "capture" | "room" | "shadows";
type Variant = "normal" | "skip" | "flash" | "shake-in" | "shake-out" |
  "wave-in" | "wave-out" | "missing";

function observe(rewritten: boolean, method: Method, variant: Variant) {
  const events: unknown[][] = [];
  const routeFamily = (tag: string) => { events.push(["route-family", tag]);
    return tag.split(":")[0] ?? ""; };
  const resetTachometer = (tachometer: unknown) => {
    events.push(["reset-tachometer", tachometer]);
  };
  const Original = new Function("Vo", "eP",
    `${originalClass}\nreturn jr0;`)(routeFamily, resetTachometer) as new () => {
    awardInput(input: unknown, nowMs: number): void;
    applyWarpCamera(): void;
    applyLocalWarpActions(): void;
    handleRouteTag(tag: string): void;
    startAudio(): void;
    playGoAndHideTrackInfo(): void;
    playReset(): void;
    startBoostGaugeFull(): void;
    captureRankProgress(): void;
    updateRoom(room: unknown): void;
    releaseShadowPresentations(): void;
  };
  const host = Object.create(Original.prototype) as RacePresenterActionsHost;
  const room = { members: [{ playerId: "local" },
    { playerId: "remote" }, { playerId: "local" }] };
  const tag = variant === "flash" ? "flash:in:x"
    : variant === "shake-in" ? "shake:in:x"
      : variant === "shake-out" ? "shake:out:x"
        : variant === "wave-in" ? "wave:in:x"
          : variant === "wave-out" ? "wave:out:x" : "road:in:x";
  Object.assign(host, {
    playerId: "local",
    resultVisible: variant !== "skip",
    award: { input(input: unknown, nowMs: number) {
      events.push(["award-input", input, nowMs]);
    } },
    warpCameraFrozen: variant !== "skip",
    warpHudHidden: false,
    camera: "camera",
    cameraShake: {
      enter() { events.push(["shake-enter"]); },
      leave(force: boolean) { events.push(["shake-leave", force]); },
    },
    cameraWave: {
      enter() { events.push(["wave-enter"]); },
      leave() { events.push(["wave-leave"]); },
    },
    lightFactor: { trigger() { events.push(["flash"]); } },
    drive: { reset(value: unknown) { events.push(["drive-reset", value]); } },
    assets: {
      map: { warpNextCamera: variant === "missing" ? undefined
        : (camera: unknown) => events.push(["warp-camera", camera]) },
      drivingMode: variant === "skip" ? { kind: "ordinary" }
        : { kind: "shadow" },
      participants: [{ playerId: "local", vehicle: { audio: {
        start() { events.push(["audio-start"]); },
        playReset() { events.push(["audio-reset"]); },
      } } }],
    },
    runtime: {
      local: {
        consumeWarpActions() { events.push(["consume-warp"]); return [
          { kind: "start-warp-presentation" },
          { kind: "reset-drive-camera" },
          { kind: "freeze-camera" },
          { kind: "teleport" },
          { kind: "finish-warp-letterbox" },
        ]; },
        raceProgress() { events.push(["local-progress"]); return "lap-2"; },
      },
      remotes: { raceProgress(id: unknown) {
        events.push(["remote-progress", id]); return "lap-1";
      } },
    },
    audioStarted: variant === "skip",
    bgm: { currentRaceName: "track BGM",
      restart() { events.push(["bgm-restart"]); } },
    trackInfoCard: {
      setBgmName(name: string) { events.push(["bgm-name", name]); },
      setVisible(value: boolean) { events.push(["track-card-visible", value]); },
      slideOut() { events.push(["track-card-slide"]); },
    },
    countdown: { playGo() { events.push(["countdown-go"]); } },
    tachometer: "tachometer",
    hud: { startBoostGaugeFull() { events.push(["boost-full"]); } },
    rankRoster: {
      capture(progress: (id: unknown) => unknown) {
        events.push(["rank-capture", progress("local"), progress("remote")]);
      },
      updatePresent(present: Set<unknown>) {
        events.push(["rank-present", [...present]]);
      },
    },
    shadowPresentations: new Map([["a", { dispose() {
      events.push(["shadow-a-dispose"]);
    } }], ["b", { dispose() { events.push(["shadow-b-dispose"]); } }]]),
  });
  let error: string | undefined;
  try {
    if (rewritten) {
      if (method === "award") forwardPresenterAwardInput(host, "input", 1200);
      else if (method === "warp-camera") applyPresenterWarpCamera(host);
      else if (method === "warp-actions") applyPresenterWarpActions(host);
      else if (method === "route") handlePresenterRouteTag(host, tag,
        { routeTagFamily: routeFamily, resetTachometer });
      else if (method === "audio") startPresenterAudio(host);
      else if (method === "go") playPresenterGo(host);
      else if (method === "reset") playPresenterReset(host);
      else if (method === "boost") startPresenterBoostGaugeFull(host,
        { routeTagFamily: routeFamily, resetTachometer });
      else if (method === "capture") capturePresenterRankProgress(host);
      else if (method === "room") updatePresenterRoom(host, room);
      else releasePresenterShadowPresentations(host);
    } else {
      const original = host as unknown as InstanceType<typeof Original>;
      if (method === "award") original.awardInput("input", 1200);
      else if (method === "warp-camera") original.applyWarpCamera();
      else if (method === "warp-actions") original.applyLocalWarpActions();
      else if (method === "route") original.handleRouteTag(tag);
      else if (method === "audio") original.startAudio();
      else if (method === "go") original.playGoAndHideTrackInfo();
      else if (method === "reset") original.playReset();
      else if (method === "boost") original.startBoostGaugeFull();
      else if (method === "capture") original.captureRankProgress();
      else if (method === "room") original.updateRoom(room);
      else original.releaseShadowPresentations();
    }
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, resultVisible: host.resultVisible,
    warpCameraFrozen: host.warpCameraFrozen, warpHudHidden: host.warpHudHidden,
    audioStarted: host.audioStarted,
    shadowCount: host.shadowPresentations.size };
}

test("multiplayer presenter commands, audio and room ranking match release", () => {
  const scenarios: Array<[Method, Variant]> = [
    ["award", "normal"], ["award", "skip"],
    ["warp-camera", "normal"], ["warp-camera", "skip"],
    ["warp-camera", "missing"], ["warp-actions", "normal"],
    ["route", "flash"], ["route", "shake-in"],
    ["route", "shake-out"], ["route", "wave-in"],
    ["route", "wave-out"], ["route", "normal"],
    ["audio", "normal"], ["audio", "skip"],
    ["go", "normal"], ["reset", "normal"],
    ["boost", "normal"], ["capture", "normal"],
    ["room", "normal"], ["room", "skip"],
    ["shadows", "normal"], ["shadows", "skip"],
  ];
  for (const [method, variant] of scenarios) {
    assert.deepEqual(observe(true, method, variant),
      observe(false, method, variant), `${method}:${variant}`);
  }
});

// Not in the release: past loading, racers who have not loaded were dropped
// by the server and count as out, like racers who left the room.
test("racers dropped while loading are out of the rank roster", () => {
  const present: unknown[] = [];
  const host = {
    resultVisible: false,
    captureRankProgress() {},
    rankRoster: { updatePresent(ids: Set<unknown>) { present.push([...ids]); } },
  } as unknown as RacePresenterActionsHost;
  const members = [{ playerId: "me" }, { playerId: "slow" }, { playerId: "fast" }];
  updatePresenterRoom(host, { phase: "loading", race: { loadedIds: ["fast"] }, members });
  updatePresenterRoom(host, { phase: "countdown", race: { loadedIds: ["me", "fast"] }, members });
  assert.deepEqual(present, [["me", "slow", "fast"], ["me", "fast"]]);
});
