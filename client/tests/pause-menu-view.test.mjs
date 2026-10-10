import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { PauseMenuView } from "../src/timeattack/pause-menu-view.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const pauseNode = declarations.find(node => node.type === "ClassDeclaration" && node.id.name === "Dy");
assert.ok(pauseNode);
const pauseSource = release.slice(pauseNode.start, pauseNode.end);

function runPause(readable) {
  const events = [];
  class Element {
    style = {};
    dataset = {};
    attributes = {};
    captured = new Set();
    hidden = false;
    constructor(name) { this.name = name; }
    getContext() {
      return {
        clearRect: (...args) => events.push(["clear", ...args]),
        fillRect: (...args) => events.push(["fill", ...args]),
      };
    }
    addEventListener(name) { events.push(["add", this.name, name]); }
    removeEventListener(name) { events.push(["remove", this.name, name]); }
    append(child) { events.push(["append", this.name, child.name]); }
    remove() { events.push(["remove", this.name]); }
    focus() { events.push(["focus", this.name]); }
    setAttribute(name, value) { this.attributes[name] = value; }
    getBoundingClientRect() {
      return this.name === "canvas"
        ? { left: 0, top: 0, width: 1600, height: 900 }
        : { left: 0, top: 0, width: 1280, height: 720 };
    }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
  }
  const root = new Element("root");
  const assets = {
    strings: new Map([["menu", "暂停菜单"]]),
    font: "font", overlayAlpha: .4,
    captionFrame: "caption", captionOffset: "offset",
    frame: { image: "frame" },
    retry: ["retry0", "retry1", "retry2", "retry3"],
    menu: ["menu0", "menu1", "menu2", "menu3"],
    close: ["resume0", "resume1", "resume2", "resume3"],
    definition: { name: "definition" }, closeDefinition: "close-def",
  };
  const hits = [
    { action: "retry", rect: { x: 100, y: 100, width: 200, height: 100 } },
    { action: "menu", rect: { x: 400, y: 100, width: 200, height: 100 } },
    { action: "resume", rect: { x: 700, y: 100, width: 200, height: 100 } },
  ];
  const dialog = { x: 50, y: 50, width: 900, height: 500 };
  const ops = {
    width: 1600, height: 900, fontFamily: "test-font",
    loadAssets: async () => assets,
    releaseFont: font => events.push(["font", font]),
    string: (strings, key) => strings.get(key),
    smoothImages: () => true,
    drawFrame: (_ctx, frame, image, rect) =>
      events.push(["frame", frame, image, rect]),
    captionRect: () => ({ x: 80, y: 70, width: 400, height: 80 }),
    drawText: (_ctx, text, rect, options) =>
      events.push(["text", text, rect, options]),
    buttonHits: () => hits,
    buttonState: (action, hovered, pressed) =>
      action === pressed ? 2 : action === hovered ? 1 : 0,
    drawButton: (_ctx, image, rect) => events.push(["button", image, rect]),
    resizeCanvas: (_canvas, _ctx, ...args) => events.push(["resize", ...args]),
    pixelRatio: () => 1.5,
    dialogRect: () => dialog,
    contains: (x, y, rect) => x >= rect.x && x <= rect.x + rect.width &&
      y >= rect.y && y <= rect.y + rect.height,
  };
  const OriginalPause = new Function(
    "wm", "G1", "zd0", "Co", "C9", "f3", "m9", "Wd0", "st", "ct",
    "p3", "xe", "V0", "j5", "Oe", "ws", "vs", "qD",
    `${pauseSource}; return Dy;`,
  )(
    ops.string, ops.releaseFont, ops.loadAssets, ops.smoothImages,
    ops.drawFrame, ops.captionRect, ops.drawText, ops.buttonHits,
    ops.buttonState, ops.drawButton, ops.resizeCanvas, ops.pixelRatio,
    () => dialog, () => ({}), ops.contains, ops.width, ops.height,
    ops.fontFamily,
  );
  const globals = ["document", "window", "ResizeObserver"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    document: { createElement: name => new Element(name) },
    window: {
      addEventListener: name => events.push(["window add", name]),
      removeEventListener: name => events.push(["window remove", name]),
    },
    ResizeObserver: class {
      observe(element) { events.push(["observe", element.name]); }
      disconnect() { events.push(["disconnect"]); }
    },
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const options = {
      root, library: "library",
      onInteraction: () => events.push("interaction"),
      onHover: () => events.push("hover"),
      onActivate: () => events.push("activate"),
      onResume: () => events.push("resume"),
      onRetry: () => events.push("retry"),
      onMenu: () => events.push("menu"),
    };
    const view = readable
      ? new PauseMenuView(options, assets, ops)
      : new OriginalPause(options, assets);
    view.setVisible(true);
    view.onPointerMove({ clientX: 150, clientY: 150 });
    view.onPointerDown({ clientX: 150, clientY: 150, button: 0, pointerId: 1 });
    view.onPointerUp({ clientX: 150, clientY: 150, pointerId: 1 });
    view.onPointerLeave();
    view.onPointerDown({ clientX: 450, clientY: 150, button: 0, pointerId: 2 });
    view.onPointerCancel({ pointerId: 2 });
    view.setVisible(false);
    view.setVisible(true);
    view.onPointerDown({ clientX: 750, clientY: 150, button: 0, pointerId: 3 });
    view.onPointerUp({ clientX: 750, clientY: 150, pointerId: 3 });
    view.dispose();
    view.dispose();
    return {
      events,
      attributes: view.canvas.attributes,
      style: view.canvas.style,
      hidden: view.canvas.hidden,
      visible: view.visible,
      disposed: view.disposed,
      hovered: view.hovered,
      pressed: view.pressed,
    };
  } finally {
    for (const name of globals) {
      const descriptor = previous[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("time attack pause canvas and pointer lifecycle match release", () => {
  assert.deepEqual(runPause(true), runPause(false));
});
