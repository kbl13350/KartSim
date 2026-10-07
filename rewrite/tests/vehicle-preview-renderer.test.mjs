import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { VehiclePreviewRenderer } from "../src/timeattack/vehicle-preview-renderer.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const previewNode = parse(release, { sourceType: "module" }).program.body.find(
  node => node.type === "ClassDeclaration" && node.id.name === "Py");
assert.ok(previewNode);
const previewSource = release.slice(previewNode.start, previewNode.end);

function runPreview(readable) {
  const events = [];
  const pending = [];
  class Renderer {
    domElement = "renderer-canvas";
    constructor(options) { events.push(["renderer", options]); }
    setClearColor(...args) { events.push(["clear", ...args]); }
    setSize(...args) { events.push(["size", ...args]); }
    setDrawingBufferSize(...args) { events.push(["buffer", ...args]); }
    dispose() { events.push(["dispose renderer"]); }
  }
  class ImportToken {
    constructor() { events.push(["token"]); }
  }
  const preview = label => ({
    label,
    kart: { animation: { updateCurrentState: time =>
      events.push(["animation", label, time]) } },
    flyingPet: { update: (time, camera, width, height) =>
      events.push(["pet", label, time, camera, width, height]) },
    decorations: [{ scene: { update: (time, camera, width, height) =>
      events.push(["decoration", label, time, camera, width, height]) } }],
    scene: label,
  });
  const loadSubject = (library, kart, character, environment,
    binding, token, mode, profile) => {
    events.push(["load", library, kart, character, environment,
      binding.label, token.constructor.name, mode, profile]);
    return new Promise((resolve, reject) => pending.push({ resolve, reject }));
  };
  const disposeSubject = item => events.push(["dispose", item.label]);
  const updateSubject = (item, time, camera, width, height) =>
    events.push(["update", item.label, time, camera, width, height]);
  const renderScene = (_renderer, scene, camera) =>
    events.push(["render", scene, camera]);
  const dependencies = {
    createRenderer: () => new Renderer({
      alpha: true, preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    }),
    outputColorSpace: "srgb",
    createCamera: (width, height) => {
      events.push(["camera", "preview", width, height]);
      return "camera";
    },
    createImportToken: () => new ImportToken(),
    loadSubject, disposeSubject, updateSubject, renderScene,
  };
  const OriginalPreview = new Function(
    "I4", "qe", "Qs", "T7", "Tr", "Lt", "T4", "f4",
    `${previewSource}; return Py;`,
  )(Renderer, "srgb", (mode, width, height) =>
    dependencies.createCamera(width, height), loadSubject, ImportToken,
    disposeSubject, updateSubject, renderScene);
  const view = readable
    ? new VehiclePreviewRenderer(320, 180, dependencies)
    : new OriginalPreview(320, 180);
  const canvas = { drawImage: (...args) => events.push(["draw", ...args]) };
  const binding = { label: "binding", beginFrame: time =>
    events.push(["frame", time]) };
  const options = {
    library: "lib", environment: "environment", stageBinding: binding,
    subject: { kartItem: "kart", characterItem: "character", profile: "profile" },
  };
  return { view, events, pending, preview, canvas, options };
}

async function scenario(readable) {
  const { view, events, pending, preview, canvas, options } = runPreview(readable);
  assert.equal(view.ready, false);
  view.setPixelRatio(1.0004);
  view.setPixelRatio(1.5);
  const first = view.setSubject(options);
  pending.shift().resolve(preview("first"));
  await first;
  view.render(canvas, { x: 1, y: 2, width: 300, height: 170 }, 123);
  const obsolete = view.setSubject(options);
  const latest = view.setSubject(options);
  pending.pop().resolve(preview("latest"));
  await latest;
  pending.shift().resolve(preview("obsolete"));
  await obsolete;
  const failure = view.setSubject(options);
  pending.shift().reject(new Error("asset unavailable"));
  await failure;
  const stateBeforeDispose = {
    ready: view.ready, pixelRatio: view.pixelRatio,
    generation: view.generation, loaded: view.loaded?.preview.label,
    lastError: view.lastError,
  };
  view.dispose();
  return {
    events, stateBeforeDispose,
    stateAfterDispose: {
      ready: view.ready, generation: view.generation,
      loaded: view.loaded, lastError: view.lastError,
    },
  };
}

test("vehicle preview renderer matches release across render, stale load and cleanup", async () => {
  assert.deepEqual(await scenario(true), await scenario(false));
});
