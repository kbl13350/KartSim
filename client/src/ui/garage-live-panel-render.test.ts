import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  copyGaragePanel, disposeGarageLivePanels, drawGarageAuxiliaryPanel,
  drawGarageCard, drawGaragePreview, renderGarageCharacterCard,
  renderGarageEquipmentCard, renderGarageKartCard, renderGarageKartSnapshot,
  renderGarageLivePanels, renderGaragePreview, renderGaragePreviewSnapshot,
  setGaragePanelViewport, submitGaragePanelScene,
  type GarageLivePanelRenderDependencies, type GarageLivePanelRenderHost,
  type GaragePanelRectangle, type GaragePanelRenderer,
} from "./garage-live-panel-render";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class E7 {");
const end = release.indexOf("\nfunction xc(", start);
assert.ok(start >= 0 && end > start);

function exercise(readable: boolean) {
  const events: unknown[] = [];
  const rect: GaragePanelRectangle = { x: 10, y: 20, width: 100, height: 80 };
  const character = { kind: "character", itemId: 1 };
  const kart = { kind: "kart", itemId: 2 };
  const equipment = { kind: "balloon", itemId: 3, category: "decoration" };
  class Camera {
    constructor(readonly name: string) {}
    clone() { events.push(["camera-clone", this.name]); return new Camera(this.name); }
  }
  const canvas = { width: 320, height: 240 } as HTMLCanvasElement;
  let rendererRatio = 2;
  const renderer = {
    domElement: canvas, outputColorSpace: "", autoClear: true,
    setClearColor: (...args: unknown[]) => events.push(["clear-color", ...args]),
    setPixelRatio: (ratio: number) => { rendererRatio = ratio; events.push(["ratio", ratio]); },
    getPixelRatio: () => rendererRatio,
    setSize: (width: number, height: number, updateStyle: boolean) => {
      canvas.width = width; canvas.height = height;
      events.push(["size", width, height, updateStyle]);
    },
    setScissorTest: (enabled: boolean) => events.push(["scissor-test", enabled]),
    setViewport: (...args: unknown[]) => events.push(["viewport", ...args]),
    setScissor: (...args: unknown[]) => events.push(["scissor", ...args]),
    clear: (...args: unknown[]) => events.push(["clear", ...args]),
    dispose: () => events.push(["renderer-dispose"]),
  };
  function context(width: number, height: number, bounds = { width, height }) {
    const drawingCanvas = { width, height, getBoundingClientRect: () => bounds };
    return {
      canvas: drawingCanvas,
      drawImage: (_image: unknown, ...args: unknown[]) => events.push(["image", ...args]),
      save: () => events.push(["save"]),
      setTransform: (...args: unknown[]) => events.push(["transform", ...args]),
      clearRect: (...args: unknown[]) => events.push(["clear-rect", ...args]),
      restore: () => events.push(["restore"]),
    } as unknown as CanvasRenderingContext2D;
  }
  const surface = context(320, 240);
  const directContext = context(320, 240);
  const target = { context: directContext,
    drawModel: (rectangle: GaragePanelRectangle, draw: (targetRenderer: GaragePanelRenderer) => void) => {
      events.push(["direct-model", rectangle]); draw(renderer);
    } };
  const deps: GarageLivePanelRenderDependencies = {
    kartKey: item => `kart:${item.itemId}`,
    equipmentKey: item => `${item.kind}:${item.itemId}`,
    frameKartCamera: (_camera, width, height, zoom) =>
      events.push(["kart-camera", width, height, zoom]),
    updateKartCard: (_card, time, camera, width, height, shadow) =>
      events.push(["kart-update", time, (camera as Camera).name, width, height, shadow]),
    updatePreview: (_preview, time, camera, width, height, animate) =>
      events.push(["preview-update", time, (camera as Camera).name, width, height, animate]),
    advanceKartTransform: (_preview, time, active) => {
      events.push(["transform-progress", time, active]); return false;
    },
    updateOrdinaryPreview: (_preview, time) => events.push(["ordinary-preview", time]),
    visualState: (state, boost) => {
      events.push(["visual-state", state, boost]);
      return { state: boost ? 10 : 0, dualMode: boost ? 3 : 0 };
    },
    renderScene: (_renderer, scene, camera) =>
      events.push(["render-scene", scene, (camera as Camera).name]),
    pixelRatio: () => 1.5,
    disposeCharacter: value => events.push(["dispose-character", value]),
    disposeKart: value => events.push(["dispose-kart", value]),
  };
  const Original = new Function("N3", "xc", "Ua0", "ey", "T4", "o80", "nF",
    "ZP", "f4", "xe", "dT", "af", "Js",
    `${release.slice(start, end)}\nreturn E7;`)(
      deps.kartKey, deps.equipmentKey, deps.frameKartCamera, deps.updateKartCard,
      deps.updatePreview, deps.advanceKartTransform, deps.updateOrdinaryPreview,
      deps.visualState, deps.renderScene, deps.pixelRatio,
      (r: GaragePanelRectangle) => `${r.x},${r.y},${r.width},${r.height}`,
      deps.disposeCharacter, deps.disposeKart,
    ) as new () => GarageLivePanelRenderHost;
  const host = Object.create(readable ? Object.prototype : Original.prototype) as
    GarageLivePanelRenderHost;
  Object.assign(host, {
    disposed: false, renderer, stageBinding: { beginFrame: (time: number) =>
      events.push(["frame", time]) }, pixelRatio: 2, preparingDirectFrame: false,
    characterCamera: new Camera("character"), kartCamera: new Camera("kart"),
    previewCamera: new Camera("preview"), previewMode: "kart-only",
    transformPreviewTimelineActive: true, transformPreviewCompleted: false,
    transformPreviewCancelled: false, transformPreviewEnabled: true,
    previewGeneration: 0,
    preview: { scene: "preview-scene", origin: 0, transformEnabled: true,
      kart: { animation: { state: 4,
        updateCurrentState: (time: number) => events.push(["animation", time]) } },
      cosmeticEffects: {
        setState: (...args: unknown[]) => events.push(["effect-state", ...args]),
        update: (...args: unknown[]) => events.push(["effect-update", args[0], (args[1] as Camera).name, args[2], args[3]]),
      },
      cosmeticTrails: {
        setState: (...args: unknown[]) => events.push(["trail-state", ...args]),
        update: (...args: unknown[]) => events.push(["trail-update", args[0], (args[1] as Camera).name]),
      },
      particleModification: { update: (...args: unknown[]) =>
        events.push(["particle", args[0], args[1], (args[2] as Camera).name, args[3], args[4]]) },
      flyingPet: { update: (...args: unknown[]) =>
        events.push(["pet", args[0], (args[1] as Camera).name, args[2], args[3]]) },
      decorations: [{ scene: { update: (...args: unknown[]) =>
        events.push(["decoration", args[0], (args[1] as Camera).name, args[2], args[3]]) } }],
    },
    characters: new Map([[1, { scene: "character-scene", character: {
      update: (...args: unknown[]) => events.push(["character-update", args[0], (args[1] as Camera).name, args[2], args[3], args[4]]),
    } }]]),
    karts: new Map([["kart:2", { scene: "kart-scene" }]]),
    equipment: new Map([["balloon:3", { scene: "equipment-scene",
      camera: new Camera("equipment"), update: (...args: unknown[]) =>
        events.push(["equipment-update", ...args]),
      dispose: () => events.push(["equipment-dispose"]),
    }]]),
    syncCards: (items: unknown[]) => events.push(["sync-cards", items.length]),
    syncPreview: () => events.push(["sync-preview"]),
    syncCoatingPreview: (request: unknown) => events.push(["sync-coating", request]),
    advancePreviewRotation: (time: number) => events.push(["rotate", time]),
    disposePreview: () => events.push(["dispose-preview"]),
  });
  if (readable) Object.assign(host, {
    renderPreview: (time: number, height: number, rectangle: GaragePanelRectangle,
      animate = true) => renderGaragePreview(host, time, height, rectangle, animate, deps),
    renderCharacterCard: (time: number, height: number, item: unknown,
      rectangle: GaragePanelRectangle) => renderGarageCharacterCard(host, time, height,
        item as never, rectangle),
    renderKartCard: (time: number, height: number, item: unknown,
      rectangle: GaragePanelRectangle, zoom?: number, shadow = false) =>
      renderGarageKartCard(host, time, height, item as never, rectangle, zoom, shadow, deps),
    renderEquipmentCard: (height: number, item: unknown, rectangle: GaragePanelRectangle) =>
      renderGarageEquipmentCard(host, height, item as never, rectangle, deps),
    setViewport: (height: number, rectangle: GaragePanelRectangle) =>
      setGaragePanelViewport(host, height, rectangle),
    submitScene: (scene: unknown, camera: Camera) => submitGaragePanelScene(host, scene, camera, deps),
    copyTo: (drawing: CanvasRenderingContext2D, rectangle: GaragePanelRectangle) =>
      copyGaragePanel(host, drawing, rectangle, deps),
  });
  const call = (name: string, ...args: unknown[]) => {
    if (!readable) return (host as unknown as Record<string, (...params: unknown[]) => unknown>)[name]!(...args);
    const functions = {
      render: (...input: unknown[]) => renderGarageLivePanels(host, ...input as Parameters<typeof renderGarageLivePanels> extends [unknown, ...infer Rest] ? Rest : never),
      drawCard: (drawing: CanvasRenderingContext2D, item: unknown,
        rectangle: GaragePanelRectangle) => drawGarageCard(host, drawing, item as never, rectangle, deps),
      drawPreview: (drawing: CanvasRenderingContext2D, rectangle: GaragePanelRectangle) =>
        drawGaragePreview(host, drawing, rectangle),
      renderPreviewSnapshot: (time: number, width: number, height: number,
        rectangle: GaragePanelRectangle, ratio?: number) =>
        renderGaragePreviewSnapshot(host, time, width, height, rectangle, ratio),
      renderKartSnapshot: (time: number, width: number, height: number,
        item: unknown, rectangle: GaragePanelRectangle, ratio = 1) =>
        renderGarageKartSnapshot(host, time, width, height, item as never, rectangle, ratio, deps),
      drawAuxiliaryPanel: (panel: unknown, contexts: CanvasRenderingContext2D[]) =>
        drawGarageAuxiliaryPanel(host, panel as never, contexts, deps),
      dispose: () => disposeGarageLivePanels(host, deps),
    } as Record<string, (...params: never[]) => unknown>;
    return functions[name]!(...args as never[]);
  };
  const cards = [{ item: character, rect }, { item: kart, rect, kartZoom: 2,
    kartShadow: true }, { item: equipment, rect }];
  call("render", 100, 320, 240, cards, rect, kart, character, {}, "coat", true, 1.25);
  call("drawCard", surface, kart, rect);
  call("drawPreview", surface, rect);
  call("renderPreviewSnapshot", 120, 320, 240, rect, 1.5);
  call("renderKartSnapshot", 140, 320, 240, kart, rect, 1);
  call("render", 160, 320, 240, cards, rect, kart, character, {}, undefined,
    false, 1, target);
  call("drawPreview", directContext, rect);
  const auxiliary = { scene: "aux-scene", camera: new Camera("aux"),
    update: (width: number, height: number) => events.push(["aux-update", width, height]) };
  call("drawAuxiliaryPanel", auxiliary, [context(100, 50), context(100, 50),
    context(80, 40, { width: 60, height: 30 })]);
  call("dispose");
  return { events: JSON.parse(JSON.stringify(events)) as unknown[],
    disposed: host.disposed, characters: host.characters.size,
    karts: host.karts.size, equipment: host.equipment.size,
    direct: host.directFrame?.scenes.size, pixelRatio: host.pixelRatio,
    previewGeneration: host.previewGeneration };
}

test("garage live card, preview and auxiliary rendering matches release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
