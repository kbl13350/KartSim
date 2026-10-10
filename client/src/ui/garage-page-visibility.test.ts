import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGaragePageVisibility, type GaragePageVisibilityDependencies,
  type GaragePageVisibilityHost,
} from "./garage-page-visibility";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  dataset: Record<string, string> = {};
  children: unknown[] = [];
  hidden = false;
  disabled = false;
  classes = new Set<string>();
  properties = new Map<string, string>();
  style = {
    top: "",
    setProperty: (name: string, value: string) => { this.properties.set(name, value); },
  };
  classList = { toggle: (name: string, active: boolean) => {
    if (active) this.classes.add(name);
    else this.classes.delete(name);
  } };
  constructor(readonly name: string) {}
  querySelectorAll(selector: string): ElementStub[] {
    if (selector === "[data-filter], [data-garage-catalog='search']")
      return this.children.filter((child): child is ElementStub => child instanceof ElementStub &&
        (child.dataset.filter !== undefined || child.dataset.garageCatalog === "search"));
    if (selector === "[data-garage-catalog='leftKartPage'], [data-garage-catalog='rightKartPage']")
      return this.children.filter((child): child is ElementStub => child instanceof ElementStub &&
        ["leftKartPage", "rightKartPage"].includes(child.dataset.garageCatalog ?? ""));
    throw new Error(`unexpected selector: ${selector}`);
  }
  snapshot(): unknown {
    return { name: this.name, dataset: this.dataset, hidden: this.hidden,
      disabled: this.disabled, classes: [...this.classes],
      properties: [...this.properties], top: this.style.top };
  }
}

type TestHost = GaragePageVisibilityHost & { updatePageVisibility(): void };

function fixture(released: boolean) {
  const events: unknown[] = [];
  let customizable = true;
  const dependencies: GaragePageVisibilityDependencies = {
    canCustomize: itemId => { events.push(["customize", itemId]); return customizable; },
    showVehicleInformation: (page, grade) => {
      events.push(["vehicle-info", page, grade]);
      return page === "parts" || page === "level" && grade === 9;
    },
    defaultCardRect: () => { events.push("default-card-rect"); return "default-rect"; },
  };
  const Original = new Function("ae", "ds", "bt", "HTMLElement",
    `${classSource}; return As;`)(
      dependencies.canCustomize, dependencies.showVehicleInformation,
      dependencies.defaultCardRect, ElementStub,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.pageMode = "parts";
  host.selected = { itemId: 101, engineGrade: 9 };
  const controls = new ElementStub("controls");
  const items = [
    new ElementStub("parts-tab"), new ElementStub("level-tab"),
    new ElementStub("factory-tab"), new ElementStub("restore"),
    new ElementStub("vehicle-info"), new ElementStub("transform"),
    new ElementStub("filter"), new ElementStub("search-control"),
    new ElementStub("left-page"), new ElementStub("right-page"),
  ];
  items[0]!.dataset.garageCommon = "parts";
  items[1]!.dataset.garageCommon = "level";
  items[2]!.dataset.garageCommon = "factory";
  items[3]!.dataset.garageRestore = "true";
  items[4]!.dataset.vehicleInfo = "true";
  items[5]!.dataset.transformPreview = "true";
  items[5]!.dataset.transformAvailable = "false";
  items[6]!.dataset.filter = "1";
  items[7]!.dataset.garageCatalog = "search";
  items[8]!.dataset.garageCatalog = "leftKartPage";
  items[9]!.dataset.garageCatalog = "rightKartPage";
  const cancelPreview = new ElementStub("cancel-preview");
  controls.children = [...items, cancelPreview, { unrelated: true }];
  host.controls = controls as unknown as HTMLElement;
  host.progressionPanel = { element: new ElementStub("progression") as unknown as HTMLElement };
  host.inventory = new ElementStub("inventory") as unknown as HTMLElement;
  host.inventoryScrollHit = new ElementStub("scroll-hit") as unknown as HTMLElement;
  const factoryElement = new ElementStub("factory-panel");
  host.factoryPanel = {
    element: factoryElement as unknown as HTMLElement, showsCatalog: true,
    assets: { rects: new Map([
      ["pageInfo", "factory-page-info"],
      ["preItemList", "factory-left"],
      ["nextItemList", "factory-right"],
    ]) },
    catalogLayout: { columns: 3, rows: 2, cardWidth: 100, cardHeight: 70,
      gapX: 8, gapY: 12, rect: "factory-cards" },
  };
  host.kartName = new ElementStub("kart-name") as unknown as HTMLElement;
  host.search = new ElementStub("search") as unknown as HTMLElement;
  host.cards = new ElementStub("cards") as unknown as HTMLElement;
  host.pageLabel = new ElementStub("page-label") as unknown as HTMLElement;
  host.cancelPreview = cancelPreview as unknown as HTMLElement;
  host.previewPart = undefined;
  host.cosmeticPreview = undefined;
  host.status = new ElementStub("status") as unknown as HTMLElement;
  host.assets = {};
  host.rect = name => { events.push(["rect", name]); return `rect:${name}`; };
  host.place = (element, rect) => {
    events.push(["place", (element as unknown as ElementStub).name, rect]);
  };
  host.syncTransformPreviewUi = () => { events.push("sync-transform"); };
  if (!released) host.updatePageVisibility = () => updateGaragePageVisibility(host, dependencies);
  const all = [controls, ...items, cancelPreview, host.progressionPanel.element,
    host.inventory, host.inventoryScrollHit, factoryElement, host.kartName,
    host.search, host.cards, host.pageLabel, host.status] as ElementStub[];
  const snapshot = () => ({ events: structuredClone(events),
    elements: all.map(element => element.snapshot()) });
  return { host, snapshot, setCustomizable: (value: boolean) => { customizable = value; } };
}

function withHTMLElement<T>(callback: () => T): T {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  try { return callback(); }
  finally { globalThis.HTMLElement = previous; }
}

test("Parts and level controls follow visibility and customization rules like As", () => {
  const run = (released: boolean) => withHTMLElement(() => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.updatePageVisibility();
    states.push(f.snapshot());
    f.host.pageMode = "level";
    f.setCustomizable(false);
    f.host.updatePageVisibility();
    states.push(f.snapshot());
    return states;
  });
  assert.deepEqual(run(false), run(true));
});

test("Factory catalog geometry and hidden catalog match As", () => {
  const run = (released: boolean) => withHTMLElement(() => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.pageMode = "factory";
    f.host.updatePageVisibility();
    states.push(f.snapshot());
    f.host.factoryPanel!.showsCatalog = false;
    f.host.updatePageVisibility();
    states.push(f.snapshot());
    return states;
  });
  assert.deepEqual(run(false), run(true));
});

test("missing Factory assets use standard card geometry like As", () => {
  const run = (released: boolean) => withHTMLElement(() => {
    const f = fixture(released);
    f.host.pageMode = "factory";
    f.host.factoryPanel!.assets = undefined;
    f.host.factoryPanel!.catalogLayout = undefined;
    f.host.updatePageVisibility();
    return f.snapshot();
  });
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates page visibility", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-page-visibility\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "updatePageVisibility");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!),
    /updateGaragePageVisibility\(this, garagePageVisibilityDependencies\)/);
});
