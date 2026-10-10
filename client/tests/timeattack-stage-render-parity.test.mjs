import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { parse } from "@babel/parser";
import { renderTimeAttackStage } from "../src/timeattack/stage-render.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declaration = parse(source, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id?.name === "df0");
const method = declaration?.body.body.find(node =>
  node.type === "ClassMethod" && node.key.name === "render");
assert.ok(method);
const context = {};
runInNewContext(`class ReleasedStage { ${source.slice(method.start, method.end)} }
globalThis.ReleasedStage = ReleasedStage;`, context);

function run(kind, options = {}) {
  const trace = [];
  let clock = 1000;
  const lifecycle = {
    pausedTotalMs: 20,
    finished: options.finished ?? false,
    effectiveTime: at => { trace.push(`lifecycle.effectiveTime:${at}`); return at - 20; },
  };
  const renderer = {
    getDrawingBufferSize: value => trace.push(`renderer.getDrawingBufferSize:${value}`),
    render: (scene, camera) => trace.push(`renderer.render:${scene}:${camera}`),
  };
  const physics = {
    consumeTimeAttackTachometerGaugePreserve: () => {
      trace.push("physics.consumeGaugePreserve"); return "preserve-request";
    },
    consumeTimeAttackTachometerNormalBooster: () => {
      trace.push("physics.consumeNormalBooster"); return "normal-booster";
    },
  };
  const dependencies = {
    nowMs: () => { trace.push("performance.now"); return clock++; },
    isRaceFinished: value => { trace.push(`isRaceFinished:${value === lifecycle}`); return value.finished; },
    compose: (_renderer, ui, world, sky, post) => {
      trace.push(`compose:${_renderer === renderer}:${typeof sky}`);
      sky?.(); world(); post(); ui();
    },
    updateTachometer: (...args) => trace.push(`updateTachometer:${JSON.stringify(args.map(value =>
      value === physics ? "physics" : value))}`),
    renderTachometer: (tachometer, value) =>
      trace.push(`renderTachometer:${tachometer}:${value === renderer}`),
    prepareWorldScene: (scene, camera, sky, mark) => {
      trace.push(`prepareWorldScene:${scene}:${camera}:${sky}:${typeof mark}`);
      mark?.("world-prep");
    },
    renderWithColorPipeline: (value, draw) => {
      trace.push(`renderWithColorPipeline:${value === renderer}`);
      draw();
    },
    worldAxis: "world-axis",
    depthAxis: "depth-axis",
  };
  Object.assign(context, {
    performance: { now: dependencies.nowMs },
    Un: dependencies.isRaceFinished,
    gf0: dependencies.compose,
    QL: dependencies.updateTachometer,
    JL: dependencies.renderTachometer,
    e4: dependencies.prepareWorldScene,
    yo: dependencies.renderWithColorPipeline,
    H2: dependencies.worldAxis,
    $2: dependencies.depthAxis,
  });
  const host = {
    renderer,
    drawingBufferSize: "buffer-size",
    session: {
      lifecycle,
      warpHud: options.warpHidden ? { hidden: true } : undefined,
      tachometer: options.noTachometer ? undefined : "tachometer",
      outlineBatch: { flush: () => trace.push("outlineBatch.flush") },
      kartMotionBlur: { render: (value, at) =>
        trace.push(`kartMotionBlur.render:${value === renderer}:${at}`) },
    },
    workProfiler: options.noProfiler ? undefined : {
      mark: (name, at) => trace.push(`profiler.mark:${name}:${at}`),
    },
    tachometerGaugePreserve: {
      update: (at, request) => {
        trace.push(`tachometerGaugePreserve.update:${at}:${request}`);
        return "preserve";
      },
    },
    scene: "scene",
    camera: "camera",
    getPhysics: () => { trace.push("host.getPhysics"); return physics; },
    getTrack: () => {
      trace.push("host.getTrack");
      return { skydome: options.noSkydome ? undefined : "sky" };
    },
  };
  const stage = kind === "release" ? new context.ReleasedStage() : {};
  stage.released = options.released ?? false;
  stage.milliseconds = 1234.8;
  stage.effectiveNowMs = 1214.8;
  stage.ghostPoses = ["pose"];
  stage.host = host;
  stage.ui = options.noUi ? undefined : {
    result: { render: (...args) => trace.push(`result.render:${args.join(":")}`) },
    action2D: { render: (...args) => trace.push(`action2D.render:${args.join(":")}`) },
  };
  stage.renderGameplayUi = (at, poses) =>
    trace.push(`stage.renderGameplayUi:${at}:${poses === stage.ghostPoses}`);
  if (kind === "rewrite") stage.render = () => renderTimeAttackStage(stage, dependencies);
  stage.render();
  return trace;
}

test("world, sky, post, HUD and tachometer pass order matches release", () => {
  for (const options of [
    {}, { noSkydome: true }, { noTachometer: true },
    { noProfiler: true }, { noUi: true }, { released: true },
    { finished: true }, { warpHidden: true },
  ]) {
    assert.deepEqual(run("rewrite", options), run("release", options));
  }
});
