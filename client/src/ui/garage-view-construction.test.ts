import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  initializeGarageView,
  type GarageViewConstructionAssets,
  type GarageViewConstructionDependencies,
  type GarageViewConstructionHost,
  type GarageViewConstructionOptions,
} from "./garage-view-construction";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const garageNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(garageNode && garageNode.type === "ClassDeclaration");
const garage = garageNode;
const constructor = garage.body.body.find(node =>
  node.type === "ClassMethod" && node.kind === "constructor");
assert.ok(constructor && constructor.type === "ClassMethod");
const releasedBody = release.slice(constructor.body.start! + 1, constructor.body.end! - 1);

class ElementStub {
  className = "";
  textContent = "";
  hidden = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attributes: Record<string, string> = {};
  children: ElementStub[] = [];
  listeners: string[] = [];
  width = 0;
  height = 0;
  constructor(readonly name: string) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  addEventListener(name: string, _callback: unknown) { this.listeners.push(name); }
  snapshot(): unknown {
    return { name: this.name, className: this.className, text: this.textContent,
      hidden: this.hidden, dataset: { ...this.dataset }, style: { ...this.style },
      attributes: { ...this.attributes }, children: this.children.map(child => child.snapshot()),
      listeners: [...this.listeners], width: this.width, height: this.height };
  }
}

type TestHost = GarageViewConstructionHost & {
  modelCache: { load(path: string): unknown; fail(path: string, error: unknown): void };
  pointEffects: { load(path: string): unknown; fail(message: string): void };
  progressionPanel: { element: HTMLElement; change(value: unknown): void;
    select(index: number): void; exceed(): void };
  resize: { observe(root: HTMLElement): void; notify(): void };
};

function run(released: boolean, variant: "normal" | "system" | "invalid" |
  "missing" | "no-preview", audio = true) {
  const events: unknown[] = [];
  const element = (name: string) => new ElementStub(name);
  const root = element("root");
  const selectedKartItemId = variant === "invalid" ? -1 : variant === "system" ? 0 : 7;
  const options = {
    selectedKartItemId,
    catalog: { karts: variant === "missing" ? [] : [
      { itemId: 7, systemKey: "kart-seven" },
      { itemId: 0, systemKey: "different" },
      { itemId: 0, systemKey: "selected-system" },
    ] },
    profile: { equipment: { systemKart: "selected-system" }, garage: { level: 4 } },
    library: { name: "library" }, environment: "preview", stageBinding: "stage",
    root: root as unknown as HTMLElement,
    onHover: audio ? () => { events.push("hover"); } : undefined,
    onActivate: audio ? () => { events.push("activate"); } : undefined,
  } satisfies GarageViewConstructionOptions;
  const assets = {
    rects: new Map(variant === "no-preview" ? [] : [["kartPreview",
      { x: 5, y: 6, width: 330, height: 210 }]]),
    stage: { width: 1024, height: 768 }, fontFamily: "Kart Font",
  } satisfies GarageViewConstructionAssets;
  const host = {
    element: element("view"), surface: element("surface"), canvas: element("canvas"),
    controls: element("controls"), transformPreviewPartsRoot: element("parts-root"),
    inputSurface: element("input"), search: element("search"), status: element("status"),
    onWindowResize: () => { events.push("window-resize"); },
    onDragStart: () => { events.push("drag-start"); },
    onDragMove: () => { events.push("drag-move"); },
    onDragEnd: () => { events.push("drag-end"); },
    buildControls: () => { events.push("build-controls"); },
    updateControls: () => { events.push("update-controls"); },
    resizeSurface: () => { events.push("resize-surface"); },
    requestProgression: (progression: unknown) => { events.push(["progression", progression]); },
    requestSkillSelection: (index: number) => { events.push(["skill", index]); },
    requestExceedTypeChange: () => { events.push("exceed"); },
  } as unknown as TestHost;
  const windowStub = { addEventListener: (name: string) => { events.push(["window-listener", name]); } };
  const validateKart = (id: number) => {
    events.push(["validate", id]);
    if (id === -1) throw new Error("Unknown kart");
  };
  const loadModel = (library: unknown, path: string, environment: unknown, stage: unknown) => {
    events.push(["load-model", library, path, environment, stage]); return `model:${path}`;
  };
  class Drawing {
    context = { name: "context" } as unknown as CanvasRenderingContext2D;
    constructor(canvas: ElementStub) { events.push(["drawing", canvas.name]); }
  }
  class ModelCache {
    constructor(readonly load: (path: string) => unknown,
      readonly fail: (path: string, error: unknown) => void) {
      events.push("model-cache");
    }
  }
  const bindAudio = (_element: unknown, settings: { playHover(): void; playClick(): void } |
    undefined, filters: unknown) => {
    events.push(["audio", !!settings, filters]);
    settings?.playHover(); settings?.playClick();
    return "audio-cleanup";
  };
  class ProgressionPanel {
    element = element("progression");
    constructor(tuning: unknown, readonly change: (value: unknown) => void,
      readonly select: (index: number) => void, readonly exceed: () => void) {
      events.push(["progression-panel", tuning]);
    }
  }
  class PointEffects {
    constructor(surface: ElementStub, tuning: unknown,
      readonly load: (path: string) => unknown, readonly fail: (message: string) => void) {
      events.push(["point-effects", surface.name, tuning]);
    }
  }
  class ControlCanvas {
    constructor(surface: ElementStub, width: number, height: number) {
      events.push(["control-canvas", surface.name, width, height]);
    }
  }
  class ResizeObserverStub {
    constructor(readonly notify: () => void) { events.push("resize-observer"); }
    observe(target: ElementStub) { events.push(["observe", target.name]); }
  }
  const dependencies: GarageViewConstructionDependencies = {
    validateKart, createDrawing: canvas => new Drawing(canvas as unknown as ElementStub),
    createModelCache: (load, fail) => new ModelCache(load, fail), loadModel,
    bindInteractionAudio: bindAudio, isHoverAudible: "hover-filter",
    isClickAudible: "click-filter",
    createProgressionPanel: (tuning, change, select, exceed) =>
      new ProgressionPanel(tuning, change, select, exceed) as unknown as { element: HTMLElement },
    createPointEffects: (surface, tuning, load, fail) =>
      new PointEffects(surface as unknown as ElementStub, tuning, load, fail),
    createControlCanvas: (surface, width, height) =>
      new ControlCanvas(surface as unknown as ElementStub, width, height),
    createResizeObserver: notify => new ResizeObserverStub(notify) as unknown as {
      observe(root: HTMLElement): void;
    },
    window: windowStub as unknown as Window,
  };
  const original = new Function("Ft", "Js", "Qi", "Je", "ei", "xi", "Ci",
    "va", "Ka", "Pi", "ResizeObserver", "window",
    `return function(e,t,s,i) {${releasedBody}};`)(
      validateKart, Drawing, ModelCache, loadModel, bindAudio,
      "hover-filter", "click-filter", ProgressionPanel, PointEffects,
      ControlCanvas, ResizeObserverStub, windowStub,
    ) as (this: TestHost, options: GarageViewConstructionOptions,
      assets: GarageViewConstructionAssets, tuning: unknown, previews: unknown) => void;
  let error: string | undefined;
  try {
    if (released) original.call(host, options, assets, "tuning", "previews");
    else initializeGarageView(host, options, assets, "tuning", "previews", dependencies);
  } catch (cause) { error = String(cause); }
  if (!error) {
    host.modelCache.load("body.rho");
    host.modelCache.fail("wheel.rho", new Error("Decode failed"));
    host.pointEffects.load("sparks.rho");
    host.pointEffects.fail("Part effect failed");
    host.progressionPanel.change("next");
    host.progressionPanel.select(2);
    host.progressionPanel.exceed();
    host.resize.notify();
  }
  return { error, events: structuredClone(events), selected: host.selected,
    configuration: host.configuration, previewRect: host.previewRect,
    canvas: (host.canvas as unknown as ElementStub).snapshot(),
    view: (host.element as unknown as ElementStub).snapshot(),
    root: root.snapshot(), status: host.status.textContent,
    interactionAudioCleanup: host.interactionAudioCleanup,
  };
}

test("Garage construction, selected kart, DOM, services and callbacks match As", () => {
  for (const variant of ["normal", "system", "invalid", "missing", "no-preview"] as const)
    for (const audio of [true, false])
      assert.deepEqual(run(false, variant, audio), run(true, variant, audio),
        `${variant}, audio=${audio}`);
});
