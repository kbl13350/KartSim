import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGarageFactoryPanel,
  type GarageFactoryPanelDependencies,
  type GarageFactoryPanelHost,
} from "./garage-factory-panel";
import type { GarageFactoryConfiguration } from "./garage-factory-commit";
import type { FactoryPickerRect } from "./garage-factory-picker";

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
  textContent: string | undefined = "";
  className = "";
  title = "";
  disabled = false;
  width = 0;
  height = 0;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  classes = new Set<string>();
  properties = new Map<string, string>();
  children: ElementStub[] = [];
  onclick?: () => void;
  onpointerenter?: () => void;
  onpointerdown?: () => void;
  onpointerup?: () => void;
  onpointerleave?: () => void;
  style = {
    backgroundImage: "", border: "", padding: "", backgroundColor: "",
    backgroundSize: "", fontFamily: "", color: "", font: "",
    setProperty: (key: string, value: string) => { this.properties.set(key, value); },
  };
  classList = { add: (name: string) => this.classes.add(name) };
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  replaceChildren(): void { this.children = []; }
  getContext(kind: string): unknown { return kind === "2d" ? { kind: "2d" } : null; }
  snapshot(): unknown {
    return {
      tag: this.tag, type: this.type, text: this.textContent,
      className: this.className, title: this.title, disabled: this.disabled,
      width: this.width, height: this.height, dataset: { ...this.dataset },
      attributes: [...this.attributes], classes: [...this.classes],
      properties: [...this.properties], style: { ...this.style, setProperty: undefined },
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageFactoryPanelHost & {
  update(configuration?: GarageFactoryConfiguration, supported?: boolean,
    busy?: boolean, vehicleName?: string,
    vehicle?: { engineGrade?: number; kartType?: number; vehicleRarityLevel?: number },
    vehicleKey?: unknown): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const elements: ElementStub[] = [];
  const confirmations: Array<() => void> = [];
  const documentStub = {
    createElement: (tag: string) => {
      const element = new ElementStub(tag);
      elements.push(element);
      return element;
    },
  };
  const defaultConfiguration = () => ({ active: false, abilities: [0, 0, 0] });
  const signature = (configuration: GarageFactoryConfiguration) =>
    `${configuration.active ? 1 : 0}:${configuration.abilities.join(",")}`;
  const draftFrom = (configuration: GarageFactoryConfiguration) =>
    configuration.abilities.map(id => id ? { group: Math.floor(id / 100), level: id % 100 } : {});
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const nativeStatePath = (base: string, state: number) => `${base}${state}`;
  const childRect = (_node: unknown, parent: FactoryPickerRect | undefined) =>
    ({ x: (parent?.x ?? 0) + 5, y: (parent?.y ?? 0) + 5,
      width: parent?.width ?? 0, height: parent?.height ?? 0 });
  const abilityDescriptions = [
    { id: 101, label: "加速", level: 1 }, { id: 202, label: "转弯", level: 2 },
    { id: 303, label: "漂移", level: 3 },
  ];
  const dependencies: GarageFactoryPanelDependencies = {
    defaultConfiguration, signature, draftFrom, attribute, nativeStatePath,
    childRect, abilityDescriptions,
  };
  const Original = new Function("nt", "Zt", "ht", "y", "se", "Y", "ms", "ba", "document",
    `${classSource}; return Pa;`)(
      defaultConfiguration, signature, draftFrom, attribute, nativeStatePath,
      childRect, abilityDescriptions, "立即重置当前车辆的粒子改记录？", documentStub,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const rect: FactoryPickerRect = { x: 10, y: 20, width: 100, height: 35 };
  const rectNames = ["tutorial", "clblSpecName", "clblSpecValue", "subInfoKartClassStr",
    "selectedKart", "subjectName", "tuneState", "enableReset", "enableTune",
    "ContentTab", "tab_kart", "tab_parts", "abilityTitle", "abilityDesc",
    "reset", "tunning", "equip"];
  host.assets = {
    nodes: new Map([
      ["tutorial", { attrs: { autoLoadImage: "tutorial" } }],
      ["selectedKart", { attrs: { text: "#sb(selectedKart)" } }],
      ["subjectName", { attrs: { text: "#sb(subjectName)" } }],
      ["tuneState", { children: [{ attrs: { text: "#sb(tuneState)" } }] }],
      ["tuneStateCaption", { attrs: {} }],
      ["enableReset", { attrs: { scene: "reset-scene" } }],
      ["enableTune", { attrs: { scene: "tune-scene" } }],
      ["tab_kart", { attrs: { autoLoadImage: "kart" } }],
      ["tab_parts", { attrs: { autoLoadImage: "parts" } }],
    ]),
    rects: new Map(rectNames.map(name => [name, rect])),
    strings: new Map([
      ["partsCatNameAccel", "[color:1]加速[/color]"],
      ["partsCatNameCorner", "转弯"], ["partsCatNameDrift", "漂移"],
      ["partsCatNameBoosterTime", "氮气"], ["partsCatNameDriftGauge", "集气"],
      ["itemKart", "道具车"], ["speedkart", "竞速车"],
      ["loGradeLegend", "传说"], ["selectedKart", "选择车辆"],
      ["subjectName", "车辆名称"], ["tuneState", "改装状态"],
      ["mqKarts", "车辆"], ["equipPlotter", "已装备"],
      ["emptyPlotter", "未|装备"], ["reset", "重置"],
    ]),
    urls: new Map([1, 2, 3, 4].flatMap(state =>
      ["tutorial", "kart", "parts"].map(base => [`${base}${state}`, `${base}-${state}.png`] as const))),
    qualityColors: new Map([[2, "gold"]]),
    fontFamily: "Factory Test",
  };
  host.element = documentStub.createElement("root") as unknown as HTMLElement;
  host.catalog = false;
  host.installed = false;
  host.emptyVehicleInfo = false;
  host.pickerVehicleKey = "old-key";
  host.draft = [{ group: 9, level: 9 }];
  host.draftDirty = false;
  host.appliedSignature = "old-signature";
  host.actionFrameRedraws = new Set([() => {}]);
  host.modelReady = true;
  host.onTutorial = () => { events.push("tutorial"); };
  host.onTabChange = () => { events.push("tab-change"); };
  host.onConfirm = (message, action, options) => {
    events.push(["confirm", message, options]);
    confirmations.push(action);
  };
  host.label = (text, bounds, name) => {
    const label = documentStub.createElement("div");
    label.textContent = text;
    events.push(["label", text, bounds, name]);
    return label as unknown as HTMLElement;
  };
  host.place = (element, bounds) => {
    events.push(["place", elements.indexOf(element as unknown as ElementStub), bounds]);
    (host.element as unknown as ElementStub).append(element as unknown as ElementStub);
  };
  host.updateScores = () => { events.push("scores"); };
  host.styleActionFrame = button => {
    events.push(["action-frame", (button as unknown as ElementStub).dataset.factoryAction]);
  };
  host.renderAbilityPicker = (configuration, editable, bounds) => {
    events.push(["picker", structuredClone(configuration), editable, bounds]);
  };
  host.commit = configuration => { events.push(["commit", structuredClone(configuration)]); };
  if (!released) host.update = (configuration, supported = false, busy = false,
    vehicleName, vehicle, vehicleKey = vehicleName) => updateGarageFactoryPanel(
      host, configuration, supported, busy, vehicleName, vehicle, vehicleKey, dependencies);
  const snapshot = () => ({
    events: structuredClone(events),
    catalog: host.catalog, installed: host.installed, emptyVehicleInfo: host.emptyVehicleInfo,
    pickerVehicleKey: host.pickerVehicleKey, draft: structuredClone(host.draft),
    draftDirty: host.draftDirty, signature: host.appliedSignature,
    modelReady: host.modelReady,
    model: host.model ? { path: host.model.source.path,
      panel: host.model.source.panel === host.assets.nodes.get("enableReset") ? "reset" : "tune" } : undefined,
    scoreLabel: host.scoreLabel ? elements.indexOf(host.scoreLabel as unknown as ElementStub) : undefined,
    redrawCount: host.actionFrameRedraws.size,
    elements: elements.map(element => element.snapshot()),
  });
  const button = (action: string) => elements.find(element =>
    element.dataset.factoryAction === action || element.attributes.get("aria-label") === action);
  return { host, documentStub, events, elements, confirmations, snapshot, button };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("Factory active vehicle refresh, tutorial and reset confirmation match Pa.update", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.update({ active: true, abilities: [101, 202, 303] }, true, false,
        "XUN 101", { engineGrade: 9, kartType: 2, vehicleRarityLevel: 2 }, "vehicle-101");
      const initial = f.snapshot();
      f.button("改装车间教程")!.onpointerenter?.();
      f.button("改装车间教程")!.onclick?.();
      f.button("reset")!.onclick?.();
      f.confirmations.at(-1)?.();
      return { initial, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory dirty draft, incomplete ability editor and busy state match Pa.update", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.draftDirty = true;
      f.host.pickerVehicleKey = "vehicle-101";
      f.host.update({ active: false, abilities: [101, 202, 0] }, true, false,
        "Classic 101", { engineGrade: 8, kartType: 1 }, "vehicle-101");
      const editable = f.snapshot();
      f.button("tunning")!.onclick?.();
      const openedEditor = f.snapshot();
      f.host.update({ active: false, abilities: [101, 202, 0] }, true, true,
        "Classic 101", { engineGrade: 8, kartType: 1 }, "vehicle-101");
      return { editable, openedEditor, busy: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory empty page, blocked tab and equip confirmation match Pa.update", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.update(undefined, false, false, "", { engineGrade: 3 }, "none");
      const initial = f.snapshot();
      const partsTab = f.elements.find(element => element.textContent === "自定义粒子效果")!;
      partsTab.onclick?.();
      f.button("equip")!.onclick?.();
      f.confirmations.at(-1)?.();
      return { initial, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Pa delegates its complete page refresh", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "Pa");
  if (!view || view.type !== "ClassDeclaration") throw new Error("Generated Pa missing");
  const update = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "update");
  assert.ok(update);
  assert.match(generated.slice(update.start!, update.end!), /updateGarageFactoryPanel\(/);
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageFactoryPanelOverrides, ["update"]);
});
