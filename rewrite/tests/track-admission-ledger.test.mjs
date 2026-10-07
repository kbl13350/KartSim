import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { routeSurfaceKind } from "../src/world/route-tag.ts";
import {
  buildTrackAdmissionLedger, flashRouteRecord, isIndividualRouteTag,
  routeSurfaceRecord,
} from "../src/vehicle/track-admission-ledger.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = declarations.find(item => item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const Legacy = new Function("deps", `with (deps) {
  ${["Y30", "t40", "n40", "E3", "At", "kC", "LC", "id"].map(original).join("\n")}
  return { Y30, t40 };
}`);

function movableType(type) {
  return { children: [{ name: "object", attributes: [{ name: "type", value: type }] }] };
}
function occurrence(kind, name, extra = {}) {
  return { encoding: "source-bin", id: 4, value: { kind, name, ...extra } };
}

function fixture(options = {}) {
  const log = [];
  const surfaces = options.surfaces ?? [
    "", "rail", "norain", "nosnow", "rail, norain", "warpnext", "flash",
    "shake12,20", "wave1,2,3,4", "zoomOut20.100", "zoom20.050", "lensflare",
    "petSuccess", "unknown", "event3", "raiil", "start",
  ];
  const road = occurrence("ToRoad", "road", { records: surfaces.map(surface => ({ surface })) });
  const obstacle = occurrence("ToMovableObject", "obstacle", { property: movableType("obstacle") });
  const dummy = occurrence("ToDummy", "lensflare");
  const entries = [road, obstacle, dummy];
  const model = { root: {
    kind: options.kind ?? "track",
    trackObjects: entries.map(entry => entry.value),
    trackObjectOccurrences: options.noOccurrences ? undefined : entries,
    scene: { id: "scene" },
  } };
  const uses = [
    { descriptor: { texture: { encoding: "bmp", id: 10 }, property: { id: 1 },
      moving: false }, mesh: { node: { className: "ReTriList", name: "road" } } },
    { descriptor: { texture: { encoding: "bmp", id: 11 }, property: { id: 2 },
      moving: true }, mesh: { node: { className: "ReTriStrip", name: "moving" } } },
    { descriptor: { texture: { encoding: "bmp", id: 12 }, property: { id: 3 },
      unsupported: "bad material" }, mesh: { node: { className: "ReTriList", name: "bad" } } },
  ];
  const deps = {
    Eg(surface) { log.push(["route kind", surface]); return routeSurfaceKind(surface); },
    qG(scene) { log.push(["descriptor uses", scene.id]); return { descriptorUses: uses }; },
    mo(descriptor) { log.push(["deferred", descriptor.property.id]); return !!descriptor.moving; },
    NG(descriptor, mesh) { log.push(["unsupported", descriptor.property.id, mesh.node.name]);
      return descriptor.unsupported; },
    HG(object) { log.push(["item only", object.name]); return false; },
    Um(object) { log.push(["obstacle", object.name]); return {
      status: "admit", hasPrs: false, pressMode: undefined,
      collisionTriangleCount: 2, markerProfile: [],
    }; },
    $k(object) { log.push(["event", object.name]); return { status: "block", reason: "unknown" }; },
    eL(sound) { log.push(["sound", sound]); return undefined; },
  };
  const ops = {
    routeSurfaceKind: deps.Eg,
    descriptorUses: deps.qG,
    isDeferredRoad: deps.mo,
    unsupportedRoad: deps.NG,
    isItemOnlyMovable: deps.HG,
    admitObstacle: deps.Um,
    parseEvent: deps.$k,
    unsupportedEventSound: deps.eL,
  };
  return { log, model, road, ops, deps };
}

function evaluate(kind, mode, options = {}) {
  const f = fixture(options);
  const originalFns = Legacy(f.deps);
  const source = { origin: "track.rho" };
  const admissionOptions = options.admissionOptions ?? {
    weather: { rainEnabled: true, rainOnStart: true, snowEnabled: true },
    warp: { inType: "fairy" }, p3553CourseSound: true, lteCoins: true,
  };
  try {
    const result = kind === "original"
      ? originalFns.Y30(f.model, source, mode, admissionOptions)
      : buildTrackAdmissionLedger(f.model, source, mode, admissionOptions, f.ops);
    return { result, log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("track admission ledger preserves weather, objects, route order, and road descriptors", () => {
  for (const mode of ["time-attack", "speed-individual", "speed-team", "item"]) {
    for (const options of [
      {},
      { admissionOptions: { weather: { rainEnabled: true, snowEnabled: true,
        lightningSound: "thunder" }, p3553CourseSound: false } },
      { admissionOptions: { weather: {}, warp: { inType: "normal" } } },
      { kind: "node" }, { noOccurrences: true },
    ]) assert.deepEqual(evaluate("rewritten", mode, options),
      evaluate("original", mode, options), `${mode} ${JSON.stringify(options)}`);
  }
});

test("route surface and flash records match the release for all finite tags", () => {
  const f = fixture();
  const originalFns = Legacy(f.deps);
  const source = { origin: "track.rho" };
  const options = { weather: { rainEnabled: true, snowEnabled: true }, warp: { inType: "fairy" } };
  for (const mode of ["time-attack", "speed-individual", "item"])
    for (const surface of ["", "rail", "norain", "nosnow", "rail, norain", "flash",
      "warpnext", "shake12,20", "wave1,2,3,4", "zoom20.050", "lensflare",
      "event3", "unknown"]) {
      const original = originalFns.Y30({ root: {
        kind: "track", trackObjects: [f.road.value], trackObjectOccurrences: [
          { ...f.road, value: { ...f.road.value, records: [{ surface }] } },
        ], scene: { id: "scene" },
      } }, source, mode, options).records.find(record => record.occurrence.kind === "route-surface");
      const rewritten = routeSurfaceRecord(f.road, 0, 0, surface, mode, source, 0, options, f.ops);
      assert.deepEqual(rewritten, original, `${mode}/${surface}`);
    }
  assert.deepEqual(flashRouteRecord(f.road, 0, 0, source, "time-attack"),
    originalFns.t40(f.road, 0, 0, source, "time-attack"));
  for (const tag of ["start", "event3", "shake12,20", "wave1,2,3,4", "zoom20.050"])
    assert.equal(isIndividualRouteTag(tag), ["start", "shake12,20", "wave1,2,3,4", "zoom20.050"].includes(tag));
});
