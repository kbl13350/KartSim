import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  disposeGarageView,
  freezeGarageView,
  loadGarageView,
  resizeGarageSurface,
  showGarageView,
  unfreezeGarageView,
  type GarageLifecycleHost,
  type GarageLoadDependencies,
  type GarageLoadHost,
  type GarageLoadOptions,
  type GarageViewportHost,
} from "./garage-lifecycle";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
if (!classNode || classNode.type !== "ClassDeclaration") throw new Error("As class missing");
const viewClass = classNode;

function methodBody(name: string): string {
  const method = viewClass.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === name);
  assert.ok(method && method.type === "ClassMethod", `As.${name}`);
  return release.slice(method.body.start! + 1, method.body.end! - 1);
}

type TestLoadHost = GarageLoadHost & {
  trace: unknown[];
  inertValues: boolean[];
  disposed: boolean;
};

async function loadFixture(rewritten: boolean, failAt?: string) {
  const events: unknown[] = [];
  const options = { library: "library", environment: "environment", stageBinding: "stage", stageWidth: 1200 };
  let factoryCallbacks: Array<(...args: never[]) => unknown> = [];
  let inertCallback: ((inert: boolean) => void) | undefined;
  const host: TestLoadHost = {
    trace: events,
    inertValues: [],
    disposed: false,
    surface: { append: child => { events.push(["append", child]); } },
    controls: { inert: false },
    progressionPanel: { element: { inert: false } },
    previewRect: { width: 200, height: 130 },
    pageMode: "factory",
    setFactory: value => { events.push(["setFactory", value]); return value; },
    updateControls: () => { events.push("updateControls"); },
    showFactoryTutorial: () => { events.push("tutorial"); },
    dispose: () => { events.push("dispose-view"); host.disposed = true; },
  };
  const fail = (stage: string) => {
    if (failAt === stage) throw new Error(stage);
  };
  const normalize = (width: number) => { events.push(["normalize", width]); return { width: 1180 }; };
  const assets = async (library: unknown, width: number) => {
    events.push(["assets", library, width]); fail("assets"); return "assets";
  };
  const previews = async (_options: unknown) => { events.push("previews"); fail("previews"); return "previews"; };
  const layout = async (library: unknown, name: string, width: number) => {
    events.push(["layout", library, name, width]); fail(name); return name;
  };
  const create = (_options: unknown, a: unknown, t: unknown, p: unknown) => {
    events.push(["view", a, t, p]); return host;
  };
  const panel = (
    tuning: unknown,
    onSet: (...args: never[]) => unknown,
    onConfirm: (...args: never[]) => unknown,
    onUpdate: (...args: never[]) => unknown,
    onTutorial: (...args: never[]) => unknown,
  ) => {
    events.push(["factory-panel", tuning]); fail("factory-panel");
    factoryCallbacks = [onSet, onConfirm, onUpdate, onTutorial];
    return { element: { hidden: false, inert: false }, resizeCanvases: () => {} };
  };
  const confirmation = async (_library: unknown, _surface: unknown, setInert: (inert: boolean) => void) => {
    events.push("confirmation"); fail("confirmation"); inertCallback = setInert;
    return { open: (...args: unknown[]) => { events.push(["open", ...args]); } };
  };
  const panels = async (...args: unknown[]) => {
    events.push(["panels", ...args.slice(0, 3), args[4], args[5], args[6], args[7]]);
    fail("panels");
    return { setParticleModificationPageVisible: (visible: boolean) => events.push(["particle-page", visible]) };
  };
  const previewSize = (width: number, height: number) => {
    events.push(["preview-size", width, height]); return [width, height];
  };
  const dependencies: GarageLoadDependencies<TestLoadHost> = {
    defaultStageWidth: 1600,
    normalizeStage: normalize,
    loadAssets: assets,
    loadPreviews: previews,
    loadLayout: layout,
    createView: create,
    createFactoryPanel: panel,
    loadConfirmation: confirmation,
    loadPanels: panels,
    previewSize,
  };
  const OriginalPanel = class {
    element: { hidden: boolean; inert: boolean };
    constructor(tuning: unknown, onSet: (...args: never[]) => unknown,
      onConfirm: (...args: never[]) => unknown, onUpdate: (...args: never[]) => unknown,
      onTutorial: (...args: never[]) => unknown) {
      const result = panel(tuning, onSet, onConfirm, onUpdate, onTutorial);
      this.element = result.element;
    }
  };
  const OriginalView = class { constructor(o: unknown, a: unknown, t: unknown, p: unknown) { return create(o, a, t, p); } };
  const original = new Function("Ai", "_t", "zi", "Fn", "Wt", "As", "Pa", "ti", "si", "ii",
    `return async function(e) { ${methodBody("load")} };`)(
      1600, normalize, assets, previews, layout, OriginalView, OriginalPanel,
      { load: confirmation }, { load: panels }, previewSize,
    ) as (options: GarageLoadOptions) => Promise<TestLoadHost>;
  let result: TestLoadHost | undefined;
  let error: string | undefined;
  try {
    result = rewritten ? await loadGarageView(options, dependencies) : await original(options);
  } catch (caught) {
    error = (caught as Error).message;
  }
  if (result) {
    inertCallback?.(true);
    host.inertValues.push(host.controls.inert, host.progressionPanel.element.inert,
      host.factoryPanel?.element.inert ?? false);
    factoryCallbacks[0]?.("factory-value" as never);
    factoryCallbacks[1]?.("question" as never, "yes" as never, "no" as never);
    factoryCallbacks[2]?.();
    factoryCallbacks[3]?.();
  }
  return {
    events,
    error,
    created: !!result,
    disposed: host.disposed,
    inertValues: host.inertValues,
    panelHidden: host.factoryPanel?.element.hidden,
  };
}

test("As.load success and each asynchronous failure match resource and cleanup order", async () => {
  for (const failure of [undefined, "assets", "previews", "kartune", "tuning", "factory-panel", "confirmation", "panels"]) {
    assert.deepEqual(await loadFixture(true, failure), await loadFixture(false, failure), failure);
  }
});

function lifecycleFixture(rewritten: boolean) {
  const events: unknown[] = [];
  let taskbarPaint: (() => void) | undefined;
  const window = {
    addEventListener: (name: string) => { events.push(["listen", name]); },
    removeEventListener: (name: string) => { events.push(["unlisten", name]); },
  };
  const cancelAnimationFrame = (frame: number) => { events.push(["cancel", frame]); };
  const dependencies = { window: window as unknown as Window, cancelAnimationFrame };
  const view = {
    disposed: false,
    shown: false,
    frozen: false,
    frozenSnapshot: "frozen snapshot",
    strengtheningSnapshot: "strengthening snapshot",
    raf: 17,
    inventoryHitTestFrame: 18,
    element: { hidden: true, inert: false, style: { pointerEvents: "auto" }, remove: () => events.push("remove") },
    search: { focus: () => events.push("focus") },
    options: { taskbar: { composite: (_view: GarageLifecycleHost, paint: () => void) => {
      events.push("taskbar"); taskbarPaint = paint; return () => events.push("release-taskbar");
    } } },
    onKey: () => {},
    onWindowResize: () => {},
    resizeSurface: () => events.push("resize"),
    paintTaskbar: () => events.push("paint-taskbar"),
    frame: () => events.push("frame"),
    interactionAudioCleanup: () => events.push("audio-cleanup"),
    tutorialClose: () => events.push("tutorial-close"),
    preparation: { dispose: () => events.push("preparation-dispose") },
    exceedTypeChange: { dispose: () => events.push("exceed-dispose") },
    resize: { disconnect: () => events.push("resize-disconnect") },
    panels: { dispose: () => events.push("panels-dispose") },
    confirmation: { dispose: () => events.push("confirmation-dispose") },
    upgrade: { dispose: () => events.push("upgrade-dispose") },
    skillSelection: { dispose: () => events.push("skill-dispose") },
    pointEffects: { dispose: () => events.push("effects-dispose") },
    progressionPanel: { dispose: () => events.push("progression-dispose") },
    modelCache: { dispose: () => events.push("model-dispose") },
    controlCanvas: { dispose: () => events.push("control-dispose") },
    drawing: { dispose: () => events.push("drawing-dispose") },
  } as GarageLifecycleHost;
  const original = Object.fromEntries(["show", "freeze", "unfreeze", "dispose"].map(name => [name,
    new Function("window", "cancelAnimationFrame", `return function() { ${methodBody(name)} };`)(
      window, cancelAnimationFrame) as () => void]));
  const call = (name: "show" | "freeze" | "unfreeze" | "dispose") => {
    if (!rewritten) { (original[name] as () => void).call(view); return; }
    switch (name) {
      case "show": showGarageView(view, dependencies); break;
      case "freeze": freezeGarageView(view, dependencies); break;
      case "unfreeze": unfreezeGarageView(view); break;
      case "dispose": disposeGarageView(view, dependencies); break;
    }
  };
  const snapshot = () => ({
    events: structuredClone(events), disposed: view.disposed, shown: view.shown, frozen: view.frozen,
    frozenSnapshot: view.frozenSnapshot, strengtheningSnapshot: view.strengtheningSnapshot,
    hidden: view.element.hidden, inert: view.element.inert, pointerEvents: view.element.style.pointerEvents,
    hasTaskbar: !!view.releaseTaskbar, preparation: !!view.preparation, exceedTypeChange: !!view.exceedTypeChange,
  });
  return { call, paint: () => taskbarPaint?.(), snapshot };
}

test("show, freeze, unfreeze, and dispose match As ordering and repeated-call guards", () => {
  const run = (rewritten: boolean) => {
    const fixture = lifecycleFixture(rewritten);
    const states = [];
    for (const action of ["show", "show", "freeze", "unfreeze", "dispose", "show", "freeze", "unfreeze", "dispose"] as const) {
      fixture.call(action);
      if (action === "show") fixture.paint();
      states.push(fixture.snapshot());
    }
    return states;
  };
  assert.deepEqual(run(true), run(false));
});

test("generated GarageXView delegates loading and lifecycle methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-lifecycle\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["load", "loadGarageView"], ["show", "showGarageView"],
    ["freeze", "freezeGarageView"], ["unfreeze", "unfreezeGarageView"],
    ["dispose", "disposeGarageView"], ["resizeSurface", "resizeGarageSurface"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(`));
});

test("resizeSurface matches stage centering, snapshots, and canvas redraw", () => {
  const run = (rewritten: boolean) => {
    const events: unknown[] = [];
    const view: GarageViewportHost = {
      shown: true,
      frozen: false,
      frozenSnapshot: undefined,
      upgrade: {},
      preparation: { resizeCanvases: () => { events.push("resize-preparation"); } },
      confirmation: { resizeCanvases: () => { events.push("resize-confirmation"); } },
      factoryPanel: { resizeCanvases: () => { events.push("resize-factory"); } },
      options: { root: { getBoundingClientRect: () => {
        events.push("bounds"); return { width: 1000, height: 700 };
      } } },
      assets: { stage: { width: 1600, height: 900 } },
      surface: { style: { transform: "", left: "", top: "" } },
      canvas: "canvas",
      context: { setTransform: (...args) => { events.push(["transform", ...args]); } },
      inputSurface: { style: {} },
      renderPixelRatio: 1,
      drawing: {
        beginFrame: () => { events.push("begin-frame"); },
        drawCanvasLayer: (...args) => { events.push(["draw", ...args]); },
        endFrame: () => { events.push("end-frame"); },
      },
      captureStrengtheningStage: () => { events.push("capture-strengthening"); },
      captureStage: () => { events.push("capture-stage"); return "snapshot"; },
      paintTaskbar: () => { events.push("paint-taskbar"); },
    };
    const pixelRatio = () => { events.push("pixel-ratio"); return 2; };
    const sizeCanvas = (...args: unknown[]) => {
      events.push(["size-canvas", args[0], ...args.slice(2)]);
      return { scaleX: 2, scaleY: 2 };
    };
    const original = new Function("Pe", "Ee", `return function() { ${methodBody("resizeSurface")} };`)(
      sizeCanvas, pixelRatio) as () => void;
    const resize = () => rewritten
      ? resizeGarageSurface(view, { pixelRatio, sizeCanvas })
      : original.call(view);
    const states: unknown[] = [];
    const snapshot = () => ({
      events: structuredClone(events), style: structuredClone(view.surface.style),
      inputStyle: structuredClone(view.inputSurface?.style),
      renderPixelRatio: view.renderPixelRatio,
      frozenSnapshot: view.frozenSnapshot,
    });
    resize(); states.push(snapshot());
    view.frozen = true;
    resize(); states.push(snapshot());
    resize(); states.push(snapshot());
    view.shown = false;
    view.upgrade = undefined;
    view.preparation = undefined;
    view.frozen = false;
    resize(); states.push(snapshot());
    return states;
  };
  assert.deepEqual(run(true), run(false));
});
