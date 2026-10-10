import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  createGarageTransformPreviewButton, endGaragePreviewDrag,
  moveGaragePreviewDrag, startGaragePreviewDrag,
  type GaragePreviewInputHost,
} from "./garage-preview-input";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
const names = ["createTransformPreviewButton", "onDragStart", "onDragMove", "onDragEnd"];
const members = view.body.body.filter(node =>
  (node.type === "ClassMethod" || node.type === "ClassProperty") &&
  node.key.type === "Identifier" && names.includes(node.key.name));
assert.equal(members.length, names.length);
const source = members.map(member => release.slice(member.start!, member.end!)).join("\n");

class ElementStub {
  textContent = "";
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  classes: string[] = [];
  children: ElementStub[] = [];
  onclick?: () => void;
  classList = { add: (name: string) => { this.classes.push(name); } };
  constructor(readonly name: string) {}
  append(child: ElementStub) { this.children.push(child); }
  setAttribute(name: string, value: string) { this.attributes[name] = value; }
  snapshot(): unknown {
    return { name: this.name, text: this.textContent, dataset: { ...this.dataset },
      attrs: { ...this.attributes }, classes: [...this.classes],
      children: this.children.map(child => child.snapshot()) };
  }
}

type TestHost = GaragePreviewInputHost & {
  createTransformPreviewButton(): HTMLButtonElement;
  onDragStart(event: PointerEvent): void;
  onDragMove(event: PointerEvent): void;
  onDragEnd(event: PointerEvent): void;
};

function fixture(released: boolean, localized: boolean) {
  const events: unknown[] = [];
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const documentStub = { createElement: (name: string) => new ElementStub(name) };
  const Original = new Function("y", "document",
    `return class Original { ${source} };`)(attribute, documentStub) as new () => TestHost;
  const host = new Original();
  const previewNode = { children: [{ name: "Label", attrs: { text: "#sb(transform)" } }],
    attrs: { autoImage: "transform_" } };
  host.assets = { nodes: new Map(localized ? [["previewEquippedTailLamp_Xun", previewNode]] : []),
    strings: new Map([["transform", "切换形态"]]), stage: { width: 1000, height: 800 } };
  host.surface = { getBoundingClientRect: () =>
    ({ left: 20, top: 30, width: 500, height: 400 }) } as unknown as HTMLElement;
  host.canvas = { setPointerCapture: (id: number) => { events.push(["capture", id]); } } as unknown as HTMLCanvasElement;
  host.panels = {
    toggleTransformPreview: () => { events.push("toggle"); },
    beginPreviewRotation: () => { events.push("begin-rotation"); },
    rotatePreview: delta => { events.push(["rotate", delta]); },
  };
  host.button = (label, action) => {
    events.push(["button", label]);
    const button = new ElementStub("button");
    button.onclick = action;
    return button as unknown as HTMLButtonElement;
  };
  host.skin = (_button, base, states) => { events.push(["skin", base, states]); };
  host.place = (_button, rect) => { events.push(["place", rect]); };
  host.rect = name => { events.push(["rect", name]);
    return { x: 100, y: 100, width: 300, height: 200 }; };
  host.activePreviewRect = () => { events.push("active-rect");
    return { x: 100, y: 100, width: 300, height: 200 }; };
  host.finishPreviewDrag = id => { events.push(["finish-drag", id]); };
  host.syncTransformPreviewUi = () => { events.push("sync"); };
  host.transformPreviewSessionActive = () => { events.push("active"); return true; };
  if (!released) {
    host.createTransformPreviewButton = () => {
      const previous = globalThis.document;
      globalThis.document = documentStub as unknown as Document;
      try { return createGarageTransformPreviewButton(host, { attribute }); }
      finally { globalThis.document = previous; }
    };
    host.onDragStart = event => startGaragePreviewDrag(host, event);
    host.onDragMove = event => moveGaragePreviewDrag(host, event);
    host.onDragEnd = event => endGaragePreviewDrag(host, event);
  }
  const snapshot = () => ({ events: structuredClone(events), drag: host.drag });
  return { host, snapshot };
}

test("transform preview button label, skin, placement and click match As", () => {
  for (const localized of [true, false]) {
    const run = (released: boolean) => {
      const f = fixture(released, localized);
      const button = f.host.createTransformPreviewButton() as unknown as ElementStub;
      const before = { button: button.snapshot(), host: f.snapshot() };
      button.onclick?.();
      return { before, after: { button: button.snapshot(), host: f.snapshot() } };
    };
    assert.deepEqual(run(false), run(true), String(localized));
  }
});

test("preview pointer capture, rotation delta and release delegation match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released, true);
    const pointer = (id: number, x: number, y: number, button = 0) =>
      ({ pointerId: id, clientX: x, clientY: y, button }) as PointerEvent;
    f.host.onDragStart(pointer(3, 100, 100, 1));
    f.host.onDragStart(pointer(3, 25, 35));
    const outside = f.snapshot();
    f.host.onDragStart(pointer(3, 120, 120));
    f.host.onDragMove(pointer(4, 150, 130));
    f.host.onDragMove(pointer(3, 140, 130));
    f.host.onDragEnd(pointer(3, 140, 130));
    return { outside, final: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});
