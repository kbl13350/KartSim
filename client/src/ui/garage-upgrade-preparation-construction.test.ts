import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { initializeGaragePreparation } from "./garage-upgrade-preparation-construction";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Ja");
assert.ok(view && view.type === "ClassDeclaration");
const constructorNode = view.body.body.find(node =>
  node.type === "ClassMethod" && node.kind === "constructor");
assert.ok(constructorNode);
const source = release.slice(view.start!, view.end!);
const rewrittenSource = source.slice(0, constructorNode.start! - view.start!) +
  "constructor(e,t,s,i,n) { initializeGaragePreparation(this,e,t,s,i,n,dependencies); }" +
  source.slice(constructorNode.end! - view.start!);

class ElementStub {
  className = "";
  textContent = "";
  width = 0;
  height = 0;
  disabled = false;
  attrs: Record<string, string> = {};
  style: Record<string, string> = {};
  children: ElementStub[] = [];
  listeners = new Map<string, (event: KeyboardEvent) => void>();
  constructor(readonly name: string, readonly owner: { activeElement?: ElementStub },
    readonly events: unknown[], readonly canvasAvailable: boolean) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  addEventListener(name: string, callback: (event: KeyboardEvent) => void) {
    this.listeners.set(name, callback);
  }
  querySelectorAll(selector: string): ElementStub[] {
    return this.children.flatMap(child => [
      ...(child.name === "button" && (selector !== "button:not(:disabled)" || !child.disabled)
        ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  getContext(_kind: string) {
    return this.canvasAvailable ? { canvas: this } : null;
  }
  focus() {
    this.owner.activeElement = this;
    this.events.push(["focus", this.name, this.textContent]);
  }
  snapshot(): unknown {
    return {
      name: this.name, className: this.className, text: this.textContent,
      width: this.width, height: this.height, disabled: this.disabled,
      attrs: { ...this.attrs }, style: { ...this.style },
      listeners: [...this.listeners.keys()],
      children: this.children.map(child => child.snapshot()),
    };
  }
}

function run(released: boolean, canvasAvailable: boolean) {
  const events: unknown[] = [];
  const documentStub: {
    activeElement?: ElementStub;
    createElement(name: string): ElementStub;
  } = {
    createElement(name) {
      return new ElementStub(name, documentStub, events, canvasAvailable);
    },
  };
  documentStub.activeElement = documentStub.createElement("previous-focus");
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  globalThis.document = documentStub as unknown as Document;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  const dependencies = {
    createState: (_candidates: unknown[], itemId: number) => {
      events.push(["state", itemId]);
      return { selectedId: itemId };
    },
  };
  const Qa = class {
    selectedId: number;
    constructor(candidates: unknown[], itemId: number) {
      this.selectedId = dependencies.createState(candidates, itemId).selectedId;
    }
  };
  const Dialog = new Function(
    "Qa", "document", "HTMLElement", "initializeGaragePreparation", "dependencies",
    (released ? source : rewrittenSource) + ";return Ja;",
  )(Qa, documentStub, ElementStub, initializeGaragePreparation, dependencies) as
    new (...args: unknown[]) => {
      element: ElementStub;
      controls: ElementStub;
      state: { selectedId: number };
      context?: unknown;
      previousFocus?: ElementStub;
    };
  Dialog.prototype.cancelButton = function(this: { controls: ElementStub }) {
    events.push("cancel-button");
    const cancel = documentStub.createElement("button");
    cancel.textContent = "取消";
    const disabled = documentStub.createElement("button");
    disabled.disabled = true;
    this.controls.append(cancel, disabled);
    cancel.focus();
  };
  Dialog.prototype.load = function(_library: unknown) {
    events.push("load");
    return Promise.resolve();
  };
  Dialog.prototype.close = function(accepted: boolean) {
    events.push(["close", accepted]);
  };
  const surface = documentStub.createElement("surface");
  let result: unknown;
  try {
    const dialog = new Dialog(surface, "library", [{ item: { itemId: 7 } }],
      7, () => undefined);
    const listener = dialog.element.listeners.get("keydown")!;
    listener({ key: "Tab", shiftKey: false, preventDefault() {
      events.push("prevent-tab");
    } } as KeyboardEvent);
    listener({ key: "Escape", preventDefault() {
      events.push("prevent-escape");
    }, stopPropagation() { events.push("stop-escape"); } } as KeyboardEvent);
    result = {
      events, surface: surface.snapshot(), selectedId: dialog.state.selectedId,
      hasContext: !!dialog.context, previous: dialog.previousFocus?.name,
    };
  } catch (error) {
    result = { error: (error as Error).message, events,
      surface: surface.snapshot() };
  } finally {
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  }
  return result;
}

test("upgrade preparation canvas, keyboard trap and loading match Ja constructor", () => {
  const released = run(true, true) as { surface: { children: Array<{
    children: Array<{ name: string; style: Record<string, string> }> }> } };
  // Deliberate change: the release left the control box 0 px high, so the
  // Garage overlay rasterizer skipped every label and button in it.
  const controls = released.surface.children[0]!.children[1]!;
  assert.equal(controls.name, "div");
  assert.deepEqual(controls.style, {});
  controls.style = { position: "absolute", inset: "0" };
  assert.deepEqual(run(false, true), released);
});

test("upgrade preparation missing canvas fails at the same construction point", () => {
  assert.deepEqual(run(false, false), run(true, false));
});
