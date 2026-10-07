import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ScrollbarController } from "./scrollbar";
import { TouchPageSwipe } from "./touch-swipe";
import { gridLayout, gridLayoutConfig, gridPageSize, gridStepSize } from "./grid-layout";
import { TrackPickerWindow, createTrackPickerWindowClass,
  type TrackPickerWindowDependencies } from "./track-picker-window";
import type {
  TrackPickerWindowAssets, TrackPickerWindowImage, TrackPickerWindowNode,
  TrackPickerWindowFrame,
} from "./track-picker-window-assets";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = release.indexOf("class _7 {");
const classEnd = release.indexOf("\nasync function ac0(", classStart);
const helperStart = release.indexOf("function vc0(", classEnd);
const helperEnd = release.indexOf("\nfunction de(", helperStart);
assert.ok(classStart > 0 && classEnd > classStart && helperStart > classEnd && helperEnd > helperStart);

type Rect = { x: number; y: number; width: number; height: number };

function node(name: string, attrs: Record<string, string> = {},
  children: TrackPickerWindowNode[] = []): TrackPickerWindowNode {
  return { name, text: "", attributes: Object.entries(attrs).map(([key, value]) =>
    ({ name: key, value })), children };
}

function image(label: string, width = 30, height = 20): TrackPickerWindowImage {
  return { width, height, image: { label } as unknown as HTMLCanvasElement };
}

function frame(): TrackPickerWindowFrame {
  const edge = { x: 0, y: 0, width: 1, height: 1 };
  return { texture: "frame", caption: edge, left: edge, right: edge,
    client: edge, bottom: edge, captionLeftMargin: 0,
    captionRightMargin: 0, bottomLeftMargin: 0,
    bottomRightMargin: 0, clientType: "fill" };
}

let canvasContext: unknown;
class Element {
  readonly style: Record<string, string> = {};
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: any) => void>>();
  readonly children: Element[] = [];
  className = "";
  hidden = false;
  tabIndex = -1;
  maxLength = 0;
  placeholder = "";
  value = "";
  clientWidth = 1600;
  clientHeight = 900;
  cursor = "";
  private captured = new Set<number>();
  constructor(readonly tag: string, readonly events: unknown[]) {}
  getContext(): unknown { return canvasContext; }
  setAttribute(key: string, value: string): void { this.attributes.set(key, value); }
  addEventListener(name: string, callback: (event: any) => void): void {
    this.events.push(["listen", this.tag, name]);
    this.listeners.set(name, [...this.listeners.get(name) ?? [], callback]);
  }
  removeEventListener(name: string): void { this.events.push(["unlisten", this.tag, name]); }
  append(...children: Element[]): void {
    this.children.push(...children);
    this.events.push(["append", this.tag, children.map(child => child.tag)]);
  }
  remove(): void { this.events.push(["remove", this.tag]); }
  focus(): void { this.events.push(["focus", this.tag]); }
  blur(): void { this.events.push(["blur", this.tag]); }
  setPointerCapture(id: number): void { this.captured.add(id); this.events.push(["capture", id]); }
  hasPointerCapture(id: number): boolean { return this.captured.has(id); }
  releasePointerCapture(id: number): void { this.captured.delete(id); this.events.push(["release", id]); }
  getBoundingClientRect(): Rect { return { x: 0, y: 0, width: 1600, height: 900 }; }
}

function fixture(events: unknown[]) {
  const getAttribute = (entry: TrackPickerWindowNode | undefined, name: string) =>
    entry?.attributes.find(attr => attr.name === name)?.value;
  const caption = node("Label", { text: "赛道", textRender: "bold16", textColor: "white" });
  const close = node("ImageButton", { name: "cancel" });
  const window = node("Window", { name: "selectTrackEx" }, [caption, close]);
  const favorite = node("Panel", { name: "favTrt0", stringPos: "1 2",
    textRender: "bold16" });
  const themeList = node("Grid", { name: "selectTheme", alignSize: "3",
    maxLine: "1" });
  const trackList = node("Grid", { name: "thumbList", alignSize: "3",
    maxLine: "1" });
  const searchEdit = node("Input", { name: "searchEdit", maxChar: "20" });
  const definition = node("Root", { color: "255 0 0 0" }, [
    window, favorite, themeList, trackList, searchEdit,
    node("Panel", { name: "selectThemeListBar" }),
    node("Panel", { name: "thumbListBar" }),
    node("Panel", { name: "contentFrame" }),
    node("Label", { name: "searchTotalTrack", text: "#sb(total)",
      textRender: "bold16", textColor: "white" }),
  ]);
  const difficultyChar = node("Char", { name: "difficultyChar",
    fontSize: "8 9", spaceOffset: "1", fontStr: "01" });
  const difficulty = node("Panel", { name: "difficulty" }, [difficultyChar]);
  const cardDefinition = node("Card", { trackRect: "0 0 80 50",
    windowRect: "0 0 100 80", smallSpecialMarkAdjust: "4 5" }, [
    node("Panel", { name: "selectTrackThumbBG" }), difficulty,
    node("Panel", { name: "favoriteTrackCheck" }),
  ]);
  const radioDefinition = node("Root", {}, [
    node("Panel", { name: "radio.item" }, [caption]),
    node("Panel", { name: "radio.speed" }, [caption]),
  ]);
  const themeDefinition = node("Theme", { stringPos: "2 3",
    textRender: "bold16" }, [node("Panel", { name: "themeIcon" })]);
  const randomGroup = { id: "random1", cardToken: "hot1", randomType: "hot1",
    gameType: "speed", trackIds: ["track1", "track2"] };
  const assets = {
    definition, radioDefinition, themeDefinition, cardDefinition,
    buttons: new Map(["confirm", "cancel"].map(id => [id, {
      definition: node("TextButton", { name: id }),
      style: { states: Array.from({ length: 4 }, () => ({
        frame: frame(), textRender: "bold16", textColor: "white",
      })) },
    }])),
    frames: new Map(), checkFrames: Array.from({ length: 4 }, frame),
    scrollbars: new Map(["selectThemeListBar", "thumbListBar"].map(id =>
      [id, { areaFrame: frame(), buttonFrames: Array.from({ length: 4 }, frame),
        minButtonHeight: 25 }])),
    notice: { definition: node("Notice"), frame: frame(), frameImage: image("frame").image,
      iconImage: image("icon").image, captionOffset: { x: 0, y: 0 } },
    main: image("main"), themeButton: Array.from({ length: 4 }, (_, i) => image(`theme${i}`)),
    selectedThemeButton: Array.from({ length: 4 }, (_, i) => image(`selectedTheme${i}`)),
    favoriteButton: Array.from({ length: 4 }, (_, i) => image(`favorite${i}`)),
    selectedFavoriteButton: Array.from({ length: 4 }, (_, i) => image(`selectedFavorite${i}`)),
    cardFrame: Array.from({ length: 4 }, (_, i) => image(`card${i}`)),
    selectedCard: image("selectedCard"), selectedTheme: image("selectedTheme"),
    favoriteMark: Array.from({ length: 6 }, (_, i) => image(`favoriteMark${i}`)),
    difficultyLabel: image("difficultyLabel"), difficulty: image("difficulty"),
    reverseStamp: image("reverse"), frame: image("frame"),
    textButtonFrame: image("buttonFrame"),
    closeButton: Array.from({ length: 4 }, (_, i) => image(`close${i}`)),
    randomCards: new Map([["hot1", image("randomCard", 100, 60)]]),
    randomDescriptionDefinition: node("Panel", { leftTopWH: "0 0 220 225" }),
    randomDescriptionBackground: image("randomBackground", 4, 4),
    randomDescriptionTitle: image("randomTitle", 4, 4),
    themes: [{ id: "mabi", title: "马比诺基", icon: image("themeIcon") }],
    strings: new Map([["selectTrackCaption", "选择赛道"],
      ["fvrTrack_helpstring", "搜索"], ["favoriteTrack", "收藏"],
      ["total", "总数"], ["select", "确认"], ["cancel", "取消"]]),
    font: {} as FontFace,
  } as unknown as TrackPickerWindowAssets;
  const viewport = { x: 10, y: 20, width: 200, height: 100 };
  const layoutRect = (entry: TrackPickerWindowNode, parent: Rect,
    _frame?: unknown, _image?: unknown, override?: Partial<Rect>) => ({
      x: parent.x + 1, y: parent.y + 2,
      width: override?.width ?? 80, height: override?.height ?? 50,
    });
  const layoutTree = (root: TrackPickerWindowNode, parent: Rect) => {
    const result = new Map<TrackPickerWindowNode, Rect>();
    const visit = (entry: TrackPickerWindowNode, rectangle: Rect) => {
      const child = layoutRect(entry, rectangle);
      result.set(entry, child);
      entry.children.forEach(item => visit(item, child));
    };
    visit(root, parent);
    return result;
  };
  const paintText = (_context: unknown, text: string,
    rectangle: Rect, style: Record<string, unknown>) =>
    events.push(["text", text, rectangle, style]);
  const paintFrame = (_context: unknown, skin: unknown, _image: unknown,
    rectangle: Rect) => events.push(["frame", rectangle]);
  const noticeLayout = (_node: unknown, _frame: unknown, height = 0) => ({
    window: { ...viewport, height: 100 + height },
    message: { ...viewport, width: 80, height: 40 + height }, icon: viewport,
  });
  const paintNotice = (_context: unknown, _notice: unknown, layout: unknown,
    title: unknown, lines: unknown) => events.push(["notice-paint", layout, title, lines]);
  const ops = {
    loadAssets: async () => ({ randomAvailable: true, assets }),
    loadTrackCard: async () => image("loadedCard"),
    releaseFont: () => events.push(["release-font"]),
    layoutTree, layoutRect,
    frameClient: (_frame: unknown, rectangle: Rect) => ({ ...rectangle,
      x: rectangle.x + 1, y: rectangle.y + 1,
      width: rectangle.width - 2, height: rectangle.height - 2 }),
    paintFrame, paintText,
    measureText: (_context: unknown, text: string) => ({ width: text.length * 8,
      height: 18 }),
    configureCanvas: (_canvas: unknown, _context: unknown,
      width: number, height: number) => events.push(["canvas", width, height]),
    pixelRatio: () => 1,
    positionControl: (_element: unknown, rectangle: Rect, x: number, y: number) =>
      events.push(["position", rectangle, x, y]),
    noticeLayout, paintNotice,
  } as unknown as TrackPickerWindowDependencies;
  const root = new Element("root", events);
  const options = {
    root: root as unknown as HTMLElement, library: {} as any,
    tracks: [
      { id: "track1", title: "雪山", theme: "mabi", gameType: "speed",
        path: "track1", reverse: true, difficulty: 3 },
      { id: "track2", title: "矿山", theme: "mabi", gameType: "speed",
        path: "track2", difficulty: 2 },
    ],
    randomGroups: [randomGroup], randomTrackNames: new Map<string, string>(),
    selectedTrackId: "track1", favoriteTrackIds: new Set<string>(),
    getFavoriteCount: () => 0,
    onFavoriteChange: (id: string, favorite: boolean) => events.push(["favorite", id, favorite]),
    onConfirm: (selection: unknown) => events.push(["confirm", selection]),
    onCancel: () => events.push(["cancel"]),
    onError: (error: unknown) => events.push(["error", String(error)]),
    onInteraction: () => events.push(["interaction"]),
    onNotice: (rectangle: Rect, text: string, paint: (context: unknown) => void) => {
      events.push(["notice", rectangle, text]); paint({});
    },
  };
  return { assets, options, ops, layoutRect, layoutTree, getAttribute,
    paintText, paintFrame, noticeLayout, paintNotice, randomGroup };
}

async function exercise(readable: boolean) {
  const events: unknown[] = [];
  const previous = {
    document: globalThis.document, window: globalThis.window,
    ResizeObserver: globalThis.ResizeObserver,
  };
  const { assets, options, ops, layoutRect, layoutTree, getAttribute,
    paintText, paintFrame, noticeLayout, paintNotice } = fixture(events);
  globalThis.document = { createElement: (tag: string) => new Element(tag, events) } as unknown as Document;
  globalThis.window = {
    addEventListener: (name: string) => events.push(["window-add", name]),
    removeEventListener: (name: string) => events.push(["window-remove", name]),
  } as unknown as Window & typeof globalThis;
  globalThis.ResizeObserver = class {
    constructor(_callback: () => void) {}
    observe(_root: unknown) { events.push(["observe"]); }
    disconnect() { events.push(["disconnect"]); }
  } as unknown as typeof ResizeObserver;
  canvasContext = {
    imageSmoothingEnabled: true, fillStyle: "", strokeStyle: "", lineWidth: 0,
    clearRect: (...args: unknown[]) => events.push(["clear", ...args]),
    fillRect: (...args: unknown[]) => events.push(["fill", ...args]),
    strokeRect: (...args: unknown[]) => events.push(["stroke", ...args]),
    drawImage: (source: { label: string }, ...args: unknown[]) =>
      events.push(["image", source.label, ...args]),
  };
  try {
    const parseNumbers = (value: string, count: number, name: string) => {
      const values = value.trim().split(/\s+/);
      if (values.length !== count) throw new Error(`${name}=${value} 必须包含 ${count} 个数。`);
      return values.map(part => Math.fround(Number(part)));
    };
    const bindings = {
      Ai: 1600, bi: 900, zi: "P3528 Source Han Sans CN Track Select",
      mf: 22, Mc0: 6, jv: 48, Xv: 8,
      b6: ScrollbarController, WP: TouchPageSwipe,
      T: getAttribute, j2: parseNumbers,
      jc: layoutTree, V0: layoutRect,
      E9: ops.frameClient, C9: paintFrame,
      m9: paintText, ve: ops.measureText,
      p3: ops.configureCanvas, xe: ops.pixelRatio,
      aw: ops.positionControl,
      st: (id: string, hovered?: string, pressed?: string) =>
        hovered !== id ? 0 : pressed === id ? 2 : 1,
      Oe: (x: number, y: number, rect: Rect) =>
        x >= rect.x && x <= rect.x + rect.width &&
        y >= rect.y && y <= rect.y + rect.height,
      vl: gridLayoutConfig, Wv: gridPageSize,
      i4: gridStepSize, $P: gridLayout,
      Kv: (_context: unknown, scrollbar: { areaFrame: TrackPickerWindowFrame;
        buttonFrames: TrackPickerWindowFrame[] }, _image: unknown,
      geometry: { area: Rect; button: Rect }, state = 3) => {
        paintFrame(null, scrollbar.areaFrame, null, geometry.area);
        paintFrame(null, scrollbar.buttonFrames[state]!, null, geometry.button);
      },
      ct: (context: { drawImage: (...args: unknown[]) => void },
        sprite: TrackPickerWindowImage, rectangle: Rect) =>
        context.drawImage(sprite.image,
          rectangle.x + (rectangle.width - sprite.width) * 0.5,
          rectangle.y + (rectangle.height - sprite.height) * 0.5),
      HP: (_context: unknown, message: string) => [message],
      Wo: noticeLayout, qP: paintNotice,
      ac0: ops.loadAssets,
      G1: ops.releaseFont,
      pc0: (_library: unknown, path: string) => path,
      o4: async () => image("loadedCard"),
    };
    const Original = new Function("bindings", `with (bindings) {
      ${release.slice(classStart, classEnd)}
      ${release.slice(helperStart, helperEnd)}
      return _7;
    }`)(bindings) as any;
    const WindowClass = readable ? createTrackPickerWindowClass(ops) : Original;
    const originalRender = WindowClass.prototype.render;
    WindowClass.prototype.render = function () { events.push(["render"]); };
    try {
      const view = new WindowClass(options, assets);
      const constructor = {
        selectedTrackId: view.selectedTrackId,
        selectedTheme: view.selectedTheme,
        themeOffset: view.themeOffset, trackOffset: view.trackOffset,
        itemEnabled: view.itemEnabled, speedEnabled: view.speedEnabled,
        rects: [...view.windows.entries()].map(([entry, rect]: [TrackPickerWindowNode, Rect]) =>
          [getAttribute(entry, "name") ?? entry.name, rect]),
        element: { className: view.element.className, hidden: view.element.hidden,
          layer: view.element.dataset.uiLayer,
          children: (view.element as Element).children.map(child => child.tag) },
        canvas: { style: { ...view.canvas.style }, hidden: view.canvas.hidden,
          tabIndex: view.canvas.tabIndex, attributes: [...(view.canvas as Element).attributes],
          listeners: [...(view.canvas as Element).listeners.keys()] },
        search: { className: view.search.className, style: { ...view.search.style },
          maxLength: view.search.maxLength, placeholder: view.search.placeholder },
      };
      const constructorEvents = structuredClone(events);
      events.length = 0;
      view.show();
      const showEvents = structuredClone(events);
      events.length = 0;
      const cardRect = { x: 40, y: 60, width: 100, height: 80 };
      view.drawFavoriteButton();
      view.drawThemes();
      view.drawTrackCard(options.tracks[0], cardRect);
      const cards = structuredClone(events);
      events.length = 0;
      view.selectedTheme = "1024";
      view.drawRandomTracks();
      view.hovered = "random:random1";
      view.drawRandomDescription();
      const randomCards = structuredClone(events);
      events.length = 0;
      const randomGrid = view.randomTrackGrid(1);
      view.hits = [{ id: "track:track2", kind: "track", value: "track2",
        rect: { x: 0, y: 0, width: 100, height: 100 } }];
      const pointer = { pointerId: 3, pointerType: "mouse", button: 0,
        buttons: 1, clientX: 20, clientY: 20 };
      view.onPointerMove(pointer);
      view.onPointerDown(pointer);
      view.onPointerUp(pointer);
      view.onPointerLeave();
      view.onKeyDown({ key: "Escape", preventDefault: () => events.push(["prevent"]) });
      const input = {
        selectedTrackId: view.selectedTrackId,
        selectedRandomGroupId: view.selectedRandomGroupId,
        hovered: view.hovered, pressed: view.pressed,
        randomGrid, events: structuredClone(events),
      };
      events.length = 0;
      view.dispose();
      const disposeEvents = structuredClone(events);
      events.length = 0;
      const loaded = await WindowClass.load(options);
      const load = { theme: loaded.selectedTheme, events: structuredClone(events) };
      loaded.dispose();
      return { constructor, constructorEvents, showEvents, cards,
        randomCards, input, disposeEvents, load };
    } finally {
      WindowClass.prototype.render = originalRender;
    }
  } finally {
    globalThis.document = previous.document;
    globalThis.window = previous.window;
    globalThis.ResizeObserver = previous.ResizeObserver;
    canvasContext = undefined;
  }
}

test("whole track picker lifecycle, cards, random group and pointer behavior match release", async () => {
  const readable = await exercise(true);
  const packaged = await exercise(false);
  assert.deepEqual(readable, packaged);
});
