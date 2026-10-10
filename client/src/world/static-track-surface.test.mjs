import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { decodeArchiveIndex } from "../resources/archive-index.ts";
import { RhoReader } from "../codecs/rho.ts";
import { StaticTrackSurface } from "./static-track-surface.ts";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
const { Vm, y9, YW } = await import("../generated/formats.js");
const { Bg, Oo, di0, vv } = await import("../generated/driving.js");
const { t0 } = await import("../generated/math.js");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");
const source = await readFile(path.join(root, "recovered/formatted/index.js"), "utf8");
const snippet = (startText, nextText) => {
  const start = source.indexOf(startText);
  const end = source.indexOf(nextText, start);
  assert.ok(start >= 0 && end > start, `${startText} source boundary`);
  return source.slice(start, end);
};
const OriginalStaticTrackSurface = new Function("t0", "Bg", "Vm", "Oo", "di0", "vv",
  `${snippet("class mi0 {", "function Re(")}\n` +
  `${snippet("function Re(", "function Ai0(")}\n` +
  `${snippet("function Av(", "function nE(")}\n` +
  `${snippet("function Mv(", "function xt(")}\n` +
  `${snippet("function bv(", "function E5(")}\nreturn mi0;`,
)(t0, Bg, Vm, Oo, di0, vv);

const dependencies = { p3553ObbQuery: Oo, p3553ObbBounds: di0,
  roadDescriptorIssue: Vm };

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

async function compactRealTriangles() {
  return (await realTriangles()).filter(triangle => {
    const vertices = [triangle.a, triangle.b, triangle.c];
    return Math.max(...vertices.map(vertex => vertex.x)) -
      Math.min(...vertices.map(vertex => vertex.x)) <= 16 &&
      Math.max(...vertices.map(vertex => vertex.z)) -
      Math.min(...vertices.map(vertex => vertex.z)) <= 16;
  });
}

function capture(operation) {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
}

test("real p3553 static road grid and ray hits match release", async () => {
  const triangles = (await compactRealTriangles()).slice(0, 20);
  assert.equal(triangles.length, 20);
  const current = new StaticTrackSurface(triangles, Oo, dependencies);
  const released = new OriginalStaticTrackSurface(triangles, Oo);
  assert.deepEqual(current.triangles.map(triangle =>
    [triangle.minX, triangle.maxX, triangle.minZ, triangle.maxZ]),
  released.triangles.map(triangle =>
    [triangle.minX, triangle.maxX, triangle.minZ, triangle.maxZ]));
  assert.deepEqual(current.cells, released.cells);
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
});

test("static road p3553 and legacy OBB queries match release", async () => {
  const triangles = (await compactRealTriangles()).slice(0, 20);
  const sample = triangles[2];
  const center = { x: sample.a.x, y: sample.a.y, z: sample.a.z };
  const box = { center,
    axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
    halfExtents: [4, 4, 4],
  };
  const legacyQuery = () => true;
  for (const query of [Oo, legacyQuery]) {
    const current = new StaticTrackSurface(triangles, query, dependencies);
    const released = new OriginalStaticTrackSurface(triangles, query);
    assert.deepEqual(current.queryObb(box), released.queryObb(box));
    assert.deepEqual(current.obbCandidates, released.obbCandidates);
  }
});

test("empty geometry, descriptor errors and equal-depth ties match release", async () => {
  assert.deepEqual(capture(() => new StaticTrackSurface([], Oo, dependencies)),
    capture(() => new OriginalStaticTrackSurface([], Oo)));
  const triangle = (await compactRealTriangles())[0];
  const invalid = [{ ...triangle, roadDescriptor: { road: {
    text: "bad", children: [], attributes: [],
  } } }];
  assert.deepEqual(capture(() => new StaticTrackSurface(invalid, Oo, dependencies)),
    capture(() => new OriginalStaticTrackSurface(invalid, Oo)));
  const triangles = [triangle, { ...triangle }];
  const current = new StaticTrackSurface(triangles, Oo, dependencies);
  const released = new OriginalStaticTrackSurface(triangles, Oo);
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
  assert.equal(current.bestTriangle, current.triangles[1]);
  assert.deepEqual(current.buildHit(origin, movement, now),
    released.buildHit(origin, movement, before));
});
