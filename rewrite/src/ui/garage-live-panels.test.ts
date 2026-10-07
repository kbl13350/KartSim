import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GarageLivePanels, type GarageLivePanelDependencies } from "./garage-live-panels";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class E7 {");
const end = release.indexOf("\nfunction xc(", start);
assert.ok(start >= 0 && end > start);

function exercise(readable: boolean, suppliedCamera: boolean) {
  const events: unknown[] = [];
  class Renderer {
    outputColorSpace?: unknown;
    autoClear = true;
    constructor(readonly options: unknown) { events.push(["renderer", options]); }
    setClearColor(...args: unknown[]) { events.push(["clear-color", ...args]); }
  }
  class Importer { constructor() { events.push(["importer"]); } }
  const camera = (kind: string, width: number, height: number) => {
    events.push(["camera", kind, width, height]);
    return { kind, width, height };
  };
  const Original = new Function("I4", "Tr", "Qs", "qe", "$a0", "J3",
    `${release.slice(start, end)}\nreturn E7;`)(
      Renderer, Importer, camera, "srgb",
      (_camera: unknown, width: number, height: number, preset: string) =>
        events.push(["resize-camera", width, height, preset]),
      (_camera: unknown, yaw: number) => events.push(["yaw", yaw]),
    ) as new (...args: unknown[]) => GarageLivePanels;
  const dependencies = {
    createRenderer: () => new Renderer({ alpha: true, preserveDrawingBuffer: true,
      powerPreference: "high-performance" }),
    createImporter: () => new Importer(), createCamera: camera,
    sizePreviewCamera: (_camera: unknown, width: number, height: number, preset: string) =>
      events.push(["resize-camera", width, height, preset]),
    cameraYaw: (_camera: unknown, yaw: number) => events.push(["yaw", yaw]),
    outputColorSpace: "srgb", motion: {}, assets: {}, render: {},
  } as unknown as GarageLivePanelDependencies;
  const library = {};
  const environment = {};
  const binding = { coatingTextures: (value: unknown) => {
    assert.equal(value, library); events.push(["coating-textures"]); return "cache";
  }, beginFrame: () => {} };
  const onReady = () => {};
  const customCamera = { kind: "custom", width: 33, height: 44 };
  const view = readable
    ? new GarageLivePanels(library, environment, binding, onReady,
      { width: 160, height: 120 }, { width: 200, height: 160 },
      suppliedCamera ? customCamera as never : undefined, "kart-only", dependencies)
    : new Original(library, environment, binding, onReady,
      { width: 160, height: 120 }, { width: 200, height: 160 },
      suppliedCamera ? customCamera : undefined, "kart-only");
  view.previewYaw = 1.5;
  view.setPreviewSize(250, 180, "garage-x");
  const snapshot = {
    events, previewMode: view.previewMode,
    coatingTextures: view.coatingTextures,
    rendererColorSpace: view.renderer.outputColorSpace,
    rendererAutoClear: view.renderer.autoClear,
    cameras: [view.characterCamera, view.kartCamera, view.previewCamera],
    defaults: [view.previewGeneration, view.previewReverse, view.previewRearView,
      view.transformPreviewEnabled, view.transformPreviewTimelineActive,
      view.transformPreviewCancelled, view.transformPreviewCompleted,
      view.transformPreviewClosing, view.particleModificationPageVisible,
      view.disposed, view.pixelRatio],
    emptyCaches: [view.characters.size, view.karts.size, view.equipment.size,
      view.characterLoading.size, view.kartLoading.size, view.equipmentLoading.size],
    getters: [view.coatingPreviewError, view.isTransformPreviewSessionActive,
      view.isTransformPreviewEnabled, view.isPreviewReady],
  };
  return snapshot;
}

test("garage live panel construction and camera setup match release", () => {
  assert.deepEqual(exercise(true, false), exercise(false, false));
  assert.deepEqual(exercise(true, true), exercise(false, true));
});
