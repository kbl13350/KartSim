import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { advancePresentationFrame, renderPresentationFrame } from "../src/app/frame-loop.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "vf0");
assert.ok(declaration);
const methods = declaration.body.body.filter(node =>
  node.type === "ClassMethod" && ["frame", "updateAndRender"].includes(node.key.name),
);
assert.equal(methods.length, 2);
const context = {
  performance: { now: () => context.nowMs() },
  requestAnimationFrame: callback => context.requestFrame(callback),
  Un: lifecycle => context.isRaceFinished(lifecycle),
};
runInNewContext(`class ReleasedPresenter { ${methods.map(method => source.slice(method.start, method.end)).join("\n")} }
globalThis.ReleasedPresenter = ReleasedPresenter;`, context);

function run(kind, options = {}) {
  const trace = [];
  const nowValues = [10025.9, 10026.2, 10027.1, 10028.3, 10030.6];
  const dependencies = {
    nowMs: () => {
      const value = nowValues.shift();
      trace.push(`clock:${value}`);
      return value;
    },
    isRaceFinished: lifecycle => lifecycle.finished,
    requestFrame: callback => { trace.push(`raf:${typeof callback}`); return 77; },
  };
  context.nowMs = dependencies.nowMs;
  context.isRaceFinished = dependencies.isRaceFinished;
  context.requestFrame = dependencies.requestFrame;
  const presenter = kind === "release" ? new context.ReleasedPresenter() : {};
  presenter.previousRenderTime = options.previousRenderTime ?? 10;
  presenter.frameTimeSeconds = 0;
  presenter.fps = 60;
  presenter.frame = () => undefined;
  presenter.animationFrame = 0;
  presenter.nextFrameCallbacks = [
    { run: () => trace.push("callback.run:1"), reject: error => trace.push(`callback.reject:1:${error.message}`) },
    { run: () => trace.push("callback.run:2"), reject: error => trace.push(`callback.reject:2:${error.message}`) },
  ];
  presenter.stages = {
    enter: () => trace.push("stage.enter"),
    update: frame => {
      trace.push(`stage.update:${frame.nowMs}:${frame.rawMs}`);
      if (options.throwStage) throw new Error("stage failed");
    },
    render: () => trace.push("stage.render"),
  };
  presenter.multiplayerStage = options.multiplayer
    ? { touchDrivingAvailable: true, touchDodgeEnabled: true } : undefined;
  const info = {
    reset: () => trace.push("renderer.reset"),
    render: { calls: 3, triangles: 400, lines: 5, points: 6, frame: 7 },
  };
  presenter.host = {
    workProfiler: {
      begin: at => trace.push(`profile.begin:${at}`),
      mark: (name, at) => trace.push(`profile.${name}:${at}`),
      end: at => trace.push(`profile.end:${at}`),
      summary: () => "summary",
    },
    renderer: { info },
    touchControls: { setRaceState: (...args) => trace.push(`touch:${args.join(":")}`) },
    input: { isEnabled: true },
    shell: { started: true },
    session: { lifecycle: { finished: options.finished ?? false } },
    paused: options.paused ?? false,
    ready: { updateWindowNotice: at => trace.push(`notice:${at}`) },
    hud: {
      updateEngine: fps => trace.push(`engine:${fps}`),
      recordPerformanceFrame: (frameMs, renderMs, startedAt, summary) =>
        trace.push(`performance:${frameMs}:${renderMs}:${startedAt}:${summary}`),
    },
    engineRenderStats: { calls: 0, triangles: 0, lines: 0, points: 0, frame: 0 },
    haltRuntime: (error, at) => trace.push(`halt:${error.message}:${at}`),
  };
  if (kind === "rewrite") {
    presenter.updateAndRender = at => renderPresentationFrame(presenter, at, dependencies);
  }
  presenter.updateAndRender(10000);
  return {
    trace,
    fps: presenter.fps,
    frameTimeSeconds: presenter.frameTimeSeconds,
    previousRenderTime: presenter.previousRenderTime,
    engineRenderStats: presenter.host.engineRenderStats,
    animationFrame: presenter.animationFrame,
    pendingCallbacks: presenter.nextFrameCallbacks.length,
  };
}

test("solo, paused and multiplayer presentation frames match release", () => {
  for (const options of [
    {}, { finished: true }, { paused: true }, { multiplayer: true },
    { previousRenderTime: 12 },
  ]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});

test("frame failure rejects callbacks and schedules the next frame like release", () => {
  assert.deepEqual(run("rewrite", { throwStage: true }), run("release", { throwStage: true }));
});

function runRaf(kind, lastUpdateMs, scheduledAtMs) {
  const trace = [];
  const nowValues = [10000.4, 10000.9];
  const dependencies = {
    nowMs: () => { const time = nowValues.shift(); trace.push(`clock:${time}`); return time; },
    requestFrame: callback => { trace.push(`request:${typeof callback}`); return 42; },
  };
  context.nowMs = dependencies.nowMs;
  context.requestFrame = dependencies.requestFrame;
  const presenter = kind === "release" ? new context.ReleasedPresenter() : {};
  presenter.maxRafDelayMs = 0;
  presenter.lastUpdateMs = lastUpdateMs;
  presenter.animationFrame = 0;
  presenter.updateAndRender = at => trace.push(`render:${at}`);
  if (kind === "rewrite") {
    presenter.frame = at => advancePresentationFrame(presenter, at, dependencies);
  }
  presenter.frame(scheduledAtMs);
  return {
    trace,
    maxRafDelayMs: presenter.maxRafDelayMs,
    lastUpdateMs: presenter.lastUpdateMs,
    animationFrame: presenter.animationFrame,
  };
}

test("RAF duplicate-millisecond gate and delay tracking match release", () => {
  for (const [lastUpdateMs, scheduledAtMs] of [
    [10000, 9990], [9999, 9990], [9999, undefined], [10000, 10020],
  ]) {
    assert.deepEqual(runRaf("rewrite", lastUpdateMs, scheduledAtMs),
      runRaf("release", lastUpdateMs, scheduledAtMs));
  }
});
