import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { RpScenePreview, type RpScenePreviewDependencies } from "./rp-scene-preview";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class my {");
const end = release.indexOf("\nconst VT =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Variant = "normal" | "one-panel" | "wrong-scene" | "missing-asset" |
  "bad-controller" | "scene-error" | "environment-error" |
  "kart-error" | "renderer-error" | "paint" | "paint-kart" |
  "play" | "dispose";

async function observe(rewritten: boolean, variant: Variant) {
  const events: unknown[][] = [];
  let nextCamera = 0;
  const makeCamera = () => {
    const id = ++nextCamera;
    events.push(["camera", id]);
    return { matrixAutoUpdate: true, matrixWorldAutoUpdate: true,
      position: { set(...args: number[]) { events.push(["position", id, ...args]); } },
      lookAt(...args: number[]) { events.push(["look-at", id, ...args]); },
      near: 0, far: 0, aspect: 0, fov: 0,
      updateProjectionMatrix() { events.push(["projection", id]); },
    };
  };
  const makeSize = () => { events.push(["size"]); return { x: 0, y: 0 }; };
  const makeBinding = () => {
    events.push(["binding"]);
    return { beginFrame(now: number) { events.push(["begin-frame", now]); },
      dispose() { events.push(["binding-dispose"]); } };
  };
  const panelA = { name: "Play1SPanel", children: [], scene: "복불복상자(선물펑)" };
  const panelB = { name: "Play1SPanel", children: [],
    scene: variant === "wrong-scene" ? "wrong" : "반짝반짝눈이부셔" };
  const definition = { name: "Root", children: variant === "one-panel"
    ? [panelA] : [panelA, panelB] };
  const library = { get(path: string) {
    events.push(["get", path]);
    if (variant === "missing-asset" && path.includes("눈이부셔")) return undefined;
    return { async bytes() { events.push(["bytes", path]);
      return Uint8Array.from([1, 2]); } };
  } };
  const sceneFor = (path: string) => ({
    object: `object:${path}`,
    playControllers: (at: number, blend: number) =>
      events.push(["play", path, at, blend]),
    stopControllers: variant === "bad-controller" && path.includes("눈이부셔")
      ? undefined : (at: number) => events.push(["stop", path, at]),
    update: (now: number, _camera: unknown, width: number, height: number) =>
      events.push(["scene-update", path, now, width, height]),
    dispose: () => events.push(["scene-dispose", path]),
  });
  const environment = { dispose() { events.push(["environment-dispose"]); } };
  const kart = { scene: "kart-scene" };
  const makeRenderer = (options: unknown) => {
    events.push(["renderer", options]);
    if (variant === "renderer-error") throw new Error("renderer failed");
    return { domElement: "surface", outputColorSpace: "",
      setClearColor(...args: number[]) { events.push(["clear-color", ...args]); },
      setPixelRatio(ratio: number) { events.push(["pixel-ratio", ratio]); },
      getSize(size: { x: number; y: number }) {
        events.push(["get-size"]); size.x = 0; size.y = 0;
      },
      setSize(width: number, height: number, style: boolean) {
        events.push(["set-size", width, height, style]);
      },
      clear(...args: boolean[]) { events.push(["clear", ...args]); },
      render(object: unknown, _camera: unknown) {
        events.push(["render", object]);
      },
      dispose() { events.push(["renderer-dispose"]); },
      forceContextLoss() { events.push(["context-loss"]); },
    };
  };
  const dependencies = {
    createCamera: makeCamera,
    createSize: makeSize,
    createBinding: makeBinding,
    sceneName: (node: typeof panelA) => node.scene,
    validateCamera: (_node: unknown, width: number, height: number) =>
      events.push(["validate-camera", width, height]),
    parseScene: (bytes: Uint8Array) => { events.push(["parse-scene", [...bytes]]);
      return "parsed"; },
    loadScene: async (_parsed: unknown, _library: unknown, path: string,
      _reference: unknown, options: unknown) => {
      events.push(["load-scene", path, options]);
      if (variant === "scene-error") throw new Error("scene failed");
      return sceneFor(path);
    },
    resolveReference: (_library: unknown, path: string, ref: string) => {
      events.push(["reference", path, ref]); return ref;
    },
    loadKartEnvironment: async () => {
      events.push(["environment"]);
      if (variant === "environment-error") throw new Error("environment failed");
      return environment;
    },
    loadKart: async (_library: unknown, item: unknown, _environment: unknown,
      _binding: unknown) => {
      events.push(["kart", item]);
      if (variant === "kart-error") throw new Error("kart failed");
      return kart;
    },
    createRenderer: makeRenderer,
    outputColorSpace: "srgb",
    kartFieldOfView: (angle: number, aspect: number) => {
      events.push(["fov", angle, aspect]); return 60;
    },
    prepareKart: (_kart: unknown, now: number, _camera: unknown,
      width: number, height: number) =>
      events.push(["prepare-kart", now, width, height]),
    renderKart: (_renderer: unknown, scene: unknown, _camera: unknown) =>
      events.push(["render-kart", scene]),
    configureSceneCamera: (_camera: unknown, node: unknown,
      width: number, height: number) =>
      events.push(["scene-camera", node === panelA, width, height]),
    disposeKart: (_kart: unknown) => events.push(["kart-dispose"]),
  } as unknown as RpScenePreviewDependencies;
  const originalDeps = {
    Z9: class { constructor() { return makeCamera(); } },
    B2: class { constructor() { return makeSize(); } },
    ha: class { constructor() { return makeBinding(); } },
    T: dependencies.sceneName,
    _F: dependencies.validateCamera,
    y9: dependencies.parseScene,
    W1: dependencies.loadScene,
    ya: dependencies.resolveReference,
    rn: { load: dependencies.loadKartEnvironment },
    Qv: dependencies.loadKart,
    I4: class { constructor(options: unknown) { return makeRenderer(options); } },
    qe: dependencies.outputColorSpace,
    we: dependencies.kartFieldOfView,
    ey: dependencies.prepareKart,
    f4: dependencies.renderKart,
    Dl0: dependencies.configureSceneCamera,
    Js: dependencies.disposeKart,
  };
  const Original = new Function(...Object.keys(originalDeps),
    `${originalClass}\nreturn my;`)(...Object.values(originalDeps)) as {
      load(library: unknown, definition: unknown, item: unknown): Promise<RpScenePreview>;
    };
  let preview: RpScenePreview | undefined;
  let error: string | undefined;
  try {
    preview = rewritten
      ? await RpScenePreview.load(library, definition, "kart-item", dependencies)
      : await Original.load(library, definition, "kart-item");
    const canvas = { drawImage(image: unknown, ...args: number[]) {
      events.push(["draw", image, ...args]);
    } };
    const rect = { x: 1, y: 2, width: 100.8, height: 50.9 };
    if (variant === "paint-kart") preview.paintKart(canvas, rect, -1);
    if (variant === "play") preview.play(panelA, -1);
    if (variant === "paint") preview.paint(panelA, canvas, rect, -1);
    if (variant === "dispose") { preview.dispose(); preview.dispose(); }
  } catch (failure) { error = (failure as Error).message; }
  return { events, error, preview: preview && {
    disposed: preview.disposed, scenes: preview.scenes.size,
    hasKart: !!preview.kart, hasRenderer: !!preview.renderer,
    hasEnvironment: !!preview.kartEnvironment,
    cameraFlags: [preview.camera.matrixAutoUpdate,
      preview.camera.matrixWorldAutoUpdate],
  } };
}

test("RP scene loading, painting and every cleanup failure match release", async () => {
  for (const variant of ["normal", "one-panel", "wrong-scene",
    "missing-asset", "bad-controller", "scene-error",
    "environment-error", "kart-error", "renderer-error",
    "paint", "paint-kart", "play", "dispose"] as const) {
    assert.deepEqual(await observe(true, variant), await observe(false, variant), variant);
  }
});
