import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { TouchDrivingControls, savedAutoForward, savedNitroSeamlessMode } from "../src/input/touch-driving-controls.ts";
import { TouchLayoutEditor } from "../src/input/touch-layout-editor.ts";
import { actionBindings, DEFAULT_KEY_MAP, keyboardActionsForCode } from "../src/input/action-bindings.ts";
import { DrivingAction } from "../src/input/driving-input.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const keyLabel = code => code === undefined ? "" : `K${code}`;
const OriginalTouch = new Function("l2", "ut", "Br", "SP", "xl", "r60",
  `${["i60", "Mi", "BF", "l60", "u60", "h60"]
    .map(sourceOf).join("\n")}; return l60;`)(
  DrivingAction, actionBindings, DEFAULT_KEY_MAP, keyLabel,
  keyboardActionsForCode, TouchLayoutEditor);
const originalSettings = new Function(`${["Mi", "BF", "u60", "h60"]
  .map(sourceOf).join("\n")}; return { auto: u60, nitro: h60 };`)();

test("stored touch driving preferences match release", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    for (const [auto, nitro] of [["true", "auto"], ["false", "manual"],
      [null, "off"], ["TRUE", "unknown"]]) {
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true, value: { getItem: key =>
          key === "kartsim.auto-forward" ? auto : nitro },
      });
      assert.equal(savedAutoForward(), originalSettings.auto());
      assert.equal(savedNitroSeamlessMode(), originalSettings.nitro());
    }
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true, value: { getItem() { throw new Error("disabled"); } },
    });
    assert.equal(savedAutoForward(), originalSettings.auto());
    assert.equal(savedNitroSeamlessMode(), originalSettings.nitro());
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

function runTouch(Controls, readable) {
  const events = [];
  const storage = new Map([
    ["kartsim.auto-forward", "false"],
    ["kartsim.nitro-seamless", "off"],
  ]);
  class Element {
    classNames = new Set();
    classList = {
      add: name => this.classNames.add(name),
      remove: name => this.classNames.delete(name),
      contains: name => this.classNames.has(name),
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
    captured = new Set();
    hidden = false;
    open = false;
    constructor(name) { this.name = name; }
    querySelector(selector) {
      if (!this.queries) this.queries = new Map();
      if (!this.queries.has(selector)) {
        const child = new Element(selector);
        child.parentElement = this;
        this.queries.set(selector, child);
      }
      return this.queries.get(selector);
    }
    querySelectorAll(selector) {
      if (selector !== "[data-drive]") return [];
      const pad = this.querySelector(".touch-pad");
      const specs = [["pause", "暂停"], [11, "复位"], [4, "漂移"],
        [5, "氮气"], [8, "释放超负荷"], [2, "前进"],
        [0, "左转"], [3, "后退"], [1, "右转"]];
      return specs.map(([id, name]) => {
        const button = new Element(`button:${id}`);
        button.dataset.drive = String(id);
        button.dataset.actionName = name;
        pad.append(button);
        return button;
      });
    }
    addEventListener(name, listener) {
      if (!this.listeners) this.listeners = new Map();
      if (!this.listeners.has(name)) this.listeners.set(name, []);
      this.listeners.get(name).push(listener);
    }
    fire(name, event) {
      for (const listener of this.listeners?.get(name) ?? []) listener(event);
    }
    append(...children) {
      for (const child of children) {
        child.parentElement = this;
        this.children.push(child);
      }
    }
    insertBefore(child) { this.append(child); }
    contains(child) { return this.children.includes(child); }
    getBoundingClientRect() {
      return { left: 100, top: 100, width: 80, height: 80,
        right: 180, bottom: 180 };
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    focus() {}
    remove() { this.removed = true; }
    close() { this.open = false; }
    showModal() { this.open = true; }
    closest() { return null; }
  }
  const document = {
    createElement: name => new Element(name),
    body: new Element("body"),
    hidden: false,
    fullscreenElement: null,
    fullscreenEnabled: false,
    activeElement: null,
    addEventListener() {},
  };
  const window = {
    matchMedia: query => ({ matches: query === "(pointer: coarse)",
      addEventListener() {} }),
    addEventListener() {},
  };
  const root = new Element("root");
  root.ownerDocument = document;
  const globals = ["document", "window", "navigator", "localStorage", "HTMLElement"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  for (const [name, value] of Object.entries({
    document, window, navigator: { maxTouchPoints: 2, standalone: false },
    localStorage: { getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value) },
    HTMLElement: Element,
  })) Object.defineProperty(globalThis, name,
    { configurable: true, writable: true, value });
  try {
    const controls = readable
      ? new Controls(root, (action, down) => events.push(["action", action, down]),
        () => events.push("pause"), allowed => events.push(["forward", allowed]),
        mode => events.push(["nitro", mode]), { keyLabel })
      : new Controls(root, (action, down) => events.push(["action", action, down]),
        () => events.push("pause"), allowed => events.push(["forward", allowed]),
        mode => events.push(["nitro", mode]));
    controls.setRaceState(true, false);
    const forward = controls.buttons.get(DrivingAction.Forward);
    const pointerEvent = pointerId => ({ button: 0, pointerId,
      pointerType: "touch", preventDefault() {} });
    forward.fire("pointerdown", pointerEvent(1));
    forward.fire("pointerdown", pointerEvent(2));
    forward.fire("pointerup", pointerEvent(1));
    controls.onTouchEnd({ touches: [] });
    controls.setKeyMap(DEFAULT_KEY_MAP);
    controls.onAutoForwardToggle();
    controls.resumeAutoForwardForGamepad();
    controls.setAutoForwardActive(true);
    controls.onNitroSeamlessToggle();
    controls.dispatchAction(DrivingAction.SteerLeft, true);
    controls.setRaceState(true, false, true);
    controls.dispatchAction(DrivingAction.SteerLeft, true);
    controls.pointers.set(8, DrivingAction.Forward);
    controls.buttons.get(DrivingAction.Forward).setPointerCapture(8);
    controls.releasePointer(8);
    controls.setRaceState(true, false, false);
    controls.onToggle();
    controls.showScreenHelp("测试提示。");
    const snapshot = {
      html: controls.element.innerHTML,
      events,
      autoForward: controls.autoForward,
      nitroSeamless: controls.nitroSeamless,
      available: controls.available,
      paused: controls.paused,
      lteDodge: controls.lteDodge,
      usingTouch: controls.usingTouch,
      usingGamepad: controls.usingGamepad,
      manualVisible: controls.manualVisible,
      autoForwardAllowed: controls.autoForwardAllowed,
      autoForwardSuspended: controls.autoForwardSuspended,
      padHidden: controls.pad.hidden,
      screenHelpHidden: controls.screenHelp.hidden,
      screenMessage: controls.screenMessage.textContent,
      menuExpanded: controls.menuButton.attributes["aria-expanded"],
      toggle: controls.toggle.textContent,
      autoHtml: controls.autoForwardToggle.innerHTML,
      nitroHtml: controls.nitroSeamlessToggle.innerHTML,
      forwardClasses: [...controls.buttons.get(DrivingAction.Forward).classNames],
      forwardAttributes: { ...controls.buttons.get(DrivingAction.Forward).attributes },
      buttonLabels: [...controls.buttons].map(([action, button]) =>
        [action, button.title, button.attributes["aria-label"], button.dataset.actionName]),
      storage: [...storage],
    };
    controls.dispose();
    return { ...snapshot, disposed: controls.element.removed };
  } finally {
    for (const name of globals) {
      const descriptor = previous[name];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
}

test("touch driving menu, key labels, LTE dodge and auto forward match release", () => {
  assert.deepEqual(runTouch(TouchDrivingControls, true), runTouch(OriginalTouch, false));
});
