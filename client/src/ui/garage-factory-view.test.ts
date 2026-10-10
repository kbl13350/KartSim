import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  addGarageFactoryLabel, garageFactoryCatalogLayout,
  garageFactoryPreviewRect, garageFactoryShowsCatalog,
  initializeGarageFactoryView, placeGarageFactoryElement,
  updateGarageFactoryScoreLabel,
  type GarageFactoryViewAssets, type GarageFactoryViewHost,
} from "./garage-factory-view";
import type { FactoryPickerRect } from "./garage-factory-picker";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
const sourceOf = (name: string) => {
  const node = nodes.find(candidate => candidate.type === "ClassDeclaration" && candidate.id?.name === name ||
    candidate.type === "FunctionDeclaration" && candidate.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start!, node.end!);
};
const originalPanel = sourceOf("Pa");
const originalLayout = sourceOf("Ca");

class ElementStub {
  className = "";
  textContent: string | undefined = "";
  title = "";
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  style = {
    position: "", left: "", top: "", width: "", height: "",
    boxSizing: "", padding: "", color: "", font: "",
    overflowWrap: "", whiteSpace: "", textAlign: "", lineHeight: "",
  };
  constructor(readonly tag: string) {}
  append(...children: ElementStub[]): void { this.children.push(...children); }
  snapshot(): unknown {
    return { tag: this.tag, className: this.className,
      text: this.textContent, title: this.title, dataset: { ...this.dataset },
      style: { ...this.style }, children: this.children.map(child => child.snapshot()) };
  }
}

type TestHost = GarageFactoryViewHost & {
  showsCatalog: boolean;
  previewRect?: FactoryPickerRect;
  catalogLayout: ReturnType<typeof garageFactoryCatalogLayout>;
  label(text: string | undefined, rect: FactoryPickerRect, node?: string): HTMLElement;
  updateScores(scores?: Record<string, number>, title?: string): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const childRect = (_node: unknown, parent: FactoryPickerRect) => ({
    x: parent.x + 3, y: parent.y + 4, width: parent.width - 6, height: parent.height - 8,
  });
  const dependencies = { attribute, childRect };
  const Original = new Function("y", "Y", "document",
    `${originalLayout}\n${originalPanel}\nreturn Pa;`)(
      attribute, childRect, documentStub,
    ) as new (assets: GarageFactoryViewAssets,
      onChange: (value: unknown) => void,
      onConfirm: (message: string, action: () => void) => void,
      onTabChange: () => void, onTutorial?: () => void) => TestHost;
  class Rewritten implements GarageFactoryViewHost {
    assets!: GarageFactoryViewAssets;
    onChange!: (value: unknown) => void;
    onConfirm!: (message: string, action: () => void) => void;
    onTabChange!: () => void;
    onTutorial?: () => void;
    element = document.createElement("div");
    catalog = true;
    scoreLabel?: HTMLElement;
    emptyVehicleInfo = false;
    constructor(assets: GarageFactoryViewAssets,
      onChange: (value: unknown) => void,
      onConfirm: (message: string, action: () => void) => void,
      onTabChange: () => void, onTutorial?: () => void) {
      initializeGarageFactoryView(this, assets, onChange, onConfirm, onTabChange, onTutorial);
    }
    get showsCatalog() { return garageFactoryShowsCatalog(this); }
    get previewRect() { return garageFactoryPreviewRect(this); }
    get catalogLayout() { return garageFactoryCatalogLayout(this.assets, dependencies); }
    place(element: HTMLElement, rect: FactoryPickerRect) { placeGarageFactoryElement(this, element, rect); }
    label(text: string | undefined, rect: FactoryPickerRect, node?: string) {
      return addGarageFactoryLabel(this, text, rect, node, dependencies);
    }
    updateScores(scores?: Record<string, number>, title?: string) {
      updateGarageFactoryScoreLabel(this, scores, title);
    }
  }
  const assets: GarageFactoryViewAssets = {
    nodes: new Map([
      ["itemGrid", { attrs: { alignSize: "3", maxLine: "2", alignMargin: "8 12" } }],
      ["factoryKartItemPanel", { attrs: { zoom: "1.25" } }],
      ["/factoryCard/garageCardTemplate/shopItemContainer", { attrs: {} }],
      ["score", { attrs: { marginRect: "1 2 3 4", textRender: "bold16",
        textAlign: "right,vcenter", lineGap: "4" } }],
      ["description", { attrs: { textRender: "normal", textAlign: "left" } }],
    ]),
    rects: new Map([
      ["itemGrid", { x: 50, y: 80, width: 500, height: 250 }],
      ["garageCardTemplate", { x: 0, y: 0, width: 100, height: 70 }],
      ["tuneCardAttach", { x: 10, y: 20, width: 300, height: 200 }],
    ]),
    fontFamily: "Factory Test", fontLineScale: 1.2,
  };
  const onChange = (value: unknown) => { events.push(["change", value]); };
  const onConfirm = (message: string, action: () => void) => {
    events.push(["confirm", message]); action();
  };
  const onTabChange = () => { events.push("tab-change"); };
  const onTutorial = () => { events.push("tutorial"); };
  const previous = globalThis.document;
  globalThis.document = documentStub as unknown as Document;
  let host: TestHost;
  try {
    host = new (released ? Original : Rewritten)(assets, onChange, onConfirm,
      onTabChange, onTutorial) as TestHost;
  } finally { globalThis.document = previous; }
  const snapshot = () => ({
    events: structuredClone(events),
    root: (host.element as unknown as ElementStub).snapshot(),
    catalog: host.showsCatalog, preview: host.previewRect,
    layout: { ...host.catalogLayout, thumbnail: undefined,
      first: host.catalogLayout.thumbnail(0), fourth: host.catalogLayout.thumbnail(4) },
    score: host.scoreLabel && (host.scoreLabel as unknown as ElementStub).snapshot(),
  });
  return { host, documentStub, assets, events, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("Factory constructor, native grid layout and authored labels match Pa", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const initial = f.snapshot();
      f.host.label("评分", { x: 1, y: 2, width: 200, height: 40 }, "score");
      f.host.label("说明", { x: 5, y: 6, width: 150, height: 30 }, "description");
      f.host.label("普通", { x: 3, y: 4, width: 100, height: 20 });
      f.host.onChange("selected");
      f.host.onConfirm("ready", () => { f.events.push("confirmed"); });
      f.host.onTabChange();
      f.host.onTutorial?.();
      return { initial, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory signed five-score display and unavailable state match Pa", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.scoreLabel = f.host.label("", { x: 0, y: 0, width: 100, height: 100 });
      f.host.updateScores({ TransAccelFactor: 65535, SteerConstraint: 32768,
        DriftEscapeForce: 32767, NormalBoosterTime: 1, DriftMaxGauge: 0 }, "原始评分");
      const numbers = f.snapshot();
      f.host.updateScores();
      const empty = f.snapshot();
      f.host.emptyVehicleInfo = true;
      f.host.updateScores({ TransAccelFactor: 1 });
      return { numbers, empty, unavailable: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Pa delegates its constructor, layout, labels and scores", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "Pa");
  if (!view || view.type !== "ClassDeclaration") throw new Error("Generated Pa missing");
  const delegates = new Map([
    ["constructor", "initializeGarageFactoryView"],
    ["showsCatalog", "garageFactoryShowsCatalog"],
    ["previewRect", "garageFactoryPreviewRect"],
    ["catalogLayout", "garageFactoryCatalogLayout"],
    ["place", "placeGarageFactoryElement"],
    ["label", "addGarageFactoryLabel"],
    ["updateScores", "updateGarageFactoryScoreLabel"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = view.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const layout = ast.program.body.find(node => node.type === "FunctionDeclaration" && node.id?.name === "Ca");
  assert.ok(layout);
  assert.match(generated.slice(layout.start!, layout.end!), /garageFactoryCatalogLayout\(/);
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageFactoryViewOverrides, [...delegates.keys()]);
  assert.equal(manifest.handwrittenGarageFactoryLayoutOverride, true);
});
