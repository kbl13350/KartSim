import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  updateGarageVehicleFunctions, updateGarageVehicleHeading,
  updateGarageVehicleInformation, type GarageInfoLayout,
  type GarageInfoPart, type GarageVehicleInformationDependencies,
  type GarageVehicleInformationHost,
} from "./garage-vehicle-information";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  title = "";
  textContent = "";
  className = "";
  disabled = false;
  tabIndex = -1;
  src = "";
  alt = "";
  style = { color: "" };
  attributes = new Map<string, string>();
  classes = new Set<string>();
  children: ElementStub[] = [];
  classList = { toggle: (name: string, active: boolean) => {
    if (active) this.classes.add(name);
    else this.classes.delete(name);
  } };
  constructor(readonly tag: string) {}
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  replaceChildren(): void { this.children = []; }
  append(...children: ElementStub[]): void { this.children.push(...children); }
  snapshot(): unknown {
    return {
      tag: this.tag, title: this.title, text: this.textContent, className: this.className,
      disabled: this.disabled, tabIndex: this.tabIndex, src: this.src, alt: this.alt,
      style: this.style, attributes: [...this.attributes], classes: [...this.classes],
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageVehicleInformationHost & {
  updateVehicleInformation(vehicle: unknown, equipment: unknown, layout: GarageInfoLayout,
    refreshPerformance?: boolean): void;
  updateVehicleHeading(level?: number): void;
};

const xunLayout: GarageInfoLayout = {
  kind: "xun", slotSize: 50, equippedRoot: "equipedParts_12",
};
const classicLayout: GarageInfoLayout = {
  kind: "classic", slotSize: 60, equippedRoot: "equipedParts_v1",
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  let noPart = false;
  let missingLevel = false;
  let missingIcon = false;
  const part: GarageInfoPart = { family: "xun", id: "part-xun" };
  const dependencies: GarageVehicleInformationDependencies = {
    vehicleFamily: (_vehicle, grade) => { events.push(["family", grade]); return grade === 9 ? "xun" : "classic"; },
    resolvePart: (_vehicle, _equipment, slot, _parts, grade, uniqueLevel) => {
      events.push(["resolve", slot, grade, uniqueLevel]);
      return noPart || slot !== "engine" ? undefined : part;
    },
    slotLocked: (_vehicle, slot) => { events.push(["locked", slot]); return slot === "handle"; },
    xunPartLevel: () => { events.push("xun-level"); return missingLevel ? undefined : 5; },
    partPresentation: (label, locked, emptyLabel) => {
      events.push(["present", label, locked, emptyLabel]);
      return { value: label ?? emptyLabel ?? "原装", state: locked ? "锁定" : undefined };
    },
    slotLabel: (slot, family) => { events.push(["slot-label", slot, family]); return slot === "engine" ? "引擎" : "方向盘"; },
    uniqueLevel: () => { events.push("unique-level"); return 5; },
    isMaxLevel: () => { events.push("max-level"); return true; },
    sceneAttribute: (_node, name) => { events.push(["scene", name]); return "spark"; },
    slotNodeNames: { engine: "tuneEnginePatch", handle: "tuneHandle" },
    vehicleFunctions: () => {
      events.push("functions");
      return [{ icon: "normal", focusedIcon: "focused", nameKey: "skill.name",
        descriptionKey: "skill.description" }];
    },
  };
  const fakeDocument = { createElement: (tag: string) => new ElementStub(tag) };
  const Original = new Function("me", "Xe", "fe", "Ns", "Wi", "le", "Et", "En", "y", "wt", "Fi", "document",
    `${classSource}; return As;`)(
      dependencies.vehicleFamily, dependencies.resolvePart,
      dependencies.slotLocked, dependencies.xunPartLevel,
      dependencies.partPresentation, dependencies.slotLabel,
      dependencies.uniqueLevel, dependencies.isMaxLevel,
      dependencies.sceneAttribute, dependencies.slotNodeNames,
      dependencies.vehicleFunctions, fakeDocument,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { title: "Kart 101", engineGrade: 9, uniqueLevel: 3, vehicleRarityLevel: 2 };
  host.pageMode = "parts";
  host.coatingMode = false;
  host.cosmeticSlot = undefined;
  host.slot = "engine";
  const controls = new Map<string, ElementStub>([
    ["engine", new ElementStub("button")],
    ["handle", new ElementStub("button")],
  ]);
  host.slotControls = controls as unknown as Map<string, HTMLButtonElement>;
  host.assets = {
    parts: {}, nodes: new Map([["/equipedParts_12/tuneEnginePatch/item/partsLvMaxEffect1s", {}]]),
    strings: new Map([["skill.name", "极速"], ["skill.description", "加速效果"]]),
  };
  host.tuning = { qualityColors: new Map([[2, "gold"]]), urls: new Map([["tuning_mark_3", "badge-3"]]) };
  host.defaultPartGrades = { engine: 3 };
  const kartName = new ElementStub("kart-name");
  const vehicleFunctions = new ElementStub("functions");
  host.kartName = kartName as unknown as HTMLElement;
  host.vehicleFunctions = vehicleFunctions as unknown as HTMLElement;
  host.updatePerformance = () => { events.push("performance"); };
  host.partLabel = item => { events.push(["part-label", item.id]); return "迅引擎"; };
  host.partVisual = (button, item, className) => {
    events.push(["part-visual", item.id, className]);
    (button as unknown as ElementStub).append(new ElementStub("part"));
  };
  host.icon = (name, className) => {
    events.push(["icon", name, className]);
    if (missingIcon) return undefined;
    const icon = new ElementStub("icon");
    icon.title = name;
    icon.className = className;
    return icon as unknown as HTMLElement;
  };
  host.addModelTarget = (_button, model, className) => {
    events.push(["model", model.path, className]);
  };
  host.rect = path => { events.push(["rect", path]); return path; };
  host.place = (_button, rect) => { events.push(["place", rect]); };
  if (!released) {
    host.updateVehicleInformation = (vehicle, equipment, layout, refreshPerformance = true) =>
      updateGarageVehicleInformation(host, vehicle, equipment, layout, refreshPerformance, dependencies);
    host.updateVehicleHeading = level => updateGarageVehicleHeading(host, level);
    host.updateVehicleFunctions = (vehicle, layout) =>
      updateGarageVehicleFunctions(host, vehicle, layout, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events), controls: [...controls].map(([slot, button]) => [slot, button.snapshot()]),
    kartName: kartName.snapshot(), functions: vehicleFunctions.snapshot(),
  });
  return { host, fakeDocument, snapshot,
    setNoPart: (value: boolean) => { noPart = value; },
    setMissingLevel: (value: boolean) => { missingLevel = value; },
    setMissingIcon: (value: boolean) => { missingIcon = value; },
  };
}

function withDocument<T>(fakeDocument: unknown, callback: () => T): T {
  const previous = globalThis.document;
  globalThis.document = fakeDocument as Document;
  try { return callback(); }
  finally { globalThis.document = previous; }
}

test("XUN equipped slots, skill functions and tuned heading match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      f.host.updateVehicleInformation({}, {}, xunLayout);
      f.host.updateVehicleHeading(3);
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("classic empty slots, locked controls and plain heading match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      f.host.selected.engineGrade = 3;
      f.host.selected.vehicleRarityLevel = undefined;
      f.host.pageMode = "level";
      f.setNoPart(true);
      f.host.updateVehicleInformation({}, {}, classicLayout, false);
      f.host.updateVehicleHeading();
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN level fallback and missing icons match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.fakeDocument, () => {
      f.setMissingLevel(true);
      f.setMissingIcon(true);
      f.host.updateVehicleInformation({}, {}, xunLayout, false);
      f.host.tuning.urls.clear();
      f.host.updateVehicleHeading(5);
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates vehicle information rendering", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-vehicle-information\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["updateVehicleInformation", "updateGarageVehicleInformation"],
    ["updateVehicleHeading", "updateGarageVehicleHeading"],
    ["updateVehicleFunctions", "updateGarageVehicleFunctions"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this`));
});
