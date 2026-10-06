import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Taskbar, type TaskbarAssets, type TaskbarImage, type TaskbarOptions } from "./taskbar";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function between(start: string, end: string): string {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first > 0 && last > first, `${start} → ${end}`);
  return source.slice(first, last);
}
const Original = new Function(`
  ${between("function Sr(n, e, t, i, r, s = 1600, o = 900) {", "function p3(")}
  ${between("function st(n, e, t) {", "async function ma(")}
  ${between("function ct(n, e, t) {", "function m4(")}
  ${between('const wF = "gui_/window/menu"', "class ry {")}
  ${between("class ry {", "function vF(")}
  return ry;
`)() as typeof Taskbar;

test("original My Room tray button calls the new house action", () => {
  const open = () => undefined;
  const bar = { options: { onHouse: open } } as unknown as Taskbar;
  assert.equal(Taskbar.prototype.actionFor.call(bar, "마이룸"), open);
});

class FakeElement {
  style: Record<string, string> = {};
  dataset: Record<string, string> = {};
  hidden = false;
  width = 0;
  height = 0;
  disabled = false;
  type = "";
  title = "";
  children: FakeElement[] = [];
  parentElement?: FakeElement;
  attributes = new Map<string, string>();
  listeners = new Map<string, Array<() => void>>();
  removed = false;
  constructor(readonly kind: string, readonly drawing: unknown[][]) {}
  append(...children: FakeElement[]) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }
  getContext() {
    if (this.kind !== "canvas") return null;
    const drawing = this.drawing;
    return {
      setTransform: (...args: unknown[]) => drawing.push(["transform", ...args]),
      clearRect: (...args: unknown[]) => drawing.push(["clear", ...args]),
      drawImage: (...args: unknown[]) => drawing.push(["image", ...args]),
      strokeRect: (...args: unknown[]) => drawing.push(["stroke", ...args]),
      imageSmoothingEnabled: false,
      strokeStyle: "",
      lineWidth: 0,
    };
  }
  getBoundingClientRect() {
    return { x: 0, y: 0, width: 800, height: 450, top: 0, left: 0 };
  }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  matches(selector: string) { return selector === ":focus-visible"; }
  addEventListener(name: string, callback: () => void) {
    const callbacks = this.listeners.get(name) ?? [];
    callbacks.push(callback);
    this.listeners.set(name, callbacks);
  }
  emit(name: string) { for (const callback of this.listeners.get(name) ?? []) callback(); }
  remove() { this.removed = true; }
}

test("taskbar canvas, accessibility buttons, compositing and disposal match release", () => {
  const priorDocument = globalThis.document;
  const priorWindow = globalThis.window;
  const priorObserver = globalThis.ResizeObserver;
  const run = (Bar: typeof Taskbar) => {
    const drawing: unknown[][] = [];
    const events: string[] = [];
    const fakeDocument = {
      activeElement: undefined as FakeElement | undefined,
      createElement: (kind: string) => new FakeElement(kind, drawing),
    };
    const fakeWindow = {
      devicePixelRatio: 1.5,
      addEventListener: (name: string) => events.push(`listen:${name}`),
      removeEventListener: (name: string) => events.push(`unlisten:${name}`),
    };
    class FakeResizeObserver {
      constructor(readonly callback: () => void) {}
      observe() { events.push("observe"); }
      disconnect() { events.push("disconnect"); }
    }
    globalThis.document = fakeDocument as unknown as Document;
    globalThis.window = fakeWindow as unknown as Window & typeof globalThis;
    globalThis.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

    const root = new FakeElement("root", drawing);
    const image = (name: string): TaskbarImage => ({ image: { name } as unknown as CanvasImageSource,
      width: 32, height: 24 });
    const names = ["설정", "singleplay", "unknown"];
    const buttons = names.map((name, index) => ({ name, node: { name },
      rect: { x: index * 50, y: 2, width: 40, height: 36 } }));
    const assets: TaskbarAssets = {
      background: image("background"),
      buttons,
      labels: new Map([["설정", "设置"]]),
      images: new Map(buttons.map(button => [button.node,
        [0, 1, 2, 3].map(frame => image(`${button.name}:${frame}`)) as
          [TaskbarImage, TaskbarImage, TaskbarImage, TaskbarImage]])),
    };
    const options: TaskbarOptions = {
      root: root as unknown as HTMLElement,
      onSettings: () => events.push("settings"),
      onSinglePlayer: () => events.push("solo"),
      onHover: () => events.push("hover"),
      onActivate: () => events.push("activate"),
    };
    const bar = new Bar(options, assets);
    const element = bar.element as unknown as FakeElement;
    const canvas = bar.canvas as unknown as FakeElement;
    const controls = element.children.slice(1);
    const states: unknown[] = [];
    const capture = (label: string) => states.push({
      label, revision: bar.revision, hovered: bar.hovered, pressed: bar.pressed,
      hidden: element.hidden, canvas: { width: canvas.width, height: canvas.height,
        visibility: canvas.style.visibility },
      controls: controls.map(control => ({ title: control.title, disabled: control.disabled,
        cursor: control.style.cursor, left: control.style.left,
        aria: control.getAttribute("aria-label") })),
      frame: bar.compositeFrame && { revision: bar.compositeFrame.revision,
        width: bar.compositeFrame.rect.width },
      drawing: drawing.map(call => [...call]), events: [...events],
    });
    capture("initial");
    bar.setVisible(true); capture("visible");
    controls[0]!.emit("pointerenter"); capture("hover");
    controls[0]!.emit("pointerdown"); capture("pressed");
    controls[0]!.emit("click"); capture("clicked");
    controls[0]!.emit("pointerup"); capture("released");
    fakeDocument.activeElement = controls[0];
    controls[0]!.emit("focus"); capture("focus");
    controls[2]!.emit("pointerenter");
    controls[2]!.emit("click"); capture("disabled");
    const oldRelease = bar.composite({ old: 1 }, () => events.push("old-composite"));
    const newRelease = bar.composite({ current: 2 }, () => events.push("new-composite"));
    oldRelease(); capture("stale-release");
    bar.render(); capture("composited");
    newRelease(); capture("released-composite");
    bar.setVisible(false);
    controls[0]!.emit("click"); capture("hidden-click");
    bar.dispose(); capture("disposed");
    return states;
  };
  try {
    assert.deepEqual(run(Taskbar), run(Original));
  } finally {
    globalThis.document = priorDocument;
    globalThis.window = priorWindow;
    globalThis.ResizeObserver = priorObserver;
  }
});
