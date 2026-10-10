import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Matrix4, Vector3 } from "three";

import { orientTrackBillboard, type BillboardCameraBasis } from
  "./billboard-orientation";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseBillboard() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("const x3 = new H(),");
  const last = source.indexOf("\nfunction Vu(", first);
  assert.ok(first >= 0 && last > first);
  return new Function("H", `${source.slice(first, last)}\nreturn rj;`)(Vector3) as
    (target: Matrix4, source: Matrix4, mode: number,
      camera: BillboardCameraBasis) => void;
}

function assertMatrixEqual(current: Matrix4, old: Matrix4, label: string): void {
  for (let index = 0; index < 16; index++) {
    const actual = current.elements[index]!;
    const expected = old.elements[index]!;
    assert.ok(Object.is(actual, expected) ||
      Math.abs(actual - expected) < 1e-12 * Math.max(1, Math.abs(expected)),
    `${label} element ${index}: ${actual} vs ${expected}`);
  }
}

test("所有场景 Billboard 模式与发行版方向矩阵一致", async () => {
  const original = await releaseBillboard();
  const cameraBasis = {
    right: new Vector3(1, 0, 0), up: new Vector3(0, 1, 0),
    back: new Vector3(0, 0, 1),
  };
  const matrices = [
    new Matrix4().setPosition(1, 2, 3),
    new Matrix4().makeRotationY(0.4).scale(new Vector3(2, 3, 4))
      .setPosition(1, 2, 3),
    new Matrix4().makeRotationX(-0.9).scale(new Vector3(0.8, 1.4, 2.3))
      .setPosition(-3, 1, 5),
  ];
  for (const source of matrices)
    for (const mode of [0, 1, 2, 3, 4, 5, 9])
      for (const position of [new Vector3(0, 0, 10),
        new Vector3(5, 3, -2),
        new Vector3().setFromMatrixPosition(source),
        new Vector3(7, 2, 1)]) {
        const camera = { ...cameraBasis, position };
        const old = new Matrix4();
        const current = new Matrix4();
        original(old, source, mode, camera);
        orientTrackBillboard(current, source, mode, camera);
        assertMatrixEqual(current, old, `${mode}, ${position.toArray()}`);
        const oldInPlace = source.clone();
        const currentInPlace = source.clone();
        original(oldInPlace, oldInPlace, mode, camera);
        orientTrackBillboard(currentInPlace, currentInPlace, mode, camera);
        assertMatrixEqual(currentInPlace, oldInPlace,
          `in place ${mode}, ${position.toArray()}`);
      }
});
