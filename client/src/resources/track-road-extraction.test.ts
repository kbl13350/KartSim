import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { RhoReader } from "../codecs/rho";
import { Vm, y9 } from "../generated/formats.js";
import type { RhoArchiveIndex } from "./archive-index";
import { extractTrackRoads, type RoadModelNode } from "./track-road-extraction";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function originalRoadExtraction(): Promise<(root: RoadModelNode) =>
  ReturnType<typeof extractTrackRoads>> {
  const source = await readFile(releaseFile, "utf8");
  const section = (first: string, last: string) => {
    const start = source.indexOf(first);
    const end = source.indexOf(last, start);
    assert.ok(start >= 0 && end > start, `${first}..${last}`);
    return source.slice(start, end);
  };
  return new Function(`${section('const EW =', 'function P6(')}
    ${section('function d4(', 'function dH(')}
    ${section('function UH(', 'function xu(')}
    ${section('function ne(', 'function a3(')}
    ${section('function jH(', 'class YH ')}
    return qG;`)() as (root: RoadModelNode) =>
      ReturnType<typeof extractTrackRoads>;
}

const identity: [number, number, number][] = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1],
];

function model(name: string, className = "Relement",
  changes: Partial<RoadModelNode> = {}): RoadModelNode {
  return { name, className, children: [], transform: identity,
    position: [0, 0, 0], scale: [1, 1, 1],
    slots: Array.from({ length: 11 }),
    slotOccurrences: Array.from({ length: 11 }), ...changes };
}

function roadOn(node: RoadModelNode, surface = "BH01", encoding = "new") {
  node.slotOccurrences[7] = {
    value: { kind: "texture", propertyOccurrence: {
      encoding, value: { name: "property", text: "", attributes: [],
        children: [{ name: "road", text: "", children: [],
          attributes: [{ name: "surface", value: surface }] }] },
    } },
  };
  node.slots[7] = node.slotOccurrences[7]!.value;
}

function mesh(name: string, className = "ReTriList"): RoadModelNode {
  return model(name, className, { vertexData: {
    positions: [[10, 10, 0], [12, 10, 0], [10, 12, 0], [12, 12, 0]],
    indices: className === "ReTriStrip" ? [0, 1, 2, 3] : [0, 1, 2, 1, 3, 2],
    uvs: [[[0, 0]], [[1, 0]], [[0, 1]], [[1, 1]]],
  } });
}

test("路线网格、继承、逆面、strip 及材质拒绝与发行版一致", async () => {
  const original = await originalRoadExtraction();
  const cases: RoadModelNode[] = [];
  cases.push(model("empty"));
  const direct = model("root");
  const directMesh = mesh("direct");
  roadOn(directMesh);
  direct.children.push(directMesh);
  cases.push(direct);
  const inherited = model("root", "Relement", {
    position: [2, 4, 0], scale: [1.25, 1, 1],
  });
  roadOn(inherited, "BS09", "reference");
  const strip = mesh("strip", "ReTriStrip");
  strip.slotOccurrences[4] = { value: { kind: "backface", cull: 3 } };
  strip.slots[4] = strip.slotOccurrences[4]!.value;
  inherited.children.push(strip);
  cases.push(inherited);
  const rejected = model("root");
  const rejectedMesh = mesh("deferred");
  roadOn(rejectedMesh, "unhandled");
  rejected.children.push(rejectedMesh);
  cases.push(rejected);
  const cleared = model("root");
  roadOn(cleared);
  const clearChild = mesh("cleared");
  clearChild.slotOccurrences[7] = { value: { kind: "texture" } };
  clearChild.slots[7] = clearChild.slotOccurrences[7]!.value;
  cleared.children.push(clearChild);
  cases.push(cleared);
  const unsupported = model("root");
  roadOn(unsupported);
  unsupported.children.push(model("rigid", "ReToonRigid", {
    rigidGeometry: { positions: [] },
  }));
  cases.push(unsupported);

  for (const candidate of cases) {
    const old = original(structuredClone(candidate));
    const current = extractTrackRoads(structuredClone(candidate),
      descriptor => {
        const road = descriptor.road;
        const surface = road.attributes.find(attribute =>
          attribute.name === "surface")?.value;
        return surface === "unhandled"
          ? "road surface=unhandled 尚未接入已证 consumer" : undefined;
      });
    assert.deepEqual(current, old, candidate.name);
  }
  assert.equal(extractTrackRoads(direct, () => undefined).stats.roadMeshCount, 1);
  assert.equal(extractTrackRoads(inherited, () => undefined).stats.reversedTriangleCount, 2);
});

test("缺失 occurrence 和越界 road 索引保持原版诊断", async () => {
  const original = await originalRoadExtraction();
  const badSlot = model("root");
  badSlot.slots[7] = { kind: "texture" };
  const badIndex = mesh("bad");
  roadOn(badIndex);
  badIndex.vertexData!.indices[0] = 99;
  for (const candidate of [badSlot, badIndex]) {
    let originalError = "";
    let currentError = "";
    try { original(structuredClone(candidate)); }
    catch (error) { originalError = (error as Error).message; }
    try { extractTrackRoads(structuredClone(candidate), () => undefined); }
    catch (error) { currentError = (error as Error).message; }
    assert.ok(originalError);
    assert.equal(currentError, originalError);
  }
});

test("真实 p3553 赛道的全部路面三角形与发行版一致", async () => {
  const original = await originalRoadExtraction();
  const archiveIndex = JSON.parse(inflateSync(await readFile(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as
    { rho: RhoArchiveIndex[] };
  const archive = archiveIndex.rho.find(entry => entry.name === "track_fairy_I01.rho");
  assert.ok(archive);
  const bytes = await readFile(path.resolve(project, "../mirror/p3553", archive.name));
  const copy = (chunk: Uint8Array): ArrayBuffer =>
    Uint8Array.from(chunk).buffer as ArrayBuffer;
  const reader = new RhoReader({
    name: archive.name, size: bytes.length,
    arrayBuffer: async () => copy(bytes),
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => copy(bytes.subarray(start, end)),
    }),
  }, archive);
  const parsed = y9(await reader.read("track.1s"));
  assert.equal(parsed.root.kind, "track");
  const scene = parsed.root.scene as RoadModelNode;
  const expected = original(scene);
  const actual = extractTrackRoads(scene, Vm);
  assert.deepEqual(actual.stats, expected.stats);
  const summary = (result: ReturnType<typeof extractTrackRoads>) => ({
    triangles: result.triangles.map(triangle => [triangle.a, triangle.b,
      triangle.c, triangle.normal, triangle.auxiliaryDirection,
      triangle.origin.localIndices]),
    deferred: result.deferredTriangles.map(triangle => [triangle.a,
      triangle.b, triangle.c, triangle.normal, triangle.auxiliaryDirection,
      triangle.origin.localIndices]),
    issues: result.issues.map(issue => issue.reason),
    descriptorUseNames: result.descriptorUses.map(use => use.mesh.node.name),
  });
  assert.deepEqual(summary(actual), summary(expected));
});
