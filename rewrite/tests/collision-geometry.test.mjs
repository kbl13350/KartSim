import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  createVehicleCollisionScratch, optionalRoadSurface, orientedBoxBounds,
  triangleCentroid, triangleIntersectsOrientedBox,
  updateTrackedTriangleVelocity,
} from "../src/driving/collision-geometry.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const collisionNames = ["vv", "Oo", "S5", "hi0", "vd", "yd", "Ad", "yv",
  "bd", "di0", "Md"];
const originalCollision = new Function(
  `${sourceOf("w0")}\n${sourceOf("f1")}\n${collisionNames.map(sourceOf).join("\n")};
  return { vv, Oo, di0 };`,
)();
const originalScratch = new Function("F2", `${sourceOf("ni0")}; return ni0;`);
const originalRoad = new Function("VG", `${sourceOf("Mt")}; return Mt;`);

let seed = 0x51ab0312;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32 * 20 - 10;
}
const vector = () => ({ x: random(), y: random(), z: random() });
const unitVector = () => ({ x: 1, y: 0, z: 0 });
function triangle() { return { a: vector(), b: vector(), c: vector() }; }
function box() {
  return { center: vector(), axes: [
    { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 },
  ], halfExtents: [Math.abs(random()) + 0.01,
    Math.abs(random()) + 0.01, Math.abs(random()) + 0.01] };
}

test("collision scratch allocation and optional road conversion match release", () => {
  const oldFactory = originalScratch(() => ({ x: 0, y: 0, z: 0 }));
  assert.deepEqual(createVehicleCollisionScratch(() => ({ x: 0, y: 0, z: 0 })),
    oldFactory());
  const oldRoad = originalRoad(value => ({ id: value.id + 1 }));
  for (const value of [null, undefined, false, { id: 2 }]) {
    const convert = item => ({ id: item.id + 1 });
    assert.deepEqual(optionalRoadSurface(value, convert), oldRoad(value));
  }
});

test("triangle centroid, oriented-box overlap and bounds match release", () => {
  const special = [
    { a: { x: 0, y: 0, z: 0 }, b: { x: 1, y: 0, z: 0 },
      c: { x: 0, y: 1, z: 0 } },
    { a: { x: -1, y: 0, z: -1 }, b: { x: 1, y: 0, z: -1 },
      c: { x: 0, y: 0, z: 1 } },
  ];
  for (const tri of [...special, ...Array.from({ length: 100 }, triangle)]) {
    const obb = box();
    assert.deepEqual(triangleCentroid(tri), originalCollision.vv(tri));
    assert.equal(triangleIntersectsOrientedBox(tri, obb),
      originalCollision.Oo(tri, obb));
    const expected = new Array(6).fill(0);
    const actual = new Array(6).fill(0);
    originalCollision.di0(obb, expected);
    orientedBoxBounds(obb, actual);
    assert.deepEqual(actual, expected);
  }
});

test("tracked moving-triangle surface velocity matches release", () => {
  const math = {
    cloneVector: value => ({ ...value }),
    centroid: vertices => ({
      x: (vertices[0].x + vertices[1].x + vertices[2].x) / 3,
      y: (vertices[0].y + vertices[1].y + vertices[2].y) / 3,
      z: (vertices[0].z + vertices[1].z + vertices[2].z) / 3,
    }),
    subtract: (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }),
    scale: (value, amount) => ({
      x: value.x * amount, y: value.y * amount, z: value.z * amount,
    }),
    f32: Math.fround,
  };
  const original = new Function("I1", "Rg", "N1", "Tt", "t0",
    `${sourceOf("pi0")}; return pi0;`)(
      math.cloneVector, math.centroid, math.subtract, math.scale, math.f32);
  const makeTriangles = () => [{
    previousVertices: [unitVector(), unitVector(), unitVector()],
    vertices: [{ x: 3, y: 1, z: 0 }, { x: 4, y: 0, z: 1 },
      { x: 2, y: -1, z: 0 }],
  }];
  for (const [now, previous] of [[100, 0], [120, 100],
    [2 ** 32 + 8, 2 ** 32 - 8], [-1, 0], [1.1, 1]]) {
    const a = makeTriangles(), b = makeTriangles();
    let expected, actual;
    try { expected = original(a, item => item.vertices, now, previous); }
    catch (error) { expected = { error: error.message }; }
    try { actual = updateTrackedTriangleVelocity(
      b, item => item.vertices, now, previous, math); }
    catch (error) { actual = { error: error.message }; }
    assert.deepEqual(actual, expected);
    assert.deepEqual(b, a);
  }
});
