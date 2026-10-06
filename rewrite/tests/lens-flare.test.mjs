import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import * as THREE from "three";
import { LensFlareEffect, lensFlareAnchor, loadLensFlareEffect } from "../src/vehicle/lens-flare.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = ["c30", "w7", "l30", "u30", "h30", "q9"];
const declarations = parse(source, { sourceType: "module" }).program.body.filter(node =>
  ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
    names.includes(node.id.name)) ||
  (node.type === "VariableDeclaration" && node.declarations[0]?.id.name === "ss"));
assert.equal(declarations.length, names.length + 1);
const originalText = declarations.map(node => source.slice(node.start, node.end)).join("\n");
const renderKeys = [];
const setRenderKey = (object, key) => { renderKeys.push(key); object.renderOrder = key; };
const deps = {
  D2: THREE.Mesh, t9: THREE.BufferGeometry, _0: THREE.BufferAttribute,
  r1: THREE.DynamicDrawUsage, $1: THREE.ShaderMaterial,
  Y2: THREE.Vector4, v2: THREE.Matrix4,
  J9: THREE.DataTexture, e9: THREE.RGBAFormat, _9: THREE.UnsignedByteType,
  v9: THREE.NoColorSpace, S1: THREE.RepeatWrapping, u9: THREE.LinearFilter,
  H: THREE.Vector3, y1: THREE.LessEqualDepth, s1: THREE.DoubleSide,
  u1: THREE.CustomBlending, R9: THREE.AddEquation,
  ra: THREE.SrcColorFactor, h3: THREE.OneFactor,
  ca: setRenderKey,
  p2: async () => ({ pixels: new Uint8Array(256 * 256 * 4), width: 256, height: 256 }),
};
const { w7: Original, c30: originalAnchor } = new Function("deps",
  `with (deps) { ${originalText}\nreturn { w7, c30 }; }`)(deps);

function snapshot(effect) {
  const geometry = effect.object.geometry;
  const material = effect.object.material;
  return {
    enabled: effect.enabled, visible: effect.object.visible,
    name: effect.object.name, frustumCulled: effect.object.frustumCulled,
    renderOrder: effect.object.renderOrder,
    worldPoint: effect.worldPoint.toArray(),
    positions: [...effect.positions],
    uv: [...geometry.getAttribute("uv").array],
    index: [...geometry.index.array],
    positionUsage: geometry.getAttribute("position").usage,
    uniforms: material.uniforms.map.value.image?.width,
    transparent: material.transparent, depthTest: material.depthTest,
    depthWrite: material.depthWrite, depthFunc: material.depthFunc,
    side: material.side, blending: material.blending,
    blendEquation: material.blendEquation, blendSrc: material.blendSrc,
    blendDst: material.blendDst, toneMapped: material.toneMapped,
    forceSinglePass: material.forceSinglePass,
    vertexShader: material.vertexShader, fragmentShader: material.fragmentShader,
  };
}

test("lens flare marker, geometry, projection and lifecycle match release", () => {
  const tracks = [
    { root: { kind: "track", trackObjects: [] } },
    { root: { kind: "other", trackObjects: [] } },
    { root: { kind: "track", trackObjects: [
      { kind: "ToDummy", name: "lensflare", transform: { position: [1, 2, 3] } },
    ] } },
  ];
  for (const track of tracks) assert.deepEqual(lensFlareAnchor(track), originalAnchor(track));
  const duplicate = { root: { kind: "track", trackObjects: [
    tracks[2].root.trackObjects[0], tracks[2].root.trackObjects[0],
  ] } };
  assert.throws(() => lensFlareAnchor(duplicate), /数量应不大于 1/);

  const texture = new THREE.DataTexture(new Uint8Array(256 * 256 * 4), 256, 256);
  const position = new THREE.Vector3(0, 0, 0);
  const before = new Original(position.clone(), texture);
  const after = new LensFlareEffect(position.clone(), texture, setRenderKey);
  assert.deepEqual(snapshot(after), snapshot(before));
  const camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 1000);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  for (const [enabled, anchor] of [
    [true, [0, 0, 0]], [true, [1, 1, 0]],
    [true, [1000, 0, 0]], [false, [0, 0, 0]],
  ]) {
    before.setEnabled(enabled); after.setEnabled(enabled);
    before.worldPoint.set(...anchor); after.worldPoint.set(...anchor);
    before.update(camera, 800, 600); after.update(camera, 800, 600);
    assert.deepEqual(snapshot(after), snapshot(before), `${enabled}/${anchor}`);
  }
  before.reset(); after.reset();
  assert.deepEqual(snapshot(after), snapshot(before));
  before.dispose(); after.dispose();
});

test("lens flare exact source and dimensions match release", async () => {
  const position = [1, 2, 3];
  const source = {
    sourceKind: "rho5", sourceName: "DataPack1_00001.rho5",
    containerId: "rho5:datapack1", bytes: async () => new Uint8Array([1, 2, 3]),
  };
  const makeLibrary = candidates => ({ exactCanonicalCandidates: () => candidates });
  for (const candidates of [[], [source, source], [{ ...source, sourceName: "other" }]]) {
    const library = makeLibrary(candidates);
    const before = await Original.load(library, position).then(() => "ok", error => error.message);
    const after = await loadLensFlareEffect(library, position, deps.p2,
      (point, texture) => new LensFlareEffect(point, texture, setRenderKey))
      .then(() => "ok", error => error.message);
    assert.equal(after, before);
  }
  const library = makeLibrary([source]);
  const before = await Original.load(library, position);
  const after = await loadLensFlareEffect(library, position, deps.p2,
    (point, texture) => new LensFlareEffect(point, texture, setRenderKey));
  assert.deepEqual(snapshot(after), snapshot(before));
  assert.equal(after.texture.colorSpace, before.texture.colorSpace);
  assert.equal(after.texture.wrapS, before.texture.wrapS);
  assert.equal(after.texture.minFilter, before.texture.minFilter);
  before.dispose(); after.dispose();
});
