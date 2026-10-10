import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import { GarageExceedTypeDialog,
  type GarageExceedDialogDependencies } from "./garage-exceed-dialog";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "Tn");
assert.ok(view && view.type === "ClassDeclaration");
const source = release.slice(view.start!, view.end!);

class ElementStub {
  className = "";
  textContent = "";
  type = "";
  src = "";
  alt = "";
  disabled = false;
  removed = false;
  isConnected = true;
  attrs: Record<string, string> = {};
  children: ElementStub[] = [];
  classes = new Set<string>();
  onclick?: () => void;
  listeners = new Map<string, (event: KeyboardEvent) => void>();
  classList = {
    add: (...names: string[]) => names.forEach(name => this.classes.add(name)),
    toggle: (name: string, active: boolean) => active
      ? this.classes.add(name) : this.classes.delete(name),
  };
  constructor(readonly name: string, readonly owner: { activeElement?: ElementStub },
    readonly events: unknown[]) {}
  append(...children: ElementStub[]) { this.children.push(...children); }
  setAttribute(name: string, value: string) { this.attrs[name] = value; }
  querySelectorAll(name: string): ElementStub[] {
    return this.children.flatMap(child => [
      ...(child.name === name ? [child] : []), ...child.querySelectorAll(name),
    ]);
  }
  addEventListener(name: string, callback: (event: KeyboardEvent) => void) {
    this.listeners.set(name, callback);
  }
  dispatchEvent(event: KeyboardEvent): boolean {
    this.listeners.get(event.type)?.(event);
    return true;
  }
  focus() { this.owner.activeElement = this; this.events.push(["focus", this.name]); }
  remove() { this.removed = true; }
  snapshot(): unknown {
    return { name: this.name, className: this.className, text: this.textContent,
      type: this.type, src: this.src, alt: this.alt, disabled: this.disabled,
      removed: this.removed, attrs: { ...this.attrs }, classes: [...this.classes],
      children: this.children.map(child => child.snapshot()) };
  }
}

function fixture(released: boolean) {
  const events: unknown[] = [];
  const documentStub: { activeElement?: ElementStub; createElement(name: string): ElementStub } = {
    createElement(name) { return new ElementStub(name, documentStub, events); },
  };
  documentStub.activeElement = documentStub.createElement("previous-focus");
  let resolveStyles: ((styles: { actionStyles: Map<string, unknown> }) => void) | undefined;
  const styleAction = (_button: HTMLButtonElement, style: unknown, kind: string) => {
    events.push(["style", kind, style]);
  };
  const loadStyles = (_library: unknown) => {
    events.push("load-styles");
    return new Promise<{ actionStyles: Map<string, unknown> }>(resolve => {
      resolveStyles = resolve;
    });
  };
  const resolveChoice: GarageExceedDialogDependencies["resolveChoice"] = choice =>
    choice === "random" ? 3 : choice;
  const dependencies: GarageExceedDialogDependencies = {
    styleAction, loadStyles, resolveChoice,
  };
  const Original = new Function("Ye", "he", "Ts", "ua", "document", "HTMLElement",
    `${source}; return Tn;`)([2, 3, 4], styleAction, loadStyles,
      resolveChoice, documentStub, ElementStub,
    ) as new (surface: HTMLElement, assets: unknown, library: unknown,
      current: unknown, onClose: (choice?: number) => void) => GarageExceedTypeDialog;
  const surface = documentStub.createElement("surface");
  const assets = { exceedTypes: new Map([
    [2, { textureType: 12, accelLevel: 3, timeLevel: 4 }],
    [3, { textureType: 13, accelLevel: 5, timeLevel: 6 }],
  ]), urls: new Map([["icon_exceedB_12", "S.png"],
    ["icon_exceedB_13", "B.png"]]) };
  const onClose = (choice?: number) => { events.push(["close", choice]); };
  const previousDocument = globalThis.document;
  const previousElement = globalThis.HTMLElement;
  globalThis.document = documentStub as unknown as Document;
  globalThis.HTMLElement = ElementStub as unknown as typeof HTMLElement;
  let dialog: GarageExceedTypeDialog;
  try {
    dialog = released
      ? new Original(surface as unknown as HTMLElement, assets, "library",
          { title: "测试车辆", type: 2 }, onClose)
      : new GarageExceedTypeDialog(surface as unknown as HTMLElement, assets,
          "library", { title: "测试车辆", type: 2 }, onClose, dependencies);
  } finally {
    globalThis.document = previousDocument;
    globalThis.HTMLElement = previousElement;
  }
  const withDocument = <T>(run: () => T): T => {
    const old = globalThis.document;
    globalThis.document = documentStub as unknown as Document;
    try { return run(); } finally { globalThis.document = old; }
  };
  const panel = dialog.panel as unknown as ElementStub;
  const choiceButtons = panel.children[2]!.children;
  const snapshot = () => ({ events: structuredClone(events),
    surface: surface.snapshot(), selected: dialog.selected,
    disposed: dialog.disposed, active: documentStub.activeElement?.name });
  const settleStyles = async () => {
    resolveStyles!({ actionStyles: new Map([["okButton", "ok-style"],
      ["cancelButton", "cancel-style"]]) });
    await new Promise<void>(resolve => setImmediate(resolve));
  };
  return { dialog, panel, choiceButtons, snapshot, settleStyles, withDocument };
}

test("Exceed Type choices, native labels and confirmation match Tn", async () => {
  for (const index of [0, 3]) {
    const run = async (released: boolean) => {
      const f = fixture(released);
      const initial = f.snapshot();
      await f.settleStyles();
      f.withDocument(() => {
        f.choiceButtons[index]!.onclick?.();
        (f.dialog.action as unknown as ElementStub).onclick?.();
      });
      const confirmation = f.snapshot();
      const shade = f.panel.children.at(-1)!;
      const buttons = shade.children[0]!.querySelectorAll("button");
      f.withDocument(() => {
        buttons[1]!.onclick?.();
        (f.dialog.action as unknown as ElementStub).onclick?.();
      });
      const secondShade = f.panel.children.at(-1)!;
      secondShade.children[0]!.querySelectorAll("button")[0]!.onclick?.();
      return { initial, confirmation, final: f.snapshot() };
    };
    assert.deepEqual(await run(false), await run(true), String(index));
  }
});

test("Exceed Type Escape, cancel and repeated disposal match Tn", () => {
  const run = (released: boolean) => {
    const f = fixture(released);
    f.withDocument(() => f.dialog.overlay.dispatchEvent({ type: "keydown", key: "Escape",
      preventDefault: () => {} } as KeyboardEvent));
    f.dialog.dispose();
    return f.snapshot();
  };
  assert.deepEqual(run(false), run(true));
});
