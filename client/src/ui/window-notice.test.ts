import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { WindowNotice } from "./window-notice";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first);
  return source.slice(first, last);
}
const Original = new Function(`
  ${between("function xe() {", "function Sr(")}
  ${between("function Sr(n, e, t, i, r, s = 1600, o = 900) {", "function p3(")}
  ${between("class ds {", "function KP(")}
  return ds;
`)() as typeof WindowNotice;

class FakeCanvas {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  hidden = false;
  width = 0;
  height = 0;
  attrs = new Map<string, string>();
  removed = false;
  constructor(readonly drawing: unknown[][]) {}
  getContext() {
    const drawing = this.drawing;
    return {
      setTransform: (...args: unknown[]) => drawing.push(["transform", ...args]),
      clearRect: (...args: unknown[]) => drawing.push(["clear", ...args]),
      imageSmoothingEnabled: true,
    };
  }
  getBoundingClientRect() { return { width: 320, height: 60 }; }
  setAttribute(name: string, value: string) { this.attrs.set(name, value); }
  getAttribute(name: string) { return this.attrs.get(name); }
  remove() { this.removed = true; }
}

test("notice layout, paint, expiry and disposal match released ds", () => {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  const previousObserver = globalThis.ResizeObserver;
  const previousPerformance = globalThis.performance;
  const run = (Notice: typeof WindowNotice) => {
    const drawing: unknown[][] = [];
    const events: string[] = [];
    let canvas: FakeCanvas;
    let observerCallback: (() => void) | undefined;
    globalThis.document = { createElement: () => (canvas = new FakeCanvas(drawing)) } as unknown as Document;
    globalThis.window = {
      devicePixelRatio: 1.25,
      addEventListener: (name: string) => events.push(`listen:${name}`),
      removeEventListener: (name: string) => events.push(`unlisten:${name}`),
    } as unknown as Window & typeof globalThis;
    globalThis.ResizeObserver = class {
      constructor(callback: () => void) { observerCallback = callback; }
      observe() { events.push("observe"); }
      disconnect() { events.push("disconnect"); }
    } as unknown as typeof ResizeObserver;
    globalThis.performance = { now: () => 1000 } as unknown as Performance;
    const root = { append: () => events.push("append") } as unknown as HTMLElement;
    const notice = new Notice(root);
    const states: unknown[] = [];
    const capture = (label: string) => states.push({
      label, hidden: canvas!.hidden, width: canvas!.width, height: canvas!.height,
      style: { ...canvas!.style }, aria: canvas!.getAttribute("aria-label"),
      expiresAt: notice.expiresAt, active: notice.active && {
        rect: { ...notice.active.rect }, text: notice.active.text,
      }, drawing: drawing.map(entry => [...entry]), events: [...events],
      removed: canvas!.removed,
    });
    capture("initial");
    const rect = { x: 100, y: 200, width: 400, height: 100 };
    notice.show(rect, "已收藏", () => drawing.push(["draw"])); capture("shown");
    observerCallback?.(); capture("resize");
    notice.update(2499); capture("before-expiry");
    notice.update(2500); capture("expired");
    notice.show(rect, "已删除", () => drawing.push(["redraw"]), 500);
    capture("second");
    notice.dispose(); capture("disposed");
    return states;
  };
  try {
    assert.deepEqual(run(WindowNotice), run(Original));
  } finally {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
    globalThis.ResizeObserver = previousObserver;
    globalThis.performance = previousPerformance;
  }
});
