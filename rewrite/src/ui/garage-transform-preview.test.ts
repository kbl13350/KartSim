import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  activeGaragePreviewRect,
  finishGaragePreviewDrag,
  flushGarageTransformPreviewStart,
  isGarageTransformPreviewSessionActive,
  moveToGarageTransformPreviewRoot,
  placeInGarageTransformPreviewRoot,
  startGarageTransformPreview,
  syncGarageTransformPreviewUi,
  type GarageTransformPreviewHost,
} from "./garage-transform-preview";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  hidden = false;
  inert = false;
  parentElement?: ElementStub;
  children: ElementStub[] = [];
  style = {
    pointerEvents: "auto", position: "", left: "", top: "", width: "", height: "",
  };
  constructor(readonly name: string, private readonly events: unknown[]) {}
  querySelectorAll(_selector: string): ElementStub[] {
    return this.children.filter(child => child.name !== "focus");
  }
  append(child: ElementStub): void {
    this.events.push(["append", this.name, child.name]);
    child.parentElement = this;
    this.children.push(child);
  }
  contains(candidate: ElementStub): boolean {
    return this === candidate || this.children.some(child => child.contains(candidate));
  }
  blur(): void { this.events.push(["blur", this.name]); }
  snapshot() {
    return {
      name: this.name, hidden: this.hidden, inert: this.inert,
      style: { ...this.style }, parent: this.parentElement?.name,
    };
  }
}

type TestHost = GarageTransformPreviewHost & {
  startTransformPreview(immediate?: boolean): void;
  moveToTransformPreviewRoot(control: HTMLElement): void;
  placeInTransformPreviewRoot(control: HTMLElement, rect: { x: number; y: number; width: number; height: number }): void;
  activePreviewRect(): { x: number; y: number; width: number; height: number };
  finishPreviewDrag(pointerId: number): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub: { activeElement?: ElementStub } = {};
  const Original = new Function("HTMLElement", "document", `${classSource}; return As;`)(
    ElementStub, documentStub,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const controls = new ElementStub("controls", events);
  const title = new ElementStub("title", events);
  const focus = new ElementStub("focus", events);
  title.children.push(focus);
  const inventory = new ElementStub("inventory", events);
  const root = new ElementStub("root", events);
  controls.children.push(title, inventory);
  documentStub.activeElement = focus;
  host.controls = controls as unknown as HTMLElement;
  host.transformPreviewPartsRoot = root as unknown as HTMLElement;
  host.transformPreviewStartPending = false;
  host.transformPreviewUiHidden = false;
  host.transformPreviewUiRestore = undefined;
  host.pageMode = "parts";
  host.previewRect = { x: 1, y: 2, width: 3, height: 4 };
  host.progressionPanel = { previewRect: { x: 10, y: 20, width: 30, height: 40 } };
  host.factoryPanel = { previewRect: { x: 100, y: 200, width: 300, height: 400 } };
  const panels = {
    isTransformPreviewSessionActive: false,
    isTransformPreviewEnabled: true,
    isPreviewReady: false,
    beginTransformPreviewSession: () => {
      events.push("begin");
      panels.isTransformPreviewSessionActive = true;
    },
    restartTransformPreview: () => { events.push("restart"); },
    resetPreviewRotation: () => { events.push("reset-rotation"); },
  };
  host.panels = panels;
  let captured = false;
  host.canvas = {
    hasPointerCapture: (id: number) => { events.push(["has-capture", id]); return captured; },
    releasePointerCapture: (id: number) => { events.push(["release-capture", id]); captured = false; },
  } as unknown as HTMLCanvasElement;
  if (!released) {
    host.startTransformPreview = immediate => startGarageTransformPreview(host, immediate);
    host.transformPreviewSessionActive = () => isGarageTransformPreviewSessionActive(host);
    host.flushTransformPreviewStart = () => flushGarageTransformPreviewStart(host);
    host.syncTransformPreviewUi = () => syncGarageTransformPreviewUi(host);
    host.moveToTransformPreviewRoot = control => moveToGarageTransformPreviewRoot(host, control);
    host.placeInTransformPreviewRoot = (control, rect) => placeInGarageTransformPreviewRoot(host, control, rect);
    host.activePreviewRect = () => activeGaragePreviewRect(host);
    host.finishPreviewDrag = id => finishGaragePreviewDrag(host, id);
  }
  const snapshot = () => ({
    events: structuredClone(events),
    flags: [host.transformPreviewStartPending, host.transformPreviewUiHidden,
      host.transformPreviewSessionActive()],
    elements: [title, inventory, root].map(element => element.snapshot()),
    saved: [...host.transformPreviewUiRestore ?? []].map(([control, state]) => [
      (control as unknown as ElementStub).name, { ...state },
    ]),
    drag: host.drag,
  });
  return {
    host, panels, controls, title, inventory, root, events, snapshot,
    setCapture: (value: boolean) => { captured = value; },
  };
}

function withElementGlobals<T>(run: () => T): T {
  const previousElement = globalThis.HTMLElement;
  const previousDocument = globalThis.document;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  // The original class has its own injected document; the rewritten function uses this one.
  globalThis.document = { activeElement: undefined } as unknown as Document;
  try { return run(); }
  finally {
    globalThis.HTMLElement = previousElement;
    globalThis.document = previousDocument;
  }
}

test("transform preview waits for readiness, hides part UI and restores saved states like As", () => {
  const run = (released: boolean) => withElementGlobals(() => {
    const f = fixture(released);
    // Point both implementations at the same focused child for blur behavior.
    (globalThis.document as unknown as { activeElement?: ElementStub }).activeElement = f.title.children[0];
    const states: unknown[] = [];
    f.host.syncTransformPreviewUi();
    states.push(f.snapshot());
    f.host.startTransformPreview();
    states.push(f.snapshot());
    f.title.hidden = false;
    f.title.style.pointerEvents = "forced";
    f.host.syncTransformPreviewUi();
    f.host.flushTransformPreviewStart();
    states.push(f.snapshot());
    f.panels.isPreviewReady = true;
    f.host.flushTransformPreviewStart();
    states.push(f.snapshot());
    f.host.startTransformPreview(true);
    states.push(f.snapshot());
    f.panels.isTransformPreviewSessionActive = false;
    f.host.syncTransformPreviewUi();
    states.push(f.snapshot());
    return states;
  });
  assert.deepEqual(run(false), run(true));
});

test("missing controls and legacy session fallback match As", () => {
  const run = (released: boolean) => withElementGlobals(() => {
    const f = fixture(released);
    f.host.controls = undefined;
    f.host.panels = { isTransformPreviewEnabled: true, restartTransformPreview: () => {} };
    const legacy = f.host.transformPreviewSessionActive();
    f.host.startTransformPreview();
    const pending = f.snapshot();
    f.host.panels = undefined;
    const absent = f.host.transformPreviewSessionActive();
    f.host.transformPreviewStartPending = false;
    f.host.syncTransformPreviewUi();
    return { legacy, absent, pending, restored: f.snapshot() };
  });
  assert.deepEqual(run(false), run(true));
});

test("preview geometry, moving controls and pointer release match As", () => {
  const run = (released: boolean) => withElementGlobals(() => {
    const f = fixture(released);
    const rects: unknown[] = [];
    for (const page of ["parts", "level", "factory"]) {
      f.host.pageMode = page;
      rects.push({ ...f.host.activePreviewRect() });
    }
    f.host.factoryPanel = undefined;
    rects.push({ ...f.host.activePreviewRect() });
    f.host.moveToTransformPreviewRoot(f.title as unknown as HTMLElement);
    f.host.moveToTransformPreviewRoot(f.title as unknown as HTMLElement);
    f.host.placeInTransformPreviewRoot(f.inventory as unknown as HTMLElement,
      { x: 4, y: 5, width: 60, height: 70 });
    f.host.drag = { id: 7, x: 14 };
    f.setCapture(true);
    f.host.finishPreviewDrag(6);
    const mismatched = f.snapshot();
    f.host.finishPreviewDrag(7);
    return { rects, mismatched, final: f.snapshot() };
  });
  assert.deepEqual(run(false), run(true));
});

test("generated Garage view delegates the eight transform preview methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const generatedView = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  if (!generatedView || generatedView.type !== "ClassDeclaration")
    throw new Error("Generated As class missing");
  const delegates = new Map([
    ["startTransformPreview", "startGarageTransformPreview"],
    ["transformPreviewSessionActive", "isGarageTransformPreviewSessionActive"],
    ["flushTransformPreviewStart", "flushGarageTransformPreviewStart"],
    ["syncTransformPreviewUi", "syncGarageTransformPreviewUi"],
    ["moveToTransformPreviewRoot", "moveToGarageTransformPreviewRoot"],
    ["placeInTransformPreviewRoot", "placeInGarageTransformPreviewRoot"],
    ["activePreviewRect", "activeGaragePreviewRect"],
    ["finishPreviewDrag", "finishGaragePreviewDrag"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = generatedView.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`\\b${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageTransformPreviewOverrides, [...delegates.keys()]);
});
