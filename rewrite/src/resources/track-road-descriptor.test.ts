import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  anyRoadIssue, isMovableRoad, movingRoadIssue, roadRail, roadSound,
  roadSurface, roadSurfaceIssue, staticRoadIssue,
} from "./track-road-descriptor";
import type { RoadDescriptor, RoadMeshRef } from "./track-road-extraction";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseRoadRules() {
  const source = await readFile(releaseFile, "utf8");
  const start = source.indexOf("const EW =");
  const end = source.indexOf("function P6(", start);
  assert.ok(start >= 0 && end > start);
  return new Function(`${source.slice(start, end)}
    return { VG, Ri, TW, mo, Fl, NG, Vm, _W };`)() as {
    VG: typeof roadSurface; Ri: typeof roadRail;
    TW: typeof roadSound; mo: typeof isMovableRoad;
    Fl: typeof movingRoadIssue; NG: typeof anyRoadIssue;
    Vm: typeof staticRoadIssue; _W: typeof roadSurfaceIssue;
  };
}

function descriptor(attributes: Array<[string, string]>, text = "",
  children: unknown[] = []): RoadDescriptor {
  return { road: { name: "road", text, children,
    attributes: attributes.map(([name, value]) => ({ name, value })) },
    texture: { value: { kind: "texture" } },
    property: { value: { name: "property", text: "", children: [],
      attributes: [] } }, declaredAt: { node: {} } } as unknown as RoadDescriptor;
}

function mesh(classes: string[], prsAt?: number,
  unsupportedAt?: number): RoadMeshRef {
  let parent: RoadMeshRef | undefined;
  for (let index = classes.length - 1; index >= 0; index--) {
    const slotOccurrences = Array.from({ length: 3 });
    if (index === prsAt) slotOccurrences[1] = { value: { kind: "prs" } };
    if (index === unsupportedAt) slotOccurrences[0] = { value: { kind: "visibility" } };
    parent = { node: { className: classes[index], slotOccurrences },
      parent } as RoadMeshRef;
  }
  return parent!;
}

test("路面描述符属性、surface 令牌与发行版一致", async () => {
  const old = await releaseRoadRules();
  const surfaces = ["bcharge", "bcharget", "dirt", "pit", "retire",
    "slip", "리셋", "점프", "촋", "BH01", "MZ03", "BS09", "JM01",
    "DJ1/2/3", "DJ1/2", "DJabc/2/3", "BH01.abc", "MZ01.abc",
    "unknown", "", "DJ//3/4"];
  for (const value of surfaces)
    assert.equal(roadSurfaceIssue(value), old._W(value), value);

  const cases = [
    descriptor([["surface", "BH01"], ["sound", "engine"], ["rail", "1"]]),
    descriptor([["surface", "unhandled"]]),
    descriptor([["surface", "BS09"], ["surface", "BS09"]]),
    descriptor([["surface", "BS09"], ["unknown", "value"]]),
    descriptor([["movable", "true"]]),
    descriptor([["movable", "false"]]),
    descriptor([], "not empty"),
    descriptor([], "", [{ name: "extra" }]),
  ];
  for (const entry of cases) {
    assert.equal(roadSurface(entry), old.VG(entry));
    assert.equal(roadRail(entry), old.Ri(entry));
    assert.equal(roadSound(entry), old.TW(entry));
    assert.equal(isMovableRoad(entry), old.mo(entry));
    assert.equal(staticRoadIssue(entry), old.Vm(entry));
  }
});

test("movable road 的祖先 PRS、类约束及 controller 限制与发行版一致", async () => {
  const old = await releaseRoadRules();
  const cases: Array<[RoadDescriptor, RoadMeshRef]> = [
    [descriptor([["surface", "BH01"], ["movable", "true"]]),
      mesh(["ReTriList", "Relement"], 1)],
    [descriptor([["surface", "BH01"], ["movable", "true"]]),
      mesh(["ReTriList", "Relement"])],
    [descriptor([["surface", "BH01"], ["movable", "true"]]),
      mesh(["ReTriList", "Relement"], undefined, 1)],
    [descriptor([["surface", "BH01"], ["movable", "true"]]),
      mesh(["ReTriList", "Unsupported"], 0)],
    [descriptor([["surface", "BH01"], ["movable", "true"]]),
      mesh(["ReTriList", "Unsupported"])],
    [descriptor([["surface", "BH01"]]),
      mesh(["ReTriList", "Relement"], 1)],
  ];
  for (const [entry, ancestry] of cases) {
    assert.equal(movingRoadIssue(entry, ancestry), old.Fl(entry, ancestry));
    assert.equal(anyRoadIssue(entry, ancestry), old.NG(entry, ancestry));
  }
});
