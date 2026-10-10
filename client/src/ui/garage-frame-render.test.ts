import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

import {
  renderGarageFrame, type GarageFrameRenderDependencies,
  type GarageFrameRenderHost,
} from "./garage-frame-render";

const release = readFileSync(
  new URL("../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url),
  "utf8",
);
const view = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id?.name === "As");
assert.ok(view && view.type === "ClassDeclaration");
const frame = view.body.body.find(node => node.type === "ClassProperty" &&
  node.key.type === "Identifier" && node.key.name === "frame");
assert.ok(frame);
const originalFrame = release.slice(frame.start!, frame.end!);

function fixture(released: boolean, variant: "parts" | "factory" | "level-empty" |
  "no-character" | "no-panels" | "upgrade" | "preparation") {
  const events: unknown[] = [];
  let clock = 100;
  const now = () => { events.push("now"); return clock++; };
  const requestFrame = (_callback: () => void) => { events.push("request-frame"); return 17; };
  const layoutForGrade = (grade: number) => {
    events.push(["layout", grade]); return { kind: grade === 9 ? "xun" : "classic" };
  };
  const backgroundForPage = (page: string, layout: { kind: string }) => {
    events.push(["background-key", page, layout.kind]); return "page_1600";
  };
  const nativePageName = (page: string, xun: boolean) => {
    events.push(["native-page", page, xun]); return `${page}:${xun}`;
  };
  const nativeFramePlan = (_definition: unknown, name: string) => {
    events.push(["plan", name]);
    return { beforePreview: ["partsListBoard", "selectedKartType", "before"],
      afterPreview: ["after"] };
  };
  const attribute = (node: unknown, name: string) =>
    (node as { attrs?: Record<string, string> } | undefined)?.attrs?.[name];
  const kartTypeTexture = (type: number) => { events.push(["type-token", type]); return "type"; };
  const drawScrollbar = (_context: unknown, _scrollbar: unknown, image: unknown,
    geometry: unknown) => { events.push(["scrollbar", (image as { name: string }).name, geometry]); };
  const composeEquipment = (_profile: unknown, kartId: number, characterId: number) => {
    events.push(["compose", kartId, characterId]); return { kartId, characterId };
  };
  const currentConfiguration = (_configuration: unknown, itemId: number, serial: number) => {
    events.push(["current", itemId, serial]); return { cosmetics: { coating: 2 } };
  };
  const writeConfiguration = (_configuration: unknown, itemId: number, serial: number,
    value: { cosmetics: Record<string, unknown> }) => {
    events.push(["write", itemId, serial, value]); return { edited: value };
  };
  const dependencies: GarageFrameRenderDependencies = {
    requestFrame, now, layoutForGrade, backgroundForPage, nativePageName,
    nativeFramePlan, attribute, kartTypeTexture, drawScrollbar,
    composeEquipment, currentConfiguration, writeConfiguration,
  };
  const Original = new Function("requestAnimationFrame", "performance", "ue", "Nn",
    "An", "Ln", "y", "In", "yi", "ot", "K", "ie",
    `return class Original { ${originalFrame} };`)(
      requestFrame, { now }, layoutForGrade, backgroundForPage, nativeFramePlan,
      nativePageName, attribute, kartTypeTexture, drawScrollbar, composeEquipment,
      currentConfiguration, writeConfiguration,
    ) as new () => GarageFrameRenderHost;
  const host = new Original();
  const rect = { x: 10, y: 20, width: 300, height: 200 };
  const image = (name: string) => ({ name }) as unknown as CanvasImageSource;
  const context = {
    fillStyle: "",
    fillRect: (...args: unknown[]) => { events.push(["fill", ...args]); },
    drawImage: (texture: unknown, ...args: unknown[]) => {
      events.push(["image", (texture as { name: string }).name, ...args]);
    },
  } as unknown as CanvasRenderingContext2D;
  const selected = { itemId: 7, engineGrade: 0, kartType: 3 };
  host.shown = true;
  host.disposed = false;
  host.frozen = false;
  host.raf = 0;
  host.renderPixelRatio = 1.5;
  host.strengtheningSnapshot = { name: "snapshot" } as unknown as HTMLCanvasElement;
  host.drawing = { beginFrame: () => { events.push("begin-frame"); },
    drawCanvasLayer: (_canvas, bounds, revision) => {
      events.push(["layer", bounds, revision]);
    } };
  host.context = context;
  host.assets = { stage: { width: 1024, height: 768 },
    nodes: new Map([
      ["backGround_1920", { attrs: { image: "background" } }],
      ["partsListBoard", { attrs: { image: "parts" } }],
      ["selectedKartType", { attrs: { texture: "other" } }],
      ["before", { attrs: { image: "before" } }],
      ["after", { attrs: { texture: "after" } }],
    ]),
    textures: new Map(["background", "page_1024", "parts", "type", "before",
      "after", "comparison", "scroll"].map(key => [key, image(key)])),
    rects: new Map([["backGround_1920", rect]]),
    definition: {}, partScrollbar: { areaFrame: { texture: "scroll" } } };
  host.pageMode = variant === "factory" ? "factory" :
    variant === "level-empty" ? "level" : "parts";
  host.selected = selected;
  host.progressionPanel = { draw: () => { events.push("progression-draw"); } };
  host.factoryPanel = { draw: () => { events.push("factory-draw"); },
    drawCatalogFrame: (_context, index, selectedCard, hovered) => {
      events.push(["factory-card-frame", index, selectedCard, hovered]);
    }, model: { source: { path: "model" }, context }, modelReady: false };
  host.transformPreviewUiHidden = false;
  host.comparisons = [{ token: "comparison", rect }];
  host.upgradeCatalogEmpty = variant === "level-empty";
  host.options = { catalog: { characters: variant === "no-character" ? [] :
    [{ itemId: 15 }] }, selectedCharacterItemId: 15, profile: {} };
  host.visibleCards = [
    { item: selected, rect, isHovered: () => { events.push("hover-first"); return true; } },
    { item: { itemId: 8, engineGrade: 9, kartType: 4 }, rect,
      isHovered: () => { events.push("hover-second"); return false; } },
  ];
  host.configuration = { garage: "original" };
  host.cosmeticPreview = { family: "classic", slot: "tailLamp", id: 6 };
  host.coatingPreview = "paint";
  host.coatingMode = true;
  host.inventoryScroll = { geometry: () => { events.push("geometry"); return "thumb"; } };
  host.status = { textContent: "" } as HTMLElement;
  host.controls = { querySelector: (selector: string) => {
    events.push(["query", selector]);
    return { setAttribute: (name: string, value: string) => {
      events.push(["attribute", name, value]);
    } };
  } } as unknown as HTMLElement;
  host.modelCache = { get: source => { events.push(["model", source.path]); return "loaded-model"; } };
  host.pointEffects = { render: time => { events.push(["effects", time]); } };
  host.serial = () => 42;
  host.rect = name => { events.push(["rect", name]); return rect; };
  host.nativeFactoryAllowed = () => { events.push("factory-allowed"); return false; };
  host.activePreviewRect = () => { events.push("preview-rect"); return rect; };
  host.drawKartCatalogFrame = (_context, _rect, selectedCard, hovered) => {
    events.push(["catalog-frame", selectedCard, hovered]);
  };
  host.drawKartLevelBadge = (_context, kart) => { events.push(["badge", kart.itemId]); };
  host.captureStrengtheningStage = () => { events.push("capture-strengthening"); };
  host.renderStrengtheningOverlay = time => { events.push(["strengthening", time]); };
  host.finishCanvasFrame = frozen => { events.push(["finish", frozen ?? false]); };
  host.flushTransformPreviewStart = () => { events.push("flush-preview"); };
  host.transformPreviewSessionActive = () => { events.push("preview-active"); return true; };
  host.syncTransformPreviewUi = () => { events.push("sync-preview"); };
  host.syncCosmeticPreviewActions = () => { events.push("sync-cosmetic"); };
  host.renderPartModels = () => { events.push("part-models"); };
  host.panels = variant === "no-panels" ? undefined : {
    coatingPreviewError: "Preview unavailable",
    setPreviewSize: (width, height, owner) => {
      events.push(["preview-size", width, height, owner]);
    },
    render: (time, width, height, cards, bounds, kart, character, equipment,
      coating, live, ratio) => {
      events.push(["render", time, width, height, cards.map(card => card.item.itemId),
        bounds, kart?.itemId, character.itemId, equipment, coating, live, ratio]);
    },
    drawPreview: (_context, bounds) => { events.push(["draw-preview", bounds]); },
    drawCard: (_context, kart) => { events.push(["draw-card", kart.itemId]); },
    drawAuxiliaryPanel: (model, contexts) => {
      events.push(["auxiliary", model, contexts.length]);
    },
  };
  if (variant === "upgrade") host.upgrade = {
    capturePreview: () => { events.push("capture-preview"); },
    render: () => { events.push("upgrade-render"); },
  };
  if (variant === "preparation") host.preparation = {
    cards: [], draw: () => { events.push("preparation-draw"); },
  };
  if (!released) host.frame = () => renderGarageFrame(host, dependencies);
  const snapshot = () => ({ events: structuredClone(events), raf: host.raf,
    snapshot: host.strengtheningSnapshot, status: host.status.textContent,
    modelReady: host.factoryPanel?.modelReady });
  return { host, snapshot };
}

test("Garage frame guards and strengthening takeover match As", () => {
  for (const variant of ["upgrade", "preparation"] as const) {
    const run = (released: boolean) => {
      const f = fixture(released, variant);
      f.host.frame();
      return f.snapshot();
    };
    assert.deepEqual(run(false), run(true), variant);
  }
  const runGuard = (released: boolean) => {
    const f = fixture(released, "parts");
    f.host.shown = false; f.host.frame();
    f.host.shown = true; f.host.disposed = true; f.host.frame();
    f.host.disposed = false; f.host.frozen = true; f.host.frame();
    return f.snapshot();
  };
  assert.deepEqual(runGuard(false), runGuard(true));
});

test("parts, Factory and early exit render order match As", () => {
  for (const variant of ["parts", "factory", "level-empty",
    "no-character", "no-panels"] as const) {
    const run = (released: boolean) => {
      const f = fixture(released, variant);
      f.host.frame();
      return f.snapshot();
    };
    assert.deepEqual(run(false), run(true), variant);
  }
});
