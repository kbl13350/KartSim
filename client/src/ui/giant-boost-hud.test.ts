import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GiantBoostHud, type GiantBoostHudDependencies,
  type GiantHudModel, type GiantHudPanel } from "./giant-boost-hud";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class I00 {");
const end = release.indexOf("\nclass Dw {", start);
assert.ok(start > 0 && end > start);

function exercise(readable: boolean) {
  const events: unknown[] = [];
  class Camera { matrixWorldAutoUpdate = true;
    constructor() { events.push(["new-camera"]); } }
  class World { constructor() { events.push(["new-world"]); }
    add(object: { id: number }) { events.push(["world-add", object.id]); }
    clear() { events.push(["world-clear"]); } }
  class Viewport { constructor() { events.push(["new-viewport"]); } }
  class PanelRenderer {
    constructor(_images: unknown) { events.push(["new-panel-renderer"]); }
    enableUiSmoothing() { events.push(["smooth-panels"]); }
    update(panels: GiantHudPanel[], time: number) {
      events.push(["panels-update", panels.map(panel => [
        (panel.node as { attributes: { name: string } }).attributes.name,
        panel.framebufferRect]), time]);
    }
    render(_renderer: unknown, width: number, height: number) {
      events.push(["panels-render", width, height]);
    }
    dispose() { events.push(["panels-dispose"]); }
  }
  const applyCamera = (_camera: unknown, view: number[], projection: number[]) =>
    events.push(["camera-matrix", view, projection]);
  const attribute = (node: { attributes?: Record<string, string> }, key: string) =>
    node.attributes?.[key];
  const deps = {
    createCamera: () => new Camera(), createWorld: () => new World(),
    createViewport: () => new Viewport(),
    createRenderer: () => new PanelRenderer(new Map()),
    applyCamera, attribute,
  } as unknown as GiantBoostHudDependencies;
  const Original = new Function("a5", "D1", "Y2", "fn", "Aa", "T",
    `${release.slice(start, end)}\nreturn Fw;`)(
      Camera, World, Viewport, PanelRenderer, applyCamera, attribute,
    ) as new (...args: unknown[]) => GiantBoostHud;
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, -64, 5, 1];
  const models = Array.from({ length: 5 }, (_, id) => {
    const charge = { kind: "node", name: "부스터 게이지01", children: [],
      scale: [1.5, 1, 0.5] };
    const camera = { className: "ReCamera", children: [], camera: {
      projectionMode: 1, fieldOfViewDegrees: 76, nearClip: 1, farClip: 100,
    } };
    const object = { id, removeFromParent: () => events.push(["remove-model", id]) };
    const scene = {
      object, dispose: () => events.push(["dispose-model", id]),
      update: (tick: number) => events.push(["update-model", id, tick]),
      playControllers: (tick: number, channel: number) =>
        events.push(["play-model", id, tick, channel]),
      setControllerCycleMode: (mode: number) => events.push(["cycle", id, mode]),
      setNodeScale: (_node: unknown, scale: number[]) =>
        events.push(["scale", id, scale]),
      clientWorldElements: () => matrix,
    };
    return { parsed: { base: { stopTimeWord: id === 4 ? 1000 : 900 },
      root: { kind: "node", children: [charge, camera] } }, scene };
  }) as unknown as GiantHudModel[];
  const textures = new Map<string, { dispose(): void }>([["body", {
    dispose: () => events.push(["dispose-texture"]),
  }]]);
  const panels = ["step1", "step4", "backdrop"].map(name => ({
    kind: "panel", texture: name, node: { attributes: { name } },
    framebufferRect: { left: 10, right: 110, top: 20, bottom: 100 },
  }));
  const hud = readable ? new GiantBoostHud(models, textures, panels, deps)
    : new Original(models, textures, panels);
  const renderer = {
    autoClear: true,
    getViewport: (_viewport: unknown) => events.push(["get-viewport"]),
    setViewport: (...args: unknown[]) => events.push(["set-viewport",
      ...args.map(arg => typeof arg === "object" ? "saved" : arg)]),
    render: (_world: unknown, _camera: unknown) => events.push(["render-model"]),
    clearDepth: () => events.push(["clear-depth"]),
  };
  hud.renderBefore(renderer, 1600, 900, false);
  hud.stage(0, 100);
  hud.update(270);
  hud.renderPanels(renderer, 1600, 900);
  hud.renderBefore(renderer, 1600, 900, false);
  hud.requestBoostFull();
  hud.updateBoost(300, false, 0.4);
  hud.renderBoost(renderer, 1600, 900);
  hud.updateBoost(400, true, 1);
  hud.renderAfter(renderer, 1600, 900, false);
  hud.stage(6, 500);
  hud.update(600);
  hud.dispose();
  hud.dispose();
  hud.stage(0, 700);
  hud.renderPanels(renderer, 1600, 900);
  return { events, state: [hud.state.cells, hud.state.full, hud.state.zero],
    disposed: hud.disposed, autoClear: renderer.autoClear, textures: textures.size };
}

test("Giant Boost HUD model, gauge, panel and disposal lifecycle match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});

async function exerciseLoad(readable: boolean) {
  const events: unknown[] = [];
  class Camera { constructor() { events.push(["camera"]); } }
  class World { constructor() { events.push(["world"]); }
    add() {} clear() { events.push(["world-clear"]); } }
  class Viewport { constructor() { events.push(["viewport"]); } }
  class PanelRenderer { constructor(_images: unknown) { events.push(["panels"]); }
    enableUiSmoothing() { events.push(["smoothing"]); }
    update() {} render() {} dispose() { events.push(["panels-dispose"]); } }
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -64, 0, 1];
  const makeModel = (index: number) => {
    const root = { kind: "node", children: [
      { name: "부스터 게이지01", scale: [1, 1, 1], children: [] },
      { className: "ReCamera", children: [], camera: {
        projectionMode: 1, fieldOfViewDegrees: 76, nearClip: 1, farClip: 100,
      } },
    ] };
    return { parsed: { base: { stopTimeWord: index === 4 ? 1000 : 900 }, root },
      scene: { object: { removeFromParent() {} },
        update: (time: number) => events.push(["model-update", index, time]),
        dispose: () => events.push(["model-dispose", index]),
        setControllerCycleMode: (mode: number) => events.push(["cycle", index, mode]),
        setNodeScale: () => {}, clientWorldElements: () => matrix,
      } };
  };
  let modelIndex = 0;
  const loadModel = async (_library: unknown, path: string,
    _textures: unknown, _options: unknown, original: boolean) => {
    events.push(["load-model", path, original]);
    return makeModel(modelIndex++);
  };
  const attribute = (node: { attributes: Array<{ name: string; value: string }> },
    name: string) => node.attributes.find(entry => entry.name === name)?.value;
  const definition = { attributes: [{ name: "clientRect", value: "0 0 10 10" },
    { name: "texture", value: "meter@zz" }], children: [
    { attributes: [{ name: "texture", value: "meter@zz" }], children: [] },
  ] };
  const findResource = (_library: unknown, path: string) => {
    events.push(["find", path]);
    return { bytes: async () => new TextEncoder().encode(path) };
  };
  const parseBml = (_bytes: Uint8Array) => definition;
  const decodeTexture = async (bytes: Uint8Array) => {
    const path = new TextDecoder().decode(bytes);
    events.push(["decode", path]); return { path };
  };
  const makeUi = (node: typeof definition, images: Map<string, unknown>) => {
    events.push(["ui", node.attributes.map(entry => entry.name), [...images.keys()]]);
    return node;
  };
  const layoutUi = (_ui: unknown, width: number, height: number,
    options: { visibility(): boolean }) => {
    events.push(["layout", width, height, options.visibility()]);
    return {};
  };
  const panels = (_ui: unknown, images: Map<string, unknown>) => {
    events.push(["materialize", [...images.keys()]]);
    return [{ kind: "panel", texture: "meter", node: definition,
      framebufferRect: { left: 0, right: 1, top: 0, bottom: 1 } }];
  };
  const applyCamera = (_camera: unknown, view: number[], projection: number[]) =>
    events.push(["camera-matrix", view, projection]);
  const deps = { createCamera: () => new Camera(), createWorld: () => new World(),
    createViewport: () => new Viewport(), createRenderer: () => new PanelRenderer(new Map()),
    applyCamera, loadModel, attribute, findResource, parseBml,
    decodeTexture, makeUi, layoutUi, panels } as unknown as GiantBoostHudDependencies;
  const Original = new Function("a5", "D1", "Y2", "fn", "Aa", "T",
    "aI", "s2", "Yi", "p2", "d5", "dn", "dt",
    `${release.slice(start, end)}\nreturn Fw;`)(
      Camera, World, Viewport, PanelRenderer, applyCamera, attribute,
      loadModel, parseBml, findResource, decodeTexture, makeUi, layoutUi, panels,
    ) as { load(library: unknown): Promise<GiantBoostHud> };
  const library = {};
  const hud = readable ? await GiantBoostHud.load(library, deps,
    (models, textures, panelEntries) =>
      new GiantBoostHud(models, textures, panelEntries, deps))
    : await Original.load(library);
  const result = { events, modelCount: hud.models.length,
    panelCount: hud.panels.length, duration: hud.boostDuration };
  hud.dispose();
  return { ...result, events };
}

test("Giant Boost authored asset loading and camera setup match release", async () => {
  assert.deepEqual(await exerciseLoad(true), await exerciseLoad(false));
});
