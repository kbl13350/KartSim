import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  AddEquation, BufferAttribute, BufferGeometry, CustomBlending, DoubleSide,
  DynamicDrawUsage, LessEqualDepth, Matrix4, Mesh, OneMinusSrcAlphaFactor,
  PerspectiveCamera, RawShaderMaterial, SrcAlphaFactor, Vector2, Vector3,
} from "three";

import { ToonOutlineController, toonColorFromArgb, type ToonOutlineDependencies,
  type ToonSource } from "./toon-outline-controller";
import type { OutlineProfileEntry } from "./toon-outline-geometry";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseController(profile: OutlineProfileEntry[]) {
  const source = await readFile(releaseFile, "utf8");
  const projectionStart = source.indexOf("function SB(");
  const projectionEnd = source.indexOf("\nfunction MK(", projectionStart);
  const classStart = source.indexOf("class N6 {");
  const helperStart = source.indexOf("function h8(", classStart);
  const helperEnd = source.indexOf("\nclass on {", helperStart);
  assert.ok(projectionStart >= 0 && projectionEnd > projectionStart &&
    classStart > projectionEnd && helperStart > classStart && helperEnd > helperStart);
  const factory = new Function("Vt", "B2", "y1", "s1", "u1", "l1", "v1", "R9",
    "t9", "_0", "r1", "D2", "kp", "AK", "Xm", "bK", "$c", "Vector3",
    `const Li = new Float32Array(16), bb = new Float32Array(16),
      Pi = new Float32Array(16), Mb = new Vector3(),
      xB = new Float32Array(16), $r = new Float32Array(4);
    let Lp = 0, serial = 0;
    function yb() { return ++serial; }
    ${source.slice(projectionStart, projectionEnd)}
    ${source.slice(classStart, helperStart)}
    ${source.slice(helperStart, helperEnd)}
    return { Original: N6, projection: {
      generation: () => Lp, prepare: SB, transpose: Fp, multiply: Dp,
      transform: SK, model: Li, combined: Pi, screen: xB, clip: $r,
    } };`);
  return factory(RawShaderMaterial, Vector2, LessEqualDepth, DoubleSide,
    CustomBlending, SrcAlphaFactor, OneMinusSrcAlphaFactor, AddEquation,
    BufferGeometry, BufferAttribute, DynamicDrawUsage, Mesh,
    profile, profile, profile, () => undefined, true, Vector3) as {
    Original: new (source: ToonSource, center: number, outer: number,
      draw?: boolean, batch?: unknown, cached?: boolean) => ToonOutlineController;
    projection: ToonOutlineDependencies["projection"];
  };
}

function sourceFixture(): ToonSource {
  const positions = [
    [-1, -1, -5], [1, -1, -5], [0, 1, -5],
    [0, 1, -5], [1, -1, -5], [2, 1, -5],
  ];
  return { positions, faces: [
    { positionIndices: [0, 1, 2], adjacentFaceIndices: [65535, 1, 65535],
      outlineOpenEdge: 1, winding: 0 },
    { positionIndices: [3, 4, 5], adjacentFaceIndices: [0, 65535, 65535],
      outlineOpenEdge: 1, winding: 1 },
  ] };
}

function snapshot(outline: ToonOutlineController) {
  return {
    drawOutline: outline.drawOutline,
    material: {
      name: outline.material.name,
      vertexShader: outline.material.vertexShader,
      fragmentShader: outline.material.fragmentShader,
      transparent: outline.material.transparent,
      depthTest: outline.material.depthTest,
      depthWrite: outline.material.depthWrite,
      depthFunc: outline.material.depthFunc,
      side: outline.material.side,
      blending: outline.material.blending,
      blendSrc: outline.material.blendSrc,
      blendDst: outline.material.blendDst,
      blendEquation: outline.material.blendEquation,
      toneMapped: outline.material.toneMapped,
      forceSinglePass: outline.material.forceSinglePass,
      viewport: outline.material.uniforms.viewportPx?.value.toArray(),
      colors: outline.material.userData,
    },
    center: [...outline.centerColor], outer: [...outline.outerColor],
    originalCenter: [...outline.originalCenterColor],
    originalOuter: [...outline.originalOuterColor],
    projected: outline.projected.map(point => ({ ...point })),
    faces: outline.classificationFaces.map(face => ({
      a: outline.projected.indexOf(face.a), b: outline.projected.indexOf(face.b),
      c: outline.projected.indexOf(face.c), doubleSided: face.doubleSided,
    })),
    classes: [...outline.classes],
    links: outline.links.map(link => ({ ...link })),
    conflicts: [...outline.conflicts], consumed: [...outline.consumed],
    section: [...outline.section], strip: [...outline.strip],
    capacity: [outline.capacityVertexCount, outline.capacityIndexCount],
    attributes: [outline.positionAttribute, outline.colorAttribute,
      outline.indexAttribute].map(attribute => ({ count: attribute.count,
        itemSize: attribute.itemSize, usage: attribute.usage,
        values: [...attribute.array] })),
    geometryRange: { ...outline.geometry.drawRange },
    object: { visible: outline.object.visible,
      frustumCulled: outline.object.frustumCulled,
      renderOrder: outline.object.renderOrder },
    frame: { serial: outline.updateSerial, emitted: outline.frameEmitted,
      viewport: outline.frameViewportValue, sortDepth: outline.frameSortZ,
      world: [outline.frameWorldX, outline.frameWorldY, outline.frameWorldZ],
      vertexCount: outline.vertexCount, triangleCount: outline.triangleCount,
      stripCount: outline.stripCount,
      bodySourceIndices: outline.bodySourceIndices && [...outline.bodySourceIndices],
      bodyIndex: outline.bodyIndex && [...outline.bodyIndex.array],
      cachedProjection: outline.cachedProjection && [...outline.cachedProjection] },
  };
}

test("Toon 描边整类构造、真实投影和完整帧与发行版一致", async () => {
  const profile = Array.from({ length: 1024 }, (_, index) => ({
    x: (index % 11) * 0.1, y: (index % 7) * -0.1, valid: index % 8 !== 0,
  }));
  const { Original, projection } = await releaseController(profile);
  let serial = 0;
  const deps: ToonOutlineDependencies = {
    defaultProfile: () => profile,
    nextSerial: () => ++serial,
    enabled: () => true,
    projection,
    update: () => ({
      profileForSelector1: profile, profileForOtherSelector: profile,
      defaultProfile: profile, enabled: true, overrideForObject: () => undefined,
      colorFromArgb: toonColorFromArgb, nextSerial: () => ++serial,
      projectedDepth: (body, camera) => new Vector3().setFromMatrixPosition(
        body.matrixWorld).project(camera).z,
    }),
  };
  const source = sourceFixture();
  const old = new Original(source, 0xffcc8844, 0x80224466, true, undefined, true);
  const current = new ToonOutlineController(source, 0xffcc8844, 0x80224466,
    true, undefined, true, deps);
  assert.deepEqual(snapshot(current), snapshot(old), "constructor");

  const camera = new PerspectiveCamera(60, 4 / 3, 0.1, 100);
  camera.updateMatrixWorld();
  const bodyGeometry = new BufferGeometry();
  bodyGeometry.setAttribute("position", new BufferAttribute(
    new Float32Array(source.positions.flatMap(position => Array.from(position))), 3));
  const body = { geometry: bodyGeometry, matrixWorld: new Matrix4() };
  const originalStages: string[] = [], currentStages: string[] = [];
  old.update(body, camera, 800, 600, phase => originalStages.push(phase));
  current.update(body, camera, 800, 600, phase => currentStages.push(phase));
  assert.deepEqual(currentStages, originalStages);
  assert.deepEqual(snapshot(current), snapshot(old), "full frame");

  const originalCached = old.projectVertices(body.matrixWorld, camera,
    800, 600, undefined, true);
  const currentCached = current.projectVertices(body.matrixWorld, camera,
    800, 600, undefined, true);
  assert.equal(currentCached, originalCached);
  assert.deepEqual(current.projected, old.projected);
});
