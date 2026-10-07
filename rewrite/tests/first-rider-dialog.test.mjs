import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { FirstRiderDialog } from "../src/timeattack/first-rider-dialog.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = nodes.find(item => item.id?.name === name &&
    ["ClassDeclaration", "FunctionDeclaration"].includes(item.type));
  assert.ok(node);
  return release.slice(node.start, node.end);
};

async function scenario(readable) {
  const events = [];
  let nextId = 0;
  class Element {
    constructor(name) { this.name = name; this.id = ++nextId; events.push(["create", name]); }
    style = {};
    attrs = {};
    hidden = false;
    value = "";
    addEventListener(name) { events.push(["listen", this.id, name]); }
    removeEventListener(name) { events.push(["unlisten", this.id, name]); }
    setAttribute(name, value) { this.attrs[name] = value; }
    append(...children) { events.push(["append", this.id, ...children.map(item => item.id)]); }
    getContext() { return { imageSmoothingEnabled: false }; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1600, height: 900 }; }
    focus() { events.push(["focus", this.id]); }
    blur() { events.push(["blur", this.id]); }
    remove() { events.push(["remove", this.id]); }
    matches() { return false; }
  }
  const globals = ["document", "window"];
  const previous = Object.fromEntries(globals.map(name =>
    [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  Object.defineProperty(globalThis, "document", {
    configurable: true, value: { createElement: name => new Element(name) },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: {
      addEventListener: name => events.push(["window add", name]),
      removeEventListener: name => events.push(["window remove", name]),
    },
  });
  try {
    const root = new Element("root");
    const blueprint = {
      itemWhitelist: { characters: [101, 102], dyes: [202], paints: [303] },
      texts: { caption: "注册", inputPrompt: "名称" },
      maxChar: 12,
    };
    const catalog = {
      characters: [
        { itemId: 101, title: "A" },
        { itemId: 102, title: "B" },
      ],
      dyes: [{ itemId: 202, title: "D" }],
      paints: [{ itemId: 303, title: "P" }],
      defaults: { character: 999, dye: 202, paint: 303 },
    };
    const raf = callback => { events.push(["raf"]); return 42; };
    const cancel = id => events.push(["cancel", id]);
    const contains = (x, y, rect) => x >= rect.x && y >= rect.y &&
      x <= rect.x + rect.width && y <= rect.y + rect.height;
    const Original = new Function("Gd0", "Y_", "Py", "xe", "Oe", "H3",
      "q3", "gs", "$t", "requestAnimationFrame", "cancelAnimationFrame",
      `${sourceOf("Fy")}; return Fy;`)(
        new Function(`${sourceOf("Gd0")}; return Gd0;`)(),
        () => ({ preview: { width: 100, height: 100 } }),
        { create: () => undefined }, () => 1, contains, 1600, 900, 8,
        "P3528 Source Han Sans CN Ready", raf, cancel);
    const dependencies = {
      pixelRatio: () => 1,
      requestFrame: raf, cancelFrame: cancel, now: () => 100,
      contains,
    };
    const view = readable
      ? new FirstRiderDialog(root, blueprint, new Map(), catalog,
        undefined, dependencies)
      : new Original(root, blueprint, new Map(), catalog, undefined);
    view.paint = () => events.push(["paint"]);
    const initial = {
      picked: [...view.picked],
      choices: view.choices,
      element: {
        className: view.element.className,
        hidden: view.element.hidden,
        attrs: view.element.attrs,
      },
      input: {
        type: view.input.type, className: view.input.className,
        maxLength: view.input.maxLength, style: view.input.style,
        attrs: view.input.attrs,
      },
    };
    const pending = view.open();
    assert.equal(view.open(), pending);
    view.input.value = "  Alice  ";
    view.submitStep1();
    view.settle();
    const registration = await pending;
    const nextPending = view.open();
    view.cellHits = [
      { section: 0, rect: { x: 0, y: 0, width: 100, height: 100 },
        choice: { itemId: 102, title: "B" } },
      { section: 0, rect: { x: 200, y: 0, width: 100, height: 100 },
        forward: true },
    ];
    view.onCanvasPointerMove({ clientX: 50, clientY: 50 });
    view.onCanvasPointerDown({ clientX: 50, clientY: 50 });
    view.onCanvasPointerDown({ clientX: 250, clientY: 50 });
    view.onCanvasPointerLeave();
    view.dispose();
    view.dispose();
    const state = {
      picked: [...view.picked], pages: [...view.pages],
      step: view.step, name: view.name, isOpen: view.isOpen,
      disposed: view.disposed,
      pending: view.pending === nextPending,
      hoveredCell: view.hoveredCell,
    };
    return { events, initial, registration, state };
  } finally {
    for (const name of globals) {
      if (previous[name]) Object.defineProperty(globalThis, name, previous[name]);
      else delete globalThis[name];
    }
  }
}

test("first-rider dialog creation, registration, selection and disposal match release", async () => {
  assert.deepEqual(await scenario(true), await scenario(false));
});

function paintScenario(readable) {
  const events = [];
  const makeNode = (name, attrs = {}, children = []) =>
    ({ name, attrs, children });
  const attr = (item, key) => item.attrs[key];
  const named = (name, children = [], attrs = {}) =>
    makeNode(name, attrs, children);
  const containers = ["characterCont", "dyeCont", "colorCont"].map(
    (name, index) => makeNode("Container", { name }, [
      makeNode("Label"), makeNode("Panel", { name: "iconPanel" }),
      makeNode("Grid", { name: `${name}List` }),
    ]));
  const itemSelect = makeNode("ItemSelect", {}, containers);
  const frame = texture => ({ texture });
  const frames = new Map([
    ["CaptionDialog", new Map([["Activated", frame("caption")]])],
    ["DefaultEdit", new Map([["Activated", frame("edit")]])],
    ["DefaultFocusedButton", new Map([
      ["Normal", frame("button-normal")],
      ["MouseOn", frame("button-hover")],
      ["Clicked", frame("button-clicked")],
    ])],
    ["DefaultScrollUpButton", new Map([["Normal", frame("up")]])],
    ["DefaultScrollDownButton", new Map([["Normal", frame("down")]])],
  ]);
  const blueprint = {
    dialog: makeNode("CaptionWindow", { frame: "CaptionDialog" }),
    bg: named("Bg"), step1: named("Step1"), step2: named("Step2"),
    descPlane: named("Description"), infoIcon: named("Info"),
    warningTitle: named("Warning"),
    warningDetailBoxes: [named("Box", [named("Label")])],
    itemSelect, sectionLabels: containers.map(() => named("Label")),
    sectionIcons: containers.map(() => named("Panel")),
    grids: containers.map(() => named("Grid")),
    nameBox: named("NameBox"), inputPrompt: named("InputPrompt"),
    edit: makeNode("Edit", { frame: "DefaultEdit" }),
    step1ButtonBox: named("ButtonBox"),
    step1Button: makeNode("Button", { frame: "DefaultFocusedButton" }),
    step2Intro: named("Step2Intro"), traineeLabel: named("Trainee"),
    riderIdLabel: named("RiderId"),
    step2ButtonBox: named("ButtonBox"),
    step2Button: makeNode("Button", { frame: "DefaultFocusedButton" }),
    previewPanel: named("RenderPanel"), config: named("Config"),
    frames, maxChar: 12,
    itemWhitelist: {
      characters: Array.from({ length: 9 }, (_, index) => index + 1),
      dyes: [20], paints: [30],
    },
    texts: {
      caption: "注册", warningTitle: "提示", warningDetails: ["内容"],
      inputPrompt: "输入姓名", nextStep: "下一步", trainee: "新手",
      sectionLabels: ["人物", "染色", "涂装"],
    },
  };
  const rect = (item, parent, frameState) => ({
    x: parent.x + item.name.length,
    y: parent.y + (frameState ? 3 : 1),
    width: 50 + item.name.length,
    height: 20 + item.children.length,
  });
  const inset = (frameState, bounds) => ({
    ...bounds, x: bounds.x + 1,
  });
  const captionRect = (frameState, bounds, offset) => ({
    ...bounds, y: bounds.y + offset,
  });
  const captionOffset = () => 2;
  const OriginalLayout = new Function("T", "V0", "E9", "f3", "an", "H3", "q3",
    `${sourceOf("n1")}\n${sourceOf("U5")}\n${sourceOf("Y_")}; return Y_;`)(
      attr, rect, inset, captionRect, captionOffset, 1600, 900);
  const images = new Map([
    ["stage_/newRider/createCharacter_bg.png", "background"],
    ["stage_/newRider/createCha_infoIcon.png", "info"],
    ...[1, 2, 3].map(index =>
      [`stage_/newRider/createCharacter_icon_${index}.png`, `icon-${index}`]),
    ...["caption", "edit", "button-normal", "up", "down"].map(
      name => [`gui_/monocoque/${name}.png`, name]),
  ]);
  const context = {
    clearRect: (...args) => events.push(["clear", ...args]),
    drawImage: (...args) => events.push(["image", ...args]),
    imageSmoothingEnabled: false,
  };
  let elementId = 0;
  class Element {
    constructor(name) { this.name = name; this.id = ++elementId; }
    style = {};
    attrs = {};
    setAttribute(name, value) { this.attrs[name] = value; }
    addEventListener() {}
    append() {}
    getContext() { return context; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 1600, height: 900 }; }
    matches() { return false; }
  }
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "document", {
    configurable: true, value: { createElement: name => new Element(name) },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true, value: { addEventListener() {} },
  });
  try {
    const drawFrame = (_context, frameState, image, bounds) =>
      events.push(["frame", frameState.texture, image, bounds]);
    const drawText = (_context, value, bounds, options) =>
      events.push(["text", value, bounds, options]);
    const resize = (_canvas, _context, ...args) =>
      events.push(["resize", ...args]);
    const positionInput = (_input, bounds, scaleX, scaleY) =>
      events.push(["input", bounds, scaleX, scaleY]);
    const dependencies = {
      attribute: attr, windowRect: rect, frameInset: inset,
      captionRect, captionOffset,
      pixelRatio: () => 1.5,
      resizeCanvas: resize, drawFrame, drawText, positionInput,
      now: () => 100,
    };
    const Original = new Function("Y_", "xe", "p3", "T", "U5", "C9",
      "m9", "UD", "$D", "WD", "$t", "aw", "E9", "Ed0", "H3", "q3",
      "mm", "gs", `${sourceOf("Fy")}; return Fy;`)(
        OriginalLayout, dependencies.pixelRatio, resize, attr,
        (source, name, state) => source.frames.get(name).get(state),
        drawFrame, drawText,
        "stage_/newRider/createCharacter_bg.png",
        "stage_/newRider/createCha_infoIcon.png",
        [1, 2, 3].map(index =>
          `stage_/newRider/createCharacter_icon_${index}.png`),
        "P3528 Source Han Sans CN Ready", positionInput, inset,
        "确定", 1600, 900, 4, 8);
    const catalog = {
      characters: Array.from({ length: 9 }, (_, index) =>
        ({ itemId: index + 1, title: `角色${index + 1}` })),
      paints: [{ itemId: 30, title: "涂装" }],
      dyes: [{ itemId: 20, title: "染色" }],
      defaults: { character: 1, paint: 30, dye: 20 },
    };
    const root = new Element("root");
    const view = readable
      ? new FirstRiderDialog(root, blueprint, images, catalog,
        undefined, dependencies)
      : new Original(root, blueprint, images, catalog, undefined);
    view.isOpen_ = true;
    view.paint(100);
    view.step = 2;
    view.name = "Alice";
    view.paint(200);
    return {
      events,
      hits: view.cellHits.map(hit => ({
        section: hit.section, rect: hit.rect,
        choice: hit.choice?.itemId, forward: hit.forward,
      })),
      pages: view.pages,
      step1Style: view.step1Button.style,
      step2Style: view.step2Button.style,
      inputHidden: view.input.hidden,
    };
  } finally {
    if (previousDocument)
      Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
  }
}

test("first-rider two-step canvas rendering and hit layout match release", () => {
  assert.deepEqual(paintScenario(true), paintScenario(false));
});
