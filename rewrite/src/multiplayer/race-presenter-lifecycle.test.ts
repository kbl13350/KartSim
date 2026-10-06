import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { disposeRacePresenter, warmRacePresenter,
  type RacePresenterLifecycleDependencies,
  type RacePresenterLifecycleHost } from "./race-presenter-lifecycle";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

function observeWarm(rewritten: boolean, mode: "normal" | "render-error" | "no-sky") {
  const events: unknown[][] = [];
  class Target { constructor(width: number, height: number) {
    events.push(["create-target", width, height]);
  } dispose() { events.push(["dispose-target"]); } }
  const warmScene = (_renderer: unknown, object: unknown, _scene: unknown,
    recursive?: boolean) => {
    events.push(["warm-scene", object === host.scene ? "scene" : object,
      recursive]);
  };
  const Original = new Function("Hn", "nn",
    `${originalClass}\nreturn jr0;`)(warmScene, Target) as new () => {
    warm(renderer: unknown, nowMs: number): void;
  };
  const host = Object.create(Original.prototype) as RacePresenterLifecycleHost;
  Object.assign(host, {
    scene: { clear() {} },
    assets: {
      map: { readyCamera: { start() { events.push(["ready-camera-start"]); } } },
      participants: [{ playerId: "local", vehicle: { effects: {
        warmDetachedScenes() { events.push(["warm-detached"]); },
      } } }],
    },
    runtime: { local: { track: { skydome: mode === "no-sky"
      ? undefined : "sky" } } },
    views: new Map([["local", { root: "local-root" }]]),
    size: { x: 0, y: 0 },
    update(_renderer: unknown, nowMs: number, actions: unknown[]) {
      events.push(["update", nowMs, actions]);
    },
    render(_renderer: unknown, nowMs: number) {
      events.push(["render", nowMs]);
      if (mode === "render-error") throw new Error("render failed");
    },
  });
  const renderer = {
    getDrawingBufferSize(size: { x: number; y: number }) {
      events.push(["drawing-buffer"]); size.x = 1280; size.y = 720;
    },
    getRenderTarget() { events.push(["get-target"]); return "old-target"; },
    setRenderTarget(target: unknown) {
      events.push(["set-target", target instanceof Target ? "new-target" : target]);
    },
  };
  const dependencies = { warmScene,
    createRenderTarget: (width: number, height: number) =>
      new Target(width, height), vehicleParts: () => [] };
  let error: string | undefined;
  try {
    if (rewritten) warmRacePresenter(host, renderer, 1200,
      dependencies as RacePresenterLifecycleDependencies);
    else (host as unknown as InstanceType<typeof Original>).warm(renderer, 1200);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, size: host.size };
}

function observeDispose(rewritten: boolean, alreadyDisposed: boolean) {
  const events: unknown[][] = [];
  const detachable = (name: string) => ({ removeFromParent() {
    events.push(["remove", name]);
  } });
  const owner = (name: string) => ({ dispose() { events.push(["dispose", name]); } });
  const vehicleParts = () => [detachable("part-a"), detachable("part-b")];
  const Original = new Function("lc", `${originalClass}\nreturn jr0;`)(
    vehicleParts) as new () => { dispose(): void };
  const host = Object.create(Original.prototype) as RacePresenterLifecycleHost;
  const participant = {
    playerId: "local",
    characters: {
      ordinary: { scene: { object: detachable("ordinary") } },
      linked: { scene: { object: detachable("linked") } },
    },
    vehicle: {
      effects: { warmDetachedScenes() {} },
      accessories: [{ render: { scene: { object: detachable("accessory") } } }],
      decoration: { scene: { object: detachable("decoration") } },
    },
  };
  Object.assign(host, {
    disposed: alreadyDisposed,
    scene: { clear() { events.push(["scene-clear"]); } },
    assets: { map: { readyCamera: { start() {} } }, participants: [participant] },
    runtime: { local: { track: {} } },
    views: new Map([["local", { root: {}, releaseBorrowedModel() {
      events.push(["release-view"]);
    } }]]),
    linkedPresentations: new Map([["local", {}]]),
    initialPoses: new Map([["local", {}]]),
    hud: owner("hud"),
    rankRoster: owner("rank-roster"),
    flyingPet: owner("pet"),
    trackEventEffects: owner("effects"),
    trackEventAudio: owner("event-audio"),
    trackDummyAudio: owner("dummy-audio"),
    roadblockFlag: owner("flag"),
    roadblockHud: owner("roadblock-hud"),
    roadblockResult: owner("roadblock-result"),
    award: owner("award"),
    resultView: owner("result-view"),
    banner: owner("banner"),
    trackInfoCard: owner("track-card"),
    countdown: owner("countdown"),
    finishBlackBar: owner("finish-bar"),
    warpBlackBar: owner("warp-bar"),
    action2d: owner("action-2d"),
    audioStarted: true,
    bgm: { silence() { events.push(["bgm-silence"]); } },
    releaseShadowPresentations() { events.push(["release-shadows"]); },
    clearGiant() { events.push(["clear-giant"]); },
  });
  const dependencies = { warmScene() {}, createRenderTarget: () => owner("target"),
    vehicleParts };
  let error: string | undefined;
  try {
    if (rewritten) disposeRacePresenter(host,
      dependencies as unknown as RacePresenterLifecycleDependencies);
    else (host as unknown as InstanceType<typeof Original>).dispose();
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, disposed: host.disposed,
    views: host.views.size, linked: host.linkedPresentations.size,
    poses: host.initialPoses.size,
    pet: host.flyingPet === undefined,
    effects: host.trackEventEffects === undefined,
    flag: host.roadblockFlag === undefined };
}

test("multiplayer presentation warm target lifecycle matches release", () => {
  for (const mode of ["normal", "render-error", "no-sky"] as const) {
    assert.deepEqual(observeWarm(true, mode), observeWarm(false, mode), mode);
  }
});

test("multiplayer presentation disposal and repeated disposal match release", () => {
  for (const alreadyDisposed of [false, true]) {
    assert.deepEqual(observeDispose(true, alreadyDisposed),
      observeDispose(false, alreadyDisposed), String(alreadyDisposed));
  }
});
