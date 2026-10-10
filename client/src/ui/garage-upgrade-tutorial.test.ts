import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import { showGarageUpgradeTutorial,
  type GarageTutorialDependencies, type GarageTutorialLibrary,
} from "./garage-upgrade-tutorial";
import type { GarageAssetNode, GarageAssetRect } from "./garage-asset-bundle";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const declaration = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "FunctionDeclaration" && node.id?.name === "Ea");
assert.ok(declaration && declaration.type === "FunctionDeclaration");
const originalSource = release.slice(declaration.start!, declaration.end!);

const node = (name: string, properties: Record<string, string> = {},
  children: GarageAssetNode[] = []): GarageAssetNode => ({
    name, children, attributes: Object.entries(properties).map(([key, value]) =>
      ({ name: key, value })),
  });
const attribute = (source: GarageAssetNode, name: string): string | undefined =>
  source.attributes.find(entry => entry.name === name)?.value;

type Variant = "normal" | "missing-definition" | "missing-template" |
  "missing-image" | "font-failure" | "canvas-failure";

async function run(released: boolean, variant: Variant): Promise<unknown> {
  const events: unknown[] = [];
  const draws: unknown[] = [];
  const context = {
    imageSmoothingEnabled: false, fillStyle: "", font: "", textAlign: "",
    clearRect(...args: number[]) { draws.push(["clear", ...args]); },
    fillText(text: string, ...args: number[]) {
      draws.push(["text", text, ...args, this.fillStyle, this.font]);
    },
    drawImage(image: { id: number }, ...args: number[]) {
      draws.push(["image", image.id, ...args]);
    },
  };
  let activeElement: FakeElement;
  class FakeElement {
    style: Record<string, string> = {};
    attributes: Record<string, string> = {};
    children: FakeElement[] = [];
    parent?: FakeElement;
    isConnected = false;
    textContent = "";
    type = "";
    disabled = false;
    width = 0;
    height = 0;
    onkeydown?: (event: { key: string; shiftKey: boolean;
      stopPropagation(): void; preventDefault(): void }) => void;
    onclick?: () => void;
    onpointerenter?: () => void;
    onpointerleave?: () => void;
    onpointerdown?: () => void;
    onpointerup?: () => void;
    constructor(readonly tag: string) {}
    setAttribute(name: string, value: string) { this.attributes[name] = value; }
    append(...children: FakeElement[]) {
      for (const child of children) {
        child.parent = this;
        child.isConnected = true;
        this.children.push(child);
      }
    }
    getContext() {
      return this.tag === "canvas" && variant !== "canvas-failure" ?
        context : null;
    }
    getBoundingClientRect() { return { width: 1600, height: 900 }; }
    remove() {
      this.parent!.children = this.parent!.children.filter(child => child !== this);
      this.isConnected = false;
      events.push("remove-overlay");
    }
    focus() { activeElement = this; events.push(["focus", this.tag]); }
  }
  const previous = new FakeElement("previous");
  previous.isConnected = true;
  activeElement = previous;
  const fakeDocument = {
    createElement(tag: string) { return new FakeElement(tag); },
    get activeElement() { return activeElement; },
  };
  let onResize: (() => void) | undefined;
  const fakeWindow = {
    addEventListener(type: string, callback: () => void) {
      events.push(["add-event", type]); onResize = callback;
    },
    removeEventListener(type: string, callback: () => void) {
      assert.equal(callback, onResize);
      events.push(["remove-event", type]); onResize = undefined;
    },
  };
  const buttons = ["prev", "next", "ok"].map(name => node("Button", {
    name, text: `#sb(${name})`, frame: "DefaultFocusedButton",
    textColor: "255 10 20 30", overTextColor: "255 20 30 40",
    clickedTextColor: "255 30 40 50",
    disabledTextColor: "255 40 50 60",
  }));
  const dialog = node("Dialog", {
    frame: "CaptionDialog", captionColor: "red",
  }, [node("Panel", { name: "context" }),
    node("Panel", { name: "buttonGroup" }, buttons)]);
  const plant = node("plant", {}, [
    node("page", { template: "1", image: "one" }),
    node("page", { template: "2", image: "two" }),
  ]);
  const stringBag = node("strings", {}, [
    ...["title", "prev", "next", "ok"].map(name => node("entry",
      { n: name }, [node("value", { c: "cn", v: name.toUpperCase() })])),
  ]);
  const frames = node("frames", {}, [
    node("CaptionDialog", {}, [node("Normal", { texture: "dialog-frame" })]),
    node("DefaultFocusedButton", {}, [
      ...["Normal", "Disabled", "MouseOn", "Clicked"].map(name =>
        node(name, { texture: "button-frame" })),
    ]),
  ]);
  const resources = new Map<string, unknown>([
    ["dialog/tutorial/tutorial.bml", dialog],
    ["dialog/tutorial/plant/tutorial@cn.bml", plant],
    ["dialog/tutorial/tutorial_stringBag.bml", stringBag],
    ["gui_/monocoque/frame.bml", frames],
    ["dialog/tutorial/template1.bml", node("template", {}, [node("image")])],
    ["dialog/tutorial/template2.bml", node("template", {}, [node("image")])],
    ["dialog/tutorial/plant/one.png", new Uint8Array([1])],
    ["dialog/tutorial/plant/two.png", new Uint8Array([2])],
    ["gui_/monocoque/dialog-frame.png", new Uint8Array([3])],
    ["gui_/monocoque/button-frame.png", new Uint8Array([4])],
  ]);
  if (variant === "missing-definition")
    resources.delete("dialog/tutorial/tutorial.bml");
  if (variant === "missing-template")
    resources.delete("dialog/tutorial/template2.bml");
  if (variant === "missing-image")
    resources.delete("dialog/tutorial/plant/two.png");
  const library: GarageTutorialLibrary = {
    exactCanonicalCandidates(path) {
      return resources.has(path) ? [{ sourceName: path, async bytes() {
        events.push(["read", path]);
        return resources.get(path) as Uint8Array;
      } }] : [];
    },
  };
  const childRect = (source: GarageAssetNode, parent: GarageAssetRect,
    _unused1?: unknown, _unused2?: unknown,
    imageSize?: { width: number; height: number }): GarageAssetRect => ({
      x: parent.x + 5, y: parent.y + 6,
      width: imageSize?.width ?? parent.width - 10,
      height: imageSize?.height ?? parent.height - 12,
    });
  const dependencies: GarageTutorialDependencies = {
    parseBml: bytes => bytes as unknown as GarageAssetNode,
    attribute,
    frameStyle: source => ({ texture: attribute(source, "texture") ?? "" }),
    layout(root) {
      const result = new Map<GarageAssetNode, GarageAssetRect>();
      result.set(root, { x: 10, y: 20, width: 500, height: 400 });
      root.children.forEach(child => {
        result.set(child, { x: 20, y: 30, width: 400, height: 300 });
        child.children.forEach((button, index) => result.set(button,
          { x: 30 + index * 50, y: 300, width: 40, height: 20 }));
      });
      return result;
    },
    childRect,
    paintFrame(_context, frame, image, rect) {
      draws.push(["frame", frame?.texture,
        (image as unknown as { id?: number } | undefined)?.id,
        rect.x, rect.y, rect.width, rect.height]);
    },
    sizeCanvas(_canvas, _context, ...args) {
      events.push(["size-canvas", ...args]);
    },
    pixelRatio: () => 2, fontFamily: "Test Garage Font",
    async loadFont() {
      events.push("load-font");
      if (variant === "font-failure") throw new Error("font rejected");
      return "font";
    },
    unloadFont(font) { events.push(["unload-font", font]); },
    bitmapMeta: async bitmap => bitmap,
    async createBitmap(blob) {
      const id = new Uint8Array(await blob.arrayBuffer())[0] ?? 0;
      events.push(["create-bitmap", id]);
      return { id, width: 80, height: 60,
        close() { events.push(["close-bitmap", id]); } } as unknown as ImageBitmap;
    },
  };
  const original = new Function(
    "j", "y", "ve", "Ce", "ws", "$t", "Ws", "Y", "Pe", "Ee",
    "be", "yt", "createImageBitmap", "Blob", "document", "window",
    "HTMLElement", `return (${originalSource});`,
  )(dependencies.parseBml, attribute, dependencies.frameStyle,
    dependencies.unloadFont, dependencies.loadFont,
    dependencies.bitmapMeta, dependencies.layout, childRect,
    dependencies.sizeCanvas, dependencies.pixelRatio,
    dependencies.paintFrame, dependencies.fontFamily,
    dependencies.createBitmap, Blob, fakeDocument, fakeWindow, FakeElement) as
    (library: GarageTutorialLibrary, surface: HTMLElement) =>
      Promise<() => void>;
  const surface = new FakeElement("surface");
  const globals = globalThis as Record<string, unknown>;
  const previousGlobals = {
    document: globals.document, window: globals.window,
    HTMLElement: globals.HTMLElement,
  };
  globals.document = fakeDocument;
  globals.window = fakeWindow;
  globals.HTMLElement = FakeElement;
  let error: string | undefined;
  let snapshot: unknown;
  try {
    const close = released ? await original(library,
      surface as unknown as HTMLElement) :
      await showGarageUpgradeTutorial(library,
        surface as unknown as HTMLElement, dependencies);
    const overlay = surface.children[0]!;
    const dialogButtons = overlay.children.slice(1);
    const initial = dialogButtons.map(button => ({ disabled: button.disabled,
      text: button.textContent, color: button.style.color }));
    dialogButtons[1]!.onclick?.();
    dialogButtons[0]!.onpointerenter?.();
    onResize?.();
    const next = dialogButtons.map(button => ({ disabled: button.disabled,
      color: button.style.color }));
    overlay.onkeydown?.({ key: "Tab", shiftKey: false,
      stopPropagation() {}, preventDefault() {} });
    overlay.onkeydown?.({ key: "Escape", shiftKey: false,
      stopPropagation() {}, preventDefault() {} });
    close();
    snapshot = { initial, next, aria: overlay.attributes,
      remaining: surface.children.length, active: activeElement.tag, draws };
  } catch (cause) { error = String(cause); }
  globals.document = previousGlobals.document;
  globals.window = previousGlobals.window;
  globals.HTMLElement = previousGlobals.HTMLElement;
  return { error, snapshot, events };
}

test("Garage upgrade tutorial resources, navigation and cleanup match release Ea", async () => {
  for (const variant of ["normal", "missing-definition", "missing-template",
    "missing-image", "font-failure", "canvas-failure"] as const)
    assert.deepEqual(await run(false, variant), await run(true, variant), variant);
});
