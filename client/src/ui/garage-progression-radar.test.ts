import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  disposeGarageProgressionPanel, resetGarageProgressionPanel,
  updateGarageProgressionRadar, type GarageProgressionRadarDependencies,
  type GarageProgressionRadarHost,
} from "./garage-progression-radar";

const release = readFileSync(new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const classNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "va");
assert.ok(classNode);
const classSource = release.slice(classNode.start!, classNode.end!);

class ElementStub {
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  children: ElementStub[] = [];
  hidden = false;
  title = "";
  textContent = "";
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  removeAttribute(name: string): void { this.attributes.delete(name); }
  replaceChildren(): void { this.children = []; }
  append(child: ElementStub): void { this.children.push(child); }
  snapshot(): unknown {
    return {
      attributes: [...this.attributes], dataset: this.dataset,
      hidden: this.hidden, title: this.title, textContent: this.textContent,
      children: this.children.map(child => child.snapshot()),
    };
  }
}

const statusElement = () => new ElementStub() as unknown as HTMLElement;
const rectangle = { x: 5, y: 7, width: 130, height: 90 };
type TestHost = GarageProgressionRadarHost & {
  reset(layout?: "classic" | "xun"): void;
  updateRadar(library: unknown, kart: unknown, grade: unknown,
    progression: { kind: string }, configuration: unknown): Promise<void>;
  dispose(): void;
};

function hostFor(released: boolean, dependencies: GarageProgressionRadarDependencies) {
  const Original = new Function("da", "ha", "la", "document",
    `${classSource}; return va;`)(
      dependencies.loadParameters, dependencies.applyChanges,
      dependencies.makeRadar, { createElement: statusElement },
    ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.radarRevision = 0;
  host.radar = undefined;
  host.element = new ElementStub() as unknown as HTMLElement;
  host.element.dataset.engineGradeLayout = "prior";
  host.classicContainer = new ElementStub() as unknown as HTMLElement;
  host.engine12Container = new ElementStub() as unknown as HTMLElement;
  host.activeContainer = host.engine12Container;
  host.framedControls = new Map([["button", new ElementStub() as unknown as HTMLElement]]);
  host.rect = name => { assert.equal(name, "resultGraph"); return rectangle; };
  host.place = (element, rect) => {
    assert.deepEqual(rect, rectangle);
    (host.activeContainer as unknown as ElementStub).append(element as unknown as ElementStub);
  };
  if (!released) {
    host.reset = layout => resetGarageProgressionPanel(host, layout);
    host.updateRadar = (library, kart, grade, progression, configuration) =>
      updateGarageProgressionRadar(host, library, kart, grade, progression, configuration, dependencies);
    host.dispose = () => disposeGarageProgressionPanel(host);
  }
  const snapshot = () => ({
    revision: host.radarRevision,
    radar: host.radar,
    element: (host.element as unknown as ElementStub).snapshot(),
    classic: (host.classicContainer as unknown as ElementStub).snapshot(),
    xun: (host.engine12Container as unknown as ElementStub).snapshot(),
    active: host.activeContainer === host.classicContainer ? "classic" : "xun",
    framedControls: [...host.framedControls.keys()],
  });
  return { host, snapshot };
}

function dependencies(loadParameters: GarageProgressionRadarDependencies["loadParameters"]): GarageProgressionRadarDependencies {
  return {
    createStatus: statusElement,
    loadParameters,
    applyChanges: (input, grade, progression, configuration) => ({
      input, grade, progression, configuration,
    }),
    makeRadar: (input, enhanced, weights) => {
      assert.deepEqual(input, { acceleration: 12 });
      assert.deepEqual(weights, { acceleration: 2 });
      assert.deepEqual(enhanced, {
        input, grade: 7, progression: { kind: "classic" }, configuration: { engine: 4 },
      });
      return [{ label: "加速", base: 12.24, enhanced: 14.76 }];
    },
  };
}

test("upgrade layout reset and disposal match va's state changes", () => {
  const deps = dependencies(async () => ({ input: {}, weights: {} }));
  const run = (released: boolean) => {
    const { host, snapshot } = hostFor(released, deps);
    const states = [];
    host.radar = [{ label: "old", base: 1, enhanced: 2 }];
    for (const mode of ["classic", "xun", undefined] as const) {
      host.reset(mode);
      states.push(snapshot());
      host.radar = [{ label: "old", base: 1, enhanced: 2 }];
      host.framedControls.set("button", new ElementStub() as unknown as HTMLElement);
    }
    host.dispose();
    states.push(snapshot());
    return states;
  };
  assert.deepEqual(run(false), run(true));
});

test("classic radar success, XUN skip, and loading failure match va", async () => {
  const success = dependencies(async () => ({
    input: { acceleration: 12 }, weights: { acceleration: 2 },
  }));
  const failure = dependencies(async () => { throw new Error("archive unavailable"); });
  const run = async (released: boolean) => {
    const states = [];
    const first = hostFor(released, success);
    await first.host.updateRadar("library", "kart", 7,
      { kind: "classic" }, { engine: 4 });
    states.push(first.snapshot());
    await first.host.updateRadar("library", "kart", 9,
      { kind: "xun" }, { engine: 4 });
    states.push(first.snapshot());
    const second = hostFor(released, failure);
    await second.host.updateRadar("library", "kart", 7,
      { kind: "classic" }, { engine: 4 });
    states.push(second.snapshot());
    return states;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("older radar loads cannot overwrite newer state or a disposed panel", async () => {
  const run = async (released: boolean) => {
    const pending: Array<(value: { input: unknown; weights: unknown }) => void> = [];
    const deps = dependencies(() => new Promise(resolve => { pending.push(resolve); }));
    const { host, snapshot } = hostFor(released, deps);
    const first = host.updateRadar("library", "kart", 7,
      { kind: "classic" }, { engine: 4 });
    const second = host.updateRadar("library", "kart", 7,
      { kind: "classic" }, { engine: 4 });
    pending[0]!({ input: { acceleration: 12 }, weights: { acceleration: 2 } });
    await first;
    const afterStale = snapshot();
    pending[1]!({ input: { acceleration: 12 }, weights: { acceleration: 2 } });
    await second;
    const afterCurrent = snapshot();
    const third = host.updateRadar("library", "kart", 7,
      { kind: "classic" }, { engine: 4 });
    host.dispose();
    pending[2]!({ input: { acceleration: 12 }, weights: { acceleration: 2 } });
    await third;
    return [afterStale, afterCurrent, snapshot()];
  };
  assert.deepEqual(await run(false), await run(true));
});

test("generated GarageXView delegates progression radar methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  assert.match(generated, /from "\.\.\/ui\/garage-progression-radar\.ts"/);
  const progression = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "va");
  assert.ok(progression && progression.type === "ClassDeclaration");
  const methods = new Map(progression.body.body.flatMap(node =>
    node.type === "ClassMethod" && node.key.type === "Identifier"
      ? [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  assert.match(methods.get("reset") ?? "", /resetGarageProgressionPanel\(this, layout\)/);
  assert.match(methods.get("updateRadar") ?? "", /updateGarageProgressionRadar\(this,/);
  assert.match(methods.get("dispose") ?? "", /disposeGarageProgressionPanel\(this\)/);
});
