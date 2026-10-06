import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  garageBaseForKart, garageBaseSpecification, garagePartLabel,
  garageSelectedKartSerial, garageSpeedVersion, handleGarageEscapeKey,
  rehitGarageInventoryPreview, showGarageFactoryTutorial,
  type GarageViewActionDependencies, type GarageViewActionHost,
} from "./garage-view-actions";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
const names = ["serial", "speedVersion", "base", "baseFor", "partLabel",
  "rehitTestInventoryPreview", "showFactoryTutorial", "onKey"];
const members = view.body.body.filter(node =>
  (node.type === "ClassMethod" || node.type === "ClassProperty") &&
  node.key.type === "Identifier" && names.includes(node.key.name));
assert.equal(members.length, names.length);
const memberSource = members.map(member => release.slice(member.start!, member.end!)).join("\n");

type TestHost = GarageViewActionHost & {
  serial(): number;
  readonly speedVersion: unknown;
  base(): unknown;
  baseFor(kart: { itemId: number; systemKey?: string }): unknown;
  partLabel(part: unknown): string;
  rehitTestInventoryPreview(): void;
  showFactoryTutorial(): Promise<void>;
  onKey(event: KeyboardEvent): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  let nextFrame = 10;
  const frames = new Map<number, () => void>();
  let resolveTutorial: ((close: () => void) => void) | undefined;
  let rejectTutorial: ((error: unknown) => void) | undefined;
  const pendingTutorial = () => new Promise<() => void>((resolve, reject) => {
    resolveTutorial = resolve; rejectTutorial = reject;
  });
  const previewKey = (kart: { itemId: number; systemKey?: string }) =>
    `${kart.itemId}:${kart.systemKey ?? ""}`;
  const createPreview = (kart: { itemId: number; systemKey?: string }, speed: unknown,
    parameter: unknown, version: unknown) => {
    events.push(["create-preview", kart, speed, parameter, version]);
    return { spec: { kart, version } };
  };
  const partLabel = (part: unknown, strings: Map<string, string>, parts: unknown[]) => {
    events.push(["part-label", part, [...strings], parts]); return "样本部件";
  };
  const hitTest = (_inventory: unknown, x: number, y: number,
    elementAt: (x: number, y: number) => unknown, parts: Map<unknown, unknown>) => {
    events.push(["hit-test", x, y, elementAt(x + 1, y + 1), parts.size]);
    return "hovered-part";
  };
  const elementFromPoint = (x: number, y: number) => ({ at: [x, y] }) as unknown as Element;
  const loadFactoryTutorial = (_library: unknown, _surface: unknown) => {
    events.push("tutorial-load"); return pendingTutorial();
  };
  const cancelFrame = (id: number) => { events.push(["cancel-frame", id]); frames.delete(id); };
  const requestFrame = (callback: () => void) => {
    const id = nextFrame++;
    events.push(["request-frame", id]); frames.set(id, callback); return id;
  };
  const dependencies: GarageViewActionDependencies = {
    defaultVersion: "default", previewKey, createPreview, partLabel,
    hitTest, loadFactoryTutorial, cancelFrame, requestFrame, elementFromPoint,
  };
  const documentStub = { elementFromPoint };
  const Original = new Function("vs", "bs", "xs", "$n", "Rn", "Ea",
    "cancelAnimationFrame", "requestAnimationFrame", "document",
    `return class Original { ${memberSource} };`)(
      "default", previewKey, createPreview, partLabel, hitTest,
      loadFactoryTutorial, cancelFrame, requestFrame, documentStub,
    ) as new () => TestHost;
  const host = new Original();
  host.selected = { itemId: 7, systemKey: "k7" };
  host.options = { profile: { equipment: { itemIds: [0, 1, 2, 7], kartSerial: 42 } },
    speed: "fast", library: "library" };
  host.previews = new Map();
  host.assets = { strings: new Map([["name", "value"]]), parts: [{ itemId: 1 }] };
  host.inventory = { name: "inventory" } as unknown as HTMLElement;
  host.inventoryHitTestFrame = 3;
  host.inventoryPointer = { x: 8, y: 12 };
  host.previewParts = new Map([[{} as Element, "part"]]);
  host.transformPreviewUiHidden = false;
  host.tutorialLoading = false;
  host.disposed = false;
  host.pageMode = "factory";
  host.surface = { name: "surface" } as unknown as HTMLElement;
  host.status = { textContent: "" } as HTMLElement;
  host.frozen = false;
  host.setPartPreview = part => { events.push(["set-preview", part]); host.previewPart = part; };
  host.updatePerformance = () => { events.push("performance"); };
  if (!released) {
    host.serial = () => garageSelectedKartSerial(host);
    Object.defineProperty(host, "speedVersion", { get: () => garageSpeedVersion(host, dependencies) });
    host.base = () => garageBaseSpecification(host);
    host.baseFor = kart => garageBaseForKart(host, kart, dependencies);
    host.partLabel = part => garagePartLabel(host, part, dependencies);
    host.rehitTestInventoryPreview = () => rehitGarageInventoryPreview(host, dependencies);
    host.showFactoryTutorial = () => showGarageFactoryTutorial(host, dependencies);
    host.onKey = event => handleGarageEscapeKey(host, event);
  }
  const snapshot = () => ({ events: structuredClone(events), serial: host.serial(),
    version: host.speedVersion, previews: [...host.previews], frame: host.inventoryHitTestFrame,
    coating: host.coatingPreview, cosmetic: host.cosmeticPreview,
    preview: host.previewPart, status: host.status.textContent,
    tutorialLoading: host.tutorialLoading, hasClose: !!host.tutorialClose });
  const flushFrames = () => {
    const queued = [...frames]; frames.clear();
    for (const [, callback] of queued) callback();
  };
  return { host, events, snapshot, flushFrames,
    resolveTutorial: (close: () => void) => resolveTutorial!(close),
    rejectTutorial: (error: unknown) => rejectTutorial!(error) };
}

test("kart serial, cached base specification and part label match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const first = f.host.base();
    const second = f.host.baseFor(f.host.selected);
    f.host.options.version = "v2";
    const other = f.host.baseFor({ itemId: 8, systemKey: "k8" });
    f.host.selected = { itemId: 99 };
    const label = f.host.partLabel({ itemId: 1 });
    return { first, second, other, label, final: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("inventory hover retest, hidden state and missing pointer match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.coatingPreview = "coating";
    f.host.cosmeticPreview = "cosmetic";
    f.host.rehitTestInventoryPreview();
    f.flushFrames();
    const hovered = f.snapshot();
    f.host.transformPreviewUiHidden = true;
    f.host.rehitTestInventoryPreview();
    f.flushFrames();
    const hidden = f.snapshot();
    f.host.transformPreviewUiHidden = false;
    f.host.inventoryPointer = undefined;
    f.host.rehitTestInventoryPreview();
    f.flushFrames();
    return { hovered, hidden, missing: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("Factory tutorial completion, stale page, disposal and failure match As", async () => {
  const run = async (released: boolean, state: "active" | "page" | "disposed" | "error") => {
    const f = fixture(released);
    f.host.tutorialClose = () => { f.events.push("close-prior"); };
    const task = f.host.showFactoryTutorial();
    await f.host.showFactoryTutorial();
    if (state === "page") f.host.pageMode = "parts";
    if (state === "disposed") f.host.disposed = true;
    if (state === "error") f.rejectTutorial(new Error("missing texture"));
    else f.resolveTutorial(() => { f.events.push("close-new"); });
    await task;
    return f.snapshot();
  };
  for (const state of ["active", "page", "disposed", "error"] as const)
    assert.deepEqual(await run(false, state), await run(true, state), state);
});

test("Escape preview priority and modal guards match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    const key = (value: string) => ({ key: value,
      preventDefault: () => { f.events.push("prevent"); },
      stopImmediatePropagation: () => { f.events.push("stop"); } }) as KeyboardEvent;
    f.host.coatingPreview = "paint";
    f.host.cosmeticPreview = "lamp";
    f.host.previewPart = "wheel";
    f.host.onKey(key("Escape"));
    const coating = f.snapshot();
    f.host.onKey(key("Escape"));
    const cosmetic = f.snapshot();
    f.host.onKey(key("Escape"));
    const part = f.snapshot();
    f.host.confirmation = { pending: true };
    f.host.onKey(key("Escape"));
    f.host.confirmation.pending = false;
    f.host.frozen = true;
    f.host.onKey(key("Escape"));
    f.host.frozen = false;
    f.host.onKey(key("Enter"));
    return { coating, cosmetic, part, guarded: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});
