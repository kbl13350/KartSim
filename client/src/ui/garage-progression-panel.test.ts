import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  appendGarageNativeColorText, garageExceedChangeAvailability,
  updateGarageProgressionPanel,
  type GarageProgressionPanelDependencies, type GarageProgressionPanelHost,
  type GarageProgressionRect, type GarageProgressionState,
} from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
const sourceOf = (name: string) => {
  const node = nodes.find(candidate =>
    candidate.type === "FunctionDeclaration" && candidate.id?.name === name ||
    candidate.type === "ClassDeclaration" && candidate.id?.name === name ||
    candidate.type === "VariableDeclaration" && candidate.declarations.some(declaration =>
      declaration.id.type === "Identifier" && declaration.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start!, node.end!);
};
const originalHelpers = ["It", "st", "fa", "ma", "wa", "ya", "$s"].map(sourceOf).join("\n");
const originalPanel = sourceOf("va");

class ElementStub {
  className = "";
  title = "";
  textContent = "";
  value = "";
  disabled = false;
  hidden = false;
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: ElementStub[] = [];
  onchange?: () => void;
  onclick?: () => void;
  style = { backgroundImage: "", color: "" };
  constructor(readonly tag: string) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  snapshot(): unknown {
    return {
      tag: this.tag, className: this.className, title: this.title,
      text: this.textContent, value: this.value, disabled: this.disabled,
      hidden: this.hidden, dataset: { ...this.dataset },
      attributes: [...this.attributes], style: { ...this.style },
      children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageProgressionPanelHost & {
  update(progression: GarageProgressionState, hasVehicle: boolean,
    grade: number, factory?: { active: boolean; abilities: number[] },
    exceedType?: number, vehicle?: { itemId: number; kartType?: number },
    noAvailableVehicles?: boolean): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const elements: ElementStub[] = [];
  const controls: Array<{ node: string; title: string; button: ElementStub }> = [];
  const documentStub = {
    createElement: (tag: string) => {
      const element = new ElementStub(tag);
      elements.push(element);
      return element;
    },
    createTextNode: (text: string) => new ElementStub(`text:${text}`),
  };
  const nextLevel = (progression: GarageProgressionState, grade: number): GarageProgressionState => {
    events.push(["next-level", grade]);
    return { ...progression, level: progression.level + 1 };
  };
  const remainingPoints = (progression: GarageProgressionState) => {
    events.push("remaining-points");
    const used = progression.kind === "classic"
      ? progression.points.reduce((sum, point) => sum + point, 0)
      : progression.skills.reduce((sum, skill) => sum + skill.points, 0);
    return 8 - used;
  };
  const changePoint = (progression: GarageProgressionState, index: number, delta: number): GarageProgressionState => {
    events.push(["change-point", index, delta]);
    return progression.kind === "classic"
      ? { ...progression, points: progression.points.map((point, position) =>
        position === index ? point + delta : point) }
      : { ...progression, skills: progression.skills.map((skill, position) =>
        position === index ? { ...skill, points: skill.points + delta } : skill) };
  };
  const initialProgression = (_xun: boolean) =>
    ({ kind: "classic" as const, level: 0, points: [0, 0, 0, 0] });
  const skills = [{ id: 11, label: "高速" }, { id: 22, label: "弯道" }];
  const dependencies: GarageProgressionPanelDependencies = {
    nextLevel, remainingPoints, changePoint, initialProgression, skills,
  };
  const Original = new Function("Vs", "we", "ze", "ce", "fs", "document",
    `${originalHelpers}\n${originalPanel}\nreturn va;`)(
      nextLevel, remainingPoints, changePoint, initialProgression, skills, documentStub,
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.assets = {
    strings: new Map([
      ["specialSlotSelect", "特殊属性"], ["apply", "适用"],
      ["exceedDesc7", "前[color:255 12 34 56]颜色[/color]后"],
    ]),
    enchantDescriptions: new Map([
      [101, { title: "强化速度", description: "速度增加" }],
      [202, { title: "强化弯道", description: "弯道增加" }],
    ]),
    urls: new Map([["tuning_progressbar_02", "progress.png"]]),
    exceedTypes: new Map([[7, { id: 7, textureType: 3, accelLevel: 2, timeLevel: 4 }]]),
    exceedTypeChange: { unableTargets: new Set<number>() },
    stage: { width: 1600 },
  };
  host.element = new ElementStub("panel") as unknown as HTMLElement;
  host.classicContainer = new ElementStub("classic") as unknown as HTMLElement;
  host.engine12Container = new ElementStub("xun") as unknown as HTMLElement;
  host.activeContainer = host.classicContainer;
  host.framedControls = new Map();
  host.onChange = progression => { events.push(["on-change", structuredClone(progression)]); };
  host.onSelectSkill = index => { events.push(["select-skill", index]); };
  host.onExceedTypeChange = () => { events.push("change-exceed"); };
  host.reset = layout => { events.push(["reset", layout]); host.framedControls.clear(); };
  host.rect = node => {
    events.push(["rect", node]);
    return node.includes("skillGauge") ? { x: 350, y: 15, width: 90, height: 20 }
      : { x: 200, y: 15, width: 100, height: 20 };
  };
  host.label = (text, rect, node) => { events.push(["label", text, rect, node]); };
  host.button = (node, title, action, disabled = false, offset = 0) => {
    const button = documentStub.createElement("button");
    button.disabled = disabled;
    button.title = title;
    button.onclick = action;
    controls.push({ node, title, button });
    events.push(["button", node, title, disabled, offset]);
    return button as unknown as HTMLButtonElement;
  };
  host.nativeLabel = (node, fallback) => {
    events.push(["native-label", node, fallback]);
    return documentStub.createElement("div") as unknown as HTMLElement;
  };
  host.texture = (name, rect) => { events.push(["texture", name, rect]); };
  host.place = (element, rect) => {
    events.push(["place", elements.indexOf(element as unknown as ElementStub), rect]);
  };
  host.styleFromNode = (element, node) => {
    events.push(["style", elements.indexOf(element as unknown as ElementStub), node]);
  };
  if (!released) host.update = (progression, hasVehicle, grade, factory,
    exceedType, vehicle, noAvailableVehicles = false) => updateGarageProgressionPanel(
      host, progression, hasVehicle, grade, factory, exceedType,
      vehicle, noAvailableVehicles, dependencies);
  const snapshot = () => ({
    events: structuredClone(events),
    layout: (host.element as unknown as ElementStub).dataset.engineGradeLayout,
    classicHidden: host.classicContainer.hidden,
    xunHidden: host.engine12Container.hidden,
    active: host.activeContainer === host.classicContainer ? "classic" : "xun",
    framed: [...host.framedControls.keys()],
    elements: elements.map(element => element.snapshot()),
    controls: controls.map(control => [control.node, control.title]),
  });
  return { host, documentStub, events, controls, elements, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("classic strengthening page and its callbacks match va.update", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const state = { kind: "classic" as const, level: 2, points: [1, 2, 0, 0] };
      f.host.update(state, true, 8, { active: true, abilities: [101, 202, 999] });
      const initial = f.snapshot();
      f.controls.find(control => control.node === "pointSpeedPlus")!.button.onclick?.();
      f.controls.find(control => control.node === "pointClear")!.button.onclick?.();
      f.controls.find(control => control.node === "카트레벨업")!.button.onclick?.();
      const select = f.elements.find(element => element.tag === "select")!;
      select.value = "202";
      select.onchange?.();
      return { initial, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("XUN skills, Exceed Type states and no-vehicle fallback match va.update", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const state = { kind: "xun" as const, level: 5,
        skills: [{ id: 11, points: 2 }, { id: 22, points: 0 }] };
      f.host.update(state, true, 9, undefined, 7, { itemId: 101, kartType: 2 });
      const enabled = f.snapshot();
      f.controls.find(control => control.node.endsWith("/skillChange"))!.button.onclick?.();
      f.controls.find(control => control.node.endsWith("/plusTuningPoint"))!.button.onclick?.();
      f.controls.find(control => control.node.endsWith("/exceedTypeChangeBtn"))!.button.onclick?.();
      f.host.update({ ...state, level: 4 }, true, 9, undefined, 7,
        { itemId: 101, kartType: 1 });
      const itemKart = f.snapshot();
      f.host.update(state, false, 9, undefined, undefined, undefined, true);
      return { enabled, itemKart, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("progression kind mismatch and Exceed eligibility match release", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      let error: string | undefined;
      try { f.host.update({ kind: "classic", level: 0, points: [0, 0, 0, 0] }, true, 9); }
      catch (caught) { error = (caught as Error).message; }
      return { error, snapshot: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
  const original = new Function(`${originalHelpers}; return $s;`)() as typeof garageExceedChangeAvailability;
  for (const grade of [8, 9]) for (const level of [4, 5]) for (const type of [1, 2]) {
    const vehicle = { engineGrade: grade, itemId: 101, kartType: type, level };
    for (const restrictions of [undefined, { unableTargets: new Set([101]) },
      { unableTargets: new Set<number>() }])
      assert.equal(garageExceedChangeAvailability(vehicle, restrictions), original(vehicle, restrictions));
  }
});

test("native color text markup matches release ya", () => {
  const original = new Function("document", `${originalHelpers}; return ya;`)(
    { createElement: (tag: string) => new ElementStub(tag),
      createTextNode: (text: string) => new ElementStub(`text:${text}`) },
  ) as typeof appendGarageNativeColorText;
  const documentStub = {
    createElement: (tag: string) => new ElementStub(tag),
    createTextNode: (text: string) => new ElementStub(`text:${text}`),
  };
  for (const input of ["普通文本", "前[color:255 1 2 3]红[/color]后",
    "[color:128 4 5 6]半透明[/color][color:0 7 8 9]透明[/color]"]) {
    const expected = new ElementStub("root");
    original(expected as unknown as HTMLElement, input);
    const actual = new ElementStub("root");
    withDocument(documentStub, () => appendGarageNativeColorText(actual as unknown as HTMLElement, input));
    assert.deepEqual(actual.snapshot(), expected.snapshot());
  }
});

test("generated Garage chunk delegates va.update and progression helpers", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const panel = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "va");
  if (!panel || panel.type !== "ClassDeclaration") throw new Error("Generated va missing");
  const update = panel.body.body.find(node => node.type === "ClassMethod" &&
    node.key.type === "Identifier" && node.key.name === "update");
  assert.ok(update);
  assert.match(generated.slice(update.start!, update.end!), /updateGarageProgressionPanel\(/);
  for (const [name, delegate] of [["$s", "garageExceedChangeAvailability"],
    ["ya", "appendGarageNativeColorText"]] as const) {
    const helper = ast.program.body.find(node => node.type === "FunctionDeclaration" && node.id?.name === name);
    assert.ok(helper, name);
    assert.match(generated.slice(helper.start!, helper.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.ok(manifest.handwrittenGarageProgressionOverrides.includes("update"));
  assert.deepEqual(manifest.handwrittenGarageProgressionHelperOverrides, ["$s", "ya"]);
});
