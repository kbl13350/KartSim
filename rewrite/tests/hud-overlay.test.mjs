import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { captureUiTransition, HudOverlay } from "../src/ui/hud-overlay.ts";
import { PerformanceCounter } from "../src/ui/performance-counter.ts";
import { formatDiagnosticsLines } from "../src/ui/engine-diagnostics.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const OriginalHud = new Function("Uo", "ko0", "qo0",
  `${sourceOf("Uo0")}\n${["Wo0", "Ho0", "X1", "QE", "JE", "Ko0", "$o0"].map(sourceOf).join("\n")};
  return $o0;`,
)(39, PerformanceCounter, formatDiagnosticsLines);

function runHud(Hud, isOriginal) {
  const events = [];
  const nodes = new Map();
  class Element {
    dataset = {};
    style = {
      values: {},
      setProperty: (name, value) => { this.style.values[name] = value; },
      removeProperty: name => { delete this.style.values[name]; },
    };
    attributes = {};
    children = [];
    classNames = new Set();
    classList = {
      add: (...names) => names.forEach(name => this.classNames.add(name)),
      remove: (...names) => names.forEach(name => this.classNames.delete(name)),
      contains: name => this.classNames.has(name),
      toggle: (name, force) => {
        if (force === undefined ? !this.classNames.has(name) : force)
          this.classNames.add(name);
        else this.classNames.delete(name);
      },
    };
    constructor(name) { this.name = name; }
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, new Element(selector));
      return nodes.get(selector);
    }
    append(...children) { this.children.push(...children); }
    insertAdjacentHTML(_position, html) { this.extraHtml = html; }
    addEventListener(name, listener) { events.push(["add", this.name, name]); }
    removeEventListener(name, listener) { events.push(["remove", this.name, name]); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    remove() { this.removed = true; }
  }
  const doc = {
    body: new Element("body"),
    visibilityState: "visible",
    createElement: name => new Element(name),
    addEventListener: name => events.push(["document add", name]),
    removeEventListener: name => events.push(["document remove", name]),
  };
  const win = {
    addEventListener: name => events.push(["window add", name]),
    removeEventListener: name => events.push(["window remove", name]),
    clearTimeout: id => events.push(["clear timer", id]),
    setTimeout: (_callback, duration) => {
      events.push(["timer", duration]);
      return 17;
    },
  };
  const root = new Element("root");
  root.ownerDocument = doc;
  const globals = ["document", "window", "performance"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    document: doc, window: win, performance: { now: () => 1_000 },
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const callbacks = { returnToReady() {}, collectEngineDiagnostics: () => null };
    const hud = isOriginal ? new Hud(root, callbacks) :
      new Hud(root, callbacks, "39.11");
    hud.beginLoading();
    hud.setLoadingProgress("archive", 50, 100, "50/100");
    hud.setLoadingProgress("index", 10, 10);
    hud.finishLoading();
    hud.setLoadingProgress("next", 20, 40);
    hud.beginPerformanceRace(100);
    hud.recordPerformanceFrame(16, 5, 120, { io: 2 });
    hud.update({ state: "Racing" }, 59.8);
    hud.onDebugKeyDown({ code: "F2", repeat: false,
      preventDefault() { events.push("F2 prevent"); } });
    hud.onDebugKeyDown({ code: "F3", repeat: false,
      preventDefault() { events.push("F3 prevent"); } });
    hud.setPaused(true);
    hud.setPaused(false);
    hud.showDebugText("sample");
    hud.showLoadingError("failed");
    hud.finishPerformanceRace(200);
    hud.onVisibilityChange();
    const snapshot = {
      elementHtml: hud.element.innerHTML,
      engineHtml: hud.element.extraHtml,
      systemHtml: hud.systemElement.innerHTML,
      debugVisible: hud.debugVisible,
      engineVisible: hud.engineVisible,
      latestFps: hud.latestFps,
      latestState: hud.latestState,
      debugOutput: hud.debugOutput.textContent,
      engineOutput: hud.debugEngineOutput.textContent,
      loadingError: { text: hud.loadingError.textContent,
        hidden: hud.loadingError.hidden },
      loadingFab: { hidden: hud.loadingFab.hidden,
        classes: [...hud.systemElement.classNames] },
      progress: [...hud.loadingProgress],
      panelClasses: [...hud.debugPanel.classNames],
      engineClasses: [...hud.debugEnginePanel.classNames],
      pauseClasses: [...hud.pauseOverlay.classNames],
      loadingClasses: [...hud.loadingView.classNames],
      labelAttributes: hud.loadingLabel.attributes,
      ringAttributes: hud.loadingFabRing.attributes,
      lines: hud.debugTextList.children.map(line =>
        ({ text: line.textContent, kind: line.dataset.kind })),
    };
    hud.dispose();
    return { events, snapshot, disposed: [hud.element.removed,
      hud.systemElement.removed] };
  } finally {
    for (const name of globals) {
      const descriptor = previous[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("HUD startup, pause, loading and F2/F3 panels match release", () => {
  assert.deepEqual(runHud(HudOverlay, false), runHud(OriginalHud, true));
});

test("transition screenshot composites visible canvas layers like release", () => {
  const originalCapture = new Function(`${sourceOf("eT")}; return eT;`)();
  const run = capture => {
    const calls = [];
    const layer = (name, zIndex, left, hidden = false) => ({
      name, hidden, getBoundingClientRect: () =>
        ({ left, top: 20, width: 100, height: 50 }),
      style: { zIndex, display: "block", visibility: "visible", opacity: "0.75" },
    });
    const layers = [layer("upper", "2", 30), layer("lower", "1", 10),
      layer("hidden", "3", 50, true)];
    const context = {
      scale: (...args) => calls.push(["scale", ...args]),
      drawImage: (source, ...args) =>
        calls.push(["draw", source.name, ...args, context.globalAlpha]),
    };
    const canvas = {
      style: {}, setAttribute: (...args) => calls.push(["attribute", ...args]),
      getContext: () => context,
      remove: () => calls.push("removed"),
    };
    const root = {
      getBoundingClientRect: () =>
        ({ left: 5, top: 10, width: 300, height: 180 }),
      querySelectorAll: () => layers,
      append: item => calls.push(["append", item.width, item.height,
        { ...item.style }]),
    };
    const oldDocument = globalThis.document;
    const oldWindow = globalThis.window;
    const oldStyle = globalThis.getComputedStyle;
    globalThis.document = { createElement: () => canvas };
    globalThis.window = { devicePixelRatio: 1.5 };
    globalThis.getComputedStyle = element => element.style;
    try {
      const cleanup = capture(root);
      cleanup();
      return calls;
    } finally {
      globalThis.document = oldDocument;
      globalThis.window = oldWindow;
      globalThis.getComputedStyle = oldStyle;
    }
  };
  assert.deepEqual(run(captureUiTransition), run(originalCapture));
});
