import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  disposeGarageControlCanvas, drawGarageControlCanvas, garageControlImage,
  garageControlZIndex, garageObjectFitRect, initializeGarageControlCanvas,
} from "./garage-control-canvas-lifecycle";
import { GarageControlCanvas } from "./garage-control-canvas";
import { intersectGarageRect } from "./garage-control-canvas-rebuild";

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
const classNode = nodes.find(node => node.type === "ClassDeclaration" && node.id?.name === "Pi");
assert.ok(classNode && classNode.type === "ClassDeclaration");
const classSource = sourceOf("Pi");
const replacements = new Map([
  ["constructor", "constructor(e,t,s) { initializeGarageControlCanvas(this,e,t,s); }"],
  ["draw", "draw(e,t,s=false) { return drawGarageControlCanvas(this,e,t,s); }"],
  ["dispose", "dispose() { return disposeGarageControlCanvas(this); }"],
  ["image", "image(e) { return garageControlImage(this,e); }"],
]);
let rewrittenSource = classSource;
for (const member of classNode.body.body.filter(member =>
  member.type === "ClassMethod" && member.key.type === "Identifier" &&
  replacements.has(member.key.name)).sort((a, b) => b.start! - a.start!)) {
  const method = member as { key: { name: string } };
  const replacement = replacements.get(method.key.name)!;
  rewrittenSource = rewrittenSource.slice(0, member.start! - classNode.start!) +
    replacement + rewrittenSource.slice(member.end! - classNode.start!);
}

function fixture(released: boolean, directClass = false) {
  const events: unknown[] = [];
  const oldDocument = globalThis.document;
  const oldImage = globalThis.Image;
  const oldMutationObserver = globalThis.MutationObserver;
  const documentStub = {
    fonts: {
      addEventListener: (name: string) => { events.push(["font-add", name]); },
      removeEventListener: (name: string) => { events.push(["font-remove", name]); },
    },
  };
  class ImageStub {
    onload: (() => void) | null = null;
    src = "";
    complete = false;
    naturalWidth = 0;
  }
  class ObserverStub {
    records: Array<{ type: string; target: { getAttribute(name: string): string };
      attributeName: string; oldValue: string }> = [];
    constructor(readonly callback: (records: unknown[]) => void) {
      events.push("observer-new");
    }
    observe(_target: unknown, options: unknown) { events.push(["observe", options]); }
    takeRecords() {
      const records = this.records;
      this.records = [];
      events.push("take-records");
      return records;
    }
    disconnect() { events.push("disconnect"); }
    queue(value: string, oldValue: string) {
      this.records.push({ type: "attributes",
        target: { getAttribute: () => value }, attributeName: "class", oldValue });
    }
    emit(value: string, oldValue: string) {
      this.callback([{ type: "attributes",
        target: { getAttribute: () => value }, attributeName: "class", oldValue }]);
    }
  }
  globalThis.document = documentStub as unknown as Document;
  globalThis.Image = ImageStub as unknown as typeof Image;
  globalThis.MutationObserver = ObserverStub as unknown as typeof MutationObserver;
  const Surface = class {
    addEventListener(name: string, _callback: unknown, capture: boolean) {
      events.push(["add", name, capture]);
    }
    removeEventListener(name: string, _callback: unknown, capture: boolean) {
      events.push(["remove", name, capture]);
    }
  };
  const Dialog = new Function(
    "document", "Image", "MutationObserver",
    "initializeGarageControlCanvas", "drawGarageControlCanvas",
    "disposeGarageControlCanvas", "garageControlImage",
    (released ? classSource : rewrittenSource) + ";return Pi;",
  )(documentStub, ImageStub, ObserverStub, initializeGarageControlCanvas,
    drawGarageControlCanvas, disposeGarageControlCanvas, garageControlImage) as
    new (surface: HTMLElement, width: number, height: number) => {
      observer: ObserverStub;
      dirty: boolean;
      ratio: number;
      overlayOnly: boolean;
      disposed: boolean;
      images: Map<string, ImageStub>;
      layers: unknown[];
      rebuild(): void;
      draw(painter: unknown, ratio: number, overlayOnly?: boolean): void;
      image(url: string): ImageStub | undefined;
      dispose(): void;
    };
  const surface = new Surface() as unknown as HTMLElement;
  const dialog = directClass
    ? new GarageControlCanvas(surface, 1600, 900, {
        intersect: intersectGarageRect,
        paintBox: () => undefined,
        paintCharacter: () => undefined,
      }) as unknown as InstanceType<typeof Dialog>
    : new Dialog(surface, 1600, 900);
  dialog.rebuild = () => {
    events.push("rebuild");
    dialog.layers = [
      { canvas: "flat", rect: { x: 1, y: 2, width: 3, height: 4 }, live: false,
        clip: undefined, alpha: undefined },
      { canvas: "live", rect: { x: 5, y: 6, width: 7, height: 8 }, live: true,
        clip: { x: 5, y: 6, width: 7, height: 8 }, alpha: 0.5 },
    ];
  };
  const painter = {
    drawCanvasLayer: (...args: unknown[]) => { events.push(["draw", ...args]); },
  };
  const snapshot = () => ({
    events: structuredClone(events), dirty: dialog.dirty, ratio: dialog.ratio,
    overlayOnly: dialog.overlayOnly, disposed: dialog.disposed,
    layers: dialog.layers.length, images: dialog.images.size,
  });
  const restore = () => {
    globalThis.document = oldDocument;
    globalThis.Image = oldImage;
    globalThis.MutationObserver = oldMutationObserver;
  };
  return { dialog, painter, events, snapshot, restore };
}

test("control canvas observer, invalidation, drawing, image cache and cleanup match Pi", () => {
  const run = (released: boolean, directClass = false) => {
    const f = fixture(released, directClass);
    try {
      const created = f.snapshot();
      f.dialog.draw(f.painter, 1);
      f.dialog.draw(f.painter, 1);
      f.dialog.observer.queue("same", "same");
      f.dialog.draw(f.painter, 1);
      f.dialog.observer.emit("changed", "old");
      f.dialog.draw(f.painter, 2, true);
      const drawn = f.snapshot();
      const pending = f.dialog.image("texture.png");
      const image = f.dialog.images.get("texture.png")!;
      image.complete = true;
      image.naturalWidth = 64;
      image.onload?.();
      const loaded = f.dialog.image("texture.png");
      const cache = { pending: !!pending, loaded: loaded === image,
        imageCount: f.dialog.images.size, dirty: f.dialog.dirty };
      f.dialog.dispose();
      f.dialog.draw(f.painter, 3);
      return { created, drawn, cache, disposed: f.snapshot() };
    } finally { f.restore(); }
  };
  assert.deepEqual(run(false), run(true));
  assert.deepEqual(run(false, true), run(true));
});

test("control CSS z-order and object-fit rectangles match Ke/Cs", () => {
  const oldStyle = globalThis.getComputedStyle;
  const style = { zIndex: "12" } as CSSStyleDeclaration;
  globalThis.getComputedStyle = (() => style) as typeof getComputedStyle;
  try {
    const originalZ = new Function("getComputedStyle", sourceOf("Ke") + ";return Ke;")(
      globalThis.getComputedStyle) as typeof garageControlZIndex;
    assert.equal(garageControlZIndex({} as Element), originalZ({} as Element));
    const originalFit = new Function(sourceOf("Cs") + ";return Cs;")() as
      typeof garageObjectFitRect;
    const rect = { x: 10, y: 20, width: 120, height: 80 };
    for (const fit of ["contain", "cover", "scale-down", "none", "fill"]) {
      assert.deepEqual(garageObjectFitRect(rect, 40, 90, fit),
        originalFit(rect, 40, 90, fit), fit);
    }
  } finally { globalThis.getComputedStyle = oldStyle; }
});
