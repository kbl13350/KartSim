import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  requestGarageExceedTypeChange, requestGarageSkillSelection,
  type GarageUpgradeDialogDependencies, type GarageUpgradeDialogHost,
  type GarageUpgradeProgression,
} from "./garage-upgrade-dialog-actions";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

type TestHost = GarageUpgradeDialogHost & {
  requestSkillSelection(slot: number): void;
  requestExceedTypeChange(): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  let skillDone: ((progression?: GarageUpgradeProgression) => void) | undefined;
  let exceedDone: ((type?: number) => void) | undefined;
  let serial = 7;
  let customizable = true;
  let family = "xun";
  let available = "enabled";
  let failOpenSkill = false;
  let failValidation = false;

  class SkillDialog {
    constructor(_surface: unknown, library: unknown, progression: GarageUpgradeProgression,
      slot: number, done: (progression?: GarageUpgradeProgression) => void) {
      events.push(["skill-dialog", library, structuredClone(progression), slot]);
      if (failOpenSkill) throw new Error("skill dialog failed");
      skillDone = done;
    }
  }
  class ExceedDialog {
    constructor(_surface: unknown, _tuning: unknown, library: unknown,
      initial: { title: string; type: number | undefined }, done: (type?: number) => void) {
      events.push(["exceed-dialog", library, structuredClone(initial)]);
      exceedDone = done;
    }
  }
  const dependencies: GarageUpgradeDialogDependencies = {
    currentConfiguration: (configuration, itemId, recordSerial) => {
      events.push(["read", itemId, recordSerial]);
      return (configuration as { current: Record<string, unknown> }).current;
    },
    initialProgression: xun => {
      events.push(["initial", xun]);
      return { kind: xun ? "xun" : "classic", level: 0 };
    },
    gradeFamily: grade => { events.push(["family", grade]); return family; },
    exceedChangeAvailability: (vehicle, tuning) => {
      events.push(["availability", structuredClone(vehicle), structuredClone(tuning)]);
      return available;
    },
    validateConfiguration: (_base, grade, equipment, speed) => {
      events.push(["validate", grade, structuredClone(equipment), speed]);
      if (failValidation) throw new Error("invalid exceed type");
    },
    writeConfiguration: (_configuration, itemId, recordSerial, equipment) => {
      events.push(["write", itemId, recordSerial, structuredClone(equipment)]);
      return { current: structuredClone(equipment) };
    },
    openSkillSelection: (...args) => new SkillDialog(...args),
    openExceedTypeChange: (...args) => new ExceedDialog(...args),
  };
  const Original = new Function("K", "ce", "Ue", "$s", "te", "ie", "Da", "Tn",
    `${classSource}; return As;`)(
      dependencies.currentConfiguration, dependencies.initialProgression,
      dependencies.gradeFamily, dependencies.exceedChangeAvailability,
      dependencies.validateConfiguration, dependencies.writeConfiguration,
      SkillDialog, ExceedDialog,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.selected = { itemId: 101, title: "Kart 101", engineGrade: 9, kartType: 2 };
  host.configuration = { current: { progression: { kind: "xun", level: 3 }, exceedType: 2 } };
  host.surface = "surface";
  host.options = { library: "archive", speed: "fast" };
  host.tuning = { exceedTypeChange: { cost: 4 } };
  host.pageMode = "level";
  host.disposed = false;
  host.skillSelection = undefined;
  host.exceedTypeChange = undefined;
  host.upgrade = undefined;
  host.preparation = undefined;
  host.confirmation = { pending: false };
  host.controls = { inert: false };
  host.progressionPanel = { element: {
    inert: false,
    querySelector: selector => { events.push(["query", selector]); return {
      focus: () => { events.push("focus"); },
    }; },
  } };
  host.factoryPanel = { element: { inert: false } };
  host.pointEffects = { clear: () => { events.push("clear-effects"); } };
  host.status = { textContent: "initial" };
  host.requireCustomization = () => {
    events.push(["customizable", customizable]);
    return customizable;
  };
  host.serial = () => { events.push("serial"); return serial; };
  host.base = () => { events.push("base"); return { defaultExceedType: 4 }; };
  host.setProgression = progression => {
    events.push(["set-progression", structuredClone(progression)]);
    return true;
  };
  host.publishCurrentState = () => { events.push(["publish", structuredClone(host.configuration)]); };
  host.updateControls = () => { events.push("controls"); };
  if (!released) {
    host.requestSkillSelection = slot => requestGarageSkillSelection(host, slot, dependencies);
    host.requestExceedTypeChange = () => requestGarageExceedTypeChange(host, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events), configuration: structuredClone(host.configuration),
    skillOpen: !!host.skillSelection, exceedOpen: !!host.exceedTypeChange,
    inert: [host.controls.inert, host.progressionPanel.element.inert,
      host.factoryPanel?.element.inert], status: host.status.textContent,
  });
  return { host, events, snapshot,
    skillDone: (progression?: GarageUpgradeProgression) => skillDone?.(progression),
    exceedDone: (type?: number) => exceedDone?.(type),
    setSerial: (value: number) => { serial = value; },
    setCustomizable: (value: boolean) => { customizable = value; },
    setFamily: (value: string) => { family = value; },
    setAvailable: (value: string) => { available = value; },
    setFailOpenSkill: (value: boolean) => { failOpenSkill = value; },
    setFailValidation: (value: boolean) => { failValidation = value; },
  };
}

test("skill selection opens, applies and restores focus like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.requestSkillSelection(1);
    states.push(f.snapshot());
    f.skillDone({ kind: "xun", level: 4 });
    states.push(f.snapshot());
    f.host.requestSkillSelection(0);
    f.host.selected = { ...f.host.selected };
    f.skillDone({ kind: "xun", level: 5 });
    states.push(f.snapshot());
    f.host.requestSkillSelection(2);
    f.host.disposed = true;
    f.skillDone({ kind: "xun", level: 6 });
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("skill picker guards and constructor failure match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.setCustomizable(false);
    f.host.requestSkillSelection(0);
    states.push(f.snapshot());
    f.setCustomizable(true);
    f.host.confirmation!.pending = true;
    f.host.requestSkillSelection(0);
    states.push(f.snapshot());
    f.host.confirmation!.pending = false;
    f.setFamily("classic");
    f.host.requestSkillSelection(0);
    states.push(f.snapshot());
    f.setFamily("xun");
    f.setFailOpenSkill(true);
    f.host.requestSkillSelection(0);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("exceed type change validates, publishes and reports failure like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.requestExceedTypeChange();
    states.push(f.snapshot());
    f.exceedDone(3);
    states.push(f.snapshot());
    f.host.requestExceedTypeChange();
    f.setFailValidation(true);
    f.exceedDone(5);
    states.push(f.snapshot());
    f.setFailValidation(false);
    f.host.requestExceedTypeChange();
    f.exceedDone(undefined);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("exceed type guards, serial changes and disposal match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.setAvailable("blocked");
    f.host.requestExceedTypeChange();
    states.push(f.snapshot());
    f.setAvailable("enabled");
    f.host.requestExceedTypeChange();
    f.setSerial(8);
    f.exceedDone(4);
    states.push(f.snapshot());
    f.host.requestExceedTypeChange();
    f.host.selected = { ...f.host.selected };
    f.exceedDone(2);
    states.push(f.snapshot());
    f.host.requestExceedTypeChange();
    f.host.disposed = true;
    f.exceedDone(2);
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates upgrade dialog actions", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-upgrade-dialog-actions\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const methods = new Map(view.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  assert.match(methods.get("requestSkillSelection") ?? "",
    /requestGarageSkillSelection\(this, slot, garageUpgradeDialogDependencies\)/);
  assert.match(methods.get("requestExceedTypeChange") ?? "",
    /requestGarageExceedTypeChange\(this, garageUpgradeDialogDependencies\)/);
});
