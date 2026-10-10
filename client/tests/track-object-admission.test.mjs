import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  admitTrackObject, blockedTrackObject, isRaceItemMode,
  movableObjectType, omittedTrackObject,
} from "../src/vehicle/track-object-admission.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = declarations.find(item => item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const Legacy = new Function("deps", `with (deps) {
  ${["n40", "E3", "At", "kC", "LC", "id"].map(original).join("\n")}
  return { n40, E3, At, kC, LC, id };
}`);

function occurrence(kind, name = kind, options = {}) {
  const property = options.type === undefined ? undefined : { children: [{
    name: options.nul ? "object\0junk" : "object",
    attributes: [{ name: options.nul ? "type\0junk" : "type", value: options.type }],
  }] };
  return {
    encoding: "source-bin", id: 48,
    value: { kind, name, property, itemOnly: !!options.itemOnly,
      ...options.value },
  };
}
function fixture(options = {}) {
  const log = [];
  const obstacle = options.obstacle ?? {
    status: "admit", hasPrs: true, pressMode: "tap",
    collisionTriangleCount: 12, markerProfile: ["left", "right"],
  };
  const event = options.event ?? {
    status: "parsed", prsNodes: 2, triangleCount: 12,
    sourceTriangleCount: 14, selectedTriangleCount: 12,
    skippedTriangleCount: 1, degenerateTriangleCount: 1,
    effect: {}, scalePercent: 20, gravity: 3, sound: options.sound,
  };
  const deps = {
    HG(value) { log.push(["item only", value.name]); return value.itemOnly; },
    Um(value) { log.push(["obstacle", value.name]); return obstacle; },
    $k(value) { log.push(["event", value.name]); return event; },
    eL(sound) { log.push(["event sound", sound?.name]); return sound?.unsupported; },
  };
  const ops = {
    isItemOnlyMovable: deps.HG,
    admitObstacle: deps.Um,
    parseEvent: deps.$k,
    unsupportedEventSound: deps.eL,
  };
  return { log, deps, ops };
}
function evaluate(kind, entry, mode, options = {}) {
  const f = fixture(options);
  const legacy = Legacy(f.deps);
  try {
    const record = kind === "original"
      ? legacy.n40(entry, 3, mode, { source: "track.rho" },
        options.lensFlareCount ?? 1, options.courseSoundEnabled ?? true,
        options.lteCoinsEnabled ?? true)
      : admitTrackObject(entry, 3, mode, { source: "track.rho" },
        options.lensFlareCount ?? 1, options.courseSoundEnabled ?? true,
        options.lteCoinsEnabled ?? true, f.ops);
    return { record, log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("track object admission decisions match release across object kinds and modes", () => {
  const cases = [
    [occurrence("TrackObject", "track"), "time-attack"],
    [occurrence("TrackObject", "other"), "time-attack"],
    [occurrence("ToRoad"), "speed-individual"],
    [occurrence("ToDummy", "sound_wind", { value: { property: { children: [
      { name: "sound", attributes: [{ name: "filename", value: "wind" }] },
    ] } } }), "time-attack"],
    [occurrence("ToDummy", "sound_wind"), "time-attack", { courseSoundEnabled: false }],
    [occurrence("ToDummy", "lensflare"), "time-attack"],
    [occurrence("ToDummy", "lensflare"), "time-attack", { lensFlareCount: 2 }],
    [occurrence("ToDummy", "lensflare"), "item"],
    [occurrence("ToBlackPlane"), "time-attack"],
    [occurrence("ToMinimap"), "time-attack"],
    [occurrence("ToMinimap"), "speed-individual"],
    [occurrence("ToItemCube"), "time-attack"],
    [occurrence("ToItemCube"), "item"],
    [occurrence("ToItemCube"), "rp"],
    [occurrence("ToLucci"), "speed-individual"],
    [occurrence("ToLucci"), "speed-individual", { lteCoinsEnabled: false }],
    [occurrence("ToMesh"), "time-attack"],
    [occurrence("ToEventMesh"), "time-attack"],
    [occurrence("unknown"), "time-attack"],
    [occurrence("ToMovableObject", "obj", { itemOnly: true, type: "obstacle" }), "time-attack"],
    [occurrence("ToMovableObject"), "time-attack"],
    [occurrence("ToMovableObject"), "item"],
    [occurrence("ToMovableObject", "obj", { type: "dummy" }), "speed-individual"],
    [occurrence("ToMovableObject", "obj", { type: "itemCube" }), "time-attack"],
    [occurrence("ToMovableObject", "obj", { type: "itemCube" }), "item"],
    [occurrence("ToMovableObject", "obj", { type: "banana" }), "time-attack"],
    [occurrence("ToMovableObject", "obj", { type: "banana" }), "item"],
    [occurrence("ToMovableObject", "obj", { type: "obstacle" }), "time-attack"],
    [occurrence("ToMovableObject", "obj", { type: "obstacle" }), "item"],
    [occurrence("ToMovableObject", "obj", { type: "obstacle" }), "time-attack",
      { obstacle: { status: "block", reason: "bad model" } }],
    [occurrence("ToMovableObject", "obj", { type: "event" }), "time-attack"],
    [occurrence("ToMovableObject", "obj", { type: "event" }), "item"],
    [occurrence("ToMovableObject", "obj", { type: "event" }), "speed-individual",
      { event: { status: "block", reason: "bad model" } }],
    [occurrence("ToMovableObject", "obj", { type: "event" }), "time-attack",
      { sound: { name: "wind", unsupported: "panning" } }],
    [occurrence("ToMovableObject", "obj", { type: "mystery" }), "time-attack"],
  ];
  for (const [entry, mode, options = {}] of cases)
    assert.deepEqual(evaluate("rewritten", entry, mode, options),
      evaluate("original", entry, mode, options),
      `${entry.value.kind}/${entry.value.property?.children?.[0]?.attributes?.[0]?.value ?? ""} ${mode}`);
});

test("track admission utility readers and decision records match release", () => {
  const f = fixture();
  const legacy = Legacy(f.deps);
  const object = occurrence("ToMovableObject", "obj", { nul: true, type: "obstacle\0suffix" }).value;
  assert.equal(movableObjectType(object), legacy.kC(object));
  for (const mode of ["time-attack", "speed-individual", "speed-team", "item", "rp"])
    assert.equal(isRaceItemMode(mode), legacy.id(mode));
  const base = { occurrence: { kind: "track-object", index: 3, encoding: "bin",
    objectId: 10, className: "ToDummy", name: "dummy" },
  mode: "time-attack", source: { source: "track.rho" } };
  assert.deepEqual(omittedTrackObject(base, "test"), legacy.E3(base, "test"));
  assert.deepEqual(blockedTrackObject(base, "test"), legacy.At(base, "test"));
});
