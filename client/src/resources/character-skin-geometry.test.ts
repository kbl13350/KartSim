import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferAttribute, BufferGeometry } from "three";

import { CharacterSkinGeometry } from "./character-skin-geometry.js";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];

async function originalSkin() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("const wR =");
  const last = source.indexOf("\nclass DY {", first);
  assert.ok(first >= 0 && last > first);
  return new Function("t9", "_0", `${source.slice(first, last)}\nreturn vR;`)(
    BufferGeometry, BufferAttribute) as typeof CharacterSkinGeometry;
}

function fixture() {
  const vertex = (position: number[], normal: number[], bone0: number,
    bone1 = 65535, weight0 = 1, weight1 = 0) => ({
    position, normal, bone0, bone1, weight0, weight1,
  });
  const triangle = (wedges: number[], positions: number[]) => ({
    wedgeIndices: wedges, positionIndices: positions,
    adjacentTriangleIndices: [0, 0, 0], winding: 0, unknown13: 0,
  });
  return {
    bones: [
      { parentIndex: 0, enabled: true, localBind: identity,
        inverseBind: identity },
      { parentIndex: 0, enabled: true,
        localBind: [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0],
        inverseBind: identity },
    ],
    vertices: [
      vertex([0, 0, 0], [0, 0, 1], 0),
      vertex([1, 0, 0], [0, 0, 1], 1),
      vertex([0, 1, 0], [0, 1, 0], 0, 1, 0.25, 0.75),
    ],
    wedges: [
      { skinVertexIndex: 0, u: 0, v: 0 },
      { skinVertexIndex: 1, u: 1, v: 0 },
      { skinVertexIndex: 2, u: 0, v: 1 },
      { skinVertexIndex: 0, u: 0.5, v: 0.5 },
    ],
    triangles: [triangle([0, 1, 2], [0, 1, 2]),
      triangle([3, 1, 2], [0, 1, 2])],
  };
}

function snapshot(skin: CharacterSkinGeometry) {
  const geometry = skin.geometry;
  return {
    positions: [...skin.positions], normals: [...skin.normals],
    sourceOffsets: [...skin.normalSourceOffsets],
    outlinePositions: skin.outlinePositions,
    outlineSource: skin.outlineSource,
    globalPose: skin.globalPose, palette: skin.palette,
    uv: [...geometry.getAttribute("uv").array],
    index: [...geometry.index!.array],
    box: geometry.boundingBox && {
      min: geometry.boundingBox.min.toArray(), max: geometry.boundingBox.max.toArray(),
    },
    sphere: geometry.boundingSphere && {
      center: geometry.boundingSphere.center.toArray(),
      radius: geometry.boundingSphere.radius,
    },
  };
}

test("角色骨骼矩阵、混合权重、重复 wedge 法线及轮廓与发行版一致", async () => {
  const Original = await originalSkin();
  const source = fixture();
  const old = new Original(source);
  const current = new CharacterSkinGeometry(source);
  assert.deepEqual(snapshot(current), snapshot(old));
  const poses = [
    [identity, [1, 0, 0, 2.5, 0, 1, 0, 0.25, 0, 0, 1, -1]],
    [[1, 0, 0, -3, 0, 1, 0, 2, 0, 0, 1, 0],
      [0.5, 0, 0, 0.3, 0, 0.5, 0, 1.4, 0, 0, 1, 0.9]],
  ];
  for (const pose of poses) {
    assert.deepEqual(current.update(pose), old.update(pose));
    assert.deepEqual(snapshot(current), snapshot(old));
  }
  const customPalette = [identity,
    [1, 0, 0, 4, 0, 1, 0, 0, 0, 0, 1, 0]];
  old.applyPalette(customPalette);
  current.applyPalette(customPalette);
  assert.deepEqual(snapshot(current), snapshot(old));
});

test("角色 skin 的缺失 bone、非法 parent 与 palette 越界保留发行版错误", async () => {
  const Original = await originalSkin();
  const capture = (run: () => unknown) => {
    try { run(); return "success"; }
    catch (error) { return String(error); }
  };
  const source = fixture();
  const old = new Original(source);
  const current = new CharacterSkinGeometry(source);
  assert.equal(capture(() => current.updatePose([identity])),
    capture(() => old.updatePose([identity])));
  source.bones[1]!.parentIndex = 2;
  assert.equal(capture(() => current.updatePose([identity, identity])),
    capture(() => old.updatePose([identity, identity])));
  source.bones[1]!.parentIndex = 0;
  source.vertices[0]!.bone0 = 3;
  assert.equal(capture(() => current.applyPalette([identity, identity])),
    capture(() => old.applyPalette([identity, identity])));
});
