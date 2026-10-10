import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  intersectGarageRect, rebuildGarageControlCanvas,
} from "./garage-control-canvas-rebuild";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name: string): string {
  const node = nodes.find(candidate =>
    (candidate.type === "ClassDeclaration" || candidate.type === "FunctionDeclaration") &&
    candidate.id?.name === name);
  assert.ok(node);
  return release.slice(node.start!, node.end!);
}
const oldIntersect = new Function(sourceOf("ct") + ";return ct;")() as
  typeof intersectGarageRect;

function fixture(released: boolean, overlayOnly = false, empty = false) {
  const events: unknown[] = [];
  const bounds = (x: number, y: number, width: number, height: number) =>
    ({ x, y, width, height });
  class ElementStub {
    hidden = false;
    children: ElementStub[] = [];
    childNodes: Array<{ nodeType: number; textContent: string }> = [];
    classes: string[] = [];
    classList = { contains: (name: string) => this.classes.includes(name) };
    style = {
      display: "block", visibility: "visible", opacity: "1",
      overflowX: "visible", overflowY: "visible",
      outlineWidth: "0", outlineOffset: "0", objectFit: "contain",
      font: "12px Test", color: "#fff", zIndex: "0",
    };
    constructor(readonly name: string,
      readonly box: { x: number; y: number; width: number; height: number }) {}
    getBoundingClientRect() { return this.box; }
  }
  class CanvasStub extends ElementStub {
    width = 0;
    height = 0;
    getContext(_kind: string) {
      return {
        setTransform: (...args: unknown[]) => { events.push(["transform", ...args]); },
        save: () => { events.push("save"); },
        beginPath: () => { events.push("begin"); },
        rect: (...args: unknown[]) => { events.push(["clip-rect", ...args]); },
        clip: () => { events.push("clip"); },
        restore: () => { events.push("restore"); },
        drawImage: (image: ElementStub, ...args: unknown[]) =>
          { events.push(["image", image.name, ...args]); },
        fillText: (...args: unknown[]) => { events.push(["text", ...args]); },
        globalAlpha: 1,
      };
    }
  }
  class ImageStub extends ElementStub {
    complete = true;
    naturalWidth = 40;
    naturalHeight = 20;
  }
  class SelectStub extends ElementStub {
    selectedOptions = [{ textContent: "Option" }];
  }
  const oldGlobals = {
    document: globalThis.document,
    getComputedStyle: globalThis.getComputedStyle,
    HTMLElement: globalThis.HTMLElement,
    HTMLCanvasElement: globalThis.HTMLCanvasElement,
    HTMLImageElement: globalThis.HTMLImageElement,
    HTMLSelectElement: globalThis.HTMLSelectElement,
    Node: globalThis.Node,
  };
  const documentStub = {
    createElement: (name: string) => new CanvasStub(name, bounds(0, 0, 0, 0)),
    createRange: () => ({
      setStart: (_node: unknown, _offset: number) => undefined,
      setEnd: (_node: unknown, _offset: number) => undefined,
      getBoundingClientRect: () => bounds(30, 35, 5, 10),
    }),
  };
  const computedStyle = (element: Element) =>
    (element as unknown as ElementStub).style as unknown as CSSStyleDeclaration;
  globalThis.document = documentStub as unknown as Document;
  globalThis.getComputedStyle = computedStyle;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  globalThis.HTMLCanvasElement = CanvasStub as unknown as typeof HTMLCanvasElement;
  globalThis.HTMLImageElement = ImageStub as unknown as typeof HTMLImageElement;
  globalThis.HTMLSelectElement = SelectStub as unknown as typeof HTMLSelectElement;
  globalThis.Node = { TEXT_NODE: 3 } as typeof Node;
  const paintBox = (_context: unknown, _style: unknown, rect: unknown) =>
    { events.push(["box", rect]); };
  const paintCharacter = (_context: unknown, _style: unknown,
    character: string, rect: unknown) =>
    { events.push(["character", character, rect]); };
  const oldFit = new Function(sourceOf("Cs") + ";return Cs;")();
  const oldZ = new Function("getComputedStyle", sourceOf("Ke") + ";return Ke;")(
    computedStyle);
  const Old = new Function(
    "ct", "Ei", "Cs", "Si", "Ke", "document", "getComputedStyle",
    "HTMLElement", "HTMLCanvasElement", "HTMLImageElement",
    "HTMLSelectElement", "Node", sourceOf("Pi") + ";return Pi;",
  )(oldIntersect, paintBox, oldFit, paintCharacter, oldZ,
    documentStub, computedStyle, ElementStub, CanvasStub, ImageStub,
    SelectStub, globalThis.Node) as new (...args: never[]) => {
      rebuild(): void;
      layers: Array<{ canvas: ElementStub; rect: unknown; clip?: unknown;
        live: boolean; alpha?: number }>;
    };
  const surface = new ElementStub("surface",
    bounds(10, 20, empty ? 0 : 800, empty ? 0 : 450));
  const label = new ElementStub("label", bounds(20, 30, 100, 30));
  label.childNodes = [{ nodeType: 3, textContent: "Hi" }];
  const canvas = new CanvasStub("live-canvas", bounds(30, 70, 160, 90));
  const image = new ImageStub("kart-image", bounds(50, 180, 90, 60));
  const select = new SelectStub("selector", bounds(160, 190, 100, 30));
  surface.children = [label, canvas, image, select];
  if (overlayOnly) label.classes.push("garage-x-controls");
  const host = released
    ? Object.create(Old.prototype) as InstanceType<typeof Old>
    : {} as InstanceType<typeof Old>;
  Object.assign(host, {
    surface, width: 1600, height: 900, ratio: 1,
    overlayOnly, layers: [],
    image: (_url: string) => undefined,
  });
  const rebuild = () => released ? host.rebuild()
    : rebuildGarageControlCanvas(host as unknown as Parameters<
        typeof rebuildGarageControlCanvas>[0], {
        intersect: intersectGarageRect,
        paintBox, paintCharacter,
      });
  const snapshot = () => ({
    events: structuredClone(events),
    layers: host.layers.map((layer: { canvas: ElementStub; rect: unknown;
      clip?: unknown; live: boolean; alpha?: number }) => ({
      canvas: layer.canvas.name, rect: layer.rect, clip: layer.clip,
      live: layer.live, alpha: layer.alpha,
      width: (layer.canvas as CanvasStub).width,
      height: (layer.canvas as CanvasStub).height,
    })),
  });
  const restore = () => {
    globalThis.document = oldGlobals.document;
    globalThis.getComputedStyle = oldGlobals.getComputedStyle;
    globalThis.HTMLElement = oldGlobals.HTMLElement;
    globalThis.HTMLCanvasElement = oldGlobals.HTMLCanvasElement;
    globalThis.HTMLImageElement = oldGlobals.HTMLImageElement;
    globalThis.HTMLSelectElement = oldGlobals.HTMLSelectElement;
    globalThis.Node = oldGlobals.Node;
  };
  return { rebuild, snapshot, restore };
}

test("control canvas clips, raster groups and live layers match Pi.rebuild", () => {
  for (const [overlayOnly, empty] of [[false, false], [true, false],
    [false, true]] as Array<[boolean, boolean]>) {
    const run = (released: boolean) => {
      const f = fixture(released, overlayOnly, empty);
      try {
        f.rebuild();
        return f.snapshot();
      } finally { f.restore(); }
    };
    assert.deepEqual(run(false), run(true),
      JSON.stringify({ overlayOnly, empty }));
  }
});

test("control rectangle intersection matches ct including disjoint bounds", () => {
  const left = { x: 10, y: 20, width: 50, height: 60 };
  for (const right of [
    { x: 30, y: 40, width: 70, height: 80 },
    { x: 100, y: 200, width: 30, height: 40 },
    { x: 10, y: 20, width: 0, height: 0 },
  ]) {
    assert.deepEqual(intersectGarageRect(left, right),
      oldIntersect(left, right));
  }
});
