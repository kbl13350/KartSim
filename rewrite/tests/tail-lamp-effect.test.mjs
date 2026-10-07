import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  createTailLampEffectClass, parseTailLampColor, projectTailLampDefinition,
  TailLampTrailRuntime, writeTrailGeometry,
} from "../src/vehicle/tail-lamp-effect.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const first = declarations.find(node => node.type === "FunctionDeclaration" && node.id.name === "Yt0");
const last = declarations.find(node => node.type === "FunctionDeclaration" && node.id.name === "o50");
assert.ok(first && last);
const releaseCluster = release.slice(first.start, last.end);

class SceneObject {
  constructor(x = 0, y = 0, z = 0) {
    this.name = "";
    this.children = [];
    this.matrixWorld = { elements: [1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1, 0, x, y, z, 1] };
    this.updated = 0;
    this.removed = false;
  }
  add(child) { this.children.push(child); }
  removeFromParent() { this.removed = true; }
  updateMatrixWorld(force) { this.updated += force ? 1 : 0; }
  getWorldPosition(out) {
    const elements = this.matrixWorld.elements;
    out.x = elements[12]; out.y = elements[13]; out.z = elements[14];
    return out;
  }
}
class Vector3 { constructor() { this.x = 0; this.y = 0; this.z = 0; } }
class Texture {
  constructor(pixels, width, height, format, type) {
    Object.assign(this, { pixels, width, height, format, type, disposed: false });
  }
  dispose() { this.disposed = true; }
}
class Material {
  constructor(options) { this.options = options; this.disposed = false; }
  dispose() { this.disposed = true; }
}
class Attribute {
  constructor(array, itemSize) {
    this.array = array; this.itemSize = itemSize; this.usage = undefined;
    this.updateRanges = []; this.needsUpdate = false;
  }
  setUsage(usage) { this.usage = usage; }
  setXYZW(index, x, y, z, w) {
    this.array[index * 4] = x; this.array[index * 4 + 1] = y;
    this.array[index * 4 + 2] = z; this.array[index * 4 + 3] = w;
  }
  clearUpdateRanges() { this.updateRanges = []; }
  addUpdateRange(start, count) { this.updateRanges.push({ start, count }); }
}
class Geometry {
  constructor() { this.attributes = {}; this.drawRange = { start: -1, count: -1 }; this.disposed = false; }
  setAttribute(name, attribute) { this.attributes[name] = attribute; }
  setIndex(index) { this.index = index; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
  dispose() { this.disposed = true; }
}
class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry; this.material = material;
    this.visible = true; this.frustumCulled = true; this.renderOrder = 0;
  }
}

const native = {
  T2: SceneObject, H: Vector3, J9: Texture, Vt: Material,
  t9: Geometry, _0: Attribute, D2: Mesh,
  p2: async () => ({ pixels: new Uint8Array([1, 2, 3, 4]), width: 1, height: 1 }),
  Ao: mesh => { mesh.configured = true; },
  e9: "rgba", _9: "u8", v9: "srgb", S1: "clamp", u9: "linear", r1: "dynamic",
  y1: "lequal", s1: "double", u1: "custom", l1: "src-alpha", h3: "one", R9: "add",
};
const original = new Function("deps", `with (deps) { ${releaseCluster}; return { Yt0, t50, Ea, s50, o50 }; }`)(native);
const TailLampEffect = createTailLampEffectClass({
  Object3D: SceneObject, Vector3, DataTexture: Texture, ShaderMaterial: Material,
  BufferGeometry: Geometry, BufferAttribute: Attribute, Mesh,
  decodePng: native.p2, configureMesh: native.Ao,
  rgbaFormat: native.e9, unsignedByteType: native._9, srgbColorSpace: native.v9,
  clampToEdgeWrapping: native.S1, linearFilter: native.u9, dynamicDrawUsage: native.r1,
  lessEqualDepth: native.y1, doubleSide: native.s1, customBlending: native.u1,
  sourceAlpha: native.l1, oneBlend: native.h3, additiveEquation: native.R9,
});

function definition() {
  const attachments = Array.from({ length: 22 }, (_, index) => `attachment-${index}`);
  return {
    tailLampSize: 2.5, tailLampColorSource: "0 64 128 255",
    shortTrailTailLampSize: 1.25, shortTrailTailLampColorSource: "0 10 20 30",
    shortTrailAttachmentSlots: [16, 17, 18], attachments,
  };
}
function snapshotRuntime(runtime) {
  return runtime.records.map(record => ({
    active: record.active, activationPending: record.activationPending,
    activationStartedMs: record.activationStartedMs, lastUpdateMs: record.lastUpdateMs,
    width: record.width, poolSize: record.pool.length,
    history: record.history.map(point => ({
      left: { ...point.left }, right: { ...point.right }, center: { ...point.center },
      direction: { ...point.direction }, ageSeconds: point.ageSeconds,
      lifetimeFraction: point.lifetimeFraction, scale: point.scale,
    })),
  }));
}
function frames() {
  return Array.from({ length: 5 }, (_, index) => ({
    attachment: { x: index + 1, y: 0.25 * index, z: index + 3 },
    orientationColumn1: { x: 0.2, y: 2, z: -0.3 }, scale: 1.5,
  }));
}

test("tail lamp projection, colors and history lifecycle match release", () => {
  const config = definition();
  for (const context of ["live", "shadow"]) {
    const expectedProjection = original.Yt0(config, context);
    assert.deepEqual(projectTailLampDefinition(config, context), expectedProjection);
    for (const presentation of ["driving", "shadow-driving", "garage-preview"]) {
      const expected = new original.t50(expectedProjection, presentation);
      const actual = new TailLampTrailRuntime(expectedProjection, presentation);
      const input = frames();
      const actions = [
        () => ["setState", 1, 0], () => ["setState", 3, 0],
        () => ["update", 99, input], () => ["update", 100, input],
        () => ["update", 118, input], () => ["update", 156, input],
        () => ["setState", 0, 160], () => ["setState", 3, 170],
        () => ["update", 270, input], () => ["update", 300, input],
        () => ["restartGaragePreview"], () => ["setState", 3, 400],
        () => ["update", 500, input],
      ];
      for (const action of actions) {
        const [method, ...args] = action();
        expected[method](...args); actual[method](...args);
        assert.deepEqual(snapshotRuntime(actual), snapshotRuntime(expected), `${context}/${presentation}/${method}`);
        assert.deepEqual(actual.histories(), expected.histories());
      }
    }
  }
  for (const source of [undefined, "", "0 1 2 3", "0 256 1 1", "x 1 2 3", "0 1 2 3 4"]) {
    assert.deepEqual(parseTailLampColor(source), original.o50(source));
  }
});

function scene(def) {
  const root = new SceneObject();
  const rigid = { className: "ReToonRigid" };
  const redirected = new SceneObject(30, 4, 11);
  const nodes = new Map([
    [def.attachments[14], { source: { children: [{ value: rigid }] }, object: new SceneObject(1, 2, 3) }],
    [def.attachments[15], { source: { children: [] }, object: new SceneObject(2, 3, 4) }],
    [def.attachments[16], { source: { children: [] }, object: new SceneObject(3, 4, 5) }],
  ]);
  return { nodes, object: root, bySource: new Map([[rigid, redirected]]) };
}
function inspect(effect) {
  return {
    projection: effect.runtime.projection,
    objectName: effect.object.name,
    objectChildren: effect.object.children.length,
    kartUpdates: effect.kartObject.updated,
    cameraPosition: { ...effect.cameraPosition },
    frames: effect.frames.map(frame => ({ attachment: { ...frame.attachment },
      orientationColumn1: { ...frame.orientationColumn1 }, scale: frame.scale })),
    history: snapshotRuntime(effect.runtime),
    texture: {
      pixels: Array.from(effect.texture.pixels), width: effect.texture.width,
      height: effect.texture.height, format: effect.texture.format, type: effect.texture.type,
      colorSpace: effect.texture.colorSpace, flipY: effect.texture.flipY,
      wrapS: effect.texture.wrapS, wrapT: effect.texture.wrapT,
      magFilter: effect.texture.magFilter, minFilter: effect.texture.minFilter,
      generateMipmaps: effect.texture.generateMipmaps, needsUpdate: effect.texture.needsUpdate,
      disposed: effect.texture.disposed,
    },
    material: { ...effect.material.options, uniforms: { map: "texture" },
      forceSinglePass: effect.material.forceSinglePass, disposed: effect.material.disposed },
    removed: effect.object.removed,
    records: effect.records.map(record => ({
      projection: record.projection, width: record.width,
      drawRange: record.geometry.drawRange, disposed: record.geometry.disposed,
      visible: record.mesh.visible, configured: record.mesh.configured,
      frustumCulled: record.mesh.frustumCulled, renderOrder: record.mesh.renderOrder,
      positions: Array.from(record.position.array.slice(0, 30)),
      uvs: Array.from(record.uv.array.slice(0, 20)),
      colors: Array.from(record.geometry.attributes.color.array.slice(0, 8)),
      indices: Array.from(record.geometry.index.array.slice(0, 15)),
      positionRanges: record.position.updateRanges, uvRanges: record.uv.updateRanges,
      positionNeedsUpdate: record.position.needsUpdate, uvNeedsUpdate: record.uv.needsUpdate,
    })),
  };
}

test("tail lamp loading, geometry updates and disposal match release", async () => {
  const def = definition();
  const archive = { exactCanonicalCandidates: () => [{ bytes: async () => new Uint8Array([9]) }] };
  for (const presentation of ["driving", "shadow-driving", "garage-preview"]) {
    const expected = await original.Ea.load(archive, def, scene(def), presentation);
    const actual = await TailLampEffect.load(archive, def, scene(def), presentation);
    assert.deepEqual(inspect(actual), inspect(expected), `${presentation}:load`);
    const camera = { position: { x: 15, y: 8, z: 22 } };
    for (const [method, args] of [
      ["setState", [3, 100]], ["update", [200, camera]], ["update", [225, camera]],
      ["update", [250, camera, true]], ["update", [290, camera]],
      ["setState", [0, 300]], ["update", [310, camera]],
      ["restartGaragePreview", []], ["dispose", []],
    ]) {
      expected[method](...args); actual[method](...args);
      assert.deepEqual(inspect(actual), inspect(expected), `${presentation}:${method}`);
    }
  }
});

test("tail lamp source cardinality errors match release", async () => {
  const def = definition();
  for (const count of [0, 2]) {
    const archive = { exactCanonicalCandidates: () => Array.from({ length: count }, () => ({ bytes: async () => null })) };
    const expected = await original.Ea.load(archive, def, scene(def)).then(() => undefined, error => error.message);
    const actual = await TailLampEffect.load(archive, def, scene(def)).then(() => undefined, error => error.message);
    assert.equal(actual, expected);
  }
});
