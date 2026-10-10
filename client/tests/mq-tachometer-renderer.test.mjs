import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { createMqTachometerClass, mqGaugeCount } from "../src/vehicle/mq-tachometer-renderer.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
const first = statements.find(node => node.type === "VariableDeclaration" &&
  node.declarations.some(declaration => declaration.id.name === "Kh"));
const last = statements.find(node => node.type === "FunctionDeclaration" && node.id.name === "x50");
assert.ok(first && last);
const cluster = release.slice(first.start, last.end);

class Scene { constructor() { this.children = []; } add(mesh) { this.children.push(mesh); } }
class Camera {}
class Geometry {
  constructor() { this.attributes = {}; this.drawRange = { start: -1, count: -1 }; this.disposed = false; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  setIndex(index) { this.index = index; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
  dispose() { this.disposed = true; }
}
class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; }
}
class Mesh {
  constructor(geometry, material) { Object.assign(this, { geometry, material, visible: true, removed: false }); }
  removeFromParent() { this.removed = true; }
}
class BoundingSphere { constructor(center, radius) { Object.assign(this, { center, radius }); } }
class Vector3 { constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); } }
class Vector2 {
  constructor(x = 0, y = 0) { Object.assign(this, { x, y }); }
  set(x, y) { Object.assign(this, { x, y }); return this; }
}
class Texture {
  constructor(pixels, width, height, format, type) {
    Object.assign(this, { pixels, width, height, format, type, disposed: false });
  }
  dispose() { this.disposed = true; }
}
class Material {
  constructor(options) { this.options = options; this.uniforms = options.uniforms; this.disposed = false; }
  dispose() { this.disposed = true; }
}

function harness(rewritten) {
  const calls = [];
  let commands = [];
  let systemSmoothing = false;
  const dependencies = {
    D1: Scene, a5: Camera, t9: Geometry, _0: BufferAttribute, D2: Mesh,
    yr: BoundingSphere, H: Vector3, B2: Vector2, J9: Texture, Vt: Material,
    WQ: (_definition, speed, width, height, preserve) => {
      calls.push(["drawCommands", speed, width, height, preserve]);
      return commands;
    },
    Co: () => { calls.push("systemSmoothing"); return systemSmoothing; },
    UB: (pixels, width, height) => {
      calls.push(["resample", Array.from(pixels), width, height]);
      return { pixels: Uint8Array.from(pixels).map(value => value + 1) };
    },
    OR: value => { calls.push("finishResample"); return value.pixels; },
    xs: 0.45, e9: "rgba", _9: "u8", v9: "srgb", S1: "clamp",
    u9: "linear", h9: "nearest", y1: "lequal", u1: "custom",
    R9: "add", l1: "src-alpha", v1: "one-minus-alpha",
  };
  const Original = new Function("deps", `with (deps) { ${cluster}; return { Fk, x50 }; }`)(dependencies);
  const Rewritten = createMqTachometerClass({
    Scene, Camera, Geometry, BufferAttribute, Mesh, BoundingSphere, Vector3, Vector2,
    DataTexture: Texture, ShaderMaterial: Material,
    drawCommands: dependencies.WQ, systemUiSmoothing: dependencies.Co,
    resamplePixels: dependencies.UB, finishResampledPixels: dependencies.OR,
    depth: dependencies.xs, rgbaFormat: dependencies.e9,
    unsignedByteType: dependencies._9, srgbColorSpace: dependencies.v9,
    clampWrapping: dependencies.S1, linearFilter: dependencies.u9,
    nearestFilter: dependencies.h9, lessEqualDepth: dependencies.y1,
    customBlending: dependencies.u1, additiveEquation: dependencies.R9,
    sourceAlpha: dependencies.l1, oneMinusSourceAlpha: dependencies.v1,
  });
  return {
    Class: rewritten ? Rewritten : Original.Fk,
    material: rewritten ? undefined : Original.x50,
    setCommands(value) { commands = value; },
    setSystemSmoothing(value) { systemSmoothing = value; },
    calls,
  };
}
function source(name) { return { name, pixels: Uint8Array.of(0, 63, 127, 255), width: 1, height: 1 }; }
function panel(texture) {
  return { kind: "panel", texture,
    framebufferRect: { left: 1.1, top: 2.2, right: 30.3, bottom: 40.4 },
    uv: { left: 0.1, top: 0.2, right: 0.8, bottom: 0.9 } };
}
function charPanel(texture) {
  return { kind: "char-panel", texture, framebufferQuads: [
    { left: 50, top: 60, right: 70, bottom: 80,
      u0: 0, v0: 0.5, u1: 0.5, v1: 1 },
    { left: 75, top: 65, right: 90, bottom: 85,
      u0: 0.5, v0: 0, u1: 1, v1: 0.5 },
  ] };
}
function textureState(texture) {
  return {
    pixels: Array.from(texture.pixels), width: texture.width, height: texture.height,
    format: texture.format, type: texture.type, colorSpace: texture.colorSpace,
    flipY: texture.flipY, wrapS: texture.wrapS, wrapT: texture.wrapT,
    magFilter: texture.magFilter, minFilter: texture.minFilter,
    generateMipmaps: texture.generateMipmaps, unpackAlignment: texture.unpackAlignment,
    needsUpdate: texture.needsUpdate, disposed: texture.disposed,
  };
}
function materialState(material) {
  return {
    options: { ...material.options, uniforms: {
      map: { value: textureState(material.uniforms.map.value) },
      viewport: { value: { ...material.uniforms.viewport.value } },
    } },
    disposed: material.disposed,
  };
}
function state(renderer, harness) {
  return {
    speed: renderer.speed, gaugeCount: renderer.gaugeCount,
    width: renderer.width, height: renderer.height, preserve: renderer.preserve,
    smoothTextures: renderer.smoothTextures, sceneChildren: renderer.scene.children.length,
    pool: renderer.pool.map(entry => ({
      visible: entry.mesh.visible, renderOrder: entry.mesh.renderOrder,
      frustumCulled: entry.mesh.frustumCulled, removed: entry.mesh.removed,
      drawRange: entry.geometry.drawRange, disposed: entry.geometry.disposed,
      boundingSphere: { radius: entry.geometry.boundingSphere.radius,
        center: { ...entry.geometry.boundingSphere.center } },
      positions: Array.from(entry.positions.array.slice(0, 30)),
      uvs: Array.from(entry.uvs.array.slice(0, 20)),
      indices: Array.from(entry.indices.array.slice(0, 15)),
      needsUpdate: [entry.positions.needsUpdate, entry.uvs.needsUpdate, entry.indices.needsUpdate],
      material: entry.mesh.material && materialState(entry.mesh.material),
    })),
    textures: [...renderer.textures.values()].map(textureState),
    materials: [...renderer.materials.values()].map(materialState),
    calls: structuredClone(harness.calls),
  };
}

test("MQ tachometer gauge quantization and constructor validation match release", () => {
  const original = harness(false);
  for (const speed of [-50, -0.01, 0, 0.1, 5.9, 120.8, 350, 999.9, Infinity, NaN]) {
    const instance = new original.Class({ type: "MqTacho" });
    instance.update(speed, 800, 600, false);
    assert.equal(mqGaugeCount(speed), instance.gaugeCount, `speed=${speed}`);
  }
  for (const type of ["NineTacho", "V1GenTacho", "XGenTacho"]) {
    const error = Class => { try { return new Class({ type }); } catch (caught) { return caught.message; } };
    assert.equal(error(harness(true).Class), error(harness(false).Class));
  }
});

test("MQ tachometer pooled panel geometry, texture cache and smoothing match release", () => {
  const expected = harness(false);
  const actual = harness(true);
  const original = new expected.Class({ type: "MqTacho" });
  const rewritten = new actual.Class({ type: "MqTacho" });
  const first = source("first");
  const second = source("second");
  const third = source("third");
  const compare = label => assert.deepEqual(state(rewritten, actual), state(original, expected), label);
  const setCommands = value => { expected.setCommands(value); actual.setCommands(value); };
  const update = (...args) => { original.update(...args); rewritten.update(...args); compare(`update ${args}`); };
  setCommands([panel(first), charPanel(second)]);
  update(120.8, 800, 600, false);
  update(120.8, 800, 600, false);
  setCommands([panel(first)]);
  update(121.1, 1024, 768, false);
  original.enableUiSmoothing(); rewritten.enableUiSmoothing(); compare("enable smoothing");
  setCommands([panel(first), panel(third)]);
  update(145.5, 1024, 768, true);
  expected.setSystemSmoothing(true); actual.setSystemSmoothing(true);
  setCommands([charPanel(second)]);
  update(146.5, 1024, 768, true);

  const firstRenderer = { autoClear: true, render(scene) { expected.calls.push(["render", scene.children.length, this.autoClear]); } };
  const secondRenderer = { autoClear: true, render(scene) { actual.calls.push(["render", scene.children.length, this.autoClear]); } };
  original.render(firstRenderer); rewritten.render(secondRenderer); compare("render");
  assert.equal(firstRenderer.autoClear, true);
  assert.equal(secondRenderer.autoClear, true);
  firstRenderer.render = () => { throw new Error("renderer lost"); };
  secondRenderer.render = () => { throw new Error("renderer lost"); };
  assert.throws(() => original.render(firstRenderer), /renderer lost/);
  assert.throws(() => rewritten.render(secondRenderer), /renderer lost/);
  assert.equal(firstRenderer.autoClear, true);
  assert.equal(secondRenderer.autoClear, true);
  original.dispose(); rewritten.dispose(); compare("dispose");
});
