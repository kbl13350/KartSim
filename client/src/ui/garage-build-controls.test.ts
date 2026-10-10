import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  buildGarageControls, type GarageBuildControlsDependencies,
  type GarageBuildControlsHost,
} from "./garage-build-controls";
import type { GaragePreviewRect } from "./garage-transform-preview";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  className = "";
  textContent = "";
  title = "";
  hidden = false;
  placeholder = "";
  maxLength = 0;
  value = "";
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  classes = new Set<string>();
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  listeners = new Map<string, Array<(event: never) => void>>();
  onclick?: () => void;
  oninput?: () => void;
  style = { setProperty: (key: string, value: string) => { this.properties.set(key, value); } };
  classList = { add: (...names: string[]) => names.forEach(name => this.classes.add(name)) };
  constructor(readonly name: string) {}
  append(child: ElementStub): void { this.children.push(child); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  addEventListener(name: string, callback: (event: never) => void,
    _options?: unknown): void {
    const list = this.listeners.get(name) ?? [];
    list.push(callback);
    this.listeners.set(name, list);
  }
  dispatch(name: string, event: unknown): void {
    for (const callback of this.listeners.get(name) ?? []) callback(event as never);
  }
  snapshot(): unknown {
    return { name: this.name, className: this.className, text: this.textContent,
      title: this.title, hidden: this.hidden, placeholder: this.placeholder,
      maxLength: this.maxLength, value: this.value, dataset: { ...this.dataset },
      children: this.children.map(child => child.name), classes: [...this.classes],
      attributes: [...this.attributes], properties: [...this.properties],
      listeners: [...this.listeners.keys()] };
  }
}

type TestHost = GarageBuildControlsHost & { buildControls(): void };

function fixture(released: boolean) {
  const events: unknown[] = [];
  const buttons = new Map<string, ElementStub>();
  const rect: GaragePreviewRect = { x: 10, y: 20, width: 100, height: 30 };
  const dependencies: GarageBuildControlsDependencies = {
    slots: ["engine", "wheel"],
    slotLabels: { engine: "引擎", wheel: "车轮" },
    inventoryRect: (_assets, family) => {
      events.push(["inventory-rect", family]); return rect;
    },
    removeButtonRect: { x: 40, y: 50, width: 60, height: 25 },
    cardsRect: () => { events.push("cards-rect"); return rect; },
  };
  const Original = new Function("de", "ai", "Dt", "_n", "bt",
    `${classSource}; return As;`)(
      dependencies.slots, dependencies.slotLabels, dependencies.inventoryRect,
      dependencies.removeButtonRect, dependencies.cardsRect,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const nodes = new Map<string, ElementStub>();
  const element = (name: string) => {
    const node = new ElementStub(name); nodes.set(name, node); return node;
  };
  host.assets = { partScrollbar: "scrollbar", kartCardLayout: { width: 90, height: 70, gapX: 8 } };
  host.tuning = { rects: new Map([["kartBodyEffect12", rect]]) };
  host.controls = element("controls") as unknown as HTMLElement;
  host.kartName = element("kart-name") as unknown as HTMLElement;
  host.info = element("info") as unknown as HTMLElement;
  host.vehicleFunctions = element("functions") as unknown as HTMLElement;
  host.partTitle = element("part-title") as unknown as HTMLElement;
  host.inventory = element("inventory") as unknown as HTMLElement;
  host.inventoryScrollHit = element("scroll-hit") as unknown as HTMLElement;
  host.removePart = element("remove") as unknown as HTMLButtonElement;
  host.cancelPreview = element("cancel") as unknown as HTMLButtonElement;
  host.search = element("search") as unknown as HTMLInputElement;
  host.cards = element("cards") as unknown as HTMLElement;
  host.pageLabel = element("page-label") as unknown as HTMLElement;
  host.status = element("status") as unknown as HTMLElement;
  host.slotControls = new Map();
  host.vehicleInfoNodes = [];
  host.partsOnlyNodes = [];
  host.filter = 0;
  host.page = 2;
  host.inventoryScroll = {
    down: (event, scrollbar, bounds, authoredY) =>
      { events.push(["down", event.pointerId, scrollbar, bounds, authoredY]); },
    move: (scrollbar, bounds, authoredY) =>
      { events.push(["move", scrollbar, bounds, authoredY]); },
    up: pointerId => { events.push(["up", pointerId]); },
    page: direction => { events.push(["page-scroll", direction]); return direction < 0; },
  };
  host.nativeButton = (name, label, action) => {
    events.push(["native-button", name, label]);
    const button = element(name);
    button.textContent = label;
    button.onclick = action;
    buttons.set(name, button);
    return button as unknown as HTMLButtonElement;
  };
  host.button = (label, action) => {
    events.push(["button", label]);
    const button = element(`button:${label}`);
    button.textContent = label;
    button.onclick = action;
    buttons.set(label, button);
    return button as unknown as HTMLButtonElement;
  };
  host.skin = (button, base) => {
    events.push(["skin", (button as unknown as ElementStub).name, base]);
  };
  host.place = (child, bounds) => {
    events.push(["place", (child as unknown as ElementStub).name, bounds]);
  };
  host.placeInTransformPreviewRoot = (child, bounds) => {
    events.push(["preview-place", (child as unknown as ElementStub).name, bounds]);
  };
  host.rect = name => { events.push(["rect", name]); return rect; };
  host.createTransformPreviewButton = () => {
    events.push("transform-button"); return element("transform") as unknown as HTMLButtonElement;
  };
  host.authoredPointerY = event => { events.push(["authored-y", event.clientY]); return event.clientY + 1; };
  host.rehitTestInventoryPreview = () => { events.push("rehit"); };
  host.updateCards = () => { events.push(["cards", host.filter, host.page, host.search.value]); };
  host.requestRestoreDefaults = () => { events.push("restore-defaults"); };
  host.selectPage = page => { events.push(["select-page", page]); };
  host.selectSlot = slot => { events.push(["select-slot", slot]); };
  if (!released) host.buildControls = () => buildGarageControls(host, dependencies);
  const snapshot = () => ({
    events: structuredClone(events),
    nodes: [...nodes].map(([name, node]) => [name, node.snapshot()]),
    slots: [...host.slotControls.keys()],
    vehicleInfo: host.vehicleInfoNodes.map(node => (node as unknown as ElementStub).name),
    partsOnly: host.partsOnlyNodes.map(node => (node as unknown as ElementStub).name),
    filter: host.filter, page: host.page, pointer: host.inventoryPointer,
  });
  return { host, buttons, nodes, events, snapshot };
}

test("Garage controls construction and authored placement match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.buildControls();
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("Garage catalog and inventory event callbacks match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.buildControls();
    f.buttons.get("partsInstall")!.onclick?.();
    f.buttons.get("kartLevelUp")!.onclick?.();
    f.buttons.get("partsFactory")!.onclick?.();
    f.buttons.get("引擎")!.onclick?.();
    f.buttons.get("恢复原装")!.onclick?.();
    f.buttons.get("speedKart")!.onclick?.();
    f.buttons.get("leftKartPage")!.onclick?.();
    f.buttons.get("rightKartPage")!.onclick?.();
    const search = f.nodes.get("search")!;
    search.value = "XUN";
    search.oninput?.();
    f.buttons.get("resetKeyword")!.onclick?.();
    const scrollHit = f.nodes.get("scroll-hit")!;
    scrollHit.dispatch("pointerdown", { pointerId: 8, clientY: 100 });
    scrollHit.dispatch("pointermove", { pointerId: 8, clientY: 120 });
    scrollHit.dispatch("pointerup", { pointerId: 8 });
    scrollHit.dispatch("pointercancel", { pointerId: 9 });
    const inventory = f.nodes.get("inventory")!;
    inventory.dispatch("wheel", { clientX: 5, clientY: 6, deltaY: -1,
      preventDefault: () => { f.events.push("prevented"); } });
    inventory.dispatch("pointermove", { clientX: 7, clientY: 8 });
    inventory.dispatch("pointerleave", {});
    inventory.dispatch("scroll", {});
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Garage view delegates buildControls", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "buildControls");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!), /buildGarageControls\(/);
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageBuildControlsOverrides, ["buildControls"]);
});
