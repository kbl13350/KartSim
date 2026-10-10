import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { decodeArchiveIndex } from "../resources/archive-index.ts";
import { RhoReader } from "../codecs/rho.ts";
import { MovingTrackSurface } from "./moving-track-surface.ts";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
const { y9, YW } = await import("../generated/formats.js");
const { Bg, Oo, pi0, vv } = await import("../generated/driving.js");
const { I1, N1, Rg, Tt, t0 } = await import("../generated/math.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");
const source = await readFile(path.join(root, "recovered/formatted/index.js"), "utf8");
const snippet = (startText, nextText) => {
  const start = source.indexOf(startText);
  const end = source.indexOf(nextText, start);
  assert.ok(start >= 0 && end > start, `${startText} source boundary`);
  return source.slice(start, end);
};
const OriginalMovingTrackSurface = new Function("I1", "N1", "Tt", "Rg", "t0", "pi0",
  "Bg", "Oo", "vv",
  `${snippet("class gi0 {", "class eE {")}\n` +
  `${snippet("function Mi0(", "function N1(")}\n` +
  `${snippet("function xi0(", "function t0(")}\n` +
  `${snippet("function Av(", "function nE(")}\n` +
  `${snippet("function Mv(", "function xt(")}\n` +
  `${snippet("function bv(", "function Rg(")}\nreturn gi0;`,
)(I1, N1, Tt, Rg, t0, pi0, Bg, Oo, vv);

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

function movingFixture(triangles) {
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const converted = triangles.map(triangle => {
    const positions = [triangle.a, triangle.b, triangle.c]
      .map(vertex => [vertex.x, -vertex.z, vertex.y]);
    const node = { vertexData: { positions } };
    return { ...triangle, origin: { mesh: { node }, localIndices: [0, 1, 2] } };
  });
  return { matrix, triangles: converted, elements: () => matrix };
}

function summary(surface) {
  return {
    lastUpdateMs: surface.lastUpdateMs,
    triangles: surface.triangles.map(triangle => ({
      a: triangle.a, b: triangle.b, c: triangle.c,
      normal: triangle.normal, previousVertices: triangle.previousVertices,
      stagedVertices: triangle.stagedVertices,
      surfaceVelocity: triangle.surfaceVelocity,
    })),
  };
}

function capture(operation) {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
}

test("real p3553 moving-road geometry and frame velocity match release", async () => {
  const fixture = movingFixture((await realTriangles()).slice(0, 3));
  const current = new MovingTrackSurface(fixture.triangles, fixture.elements, Oo,
    { p3553ObbQuery: Oo });
  const released = new OriginalMovingTrackSurface(fixture.triangles, fixture.elements, Oo);
  assert.deepEqual(summary(current), summary(released));
  for (const [timeMs, x, y, z] of [
    [0, 0, 0, 0], [16, 1, -2, 0.5], [33, 3, -2, 0.5], [80, 3, 0, 1],
  ]) {
    fixture.matrix[12] = x;
    fixture.matrix[13] = y;
    fixture.matrix[14] = z;
    current.update(timeMs);
    released.update(timeMs);
    assert.deepEqual(summary(current), summary(released), `time ${timeMs}`);
  }
  current.rebase(); released.rebase();
  assert.deepEqual(summary(current), summary(released), "rebase");
});

test("moving road ray, hit and both OBB projections match release", async () => {
  const fixture = movingFixture((await realTriangles()).slice(0, 3));
  const queryAll = () => true;
  for (const query of [Oo, queryAll]) {
    const current = new MovingTrackSurface(fixture.triangles, fixture.elements, query,
      { p3553ObbQuery: Oo });
    const released = new OriginalMovingTrackSurface(fixture.triangles, fixture.elements, query);
    current.update(100); released.update(100);
    const triangle = current.triangles[0];
    const center = { x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
      y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
      z: (triangle.a.z + triangle.b.z + triangle.c.z) / 3 };
    const origin = { x: center.x - triangle.normal.x * 5,
      y: center.y - triangle.normal.y * 5,
      z: center.z - triangle.normal.z * 5 };
    const movement = { x: triangle.normal.x * 10,
      y: triangle.normal.y * 10, z: triangle.normal.z * 10 };
    for (const includeWalls of [false, true]) {
      const now = current.queryBest(origin, movement, includeWalls);
      const before = released.queryBest(origin, movement, includeWalls);
      assert.equal(now, before);
      if (Number.isFinite(now)) {
        assert.deepEqual(current.buildHit(origin, movement, now),
          released.buildHit(origin, movement, before));
      }
    }
    const box = { center,
      axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
      halfExtents: [5, 5, 5],
    };
    assert.deepEqual(current.queryObb(box), released.queryObb(box));
  }
});

test("moving-road missing matrices, local vertices and bad timestamps match release", async () => {
  const fixture = movingFixture((await realTriangles()).slice(0, 1));
  for (const [triangles, elements] of [
    [fixture.triangles, () => undefined],
    [fixture.triangles.map(triangle => ({ ...triangle, origin: {
      mesh: { node: {} }, localIndices: [0, 1, 2],
    } })), fixture.elements],
    [fixture.triangles.map(triangle => ({ ...triangle, origin: {
      mesh: triangle.origin.mesh, localIndices: [999, 1, 2],
    } })), fixture.elements],
  ]) {
    assert.deepEqual(capture(() => new MovingTrackSurface(triangles, elements, Oo,
      { p3553ObbQuery: Oo })),
    capture(() => new OriginalMovingTrackSurface(triangles, elements, Oo)));
  }
  const current = new MovingTrackSurface(fixture.triangles, fixture.elements, Oo,
    { p3553ObbQuery: Oo });
  const released = new OriginalMovingTrackSurface(fixture.triangles, fixture.elements, Oo);
  for (const timeMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(capture(() => current.update(timeMs)),
      capture(() => released.update(timeMs)));
  }
});
