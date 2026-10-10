import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  drawGarageProgressionView,
  garageProgressionPreviewRect,
  initializeGarageProgressionView,
  type GarageProgressionViewAssets,
  type GarageProgressionViewHost,
} from "./garage-progression-view";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const panel = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "va");
assert.ok(panel);
const classSource = release.slice(panel.start!, panel.end!);

class ElementStub {
  className = "";
  hidden = false;
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  disabled = false;
  match = "";
  constructor(readonly name: string) {}
  append(...children: ElementStub[]): void { this.children.push(...children); }
  matches(selector: string): boolean { return this.match === selector; }
  snapshot(): unknown {
    return { name: this.name, className: this.className, hidden: this.hidden,
      dataset: { ...this.dataset }, children: this.children.map(child => child.snapshot()) };
  }
}

const rect = { x: 1, y: 2, width: 100, height: 30 };
const image = (name: string) => ({ name }) as unknown as CanvasImageSource;
const imageName = (value: CanvasImageSource) => (value as unknown as { name: string }).name;

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = {
    createElement: (name: string) => new ElementStub(name),
  };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const drawFrame = (_context: CanvasRenderingContext2D,
    frame: { texture: string }, frameImage: CanvasImageSource, bounds: typeof rect) => {
    events.push(["frame", frame.texture, imageName(frameImage), bounds]);
  };
  const drawRadar = (_context: CanvasRenderingContext2D, bounds: typeof rect, radar: unknown) => {
    events.push(["radar", bounds, radar]);
  };
  const Original = new Function("document", "y", "be", "ga", `${classSource}; return va;`)(
    documentStub, attribute, drawFrame, drawRadar,
  ) as new (assets: GarageProgressionViewAssets,
    onChange: (value: unknown) => void, onSelectSkill: (index: number) => void,
    onExceedTypeChange?: () => void) => GarageProgressionViewHost & {
      previewRect: typeof rect;
      draw(context: CanvasRenderingContext2D, grade: number): void;
    };
  class Rewritten implements GarageProgressionViewHost {
    assets!: GarageProgressionViewAssets;
    onChange!: (value: unknown) => void;
    onSelectSkill!: (index: number) => void;
    onExceedTypeChange!: () => void;
    element = document.createElement("div");
    classicContainer = document.createElement("div");
    engine12Container = document.createElement("div");
    activeContainer!: HTMLElement;
    framedControls = new Map<string, HTMLButtonElement>();
    radar?: unknown;
    constructor(assets: GarageProgressionViewAssets,
      onChange: (value: unknown) => void, onSelectSkill: (index: number) => void,
      onExceedTypeChange: () => void = () => {}) {
      initializeGarageProgressionView(this, assets, onChange, onSelectSkill, onExceedTypeChange);
    }
    get previewRect() { return garageProgressionPreviewRect(this); }
    rect(name: string) {
      const found = this.assets.rects.get(name);
      if (!found) throw new Error(`升级页缺少 ${name}`);
      return found;
    }
    draw(context: CanvasRenderingContext2D, grade: number) {
      drawGarageProgressionView(this, context, grade,
        { attribute, drawFrame, drawRadar });
    }
  }
  const assets: GarageProgressionViewAssets = {
    stage: { width: 1600, height: 900 },
    nodes: new Map([
      ["backGround", { attrs: { image: "background" } }],
      ["tuningPanel", { attrs: { image: "xun-panel" } }],
      ["tuning_enhance", { attrs: { image: "classic-panel" } }],
      ["back_img", { attrs: { image: "back" } }],
      ["control", { attrs: { frame: "button-frame" } }],
    ]),
    rects: new Map([
      ["kartPreview", rect], ["backGround", rect], ["tuningPanel", rect],
      ["tuning_enhance", rect], ["back_img", rect], ["control", rect],
      ["resultGraph", rect],
    ]),
    images: new Map([
      ["background", image("background")], ["xun-panel", image("xun-panel")],
      ["classic-panel", image("classic-panel")], ["back", image("back")],
      ["frame-normal", image("frame-normal")], ["frame-hover", image("frame-hover")],
      ["frame-clicked", image("frame-clicked")], ["frame-disabled", image("frame-disabled")],
    ]),
    windowFrames: new Map([
      ["button-frame/Normal", { texture: "frame-normal" }],
      ["button-frame/MouseOn", { texture: "frame-hover" }],
      ["button-frame/Clicked", { texture: "frame-clicked" }],
      ["button-frame/Disabled", { texture: "frame-disabled" }],
    ]),
  };
  const drawContext = {
    drawImage: (drawn: CanvasImageSource, ...bounds: number[]) =>
      events.push(["image", imageName(drawn), bounds]),
  } as unknown as CanvasRenderingContext2D;
  const onChange = (value: unknown) => events.push(["change", value]);
  const onSelectSkill = (index: number) => events.push(["skill", index]);
  const onExceedTypeChange = () => events.push("exceed");
  const View = released ? Original : Rewritten;
  const previous = globalThis.document;
  globalThis.document = documentStub as unknown as Document;
  let host: InstanceType<typeof Original>;
  try { host = new View(assets, onChange, onSelectSkill, onExceedTypeChange) as InstanceType<typeof Original>; }
  finally { globalThis.document = previous; }
  const button = new ElementStub("button");
  host.framedControls.set("control", button as unknown as HTMLButtonElement);
  host.radar = { ready: true };
  const snapshot = () => ({
    events: structuredClone(events),
    element: (host.element as unknown as ElementStub).snapshot(),
    classic: (host.classicContainer as unknown as ElementStub).snapshot(),
    xun: (host.engine12Container as unknown as ElementStub).snapshot(),
    active: host.activeContainer === host.classicContainer ? "classic" : "xun",
    previewRect: host.previewRect,
  });
  return { host, button, drawContext, assets, events, snapshot };
}

test("progression constructor and preview bounds match va", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.onChange("test");
    f.host.onSelectSkill(2);
    f.host.onExceedTypeChange();
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("classic and XUN panel painting, button states and radar match va", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.button.match = ":hover";
    f.host.draw(f.drawContext, 8);
    states.push(f.snapshot());
    f.button.match = ":active";
    f.host.draw(f.drawContext, 8);
    states.push(f.snapshot());
    f.button.disabled = true;
    f.host.draw(f.drawContext, 8);
    states.push(f.snapshot());
    f.host.draw(f.drawContext, 9);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated va delegates construction, preview bounds and canvas painting", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "va");
  if (!view || view.type !== "ClassDeclaration") throw new Error("Generated va missing");
  const delegates = new Map([
    ["constructor", "initializeGarageProgressionView"],
    ["previewRect", "garageProgressionPreviewRect"],
    ["draw", "drawGarageProgressionView"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = view.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  for (const name of delegates.keys())
    assert.ok(manifest.handwrittenGarageProgressionOverrides.includes(name), name);
});
