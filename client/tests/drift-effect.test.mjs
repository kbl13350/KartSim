import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { createDriftEffectClass, createDriftMarkSetup, selectSkidTexture } from "../src/vehicle/drift-effect.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = statements.find(item =>
    (item.type === "FunctionDeclaration" || item.type === "ClassDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const clusterStart = release.indexOf("const De0 = \"effect/drift/drift.png\"");
const clusterEnd = statements.find(node => node.type === "FunctionDeclaration" && node.id.name === "y0").end;
assert.ok(clusterStart > 0);

class Object3D {
  constructor() { this.children = []; this.name = ""; this.removed = false; }
  add(...children) { this.children.push(...children); }
  removeFromParent() { this.removed = true; }
}
class Texture {
  constructor(pixels, width, height, format, type) {
    Object.assign(this, { pixels, width, height, format, type, disposed: false });
  }
  dispose() { this.disposed = true; }
}
class Material {
  constructor(options) { this.options = options; this.map = options.map; this.disposed = false; }
  dispose() { this.disposed = true; }
}
class Attribute {
  constructor(array, itemSize) {
    this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize;
    this.updateRanges = []; this.needsUpdate = false;
  }
  setUsage(usage) { this.usage = usage; return this; }
  clearUpdateRanges() { this.updateRanges = []; }
}
class Geometry {
  constructor() { this.attributes = {}; this.drawRange = { start: -1, count: -1 }; this.disposed = false; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  getAttribute(name) { return this.attributes[name]; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
  dispose() { this.disposed = true; }
}
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material; this.visible = true;
    this.frustumCulled = true;
  }
}

const native = {
  T2: Object3D, J9: Texture, d3: Material, t9: Geometry, _0: Attribute, D2: Mesh,
  p2: async value => {
    const path = String(value);
    return { pixels: Uint8Array.from([1, 2, 3, 4]), width: 128,
      height: path.includes("007") || path.includes("005") ? 128 : 64 };
  },
  ie: (mesh, order, transparent) => { mesh.order = order; mesh.transparent = transparent; },
  Ao: mesh => { mesh.configured = true; },
  e9: "rgba", _9: "u8", v9: "srgb", S1: "clamp", h9: "nearest", r1: "dynamic",
  s1: "double", u1: "custom", R9: "add", l1: "src-alpha", v1: "one-minus-alpha", h3: "one",
  oS: (_definition, _scene, slot) => {
    const x = slot === 2 ? -1.2 : 1.3;
    return { object: { matrixWorld: new Matrix(x, 0.2, 0) },
      source: { bounds0: { min: [-0.3, -0.5, 0], max: [0.3, 0.5, 0] } } };
  },
};
const original = new Function("deps", `with (deps) {
  const gk = ["stuff2_", "stuff"], mk = ["png", "tga", "kng"];
  ${declaration("re0")}
  ${release.slice(clusterStart, clusterEnd)}
  return { re0, Ze0, iv };
}`)(native);
const DriftEffect = createDriftEffectClass({
  Object3D, DataTexture: Texture, MeshBasicMaterial: Material,
  BufferGeometry: Geometry, BufferAttribute: Attribute, Mesh,
  decodePng: native.p2, configureSkidMesh: native.ie, configureDriftMesh: native.Ao,
  textureFormat: native.e9, textureType: native._9, colorSpace: native.v9,
  wrapping: native.S1, nearestFilter: native.h9, dynamicUsage: native.r1,
  doubleSide: native.s1, customBlending: native.u1, additiveEquation: native.R9,
  sourceAlpha: native.l1, oneMinusSourceAlpha: native.v1, oneBlend: native.h3,
});

class Matrix {
  constructor(x = 0, y = 0, z = 0) {
    this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  }
  clone() { return new Matrix(this.elements[12], this.elements[13], this.elements[14]); }
  invert() { this.elements[12] *= -1; this.elements[13] *= -1; this.elements[14] *= -1; return this; }
  multiply(other) {
    this.elements[12] += other.elements[12];
    this.elements[13] += other.elements[13];
    this.elements[14] += other.elements[14];
    return this;
  }
}

function archive(additional = []) {
  const paths = [
    "stuff2_/skidMark/texture/default.png",
    "effect/drift/drift.png", "effect/drift/drift2.png", "effect/drift/drift007.png",
    "effect/drift/drift3.png", "effect/drift/drift005.png", ...additional,
  ];
  return { exactCanonicalCandidates: path => paths.filter(candidate => candidate === path)
    .map(() => ({ virtualPath: path, canonicalPath: path, bytes: async () => path })) };
}
function random() {
  const values = [37, 7100, 24000, 300, 16000, 8000, 12345, 23456, 31415];
  let index = 0;
  return { next: () => values[index++ % values.length] };
}
function setup() { return { sources: [{ x: -1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 }], width: 0.6 }; }
function frame(overrides = {}) {
  return {
    active: true, contact: true, speedKmh: 80, forwardSpeed: 20,
    roadSurface: "road", motionMode: 0, position: { x: 0, y: 0, z: 0 },
    right: { x: 1, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 },
    presentationRight: { x: 1, y: 0, z: 0 },
    presentationForward: { x: 0, y: 0, z: 1 },
    presentationUp: { x: 0, y: 1, z: 0 },
    rearWheelCompression: [0, 0], wheelCompressionBaseline: 0,
    obstacleWheelHit: false, fullPhysicsBypass: false,
    ...overrides,
  };
}
const raycast = { rayQuery: origin => ({ point: { x: origin.x, y: 0, z: origin.z } }) };

function meshState(mesh) {
  const geometry = mesh.geometry;
  const material = mesh.material;
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  return {
    name: mesh.name, visible: mesh.visible, frustumCulled: mesh.frustumCulled,
    order: mesh.order, transparent: mesh.transparent, configured: mesh.configured,
    geometry: { drawRange: geometry.drawRange, disposed: geometry.disposed,
      positionCount: position.count, uvCount: uv.count,
      position: Array.from(position.array.slice(0, 36)), uv: Array.from(uv.array.slice(0, 24)),
      positionUsage: position.usage, uvUsage: uv.usage,
      positionRanges: position.updateRanges, uvRanges: uv.updateRanges,
      positionNeedsUpdate: position.needsUpdate, uvNeedsUpdate: uv.needsUpdate },
    material: { options: { ...material.options, map: material.options.map.name },
      map: material.map.name, blending: material.blending, blendEquation: material.blendEquation,
      blendSrc: material.blendSrc, blendDst: material.blendDst,
      toneMapped: material.toneMapped, forceSinglePass: material.forceSinglePass,
      needsUpdate: material.needsUpdate, disposed: material.disposed },
  };
}
function state(effect) {
  return {
    name: effect.object.name, removed: effect.object.removed,
    children: effect.object.children.length,
    driftMode: effect.driftMode, driftSideSpans: effect.driftSideSpans,
    drift2BirthToggle: effect.drift2BirthToggle,
    activeSkids: effect.activeSkids.map(history => history && structuredClone(history)),
    finishedSkids: structuredClone(effect.finishedSkids),
    particles: structuredClone(effect.particles), drift2Particles: structuredClone(effect.drift2Particles),
    quadFirst: { ...effect.quadFirst }, quadSecond: { ...effect.quadSecond },
    quadThird: { ...effect.quadThird }, quadFourth: { ...effect.quadFourth },
    meshes: [effect.skidMesh, effect.driftMesh, effect.drift2Mesh].map(meshState),
    textures: [effect.skidTexture, effect.driftTexture, effect.drift2Texture,
      effect.drift007Texture, effect.drift3Texture, effect.drift005Texture].map(texture => ({
      name: texture.name, width: texture.width, height: texture.height,
      colorSpace: texture.colorSpace, flipY: texture.flipY, wrapS: texture.wrapS,
      wrapT: texture.wrapT, minFilter: texture.minFilter, magFilter: texture.magFilter,
      generateMipmaps: texture.generateMipmaps, needsUpdate: texture.needsUpdate,
      disposed: texture.disposed,
    })),
  };
}

test("drift setup and unique texture selection match release", () => {
  const scene = { object: { matrixWorld: new Matrix(10, 4, 0),
    updateWorldMatrix: (first, second) => assert.equal(first && second, true) } };
  for (const single of [false, true]) {
    for (const kartType of [0, 1]) {
      assert.deepEqual(createDriftMarkSetup({}, scene, single, kartType, native.oS),
        original.Ze0({}, scene, single, kartType));
    }
  }
  for (const additional of [[], ["stuff/skidMark/texture/default.tga"],
    ["stuff2_/skidMark/texture/default.png"]]) {
    const input = archive(additional);
    const result = fn => { try { return fn(input, "default").virtualPath; }
      catch (error) { return error.message; } };
    assert.equal(result(selectSkidTexture), result(original.re0));
  }
});

test("drift effects loading and frame lifecycle match release", async () => {
  const expected = await original.iv.load(archive(), random(), setup());
  const actual = await DriftEffect.load(archive(), random(), setup());
  assert.deepEqual(state(actual), state(expected), "load");
  const cases = [
    [0, frame(), true],
    [35, frame({ position: { x: 0.3, y: 0, z: 1 } }), true],
    [70, frame({ position: { x: 0.5, y: 0, z: 2 } }), false],
    [110, frame({ position: { x: 0.8, y: 0, z: 3 }, rearWheelCompression: [0.8, 0] }), true],
    [145, frame({ roadSurface: "slip", speedKmh: 45 }), true],
    [180, frame({ roadSurface: "slip", speedKmh: 55 }), true],
    [215, frame({ motionMode: 2, position: { x: 1, y: 0, z: 5 } }), true],
    [240, frame({ motionMode: 3, position: { x: 2, y: 0, z: 6 } }), true],
    [300, frame({ active: false, contact: false }), false],
    [450, frame({ active: false, contact: false }), false],
  ];
  for (const [tick, sample, emit] of cases) {
    expected.update(tick, sample, raycast, emit);
    actual.update(tick, sample, raycast, emit);
    assert.deepEqual(state(actual), state(expected), `update ${tick}`);
  }
  for (let tick = 451; tick < 475; tick += 1) {
    const sample = frame({ roadSurface: "slip", speedKmh: 55 });
    expected.update(tick, sample, raycast, true);
    actual.update(tick, sample, raycast, true);
  }
  assert.deepEqual(state(actual), state(expected), "particle lifetime");
  expected.reset(); actual.reset();
  assert.deepEqual(state(actual), state(expected), "reset");
  expected.dispose(); actual.dispose();
  assert.deepEqual(state(actual), state(expected), "dispose");
});

test("drift effect reports source and dimensions exactly as release", async () => {
  const noSkid = { exactCanonicalCandidates: path => path.includes("skidMark") ? [] : archive().exactCanonicalCandidates(path) };
  const wrongPng = { ...native, p2: async () => ({ pixels: new Uint8Array(4), width: 1, height: 1 }) };
  const WrongOriginal = new Function("deps", `with (deps) {
    const gk = ["stuff2_", "stuff"], mk = ["png", "tga", "kng"];
    ${declaration("re0")}
    ${release.slice(clusterStart, clusterEnd)}
    return iv;
  }`)(wrongPng);
  const WrongRewritten = createDriftEffectClass({
    Object3D, DataTexture: Texture, MeshBasicMaterial: Material,
    BufferGeometry: Geometry, BufferAttribute: Attribute, Mesh,
    decodePng: wrongPng.p2, configureSkidMesh: native.ie, configureDriftMesh: native.Ao,
    textureFormat: native.e9, textureType: native._9, colorSpace: native.v9,
    wrapping: native.S1, nearestFilter: native.h9, dynamicUsage: native.r1,
    doubleSide: native.s1, customBlending: native.u1, additiveEquation: native.R9,
    sourceAlpha: native.l1, oneMinusSourceAlpha: native.v1, oneBlend: native.h3,
  });
  for (const [OriginalClass, RewrittenClass, source] of [
    [original.iv, DriftEffect, noSkid], [WrongOriginal, WrongRewritten, archive()],
  ]) {
    const outcome = async Class => Class.load(source, random(), setup())
      .then(() => undefined, error => error.message);
    assert.equal(await outcome(RewrittenClass), await outcome(OriginalClass));
  }
});
