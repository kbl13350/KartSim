import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  createGarageActionButton, createGarageIcon, createGarageNativeButton,
  garageViewRect, placeGarageControl, setGaragePartsOnlyNodesMounted,
  setGarageUpgradeStatusMounted, setGarageVehicleInfoNodesMounted,
  skinGarageActionButton, type GarageViewControlsHost,
} from "./garage-view-controls";
import type { GaragePreviewRect } from "./garage-transform-preview";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view);
const classSource = release.slice(view.start!, view.end!);

class ElementStub {
  parentElement?: ElementStub;
  children: ElementStub[] = [];
  type = "";
  textContent = "";
  className = "";
  src = "";
  alt = "";
  draggable = true;
  attributes = new Map<string, string>();
  classes = new Set<string>();
  properties = new Map<string, string>();
  onclick?: () => void;
  style = {
    position: "", left: "", top: "", width: "", height: "",
    setProperty: (key: string, value: string) => { this.properties.set(key, value); },
  };
  classList = { add: (name: string) => this.classes.add(name) };
  constructor(readonly name: string) {}
  append(child: ElementStub): void {
    child.parentElement?.removeChild(child);
    child.parentElement = this;
    this.children.push(child);
  }
  removeChild(child: ElementStub): void { this.children = this.children.filter(candidate => candidate !== child); }
  remove(): void { this.parentElement?.removeChild(this); this.parentElement = undefined; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  snapshot(): unknown {
    return { name: this.name, type: this.type, text: this.textContent,
      className: this.className, src: this.src, alt: this.alt,
      draggable: this.draggable, parent: this.parentElement?.name,
      attributes: [...this.attributes], classes: [...this.classes],
      properties: [...this.properties],
      style: { ...this.style, setProperty: undefined },
      children: this.children.map(child => child.name) };
  }
}

type TestHost = GarageViewControlsHost & {
  setPartsOnlyNodesMounted(mounted: boolean): void;
  setVehicleInfoNodesMounted(mounted: boolean): void;
  setUpgradeStatusMounted(mounted: boolean): void;
  nativeButton(name: string, fallback: string, action: () => void, override?: string): HTMLButtonElement;
  icon(key: string, className: string): HTMLImageElement | undefined;
};

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub = { createElement: (name: string) => new ElementStub(name) };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const statePath = (base: string, state: number) =>
    base.endsWith("@zz") ? `${base.slice(0, -3)}${state}@zz` : `${base}${state}`;
  const Original = new Function("document", "y", "se", `${classSource}; return As;`)(
    documentStub, attribute, statePath,
  ) as { prototype: TestHost };
  const host = Object.create(Original.prototype) as TestHost;
  const controls = new ElementStub("controls");
  const previewRoot = new ElementStub("preview-root");
  const parts = [new ElementStub("part-1"), new ElementStub("part-2")];
  const vehicleInfo = [new ElementStub("info-1"), new ElementStub("info-2")];
  const status = new ElementStub("status");
  host.controls = controls as unknown as HTMLElement;
  host.transformPreviewPartsRoot = previewRoot as unknown as HTMLElement;
  host.partsOnlyNodes = parts as unknown as HTMLElement[];
  host.vehicleInfoNodes = vehicleInfo as unknown as HTMLElement[];
  host.status = status as unknown as HTMLElement;
  host.options = { onInteraction: () => { events.push("interaction"); } };
  const rect: GaragePreviewRect = { x: 10, y: 20, width: 100, height: 35 };
  host.assets = {
    nodes: new Map([
      ["install", { attrs: { text: "#sb(install)", autoLoadImage: "button@zz",
        textColor: "255 12 34 56", overTextColor: "unparsed",
        clickedTextColor: "128 1 2 3", disabledTextColor: "" } }],
      ["plain", { attrs: { text: "plain" } }],
    ]),
    strings: new Map([["install", "安装部件"]]),
    imageUrls: new Map([
      ["button1@zz", "normal.png"], ["button2@zz", "hover.png"],
      ["button3@zz", "pressed.png"], ["icon", "icon.png"],
    ]),
    rects: new Map([["install", rect], ["plain", rect]]),
  };
  if (!released) {
    host.place = (element, bounds) => placeGarageControl(host, element, bounds);
    host.setPartsOnlyNodesMounted = mounted => setGaragePartsOnlyNodesMounted(host, mounted);
    host.setVehicleInfoNodesMounted = mounted => setGarageVehicleInfoNodesMounted(host, mounted);
    host.setUpgradeStatusMounted = mounted => setGarageUpgradeStatusMounted(host, mounted);
    host.button = (label, action) => createGarageActionButton(host, label, action);
    host.skin = (button, base, count) => skinGarageActionButton(host, button, base, count);
    host.nativeButton = (name, fallback, action, override) =>
      createGarageNativeButton(host, name, fallback, action, override, { attribute });
    host.rect = name => garageViewRect(host, name);
    host.icon = (key, className) => createGarageIcon(host, key, className);
  }
  const snapshot = () => ({
    events: structuredClone(events), controls: controls.snapshot(),
    previewRoot: previewRoot.snapshot(), parts: parts.map(node => node.snapshot()),
    vehicleInfo: vehicleInfo.map(node => node.snapshot()), status: status.snapshot(),
  });
  return { host, documentStub, controls, previewRoot, parts, vehicleInfo, status, events, snapshot };
}

function withDocument<T>(documentStub: unknown, run: () => T): T {
  const previous = globalThis.document;
  globalThis.document = documentStub as Document;
  try { return run(); }
  finally { globalThis.document = previous; }
}

test("parts, vehicle information and upgrade status mounting match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.host.setPartsOnlyNodesMounted(true);
    f.host.setPartsOnlyNodesMounted(true);
    f.host.setVehicleInfoNodesMounted(true);
    f.host.setUpgradeStatusMounted(true);
    const mounted = f.snapshot();
    f.host.setPartsOnlyNodesMounted(false);
    f.host.setVehicleInfoNodesMounted(false);
    f.host.setUpgradeStatusMounted(false);
    return { mounted, unmounted: f.snapshot() };
  };
  assert.deepEqual(run(false), run(true));
});

test("native button text, textures, colors and guarded actions match As", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    return withDocument(f.documentStub, () => {
      const button = f.host.nativeButton("install", "回退", () => { throw new Error("操作失败"); });
      const plain = f.host.nativeButton("plain", "默认", () => { throw "非错误对象"; }, "覆盖文本");
      const icon = f.host.icon("icon", "garage-icon");
      const absent = f.host.icon("missing", "garage-icon");
      const initial = { snapshot: f.snapshot(), button: (button as unknown as ElementStub).snapshot(),
        plain: (plain as unknown as ElementStub).snapshot(),
        icon: (icon as unknown as ElementStub).snapshot(), absent };
      (button as unknown as ElementStub).onclick?.();
      (plain as unknown as ElementStub).onclick?.();
      let missingRect: string | undefined;
      try { f.host.rect("missing"); }
      catch (error) { missingRect = (error as Error).message; }
      return { initial, after: f.snapshot(), missingRect };
    });
  };
  assert.deepEqual(run(false), run(true));
});

test("generated Garage view delegates its control methods", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const delegates = new Map([
    ["place", "placeGarageControl"],
    ["setPartsOnlyNodesMounted", "setGaragePartsOnlyNodesMounted"],
    ["setVehicleInfoNodesMounted", "setGarageVehicleInfoNodesMounted"],
    ["setUpgradeStatusMounted", "setGarageUpgradeStatusMounted"],
    ["button", "createGarageActionButton"],
    ["skin", "skinGarageActionButton"],
    ["nativeButton", "createGarageNativeButton"],
    ["rect", "garageViewRect"],
    ["icon", "createGarageIcon"],
  ]);
  for (const [name, delegate] of delegates) {
    const method = view.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.handwrittenGarageViewControlsOverrides, [...delegates.keys()]);
});
