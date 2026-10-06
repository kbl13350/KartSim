import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  initializeGarageUpgradeResult,
  type GarageUpgradeClassicLoad, type GarageUpgradeConstructionDependencies,
  type GarageUpgradeConstructionHost,
} from "./garage-upgrade-result-construction";
import type { GarageUpgradeAnimationPanel } from "./garage-upgrade-result-render";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ra");
assert.ok(view && view.type === "ClassDeclaration");
const constructorNode = view.body.body.find(node =>
  node.type === "ClassMethod" && node.kind === "constructor");
assert.ok(constructorNode);
const classSource = release.slice(view.start!, view.end!);
const rewrittenSource = classSource.slice(0, constructorNode.start! - view.start!) +
  `constructor(e,t,s,i,n,r,o,c,l=false,h) { initializeGarageUpgradeResult(this,e,t,s,i,n,r,o,c,l,h,dependencies); }` +
  classSource.slice(constructorNode.end! - view.start!);

class ElementStub {
  className = "";
  textContent = "";
  hidden = false;
  disabled = false;
  type = "";
  src = "";
  alt = "";
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  classes: string[] = [];
  children: ElementStub[] = [];
  listeners = new Map<string, (event: KeyboardEvent) => void>();
  onclick?: () => void;
  width = 0;
  height = 0;
  isConnected = true;
  classList = { add: (...names: string[]) => { this.classes.push(...names); } };
  constructor(readonly name: string, readonly events: unknown[],
    readonly owner: { activeElement?: ElementStub }) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: (event: KeyboardEvent) => void) {
    this.listeners.set(name, callback);
  }
  focus() { this.events.push(["focus", this.name]); this.owner.activeElement = this; }
  getContext(_kind: string) { return { canvas: this } as unknown as CanvasRenderingContext2D; }
  snapshot(): unknown {
    return { name: this.name, className: this.className, text: this.textContent,
      hidden: this.hidden, disabled: this.disabled, type: this.type,
      src: this.src, alt: this.alt, style: { ...this.style },
      attrs: { ...this.attrs }, classes: [...this.classes],
      width: this.width, height: this.height, children: this.children.map(child => child.snapshot()),
      listeners: [...this.listeners.keys()] };
  }
}

function fixture(released: boolean, kind: "xun" | "classic", resultOnly: boolean) {
  const events: unknown[] = [];
  const documentStub: { activeElement?: ElementStub; createElement(name: string): ElementStub } = {
    createElement(name) { return new ElementStub(name, events, documentStub); },
  };
  documentStub.activeElement = documentStub.createElement("previous-focus");
  const stylePrimary = (button: HTMLButtonElement) => {
    events.push("style-primary");
    (button as unknown as ElementStub).classList.add("garage-skill-action",
      "garage-skill-action-primary");
  };
  const stats = (summary: { beforeLevel: number; afterLevel: number;
    beforePoints: number; afterPoints: number }) => [
    { label: "性能槽数量", before: String(Math.min(summary.beforeLevel, 3)),
      after: String(Math.min(summary.afterLevel, 3)) },
    { label: "强化点数", before: String(summary.beforePoints),
      after: String(summary.afterPoints) },
  ];
  let resolveXun: ((value: GarageUpgradeAnimationPanel[]) => void) | undefined;
  let resolveClassic: ((value: GarageUpgradeClassicLoad) => void) | undefined;
  const loadXun: GarageUpgradeConstructionDependencies["loadXun"] =
    (_library, _environment, _stage, previewOnly) => {
      events.push(["load-xun", previewOnly]);
      return new Promise(resolve => { resolveXun = resolve; });
    };
  const loadClassic: GarageUpgradeConstructionDependencies["loadClassic"] =
    () => {
      events.push("load-classic");
      return new Promise(resolve => { resolveClassic = resolve; });
    };
  const dependencies: GarageUpgradeConstructionDependencies = {
    stylePrimary, loadXun, loadClassic,
  };
  const source = released ? classSource : rewrittenSource;
  const Original = new Function("he", "La", "Na", "Ma", "ka", "document",
    "HTMLElement", "initializeGarageUpgradeResult", "dependencies",
    `${source}; return Ra;`)(
      (button: HTMLButtonElement) => stylePrimary(button), stats,
      (previewOnly: boolean) => !previewOnly, loadXun, loadClassic,
      documentStub, ElementStub, initializeGarageUpgradeResult, dependencies,
    ) as new (...args: unknown[]) => GarageUpgradeConstructionHost;
  Original.prototype.close = function(confirmed: boolean) { events.push(["close", confirmed]); };
  const surface = documentStub.createElement("surface");
  const summary = { beforeLevel: 2, afterLevel: 3, beforePoints: 7, afterPoints: 8 };
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  globalThis.document = documentStub as unknown as Document;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  let host: GarageUpgradeConstructionHost;
  try {
    host = new Original(surface, "library", "environment", "stage",
      "测试车辆", () => {}, kind, summary, resultOnly, "badge.png");
  } finally {
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  }
  const panel = (name: string): GarageUpgradeAnimationPanel => ({ durationMs: 500,
    seek: time => { events.push(["seek", name, time]); },
    dispose: () => { events.push(["dispose-panel", name]); } });
  const classicAssets = (): GarageUpgradeClassicLoad => ({
    rect: { x: 1, y: 2, width: 800, height: 450 },
    preview: { x: 10, y: 20, width: 150, height: 160 },
    accept: { x: 30, y: 40, width: 90, height: 25 },
    panel: panel("classic"),
    drawResult: () => {},
    dispose: () => { events.push("dispose-classic"); },
  });
  const settle = async () => {
    if (kind === "xun") resolveXun!([panel("xun")]);
    else resolveClassic!(classicAssets());
    await new Promise<void>(resolve => setImmediate(resolve));
  };
  const snapshot = () => ({ events: structuredClone(events),
    surface: surface.snapshot(), context: !!host.context, kartContext: !!host.kartContext,
    panels: host.panels?.length, classic: !!host.classic, complete: host.complete,
    logical: [host.canvasLogicalWidth, host.canvasLogicalHeight,
      host.kartLogicalWidth, host.kartLogicalHeight] });
  return { host, settle, snapshot, documentStub, events };
}

test("XUN upgrade dialog DOM, callbacks and async panel load match Ra constructor", async () => {
  for (const resultOnly of [false, true]) {
    const run = async (released: boolean) => {
      const f = fixture(released, "xun", resultOnly);
      const initial = f.snapshot();
      await f.settle();
      const ready = f.snapshot();
      (f.host.accept as unknown as ElementStub).onclick?.();
      (f.host.cancel as unknown as ElementStub).onclick?.();
      return { initial, ready, final: f.snapshot() };
    };
    assert.deepEqual(await run(false), await run(true), String(resultOnly));
  }
});

test("classic upgrade panel resizes canvases and result-only controls like Ra", async () => {
  for (const resultOnly of [false, true]) {
    const run = async (released: boolean) => {
      const f = fixture(released, "classic", resultOnly);
      const initial = f.snapshot();
      await f.settle();
      return { initial, ready: f.snapshot() };
    };
    assert.deepEqual(await run(false), await run(true), String(resultOnly));
  }
});
