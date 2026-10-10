import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  TouchLayoutEditor, parseTouchLayout, normalizeTouchPlacement,
  resizeTouchButton, touchButtonPosition, applyTouchPlacement,
} from "../src/input/touch-layout-editor.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const original = new Function(`${[
  "zT", "r60", "$T", "WT", "HT", "s60", "Ay", "o60", "a60", "_c",
].map(sourceOf).join("\n")}; return { Layout: r60, parse: s60,
  normalize: a60, resize: $T, position: HT, apply: WT };`)();

test("touch layout parsing, bounds and CSS positioning match release", () => {
  const ids = ["left", "right", "pause"];
  for (const raw of [
    "bad", "null", "[]", "{}",
    JSON.stringify({ left: { x: .4, y: .7, size: 70 },
      right: { x: 1, y: 0, width: 44, height: 144 },
      pause: { x: NaN, y: 0, width: 45, height: 45 },
      unused: { x: 0, y: 0, size: 80 } }),
  ]) {
    assert.deepEqual(parseTouchLayout(raw, ids), original.parse(raw, ids));
  }
  for (const value of [null, {}, { x: 0, y: 1, size: 80 },
    { x: 0, y: 0, width: 30, height: 50 },
    { x: .5, y: .5, width: 80, height: 110 }]) {
    assert.deepEqual(normalizeTouchPlacement(value), original.normalize(value));
  }
  for (const [width, height, dx, dy] of [[80, 90, 5, -5],
    [44, 144, -10, 20], [120, 120, 100, -100]]) {
    assert.deepEqual(resizeTouchButton(width, height, dx, dy),
      original.resize(width, height, dx, dy));
  }
  for (const [fraction, size] of [[0, 44], [.4, 80], [1, 144]])
    assert.equal(touchButtonPosition(fraction, size), original.position(fraction, size));
});

function runLayout(Layout) {
  const saved = new Map([["kartsim.touch-layout", JSON.stringify({
    left: { x: .1, y: .2, size: 70 },
  })]]);
  const events = [];
  class Element {
    classNames = new Set();
    classList = {
      add: name => this.classNames.add(name),
      remove: name => this.classNames.delete(name),
      toggle: (name, force) => {
        const enabled = force === undefined ? !this.classNames.has(name) : force;
        if (enabled) this.classNames.add(name);
        else this.classNames.delete(name);
      },
    };
    style = {
      values: {},
      setProperty: (key, value) => { this.style.values[key] = value; },
      removeProperty: key => { delete this.style.values[key]; },
    };
    dataset = {};
    attributes = {};
    children = [];
    capture = new Set();
    constructor(name) { this.name = name; }
    querySelector(selector) {
      if (!this.queried) this.queried = new Map();
      if (!this.queried.has(selector)) this.queried.set(selector, new Element(selector));
      return this.queried.get(selector);
    }
    addEventListener() {}
    append(...children) {
      for (const child of children) {
        child.parentElement = this;
        this.children.push(child);
      }
    }
    insertBefore(child) { this.append(child); }
    contains(child) { return this.children.includes(child); }
    focus() { events.push(["focus", this.name]); }
    remove() { this.removed = true; }
    setAttribute(name, value) { this.attributes[name] = value; }
    getBoundingClientRect() {
      return { left: 100, top: 150, width: 70, height: 80,
        right: 170, bottom: 230 };
    }
    setPointerCapture(id) { this.capture.add(id); }
    hasPointerCapture(id) { return this.capture.has(id); }
    releasePointerCapture(id) { this.capture.delete(id); }
  }
  const parent = new Element("parent");
  const pad = new Element("pad");
  const left = new Element("left");
  left.dataset.actionName = "左转";
  pad.append(left);
  parent.append(pad);
  const menu = new Element("menu");
  const extra = new Element("extra");
  extra.dataset.actionName = "菜单";
  parent.append(extra);
  const globals = ["document", "window", "localStorage"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    document: { createElement: name => new Element(name), activeElement: extra },
    window: { innerWidth: 800, innerHeight: 600 },
    localStorage: {
      getItem: key => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const layout = new Layout(menu, pad,
      new Map([["left", left], ["menu", extra]]),
      () => events.push("change"));
    const initial = { ...layout.saved };
    layout.start();
    const pointer = { pointerId: 4, button: 0, clientX: 110, clientY: 165,
      preventDefault() { events.push("prevent"); },
      stopPropagation() { events.push("stop"); } };
    layout.startDrag(pointer, "left");
    layout.moveDrag({ ...pointer, clientX: 130, clientY: 185 });
    layout.stopDrag();
    layout.startResize(pointer);
    layout.moveResize({ ...pointer, clientX: 140, clientY: 100 });
    layout.stopResize();
    layout.moveWithKeyboard({ key: "ArrowRight", target: left,
      preventDefault() { events.push("key prevent"); } });
    layout.reset();
    layout.cancel();
    const afterCancel = { ...layout.draft };
    layout.start();
    layout.place("menu", 200, 180, 90, 100);
    layout.save();
    const styleSnapshot = element => ({
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      transform: element.style.transform,
      values: { ...element.style.values },
    });
    const result = {
      initial, afterCancel,
      saved: { ...layout.saved },
      serialized: saved.get("kartsim.touch-layout"),
      selected: layout.selected,
      editing: layout.isEditing,
      editorHidden: layout.editor.hidden,
      padHidden: pad.hidden,
      message: layout.message.textContent,
      resize: styleSnapshot(layout.resizeHandle),
      menuClasses: [...menu.classNames],
      leftClasses: [...left.classNames],
      leftStyle: styleSnapshot(left),
      extraClasses: [...extra.classNames],
      extraStyle: styleSnapshot(extra),
      events,
    };
    layout.dispose();
    return { ...result, disposed: layout.editor.removed };
  } finally {
    for (const name of globals) {
      const descriptor = previous[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("touch layout edit, drag, resize, cancel and save match release", () => {
  assert.deepEqual(runLayout(TouchLayoutEditor), runLayout(original.Layout));
});
