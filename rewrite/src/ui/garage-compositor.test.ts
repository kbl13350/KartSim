import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GarageCanvasCompositor, garageViewportRect,
  type GarageCanvas, type GarageCompositorDependencies, type GarageRect,
} from "./garage-compositor";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("const Aa0 = new Set([");
const end = source.indexOf("class xa0 {", start);
assert.ok(start > 0 && end > start);

function exercise(released: boolean, large = false) {
  const events: unknown[] = [];
  let canvasId = 0;
  let textureId = 0;

  class FakeContext {
    fillStyle = "black";
    strokeStyle = "black";
    font = "12px sans-serif";
    lineWidth = 1;
    miterLimit = 10;
    shadowBlur = 0;
    shadowOffsetX = 0;
    shadowOffsetY = 0;
    transform = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    constructor(readonly canvas: FakeCanvas) {}
    getTransform() { return { ...this.transform }; }
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) {
      this.transform = { a, b, c, d, e, f };
      events.push(["setTransform", this.canvas.id, a, b, c, d, e, f]);
    }
    save() { events.push(["save", this.canvas.id]); }
    restore() { events.push(["restore", this.canvas.id]); }
    measureText(value: string) {
      events.push(["measureText", this.canvas.id, value]);
      return { actualBoundingBoxLeft: 2, actualBoundingBoxRight: value.length * 7,
        actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 3 };
    }
    beginPath() { events.push(["beginPath", this.canvas.id]); }
    moveTo(x: number, y: number) { events.push(["moveTo", this.canvas.id, x, y]); }
    lineTo(x: number, y: number) { events.push(["lineTo", this.canvas.id, x, y]); }
    closePath() { events.push(["closePath", this.canvas.id]); }
    fill() { events.push(["fill", this.canvas.id]); }
    stroke() { events.push(["stroke", this.canvas.id]); }
    fillRect(...args: number[]) { events.push(["fillRect", this.canvas.id, ...args]); }
    fillText(...args: unknown[]) { events.push(["fillText", this.canvas.id, ...args]); }
    strokeText(...args: unknown[]) { events.push(["strokeText", this.canvas.id, ...args]); }
    drawImage(image: FakeCanvas, ...args: number[]) {
      events.push(["drawImage", this.canvas.id, image.id, ...args]);
    }
  }
  class FakeCanvas {
    readonly id = ++canvasId;
    readonly context = new FakeContext(this);
    constructor(public width = 0, public height = 0) {}
    getContext(kind: "2d") {
      assert.equal(kind, "2d");
      return this.context as unknown as CanvasRenderingContext2D;
    }
  }
  class FakeScene {
    quad?: FakeQuad;
    add(quad: FakeQuad) { this.quad = quad; events.push(["add-quad"]); }
  }
  class FakeCamera {
    left = 0; right = 0; top = 0; bottom = 0; near = 0; far = 0;
    updateProjectionMatrix() {
      events.push(["projection", this.left, this.right, this.top, this.bottom, this.near, this.far]);
    }
  }
  class FakeMaterial {
    uniforms: { image: { value: unknown }; opacity: { value: number } };
    constructor(options: Record<string, unknown>) {
      this.uniforms = options.uniforms as FakeMaterial["uniforms"];
      events.push(["material", options.transparent, options.depthTest,
        options.depthWrite, options.toneMapped]);
    }
    dispose() { events.push(["dispose-material"]); }
  }
  class FakeGeometry {
    constructor(width: number, height: number) { events.push(["geometry", width, height]); }
    dispose() { events.push(["dispose-geometry"]); }
  }
  class FakeQuad {
    frustumCulled = true;
    position = { set: (x: number, y: number, z: number) => {
      events.push(["position", x, y, z]);
    } };
    scale = { set: (x: number, y: number, z: number) => {
      events.push(["scale", x, y, z]);
    } };
    constructor(readonly geometry: FakeGeometry, readonly material: FakeMaterial) {}
  }
  class FakeTexture {
    readonly id = ++textureId;
    minFilter: unknown;
    magFilter: unknown;
    generateMipmaps = true;
    needsUpdate = false;
    constructor(readonly canvas: FakeCanvas) { events.push(["texture", this.id, canvas.id]); }
    dispose() { events.push(["dispose-texture", this.id]); }
  }
  class FakeRenderer {
    outputColorSpace: unknown;
    autoClear = true;
    constructor(options: Record<string, unknown>) {
      events.push(["renderer", (options.canvas as FakeCanvas).id,
        options.alpha, options.preserveDrawingBuffer, options.powerPreference]);
    }
    setClearColor(...args: unknown[]) { events.push(["clearColor", ...args]); }
    setSize(...args: unknown[]) { events.push(["size", ...args]); }
    setViewport(...args: unknown[]) { events.push(["viewport", ...args]); }
    setScissor(...args: unknown[]) { events.push(["scissor", ...args]); }
    setScissorTest(...args: unknown[]) { events.push(["scissorTest", ...args]); }
    clear(...args: unknown[]) { events.push(["clear", ...args]); }
    render(scene: FakeScene) {
      const image = scene.quad?.material.uniforms.image.value as FakeTexture | undefined;
      events.push(["render", image?.id, scene.quad?.material.uniforms.opacity.value]);
    }
    dispose() { events.push(["dispose-renderer"]); }
  }

  const canvas = new FakeCanvas(large ? 5000 : 200, large ? 5000 : 100);
  const dependencies: GarageCompositorDependencies = {
    createCanvas: () => new FakeCanvas() as unknown as GarageCanvas,
    createRenderer: target => new FakeRenderer({ canvas: target, alpha: true,
      preserveDrawingBuffer: true, powerPreference: "high-performance" }),
    createScene: () => new FakeScene(),
    createCamera: () => new FakeCamera(),
    createMaterial: options => new FakeMaterial(options),
    createQuad: material => new FakeQuad(new FakeGeometry(1, 1), material as FakeMaterial),
    createTexture: target => new FakeTexture(target as FakeCanvas),
    outputColorSpace: "srgb", canvasTextureFilter: "linear", paintTextureFilter: "nearest",
  };
  const Original = new Function("D1", "Fm", "$1", "D2", "Ar", "I4", "bA",
    "qe", "u9", "h9", `${source.slice(start, end)}; return { Ma0, rT };`)(
      FakeScene, FakeCamera, FakeMaterial, FakeQuad, FakeGeometry, FakeRenderer,
      FakeTexture, "srgb", "linear", "nearest",
    ) as { Ma0: new (canvas: FakeCanvas) => GarageCanvasCompositor;
      rT(rect: GarageRect, sx: number, sy: number, height: number, tx?: number, ty?: number): GarageRect };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement: (tag: string) => {
      assert.equal(tag, "canvas");
      return new FakeCanvas();
    },
  } as unknown as Document;
  try {
  const compositor = released ? new Original.Ma0(canvas) :
    new GarageCanvasCompositor(canvas, dependencies);
  const context = compositor.context;
  const errors: string[] = [];
  const capture = (label: string) => ({
    label, events: structuredClone(events), disposed: compositor.disposed,
    paints: compositor.paints.length, layers: compositor.layers.size,
    layerBytes: compositor.layerBytes, canvasLayers: compositor.canvasLayers.size,
    canvasLayerRevisions: [...compositor.canvasLayers.values()].map(layer => ({
      revision: layer.revision, used: layer.used, needsUpdate: layer.texture.needsUpdate,
    })),
    imageIds: compositor.nextImageId,
    backing: [compositor.backingWidth, compositor.backingHeight],
    currentTexture: (compositor.material.uniforms.image.value as FakeTexture | null)?.id,
    opacity: compositor.material.uniforms.opacity.value,
    errors: [...errors],
  });
  const states = [capture("constructor")];
  if (large) {
    compositor.beginFrame();
    context.fillRect(0, 0, 4200, 4200);
    compositor.flush();
    states.push(capture("first-large-layer"));
    context.fillRect(100, 100, 4200, 4200);
    compositor.flush();
    states.push(capture("evicted-oldest"));
  } else {
    compositor.beginFrame();
    states.push(capture("begin"));
    context.fillStyle = "red";
    context.fillRect(10, 20, 30, 12);
    try { context.clearRect(0, 0, 100, 100); } catch (error) { errors.push(String(error)); }
    try { context.arc(0, 0, 5, 0, 1); } catch (error) { errors.push(String(error)); }
    compositor.flush();
    states.push(capture("first-paint"));
    compositor.beginFrame();
    context.fillStyle = "red";
    context.fillRect(10, 20, 30, 12);
    compositor.endFrame();
    states.push(capture("cached-paint"));

    context.setTransform(2, 0, 0, 1.5, 5, 7);
    context.beginPath();
    context.moveTo(3, 4);
    context.lineTo(17, 20);
    context.closePath();
    context.stroke();
    context.fillText("车库", 20, 25);
    compositor.drawModel({ x: 5, y: 9, width: 30, height: 18 }, () => {
      events.push(["model-callback"]);
    });
    states.push(capture("path-text-model"));
    const layerCanvas = new FakeCanvas(24, 12);
    compositor.beginFrame();
    compositor.drawCanvasLayer(layerCanvas, { x: 2, y: 3, width: 24, height: 12 }, 1,
      { x: 0, y: 0, width: 30, height: 20 }, 0.4);
    compositor.endFrame();
    states.push(capture("canvas-layer"));
    compositor.beginFrame();
    compositor.drawCanvasLayer(layerCanvas, { x: 3, y: 4, width: 24, height: 12 }, 1);
    compositor.endFrame();
    states.push(capture("same-revision"));
    compositor.beginFrame();
    compositor.drawCanvasLayer(layerCanvas, { x: 3, y: 4, width: 24, height: 12 }, undefined);
    compositor.endFrame();
    states.push(capture("unknown-revision"));
    compositor.beginFrame();
    compositor.endFrame();
    states.push(capture("unused-layer-released"));
    canvas.width = 240;
    compositor.beginFrame();
    states.push(capture("resize"));
  }
  compositor.dispose();
  compositor.dispose();
  states.push(capture("disposed"));
  return { states, viewport: Original.rT({ x: 1.7, y: 2.4, width: 6.8, height: 8.1 },
    2, 1.5, 100, 3, 4) };
  } finally {
    globalThis.document = previousDocument;
  }
}

test("garage paint cache, 3D viewport, canvas layers and disposal match Ma0", () => {
  assert.deepEqual(exercise(false), exercise(true));
  assert.deepEqual(garageViewportRect({ x: 1.7, y: 2.4, width: 6.8, height: 8.1 },
    2, 1.5, 100, 3, 4), exercise(true).viewport);
});

test("garage texture cache evicts the oldest layer past 64 MiB like Ma0", () => {
  assert.deepEqual(exercise(false, true), exercise(true, true));
});
