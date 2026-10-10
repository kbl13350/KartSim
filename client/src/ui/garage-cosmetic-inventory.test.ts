import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  garageCosmeticIcon, syncGarageCosmeticPreviewActions,
  updateGarageCoatingInventory, updateGarageCosmeticInventory,
  type GarageCosmeticInventoryDependencies, type GarageCosmeticInventoryHost,
  type GarageInventoryCosmetic,
} from "./garage-cosmetic-inventory";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  className = "";
  title = "";
  textContent = "";
  disabled = false;
  hidden = false;
  style: { backgroundImage?: string } = {};
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: ElementStub[] = [];
  onClick?: () => void;
  classList = { toggle: (name: string, active: boolean) => {
    if (active) this.classes.add(name);
    else this.classes.delete(name);
  } };
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  append(child: ElementStub): void { this.children.push(child); }
  snapshot(): unknown {
    return {
      tag: this.tag, className: this.className, title: this.title,
      textContent: this.textContent, disabled: this.disabled, hidden: this.hidden,
      style: this.style, attributes: [...this.attributes], classes: [...this.classes],
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageCosmeticInventoryHost & {
  updateCoatingInventory(): void;
  updateCosmeticInventory(): void;
  syncCosmeticPreviewActions(): void;
};

const coatings: GarageInventoryCosmetic[] = [
  { id: 1, family: "xun", title: "蓝色车膜", icon: "coating/blue.png" },
  { id: 2, family: "xun", title: "绿色车膜" },
  { id: 3, family: "xun", title: "禁用车膜", unavailableReason: "资源缺失" },
  { id: 4, family: "classic", title: "经典车膜" },
];
const cosmetics: GarageInventoryCosmetic[] = [
  { id: 7, family: "xun", slot: "tailLamp", title: "星光车灯", icon: "tailLamp/star.png" },
  { id: 8, family: "xun", slot: "tailLamp", title: "霓虹车灯", previewModel: "models/neon" },
  { id: 9, family: "xun", slot: "boosterEffect", title: "彩虹加速", previewModel: "models/rainbow" },
  { id: 10, family: "classic", slot: "tailLamp", title: "经典车灯" },
];

function fixture(released: boolean) {
  const events: unknown[] = [];
  let locked = false;
  let previewActive = false;
  const dependencies: GarageCosmeticInventoryDependencies = {
    currentConfiguration: (configuration, itemId, serial) => {
      events.push(["read", itemId, serial]);
      return (configuration as { current: { cosmetics: Record<string, unknown> } }).current;
    },
    vehicleFamily: (_base, grade) => { events.push(["family", grade]); return grade === 9 ? "xun" : "classic"; },
    choicesForSlot: (choices, slot) => {
      events.push(["choices", slot, choices.length]);
      return choices.filter(choice => choice.slot === slot);
    },
    slotLocked: (_base, slot) => { events.push(["locked", slot]); return locked; },
    canEquip: (isLocked, unavailable = false) => {
      events.push(["can-equip", isLocked, unavailable]);
      return !isLocked && !unavailable;
    },
    cardBackgroundKey: "card-texture",
  };
  const fakeDocument = { createElement: (tag: string) => new ElementStub(tag) };
  const Original = new Function("K", "rt", "ci", "li", "mt", "Ze", "document",
    `${classSource}; return As;`)(
      dependencies.currentConfiguration, dependencies.vehicleFamily,
      dependencies.choicesForSlot, dependencies.slotLocked,
      dependencies.canEquip, dependencies.cardBackgroundKey, fakeDocument,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 101, engineGrade: 9 };
  host.configuration = { current: { cosmetics: { coating: 1, tailLamp: 7 } } };
  host.cosmeticSlot = "tailLamp";
  host.cosmeticBusy = false;
  host.cosmeticPreview = undefined;
  host.coatingPreview = undefined;
  host.assets = {
    coatings, cosmetics, imageUrls: new Map([["card-texture", "assets/card.png"]]),
  };
  const inventory = new ElementStub("inventory");
  host.inventory = inventory as unknown as HTMLElement;
  host.cancelPreview = new ElementStub("cancel") as unknown as HTMLElement;
  host.cancelPreview.hidden = true;
  host.status = { textContent: "initial" };
  host.panels = { setTransformPreview: active => { events.push(["transform", active]); } };
  host.serial = () => { events.push("serial"); return 7; };
  host.base = () => { events.push("base"); return { partsLocks: [0, 0, 0, 0, locked ? 1 : 0] }; };
  host.button = (label, onClick) => {
    events.push(["button", label]);
    const button = new ElementStub("button");
    button.textContent = label;
    button.onClick = onClick;
    return button as unknown as HTMLButtonElement;
  };
  host.icon = (name, className) => {
    events.push(["icon", name, className]);
    const icon = new ElementStub("icon");
    icon.className = className;
    icon.title = name;
    return icon as unknown as HTMLElement;
  };
  host.skin = (_button, name) => { events.push(["skin", name]); };
  host.requestCoating = choice => { events.push(["request-coating", choice.id]); };
  host.requestCosmetic = choice => { events.push(["request-cosmetic", choice.id]); };
  host.addModelTarget = (_button, model, className, row, _placeholder, dimensions) => {
    events.push(["model", model.path, className, row, dimensions]);
  };
  host.startTransformPreview = () => { events.push("start-transform"); };
  host.transformPreviewSessionActive = () => { events.push("preview-active"); return previewActive; };
  const previewButtons = [new ElementStub("button"), new ElementStub("button")];
  previewButtons[0]!.textContent = "预览";
  previewButtons[1]!.textContent = "取消";
  host.controls = { querySelectorAll: selector => {
    events.push(["query", selector]);
    return previewButtons as unknown as NodeListOf<HTMLElement>;
  } };
  if (!released) {
    host.cosmeticIcon = (choice, className) => garageCosmeticIcon(host, choice, className);
    host.updateCoatingInventory = () => updateGarageCoatingInventory(host, dependencies);
    host.updateCosmeticInventory = () => updateGarageCosmeticInventory(host, dependencies);
    host.syncCosmeticPreviewActions = () => syncGarageCosmeticPreviewActions(host);
  }
  const snapshot = () => ({
    events: structuredClone(events), inventory: inventory.children.map(child => child.snapshot()),
    status: host.status.textContent, coating: host.coatingPreview?.id,
    cosmetic: host.cosmeticPreview?.id, cancelHidden: host.cancelPreview.hidden,
    previewButtons: previewButtons.map(button => button.snapshot()),
  });
  return { host, inventory, previewButtons, fakeDocument, snapshot,
    setLocked: (value: boolean) => { locked = value; },
    setPreviewActive: (value: boolean) => { previewActive = value; },
  };
}

function withDocument<T>(fakeDocument: unknown, callback: () => T): T {
  const previous = globalThis.document;
  globalThis.document = fakeDocument as Document;
  try { return callback(); }
  finally { globalThis.document = previous; }
}

test("coating cards, preview and equip availability match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.host.updateCoatingInventory();
      states.push(f.snapshot());
      f.inventory.children[1]!.children[0]!.onClick?.();
      states.push(f.snapshot());
      f.inventory.children[1]!.children[1]!.onClick?.();
      states.push(f.snapshot());
      f.inventory.children.length = 0;
      f.setLocked(true);
      f.host.updateCoatingInventory();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("cosmetic cards, model hints and changing preview match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.host.updateCosmeticInventory();
      states.push(f.snapshot());
      f.inventory.children[0]!.children[0]!.onClick?.();
      f.inventory.children[1]!.children[0]!.onClick?.();
      f.inventory.children[1]!.children[1]!.onClick?.();
      states.push(f.snapshot());
      f.inventory.children.length = 0;
      f.host.cosmeticSlot = "boosterEffect";
      f.host.updateCosmeticInventory();
      states.push(f.snapshot());
      f.inventory.children.length = 0;
      f.setLocked(true);
      f.host.cosmeticBusy = true;
      f.host.updateCosmeticInventory();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("mounted cosmetic preview buttons follow transform state like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.syncCosmeticPreviewActions();
    states.push(f.snapshot());
    f.setPreviewActive(true);
    f.host.syncCosmeticPreviewActions();
    states.push(f.snapshot());
    f.host.controls = undefined;
    f.host.syncCosmeticPreviewActions();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates cosmetic inventory rendering", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-cosmetic-inventory\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["cosmeticIcon", "garageCosmeticIcon"],
    ["updateCoatingInventory", "updateGarageCoatingInventory"],
    ["updateCosmeticInventory", "updateGarageCosmeticInventory"],
    ["syncCosmeticPreviewActions", "syncGarageCosmeticPreviewActions"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this`));
});
