import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { createGarageSelectionViewClass } from "../src/ui/garage-selection-view.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const originalNode = parse(release, { sourceType: "module" }).program.body
  .find(node => node.type === "ClassDeclaration" && node.id.name === "C7");
assert.ok(originalNode);
const originalSource = release.slice(originalNode.start, originalNode.end);

function harness(rewritten) {
  const calls = [];
  class Element {
    constructor(tag) {
      this.tag = tag; this.style = {}; this.dataset = {}; this.listeners = [];
      this.children = []; this.hidden = false; this.value = ""; this.captures = new Set();
    }
    append(...elements) { this.children.push(...elements); }
    addEventListener(name, handler, options) { this.listeners.push({ name, handler, options }); }
    removeEventListener(name, handler) {
      const index = this.listeners.findIndex(item => item.name === name && item.handler === handler);
      if (index >= 0) this.listeners.splice(index, 1);
    }
    setAttribute(name, value) { (this.attributes ??= {})[name] = value; }
    getBoundingClientRect() { return { left: 100, top: 40, width: 800, height: 450 }; }
    focus() { calls.push(`${this.tag}:focus`); }
    blur() { calls.push(`${this.tag}:blur`); }
    remove() { this.removed = true; }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  class Drawing {
    constructor() {
      this.context = { clearRect: (...args) => calls.push(["clearRect", ...args]),
        fillRect: (...args) => calls.push(["fillRect", ...args]),
        drawImage: (...args) => calls.push(["drawImage", ...args]),
        imageSmoothingEnabled: false, fillStyle: "" };
    }
    beginFrame() { calls.push("beginFrame"); }
    endFrame() { calls.push("endFrame"); }
    dispose() { calls.push("drawing:dispose"); }
  }
  class Scrollbar {
    constructor(onOffset) { this.onOffset = onOffset; this.buttonState = 0; this.moves = []; }
    layout(...args) { calls.push(["scroll:layout", args[2], args[3]]); return { x: 1, y: 1 }; }
    wheel(direction) { calls.push(["scroll:wheel", direction]); return true; }
    down(point) { calls.push(["scroll:down", point]); return false; }
    move(point, held) { this.moves.push({ point, held }); }
    up() { calls.push("scroll:up"); }
    leave() { calls.push("scroll:leave"); }
    reset() { calls.push("scroll:reset"); }
    dispose() { calls.push("scroll:dispose"); }
  }
  class TouchSwipe {
    active = new Set();
    constructor(config, threshold, wheel) { this.config = config; this.threshold = threshold; this.wheel = wheel; }
    isActive(id) { return this.active.has(id); }
    begin(id) { this.active.add(id); }
    move(id, y) { calls.push(["swipe:move", id, y]); }
    finish(id) { this.active.delete(id); return false; }
  }
  const windows = new Map([
    ["charKartPreview", { x: 10, y: 10, width: 120, height: 100 }],
    ["itemSelect", { x: 200, y: 100, width: 300, height: 260 }],
    ["itemListBar", { x: 500, y: 100, width: 25, height: 260 }],
    ["itemList", { x: 200, y: 100, width: 300, height: 260 }],
    ["searchEdit", { x: 0, y: 0, width: 110, height: 25 }],
    ["searchBtn", { x: 10, y: 10, width: 45, height: 30 }],
    ["itemBox", { x: 190, y: 90, width: 350, height: 320 }],
    ["itemCatTabHolder", { x: 200, y: 91, width: 330, height: 30 }],
    ["itemSubCatHolder", { x: 200, y: 125, width: 330, height: 25 }],
    ["previewWindow", { x: 5, y: 5, width: 130, height: 120 }],
    ["captionDlgFrame", { x: 0, y: 0, width: 1600, height: 900 }],
    ["ok", { x: 10, y: 10, width: 80, height: 40 }],
    ["cancel", { x: 100, y: 10, width: 80, height: 40 }],
  ]);
  const window = { listeners: [],
    addEventListener(name, handler) { this.listeners.push({ name, handler }); },
    removeEventListener(name, handler) {
      const index = this.listeners.findIndex(item => item.name === name && item.handler === handler);
      if (index >= 0) this.listeners.splice(index, 1);
    } };
  class ResizeObserver {
    constructor(callback) { this.callback = callback; }
    observe() { calls.push("observer:observe"); }
    disconnect() { calls.push("observer:disconnect"); }
  }
  let frameId = 0;
  const requestAnimationFrame = () => ++frameId;
  const cancelAnimationFrame = id => calls.push(["cancelFrame", id]);
  const panel = { dispose: () => calls.push("panels:dispose"),
    resetPreviewRotation: () => calls.push("preview:reset"),
    rotatePreview: dx => calls.push(["preview:rotate", dx]) };
  const drawFrame = (...args) => calls.push(["drawFrame", args[1], args[3]]);
  const drawText = (...args) => calls.push(["drawText", args[1], args[2], args[3]]);
  const frameContent = (_frame, rect) => rect;
  const drawIcon = (...args) => calls.push(["drawIcon", args[1], args[2]]);
  const hoverState = (id, hovered, pressed) => id === pressed ? 2 : id === hovered ? 1 : 0;
  const pointInRect = (x, y, rect) => x >= rect.x && y >= rect.y &&
    x < rect.x + rect.width && y < rect.y + rect.height;
  const common = {
    document: { createElement: tag => new Element(tag) }, window, ResizeObserver,
    requestAnimationFrame, cancelAnimationFrame, performance: { now: () => 123 },
    CanvasDrawing: Drawing, Scrollbar, TouchSwipe,
    touchSwipeConfig: { type: "swipe" }, touchSwipeThreshold: 6,
    buildWindows: () => windows, gridStep: () => 20,
    draftProfile: () => ({ equipment: { itemIds: [0, 0, 0, 0], systemKart: "K", kartSerial: 0 }, garage: {} }),
    normalizeKartKey: () => undefined, kartAppearancePath: () => undefined,
    appearanceMatches: () => false, loadPanels: async () => panel,
    cardRect: (_definition, rect) => rect,
    validateKart: () => {}, validateCharacter: () => ({ itemId: 0 }),
    loadAssets: async () => assets,
    attribute: () => "20", child: (_definition, key) => ({ key }),
    drawFrame, drawText, frameContent, captionRect: frameContent,
    layoutRect: (_definition, rect) => rect, drawImage: (...args) => calls.push(["drawImage", args[1], args[2]]),
    drawCardImage: (...args) => calls.push(["drawCardImage", args[1], args[3]]),
    drawScrollbar: (...args) => calls.push(["drawScrollbar", args[1], args[3]]),
    spriteSourceX: () => 0, itemKey: item => String(item.itemId),
    hoverState, drawIcon, equipmentSlot: { kart: 3 },
    kartProgression: () => ({ progression: undefined }), engineFamily: () => undefined,
    engineLevelText: () => undefined, classicLevelText: () => undefined,
    drawLabel: (...args) => calls.push(["drawLabel", args[1], args[2]]),
    measureText: () => ({ width: 50 }), tooltipRect: (_definition, rect) => rect,
    noticeLayout: () => ({ window: { x: 1, y: 2 } }),
    drawNoticePanel: (...args) => calls.push(["drawNoticePanel", args[3], args[4]]),
    resizeCanvas: () => ({ scaleX: 2 }), pixelRatio: () => 1,
    itemGrid: (_grid, _list, _card, count) => ({ cells: [], firstItem: 0, positionCount: count }),
    positionInput: (...args) => calls.push(["positionInput", args[2], args[3]]),
    pointInRect, moveHover: (_previous, next) => next,
    playClick: options => calls.push(["click", !!options]),
  };
  const native = {
    document: common.document, window, ResizeObserver, requestAnimationFrame, cancelAnimationFrame,
    performance: common.performance,
    Ma0: Drawing, b6: Scrollbar, WP: TouchSwipe, jv: common.touchSwipeConfig,
    Xv: common.touchSwipeThreshold, sF: common.buildWindows, i4: common.gridStep,
    aT: common.draftProfile, of: common.normalizeKartKey,
    t80: common.kartAppearancePath, xw: common.appearanceMatches,
    E7: { load: common.loadPanels }, yl: common.cardRect,
    pT: common.validateKart, cf: common.validateCharacter, u80: common.loadAssets,
    T: common.attribute, Ae: common.child, C9: drawFrame, kn: drawText,
    E9: frameContent, f3: frameContent, V0: common.layoutRect, uf: common.drawImage,
    m80: common.drawCardImage, Kv: common.drawScrollbar, Ca0: common.spriteSourceX,
    sf: common.itemKey, st: hoverState, ct: drawIcon,
    p5: common.kartProgression, KP: common.engineFamily, Ka0: common.engineLevelText,
    ja0: common.classicLevelText, m9: common.drawLabel, ve: common.measureText,
    rF: common.tooltipRect, Wo: common.noticeLayout, qP: common.drawNoticePanel,
    p3: common.resizeCanvas, xe: common.pixelRatio, $P: common.itemGrid,
    aw: common.positionInput, Oe: pointInRect, Xa0: common.moveHover,
    Mc: common.playClick, jP: kind => !["item", "favorite", "appearance", "search", "appearanceCancel"].includes(kind),
    Bn: 1600, Rn: 900, Nn: "P3528 Source Han Sans CN Garage",
    Ya0: common.equipmentSlot,
    e80: [{ key: "favoriteItem", category: "favorite" }, { key: "lockedItem" }, { key: "pcCafe" },
      { key: "kartBody", category: "kart" }, { key: "character", category: "character" },
      { key: "equip", category: "equip" }, { key: "useful" }, { key: "deco", category: "deco" }],
  };
  const Original = new Function("deps", `with (deps) { ${originalSource}; return C7; }`)(native);
  const Rewritten = createGarageSelectionViewClass(common);
  const root = new Element("root");
  const options = { root, profile: {}, selectedKartItemId: 1, selectedCharacterItemId: 2,
    selectedKartSystemKey: "K", selectedKartPath: "kart", catalog: { karts: [], characters: [] },
    onNotice: (...args) => calls.push(["notice", args[1]]), onInteraction: () => calls.push("interaction"),
    onActivate: () => {}, onHover: () => {}, onCancel: () => calls.push("cancel"),
    library: {}, environment: {}, stageBinding: {} };
  const strings = new Map([["itemTitle", "Items"], ["searchTooltip", "Find"],
    ["cancel", "Cancel"], ["ok", "OK"], ["favoriteItemNone", "Empty"], ["notice", "Notice"]]);
  for (const key of ["favoriteItem", "lockedItem", "pcCafe", "kartBody", "character", "equip", "useful", "deco", "whole"])
    strings.set(key, key);
  const buttonStyle = { states: Array.from({ length: 4 }, (_, index) =>
    ({ frame: `button-${index}`, textRender: "16", textColor: "white" })) };
  const assets = { definition: {}, frames: new Map([
    ["BigCaptionDialog", "big-caption"], ["CaptionDialog", "caption"],
    ["TabBoxLarge", "tab-box"], ["DefaultTooltipNew", "tooltip"]]),
    strings, grid: {}, cardDefinition: {}, caption: { image: "caption-image" },
    captionOffset: {}, frame01: { image: "frame-01" }, frame02: { image: "frame-02" },
    buttonStyles: new Map([["ok", buttonStyle], ["cancel", buttonStyle]]),
    buttonFrame: { image: "button-image" },
    previewBackground: "preview-bg", previewFrame: "preview-frame",
    tabDefinition: {}, subTabDefinition: {},
    tabStyle: { states: Array.from({ length: 4 }, (_, index) =>
      ({ frame: `tab-${index}`, textRender: "16", textColor: "white" })) },
    subTabStyle: { states: Array.from({ length: 4 }, (_, index) =>
      ({ frame: `subtab-${index}`, textRender: "16", textColor: "white" })) },
    card: "card", selectedCard: "selected-card", selectedFrame: "selected-frame",
    qualityCards: new Map(), favoriteMark: ["favorite-off", "favorite-on"],
    scrollbar: {},
    search: ["search-0", "search-1", "search-2", "search-3"],
    searchTooltipFrame: { image: "tip-frame" },
    closeDefinition: {}, close: ["close-0", "close-1", "close-2"],
    noticeDefinition: {}, noticeIcon: { image: "icon" }, noticeCaptionOffset: {},
  };
  const instance = new (rewritten ? Rewritten : Original)(options, assets);
  return { instance, calls, root, window, assets, options, ViewClass: rewritten ? Rewritten : Original };
}

function snapshot(view, harness) {
  return {
    shown: view.shown, disposed: view.disposed, frozen: view.frozen,
    animationFrame: view.animationFrame, category: view.category, subCategory: view.subCategory,
    offset: view.offset, hovered: view.hovered, pressed: view.pressed,
    searchQuery: view.searchQuery, searchState: view.searchState,
    searchTooltipVisible: view.searchTooltipVisible, previewPointer: view.previewPointer,
    scrollPointer: view.scrollPointer, renderPixelRatio: view.renderPixelRatio,
    element: { className: view.element.className, hidden: view.element.hidden,
      dataset: { ...view.element.dataset }, removed: view.element.removed,
      children: view.element.children.map(child => child.tag) },
    canvas: { hidden: view.canvas.hidden, tabIndex: view.canvas.tabIndex,
      attributes: view.canvas.attributes, listeners: view.canvas.listeners.map(item => item.name),
      captures: [...view.canvas.captures], removed: view.canvas.removed },
    search: { hidden: view.search.hidden, maxLength: view.search.maxLength,
      autocomplete: view.search.autocomplete, spellcheck: view.search.spellcheck,
      value: view.search.value, listeners: view.search.listeners.map(item => item.name),
      removed: view.search.removed },
    windowListeners: harness.window.listeners.map(item => item.name),
    rootChildren: harness.root.children.map(child => child.tag),
    hits: view.hits.map(hit => ({ ...hit })),
    calls: structuredClone(harness.calls),
  };
}

test("garage selector construction and lifecycle match release", () => {
  const expected = harness(false);
  const actual = harness(true);
  assert.deepEqual(snapshot(actual.instance, actual), snapshot(expected.instance, expected), "constructor");
  for (const h of [expected, actual]) {
    h.instance.render = () => h.calls.push("render");
    h.instance.showEmptyFavoriteNotice = () => h.calls.push("empty-favorite");
  }
  for (const method of ["show", "freeze", "unfreeze", "dispose", "dispose"]) {
    expected.instance[method](); actual.instance[method]();
    assert.deepEqual(snapshot(actual.instance, actual), snapshot(expected.instance, expected), method);
  }
});

test("garage selector search, hit testing, pointers and keyboard match release", () => {
  const expected = harness(false);
  const actual = harness(true);
  for (const h of [expected, actual]) {
    h.instance.render = () => h.calls.push("render");
    h.instance.activate = hit => h.calls.push(["activate", hit.id]);
    h.instance.selectItem = item => h.calls.push(["selectItem", item.itemId]);
    h.instance.livePanels = { resetPreviewRotation: () => h.calls.push("preview:reset"),
      rotatePreview: dx => h.calls.push(["preview:rotate", dx]) };
    h.instance.hits = [
      { id: "item:7", kind: "item", value: { itemId: 7 }, rect: { x: 20, y: 20, width: 100, height: 100 } },
      { id: "confirm", kind: "confirm", rect: { x: 300, y: 500, width: 80, height: 40 } },
    ];
  }
  const apply = (name, ...args) => {
    expected.instance[name](...args); actual.instance[name](...args);
    assert.deepEqual(snapshot(actual.instance, actual), snapshot(expected.instance, expected), name);
  };
  apply("moveSearchButton", "search");
  apply("pressSearchButton", { kind: "search" });
  apply("activateSearch");
  expected.instance.search.value = "xun"; actual.instance.search.value = "xun";
  apply("commitSearch");
  apply("toggleSearchFocus");
  apply("clearSearch");
  apply("onSearchPointerDown", { button: 0 });
  apply("onSearchPointerMove");
  apply("onSearchPointerLeave");
  apply("onSearchKeyDown", { key: "Enter", isComposing: false, preventDefault() {} });
  apply("onKeyDown", { key: "F1", preventDefault() {} });
  apply("onKeyDown", { key: "F5", preventDefault() {} });
  apply("onKeyDown", { key: "Escape", preventDefault() {} });
  apply("onPointerDown", { button: 0, pointerId: 5, pointerType: "mouse", clientX: 110, clientY: 50 });
  apply("onPointerUp", { button: 0, pointerId: 5, pointerType: "mouse", clientX: 110, clientY: 50 });
  apply("onPointerMove", { buttons: 0, pointerId: 9, pointerType: "mouse", clientX: 260, clientY: 310 });
  apply("onPointerLeave");
  apply("onWheel", { deltaY: 1, clientX: 210, clientY: 140, preventDefault() {} });
  apply("onPointerCancel", { pointerId: 11, clientX: 210, clientY: 140 });
});

test("garage selector drawing helpers and layout match release", () => {
  const expected = harness(false);
  const actual = harness(true);
  for (const h of [expected, actual]) {
    h.instance.appearanceDialog = { family: { title: "Kart", states: [
      { level: "rookie" }, { level: "l3" }, { level: "l2" }, { level: "l1" }] } };
  }
  const apply = (name, ...args) => {
    const before = expected.instance[name](...args);
    const after = actual.instance[name](...args);
    assert.deepEqual(after, before, `${name} result`);
    assert.deepEqual(snapshot(actual.instance, actual), snapshot(expected.instance, expected), name);
  };
  apply("text", "legacyMuseum");
  apply("text", "itemTitle");
  apply("rect", "ok");
  apply("resizeCanvas");
  apply("positionSearch");
  apply("drawTextButton", "confirm", "OK", { x: 1, y: 2, width: 80, height: 40 });
  apply("drawAppearanceDialog");
  apply("drawSearch");
  apply("drawCloseButton");
  apply("drawButtons");
  apply("hitAt", { clientX: 105, clientY: 45 });
});

test("garage selector full frame rendering matches release", () => {
  const expected = harness(false);
  const actual = harness(true);
  for (const h of [expected, actual]) {
    const view = h.instance;
    const item = { itemId: 7, kind: "kart", title: "Sample Kart", engineGrade: 0 };
    view.filteredItems = () => [item];
    view.selectedKart = () => item;
    view.subTabs = () => [{ key: "whole", value: "whole" }];
    view.favoriteKey = () => undefined;
    view.itemGrid = () => ({ cells: [{ x: 200, y: 160, width: 80, height: 90 }],
      firstItem: 0, positionCount: 2 });
    view.livePanels = { render: (...args) => h.calls.push(["panel:render", args[0], args[1], args[2]]),
      drawPreview: (_context, rect) => h.calls.push(["panel:preview", rect]),
      drawCard: (_context, candidate, rect) => h.calls.push(["panel:card", candidate.itemId, rect]) };
    view.shown = true;
  }
  expected.instance.render();
  actual.instance.render();
  assert.deepEqual(snapshot(actual.instance, actual), snapshot(expected.instance, expected));
});

test("garage selector static asset loading constructs the same view", async () => {
  const expected = harness(false);
  const actual = harness(true);
  const originalView = await expected.ViewClass.load(expected.options);
  const rewrittenView = await actual.ViewClass.load(actual.options);
  assert.deepEqual(snapshot(rewrittenView, actual), snapshot(originalView, expected));
});
