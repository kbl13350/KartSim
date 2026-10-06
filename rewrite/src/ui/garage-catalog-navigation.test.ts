import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  canSetGarageProgression, filteredGarageKarts, garageFactoryAllowed,
  selectGarageKart, selectGaragePage,
  type GarageCatalogNavigationDependencies, type GarageCatalogNavigationHost,
  type GarageCatalogVehicle, type GaragePage,
} from "./garage-catalog-navigation";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

const karts: GarageCatalogVehicle[] = [
  { itemId: 0, title: "练习车", kartType: 2 },
  { itemId: 101, title: "迅雷 X", internalId: "fast-x", engineGrade: 7, kartType: 2 },
  { itemId: 102, title: "迅影", internalId: "xun", engineGrade: 9, kartType: 1 },
  { itemId: 103, title: "工坊损坏", internalId: "broken", engineGrade: 8, kartType: 2 },
  { itemId: 104, title: "无代际", kartType: 2 },
  { itemId: 105, title: "旧系统", engineGrade: 7, identityClass: "legacy-system-family" },
  { itemId: 999, title: "禁用车辆", engineGrade: 9 },
];

type TestHost = GarageCatalogNavigationHost & {
  selectPage(page: GaragePage): void;
  filteredKarts(): GarageCatalogVehicle[];
  nativeFactoryAllowed(vehicle?: GarageCatalogVehicle): boolean;
  canSetProgression(progression: { kind: string }): boolean;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const dependencies: GarageCatalogNavigationDependencies = {
    canCustomize: id => id > 0 && id !== 999,
    progressionLayout: grade => grade === 9 ? "xun" : grade === 7 || grade === 8 ? "classic" : undefined,
    blockedKart: id => id === 999,
    validateKart: id => { events.push(["validate", id]); if (id === 999) throw new Error("blocked kart"); },
    factoryAllowed: (grade, title) => grade === 9 && title !== "工坊损坏",
    progressionKind: grade => grade === 9 ? "xun" : grade === 7 || grade === 8 ? "classic" : undefined,
    progressionMismatchMessage: "升级类型与车辆不匹配。",
  };
  const Original = new Function("ae", "pe", "Re", "Ft", "ui", "Ue", "oi",
    `${classSource}; return As;`)(
      dependencies.canCustomize, dependencies.progressionLayout,
      dependencies.blockedKart, dependencies.validateKart,
      dependencies.factoryAllowed, dependencies.progressionKind,
      dependencies.progressionMismatchMessage,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.pageMode = "parts";
  host.page = 3;
  host.selected = karts[0]!;
  host.options = { catalog: { karts } };
  host.transformPreviewStartPending = true;
  host.cosmeticPreview = "cosmetic";
  host.previewPart = "part";
  host.coatingPreview = "coating";
  host.upgradeCatalogEmpty = false;
  host.factoryScoreRevision = 1;
  host.inventory = { scrollTop: 30 };
  host.info = { replaceChildren: () => { events.push("clear-info"); } };
  host.vehicleFunctions = { replaceChildren: () => { events.push("clear-functions"); } };
  host.comparisons = [{ old: true }];
  host.slotControls = new Map([
    ["engine", { replaceChildren: () => { events.push("clear-engine"); } }],
    ["wheel", { replaceChildren: () => { events.push("clear-wheel"); } }],
  ]);
  host.search = { value: "  迅  " };
  host.filter = 0;
  host.status = { textContent: "" };
  host.panels = {
    setParticleModificationPageVisible: value => { events.push(["factory-visible", value]); },
    resetPreviewForPageTransition: () => { events.push("reset-page-preview"); },
    setTransformPreview: value => { events.push(["transform", value]); },
    resetPreviewRotation: value => { events.push(["rotation", value]); },
  };
  host.syncTransformPreviewUi = () => { events.push("sync-transform"); };
  host.canonicalFactoryVehicle = vehicle => {
    events.push(["canonical", vehicle.itemId]);
    return vehicle.itemId === 101 ? karts[2]! : vehicle;
  };
  host.updateControls = () => { events.push("update-controls"); };
  host.publishCurrentState = () => { events.push("publish"); };
  host.requireCustomization = () => {
    const allowed = dependencies.canCustomize(host.selected.itemId);
    events.push(["can-customize", allowed]);
    return allowed;
  };
  if (!released) {
    host.selectPage = page => selectGaragePage(host, page, dependencies);
    host.selectKart = vehicle => selectGarageKart(host, vehicle, dependencies.validateKart);
    host.filteredKarts = () => filteredGarageKarts(host, dependencies);
    host.nativeFactoryAllowed = (vehicle = host.selected) => garageFactoryAllowed(host, vehicle, dependencies);
    host.canSetProgression = progression => canSetGarageProgression(host, progression, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events), pageMode: host.pageMode, page: host.page,
    selected: host.selected.itemId, pending: host.transformPreviewStartPending,
    cosmeticPreview: host.cosmeticPreview, previewPart: host.previewPart,
    coatingPreview: host.coatingPreview, upgradeCatalogEmpty: host.upgradeCatalogEmpty,
    factoryScoreRevision: host.factoryScoreRevision,
    scrollTop: host.inventory.scrollTop, comparisons: structuredClone(host.comparisons),
    status: host.status.textContent,
  });
  return { host, snapshot, events };
}

test("page navigation, first upgradable kart, factory canonicalization, and empty catalog match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.selectPage("level");
    states.push(f.snapshot());
    f.host.selectPage("factory");
    states.push(f.snapshot());
    f.host.selectPage("parts");
    states.push(f.snapshot());
    f.host.selectPage("parts");
    states.push(f.snapshot());
    f.host.options.catalog.karts = [karts[0]!];
    f.host.selected = karts[0]!;
    f.host.selectPage("level");
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("vehicle selection clears temporary garage state after validation", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.selectKart(karts[2]!);
    states.push(f.snapshot());
    assert.throws(() => f.host.selectKart(karts[6]!), /blocked kart/);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("catalog search, type, upgrade, factory and progression guards match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    states.push(f.host.filteredKarts().map(vehicle => vehicle.itemId));
    f.host.search.value = "";
    f.host.filter = 2;
    states.push(f.host.filteredKarts().map(vehicle => vehicle.itemId));
    f.host.pageMode = "level";
    states.push(f.host.filteredKarts().map(vehicle => vehicle.itemId));
    f.host.pageMode = "factory";
    states.push(f.host.filteredKarts().map(vehicle => vehicle.itemId));
    states.push([f.host.nativeFactoryAllowed(karts[2]), f.host.nativeFactoryAllowed(karts[1])]);
    f.host.selected = karts[2]!;
    states.push(f.host.canSetProgression({ kind: "xun" }));
    states.push(f.host.canSetProgression({ kind: "classic" }));
    f.host.selected = karts[0]!;
    states.push(f.host.canSetProgression({ kind: "classic" }));
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates catalog navigation methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-catalog-navigation\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["selectPage", "selectGaragePage"], ["selectKart", "selectGarageKart"],
    ["filteredKarts", "filteredGarageKarts"], ["nativeFactoryAllowed", "garageFactoryAllowed"],
    ["canSetProgression", "canSetGarageProgression"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this,`));
});
