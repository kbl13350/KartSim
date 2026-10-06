import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  addPreparationCancelButton, addPreparationComparisonValue, addPreparationLabel,
  createPreparationButton, decoratePreparationPageArrow, placePreparationControl,
  type GaragePreparationArrow, type GaragePreparationControlHost,
} from "./garage-upgrade-preparation-controls";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ja");
assert.ok(view && view.type === "ClassDeclaration");
const source = release.slice(view.start!, view.end!);

class ElementStub {
  className = "";
  textContent = "";
  type = "";
  title = "";
  disabled = false;
  width = 0;
  height = 0;
  attrs: Record<string, string> = {};
  children: ElementStub[] = [];
  listeners = new Map<string, () => void>();
  style: Record<string, string | ((name: string, value: string) => void)> = {
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  };
  onclick?: () => void;

  constructor(readonly name: string, readonly events: unknown[]) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
  getBoundingClientRect() { return { width: 30, height: 31 }; }
  getContext(_kind: string) {
    return {
      imageSmoothingEnabled: false,
      clearRect: (...args: unknown[]) => { this.events.push(["clear", ...args]); },
    };
  }
  matches(_query: string) { return false; }
  focus() { this.events.push(["focus", this.name, this.attrs["aria-label"]]); }
  snapshot(): unknown {
    return {
      name: this.name, className: this.className, text: this.textContent,
      type: this.type, title: this.title, disabled: this.disabled,
      width: this.width, height: this.height, attrs: { ...this.attrs },
      style: Object.fromEntries(Object.entries(this.style).filter(([, value]) =>
        typeof value === "string")),
      children: this.children.map(child => child.snapshot()),
      listeners: [...this.listeners.keys()],
    };
  }
}

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = {
    activeElement: undefined as ElementStub | undefined,
    createElement: (name: string) => new ElementStub(name, events),
  };
  const oldDocument = globalThis.document;
  const oldObserver = globalThis.ResizeObserver;
  class ObserverStub {
    constructor(readonly callback: () => void) { events.push("observer"); }
    observe(element: unknown) { events.push(["observe", (element as ElementStub).name]); }
    disconnect() { events.push("disconnect"); }
  }
  globalThis.document = documentStub as unknown as Document;
  globalThis.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver;
  const fitCanvas = (_canvas: unknown, _context: unknown, ...args: unknown[]) =>
    events.push(["fit", ...args]);
  const pixelRatio = () => { events.push("ratio"); return 2; };
  const drawFrame = (_context: unknown, frame: unknown,
    image: { name: string }, rect: unknown) =>
    events.push(["frame", frame, image.name, rect]);
  const Original = new Function("document", "ResizeObserver", "Pe", "Ee", "be",
    source + ";return Ja;")(
      documentStub, ObserverStub, fitCanvas, pixelRatio, drawFrame,
    ) as new (...args: never[]) => GaragePreparationControlHost & {
      place(element: HTMLElement, rect: unknown): void;
      label(text: string, rectName: string, extraClass?: string): void;
      comparisonValue(rectName: string, value: number, increment?: number,
        extraClass?: string): void;
      button(label: string, rect: unknown, action: () => void,
        disabled?: boolean): HTMLButtonElement;
      cancelButton(): void;
      decoratePageArrow(button: HTMLButtonElement, arrow: unknown, rect: unknown): void;
    };
  const host = released
    ? Object.create(Original.prototype) as InstanceType<typeof Original>
    : {} as GaragePreparationControlHost;
  const controls = new ElementStub("controls", events);
  Object.assign(host, {
    controls,
    assets: {
      rect: { x: 100, y: 50, width: 900, height: 700 },
      rects: new Map([
        ["name", { x: 1, y: 2, width: 110, height: 30 }],
        ["metric", { x: 3, y: 4, width: 120, height: 40 }],
      ]),
      pageButtonFrames: new Map([
        ["normal", "normal-frame"], ["hover", "hover-frame"],
        ["clicked", "clicked-frame"], ["disabled", "disabled-frame"],
      ]),
      images: new Map([["frame", { name: "frame-atlas" }]]),
    },
    pageFrameObservers: [],
    close: (accept: boolean) => { events.push(["close", accept]); },
  });
  const rect = { x: 12, y: 13, width: 14, height: 15 };
  const arrow: GaragePreparationArrow = {
    direction: "left",
    color: [255, 1, 2, 3], hoverColor: [128, 4, 5, 6],
    clickedColor: [192, 7, 8, 9], disabledColor: [64, 10, 11, 12],
  };
  const place = (element: ElementStub) => released
    ? (host as InstanceType<typeof Original>).place(element as unknown as HTMLElement, rect)
    : placePreparationControl(host, element as unknown as HTMLElement, rect);
  const label = () => released
    ? (host as InstanceType<typeof Original>).label("车辆", "name", "title")
    : addPreparationLabel(host, "车辆", "name", "title");
  const value = () => released
    ? (host as InstanceType<typeof Original>).comparisonValue("metric", 6, 3)
    : addPreparationComparisonValue(host, "metric", 6, 3);
  const button = () => released
    ? (host as InstanceType<typeof Original>).button("下一页", rect,
        () => { events.push("button-click"); }, true)
    : createPreparationButton(host, "下一页", rect,
        () => { events.push("button-click"); }, true);
  const cancel = () => released
    ? (host as InstanceType<typeof Original>).cancelButton()
    : addPreparationCancelButton(host);
  const decorate = (element: HTMLButtonElement) => released
    ? (host as InstanceType<typeof Original>).decoratePageArrow(element, arrow, rect)
    : decoratePreparationPageArrow(host, element, arrow, rect,
        { fitCanvas, pixelRatio, drawFrame: drawFrame as never });
  const snapshot = () => ({
    events: structuredClone(events), controls: controls.snapshot(),
    observers: host.pageFrameObservers.length, redraws: host.pageFrameRedraws?.length,
  });
  const restore = () => {
    globalThis.document = oldDocument;
    globalThis.ResizeObserver = oldObserver;
  };
  return { controls, host, place, label, value, button, cancel, decorate,
    snapshot, restore };
}

test("preparation labels, values, buttons and close control match Ja", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    try {
      f.place(new ElementStub("custom", []));
      f.label();
      f.value();
      const button = f.button() as unknown as ElementStub;
      button.onclick?.();
      f.cancel();
      (f.controls.children.at(-1) as ElementStub).onclick?.();
      return f.snapshot();
    } finally { f.restore(); }
  };
  assert.deepEqual(run(false), run(true));
});

test("page arrow frame states and resize observer match Ja", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    try {
      const button = new ElementStub("button", []);
      f.decorate(button as unknown as HTMLButtonElement);
      button.listeners.get("mouseenter")?.();
      button.listeners.get("mousedown")?.();
      button.disabled = true;
      button.listeners.get("mouseleave")?.();
      f.host.pageFrameRedraws?.[0]?.();
      return { result: f.snapshot(), button: button.snapshot() };
    } finally { f.restore(); }
  };
  assert.deepEqual(run(false), run(true));
});
