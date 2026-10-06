import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  publishGarageCurrentState, refreshGarageUpgradeState, requestGarageRestoreDefaults,
  setGarageProgression, type GarageProgression, type GarageStateCommitDependencies,
  type GarageStateCommitHost,
} from "./garage-state-commit";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const releaseClass = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(releaseClass);
const releaseClassSource = release.slice(releaseClass.start!, releaseClass.end!);

type TestHost = GarageStateCommitHost & {
  requestRestoreDefaults(): void;
  setProgression(progression: GarageProgression, refreshControls?: boolean): boolean;
  refreshUpgradeState(): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  let confirm: (() => void) | undefined;
  let serial = 7;
  let customizable = true;
  let allowProgression = true;
  let rejectValidation = false;
  let rejectPanel = false;
  const dependencies: GarageStateCommitDependencies = {
    currentConfiguration: (configuration, itemId, recordSerial) => {
      events.push(["read", itemId, recordSerial]);
      return (configuration as { current: Record<string, unknown> }).current;
    },
    writeConfiguration: (_configuration, itemId, recordSerial, equipment) => {
      events.push(["write", itemId, recordSerial, structuredClone(equipment)]);
      return { current: structuredClone(equipment) };
    },
    validateConfiguration: (_base, grade, equipment, speed) => {
      events.push(["validate", grade, structuredClone(equipment), speed]);
      if (rejectValidation) throw new Error("invalid tuning");
    },
    composeEquipment: (_profile, kart, character, systemKey, variant) => {
      events.push(["compose", kart, character, systemKey, variant]);
      return { kart, character, systemKey, variant };
    },
    normalizeEquipment: equipment => {
      events.push(["normalize", structuredClone(equipment)]);
      return { normalized: true, ...equipment };
    },
    progressionLayout: grade => {
      events.push(["layout", grade]);
      return grade === 9 ? { kind: "xun" } : grade === 3 ? { kind: "classic" } : undefined;
    },
    progressionKind: grade => {
      events.push(["family", grade]);
      return grade === 9 ? "xun" : grade === 3 ? "classic" : undefined;
    },
    supportsProgression: grade => {
      events.push(["supported", grade]);
      return grade === 9 || grade === 3;
    },
    expectedProgressionKind: family => {
      events.push(["expected-kind", family]);
      return family;
    },
    initialProgression: xun => {
      events.push(["initial", xun]);
      return { kind: xun ? "xun" : "classic", level: 0 };
    },
  };
  const Original = new Function("ie", "K", "te", "ot", "pi", "ue", "pe", "Ue", "Ut", "ce",
    `${releaseClassSource}; return As;`)(
      dependencies.writeConfiguration, dependencies.currentConfiguration,
      dependencies.validateConfiguration, dependencies.composeEquipment,
      dependencies.normalizeEquipment, dependencies.progressionLayout,
      dependencies.progressionKind, dependencies.supportsProgression,
      dependencies.expectedProgressionKind, dependencies.initialProgression,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 101, engineGrade: 9, path: "kart/101", kartType: 2, systemKey: "system" };
  host.configuration = { current: { progression: { kind: "xun", level: 2 }, exceedType: 4,
    factory: { active: true }, tailLamp: 1 } };
  host.options = {
    speed: "fast", library: "archive",
    catalog: { characters: [{ itemId: 301, name: "Driver" }] },
    selectedCharacterItemId: 301,
    profile: { equipment: { systemKartVariant: 5 } },
    onChange: state => events.push(["onChange", structuredClone(state)]),
  };
  host.pageMode = "level";
  host.disposed = false;
  host.upgradeCatalogEmpty = false;
  const firstToken = {};
  host.cosmeticResetToken = firstToken;
  host.previewPart = "part preview";
  host.cosmeticPreview = "cosmetic preview";
  host.coatingPreview = "coating preview";
  host.status = { textContent: "initial" };
  host.confirmation = { open: (message, callback) => {
    events.push(["confirm", message]);
    confirm = callback;
  } };
  host.progressionPanel = {
    update: (progression, supported, grade, factory, exceed, vehicle, empty) => {
      events.push(["panel", structuredClone(progression), supported, grade,
        structuredClone(factory), exceed, structuredClone(vehicle), empty]);
      if (rejectPanel) throw new Error("panel failed");
    },
    updateRadar: (library, path, base, progression, factory) => {
      events.push(["radar", library, path, structuredClone(base),
        structuredClone(progression), structuredClone(factory)]);
    },
  };
  host.pointEffects = { transition: (before, after) =>
    events.push(["transition", structuredClone(before), structuredClone(after)]) };
  host.serial = () => { events.push(["serial"]); return serial; };
  host.base = () => { events.push(["base"]); return { defaultExceedType: 6 }; };
  host.requireCustomization = () => {
    events.push(["customizable", customizable]);
    return customizable;
  };
  host.canSetProgression = () => {
    events.push(["can-set", allowProgression]);
    return allowProgression;
  };
  host.updateControls = () => { events.push(["controls"]); };
  host.updateVehicleInformation = (_base, equipment, layout) =>
    { events.push(["vehicle-info", structuredClone(equipment), layout.kind]); };
  host.updateCosmeticEquippedSlots = (_equipment, layout, preview) =>
    { events.push(["cosmetic-slots", layout.kind, preview]); };
  host.updateVehicleHeading = level => { events.push(["heading", level]); };
  if (!released) {
    host.requestRestoreDefaults = () => requestGarageRestoreDefaults(host, dependencies);
    host.publishCurrentState = () => publishGarageCurrentState(host, dependencies);
    host.setProgression = (progression, refreshControls = true) =>
      setGarageProgression(host, progression, refreshControls, dependencies);
    host.refreshUpgradeState = () => refreshGarageUpgradeState(host, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events), configuration: structuredClone(host.configuration),
    status: host.status.textContent, tokenChanged: host.cosmeticResetToken !== firstToken,
    previews: [host.previewPart, host.cosmeticPreview, host.coatingPreview],
  });
  return { host, events, snapshot, trigger: () => confirm?.(),
    setSerial: (value: number) => { serial = value; },
    setCustomizable: (value: boolean) => { customizable = value; },
    setAllowProgression: (value: boolean) => { allowProgression = value; },
    setRejectValidation: (value: boolean) => { rejectValidation = value; },
    setRejectPanel: (value: boolean) => { rejectPanel = value; } };
}

test("restoring defaults commits only the confirmed kart and serial like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.requestRestoreDefaults();
    states.push(f.snapshot());
    f.trigger();
    states.push(f.snapshot());
    f.host.requestRestoreDefaults();
    f.setSerial(8);
    f.trigger();
    states.push(f.snapshot());
    f.setSerial(7);
    f.host.requestRestoreDefaults();
    f.host.selected = { ...f.host.selected };
    f.trigger();
    states.push(f.snapshot());
    f.setCustomizable(false);
    f.host.requestRestoreDefaults();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("current garage publication handles XUN, classic and missing character like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.publishCurrentState();
    states.push(f.snapshot());
    f.host.selected.engineGrade = 3;
    f.host.publishCurrentState();
    states.push(f.snapshot());
    f.host.options.onChange = undefined;
    f.host.options.selectedCharacterItemId = 999;
    f.host.publishCurrentState();
    states.push(f.snapshot());
    f.host.options.onChange = state => f.events.push(["onChange", structuredClone(state)]);
    assert.throws(() => f.host.publishCurrentState(), /当前人物不在资源目录内/);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("progression validation, optional refresh and failure state match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    states.push([f.host.setProgression({ kind: "xun", level: 3 }), f.snapshot()]);
    states.push([f.host.setProgression({ kind: "xun", level: 4 }, false), f.snapshot()]);
    f.setAllowProgression(false);
    states.push([f.host.setProgression({ kind: "xun", level: 5 }), f.snapshot()]);
    f.setAllowProgression(true);
    f.setRejectValidation(true);
    states.push([f.host.setProgression({ kind: "xun", level: 5 }), f.snapshot()]);
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("upgrade panel refresh follows page, XUN, classic and error branches like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.refreshUpgradeState();
    states.push(f.snapshot());
    f.host.selected.engineGrade = 3;
    (f.host.configuration as { current: Record<string, unknown> }).current.progression =
      { kind: "xun", level: 8 };
    f.host.refreshUpgradeState();
    states.push(f.snapshot());
    f.host.pageMode = "parts";
    f.host.refreshUpgradeState();
    states.push(f.snapshot());
    f.host.pageMode = "level";
    f.setRejectPanel(true);
    f.host.refreshUpgradeState();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates garage state commits and refresh", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-state-commit\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, delegate] of [
    ["requestRestoreDefaults", "requestGarageRestoreDefaults"],
    ["publishCurrentState", "publishGarageCurrentState"],
    ["setProgression", "setGarageProgression"],
    ["refreshUpgradeState", "refreshGarageUpgradeState"],
  ] as const) assert.match(methods.get(name) ?? "", new RegExp(`${delegate}\\(this,`));
});
