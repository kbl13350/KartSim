import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  addGaragePartModelTarget, renderGaragePartModels, renderGaragePartVisual,
  type GaragePartModelDependencies, type GaragePartModelHost,
} from "./garage-part-models";
import type { GaragePart } from "./garage-parts-business";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  children: ElementStub[] = [];
  className = "";
  hidden = false;
  src = "";
  width = 0;
  height = 0;
  isConnected = true;
  attributes = new Map<string, string>();
  constructor(readonly name: string) {}
  append(child: ElementStub): void { this.children.push(child); }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  getContext(kind: string): unknown {
    return kind === "2d" ? { canvas: this } : null;
  }
  snapshot(): unknown {
    return { name: this.name, className: this.className, hidden: this.hidden,
      src: this.src, width: this.width, height: this.height,
      isConnected: this.isConnected, attributes: [...this.attributes],
      children: this.children.map(child => child.snapshot()) };
  }
}

type TestHost = GaragePartModelHost & {
  partVisual(container: HTMLElement, part: GaragePart, className: string, row?: number): void;
  renderPartModels(): void;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const dependencies: GaragePartModelDependencies = {
    iconKey: part => {
      events.push(["icon-key", part.family, part.legacyImagePath]);
      return `icon:${part.family}:${part.legacyImagePath ?? part.itemId}`;
    },
    cardLayout: (_assets, family) => {
      events.push(["card-layout", family]);
      return { iconWidth: 60, iconHeight: 45 };
    },
  };
  const documentStub = { createElement: (name: string) => new ElementStub(name) };
  const Original = new Function("Ss", "xt", "document", `${classSource}; return As;`)(
    dependencies.iconKey, dependencies.cardLayout, documentStub,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  host.assets = {
    parts: [{ family: "legacy", slot: "engine", itemId: 1, grade: 1, value: 2,
      legacyImagePath: "native/engine" }],
    partModels: new Map([["engine:2", "model/xun"]]),
  };
  host.modelTargets = [];
  host.modelCache = { get: source => {
    events.push(["cache", source.path]);
    return source.path === "model/xun" ? "loaded model" : undefined;
  } };
  host.inventory = {
    style: { getPropertyValue: (name: string) => name.includes("row-step") ? "100" : "80" },
    clientHeight: 200, scrollTop: 100,
  } as unknown as HTMLElement;
  host.panels = { drawAuxiliaryPanel: (model, contexts) => {
    events.push(["draw", model, contexts.map(context =>
      (context.canvas as unknown as ElementStub).name)]);
  } };
  host.transformPreviewUiHidden = false;
  host.icon = (key, className) => {
    events.push(["icon", key, className]);
    const icon = new ElementStub("img");
    icon.src = key;
    icon.className = className;
    return icon as unknown as HTMLImageElement;
  };
  if (!released) {
    host.partVisual = (container, part, className, row) =>
      renderGaragePartVisual(host, container, part, className, row, dependencies);
    host.addModelTarget = (container, source, className, row, fallback, dimensions) =>
      addGaragePartModelTarget(host, container, source, className, row, fallback, dimensions);
    host.renderPartModels = () => renderGaragePartModels(host);
  }
  const container = new ElementStub("container");
  const snapshot = () => ({
    events: structuredClone(events),
    container: container.snapshot(),
    targets: host.modelTargets.map(target => ({
      path: target.source.path, row: target.row,
      canvas: (target.context.canvas as unknown as ElementStub).snapshot(),
      fallback: target.fallback && (target.fallback as unknown as ElementStub).snapshot(),
    })),
  });
  return { host, container, documentStub, events, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("legacy icons and XUN model target dimensions match As partVisual", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const legacy: GaragePart = { family: "legacy", slot: "engine", itemId: 1, grade: 1, value: 2 };
      const xun: GaragePart = { family: "xun", slot: "engine", itemId: 2, grade: 9, value: 3 };
      f.host.partVisual(f.container as unknown as HTMLElement, legacy, "garage-inventory-icon", 1);
      f.host.partVisual(f.container as unknown as HTMLElement, xun, "garage-inventory-icon", 1);
      f.host.partVisual(f.container as unknown as HTMLElement, xun, "garage-part-max-effect");
      f.host.addModelTarget(f.container as unknown as HTMLElement,
        { path: "model/other" }, "other-preview", 5);
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("model rendering prunes disconnected canvases and batches visible rows like As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const part: GaragePart = { family: "xun", slot: "engine", itemId: 2, grade: 9, value: 3 };
      f.host.partVisual(f.container as unknown as HTMLElement, part, "garage-inventory-icon", 0);
      f.host.partVisual(f.container as unknown as HTMLElement, part, "garage-inventory-icon", 1);
      f.host.partVisual(f.container as unknown as HTMLElement, part, "garage-part-max-effect");
      f.host.partVisual(f.container as unknown as HTMLElement, part, "garage-inventory-icon", 6);
      (f.host.modelTargets[3]!.context.canvas as unknown as ElementStub).isConnected = false;
      f.host.renderPartModels();
      const visible = f.snapshot();
      f.host.transformPreviewUiHidden = true;
      f.host.renderPartModels();
      f.host.panels = undefined;
      f.host.renderPartModels();
      return { visible, final: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Garage view delegates its part model methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const delegates = new Map([
    ["partVisual", "renderGaragePartVisual"],
    ["addModelTarget", "addGaragePartModelTarget"],
    ["renderPartModels", "renderGaragePartModels"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = view.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGaragePartModelsOverrides, [...delegates.keys()]);
});
