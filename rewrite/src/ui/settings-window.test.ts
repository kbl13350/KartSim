import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ScrollbarController } from "./scrollbar";
import {
  createSettingsWindowClass, SettingsWindow,
  type SettingsAssets, type SettingsFrame, type SettingsNode,
  type SettingsWindowDependencies, type SettingsWindowDraft,
} from "./settings-window";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class oy {");
const helperStart = release.indexOf("function tl0(n, e, t) {", classStart);
const helperEnd = release.indexOf("\nclass ll0 {", helperStart);
assert.ok(classStart > 0 && helperStart > classStart && helperEnd > helperStart);

interface TestRect { x: number; y: number; width: number; height: number }
type TestHost = SettingsWindow & Record<string, any>;

function node(name: string, attributes: Record<string, string> = {},
  children: SettingsNode[] = []): SettingsNode {
  return { name, text: "", attributes: Object.entries(attributes).map(([key, value]) =>
    ({ name: key, value })), children };
}

function frame(texture: string): SettingsFrame {
  const edge = { x: 0, y: 0, width: 1, height: 1 };
  return { texture, caption: edge, left: edge, right: edge,
    client: edge, bottom: edge, captionLeftMargin: 0,
    captionRightMargin: 0, bottomLeftMargin: 0,
    bottomRightMargin: 0, clientType: "fill" };
}

class Element {
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: any) => void>>();
  readonly children: Element[] = [];
  parentElement?: Element;
  hidden = false;
  disabled = false;
  inert = false;
  value = "";
  type = "";
  min = "";
  max = "";
  step = "";
  title = "";
  tabIndex = 0;
  constructor(readonly tagName: string, readonly events: unknown[]) {}
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
  addEventListener(name: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  fire(name: string, event: Record<string, any> = {}): void {
    for (const listener of this.listeners.get(name) ?? []) listener(event);
  }
  append(...children: Element[]): void {
    for (const child of children) { this.children.push(child); child.parentElement = this; }
    this.events.push(["append", this.tagName, children.map(child => child.tagName)]);
  }
  focus(): void { this.events.push(["focus", this.tagName]); }
  remove(): void { this.events.push(["remove", this.tagName]); }
  setPointerCapture(id: number): void { this.events.push(["capture", this.tagName, id]); }
  getBoundingClientRect(): TestRect {
    return { x: 0, y: 0, width: 1600, height: 900 };
  }
  getContext(): unknown { return fakeCanvasContext; }
}

let fakeCanvasContext: unknown;

async function exercise(readable: boolean) {
  const events: unknown[] = [];
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalObserver = globalThis.ResizeObserver;
  const originalElement = globalThis.HTMLElement;
  globalThis.document = {
    createElement: (name: string) => new Element(name, events),
    activeElement: undefined,
  } as unknown as Document;
  try {
    const getAttribute = (entry: SettingsNode, name: string) =>
      entry.attributes.find(attribute => attribute.name === name)?.value;
    const clientRect = (skin: SettingsFrame, rectangle: TestRect) => ({
      x: rectangle.x + skin.left.width, y: rectangle.y + skin.caption.height,
      width: rectangle.width - skin.left.width - skin.right.width,
      height: rectangle.height - skin.caption.height - skin.bottom.height,
    });
    const layoutRect = (entry: SettingsNode, viewport: TestRect,
      _skin?: SettingsFrame, _texture?: unknown, override?: Partial<TestRect>) => {
      const [x, y, width, height] = (getAttribute(entry, "windowRect") ?? "10 20 100 30")
        .split(/\s+/).map(Number);
      return { x: viewport.x + x!, y: viewport.y + y!,
        width: override?.width ?? width!, height: override?.height ?? height! };
    };
    const measureText = (_context: unknown, value: string, style: { size: number }) =>
      ({ width: value.length * style.size, height: style.size + 2 });
    const drawText = (_context: unknown, value: string, rectangle: TestRect,
      style: Record<string, unknown>) => events.push(["text", value, rectangle, style]);
    const drawFrame = (_context: unknown, skin: SettingsFrame,
      _image: unknown, rectangle: TestRect) => events.push(["frame", skin.texture, rectangle]);
    const versions = ["CN", "KR"];
    const tabs = ["view_graphicsOption@zz", "view_gameOption@zz",
      "view_keyboardMap@zz", "view_macroChatDefine@zz"];
    const speedChoices = (_version: string) => [
      { speed: 7, available: true },
      { speed: 4, available: false, unavailableReason: "missing" },
    ];
    const versionStatus = (version: string) =>
      ({ available: version === "CN", unavailableReason: "missing" });
    const keyboardLabel = (value: number) => value === 0 ? "" : `key:${value}`;
    const gamepadLabel = (value?: string) => value ? `pad:${value}` : "";
    const gamepadButtons = (_pads: (Gamepad | null)[]) => new Set<string>();
    const keyActions = [0, 1, 2, 18, 19].map(index => ({ index }));
    const defaults = { 0: 11, 1: 12, 2: 13, 18: 20, 19: 21 };
    const dialogShortcuts = { F1: "toonLine" };
    const defaultSound = { bgmEnabled: true, bgmVolume: 1,
      fxEnabled: true, fxVolume: 1, enableRoadSound: false };
    let loadedAssets: SettingsAssets;
    const deps = {
      loadAssets: async () => loadedAssets,
      parseBgmChoices: () => [], releaseFont: () => {},
      configureCanvas: (_canvas: unknown, _context: unknown,
        width: number, height: number) => events.push(["canvas", width, height]),
      pixelRatio: () => 1,
      layoutRect, clientRect,
      captionPosition: () => ({ x: 0, y: 0 }),
      captionRect: (_skin: SettingsFrame, rectangle: TestRect) => rectangle,
      measureText, paintText: drawText, paintFrame: drawFrame,
      keyboardLabel, gamepadLabel, gamepadButtons,
      validGamepadCode: (code: string) => code !== "bad",
      usedGamepadCode: (map: Record<number, string>, index: number, code: string) =>
        Object.entries(map).some(([other, value]) => Number(other) !== index && value === code),
      browserKeyCode: (code: string) => code === "Bad" ? 0 : 42,
      validKeyCode: (code: number) => code !== 0,
      tabs, versions, defaultVersion: "CN", versionStatus, speedChoices,
      fallbackSpeed: () => ({ speed: 7, available: true }),
      speedChannel: (_version: string, speed: number) =>
        speedChoices("CN").find(choice => choice.speed === speed),
      channelText: (choice: { speed: number }) => `speed:${choice.speed}`,
      keyActions, defaultKeyMap: defaults, dialogShortcuts, defaultSound,
    } as unknown as SettingsWindowDependencies;
    const Original = new Function(
      "Ie", "C4", "b6", "T", "E9", "V0", "ve", "m9", "C9", "ct",
      "p3", "xe", "f3", "an", "_i", "k3", "Ts", "_s", "bF", "Dn",
      "Tc", "wf", "el0", "Jc0", "Ac", "Di", "Qd", "Jg", "em",
      "zv", "VP", "HP", "ut", "Br", "Hg", "EP", "ca0", "SP", "sa0",
      "xP", "CP", "BP", "_P", "G1", "qc0", "Dc0", "Kv", "st",
      `${release.slice(classStart, helperEnd)}\nreturn oy;`,
    )(
      tabs, "CN", ScrollbarController, getAttribute, clientRect, layoutRect,
      measureText, drawText, drawFrame,
      (context: { drawImage: (...args: unknown[]) => void }, image: { image: unknown }, rectangle: TestRect) =>
        context.drawImage(image.image, rectangle.x + (rectangle.width - 8) / 2,
          rectangle.y + (rectangle.height - 8) / 2),
      deps.configureCanvas, deps.pixelRatio,
      (_skin: SettingsFrame, rectangle: TestRect) => rectangle,
      deps.captionPosition, "P3528 Settings", { x: 0, y: 0, width: 1600, height: 900 },
      "raceSpeedVersion", "raceSpeedChannel", "raceSpeedHint", 21,
      "rgb(42,55,80)", "#bfbfbf", "—",
      { bgmMute: "bgmEnabled", toonLine: "toonLine" },
      versionStatus, speedChoices, versions, "速度版本", "速度频道",
      deps.speedChannel, deps.channelText,
      (_context: unknown, value: string) => [value],
      keyActions, defaults, gamepadButtons, deps.validGamepadCode,
      deps.usedGamepadCode, keyboardLabel, gamepadLabel,
      deps.browserKeyCode, deps.validKeyCode, dialogShortcuts,
      defaultSound, deps.releaseFont, deps.loadAssets, deps.parseBgmChoices,
      (_context: unknown, scrollbar: { areaFrame: SettingsFrame;
        buttonFrames: SettingsFrame[] }, image: unknown,
      geometry: { area: TestRect; button: TestRect }, state = 3) => {
        drawFrame(null, scrollbar.areaFrame, image, geometry.area);
        drawFrame(null, scrollbar.buttonFrames[state]!, image, geometry.button);
      },
      (id: string, hovered?: string, pressed?: string) =>
        hovered !== id ? 0 : pressed === id ? 2 : 1,
    ) as { prototype: Record<string, any>;
      load(options: unknown): Promise<TestHost>;
      new(options: unknown, assets: unknown): TestHost };

    const context = {
      imageSmoothingEnabled: true,
      clearRect: (...args: unknown[]) => events.push(["clear", ...args]),
      drawImage: (...args: unknown[]) => events.push(["image", ...args.slice(1)]),
      fillRect: (...args: unknown[]) => events.push(["fill", ...args]),
      measureText: (value: string) => ({ width: value.length * 6 }),
      save: () => events.push(["save"]),
      restore: () => events.push(["restore"]),
      beginPath: () => events.push(["begin"]),
      rect: (...args: unknown[]) => events.push(["rect", ...args]),
      clip: () => events.push(["clip"]),
    };
    fakeCanvasContext = context;
    const label = node("Label", { text: "#sb(option)", textRender: "bold16" });
    const button = node("TextButton", { name: "ok", text: "#sb(ok)" });
    const panel = node("Panel", { name: "root", texture: "background" },
      [label, button]);
    const buttonFrame = frame("button");
    const assets: SettingsAssets = {
      definition: panel, graphics: node("Panel"), game: node("Panel"),
      keyboard: node("Panel"), keymapScrollbar: {
        areaFrame: frame("scroll"), buttonFrames: Array.from({ length: 4 },
          () => frame("scroll")), minButtonHeight: 25,
      },
      keyMessageBox: node("CaptionWindow"), config: node("Panel"),
      frames: new Map([["DefaultEdit", [frame("edit")]],
        ["SelectBtn", [buttonFrame, buttonFrame, buttonFrame]]]),
      styles: new Map([[button, { states: Array.from({ length: 4 }, () => ({
        frame: buttonFrame, textRender: "bold16", textColor: "black",
        textColor2: "black",
      })), frameName: "button" }]]),
      images: new Map(["background", "button", "edit", "scroll"].map(name =>
        [name, { image: {} as HTMLCanvasElement, width: 100, height: 30 }])),
      strings: new Map([["option", "选项"], ["ok", "确定"],
        ["invalidKey", "无效键"], ["alreadyUsedKey", "按键已使用"],
        ["soundBgm", "音乐"]]), font: {},
    };
    loadedAssets = assets;
    const draft: SettingsWindowDraft = {
      bgmEnabled: true, bgmVolume: 0.4, fxEnabled: true, fxVolume: 0.5,
      enableRoadSound: true, toonLine: true, shadow: true, boostBlur: false,
      mainMenuBgmPath: "", keyMap: { 0: 11, 1: 12, 2: 13 }, gamepadMap: {},
    };
    const options = {
      root: new Element("root", events) as unknown as HTMLElement,
      library: { canonicalCandidates: () => [], exactCanonicalCandidates: () => [] },
      initial: draft,
      initialSpeed: 7, initialVersion: "CN",
      onActivate: () => events.push(["activate"]),
      onPreview: () => events.push(["preview"]),
      onConfirm: (_draft: unknown, speed: number, version: string) =>
        events.push(["confirm", speed, version]),
      onCancel: () => events.push(["cancel"]),
    };
    const view = Object.create(readable ? SettingsWindow.prototype : Original.prototype) as TestHost;
    Object.assign(view, {
      options, dependencies: deps, assets, context,
      element: new Element("div", events), canvas: new Element("canvas", events),
      errorElement: new Element("div", events),
      draft: { ...draft, keyMap: { ...draft.keyMap }, gamepadMap: {} },
      tab: tabs[0], controls: new Map(), renderedControls: new Set(),
      keyScroll: new ScrollbarController(() => events.push(["scroll-change"])),
      keyChanges: {}, keyErrorLines: [], raceSpeed: 7, raceVersion: "CN",
      bgmChoices: [{ id: 1, label: "一", path: "one" },
        { id: 2, label: "二", path: "two" }], bgmOffset: 0,
      gamepadHeld: new Set(), cursorVisible: true,
    });

    view.render();
    const rendering = structuredClone(events);
    events.length = 0;
    const snapshots: unknown[] = [];
    const capture = (name: string, result?: unknown) => snapshots.push({
      name, result, draft: structuredClone(view.draft),
      speed: view.raceSpeed, version: view.raceVersion,
      focus: view.keyFocus, error: view.keyError,
      errorLines: [...view.keyErrorLines],
      combo: view.openCombo, events: structuredClone(events),
    });
    capture("initial", {
      visible: [view.visible(panel), view.visible(node("Skip")),
        view.visible(node("Panel", { name: "imgBoostBlurOn" }))],
      preset: view.panelTexture(node("Panel", { name: "iconPanel", texture: "normal" })),
      text: view.text("#sb(option)"),
      key: view.keyActionLabel(10),
      binding: view.keyBindingLabel(0, false),
      hint: view.speedChannelHint(),
      combo: view.comboBoxGeometries({ client: { x: 2, y: 3, width: 100, height: 20 } }, 2),
    });
    view.openCombo = "speed";
    view.speedCombo = { rect: { x: 2, y: 3, width: 100, height: 20 },
      client: { x: 3, y: 4, width: 98, height: 18 } };
    view.drawSpeedMenu(); capture("speed-menu");
    view.openCombo = "version";
    view.versionCombo = view.speedCombo;
    view.drawVersionMenu(); capture("version-menu");
    view.openCombo = "bgm";
    view.bgmCombo = view.speedCombo;
    view.drawBgmMenu(); capture("bgm-menu");
    view.openCombo = undefined;
    view.keyFocus = 0;
    view.recordKey("KeyA"); capture("record-key");
    view.recordKey("Bad"); capture("invalid-key");
    view.dismissKeyError(); capture("dismiss-key-error");
    view.recordGamepad("padA"); capture("record-gamepad");
    view.resetKeys(); capture("reset-keys");
    view.changeVolume("bgmVolume", 0.8); capture("volume");
    view.dialogShortcut({ code: "Enter", ctrlKey: false } as KeyboardEvent); capture("confirm-key");
    view.dialogShortcut({ code: "F1", ctrlKey: false } as KeyboardEvent); capture("toggle-key");
    view.keyError = "invalidKey";
    view.keyErrorShortcut({ code: "Escape", preventDefault: () =>
      events.push(["prevent"]) } as unknown as KeyboardEvent); capture("escape-error");
    events.length = 0;
    globalThis.HTMLElement = Element as unknown as typeof HTMLElement;
    globalThis.ResizeObserver = class {
      constructor(_changed: () => void) {}
      observe(_root: unknown) { events.push(["observe"]); }
      disconnect() { events.push(["disconnect"]); }
    } as unknown as typeof ResizeObserver;
    globalThis.window = {
      addEventListener: (name: string) => events.push(["window-add", name]),
      removeEventListener: (name: string) => events.push(["window-remove", name]),
    } as unknown as Window & typeof globalThis;
    const WindowClass = readable ? createSettingsWindowClass(deps) : Original;
    const originalRender = WindowClass.prototype.render;
    WindowClass.prototype.render = () => { events.push(["render"]); };
    try {
      const created = readable
        ? new WindowClass(options as never, assets, deps)
        : new WindowClass(options, assets);
      const createdElement = created.element as unknown as Element;
      const createdCanvas = created.canvas as unknown as Element;
      const createdError = created.errorElement as unknown as Element;
      const constructorSnapshot = {
        elementStyle: { ...created.element.style },
        canvasStyle: { ...created.canvas.style },
        errorStyle: { ...created.errorElement.style },
        elementAttributes: [...createdElement.attributes],
        canvasAttributes: [...createdCanvas.attributes],
        errorAttributes: [...createdError.attributes],
        eventNames: [...createdElement.listeners.keys()],
        canvasEvents: [...createdCanvas.listeners.keys()],
        children: createdElement.children.map(child => child.tagName),
      };
      created.dispose();
      const constructorEvents = structuredClone(events);
      events.length = 0;
      const loaded = await WindowClass.load(options);
      const loadSnapshot = {
        bgmChoices: loaded.bgmChoices, bgmOffset: loaded.bgmOffset,
        events: structuredClone(events),
      };
      loaded.dispose();
      return { rendering, snapshots, constructorSnapshot, constructorEvents,
        loadSnapshot };
    } finally {
      WindowClass.prototype.render = originalRender;
    }
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.ResizeObserver = originalObserver;
    globalThis.HTMLElement = originalElement;
    fakeCanvasContext = undefined;
  }
}

test("settings window lifecycle, drawing, combo, key capture and actions match release", async () => {
  const readable = await exercise(true);
  const original = await exercise(false);
  assert.deepEqual(readable, original);
});
