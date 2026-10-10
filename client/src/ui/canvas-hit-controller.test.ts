import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface Controller {
  update(regions: CanvasHitRegion<string>[]): void;
  control(key: string): HTMLButtonElement | undefined;
  focus(key: string): void;
  reset(): void;
  dispose(): void;
  available(): boolean;
  hit(event: PointerEvent): CanvasHitRegion<string> | undefined;
  move(event: PointerEvent): void;
  down(event: PointerEvent): void;
  up(event: PointerEvent): void;
  leave(event: PointerEvent): void;
  cancelPointer(event: PointerEvent): void;
  hovered?: string;
  pressed?: string;
  pointer?: number;
  disposed: boolean;
}
type ControllerClass = new (canvas: HTMLCanvasElement, semanticHost: HTMLElement,
  size: () => { width: number; height: number },
  changed: (hovered?: string, pressed?: string) => void) => Controller;

function releaseController(source: string): ControllerClass {
  const start = source.indexOf("class nR {");
  const end = source.indexOf("\nfunction st(", start);
  assert.ok(start >= 0 && end > start);
  const contains = (x: number, y: number,
    rect: { x: number; y: number; width: number; height: number }) =>
    x >= rect.x && x <= rect.x + rect.width &&
    y >= rect.y && y <= rect.y + rect.height;
  const hide = (button: HTMLButtonElement) => Object.assign(button.style, {
    position: "absolute", width: "1px", height: "1px", padding: "0",
    border: "0", overflow: "hidden", clipPath: "inset(50%)",
    pointerEvents: "none",
  });
  return new Function("Oe", "tR", `${source.slice(start, end)}\nreturn nR;`)(
    contains, hide) as ControllerClass;
}

function exercise(ControllerType: ControllerClass) {
  const events: unknown[][] = [];
  const captures = new Set<number>();
  const canvasListeners = new Map<string, EventListenerOrEventListenerObject>();
  let unavailable = false;
  class Button {
    style: Record<string, string> = {};
    listeners = new Map<string, EventListenerOrEventListenerObject>();
    hidden = false;
    disabled = false;
    tabIndex = 0;
    type = "";
    label = "";
    removed = false;
    addEventListener(name: string, handler: EventListenerOrEventListenerObject) {
      this.listeners.set(name, handler);
    }
    setAttribute(name: string, value: string) {
      if (name === "aria-label") this.label = value;
    }
    fire(name: string, event: object = {}) {
      const listener = this.listeners.get(name);
      if (typeof listener === "function") listener(event as Event);
    }
    focus(options: FocusOptions) {
      events.push(["focus", options]);
      this.fire("focus");
    }
    remove() { this.removed = true; events.push(["remove"]); }
  }
  const buttons: Button[] = [];
  const canvas = {
    ownerDocument: { createElement: () => new Button() },
    addEventListener: (name: string, listener: EventListenerOrEventListenerObject) => {
      canvasListeners.set(name, listener);
      events.push(["listen", name]);
    },
    removeEventListener: (name: string) => {
      canvasListeners.delete(name);
      events.push(["unlisten", name]);
    },
    closest: () => unavailable ? {} : null,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    setPointerCapture: (id: number) => { captures.add(id); events.push(["capture", id]); },
    hasPointerCapture: (id: number) => captures.has(id),
    releasePointerCapture: (id: number) => {
      captures.delete(id); events.push(["release", id]);
    },
  } as unknown as HTMLCanvasElement;
  const host = { append: (button: Button) => {
    buttons.push(button); events.push(["append"]);
  } } as unknown as HTMLElement;
  const controller = new ControllerType(canvas, host,
    () => ({ width: 400, height: 200 }),
    (hovered, pressed) => events.push(["state", hovered, pressed]));
  const pointer = (x: number, y: number, id = 1, button = 0) => ({
    clientX: x, clientY: y, pointerId: id, button,
    preventDefault: () => events.push(["prevent"]),
  }) as unknown as PointerEvent;
  const a = { key: "a", rect: { x: 0, y: 0, width: 80, height: 80 },
    label: "First", hover: () => events.push(["hover", "a"]),
    activate: () => events.push(["activate", "a"]),
    keydown: () => events.push(["keydown", "a"]) };
  const b = { key: "b", rect: { x: 100, y: 0, width: 80, height: 80 },
    label: "Second", disabled: true,
    activate: () => events.push(["activate", "b"]) };
  const c = { key: "c", rect: { x: 0, y: 0, width: 80, height: 80 },
    label: "Top", tabIndex: 2, hover: () => events.push(["hover", "c"]),
    activate: () => events.push(["activate", "c"]) };
  const snapshot = (label: string) => events.push(["snapshot", label,
    controller.hovered, controller.pressed, controller.pointer,
    controller.disposed, controller.available(),
    buttons.map(button => [button.label, button.hidden, button.disabled,
      button.tabIndex, button.removed]), [...captures], [...canvasListeners.keys()]]);

  controller.update([a, b, c]);
  snapshot("initial");
  controller.move(pointer(30, 40)); // Topmost overlapping region wins.
  controller.down(pointer(30, 40));
  controller.move(pointer(100, 40, 2)); // Other pointer is ignored while captured.
  controller.up(pointer(30, 40));
  snapshot("activate top");
  controller.move(pointer(70, 40)); // Disabled region clears hover.
  assert.ok(controller.control("a")); // Also validate direct semantic button events.
  buttons[0]?.fire("keydown");
  buttons[0]?.fire("click", {
    preventDefault: () => events.push(["click prevent"]),
    stopPropagation: () => events.push(["click stop"]),
  });
  controller.update([a, b]);
  snapshot("remove top");
  controller.down(pointer(30, 40));
  controller.update([b]); // Removing a captured target must release capture.
  snapshot("remove pressed");
  buttons[0]?.fire("click", {
    preventDefault: () => events.push(["click prevent"]),
    stopPropagation: () => events.push(["click stop"]),
  });
  unavailable = true;
  controller.move(pointer(30, 40));
  controller.focus("b");
  snapshot("unavailable");
  unavailable = false;
  controller.update([a, b]);
  controller.down(pointer(30, 40));
  controller.leave(pointer(30, 40));
  controller.cancelPointer(pointer(30, 40));
  snapshot("cancel");
  controller.dispose();
  controller.dispose();
  snapshot("disposed");
  return events;
}

test("画布指针命中、键盘控件与释放行为和发行版一致", async () => {
  const source = await readFile(releaseFile, "utf8");
  assert.deepEqual(exercise(CanvasHitController), exercise(releaseController(source)));
});
