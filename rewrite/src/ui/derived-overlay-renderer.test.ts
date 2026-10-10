import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as Three from "three";
import { DerivedOverlayRenderer } from "./derived-overlay-renderer";
import type { OverlayCommand, OverlayDependencies, OverlayPlayRuntime } from "./derived-overlay-renderer";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const before = release.slice(release.indexOf("const H5 ="), release.indexOf("function Aa(", release.indexOf("const H5 =")));
const camera = release.slice(release.indexOf("function Aa("), release.indexOf("function jQ(", release.indexOf("function Aa(")));
const after = release.slice(release.indexOf("function jQ("), release.indexOf("const eJ =", release.indexOf("function jQ(")));
assert.ok(before.includes("class fn {") && after.includes("function JQ()"));

const sourceDependencies = {
  D1: Three.Scene, D2: Three.Mesh, a5: Three.Camera, Y2: Three.Vector4,
  t9: Three.BufferGeometry, _0: Three.BufferAttribute, r1: Three.DynamicDrawUsage,
  Vt: Three.RawShaderMaterial, B2: Three.Vector2, J9: Three.DataTexture,
  e9: Three.RGBAFormat, _9: Three.UnsignedByteType, v9: Three.NoColorSpace,
  S1: Three.RepeatWrapping, h9: Three.NearestFilter, u9: Three.LinearFilter,
  y1: Three.LessEqualDepth, rr: Three.GreaterEqualDepth,
  u1: Three.CustomBlending, l1: Three.SrcAlphaFactor,
  v1: Three.OneMinusSrcAlphaFactor, R9: Three.AddEquation,
  T: (node: { name?: string }, key: string) => key === "name" ? node?.name : undefined,
  Co: () => false,
  UB: (bytes: Uint8ClampedArray) => bytes,
  OR: (bytes: Uint8ClampedArray) => {
    const output = new Uint8Array(bytes);
    for (let index = 0; index < output.length; index += 4) {
      const alpha = bytes[index + 3]!;
      for (let channel = 0; channel < 3; channel++)
        output[index + channel] = Math.round(bytes[index + channel]! * alpha / 255);
    }
    return output;
  },
  xs: Math.fround(9700 / 9801),
};
const Original = new Function(...Object.keys(sourceDependencies),
  `${before}\n${camera}\n${after}\nreturn fn;`)(...Object.values(sourceDependencies)) as
  new (runtimes: Map<unknown, OverlayPlayRuntime>, alpha?: number) => DerivedOverlayRenderer;

function setup() {
  const updates: number[] = [];
  const runtime: OverlayPlayRuntime = {
    scene: { object: new Three.Scene() },
    update(time) { updates.push(time); },
    dispose() { updates.push(-1); },
  };
  const deps: OverlayDependencies = {
    attribute: (node, key) => key === "name" ? (node as { name?: string })?.name : undefined,
    smoothImages: () => false,
    smoothPixels: image => sourceDependencies.OR(new Uint8ClampedArray(image.pixels)),
    setPlayCamera: () => {},
  };
  const runtimes = new Map<unknown, OverlayPlayRuntime>([["model", runtime]]);
  return { runtime, deps, runtimes, updates };
}

function fakeRenderer() {
  const calls: unknown[] = [];
  const context = { depthRange: (...args: number[]) => calls.push(["depthRange", ...args]) };
  const renderer = {
    autoClear: true,
    getViewport(target: Three.Vector4) { return target.set(1, 2, 3, 4); },
    setViewport(...args: unknown[]) {
      calls.push(["viewport", ...args.map(arg => arg instanceof Three.Vector4 ? arg.toArray() : arg)]);
    },
    render(scene: Three.Scene, camera: Three.Camera) {
      calls.push(["render", scene.name, camera.matrixWorldAutoUpdate]);
    },
    clearDepth() { calls.push(["clearDepth"]); },
    getContext() { return context; },
  };
  return { renderer: renderer as unknown as Three.WebGLRenderer, calls };
}

function state(renderer: DerivedOverlayRenderer) {
  const position = renderer.overlayGeometry.getAttribute("position");
  const uv = renderer.overlayGeometry.getAttribute("uv");
  const material = renderer.overlayMesh.material as Three.RawShaderMaterial;
  return {
    capacity: renderer.overlayQuadCapacity,
    drawRange: renderer.overlayGeometry.drawRange,
    positions: Array.from(position.array),
    uv: Array.from(uv.array),
    material: {
      name: material.name, depthFunc: material.depthFunc,
      defines: material.defines,
      color: material.uniforms.color?.value?.toArray(),
      alpha: material.uniforms.alpha?.value,
      viewport: material.uniforms.viewport!.value.toArray(),
      vertexShader: material.vertexShader,
      fragmentShader: material.fragmentShader,
    },
  };
}

test("derived overlay geometry, textured materials and viewport restoration match release", () => {
  const old = setup();
  const current = setup();
  const expected = new Original(old.runtimes);
  const actual = new DerivedOverlayRenderer(current.runtimes, 8, current.deps);
  const texture = { pixels: new Uint8Array([20, 40, 80, 128]), width: 1, height: 1 };
  const commands: OverlayCommand[] = [
    { kind: "solid-panel", node: { name: "indiBoostMask1" }, color: [10, 20, 30, 40],
      framebufferRect: { left: 1, top: 2, right: 11, bottom: 12 } },
    { kind: "panel", node: { name: "speed" }, texture, alpha: 100,
      framebufferRect: { left: 3, top: 4, right: 13, bottom: 14 },
      uv: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.9 } },
    { kind: "char-panel", node: { name: "characters" }, texture,
      framebufferQuads: [
        { left: 1, top: 1, right: 5, bottom: 5 },
        { left: 6, top: 6, right: 10, bottom: 10 },
      ] },
  ];
  expected.update(commands, 1234);
  actual.update(commands, 1234);
  const oldRenderer = fakeRenderer();
  const newRenderer = fakeRenderer();
  expected.render(oldRenderer.renderer, 800, 600);
  actual.render(newRenderer.renderer, 800, 600);
  assert.deepEqual(state(actual), state(expected));
  assert.deepEqual(newRenderer.calls, oldRenderer.calls);
  assert.deepEqual(current.updates, old.updates);
  assert.equal(actual.overlayScene.name, expected.overlayScene.name);
  assert.equal(actual.playCamera.matrixWorldAutoUpdate, expected.playCamera.matrixWorldAutoUpdate);
  assert.equal(newRenderer.renderer.autoClear, oldRenderer.renderer.autoClear);
  actual.dispose(); expected.dispose();
  assert.deepEqual(current.updates, old.updates);
});

test("embedded Play1S depth range and draw steps match release", () => {
  const old = setup();
  const current = setup();
  const expected = new Original(old.runtimes);
  const actual = new DerivedOverlayRenderer(current.runtimes, 8, current.deps);
  const command: OverlayCommand = {
    kind: "play-1s-panel", binding: { node: "model", name: "kart" },
    view: Array(12).fill(0), projection: Array(16).fill(0),
    steps: ["draw", "clear-depth", "draw"],
    viewport: { x: 10, y: 20, width: 100, height: 50 },
    useV1CollisionDepthRange: true,
  };
  expected.update([command], 12);
  actual.update([command], 12);
  const oldRenderer = fakeRenderer();
  const newRenderer = fakeRenderer();
  expected.render(oldRenderer.renderer, 800, 600);
  actual.render(newRenderer.renderer, 800, 600);
  assert.deepEqual(newRenderer.calls, oldRenderer.calls);
  actual.dispose(); expected.dispose();
});

test("derived overlay smoothing preserves release texture bytes and material flags", () => {
  const old = setup();
  const current = setup();
  const expected = new Original(old.runtimes);
  const actual = new DerivedOverlayRenderer(current.runtimes, 8, current.deps);
  expected.enableUiSmoothing();
  actual.enableUiSmoothing();
  const image = { pixels: new Uint8Array([200, 100, 40, 128]), width: 1, height: 1 };
  const oldMaterial = expected.material(image, 320, 240);
  const newMaterial = actual.material(image, 320, 240);
  assert.deepEqual(newMaterial.defines, oldMaterial.defines);
  assert.equal(newMaterial.uniforms.alphaTestReference!.value,
    oldMaterial.uniforms.alphaTestReference!.value);
  assert.deepEqual(Array.from((actual.textures.get(image)!.image.data) as Uint8Array),
    Array.from((expected.textures.get(image)!.image.data) as Uint8Array));
  assert.equal(actual.textures.get(image)!.magFilter, expected.textures.get(image)!.magFilter);
  actual.dispose(); expected.dispose();
});

test("smoothed panels clamp at their edges instead of the release's repeat", () => {
  const { deps, runtimes } = setup();
  const renderer = new DerivedOverlayRenderer(runtimes, 8, deps);
  renderer.enableUiSmoothing();
  renderer.material({ pixels: new Uint8Array(16), width: 2, height: 2 }, 320, 240);
  const texture = [...renderer.textures.values()][0]!;
  // With repeat, linear filtering blends the opposite edge into the first row
  // (tacho_12_baseBG_1's opaque bottom row became a line above the XUN gauge).
  assert.equal(texture.magFilter, Three.LinearFilter);
  assert.equal(texture.wrapS, Three.ClampToEdgeWrapping);
  assert.equal(texture.wrapT, Three.ClampToEdgeWrapping);
  renderer.dispose();
});
