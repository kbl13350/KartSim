import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGarageCosmeticEquippedSlots, type GarageEquippedCosmeticEquipment,
  type GarageEquippedCosmeticLayout, type GarageEquippedCosmeticsDependencies,
  type GarageEquippedCosmeticsHost,
} from "./garage-equipped-cosmetics";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

class ElementStub {
  className = "";
  title = "";
  textContent = "";
  disabled = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: ElementStub[] = [];
  onClick?: () => void;
  classList = { add: (name: string) => { this.classes.add(name); } };
  constructor(readonly tag: string) {}
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  snapshot(): unknown {
    return {
      tag: this.tag, className: this.className, title: this.title,
      textContent: this.textContent, disabled: this.disabled, dataset: this.dataset,
      attributes: [...this.attributes], classes: [...this.classes],
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageEquippedCosmeticsHost & {
  updateCosmeticEquippedSlots(equipment: GarageEquippedCosmeticEquipment,
    layout: GarageEquippedCosmeticLayout, interactive: boolean): void;
};

const v1Layout: GarageEquippedCosmeticLayout = {
  kind: "v1", equippedRoot: "equipment", slotSize: 60,
  cosmeticTabs: [
    { node: "partsCoating", label: "车膜" },
    { node: "partsTailLamp", label: "车灯" },
    { node: "partsBoosterEffect", label: "加速特效" },
  ],
};
const xunLayout: GarageEquippedCosmeticLayout = {
  kind: "xun", equippedRoot: "equipment", slotSize: 50,
  cosmeticTabs: [
    { node: "partsCoating12", label: "车膜" },
    { node: "partsTailLamp12", label: "车灯" },
    { node: "partsBoosterEffect12", label: "加速特效" },
  ],
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const slots: ElementStub[] = [];
  const previews: ElementStub[] = [];
  let transformActive = false;
  const dependencies: GarageEquippedCosmeticsDependencies = {
    defaultLampIcon: family => { events.push(["default-icon", family]); return `lamp:${family}`; },
  };
  const fakeDocument = { createElement: (tag: string) => new ElementStub(tag) };
  const Original = new Function("ni", "document", `${classSource}; return As;`)(
    dependencies.defaultLampIcon, fakeDocument) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.assets = {
    coatings: [
      { id: 1, family: "classic", title: "经典蓝膜", icon: "coating/blue.png" },
      { id: 2, family: "xun", title: "迅蓝膜", icon: "coating/xun.png" },
    ],
    cosmetics: [
      { id: 7, family: "classic", slot: "tailLamp", title: "经典车灯", icon: "lamp/classic.png" },
      { id: 8, family: "xun", slot: "tailLamp", title: "迅车灯", icon: "lamp/xun.png" },
      { id: 9, family: "xun", slot: "boosterEffect", title: "彩虹加速" },
    ],
    strings: new Map([["emptyLamp", "基础灯"], ["emptyParts", "空槽"]]),
    nodes: new Map([["/equipment/selectedKartEquippedV1/partsTailLamp/previewEquippedTailLamp", {}]]),
  };
  host.coatingMode = false;
  host.cosmeticSlot = undefined;
  host.cosmeticPreview = undefined;
  host.coatingPreview = undefined;
  host.previewPart = undefined;
  host.transformPreviewStartPending = true;
  host.inventory = { scrollTop: 80 };
  host.cancelPreview = { hidden: true };
  host.status = { textContent: "initial" };
  host.panels = {
    setTransformPreview: enabled => { events.push(["set-transform", enabled]); transformActive = enabled; },
    toggleTransformPreview: () => { events.push("toggle-transform"); transformActive = !transformActive; },
  };
  host.button = (label, onClick) => {
    events.push(["button", label]);
    const button = new ElementStub("button");
    button.textContent = label;
    button.onClick = onClick;
    slots.push(button);
    return button as unknown as HTMLButtonElement;
  };
  host.icon = (name, className) => {
    events.push(["icon", name, className]);
    const icon = new ElementStub("icon");
    icon.title = name;
    icon.className = className;
    return icon as unknown as HTMLElement;
  };
  host.cosmeticIcon = (choice, className) => {
    events.push(["cosmetic-icon", choice.id, className]);
    const icon = new ElementStub("cosmetic-icon");
    icon.title = choice.title;
    return icon as unknown as HTMLElement;
  };
  host.rect = path => { events.push(["rect", path]); return path; };
  host.place = (_button, rect) => { events.push(["place", rect]); };
  host.nativeButton = (path, label, onClick) => {
    events.push(["native-button", path, label]);
    const button = new ElementStub("native-button");
    button.textContent = label;
    button.onClick = onClick;
    previews.push(button);
    return button as unknown as HTMLButtonElement;
  };
  host.transformPreviewSessionActive = () => {
    events.push(["transform-active", transformActive]);
    return transformActive;
  };
  host.startTransformPreview = forced => {
    events.push(["start-transform", forced]); transformActive = true;
  };
  host.syncTransformPreviewUi = () => { events.push("sync-transform-ui"); };
  host.updatePerformance = () => { events.push("performance"); };
  host.updateControls = () => { events.push("controls"); };
  if (!released) host.updateCosmeticEquippedSlots = (equipment, layout, interactive) =>
    updateGarageCosmeticEquippedSlots(host, equipment, layout, interactive, dependencies);
  const snapshot = () => ({
    events: structuredClone(events), slots: slots.map(slot => slot.snapshot()),
    previews: previews.map(preview => preview.snapshot()),
    mode: host.coatingMode, slot: host.cosmeticSlot, cosmeticPreview: host.cosmeticPreview?.id,
    pending: host.transformPreviewStartPending, scroll: host.inventory.scrollTop,
    cancelHidden: host.cancelPreview.hidden, status: host.status.textContent,
  });
  return { host, fakeDocument, slots, previews, snapshot };
}

function withDocument<T>(fakeDocument: unknown, callback: () => T): T {
  const previous = globalThis.document;
  globalThis.document = fakeDocument as Document;
  try { return callback(); }
  finally { globalThis.document = previous; }
}

test("V1 equipped slots, default lamp preview and selection match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      const states: unknown[] = [];
      f.host.updateCosmeticEquippedSlots({ cosmetics: { coating: 1 } }, v1Layout, true);
      states.push(f.snapshot());
      f.slots[1]!.onClick?.();
      states.push(f.snapshot());
      f.previews[0]!.onClick?.();
      states.push(f.snapshot());
      f.previews[0]!.onClick?.();
      states.push(f.snapshot());
      return states;
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN equipped icons and noninteractive vehicle info match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      f.host.updateCosmeticEquippedSlots(
        { cosmetics: { coating: 2, tailLamp: 8, boosterEffect: 9 } }, xunLayout, false);
      f.slots[0]!.onClick?.();
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("V1 selected lamp preview uses equipped title like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      f.host.updateCosmeticEquippedSlots({ cosmetics: { tailLamp: 7 } }, v1Layout, true);
      f.previews[0]!.onClick?.();
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates equipped cosmetic slots", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-equipped-cosmetics\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "updateCosmeticEquippedSlots");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!),
    /updateGarageCosmeticEquippedSlots\(this, equipment, layout, interactive, garageEquippedCosmeticsDependencies\)/);
});
