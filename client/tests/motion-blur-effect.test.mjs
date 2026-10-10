import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  createMotionBlurEffectClass, motionBlurCaptureOpacity, motionBlurEnabled,
  motionBlurMaskOpacity, motionBlurOpacity, motionBlurTransitionStart,
  parseMotionBlurColor,
} from "../src/vehicle/motion-blur-effect.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
const first = statements.find(node => node.type === "VariableDeclaration" &&
  node.declarations.some(declaration => declaration.id.name === "o6"));
const last = statements.find(node => node.type === "FunctionDeclaration" && node.id.name === "Gk");
assert.ok(first && last);
const cluster = release.slice(first.start, last.end);

class Scene { constructor() { this.children = []; } add(child) { this.children.push(child); } }
class Camera {}
class Geometry {
  constructor() { this.attributes = {}; this.index = undefined; this.disposed = false; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  setIndex(index) { this.index = index; }
  dispose() { this.disposed = true; }
}
class FloatAttribute { constructor(values, size) { this.values = values; this.size = size; } }
class Mesh { constructor(geometry, material) { Object.assign(this, { geometry, material }); } }
class Vector2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
}
class Vector3 {
  constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
  set(x, y, z) { Object.assign(this, { x, y, z }); return this; }
}
class Material {
  constructor(options) { this.options = options; this.uniforms = options.uniforms; this.disposed = false; }
  dispose() { this.disposed = true; }
}
class RenderTarget {
  constructor(width, height, options) {
    Object.assign(this, { width, height, options, texture: {}, disposed: false });
  }
  dispose() { this.disposed = true; }
}
class Texture {
  constructor(pixels, width, height, format, type) {
    Object.assign(this, { pixels, width, height, format, type, disposed: false });
  }
  dispose() { this.disposed = true; }
}
class FramebufferTexture {
  constructor(width, height) { Object.assign(this, { width, height, disposed: false }); }
  dispose() { this.disposed = true; }
}
const native = {
  D1: Scene, a5: Camera, t9: Geometry, M1: FloatAttribute, D2: Mesh,
  B2: Vector2, H: Vector3, Vt: Material, nn: RenderTarget, J9: Texture, IN: FramebufferTexture,
  p2: async () => ({ pixels: Uint8Array.of(1, 2, 3, 4), width: 128, height: 128 }),
  v9: "srgb", F1: "clamp", u9: "linear", e9: "rgba", _9: "u8",
  u1: "custom", R9: "add", l1: "src-alpha", v1: "one-minus-src-alpha",
};
const original = new Function("deps", `with (deps) { ${cluster};
  return { sv, Ct0, Et0, Tt0, _t0, Gt0, Bt0 }; }`)(native);
const MotionBlurEffect = createMotionBlurEffectClass({
  Scene, Camera, Geometry, FloatAttribute, Mesh, Vector2, Vector3,
  ShaderMaterial: Material, RenderTarget, DataTexture: Texture, FramebufferTexture,
  decodePng: native.p2, colorSpace: native.v9, clampWrapping: native.F1,
  linearFilter: native.u9, textureFormat: native.e9, textureType: native._9,
  customBlending: native.u1, additiveEquation: native.R9,
  sourceAlpha: native.l1, oneMinusSourceAlpha: native.v1,
});
function archive(paths = ["effect/boosterBlur/blurMask.png", "effect/boosterBlur/blurMask2.png"]) {
  return { exactCanonicalCandidates: path => paths.filter(candidate => candidate === path)
    .map(() => ({ bytes: async () => path })) };
}
function renderer() {
  const calls = [];
  let width = 800;
  let height = 600;
  return {
    calls,
    resize(nextWidth, nextHeight) { width = nextWidth; height = nextHeight; },
    getDrawingBufferSize(out) { out.set(width, height); calls.push(["size", width, height]); },
    setRenderTarget(target) { calls.push(["target", target?.texture.name ?? null]); },
    copyFramebufferToTexture(texture) { calls.push(["copy", texture.name]); },
    render(scene) { calls.push(["render", scene.children[0].material.name]); },
  };
}
function textureState(texture) {
  return texture && {
    name: texture.name, width: texture.width, height: texture.height,
    colorSpace: texture.colorSpace, flipY: texture.flipY,
    wrapS: texture.wrapS, wrapT: texture.wrapT,
    minFilter: texture.minFilter, magFilter: texture.magFilter,
    generateMipmaps: texture.generateMipmaps, needsUpdate: texture.needsUpdate,
    disposed: texture.disposed,
  };
}
function materialState(material) {
  return {
    name: material.name, options: { ...material.options, uniforms: "handled" },
    uniforms: Object.fromEntries(Object.entries(material.uniforms).map(([key, entry]) => [key,
      entry.value && typeof entry.value === "object"
        ? entry.value.name ?? ("x" in entry.value ? { x: entry.value.x, y: entry.value.y, z: entry.value.z } : null)
        : entry.value])),
    transparent: material.transparent, blending: material.blending,
    blendEquation: material.blendEquation, blendSrc: material.blendSrc,
    blendDst: material.blendDst, disposed: material.disposed,
  };
}
function state(effect) {
  return {
    feedbackDurationMs: effect.feedbackDurationMs, enabled: effect.enabled,
    drawable: effect.drawable, transitionStartMs: effect.transitionStartMs,
    previousPhysicsState: effect.previousPhysicsState,
    sceneChildren: effect.scene.children.length,
    geometry: { attributes: effect.geometry.attributes, index: effect.geometry.index,
      disposed: effect.geometry.disposed },
    quadMaterial: effect.quad.material.name, quadFrustumCulled: effect.quad.frustumCulled,
    capture: { options: effect.capture.options, disposed: effect.capture.disposed,
      texture: textureState(effect.capture.texture) },
    layers: effect.layers.map(layer => ({ color: layer.color, lastCaptureMs: layer.lastCaptureMs,
      mask: textureState(layer.mask), history: { options: layer.history.options,
        disposed: layer.history.disposed, texture: textureState(layer.history.texture) } })),
    materials: [effect.copyMaterial, effect.feedbackMaterial, effect.overlayMaterial].map(materialState),
    drawingBufferSize: { x: effect.drawingBufferSize.x, y: effect.drawingBufferSize.y },
    screenTexture: textureState(effect.screenTexture), screenWidth: effect.screenWidth,
    screenHeight: effect.screenHeight,
  };
}

test("motion blur state, transition, feedback, color and alpha helpers match release", () => {
  for (const source of [undefined, "255 255 255 255", "128 10 20 30", "0 0 0 0",
    "1 256 0 0", "1 2 3", "x 0 0 0"]) {
    const result = fn => { try { return fn(source); } catch (error) { return error.message; } };
    assert.deepEqual(result(parseMotionBlurColor), result(original.Bt0));
  }
  for (const current of [false, true]) {
    for (const stateCode of [0, 2, 3, 5, 9]) {
      for (const previous of [0, 3]) {
        for (const elapsed of [0, 149, 150, 151, 500]) {
          for (const eligible of [false, true]) {
            assert.equal(motionBlurEnabled(current, stateCode, previous, elapsed, eligible),
              original.Ct0(current, stateCode, previous, elapsed, eligible));
          }
        }
      }
    }
  }
  for (const now of [0, 1, 100, 499, 500, 999, 2 ** 32 - 1]) {
    assert.equal(motionBlurTransitionStart(100, now), original.Et0(100, now));
    for (const enabled of [false, true])
      assert.equal(motionBlurOpacity(enabled, 100, now), original.Tt0(enabled, 100, now));
    for (const color of [0, 0x80abcdef, 0xffffffff])
      assert.equal(motionBlurMaskOpacity(color, now / 1000), original._t0(color, now / 1000));
    for (const duration of [0, 100, 250, 500]) {
      for (const last of [undefined, 0, 50, 100])
        assert.equal(motionBlurCaptureOpacity(last, now, duration), original.Gt0(last, now, duration));
    }
  }
});

test("motion blur load, capture, resize, fade and disposal match release", async () => {
  const definition = { boosterBlur: true, boostBlurColorSource: "128 10 20 30" };
  const expected = await original.sv.load(archive(), definition, 300);
  const actual = await MotionBlurEffect.load(archive(), definition, 300);
  assert.deepEqual(state(actual), state(expected), "load");
  const originalRenderer = renderer();
  const rewrittenRenderer = renderer();
  const compare = label => {
    assert.deepEqual(state(actual), state(expected), label);
    assert.deepEqual(rewrittenRenderer.calls, originalRenderer.calls, `${label}: render sequence`);
  };
  const setState = (...args) => { expected.setState(...args); actual.setState(...args); compare(`state ${args}`); };
  const render = tick => {
    expected.render(originalRenderer, tick);
    actual.render(rewrittenRenderer, tick);
    compare(`render ${tick}`);
  };
  setState(3, 160, 1000, true);
  setState(3, 151, 1050, true);
  render(1050);
  render(1060);
  render(1070);
  render(1170);
  originalRenderer.resize(1024, 768); rewrittenRenderer.resize(1024, 768);
  render(1499);
  setState(0, 0, 1500, true);
  render(1500);
  render(1700);
  render(2201);
  expected.reset(); actual.reset(); compare("reset");
  expected.dispose(); actual.dispose(); compare("dispose");
});

test("motion blur optional path and exact mask source errors match release", async () => {
  const scenarios = [
    [archive(), { boosterBlur: false }, 300],
    [archive(), { boosterBlur: true }, 50],
    [archive([]), { boosterBlur: true }, 300],
    [archive(["effect/boosterBlur/blurMask.png", "effect/boosterBlur/blurMask.png"]),
      { boosterBlur: true }, 300],
  ];
  for (const [sources, definition, duration] of scenarios) {
    const result = async Class => Class.load(sources, definition, duration)
      .then(value => value?.layers.length, error => error.message);
    assert.equal(await result(MotionBlurEffect), await result(original.sv));
  }
  const wrongPng = { ...native, p2: async () => ({ pixels: Uint8Array.of(1), width: 64, height: 64 }) };
  const WrongOriginal = new Function("deps", `with (deps) { ${cluster}; return sv; }`)(wrongPng);
  const WrongRewritten = createMotionBlurEffectClass({
    Scene, Camera, Geometry, FloatAttribute, Mesh, Vector2, Vector3,
    ShaderMaterial: Material, RenderTarget, DataTexture: Texture, FramebufferTexture,
    decodePng: wrongPng.p2, colorSpace: native.v9, clampWrapping: native.F1,
    linearFilter: native.u9, textureFormat: native.e9, textureType: native._9,
    customBlending: native.u1, additiveEquation: native.R9,
    sourceAlpha: native.l1, oneMinusSourceAlpha: native.v1,
  });
  const result = async Class => Class.load(archive(), { boosterBlur: true }, 300)
    .then(() => undefined, error => error.message);
  assert.equal(await result(WrongRewritten), await result(WrongOriginal));
});
