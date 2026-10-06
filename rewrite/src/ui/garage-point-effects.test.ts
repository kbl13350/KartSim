import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  compareGarageSkillEffects, garageSkillEffectRect, GaragePointEffects,
  type GaragePointEffectPanel, type GarageSkillProgression,
} from "./garage-point-effects";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const nodes = parse(release, { sourceType: "module" }).program.body;
const sourceOf = (name: string) => {
  const node = nodes.find(candidate =>
    (candidate.type === "ClassDeclaration" || candidate.type === "FunctionDeclaration") &&
    candidate.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start!, node.end!);
};
const originalSource = ["st", "za", "Ua", "Ka"].map(sourceOf).join("\n");

class ElementStub {
  className = "";
  hidden = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  attrs: Record<string, string> = {};
  children: ElementStub[] = [];
  width = 0;
  height = 0;
  removed = false;
  constructor(readonly name: string, readonly events: unknown[]) {}
  append(child: ElementStub) { this.children.push(child); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  remove() { this.removed = true; }
  getContext(_kind: string) {
    return { canvas: this, clearRect: (...args: unknown[]) => {
      this.events.push(["clear", this.name, ...args]);
    } } as unknown as CanvasRenderingContext2D;
  }
  snapshot(): unknown {
    return { name: this.name, className: this.className, hidden: this.hidden,
      dataset: { ...this.dataset }, style: { ...this.style }, attrs: { ...this.attrs },
      width: this.width, height: this.height, removed: this.removed,
      children: this.children.map(child => child.snapshot()) };
  }
}

type TestEffects = GaragePointEffects & {
  transition(before: GarageSkillProgression, after: GarageSkillProgression): void;
};

function fixture(released: boolean, scene = true) {
  const events: unknown[] = [];
  const pending: Array<{ resolve(panel: GaragePointEffectPanel): void;
    reject(error: unknown): void }> = [];
  const documentStub = { createElement: (name: string) => new ElementStub(name, events) };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const Original = new Function("document", "y",
    `const It = 15;\n${originalSource}\nconst Oa = "/backGround/engine12Data/tuningPanel/skillTuning"; return { Ka, Ua, za };`)(
      documentStub, attribute,
    ) as { Ka: new (surface: HTMLElement, assets: unknown,
      load: (source: unknown) => Promise<GaragePointEffectPanel>,
      onError: (message: string) => void) => TestEffects;
      Ua: typeof compareGarageSkillEffects;
      za: typeof garageSkillEffectRect };
  const root = "/backGround/engine12Data/tuningPanel/skillTuning/tuningSkill1";
  const rect = { x: 10, y: 20, width: 12, height: 14 };
  const assets = { nodes: new Map(scene ? [[`${root}/tuningPoint1s`,
    { attrs: { scene: "skill-spark" } }]] : []),
    rects: new Map([[`${root}/tuningPoint1s`, rect],
      [`${root}/skillGauge`, { x: 30, y: 50, width: 248, height: 28 }]]) };
  const surface = new ElementStub("surface", events);
  const load = (source: unknown) => {
    events.push(["load", (source as { path: string }).path]);
    return new Promise<GaragePointEffectPanel>((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  };
  const onError = (message: string) => { events.push(["error", message]); };
  const previous = globalThis.document;
  globalThis.document = documentStub as unknown as Document;
  let effects: TestEffects;
  try {
    effects = released
      ? new Original.Ka(surface as unknown as HTMLElement, assets, load, onError)
      : new GaragePointEffects(surface as unknown as HTMLElement, assets,
          load, onError, { attribute });
  } finally { globalThis.document = previous; }
  const withDocument = <T>(run: () => T): T => {
    const prior = globalThis.document;
    globalThis.document = documentStub as unknown as Document;
    try { return run(); } finally { globalThis.document = prior; }
  };
  const panel = (durationMs: number): GaragePointEffectPanel => ({ durationMs,
    seek: elapsed => { events.push(["seek", elapsed]); },
    dispose: () => { events.push("dispose-panel"); } });
  const snapshot = () => ({ events: structuredClone(events),
    element: (effects.element as unknown as ElementStub).snapshot(),
    slots: [...effects.slots].map(([row, slot]) => [row, {
      active: slot.active, epoch: slot.epoch, panel: !!slot.panel,
    }]), contextKey: effects.contextKey, disposed: effects.disposed });
  return { effects, Original, pending, panel, snapshot, withDocument, events };
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const before: GarageSkillProgression = { kind: "xun", level: 5,
  skills: [{ id: 1, points: 0 }, { id: 2, points: 1 }, { id: 3, points: 2 }] };
const after: GarageSkillProgression = { ...before,
  skills: [{ id: 1, points: 1 }, { id: 2, points: 1 }, { id: 3, points: 2 }] };

test("skill transition rows and point sprite placement match Ua/za", () => {
  const f = fixture(true);
  for (const [earlier, later] of [[before, after],
    [before, { ...after, level: 4 }], [before, { ...after, kind: "classic" }]] as const)
    assert.deepEqual(compareGarageSkillEffects(earlier, later), f.Original.Ua(earlier, later));
  const gauge = { x: 20, y: 30, width: 248, height: 40 };
  const sprite = { x: 0, y: 0, width: 16, height: 10 };
  for (let points = 1; points <= 5; points++)
    assert.deepEqual(garageSkillEffectRect(gauge, sprite, points),
      f.Original.za(gauge, sprite, points));
});

test("point effect transition, loading, frames and disposal match Ka", async () => {
  const run = async (released: boolean) => {
    const f = fixture(released);
    f.effects.setContext("kart-7");
    f.withDocument(() => f.effects.transition(before, after));
    const loading = f.snapshot();
    f.pending[0]!.resolve(f.panel(300));
    await settle();
    const panels = { drawAuxiliaryPanel: (_panel: unknown, contexts: unknown[]) => {
      f.events.push(["draw-auxiliary", contexts.length]);
    } };
    f.effects.render(100, panels);
    f.effects.render(120, panels);
    f.effects.render(500, panels);
    const finished = f.snapshot();
    f.effects.dispose();
    f.effects.dispose();
    return { loading, finished, final: f.snapshot() };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("missing definitions and invalid effect duration match Ka", async () => {
  const run = async (released: boolean) => {
    const missing = fixture(released, false);
    missing.effects.setContext("kart-7");
    missing.withDocument(() => missing.effects.play(0, 1));
    const missingState = missing.snapshot();
    const f = fixture(released);
    f.effects.setContext("kart-7");
    f.withDocument(() => f.effects.play(0, 1));
    f.pending[0]!.resolve(f.panel(0));
    await settle();
    return { missingState, invalid: f.snapshot() };
  };
  assert.deepEqual(await run(false), await run(true));
});
