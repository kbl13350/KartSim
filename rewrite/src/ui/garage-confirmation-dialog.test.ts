import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GarageConfirmationDialog, type GarageConfirmationDependencies } from
  "./garage-confirmation-dialog";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class xQ {");
const end = release.indexOf("\nclass Gw {", start);
assert.ok(start > 0 && end > start);

function exercise(readable: boolean) {
  const events: unknown[] = [];
  const priorDocument = globalThis.document;
  const priorWindow = globalThis.window;
  const priorHTMLElement = globalThis.HTMLElement;
  let activeElement: FakeElement | undefined;
  class FakeElement {
    readonly style: Record<string, string> = {};
    readonly attributes = new Map<string, string>();
    readonly listeners = new Map<string, Array<(event: any) => void>>();
    readonly children: FakeElement[] = [];
    className = "";
    hidden = false;
    textContent = "";
    type = "";
    width = 0;
    height = 0;
    isConnected = true;
    imageSmoothingEnabled = false;
    onclick?: () => void;
    onfocus?: () => void;
    onblur?: () => void;
    constructor(readonly tag: string) { events.push(["create", tag]); }
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value);
      events.push(["attribute", this.tag, name, value]);
    }
    getContext() { events.push(["context", this.tag]); return context; }
    getBoundingClientRect() { return { width: 800, height: 450 }; }
    append(...children: FakeElement[]) {
      this.children.push(...children);
      events.push(["append", this.tag, children.map(child => child.tag)]);
    }
    addEventListener(type: string, listener: (event: any) => void) {
      const handlers = this.listeners.get(type) ?? [];
      handlers.push(listener);
      this.listeners.set(type, handlers);
      events.push(["listen", this.tag, type]);
    }
    dispatch(type: string, event: any = {}) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
    focus() {
      activeElement?.onblur?.();
      activeElement = this;
      events.push(["focus", this.tag]);
      this.onfocus?.();
    }
    matches(selector: string) { assert.equal(selector, ":hover"); return false; }
    remove() { this.isConnected = false; events.push(["remove", this.tag]); }
  }
  const context = {
    imageSmoothingEnabled: false,
    clearRect: (...args: unknown[]) => events.push(["clear", ...args]),
    drawImage: (...args: unknown[]) => events.push(["image", ...args.slice(1)]),
  };
  const root = new FakeElement("root");
  const previousFocus = new FakeElement("previous-focus");
  activeElement = previousFocus;
  const document = {
    createElement: (tag: string) => new FakeElement(tag),
    get activeElement() { return activeElement; },
  };
  const window = {
    addEventListener: (name: string, _listener: unknown) => events.push(["window-listen", name]),
    removeEventListener: (name: string, _listener: unknown) => events.push(["window-remove", name]),
  };
  globalThis.document = document as unknown as Document;
  globalThis.window = window as unknown as Window & typeof globalThis;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  try {
    const node = (frame: string) => ({ attributes: { frame } });
    const skin = (texture: string) => ({ texture });
    const frames = new Map([
      ["Dialog", new Map([["Activated", skin("dialog")]])],
      ["Divider", new Map([["Normal", skin("divider")]])],
      ["DefaultFocusedButton", new Map([
        ["Normal", skin("focus")], ["MouseOn", skin("focus-hover")],
        ["Clicked", skin("focus-click")],
      ])],
      ["TextButton", new Map([
        ["Normal", skin("normal")], ["MouseOn", skin("hover")],
        ["Clicked", skin("click")],
      ])],
    ]);
    const blueprint = {
      nodes: { dialog: node("Dialog"), divider: node("Divider") },
      frames, config: {}, strings: new Map<string, string>(),
      warningPath: "warning.png",
    };
    const images = new Map<string, unknown>([
      ...["dialog", "divider", "focus", "focus-hover", "focus-click",
        "normal", "hover", "click"].map(key => [`gui_/monocoque/${key}.png`, key] as const),
      ["warning.png", "warning"],
    ]);
    const rect = (x: number, y: number) => ({ x, y, width: 80, height: 24 });
    const layout = (_blueprint: unknown, lines: number, size: unknown,
      request: { singleAction?: boolean }) => {
      events.push(["layout", lines, size, Boolean(request.singleAction)]);
      return { window: rect(0, 0), icon: rect(10, 10), message: rect(20, 20),
        divider: rect(30, 30), affirmative: rect(40, 40), negative: rect(50, 50) };
    };
    const attribute = (entry: { attributes: Record<string, string> }, key: string) =>
      entry.attributes[key];
    const resizeCanvas = (_canvas: unknown, _context: unknown,
      width: number, height: number, ratio: number, logicalWidth: number,
      logicalHeight: number) => events.push([
        "resize", width, height, ratio, logicalWidth, logicalHeight]);
    const paintFrame = (_context: unknown, frame: { texture: string },
      image: unknown, area: unknown) => events.push(["frame", frame.texture, image, area]);
    const drawText = (_context: unknown, value: string, area: unknown, style: unknown) =>
      events.push(["text", value, area, style]);
    const inner = (_frame: unknown, area: unknown) => area;
    const partEquipRequest = (_strings: unknown, name: string) => ({
      title: "Part", message: name, affirmative: "Equip", negative: "No", warning: true,
    });
    const deps = {
      loadFont: async () => "font", loadAssets: async () => ({ blueprint, images }),
      releaseFont: (font: unknown) => events.push(["release", font]),
      partEquipRequest, layout, attribute,
      resizeCanvas, pixelRatio: () => 2, paintFrame, drawText,
      captionOffset: () => ({ x: 0 }), captionRectangle: inner,
      innerRectangle: inner, fontFamily: "garage-font",
    } as unknown as GarageConfirmationDependencies;
    const Original = new Function("pQ", "yQ", "bQ", "MQ", "T", "p3",
      "xe", "C9", "m9", "an", "f3", "E9", "Qu", "G1",
      `${release.slice(start, end)}\nreturn FR;`)(
      deps.loadFont, deps.loadAssets, partEquipRequest, layout, attribute,
      resizeCanvas, deps.pixelRatio, paintFrame, drawText,
      deps.captionOffset, inner, inner, deps.fontFamily, deps.releaseFont,
    ) as {
      new (...args: unknown[]): GarageConfirmationDialog;
      load(...args: unknown[]): Promise<GarageConfirmationDialog>;
    };
    const visibility = (shown: boolean) => events.push(["visibility", shown]);
    const dialog = readable
      ? new GarageConfirmationDialog(root as unknown as HTMLElement, visibility,
        blueprint, images, "font", deps)
      : new Original(root, visibility, blueprint, images, "font");
    const accepted: string[] = [];
    const event = () => ({
      preventDefault: () => events.push(["prevent"]),
      stopPropagation: () => events.push(["stop"]),
      key: "",
    });
    dialog.open("Equip?\nAre you sure?", () => accepted.push("yes"));
    dialog.open("ignored", () => accepted.push("ignored"));
    const yes = dialog.yes as unknown as FakeElement;
    const no = dialog.no as unknown as FakeElement;
    const element = dialog.element as unknown as FakeElement;
    yes.dispatch("pointerenter");
    yes.dispatch("pointerdown");
    yes.dispatch("pointerup");
    yes.dispatch("pointerleave");
    no.dispatch("click", event());
    dialog.openPartEquip("Part X", () => accepted.push("part"));
    yes.onclick?.();
    dialog.openNotice("Notice");
    element.dispatch("keydown", { ...event(), key: "Tab" });
    element.dispatch("keydown", { ...event(), key: "Escape" });
    dialog.dispose();
    dialog.dispose();
    return {
      events, accepted, pending: dialog.pending, disposed: dialog.disposed,
      hidden: dialog.element.hidden, noHidden: dialog.no.hidden,
      attributes: [...dialog.element.attributes],
    };
  } finally {
    globalThis.document = priorDocument;
    globalThis.window = priorWindow;
    globalThis.HTMLElement = priorHTMLElement;
  }
}

test("garage confirmation window construction, canvas, pointer and action lifecycle match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
