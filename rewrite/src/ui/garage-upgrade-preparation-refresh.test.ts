import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { refreshGaragePreparation } from "./garage-upgrade-preparation-refresh";
import { compareGarageUpgradeLevels, preparationMethodPanelRect } from
  "./garage-upgrade-preparation-render";
import { GarageUpgradePreparationState } from "./garage-progression-session";
import type { XunGarageProgression } from "./garage-progression-panel";

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
  children: ElementStub[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string | ((name: string, value: string) => void)> = {
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  };
  onclick?: () => void;
  listeners = new Map<string, () => void>();
  constructor(readonly name: string, readonly events: unknown[]) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  replaceChildren(...children: ElementStub[]) { this.children = children; }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: () => void) { this.listeners.set(name, callback); }
  focus() { this.events.push(["focus", this.name, this.attrs["aria-label"]]); }
  getContext(_kind: string) {
    return {
      imageSmoothingEnabled: false,
      clearRect: (...args: unknown[]) => { this.events.push(["clear", ...args]); },
    };
  }
  getBoundingClientRect() { return { width: this.width, height: this.height }; }
  matches(_selector: string) { return false; }
  findButton(label: string): ElementStub | undefined {
    if (this.name === "button" && this.attrs["aria-label"] === label) return this;
    return this.children.map(child => child.findButton(label)).find(Boolean);
  }
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
  globalThis.document = documentStub as unknown as Document;
  globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
  const fitCanvas = (_canvas: unknown, _context: unknown, ...args: unknown[]) =>
    { events.push(["fit", ...args]); };
  const pixelRatio = () => { events.push("ratio"); return 2; };
  const drawFrame = (_context: unknown, frame: unknown,
    image: CanvasImageSource, rect: unknown) => {
    events.push(["frame", frame, (image as { name: string }).name, rect]);
  };
  const Original = new Function(
    "document", "ResizeObserver", "Pe", "Ee", "be", "Za", "ss",
    source + "; return Ja;",
  )(documentStub, undefined, fitCanvas, pixelRatio, drawFrame,
    compareGarageUpgradeLevels, preparationMethodPanelRect) as
    new (...args: never[]) => { refresh(): void };
  const host = released
    ? Object.create(Original.prototype) as InstanceType<typeof Original>
    : {} as InstanceType<typeof Original>;
  const value = (level: number): XunGarageProgression => ({
    kind: "xun", level, skills: [
      { id: 1, points: 0 }, { id: 2, points: 0 }, { id: 3, points: 0 },
    ],
  });
  const state = new GarageUpgradePreparationState(
    Array.from({ length: 18 }, (_, itemId) => ({
      item: { itemId, engineGrade: 9, title: "Vehicle " + itemId },
      value: value(2),
    })), 17, {
      blockedKart: () => false,
      validate: () => undefined,
      nextLevel: (progression, method) => ({
        ...progression, level: method === "max" ? 5 : progression.level + 1,
      }),
    });
  const rects = new Map<string, { x: number; y: number; width: number; height: number }>();
  const names = [
    "tuningTargetLabel", "itemName", "curLevel", "nextLevel",
    "curSlotNum", "nextSlotNum", "curTp", "nextTp",
    "tuningSlotLabel", "tuningPointLabel", "kartCount", "pageInfo",
    "preItemList", "nextItemList", "levelUpStart", "kartSelector", "itemView",
  ];
  names.forEach((name, index) => rects.set(name,
    { x: 10 + index * 3, y: 20 + index * 4, width: 100, height: 30 }));
  const arrow = (name: string, direction: "left" | "right") => ({
    name, direction, color: [255, 1, 2, 3], hoverColor: [255, 4, 5, 6],
    clickedColor: [255, 7, 8, 9], disabledColor: [100, 10, 11, 12],
  });
  const assets = {
    rect: { x: 100, y: 50, width: 900, height: 700 },
    rects,
    cardLayout: {
      width: 80, height: 50, columns: 4, horizontalMargin: 5,
      verticalMargin: 6, clientLeft: 7, clientTop: 8,
    },
    pageArrows: [arrow("preItemList", "left"), arrow("nextItemList", "right")],
    pageButtonFrames: new Map([
      ["normal", "normal-frame"], ["hover", "hover-frame"],
      ["clicked", "clicked-frame"], ["disabled", "disabled-frame"],
    ]),
    images: new Map([["frame", { name: "frame-atlas" }]]),
    urls: new Map(Array.from({ length: 4 }, (_, index) =>
      ["tuninglevel_btnStart_" + (index + 1), "button-" + index + ".png"])),
    fontFamily: "XUN Font",
  };
  const element = new ElementStub("dialog", events);
  const controls = new ElementStub("controls", events);
  const status = new ElementStub("status", events);
  Object.assign(host, {
    state, assets, element, controls, status, disposed: false,
    pageFrameObservers: [], pageFrameRedraws: [],
    close: (accept: boolean) => { events.push(["close", accept]); },
  });
  const refresh = () => released
    ? host.refresh()
    : refreshGaragePreparation(host as unknown as Parameters<
        typeof refreshGaragePreparation>[0],
      { fitCanvas, pixelRatio, drawFrame });
  const snapshot = () => ({
    element: element.snapshot(), controls: controls.snapshot(),
    status: status.snapshot(), events: structuredClone(events),
    selected: state.selected.item.itemId, page: state.page,
    method: state.upgradeMethod,
  });
  const restore = () => {
    globalThis.document = oldDocument;
    globalThis.ResizeObserver = oldObserver;
  };
  return { refresh, snapshot, controls, restore };
}

test("upgrade preparation renders BML labels, methods, paging and cards like Ja.refresh", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    try {
      f.refresh();
      const initial = f.snapshot();
      f.controls.findButton("一键升满")?.onclick?.();
      const maximum = f.snapshot();
      f.controls.findButton("上一页强化车辆")?.onclick?.();
      const firstPage = f.snapshot();
      f.controls.findButton("强化目标：Vehicle 2")?.onclick?.();
      const selected = f.snapshot();
      f.controls.findButton("开始本地 Lv.3 强化")?.onclick?.();
      return { initial, maximum, firstPage, selected, final: f.snapshot() };
    } finally { f.restore(); }
  };
  assert.deepEqual(run(false), run(true));
});
