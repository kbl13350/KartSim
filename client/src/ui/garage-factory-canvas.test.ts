import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  drawGarageFactoryBackground,
  drawGarageFactoryCatalogFrame,
  resizeGarageFactoryCanvases,
  styleGarageFactoryActionFrame,
  type GarageFactoryCanvasDependencies,
  type GarageFactoryCanvasHost,
} from "./garage-factory-canvas";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const panel = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Pa");
assert.ok(panel);
const classSource = release.slice(panel.start!, panel.end!);

class ElementStub {
  width = 0;
  height = 0;
  textContent = "";
  disabled = false;
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  match = "";
  onpointerenter?: () => void;
  onpointerleave?: () => void;
  onpointerdown?: () => void;
  onpointerup?: () => void;
  style = {
    position: "", left: "", top: "", width: "", height: "",
    pointerEvents: "", background: "", border: "",
  };
  constructor(readonly name: string, private readonly events: unknown[]) {}
  getContext(kind: string): unknown {
    return kind === "2d" ? {
      imageSmoothingEnabled: false,
      clearRect: (...values: number[]) => { this.events.push(["clear", ...values]); },
    } : null;
  }
  getBoundingClientRect() { return { width: 120, height: 60 }; }
  replaceChildren(...children: ElementStub[]) { this.children = children; }
  matches(selector: string): boolean { return this.match === selector; }
  snapshot(): unknown {
    return { name: this.name, width: this.width, height: this.height,
      text: this.textContent, disabled: this.disabled, dataset: { ...this.dataset },
      style: { ...this.style }, children: this.children.map(child => child.snapshot()) };
  }
}

type TestHost = GarageFactoryCanvasHost & {
  resizeCanvases(): void;
  styleActionFrame(button: HTMLButtonElement): void;
  draw(context: CanvasRenderingContext2D): void;
  drawCatalogFrame(context: CanvasRenderingContext2D, index: number,
    selected: boolean, hover?: boolean): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = { createElement: (name: string) => new ElementStub(name, events) };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const pixelRatio = () => { events.push("pixel-ratio"); return 2; };
  const sizeCanvas = (_canvas: HTMLCanvasElement, _context: CanvasRenderingContext2D,
    displayedWidth: number, displayedHeight: number, ratio: number,
    authoredWidth: number, authoredHeight: number) => {
    events.push(["size", displayedWidth, displayedHeight, ratio, authoredWidth, authoredHeight]);
  };
  const drawFrame = (_context: CanvasRenderingContext2D, frame: { texture: string },
    image: CanvasImageSource, rect: { x: number; y: number; width: number; height: number }) => {
    events.push(["frame", frame.texture, (image as unknown as { name: string }).name, rect]);
  };
  const dependencies: GarageFactoryCanvasDependencies = {
    attribute, pixelRatio, sizeCanvas, drawFrame,
  };
  const Original = new Function("Pe", "Ee", "be", "y", "document",
    `${classSource}; return Pa;`)(
      sizeCanvas, pixelRatio, drawFrame, attribute, documentStub,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const image = (name: string) => ({ name }) as unknown as CanvasImageSource;
  host.assets = {
    stage: { width: 1600, height: 900 },
    nodes: new Map([["empty", { attrs: { texture: "empty-art" } }]]),
    rects: new Map([
      ["reset", { x: 5, y: 6, width: 100, height: 40 }],
      ["empty", { x: 10, y: 20, width: 300, height: 200 }],
    ]),
    images: new Map([
      ["Normal", image("normal")], ["MouseOn", image("hover")],
      ["Clicked", image("clicked")], ["Disabled", image("disabled")],
      ["garage_img_floterBG_1600", image("background")],
      ["empty-art", image("empty")],
      ["img_floter_slotBoxSelected", image("selected")],
      ["img_floter_slotBox", image("unselected")],
    ]),
    actionFrames: new Map([
      ["Normal", { texture: "Normal" }], ["MouseOn", { texture: "MouseOn" }],
      ["Clicked", { texture: "Clicked" }], ["Disabled", { texture: "Disabled" }],
    ]),
  };
  host.actionFrameRedraws = new Set();
  host.installed = false;
  Object.defineProperty(host, "catalogLayout", { value: {
    columns: 3, cardWidth: 80, cardHeight: 50, gapX: 10, gapY: 5,
    rect: { x: 200, y: 100, width: 280, height: 110 },
  } });
  const button = new ElementStub("button", events);
  button.dataset.factoryAction = "reset";
  button.textContent = "重置";
  const context = {
    drawImage: (drawn: CanvasImageSource, ...values: number[]) =>
      events.push(["image", (drawn as unknown as { name: string }).name, values]),
  } as unknown as CanvasRenderingContext2D;
  if (!released) {
    host.resizeCanvases = () => resizeGarageFactoryCanvases(host);
    host.styleActionFrame = control => styleGarageFactoryActionFrame(host, control, dependencies);
    host.draw = canvas => drawGarageFactoryBackground(host, canvas, dependencies);
    host.drawCatalogFrame = (canvas, index, selected, hover) =>
      drawGarageFactoryCatalogFrame(host, canvas, index, selected, hover);
  }
  const snapshot = () => ({
    events: structuredClone(events), button: button.snapshot(),
    redraws: host.actionFrameRedraws.size,
  });
  return { host, button, context, events, documentStub, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("Factory action frame pointer states, disabled fallback and resize match Pa", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.styleActionFrame(f.button as unknown as HTMLButtonElement);
      const initial = f.snapshot();
      f.button.onpointerenter?.();
      f.button.onpointerdown?.();
      f.button.onpointerup?.();
      f.button.onpointerleave?.();
      f.button.match = ":active";
      f.host.resizeCanvases();
      f.button.disabled = true;
      f.host.resizeCanvases();
      return { initial, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory background and catalog frame atlas coordinates match Pa", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.draw(f.context);
    f.host.drawCatalogFrame(f.context, 4, false);
    f.host.drawCatalogFrame(f.context, 4, false, true);
    f.host.drawCatalogFrame(f.context, 5, true);
    f.host.installed = true;
    f.host.draw(f.context);
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory action-frame styling safely skips missing frame assets like Pa", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.assets.actionFrames = new Map();
    withDocument(f.documentStub, () =>
      f.host.styleActionFrame(f.button as unknown as HTMLButtonElement));
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Pa delegates its four canvas methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const panel = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "Pa");
  if (!panel || panel.type !== "ClassDeclaration") throw new Error("Generated Pa missing");
  const delegates = new Map([
    ["resizeCanvases", "resizeGarageFactoryCanvases"],
    ["styleActionFrame", "styleGarageFactoryActionFrame"],
    ["draw", "drawGarageFactoryBackground"],
    ["drawCatalogFrame", "drawGarageFactoryCatalogFrame"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = panel.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageFactoryCanvasOverrides, [...delegates.keys()]);
});
