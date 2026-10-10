import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  GarageSkillSelectionDialog, type GarageSkillDialogAssets,
  type GarageSkillDialogDependencies,
} from "./garage-skill-dialog";
import { GarageSkillSelectionState } from "./garage-progression-session";
import type { XunGarageProgression } from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
function classSource(name: string): string {
  const node = nodes.find(candidate =>
    candidate.type === "ClassDeclaration" && candidate.id?.name === name);
  assert.ok(node);
  return release.slice(node.start!, node.end!);
}
const originalSource = classSource("qa") + "\n" + classSource("Da") + "\nreturn Da;";

class ElementStub {
  className = "";
  textContent = "";
  type = "";
  src = "";
  alt = "";
  title = "";
  disabled = false;
  removed = false;
  isConnected = true;
  children: ElementStub[] = [];
  attrs: Record<string, string> = {};
  style: Record<string, string | ((name: string, value: string) => void)> = {
    setProperty: (name: string, value: string) => { this.style[name] = value; },
  };
  onclick?: () => void;
  listeners = new Map<string, (event: KeyboardEvent) => void>();

  constructor(readonly name: string, readonly owner: { activeElement?: ElementStub },
    readonly events: unknown[]) {}

  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: (event: KeyboardEvent) => void) {
    this.listeners.set(name, callback);
  }
  querySelectorAll(selector: string): ElementStub[] {
    const buttons = this.children.flatMap(child => [
      ...(child.name === "button" && (selector !== "button:not(:disabled)" || !child.disabled)
        ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
    return buttons;
  }
  focus() {
    this.owner.activeElement = this;
    this.events.push(["focus", this.name, this.attrs["aria-label"] ?? this.textContent]);
  }
  remove() {
    this.removed = true;
    this.isConnected = false;
  }
  snapshot(): unknown {
    return {
      name: this.name, className: this.className, text: this.textContent,
      type: this.type, src: this.src, alt: this.alt, title: this.title,
      disabled: this.disabled, removed: this.removed, attrs: { ...this.attrs },
      style: Object.fromEntries(Object.entries(this.style).filter(([, value]) =>
        typeof value === "string")),
      children: this.children.map(child => child.snapshot()),
    };
  }
}

const skills = Array.from({ length: 9 }, (_, index) => ({
  id: index + 1, label: "技能" + (index + 1),
}));
function progression(): XunGarageProgression {
  return { kind: "xun", level: 3, skills: [
    { id: 1, points: 2 }, { id: 2, points: 3 }, { id: 3, points: 1 },
  ] };
}
function assets(): GarageSkillDialogAssets {
  const rect = (x: number, y: number, width = 120, height = 40) =>
    ({ x, y, width, height });
  const rects = new Map<string, ReturnType<typeof rect>>([
    ["/container", rect(0, 0, 750, 700)],
    ["/container/skillTuningCaption", rect(22, 10, 300, 54)],
    ["/container/closeButton", rect(698, 8, 36, 36)],
    ["/container/okButton", rect(225, 655, 146, 42)],
    ["/container/cancelButton", rect(380, 655, 146, 42)],
    ["/container/skillTuning/gameType/speedPage", rect(24, 62)],
    ["/container/skillTuning/gameType/itemPage", rect(145, 62)],
    ...Array.from({ length: 3 }, (_, index) => [
      "/container/skillTuning/speedPage/skillLine" + (index + 1),
      rect(20, 110 + index * 126, 600, 100),
    ] as const),
  ]);
  const urls = new Map<string, string>();
  const allUrls = [
    "tuning_selectperformPopupBg_s", "tuning_selectperform_slotBg_s",
    "tuning_selectperform_slotBg_c", "tuning_selectperform_slotBg_c_effect",
    "tuning_selectperformPopup_tab_3", "tuning_selectperformPopup_tab_1",
    ...Array.from({ length: 4 }, (_, index) => "tuningPopup_x_" + (index + 1)),
    ...Array.from({ length: 3 }, (_, index) => "tuning_selectperform_mark" + (index + 1)),
    ...Array.from({ length: 3 }, (_, index) => "tuning_slotNum_0" + (index + 1)),
    ...skills.map(skill => "tuning_icon_" + skill.id),
  ];
  for (const name of allUrls) urls.set(name, name + ".png");
  return {
    rects, urls, headingStyle: { fontSize: 27, color: "#aabbcc" },
    cardIcon: rect(5, 4, 54, 54), cardName: rect(6, 60, 100, 20),
    cardTag: rect(89, 3, 22, 22),
    cards: new Map(skills.map((skill, index) =>
      [skill.id, rect(30 + (index % 3) * 145, 190 + Math.floor(index / 3) * 145, 116, 116)])),
    actionStyles: new Map([["okButton", "confirm-style"], ["cancelButton", "cancel-style"]]),
  };
}

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub: { activeElement?: ElementStub; createElement(name: string): ElementStub } = {
    createElement(name) { return new ElementStub(name, documentStub, events); },
  };
  documentStub.activeElement = documentStub.createElement("previous-focus");
  let resolveLoad: ((value: GarageSkillDialogAssets) => void) | undefined;
  let rejectLoad: ((error: Error) => void) | undefined;
  const loadAssets: GarageSkillDialogDependencies["loadAssets"] = () => {
    events.push("load-assets");
    return new Promise((resolve, reject) => {
      resolveLoad = resolve;
      rejectLoad = reject;
    });
  };
  const validate = (_value: XunGarageProgression) => { events.push("validate"); };
  const select = (value: XunGarageProgression, row: number, id: number) => {
    events.push(["select", row, id]);
    const next = { ...value, skills: value.skills.map(skill => ({ ...skill })) };
    next.skills[row]!.id = id;
    next.skills[row]!.points = 0;
    return next;
  };
  const availablePoints = (value: XunGarageProgression) => {
    events.push(["points", value.skills.map(skill => skill.points)]);
    return 20 - value.skills.reduce((total, skill) => total + skill.points, 0);
  };
  const styleAction: GarageSkillDialogDependencies["styleAction"] =
    (_button, style, kind) => { events.push(["style", style, kind]); };
  const dependencies: GarageSkillDialogDependencies = {
    createState: (value, row) => new GarageSkillSelectionState(value, row,
      { validate, select, availablePoints }),
    loadAssets, styleAction, availablePoints, skills,
  };
  const Original = new Function(
    "kt", "Xs", "we", "Ts", "he", "fs", "document", "HTMLElement", originalSource,
  )(validate, select, availablePoints, loadAssets, styleAction, skills,
    documentStub, ElementStub) as new (
      surface: HTMLElement, library: unknown, value: XunGarageProgression,
      row: number, onClose: (value?: XunGarageProgression) => void,
    ) => GarageSkillSelectionDialog;
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  globalThis.document = documentStub as unknown as Document;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  const surface = documentStub.createElement("surface");
  const onClose = (value?: XunGarageProgression) => { events.push(["close", value]); };
  let dialog: GarageSkillSelectionDialog;
  try {
    dialog = released
      ? new Original(surface as unknown as HTMLElement, "library", progression(), 0, onClose)
      : new GarageSkillSelectionDialog(surface as unknown as HTMLElement, "library",
          progression(), 0, onClose, dependencies);
  } catch (error) {
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
    throw error;
  }
  const settle = async (failure = false) => {
    if (failure) rejectLoad!(new Error("asset failed"));
    else resolveLoad!(assets());
    await new Promise<void>(resolve => setImmediate(resolve));
  };
  const restore = () => {
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  };
  const snapshot = () => ({
    events: structuredClone(events), surface: surface.snapshot(),
    active: documentStub.activeElement?.name,
    value: dialog.state.value, changed: dialog.state.changed,
    disposed: dialog.disposed, hasAssets: !!dialog.assets,
    choices: [...dialog.choices.keys()],
  });
  return { dialog, surface, snapshot, settle, restore };
}

test("skill card rendering, uncommitted selection, confirm and focus match Da", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    try {
      const loading = f.snapshot();
      await f.settle();
      const ready = f.snapshot();
      (f.dialog.choices.get(4) as unknown as ElementStub).onclick?.();
      const selected = f.snapshot();
      (f.dialog.accept as unknown as ElementStub).onclick?.();
      f.dialog.dispose();
      return { loading, ready, selected, closed: f.snapshot() };
    } finally { f.restore(); }
  };
  assert.deepEqual(await run(false), await run(true));
});

test("skill dialog Tab, Escape, load failure and early disposal match Da", async () => {
  const run = async (released: boolean) => {
    const failed = fixture(released);
    let failure: unknown;
    try {
      await failed.settle(true);
      failure = failed.snapshot();
      (failed.dialog.cancel as unknown as ElementStub).onclick?.();
      failure = { loadingFailure: failure, canceled: failed.snapshot() };
    } finally { failed.restore(); }
    const escaped = fixture(released);
    let keys: unknown;
    try {
      await escaped.settle();
      const listener = (escaped.dialog.element as unknown as ElementStub).listeners.get("keydown")!;
      listener({ key: "Tab", shiftKey: true, preventDefault() {}, stopPropagation() {} } as KeyboardEvent);
      const tabbed = escaped.snapshot();
      listener({ key: "Escape", shiftKey: false, preventDefault() {}, stopPropagation() {} } as KeyboardEvent);
      keys = { tabbed, escaped: escaped.snapshot() };
    } finally { escaped.restore(); }
    const disposed = fixture(released);
    let abandoned: unknown;
    try {
      disposed.dialog.dispose();
      await disposed.settle();
      abandoned = disposed.snapshot();
    } finally { disposed.restore(); }
    return { failure, keys, abandoned };
  };
  assert.deepEqual(await run(false), await run(true));
});
