import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { initializeApplication } from "../src/app/application-construction.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "Bf0");
assert.ok(classNode);
const constructorNode = classNode.body.body.find(method =>
  method.type === "ClassMethod" && method.kind === "constructor");
assert.ok(constructorNode);
const constructorBody = release.slice(constructorNode.body.start + 1,
  constructorNode.body.end - 1);

function fixture() {
  const calls = [];
  const root = { name: "root", append(value) { calls.push(["append", value.name]); } };
  const canvas = { name: "canvas", dataset: {} };
  const scene = { name: "scene" };
  const session = { name: "session", physics: {}, track: {},
    kartTrails: {}, snow: {} };
  let hudActions;
  const dependencies = {
    qe: "srgb",
    Vg: class { constructor(value) { calls.push(["kart view", value.name]); this.name = "kart view"; } },
    $o0: class {
      constructor(value, actions) { calls.push(["hud", value.name]); hudActions = actions; this.name = "hud"; }
      showDebugText(message, level) { calls.push(["debug text", message, level]); }
    },
    jo0: value => { calls.push(["diagnostics", value]); return "diagnostics"; },
    Jo0: class { constructor(value) { calls.push(["assets", value.name]); this.name = "assets"; } },
    jl0: class {
      constructor() { calls.push(["input"]); this.name = "input"; }
      setKeyMap(value) { calls.push(["input keymap", value]); }
      setEnabled(value) { calls.push(["input enabled", value]); }
      setTouchAction(...args) { calls.push(["touch action", ...args]); }
    },
    qs0: class {
      constructor(value, element, name, report) {
        calls.push(["canvas diagnostics", value.name, element.name, name()]);
        this.name = "canvas diagnostics";
        this.report = report;
      }
    },
    l60: class {
      constructor(value, touch, pause, autoForward, seamless) {
        calls.push(["touch controls", value.name]);
        this.name = "touch controls";
        this.touch = touch; this.pause = pause;
        this.autoForward = autoForward; this.seamless = seamless;
      }
      setKeyMap(value) { calls.push(["touch keymap", value]); }
      getNitroSeamlessMode() { calls.push(["touch seamless"]); return true; }
    },
    yr0: class { constructor(options) { calls.push(["black bar", options.root.name]); this.name = "black bar"; } },
    ResizeObserver: class {
      constructor(handler) { calls.push(["resize observer", typeof handler]); this.name = "observer"; }
      observe(value) { calls.push(["observe", value.name]); }
    },
    window: { addEventListener(name, handler) {
      calls.push(["window add", name, typeof handler]);
    } },
  };
  const owner = {
    renderer: { domElement: canvas, info: {} }, scene,
    camera: { name: "camera" }, session,
    gameOptions: { keyMap: "keys", boostBlur: true, toonLine: false,
      shadow: true, dualBoostAuto: true },
    drawingBufferSize: { name: "drawing size" },
    engineRenderStats: { name: "render stats" },
    raceStartProgramCount: 9, maxRafDelayMs: 100,
    shell: { current: "ready" },
    warpHudGate: { name: "hud gate" },
    cameras: { configureP3528ResolutionMode() { calls.push(["camera config"]); } },
    onViewportResize() {}, onGlobalKeyDown() {},
    presenter: {
      changeStage(value) { calls.push(["change stage", value]); },
      start() { calls.push(["presenter start"]); },
      raceInterface: { gameplayUi: {} },
    },
    returnToReady() { calls.push(["return ready"]); },
    togglePause() { calls.push(["pause"]); },
    setAutoForwardEnabled(value) { calls.push(["auto forward", value]); },
    setNitroSeamlessMode(value) { calls.push(["seamless", value]); },
    configureBackbuffer() { calls.push(["backbuffer"]); },
    mountDevTools() { calls.push(["devtools"]); },
    restoreTimeAttackRecords() { calls.push(["records"]); },
    loadVersionedResources() { calls.push(["resources"]); },
  };
  const ops = {
    outputColorSpace: dependencies.qe,
    makeKartView: value => new dependencies.Vg(value),
    makeHud: (value, actions) => new dependencies.$o0(value, actions),
    collectEngineDiagnostics: dependencies.jo0,
    makeAssets: value => new dependencies.Jo0(value),
    makeInput: () => new dependencies.jl0(),
    makeCanvasDiagnostics: (...args) => new dependencies.qs0(...args),
    makeTouchControls: (...args) => new dependencies.l60(...args),
    makeBlackBar: value => new dependencies.yr0({ root: value }),
    makeResizeObserver: callback => new dependencies.ResizeObserver(callback),
  };
  return { calls, root, dependencies, owner, ops, getHudActions: () => hudActions };
}

function summarize(owner) {
  return {
    root: owner.root.name,
    canvas: { className: owner.renderer.domElement.className,
      uiLayer: owner.renderer.domElement.dataset.uiLayer,
      tabIndex: owner.renderer.domElement.tabIndex },
    color: owner.renderer.outputColorSpace,
    autoReset: owner.renderer.info.autoReset,
    scene: { matrixWorldAutoUpdate: owner.scene.matrixWorldAutoUpdate,
      matrixAutoUpdate: owner.scene.matrixAutoUpdate,
      matrixWorldNeedsUpdate: owner.scene.matrixWorldNeedsUpdate },
    kartView: owner.kartView.name, hud: owner.hud.name,
    assets: owner.assets.name, input: owner.input.name,
    touchControls: owner.touchControls.name,
    blackBar: owner.activeBlackBar.name,
    warpBlackBar: owner.session.warpBlackBar.name,
    warpHud: owner.session.warpHud.name,
    resizeObserver: owner.viewportResizeObserver.name,
  };
}

test("application canvas and startup construction match the release", () => {
  const run = kind => {
    const f = fixture();
    const oldWindow = globalThis.window;
    globalThis.window = f.dependencies.window;
    try {
      if (kind === "original") {
        const Original = new Function("deps", `with (deps) {
          return function(e) { ${constructorBody} };
        }`)(f.dependencies);
        Original.call(f.owner, f.root);
      } else initializeApplication(f.owner, f.root, f.ops);
      f.getHudActions().collectEngineDiagnostics();
      f.getHudActions().returnToReady();
      f.owner.touchControls.touch("forward", true);
      f.owner.touchControls.pause();
      f.owner.touchControls.autoForward(true);
      f.owner.touchControls.seamless(false);
      return { calls: f.calls, owner: summarize(f.owner) };
    } finally { globalThis.window = oldWindow; }
  };
  const rewritten = run("rewritten");
  const diagnostics = rewritten.calls.find(call => call[0] === "diagnostics")[1];
  assert.equal(diagnostics.options.verticalSync, false);
  delete diagnostics.options.verticalSync;
  assert.deepEqual(rewritten, run("original"));
});
