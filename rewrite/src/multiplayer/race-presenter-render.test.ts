import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderRacePresenterFrame,
  type RacePresenterRenderHost, type RacePresenterRenderer } from "./race-presenter-render";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class jr0 {");
const end = release.indexOf("\nclass aP {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Scenario = "live" | "result" | "disposed" | "hidden-hud" |
  "post-finish" | "zero-height" | "render-error";

function observe(rewritten: boolean, scenario: Scenario) {
  const events: unknown[][] = [];
  const withColorPipeline = (_renderer: unknown, render: () => void) => {
    events.push(["pipeline-enter"]);
    try { render(); } finally { events.push(["pipeline-exit"]); }
  };
  const renderTachometer = (_tachometer: unknown, _renderer: unknown) => {
    events.push(["tachometer"]);
  };
  const Original = new Function("jm", "yo", "JL", "Rv", "H2", "$2", "X2",
    `${originalClass}\nreturn jr0;`)("transparent-sort", withColorPipeline,
    renderTachometer, 0.12, "world-axis", "depth-axis", { PostFinish: 5 }) as
    new () => { render(renderer: unknown, nowMs: number): void };
  const host = Object.create(Original.prototype) as RacePresenterRenderHost;
  Object.assign(host, {
    disposed: scenario === "disposed",
    resultVisible: scenario === "result",
    warpHudHidden: scenario === "hidden-hud",
    runtime: { local: {
      lifecycle: { state: scenario === "post-finish" ? 6 : 2 },
      track: { skydome: "sky" },
      warpNext: { blackBarRatio(nowMs: number) {
        events.push(["black-bar-ratio", nowMs]); return 0.5;
      } },
    } },
    scene: "world",
    camera: "camera",
    hud: { render() { events.push(["hud"]); } },
    tachometer: "tachometer",
    size: { y: scenario === "zero-height" ? 0 : 720 },
    warpBlackBar: { renderRatio(_renderer: unknown, ratio: number) {
      events.push(["warp-black-bar", ratio]);
    } },
    finishBlackBar: { render(_renderer: unknown, nowMs: number, height: number) {
      events.push(["finish-black-bar", nowMs, height]);
    } },
    action2d: { render(_renderer: unknown, nowMs: number,
      axis: unknown, depth: unknown) {
      events.push(["action-2d", nowMs, axis, depth]);
    } },
  });
  const renderer: RacePresenterRenderer = {
    autoClear: true,
    clear() { events.push(["clear"]); },
    clearDepth() { events.push(["clear-depth"]); },
    setTransparentSort(sort: unknown) { events.push(["sort", sort]); },
    render(scene: unknown, camera: unknown) {
      events.push(["render", scene, camera]);
      if (scenario === "render-error" && scene === "world") {
        throw new Error("render failed");
      }
    },
  };
  let error: string | undefined;
  try {
    if (rewritten) renderRacePresenterFrame(host, renderer, 1200.5, {
      transparentSort: "transparent-sort", withColorPipeline,
      renderTachometer, blackBarFraction: 0.12,
      worldAxis: "world-axis", depthAxis: "depth-axis", postFinishState: 5,
    });
    else (host as unknown as InstanceType<typeof Original>)
      .render(renderer, 1200.5);
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, autoClear: renderer.autoClear };
}

test("multiplayer world, HUD, letterbox and renderer restoration match release", () => {
  const scenarios: Scenario[] = ["live", "result", "disposed", "hidden-hud",
    "post-finish", "zero-height", "render-error"];
  for (const scenario of scenarios) {
    assert.deepEqual(observe(true, scenario), observe(false, scenario), scenario);
  }
});
