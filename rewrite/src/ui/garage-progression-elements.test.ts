import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  addGarageProgressionButton,
  addGarageProgressionLabel,
  addGarageProgressionNativeLabel,
  addGarageProgressionTexture,
  garageProgressionRect,
  placeGarageProgressionElement,
  styleGarageProgressionFromNode,
  type GarageProgressionElementsHost,
} from "./garage-progression-elements";
import type { GarageProgressionRect } from "./garage-progression-panel";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "va");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  textContent = "";
  className = "";
  title = "";
  type = "";
  src = "";
  alt = "";
  disabled = false;
  onclick?: () => void;
  children: ElementStub[] = [];
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  classes = new Set<string>();
  style = {
    position: "", left: "", top: "", width: "", height: "",
    display: "", alignItems: "", justifyContent: "", fontSize: "",
    fontWeight: "", color: "",
    setProperty: (key: string, value: string) => { this.properties.set(key, value); },
  };
  classList = { add: (name: string) => this.classes.add(name) };
  constructor(readonly tag: string) {}
  append(child: ElementStub): void { this.children.push(child); }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  snapshot(): unknown {
    return {
      tag: this.tag, text: this.textContent, className: this.className,
      title: this.title, type: this.type, src: this.src, alt: this.alt,
      disabled: this.disabled, style: { ...this.style, setProperty: undefined },
      classes: [...this.classes], attributes: [...this.attributes],
      properties: [...this.properties], children: this.children.map(child => child.snapshot()),
    };
  }
}

type TestHost = GarageProgressionElementsHost & {
  label(text: string, rect: GarageProgressionRect, node?: string): void;
  nativeLabel(name: string, fallback: string): HTMLElement;
  texture(name: string, rect: GarageProgressionRect): void;
  button(name: string, title: string, action: () => void,
    disabled?: boolean, offset?: number): HTMLButtonElement;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = { createElement: (tag: string) => new ElementStub(tag) };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const statePath = (base: string, state: number) =>
    base.endsWith("@zz") ? `${base.slice(0, -3)}${state}@zz` : `${base}${state}`;
  const dependencies = { attribute };
  const Original = new Function("y", "se", "document", `${classSource}; return va;`)(
    attribute, statePath, documentStub,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const rect = { x: 10, y: 20, width: 100, height: 35 };
  host.assets = {
    rects: new Map([
      ["label", rect], ["localized", rect], ["literal", rect],
      ["buttonNative", rect], ["buttonFallback", rect],
    ]),
    nodes: new Map([
      ["label", { attrs: { textAlign: "vcenter, right", textRender: "bold16",
        textColor: "128 12 34 56" } }],
      ["localized", { attrs: { text: "#sb(greeting)", textAlign: "center",
        textRender: "outline12", textColor: "white" } }],
      ["literal", { attrs: { text: "第一行|第二行", textAlign: "left" } }],
      ["buttonNative", { attrs: { autoLoadImage: "button@zz", frame: "frame" } }],
    ]),
    urls: new Map([
      ["button1@zz", "state-1.png"], ["button3@zz", "state-3.png"],
      ["art", "art.png"],
    ]),
    strings: new Map([["greeting", "欢迎|回来"]]),
  };
  const container = new ElementStub("container");
  host.activeContainer = container as unknown as HTMLElement;
  host.framedControls = new Map();
  if (!released) {
    host.rect = name => garageProgressionRect(host, name);
    host.place = (element, bounds) => placeGarageProgressionElement(host, element, bounds);
    host.styleFromNode = (element, name) =>
      styleGarageProgressionFromNode(host, element, name, dependencies);
    host.label = (text, bounds, node) => addGarageProgressionLabel(host, text, bounds, node);
    host.nativeLabel = (name, fallback) =>
      addGarageProgressionNativeLabel(host, name, fallback, dependencies);
    host.texture = (name, bounds) => addGarageProgressionTexture(host, name, bounds);
    host.button = (name, title, action, disabled, offset) =>
      addGarageProgressionButton(host, name, title, action, disabled, offset, dependencies);
  }
  const snapshot = () => ({
    events: structuredClone(events), children: container.children.map(child => child.snapshot()),
    framed: [...host.framedControls].map(([name, control]) => [name,
      (control as unknown as ElementStub).snapshot()]),
  });
  return { host, rect, events, documentStub, container, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("progression authored rects, CSS text styles and localized labels match va", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      let missing: string | undefined;
      try { f.host.rect("missing"); }
      catch (error) { missing = (error as Error).message; }
      const label = new ElementStub("div");
      f.host.styleFromNode(label as unknown as HTMLElement, "label");
      f.host.styleFromNode(label as unknown as HTMLElement, "missing");
      const styled = label.snapshot();
      f.host.label("强化", f.rect, "label");
      f.host.nativeLabel("localized", "回退");
      f.host.nativeLabel("literal", "回退");
      return { missing, styled, snapshot: f.snapshot() };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("progression art and native-state buttons match va including text fallback", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      f.host.texture("missing", f.rect);
      f.host.texture("art", f.rect);
      const native = f.host.button("buttonNative", "加点", () => { f.events.push("native-click"); },
        true, 13);
      const fallback = f.host.button("buttonFallback", "清空", () => { f.events.push("fallback-click"); });
      native.click?.();
      (native as unknown as ElementStub).onclick?.();
      (fallback as unknown as ElementStub).onclick?.();
      return f.snapshot();
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated progression panel delegates seven authored control methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const panel = parse(generated, { sourceType: "module" }).program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "va");
  if (!panel || panel.type !== "ClassDeclaration") throw new Error("Generated va missing");
  const delegates = new Map([
    ["rect", "garageProgressionRect"], ["place", "placeGarageProgressionElement"],
    ["styleFromNode", "styleGarageProgressionFromNode"],
    ["label", "addGarageProgressionLabel"],
    ["nativeLabel", "addGarageProgressionNativeLabel"],
    ["texture", "addGarageProgressionTexture"],
    ["button", "addGarageProgressionButton"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = panel.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  for (const name of delegates.keys())
    assert.ok(manifest.handwrittenGarageProgressionOverrides.includes(name), name);
});
