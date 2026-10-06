import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  commitGarageFactoryChoice,
  createGarageFactoryChoiceButton,
  renderGarageFactoryAbilityPicker,
  updateGarageFactoryDraftSlot,
  type FactoryDraftSlot,
  type FactoryPickerRect,
  type GarageFactoryPickerDependencies,
  type GarageFactoryPickerHost,
} from "./garage-factory-picker";
import type { GarageFactoryConfiguration } from "./garage-factory-commit";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const panel = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Pa");
assert.ok(panel);
const classSource = release.slice(panel.start!, panel.end!);

class ElementStub {
  type = "";
  textContent = "";
  className = "";
  title = "";
  disabled = false;
  dataset: Record<string, string> = {};
  classes = new Set<string>();
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  children: ElementStub[] = [];
  onclick?: () => void;
  style = {
    fontFamily: "",
    setProperty: (key: string, value: string) => { this.properties.set(key, value); },
  };
  classList = { add: (...names: string[]) => names.forEach(name => this.classes.add(name)) };
  constructor(readonly tag: string) {}
  append(...children: ElementStub[]): void { this.children.push(...children); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  snapshot(): unknown {
    return {
      tag: this.tag, type: this.type, text: this.textContent, className: this.className,
      title: this.title, disabled: this.disabled, dataset: { ...this.dataset },
      classes: [...this.classes], attributes: [...this.attributes],
      properties: [...this.properties], fontFamily: this.style.fontFamily,
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageFactoryPickerHost & {
  renderAbilityPicker(configuration: GarageFactoryConfiguration, editable: boolean, rect: FactoryPickerRect): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const elements: Array<{ element: ElementStub; rect: FactoryPickerRect }> = [];
  const abilities = [
    { id: 100, label: "加速" }, { id: 200, label: "转弯" },
    { id: 300, label: "漂移" }, { id: 400, label: "氮气" },
  ];
  const draftFrom = (configuration: GarageFactoryConfiguration): FactoryDraftSlot[] =>
    configuration.abilities.map(id => id ? { group: Math.floor(id / 100), level: id % 100 } : {});
  const signature = (configuration: GarageFactoryConfiguration) =>
    `${configuration.active ? 1 : 0}:${configuration.abilities.join(",")}`;
  const validate = (configuration: GarageFactoryConfiguration) => {
    events.push(["validate", structuredClone(configuration)]);
    if (configuration.abilities.length !== 3) throw new Error("three abilities required");
  };
  const abilityId = (group: number, level: number) => group * 100 + level;
  const stylePrimary = (button: HTMLButtonElement) => {
    (button as unknown as ElementStub).classList.add("garage-skill-action", "garage-skill-action-primary");
  };
  const nodeAttribute = (node: unknown, key: string) => (node as Record<string, string>)[key]!;
  const nativeStatePath = (base: string, state: number) => `${base}${state}`;
  const dependencies: GarageFactoryPickerDependencies = {
    abilities, draftFrom, signature, validate, abilityId,
    stylePrimary, nodeAttribute, nativeStatePath,
  };
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const Original = new Function("Mt", "ht", "Zt", "Tt", "Hs", "he", "y", "se", "document",
    `${classSource}; return Pa;`)(
      abilities, draftFrom, signature, validate, abilityId,
      stylePrimary, nodeAttribute, nativeStatePath, documentStub,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.assets = {
    nodes: new Map([["tab_parts", { autoLoadImage: "tab/parts" }]]),
    urls: new Map([1, 2, 3, 4].map(state => [`tab/parts${state}`, `state-${state}.png`] as const)),
    fontFamily: "Garage Test",
  };
  host.draft = [{ group: 1, level: 1 }, { group: 2, level: 2 }, {}];
  host.draftDirty = false;
  host.selectedAbilityIndex = 0;
  host.appliedSignature = undefined;
  host.onTabChange = () => { events.push("tab-change"); };
  host.onChange = configuration => { events.push(["change", structuredClone(configuration)]); };
  host.label = (text, rect) => {
    const element = new ElementStub("div");
    element.textContent = text;
    elements.push({ element, rect: { ...rect } });
    return element as unknown as HTMLElement;
  };
  host.place = (element, rect) => {
    elements.push({ element: element as unknown as ElementStub, rect: { ...rect } });
  };
  if (!released) {
    host.renderAbilityPicker = (configuration, editable, rect) =>
      renderGarageFactoryAbilityPicker(host, configuration, editable, rect, dependencies);
    host.updateDraftSlot = (index, slot) => updateGarageFactoryDraftSlot(host, index, slot);
    host.commit = configuration => commitGarageFactoryChoice(host, configuration, dependencies);
    host.factoryChoiceButton = (text, pressed, disabled, action) =>
      createGarageFactoryChoiceButton(host, text, pressed, disabled, action, dependencies);
  }
  const configuration = { active: false, abilities: [101, 202, 0] };
  const rect = { x: 20, y: 30, width: 600, height: 500 };
  const button = (className: string, text?: string) => elements
    .map(entry => entry.element)
    .find(element => element.classes.has(className) && (text === undefined || element.textContent === text));
  const snapshot = () => ({
    events: structuredClone(events), draft: structuredClone(host.draft),
    dirty: host.draftDirty, selected: host.selectedAbilityIndex,
    signature: host.appliedSignature,
    elements: elements.map(({ element, rect }) => ({ ...element.snapshot() as object, rect })),
  });
  return { host, configuration, rect, elements, button, snapshot };
}

function withDocument<T>(run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = { createElement: (tag: string) => new ElementStub(tag) } as unknown as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("Factory picker layout, disabled duplicate groups and slot editing match Pa", () => {
  const run = (released: boolean) => withDocument(() => {
    const f = fixture(released);
    f.host.renderAbilityPicker(f.configuration, true, f.rect);
    const initial = f.snapshot();
    f.button("garage-factory-attribute-choice", "漂移")!.onclick?.();
    const changed = f.snapshot();
    f.button("garage-factory-slot-choice")!.onclick?.();
    f.host.updateDraftSlot(2, { group: 4, level: 3 });
    return { initial, changed, final: f.snapshot() };
  });
  assert.deepEqual(run(false), run(true));
});

test("Factory picker confirmation, read-only mode and commit validation match Pa", () => {
  const run = (released: boolean) => withDocument(() => {
    const f = fixture(released);
    f.host.draft = [{ group: 1, level: 1 }, { group: 2, level: 2 }, { group: 3, level: 3 }];
    f.host.draftDirty = true;
    f.host.renderAbilityPicker(f.configuration, true, f.rect);
    const enabled = f.snapshot();
    f.button("garage-skill-action")!.onclick?.();
    const committed = f.snapshot();
    f.elements.length = 0;
    f.host.renderAbilityPicker(f.configuration, false, f.rect);
    const readOnly = f.snapshot();
    let failure: string | undefined;
    try { f.host.commit({ active: true, abilities: [101] }); }
    catch (error) { failure = (error as Error).message; }
    return { enabled, committed, readOnly, failure, afterFailure: f.snapshot() };
  });
  assert.deepEqual(run(false), run(true));
});

test("Factory draft edits without a draft and native choice button states match Pa", () => {
  const run = (released: boolean) => withDocument(() => {
    const f = fixture(released);
    f.host.draft = undefined;
    f.host.updateDraftSlot(1, { group: 3, level: 2 });
    const button = f.host.factoryChoiceButton("速度", true, false,
      () => { f.host.onTabChange(); });
    const before = (button as unknown as ElementStub).snapshot();
    (button as unknown as ElementStub).onclick?.();
    return { before, after: f.snapshot() };
  });
  assert.deepEqual(run(false), run(true));
});

test("generated Factory panel delegates its picker and commit methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const generatedPanel = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "Pa");
  if (!generatedPanel || generatedPanel.type !== "ClassDeclaration")
    throw new Error("Generated Pa class missing");
  const delegates = new Map([
    ["renderAbilityPicker", "renderGarageFactoryAbilityPicker"],
    ["updateDraftSlot", "updateGarageFactoryDraftSlot"],
    ["commit", "commitGarageFactoryChoice"],
    ["factoryChoiceButton", "createGarageFactoryChoiceButton"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = generatedPanel.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`\\b${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageFactoryPickerOverrides, [...delegates.keys()]);
});
