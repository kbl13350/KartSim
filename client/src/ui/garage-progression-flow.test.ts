import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  requestGarageProgression, type GarageFlowCandidate, type GarageFlowPreparationResult,
  type GarageFlowProgression, type GarageProgressionFlowDependencies,
  type GarageProgressionFlowHost,
} from "./garage-progression-flow";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

type TestHost = GarageProgressionFlowHost;

function fixture(released: boolean) {
  const events: unknown[] = [];
  let preparationDone: ((result?: GarageFlowPreparationResult) => void) | undefined;
  let resultDone: (() => void) | undefined;
  let blockCandidate = false;
  let corruptCandidate = false;
  let openPreparationFails = false;
  let openResultFails = false;
  let transitionFails = false;
  let progressionAllowed = true;
  let commitAllowed = true;
  class PreparationDialog {
    constructor(_surface: unknown, library: unknown, candidates: GarageFlowCandidate[],
      selectedItemId: number, done: (result?: GarageFlowPreparationResult) => void) {
      events.push(["preparation-dialog", library,
        candidates.map(candidate => [candidate.item.itemId, structuredClone(candidate.value)]),
        selectedItemId]);
      if (openPreparationFails) throw new Error("preparation failed");
      preparationDone = done;
    }
  }
  class ResultDialog {
    constructor(_surface: unknown, library: unknown, environment: unknown,
      stageBinding: unknown, vehicleTitle: string, done: () => void,
      kind: string, transition: unknown, immediate: boolean, badgeUrl: string | undefined) {
      events.push(["result-dialog", library, environment, stageBinding, vehicleTitle,
        kind, structuredClone(transition), immediate, badgeUrl]);
      if (openResultFails) throw new Error("result failed");
      resultDone = done;
    }
  }
  const dependencies: GarageProgressionFlowDependencies = {
    currentConfiguration: (configuration, itemId, serial) => {
      events.push(["read", itemId, serial]);
      const progression = (configuration as { records: Record<string, GarageFlowProgression> })
        .records[`${itemId}:${serial}`];
      return progression ? { progression } : {};
    },
    initialProgression: xun => {
      events.push(["initial", xun]);
      return { kind: xun ? "xun" : "classic", level: 0 };
    },
    blockedKart: itemId => { events.push(["blocked", itemId]); return blockCandidate && itemId === 102; },
    transition: (before, after, grade, method) => {
      events.push(["transition", structuredClone(before), structuredClone(after), grade, method]);
      if (transitionFails) throw new Error("transition failed");
      return { beforeLevel: before.level, afterLevel: after.level, method };
    },
    openPreparation: (...args) => new PreparationDialog(...args),
    openResult: (...args) => new ResultDialog(...args),
  };
  const Original = new Function("K", "ce", "Re", "ri", "Ja", "Ra",
    `${classSource}; return As;`)(
      dependencies.currentConfiguration, dependencies.initialProgression,
      dependencies.blockedKart, dependencies.transition,
      PreparationDialog, ResultDialog,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const karts = [
    { itemId: 101, engineGrade: 9, title: "XUN 101" },
    { itemId: 102, engineGrade: 9, title: "XUN 102" },
    { itemId: 103, engineGrade: 3, title: "Classic" },
  ];
  host.selected = karts[0]!;
  host.configuration = { records: {
    "101:7": { kind: "xun", level: 2 },
    "102:0": { kind: "xun", level: 1 },
    "103:0": { kind: "classic", level: 1 },
  } };
  host.disposed = false;
  host.surface = "surface";
  host.options = {
    library: "archive", environment: "environment", stageBinding: "stage",
    catalog: { karts },
    profile: { equipment: { itemIds: [0, 0, 0, 101], kartSerial: 7 } },
  };
  host.tuning = { urls: new Map([["tuning_mark_3", "badge-3"]]) };
  host.skillSelection = undefined;
  host.exceedTypeChange = undefined;
  host.upgrade = undefined;
  host.preparation = undefined;
  host.confirmation = { pending: false };
  host.pointEffects = { clear: () => { events.push("clear-effects"); } };
  host.controls = { inert: false };
  host.progressionPanel = { element: { inert: false } };
  host.factoryPanel = { element: { inert: false } };
  host.panels = {
    setTransformPreview: enabled => { events.push(["transform", enabled]); },
    resetPreviewRotation: enabled => { events.push(["rotation", enabled]); },
  };
  host.status = { textContent: "initial" };
  host.serial = () => { events.push("serial"); return 7; };
  host.canSetProgression = progression => {
    events.push(["can-set", progression.level, progressionAllowed]);
    return progressionAllowed;
  };
  host.setProgression = (progression, refreshControls = true) => {
    events.push(["set", structuredClone(progression), refreshControls]);
    return commitAllowed;
  };
  host.publishCurrentState = () => { events.push(["publish", host.selected.itemId]); };
  host.updateControls = () => { events.push("controls"); };
  host.hideUpgradeResultBackground = () => { events.push("hide-background"); };
  host.restoreUpgradeResultBackground = () => { events.push("restore-background"); };
  host.refreshUpgradeState = () => { events.push("refresh-upgrade"); };
  if (!released) host.requestProgression = (progression, prepared = false, method = "step") =>
    requestGarageProgression(host, progression, prepared, method, dependencies);
  const snapshot = () => ({
    events: structuredClone(events), selected: host.selected.itemId, status: host.status.textContent,
    preparationOpen: !!host.preparation, resultOpen: !!host.upgrade,
    inert: [host.controls.inert, host.progressionPanel.element.inert,
      host.factoryPanel?.element.inert],
  });
  return { host, events, karts, snapshot,
    preparationDone: (result?: GarageFlowPreparationResult) => preparationDone?.(result),
    resultDone: () => resultDone?.(),
    setBlockCandidate: (value: boolean) => { blockCandidate = value; },
    setCorruptCandidate: (value: boolean) => {
      corruptCandidate = value;
      (host.configuration as { records: Record<string, GarageFlowProgression> })
        .records["102:0"] = { kind: corruptCandidate ? "classic" : "xun", level: 1 };
    },
    setOpenPreparationFails: (value: boolean) => { openPreparationFails = value; },
    setOpenResultFails: (value: boolean) => { openResultFails = value; },
    setTransitionFails: (value: boolean) => { transitionFails = value; },
    setProgressionAllowed: (value: boolean) => { progressionAllowed = value; },
    setCommitAllowed: (value: boolean) => { commitAllowed = value; },
  };
}

test("XUN preparation, candidate selection, result and cleanup match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.requestProgression({ kind: "xun", level: 3 });
    states.push(f.snapshot());
    f.preparationDone({
      candidate: { item: f.karts[1]!, value: { kind: "xun", level: 1 } },
      target: { kind: "xun", level: 3 }, method: "transfer",
    });
    states.push(f.snapshot());
    f.resultDone();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("classic direct upgrade, same-level commit and gating match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.host.selected = f.karts[2]!;
    f.host.requestProgression({ kind: "classic", level: 1 });
    states.push(f.snapshot());
    f.host.requestProgression({ kind: "classic", level: 2 });
    states.push(f.snapshot());
    f.host.confirmation!.pending = true;
    f.host.requestProgression({ kind: "classic", level: 3 });
    states.push(f.snapshot());
    f.host.confirmation!.pending = false;
    f.resultDone();
    states.push(f.snapshot());
    f.setProgressionAllowed(false);
    f.host.requestProgression({ kind: "classic", level: 3 });
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN candidate errors, transition failure and result constructor failure match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.setCorruptCandidate(true);
    f.host.requestProgression({ kind: "xun", level: 3 });
    states.push(f.snapshot());
    f.setCorruptCandidate(false);
    f.setOpenPreparationFails(true);
    f.host.requestProgression({ kind: "xun", level: 3 });
    states.push(f.snapshot());
    f.setOpenPreparationFails(false);
    f.setTransitionFails(true);
    f.host.requestProgression({ kind: "xun", level: 3 }, true, "step");
    states.push(f.snapshot());
    f.setTransitionFails(false);
    f.setCommitAllowed(false);
    f.host.requestProgression({ kind: "xun", level: 3 }, true, "step");
    states.push(f.snapshot());
    f.setCommitAllowed(true);
    f.setOpenResultFails(true);
    f.host.requestProgression({ kind: "xun", level: 3 }, true, "step");
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("cancelled preparation and stale result callback match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const states: unknown[] = [];
    f.setBlockCandidate(true);
    f.host.requestProgression({ kind: "xun", level: 3 });
    f.preparationDone(undefined);
    states.push(f.snapshot());
    f.host.requestProgression({ kind: "xun", level: 3 }, true, "step");
    f.host.selected = { ...f.host.selected };
    f.resultDone();
    states.push(f.snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("generated GarageXView delegates progression request flow", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-progression-flow\.ts"/);
  const view = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const method = view.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "requestProgression");
  assert.ok(method);
  assert.match(generated.slice(method.start!, method.end!),
    /requestGarageProgression\(this, target, prepared, method, garageProgressionFlowDependencies\)/);
});
