import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGarageControls, type GarageControlsDependencies, type GarageControlsHost,
  type GarageControlsVehicle, type GaragePartCardLayout,
} from "./garage-controls";
import type { GaragePart, GaragePartSlot } from "./garage-parts-business";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  className = "";
  textContent = "";
  title = "";
  disabled = false;
  hidden = false;
  scrollTop = 0;
  removed = false;
  dataset: Record<string, string> = {};
  classes = new Set<string>();
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  children: ElementStub[] = [];
  onClick?: () => void;
  style = {
    backgroundImage: "",
    setProperty: (name: string, value: string) => { this.properties.set(name, value); },
  };
  classList = { toggle: (name: string, active: boolean) => {
    if (active) this.classes.add(name);
    else this.classes.delete(name);
  } };
  constructor(readonly tag: string) {}
  append(...children: ElementStub[]): void { this.children.push(...children); }
  replaceChildren(): void { this.children = []; }
  remove(): void { this.removed = true; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  snapshot(): unknown {
    return {
      tag: this.tag, className: this.className, text: this.textContent,
      title: this.title, disabled: this.disabled, hidden: this.hidden,
      scrollTop: this.scrollTop, removed: this.removed, dataset: this.dataset,
      classes: [...this.classes], attributes: [...this.attributes],
      properties: [...this.properties], backgroundImage: this.style.backgroundImage,
      children: this.children.map(child => child.snapshot()),
    };
  }
}

const part1: GaragePart = { family: "xun", slot: "engine", itemId: 1, grade: 1, value: 1 };
const part2: GaragePart = { family: "xun", slot: "engine", itemId: 2, grade: 2, value: 2 };
const cardLayout: GaragePartCardLayout = {
  width: 136, height: 100, stepX: 144, stepY: 110,
  iconWidth: 60, iconHeight: 55, iconAdjustY: 8, texture: "card",
  titleRect: { x: 1, y: 2, width: 80, height: 20 },
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  let customizable = true;
  let factoryAllowed = true;
  let layoutMissing = false;
  let familyMissing = false;
  const selected: GarageControlsVehicle = {
    itemId: 101, title: "XUN 101", path: "kart/101", engineGrade: 9,
    uniqueLevel: 3, kartType: 2,
  };
  const classic: GarageControlsVehicle = {
    itemId: 102, title: "Classic 102", path: "kart/102", engineGrade: 3,
    kartType: 1,
  };
  const dependencies: GarageControlsDependencies = {
    showVehicleInformation: (page, grade) => {
      events.push(["vehicle-info-mounted", page, grade]);
      return page === "parts" || page === "level" && grade === 9;
    },
    progressionFamily: grade => {
      events.push(["progression-family", grade]);
      return familyMissing ? undefined : grade === 9 ? "xun" : grade === 3 ? "classic" : undefined;
    },
    canCustomize: itemId => { events.push(["customizable", itemId, customizable]); return customizable; },
    blockedKart: itemId => { events.push(["blocked", itemId]); return false; },
    progressionSupport: grade => { events.push(["support", grade]); return grade === 9 ? "xun" : "classic"; },
    expectedProgressionKind: family => { events.push(["expected-kind", family]); return family; },
    currentEquipment: (configuration, itemId, serial) => {
      events.push(["equipment", itemId, serial]);
      return (configuration as { current: Record<string, unknown> }).current;
    },
    vehicleFamily: (_base, grade) => { events.push(["vehicle-family", grade]); return grade === 9 ? "xun" : "classic"; },
    layoutForGrade: grade => {
      events.push(["layout", grade]);
      if (layoutMissing) return undefined;
      return { kind: grade === 9 ? "xun" : "v1", partsTab: "parts",
        cosmeticTabs: [{ node: "partsCoating", label: "车膜" },
          { node: "partsTailLamp", label: "车灯" }] };
    },
    initialProgression: xun => { events.push(["initial", xun]); return {
      kind: xun ? "xun" : "classic", level: 0,
    }; },
    slots: ["engine", "handle", "wheel", "booster"],
    slotNodes: { engine: "tuneEnginePatch", handle: "tuneHandle",
      wheel: "tuneWheel", booster: "tuneSupportKit" },
    slotLabel: (slot, family) => { events.push(["slot-label", slot, family]); return slot; },
    partsForSlot: (_assets, family, slot) => {
      events.push(["parts", family, slot]);
      return slot === "engine" ? [part1, part2] : [];
    },
    cardLayout: (_assets, family) => { events.push(["card-layout", family]); return cardLayout; },
    inventoryRect: (_assets, family) => { events.push(["inventory-rect", family]); return "inventory-rect"; },
    quality: part => { events.push(["quality", part.itemId]); return part.grade; },
    cardTexture: (part, texture) => { events.push(["card-texture", part.itemId, texture]); return "texture"; },
    samePart: (left, right) => { events.push(["same", left?.itemId, right.itemId]); return left?.itemId === right.itemId; },
    equippedPart: (_base, equipment, slot, _available, grade, uniqueLevel) => {
      events.push(["equipped", slot, grade, uniqueLevel]);
      return equipment[slot] as GaragePart | undefined;
    },
    slotLocked: (_base, slot) => { events.push(["locked", slot]); return slot === "handle"; },
    canEquip: locked => { events.push(["can-equip", locked]); return !locked; },
    bindPreview: (_button, part, _selected, _update) => { events.push(["bind-preview", part.itemId]); },
  };
  const fakeDocument = { createElement: (tag: string) => new ElementStub(tag) };
  const names = ["ds", "pe", "ae", "Re", "Ue", "Ut", "K", "me", "ue", "ce", "de",
    "wt", "le", "qi", "xt", "Dt", "Et", "Sn", "Kt", "Xe", "fe", "mt", "Mn", "document"];
  const values = [dependencies.showVehicleInformation, dependencies.progressionFamily,
    dependencies.canCustomize, dependencies.blockedKart,
    dependencies.progressionSupport, dependencies.expectedProgressionKind,
    dependencies.currentEquipment, dependencies.vehicleFamily,
    dependencies.layoutForGrade, dependencies.initialProgression,
    dependencies.slots, dependencies.slotNodes, dependencies.slotLabel,
    dependencies.partsForSlot, dependencies.cardLayout, dependencies.inventoryRect,
    dependencies.quality, dependencies.cardTexture, dependencies.samePart,
    dependencies.equippedPart, dependencies.slotLocked, dependencies.canEquip,
    dependencies.bindPreview, fakeDocument];
  const Original = new Function(...names, `${classSource}; return As;`)(...values) as {
    prototype: GarageControlsHost;
  };
  const host = Object.create(Original.prototype) as GarageControlsHost;
  host.selected = selected;
  host.pageMode = "parts";
  host.slot = "engine";
  host.coatingMode = false;
  host.cosmeticSlot = undefined;
  host.coatingPreview = undefined;
  host.cosmeticPreview = undefined;
  host.previewPart = undefined;
  host.cosmeticBusy = false;
  host.transformPreviewStartPending = false;
  host.transformPreviewUiHidden = false;
  host.upgradeCatalogEmpty = false;
  host.scoreRevision = 0;
  host.configuration = { current: {
    engine: part1, progression: { kind: "xun", level: 2 },
    factory: { active: true }, exceedType: 3, cosmetics: { coating: 1 },
  } };
  host.options = {
    catalog: { karts: [selected, classic] },
    profile: { equipment: { itemIds: [0, 0, 0, 101], kartSerial: 7, exceedType: 4 } },
    library: "archive",
  };
  host.assets = { parts: {}, strings: new Map([["engineGrade13", "迅车辆部件"]]),
    imageUrls: new Map([["texture", "asset.png"]]) };
  host.defaultPartGrades = {};
  host.element = new ElementStub("root") as unknown as HTMLElement;
  const controls = new ElementStub("controls");
  const staleButton = new ElementStub("old-tab");
  const transform = new ElementStub("transform-preview");
  (controls as unknown as { querySelectorAll(selector: string): ElementStub[] }).querySelectorAll = selector => {
    events.push(["query-all", selector]);
    return [staleButton];
  };
  (controls as unknown as { querySelector(selector: string): ElementStub }).querySelector = selector => {
    events.push(["query", selector]); return transform;
  };
  host.controls = controls as unknown as HTMLElement;
  const inventory = new ElementStub("inventory");
  inventory.scrollTop = 40;
  host.inventory = inventory as unknown as HTMLElement;
  const info = new ElementStub("info");
  host.info = info as unknown as HTMLElement;
  const vehicleFunctions = new ElementStub("functions");
  host.vehicleFunctions = vehicleFunctions as unknown as HTMLElement;
  const kartName = new ElementStub("kart-name");
  host.kartName = kartName as unknown as HTMLElement;
  host.partTitle = new ElementStub("part-title") as unknown as HTMLElement;
  host.cancelPreview = new ElementStub("cancel") as unknown as HTMLElement;
  host.removePart = new ElementStub("remove") as unknown as HTMLButtonElement;
  const progressionElement = new ElementStub("progression");
  host.progressionPanel = {
    element: progressionElement as unknown as HTMLElement,
    update: (...args) => { events.push(["progression-update", structuredClone(args)]); },
    updateRadar: (...args) => { events.push(["radar", structuredClone(args)]); },
  };
  host.factoryPanel = {
    update: (...args) => { events.push(["factory-update", structuredClone(args)]); },
    updateScores: (...args) => { events.push(["factory-scores", structuredClone(args)]); },
  };
  host.pointEffects = { setContext: context => { events.push(["context", context]); } };
  host.factorySessionVehicleKey = "kart:101";
  host.factorySession = { pending: true };
  host.modelCache = { clear: () => { events.push("clear-models"); } };
  host.modelTargets = ["old-target"];
  host.comparisons = ["old-comparison"];
  host.slotControls = new Map<GaragePartSlot, HTMLElement>([
    ["engine", new ElementStub("engine-slot") as unknown as HTMLElement],
    ["handle", new ElementStub("handle-slot") as unknown as HTMLElement],
  ]);
  host.previewParts = new Map();
  host.panels = { setTransformPreview: active => { events.push(["transform", active]); } };
  host.serial = () => { events.push("serial"); return 7; };
  host.base = () => { events.push("base"); return { defaultExceedType: 5 }; };
  host.setVehicleInfoNodesMounted = mounted => { events.push(["mount-info", mounted]); };
  host.setPartsOnlyNodesMounted = mounted => { events.push(["mount-parts", mounted]); };
  host.setUpgradeStatusMounted = mounted => { events.push(["mount-upgrade-status", mounted]); };
  host.selectKart = vehicle => { events.push(["select", vehicle.itemId]); host.selected = vehicle; };
  host.nativeFactoryAllowed = () => { events.push(["factory-allowed", factoryAllowed]); return factoryAllowed; };
  host.factoryVehicleKey = vehicle => { events.push(["factory-key", vehicle.itemId]); return `kart:${vehicle.itemId}`; };
  host.updateVehicleHeading = level => { events.push(["heading", level]); };
  host.updateVehicleInformation = (_base, _equipment, layout) => { events.push(["vehicle-information", layout.kind]); };
  host.updateCosmeticEquippedSlots = (_equipment, layout, interactive) => {
    events.push(["equipped-cosmetics", layout.kind, interactive]);
  };
  host.updateFactoryScores = () => { events.push("factory-scores-update"); };
  host.updatePageVisibility = () => { events.push("page-visibility"); };
  host.updateCards = () => { events.push("cards"); };
  host.nativeButton = (path, label, onClick, alternate) => {
    events.push(["native-button", path, label, alternate]);
    const button = new ElementStub("native-button");
    button.onClick = onClick;
    return button as unknown as HTMLButtonElement;
  };
  host.moveToTransformPreviewRoot = button => {
    events.push(["move-transform-root", (button as unknown as ElementStub).dataset.partTab]);
  };
  host.selectSlot = slot => { events.push(["select-slot", slot]); };
  host.updateCoatingInventory = () => { events.push("coating-inventory"); };
  host.updateCosmeticInventory = () => { events.push("cosmetic-inventory"); };
  host.button = (label, onClick) => {
    events.push(["button", label]);
    const button = new ElementStub("button");
    button.textContent = label;
    button.onClick = onClick;
    return button as unknown as HTMLButtonElement;
  };
  host.setPartPreview = part => { events.push(["part-preview", part?.itemId]); };
  host.partLabel = part => { events.push(["part-label", part.itemId]); return `Part ${part.itemId}`; };
  host.icon = (name, className) => {
    events.push(["icon", name, className]); return new ElementStub("icon") as unknown as HTMLElement;
  };
  host.partVisual = (_button, part, className, row) => {
    events.push(["part-visual", part.itemId, className, row]);
  };
  host.requestEquip = part => { events.push(["request-equip", part?.itemId]); };
  host.equip = part => { events.push(["equip", part.itemId]); };
  host.skin = (_button, name) => { events.push(["skin", name]); };
  host.rect = name => { events.push(["rect", name]); return name; };
  host.place = (_element, rect) => { events.push(["place", rect]); };
  host.updateControls = () => { events.push("recursive-update"); };
  const update = released ? () => (Original.prototype as unknown as { updateControls(): void }).updateControls.call(host)
    : () => updateGarageControls(host, dependencies);
  const snapshot = () => ({
    events: structuredClone(events), selected: host.selected.itemId,
    family: host.element.dataset.engineLayout, scoreRevision: host.scoreRevision,
    coatingMode: host.coatingMode, cosmeticSlot: host.cosmeticSlot,
    upgradeEmpty: host.upgradeCatalogEmpty, inventory: inventory.snapshot(),
    info: info.snapshot(), vehicleFunctions: vehicleFunctions.snapshot(),
    kartName: kartName.snapshot(), partTitle: (host.partTitle as unknown as ElementStub).snapshot(),
    remove: (host.removePart as unknown as ElementStub).snapshot(),
    cancel: (host.cancelPreview as unknown as ElementStub).snapshot(),
    progression: progressionElement.snapshot(), transform: transform.snapshot(),
    modelTargets: structuredClone(host.modelTargets), comparisons: structuredClone(host.comparisons),
    staleButton: staleButton.snapshot(), previewParts: [...host.previewParts.values()].map(part => part.itemId),
  });
  return { host, update, snapshot, fakeDocument,
    setCustomizable: (value: boolean) => { customizable = value; },
    setFactoryAllowed: (value: boolean) => { factoryAllowed = value; },
    setLayoutMissing: (value: boolean) => { layoutMissing = value; },
    setFamilyMissing: (value: boolean) => { familyMissing = value; },
  };
}

function withDocument<T>(fakeDocument: unknown, callback: () => T): T {
  const previous = globalThis.document;
  globalThis.document = fakeDocument as Document;
  try { return callback(); }
  finally { globalThis.document = previous; }
}

test("Factory availability, pending state and unsupported vehicle match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.host.pageMode = "factory";
      f.update();
      states.push(f.snapshot());
      f.setFactoryAllowed(false);
      f.update();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("level fallback, XUN and classic progression panels match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.host.pageMode = "level";
      f.update();
      states.push(f.snapshot());
      f.host.selected.engineGrade = 3;
      (f.host.configuration as { current: Record<string, unknown> }).current.progression =
        { kind: "classic", level: 1 };
      f.update();
      states.push(f.snapshot());
      f.setCustomizable(false);
      f.update();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("parts inventory cards, cosmetic tab and missing layout match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.update();
      states.push(f.snapshot());
      f.host.coatingMode = true;
      f.update();
      states.push(f.snapshot());
      f.host.coatingMode = false;
      f.setLayoutMissing(true);
      f.update();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates full controls refresh", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-controls\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "updateControls");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!),
    /updateGarageControls\(this, garageControlsDependencies\)/);
});
