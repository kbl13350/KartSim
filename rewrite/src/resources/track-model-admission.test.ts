import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inflateSync } from "node:zlib";
import { RhoReader } from "../codecs/rho";
import { y9 } from "../generated/formats.js";
import type { RhoArchiveIndex } from "./archive-index";
import { admitMovingObstacle } from "./moving-obstacle";
import { buildTrackCourseGraph } from "./track-course-graph";
import { staticRoadIssue } from "./track-road-descriptor";
import { extractTrackRoads } from "./track-road-extraction";
import { extractTrackRoute, itemGameOnly, readTrackSettings,
  soloTrackMode, trackRuntimeIssues,
  type ParsedTrackContainer } from "./track-model-admission";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const releaseFile = path.resolve(project, "../recovered/formatted/index.js");

async function originalTrackAdmission() {
  const source = await readFile(releaseFile, "utf8");
  const names = new Set(["XW", "YW", "ZW", "HG", "Au", "Wn"]);
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const { parse } = require("@babel/parser") as typeof import("@babel/parser");
  const body = parse(source, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration" &&
      names.has(node.id!.name)).map(node => source.slice(node.start!, node.end!))
    .join("\n");
  const qG = (scene: Parameters<typeof extractTrackRoads>[0]) =>
    extractTrackRoads(scene, staticRoadIssue);
  const Hm = (value: unknown) => !!(value && typeof value === "object" &&
    (value as { kind?: string }).kind === "track");
  return new Function("qG", "JW", "Um", "Hm", `${body}
    return { XW, YW, ZW, HG, Au };`)(qG, buildTrackCourseGraph,
    admitMovingObstacle, Hm) as {
      XW: typeof readTrackSettings;
      YW: typeof extractTrackRoute;
      ZW: typeof trackRuntimeIssues;
      HG: typeof itemGameOnly;
      Au: typeof soloTrackMode;
    };
}

interface XmlFixture {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: XmlFixture[];
}
function xml(name: string, attributes: Array<[string, string]> = [],
  children: XmlFixture[] = []): XmlFixture {
  return { name, attributes: attributes.map(([key, value]) =>
    ({ name: key, value })), children };
}

test("赛道相机、雾参数与运行对象准入问题和发行版一致", async () => {
  const old = await originalTrackAdmission();
  const root = { kind: "track", name: "track", scene: {} as never,
    trackObjects: [
      { kind: "TrackObject", name: "track", property: xml("property", [], [
        xml("camera", [["far", "1250"]]),
        xml("fog", [["mode", "2"], ["r", "0.5"], ["g", "0.25"],
          ["b", "1"], ["start", "20"], ["end", "100"],
          ["density", "0.03"]]),
      ]) },
      { kind: "TrackObject", name: "extra" },
      { kind: "ToRoad", name: "route" },
      { kind: "ToDummy", name: "sound" },
      { kind: "ToBlackPlane", name: "black" },
      { kind: "ToMinimap", name: "map" },
      { kind: "ToItemCube", name: "cube" },
      { kind: "ToLucci", name: "coin" },
      { kind: "ToMovableObject", name: "", instanceOrdinal: 4,
        property: xml("property", [], [xml("object", [["type", "obstacle"]])]),
        object: { kind: "node", className: "Relement", name: "obstacle",
          children: [], slotOccurrences: [] } },
      { kind: "ToMovableObject", name: "effect", instanceOrdinal: 5,
        property: xml("property", [], [xml("object", [["type", "event"]])]) },
      { kind: "ToMovableObject", name: "item", instanceOrdinal: 6,
        property: xml("property", [], [xml("object", [["type", "itemCube"]])]) },
      { kind: "ToMovableObject", name: "item-only", instanceOrdinal: 7,
        property: xml("property", [], [xml("object", [["type", "event"],
          ["onlyItemGame", "true"]])]) },
    ],
  } as ParsedTrackContainer["root"];
  assert.deepEqual(readTrackSettings(root), old.XW(root));
  for (const mode of ["strict", "speed-individual", "time-attack", "item"])
    assert.deepEqual(trackRuntimeIssues({ root }, mode), old.ZW({ root }, mode),
      mode);
  for (const mode of ["strict", "speed-individual", "time-attack", "item"])
    assert.equal(soloTrackMode(mode), old.Au(mode));
  for (const entry of root.trackObjects)
    assert.equal(itemGameOnly(entry), old.HG(entry));
});

test("真实 p3553 赛道路线汇总与发行版一致", async () => {
  const old = await originalTrackAdmission();
  const index = JSON.parse(inflateSync(await readFile(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as
    { rho: RhoArchiveIndex[] };
  const archive = index.rho.find(entry => entry.name === "track_fairy_I01.rho");
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
  const parsed = y9(await reader.read("track.1s")) as ParsedTrackContainer;
  assert.deepEqual(readTrackSettings(parsed.root), old.XW(parsed.root));
  const summarize = (route: ReturnType<typeof extractTrackRoute>) => ({
    containerName: route.containerName,
    collisionStats: route.collisionStats,
    roadIssues: route.roadIssues.map(issue => issue.reason),
    runtimeIssues: route.runtimeIssues,
    sections: route.sections,
    firstSection: route.firstSection,
    lastSection: route.lastSection,
    start: route.start,
    triangles: route.collisionTriangles.map(triangle => [triangle.a,
      triangle.b, triangle.c, triangle.normal,
      triangle.auxiliaryDirection, triangle.origin.localIndices]),
  });
  for (const reverse of [false, true]) {
    const options = { forceReverse: reverse };
    assert.deepEqual(summarize(extractTrackRoute(parsed, "time-attack", options)),
      summarize(old.YW(parsed, "time-attack", options)),
      `forceReverse=${reverse}`);
  }
});
