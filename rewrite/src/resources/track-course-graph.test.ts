import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inflateSync } from "node:zlib";

import { RhoReader } from "../codecs/rho";
import { y9 } from "../generated/formats.js";
import type { RhoArchiveIndex } from "./archive-index";
import { buildTrackCourseGraph } from "./track-course-graph";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function originalBuilder(source: string): (objects: unknown[], reverse: boolean) => unknown {
  const start = source.indexOf("function QW(");
  const end = source.indexOf("\nfunction qG(", start);
  assert.ok(start >= 0 && end > start);
  const attribute = (node: { attributes: Array<{ name: string; value: string }> },
    name: string) => node.attributes.find(entry => entry.name === name)?.value;
  const world = (vector: number[]) =>
    ({ x: vector[0]!, y: vector[2]!, z: -vector[1]! });
  return new Function("T", "ne", `${source.slice(start, end)}\nreturn JW;`)(
    attribute, world) as (objects: unknown[], reverse: boolean) => unknown;
}

function road(name: string, records: string[]) {
  return { kind: "ToRoad", name, cyclic: false, records: records.map((recordName, index) => {
    const x = index * 10;
    return {
      name: recordName,
      surface: `surface-${index}`,
      positions: [
        [x, 0, 0], [x, 1, 0], [x, 0, 1],
        [x + 1, 0, 0], [x + 1, 1, 0], [x + 1, 0, 1],
      ],
      gateIndices: [[0, 1, 2], [3, 4, 5]],
      frames: [
        { position: [x, 0, 0], storedForward: [1, 0, 0], up: [0, 0, 1] },
        { position: [x + 5, 0, 0], storedForward: [1, 0, 0], up: [0, 0, 1] },
      ],
    };
  }) };
}
function node(name: string, attrs: Record<string, string> = {}, children: unknown[] = []) {
  return { name, attributes: Object.entries(attrs).map(([key, value]) =>
    ({ name: key, value })), children };
}
function fixture(course: ReturnType<typeof node>, roads: Array<ReturnType<typeof road>>) {
  return [
    { kind: "TrackObject", name: "track", property: node("property", {}, [course]) },
    ...roads,
  ];
}

test("原版 course 路线图正反向、重复道路选择与分支连接一致", async () => {
  const original = originalBuilder(await readFile(releaseFile, "utf8"));
  const scenarios = [
    fixture(node("course", {}, [node("road", { name: "roadA", final: "end" })]),
      [road("roadA", ["start", "end"])]),
    fixture(node("course", {}, [node("road", {
      name: "roadA", start: "two", end: "one", reverse: "yes",
    })]), [road("roadA", ["one", "two"])]),
    fixture(node("course", {}, [node("road", {
      name: "duplicated", start: "one", end: "two",
    })]), [road("duplicated", ["other"]), road("duplicated", ["one", "two"])]),
    fixture(node("course", {}, [
      node("road", { name: "entry" }),
      node("branch", {}, [
        node("alternative", {}, [node("road", { name: "left" })]),
        node("alternative", {}, [node("road", { name: "right" })]),
      ]),
      node("road", { name: "finish" }),
    ]), [road("entry", ["entry"]), road("left", ["left"]),
      road("right", ["right"]), road("finish", ["finish"])]),
  ];
  for (const [index, objects] of scenarios.entries()) {
    for (const reverse of [false, true]) {
      const actual = buildTrackCourseGraph(objects as Parameters<typeof buildTrackCourseGraph>[0], reverse);
      const expected = original(objects, reverse);
      assert.deepEqual(actual, expected, `course fixture ${index}, forceReverse=${reverse}`);
    }
  }
});

test("缺失 course、ToRoad、检查门及空分支保留发行版错误", async () => {
  const original = originalBuilder(await readFile(releaseFile, "utf8"));
  const noGates = road("bad", ["entry"]);
  noGates.records[0]!.gateIndices = [];
  const scenarios = [
    [{ kind: "TrackObject", name: "track", property: node("property") }],
    fixture(node("course", {}, [node("road", { name: "missing" })]), []),
    fixture(node("course", {}, [node("road", { name: "empty" })]),
      [road("empty", [])]),
    fixture(node("course", {}, [node("road", { name: "bad" })]), [noGates]),
    fixture(node("course", {}, [node("branch")]), []),
    fixture(node("course", {}, [node("branch", {}, [node("alternative")])]), []),
  ];
  const outcome = (run: () => unknown) => {
    try { return { value: run() }; }
    catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
  };
  for (const [index, objects] of scenarios.entries()) {
    assert.deepEqual(outcome(() => buildTrackCourseGraph(
      objects as Parameters<typeof buildTrackCourseGraph>[0], false)),
    outcome(() => original(objects, false)), `invalid course fixture ${index}`);
  }
});

test("真实 p3553 赛道路线图逐字段与发行版一致", async () => {
  const original = originalBuilder(await readFile(releaseFile, "utf8"));
  const archiveIndex = JSON.parse(inflateSync(await readFile(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as
    { rho: RhoArchiveIndex[] };
  const archive = archiveIndex.rho.find(entry => entry.name === "track_fairy_I01.rho");
  assert.ok(archive);
  const source = await readFile(path.resolve(project, "../mirror/p3553", archive.name));
  const copy = (chunk: Uint8Array): ArrayBuffer =>
    Uint8Array.from(chunk).buffer as ArrayBuffer;
  const reader = new RhoReader({
    name: archive.name, size: source.length,
    arrayBuffer: async () => copy(source),
    slice: (start = 0, end = source.length) => ({
      arrayBuffer: async () => copy(source.subarray(start, end)),
    }),
  }, archive);
  const parsed = y9(await reader.read("track.1s"));
  assert.equal(parsed.root.kind, "track");
  const objects = parsed.root.trackObjects;
  for (const reverse of [false, true]) {
    const actual = buildTrackCourseGraph(objects as Parameters<typeof buildTrackCourseGraph>[0], reverse);
    assert.deepEqual(actual, original(objects, reverse), `forceReverse=${reverse}`);
  }
});
