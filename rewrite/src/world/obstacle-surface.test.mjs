import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { decodeArchiveIndex } from "../resources/archive-index.ts";
import { RhoReader } from "../codecs/rho.ts";
import { ObstacleSurface } from "./obstacle-surface.ts";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
const { y9, YW } = await import("../generated/formats.js");
const { Bg, Oo, vv } = await import("../generated/driving.js");
const { dl, t0 } = await import("../generated/math.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");
const source = await readFile(path.join(root, "recovered/formatted/index.js"), "utf8");
const snippet = (startText, nextText) => {
  const start = source.indexOf(startText);
  const end = source.indexOf(nextText, start);
  assert.ok(start >= 0 && end > start, `${startText} source boundary`);
  return source.slice(start, end);
};
const OriginalObstacleSurface = new Function("t0", "Bg", "Oo", "vv", "dl",
  `${snippet("function Av(", "function nE(")}\n` +
  `${snippet("function Mv(", "function xt(")}\n` +
  `${snippet("function bv(", "function E5(")}\n` +
  `${snippet("class eE {", "class mi0 {")}\nreturn eE;`,
)(t0, Bg, Oo, vv, dl);

function memorySource(name, bytes) {
  const arrayBuffer = part => Uint8Array.from(part).buffer;
  return {
    name, size: bytes.length,
    arrayBuffer: async () => arrayBuffer(bytes),
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => arrayBuffer(bytes.subarray(start, end)),
    }),
  };
}

let realTrianglesPromise;
async function realTriangles() {
  realTrianglesPromise ??= (async () => {
    const manifest = parseResourceManifest(JSON.parse(await readFile(
      path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
    const bytes = await readFile(path.join(mirror, "__p3553/archive-index"));
    const indexes = await decodeArchiveIndex(Readable.toWeb(Readable.from([bytes])), manifest);
    const name = "track_village_R01.rho";
    const index = indexes.rho.find(entry => entry.name === name);
    assert.ok(index);
    const reader = new RhoReader(memorySource(name,
      await readFile(path.join(mirror, "p3553", name))), index);
    const track = reader.files.find(file => file.path.toLowerCase() === "track.1s");
    assert.ok(track);
    return YW(y9(await reader.readRecord(track)), "time-attack").collisionTriangles;
  })();
  return realTrianglesPromise;
}

function capture(operation) {
  try { return { ok: true, value: structuredClone(operation()) }; }
  catch (error) { return { ok: false, error: error.message }; }
}

test("real p3553 obstacle triangle ray hits match release", async () => {
  const triangles = (await realTriangles()).slice(0, 40);
  assert.ok(triangles.length >= 20);
  const current = new ObstacleSurface(triangles, Oo, Oo);
  const released = new OriginalObstacleSurface(triangles, Oo);
  for (const triangle of triangles) {
    const center = {
      x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
      y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
      z: (triangle.a.z + triangle.b.z + triangle.c.z) / 3,
    };
    for (const includeWalls of [false, true]) {
      for (const direction of [-1, 1]) {
        const origin = {
          x: center.x - triangle.normal.x * 5 * direction,
          y: center.y - triangle.normal.y * 5 * direction,
          z: center.z - triangle.normal.z * 5 * direction,
        };
        const movement = {
          x: triangle.normal.x * 10 * direction,
          y: triangle.normal.y * 10 * direction,
          z: triangle.normal.z * 10 * direction,
        };
        const now = current.queryBest(origin, movement, includeWalls);
        const before = released.queryBest(origin, movement, includeWalls);
        assert.equal(now, before);
        if (Number.isFinite(now)) {
          assert.deepEqual(capture(() => current.buildHit(origin, movement, now)),
            capture(() => released.buildHit(origin, movement, before)));
        }
      }
    }
  }
  assert.deepEqual(capture(() => current.buildHit({ x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }, 0)),
  capture(() => released.buildHit({ x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }, 0)));
});

test("p3553 and legacy obstacle OBB projections match release", async () => {
  const triangles = (await realTriangles()).slice(0, 12).map((triangle, index) => ({
    ...triangle,
    ...(index === 0 ? { motion: { x: 1, y: 2, z: -3 }, velFactor: 0.5,
      pressMode: "test" } : {}),
    ...(index === 1 ? { motion: undefined, velFactor: undefined } : {}),
  }));
  const obb = {
    center: { x: 0, y: 0, z: 0 },
    axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    halfExtents: [1e6, 1e6, 1e6],
  };
  const selected = (triangle, box) => triangle === triangles[0] ||
    triangle === triangles[1] ||
    (box === obb && triangle === triangles[2]);
  for (const query of [Oo, selected]) {
    const current = new ObstacleSurface(triangles, query, Oo);
    const released = new OriginalObstacleSurface(triangles, query);
    assert.deepEqual(current.queryObb(obb), released.queryObb(obb));
  }
});

test("obstacle hit surface motion and tie order match release", async () => {
  const triangle = (await realTriangles())[0];
  const triangles = [{ ...triangle, motion: { x: 2, y: -4, z: 1 } },
    { ...triangle, motion: { x: 9, y: 9, z: 9 } }];
  const current = new ObstacleSurface(triangles, Oo, Oo);
  const released = new OriginalObstacleSurface(triangles, Oo);
  const center = { x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
    y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
    z: (triangle.a.z + triangle.b.z + triangle.c.z) / 3 };
  const origin = { x: center.x - triangle.normal.x * 5,
    y: center.y - triangle.normal.y * 5,
    z: center.z - triangle.normal.z * 5 };
  const movement = { x: triangle.normal.x * 10,
    y: triangle.normal.y * 10, z: triangle.normal.z * 10 };
  const now = current.queryBest(origin, movement, true);
  const before = released.queryBest(origin, movement, true);
  assert.equal(now, before);
  assert.equal(current.bestTriangle, triangles[0]);
  assert.deepEqual(current.buildHit(origin, movement, now),
    released.buildHit(origin, movement, before));
});
