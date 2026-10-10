import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MultiplayerWindowView, type MultiplayerWindowViewDependencies } from "./multiplayer-window-view";
import { chooseMultiplayerCombo, closeMultiplayerCombo } from "./multiplayer-window-actions";
import type { WindowNode } from "./multiplayer-window-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class te {");
const end = release.indexOf("\nfunction OM(", start);
assert.ok(start >= 0 && end > start);

function exercise(readable: boolean) {
  const events: unknown[] = [];
  const previousDocument = globalThis.document;
  const previousObserver = globalThis.ResizeObserver;
  const context = {} as CanvasRenderingContext2D;
  class Element {
    tagName: string;
    style: Record<string, string> = {};
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();
    children: Element[] = [];
    listeners = new Map<string, Array<(event: any) => void>>();
    hidden = false;
    disabled = false;
    id = "";
    className = "";
    width = 0;
    height = 0;
    parent?: Element;
    constructor(tagName: string) { this.tagName = tagName; }
    getContext() { return context; }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    append(...children: Element[]) {
      for (const child of children) { this.children.push(child); child.parent = this; }
      events.push(["append", this.tagName, children.map(child => child.tagName)]);
    }
    addEventListener(name: string, listener: (event: any) => void) {
      const listeners = this.listeners.get(name) ?? [];
      listeners.push(listener);
      this.listeners.set(name, listeners);
    }
    dispatch(name: string, event: object) {
      for (const listener of this.listeners.get(name) ?? []) listener(event);
    }
    focus() { (globalThis.document as unknown as { activeElement: unknown }).activeElement = this;
      events.push(["focus", this.tagName]); }
    remove() { events.push(["remove", this.tagName]); }
  }
  class Observer {
    constructor(_changed: () => void) {}
    observe(_root: unknown) { events.push(["observe"]); }
    disconnect() { events.push(["disconnect"]); }
  }
  class HitLayer {
    constructor(_canvas: unknown, _element: unknown, _size: unknown,
      readonly changed: (hovered: unknown, pressed: unknown) => void) {}
    reset() { events.push(["hit-reset"]); }
    dispose() { events.push(["hit-dispose"]); }
  }
  globalThis.document = {
    createElement: (name: string) => new Element(name), activeElement: undefined,
  } as unknown as Document;
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  try {
    const attribute = (node: WindowNode, name: string) =>
      (node as WindowNode & { attributes: Record<string, string> }).attributes[name];
    const measureText = (_context: unknown, value: string, style: { size: number }) =>
      ({ width: value.length * style.size, height: style.size + 2 });
    const drawText = (_context: unknown, value: string, rectangle: unknown,
      style: Record<string, unknown>) => events.push(["text", value, rectangle, style]);
    const decoratePopup = (popup: Element) => Object.assign(popup.style,
      { position: "absolute", width: "1px", height: "1px", padding: "0",
        border: "0", overflow: "hidden", clipPath: "inset(50%)",
        pointerEvents: "none" });
    const Original = new Function("nR", "tR", "T", "Sn", "ve", "m9", "E8", "G1",
      `let hQ = 0;\n${release.slice(start, end)}\nreturn te;`)(
        HitLayer, decoratePopup, attribute, "font", measureText, drawText,
        (value: string) => `color:${value}`, (font: unknown) => events.push(["release", font]),
      ) as new (options: unknown) => MultiplayerWindowView;
    const deps: MultiplayerWindowViewDependencies = {
      newHitLayer: (canvas, element, size, changed) => new HitLayer(canvas, element, size, changed),
      decoratePopup: popup => decoratePopup(popup as unknown as Element),
      attribute, measureText, drawText,
      color: value => `color:${value}`,
      releaseFont: font => { events.push(["release", font]); },
      fontFamily: "font",
      renderWindow: () => events.push(["render"]),
      drawNode: () => {}, canvasButton: () => ({}),
      updateHoverRegion: () => {},
      closeCombo: host => closeMultiplayerCombo(host as never),
      chooseCombo: (host, index) => chooseMultiplayerCombo(host as never, index),
      drawComboPopup: () => {}, loadAssets: async () => {},
    };
    const root = new Element("root");
    const combo = { name: "Combo", children: [], attributes: { name: "people",
      text: "#sb(people)", textRender: "Size18", textColor: "1 2 3 4" } } as WindowNode;
    const control = new Element("button");
    const options = {
      root: root as unknown as HTMLElement, definition: combo, label: "room",
      modal: true, preserveDisplayPixels: true,
      state: (_node: WindowNode) => ({ select: { values: ["A", "B", "C"], value: "A",
        change: (value: string) => events.push(["choose", value]) } }),
      onActivate: () => events.push(["activate"]),
      onCancel: () => events.push(["cancel"]),
      onConfirm: () => events.push(["confirm"]),
    };
    const view = readable
      ? new MultiplayerWindowView(options, deps) : new Original(options);
    // Both renderers are already covered by their own release differential tests.
    view.render = () => { events.push(["render"]); };
    view.font = "loaded-font";
    view.controls.set(combo, control as unknown as HTMLElement);
    view.strings.set("people", "players");
    const constructorSnapshot = {
      layer: view.element.dataset.uiLayer,
      attributes: [...(view.element as unknown as Element).attributes],
      elementStyle: { ...view.element.style }, canvasStyle: { ...view.canvas.style },
      popupStyle: { ...view.popup.style }, popupHidden: view.popup.hidden,
      popupIdPrefix: view.popup.id.replace(/\d+$/, ""),
      children: (view.element as unknown as Element).children.map(child => child.tagName),
      listeners: [...(view.element as unknown as Element).listeners.keys()],
    };
    view.show();
    const wrap = view.wrapLabel("AB|CDEF", 31, 10);
    view.paintLabelLines(context, wrap.lines, { x: 2, y: 3, width: 20, height: 40 },
      10, "blue", wrap.lineHeight);
    const replaced = view.text("hello #sb(people) #sb(missing)");
    view.drawComboText(combo, { x: 1, y: 2, width: 3, height: 4 });
    view.focus("people");
    const keyboard = (key: string) => ({ key, isComposing: false, shiftKey: false,
      preventDefault: () => events.push(["prevent", key]),
      stopPropagation: () => events.push(["stop", key]) });
    view.openCombo = combo;
    (view.element as unknown as Element).dispatch("keydown", keyboard("ArrowDown"));
    const selectedIndex = view.comboIndex;
    (view.element as unknown as Element).dispatch("keydown", keyboard("Enter"));
    (view.element as unknown as Element).dispatch("keydown", keyboard("Escape"));
    (view.element as unknown as Element).dispatch("keydown", keyboard("Enter"));
    (view.element as unknown as Element).dispatch("keydown", keyboard("Tab"));
    (view.buttonLayer as HitLayer).changed(combo, combo);
    const hovered = view.hovered === combo && view.pressed === combo;
    view.repaint();
    const flags = [view.comboOpen, view.hoveredRegionId, view.paintingOnly];
    view.hide();
    view.dispose();
    return { constructorSnapshot, wrap, replaced, selectedIndex, hovered, flags,
      disposed: view.disposed, hidden: view.element.hidden,
      controls: view.controls.size, events };
  } finally {
    globalThis.document = previousDocument;
    globalThis.ResizeObserver = previousObserver;
  }
}

test("multiplayer window shell construction, text and lifecycle match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
