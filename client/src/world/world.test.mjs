import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { parseResourceManifest } from "../resources/manifest.ts";
import { decodeArchiveIndex } from "../resources/archive-index.ts";
import { RhoReader } from "../codecs/rho.ts";
globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) };
const { installWorldOverrides } = await import("./install.ts");
const { createTrackWorld } = await import("./create-track-world.ts");
const { StaticTrackSurface } = await import("./static-track-surface.ts");
const { ObstacleSurface } = await import("./obstacle-surface.ts");
const { y9, YW, Fl, Ri, Vm } = await import("../generated/formats.js");
const { _L: TrackWorld } = await import("../generated/world.js");
const { Oo, di0 } = await import("../generated/driving.js");
const { D2, D9, T2 } = await import("../generated/vendor.js");
const released = Object.fromEntries([
  "projectSectionDistance", "sampleRoute", "updateEvents", "registerEventPairs",
  "expireEventEffects", "consumeExpiredEventEffects", "commitEventSnapshot",
  "queryEventObb", "updateRoute", "requireRouteState", "getRouteState",
  "resetRouteState", "refreshRouteProjection", "warpRouteToSection",
  "currentRouteSurface", "prepareCurrentSectionReset",
  "commitCurrentSectionReset", "rayQuery", "queryObb", "queryObstacleObb",
  "updateRender", "setLensFlareEnabled", "resetRender", "updateMovingRoads",
  "updateObstacles", "registerObstaclePair", "commitObstacleSnapshot",
  "associateRoute", "warpNextDestination", "completeWarpNextRailLanding",
  "railCaptureDistance", "completeRailContactLanding",
  "lookupRailConfig",
  "getStart", "runOuterRoutePass", "dispose",
].map(name => [name, TrackWorld.prototype[name]]));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const mirror = path.join(root, "mirror");

function memorySource(name, bytes) {
  const copy = part => Uint8Array.from(part).buffer;
  return {
    name, size: bytes.length,
    arrayBuffer: async () => copy(bytes),
    slice: (start = 0, end = bytes.length) => ({
      arrayBuffer: async () => copy(bytes.subarray(start, end)),
    }),
  };
}

let archiveIndexes;
const trackData = new Map();
async function realTrackData(name) {
  if (trackData.has(name)) return trackData.get(name);
  const pending = decodeTrackData(name);
  trackData.set(name, pending);
  return pending;
}

async function decodeTrackData(name) {
  archiveIndexes ??= (async () => {
    const manifest = parseResourceManifest(JSON.parse(await readFile(
      path.join(mirror, "__p3553/resources"), "utf8")), "p3553");
    const bytes = await readFile(path.join(mirror, "__p3553/archive-index"));
    return decodeArchiveIndex(Readable.toWeb(Readable.from([bytes])), manifest);
  })();
  const index = (await archiveIndexes).rho.find(entry => entry.name === name);
  assert.ok(index, `missing ${name} index`);
  const archive = memorySource(name, await readFile(path.join(mirror, "p3553", name)));
  const reader = new RhoReader(archive, index);
  const track = reader.files.find(file => file.path.toLowerCase() === "track.1s");
  assert.ok(track, `missing ${name}/track.1s`);
  return YW(y9(await reader.readRecord(track)), "time-attack");
}

async function realTrackSections(name) {
  return (await realTrackData(name)).sections;
}

function capture(operation) {
  try { return { ok: true, value: operation() }; }
  catch (error) { return { ok: false, error: error.message }; }
}

test("真实 p3553 赛道路线投影、前瞻采样与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  for (const archive of ["track_village_R01.rho", "track_village_R06.rho"]) {
    const sections = await realTrackSections(archive);
    assert.ok(sections.length > 3);
    const vehicle = {};
    const state = { section: 0, localDistance: 0 };
    const host = { sections, requireRouteState: () => state };
    let comparisons = 0;
    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      for (const frame of section.frames.slice(0, 4)) {
        for (const offset of [-2, 0, 0.25, 3]) {
          const point = {
            x: Math.fround(frame.position.x + offset),
            y: frame.position.y,
            z: Math.fround(frame.position.z + offset / 2),
          };
          assert.deepEqual(
            capture(() => TrackWorld.prototype.projectSectionDistance.call(host, point, section)),
            capture(() => released.projectSectionDistance.call(host, point, section)),
            `${archive} section ${index} projection`,
          );
          comparisons += 1;
        }
      }
      state.section = index;
      for (const localDistance of [0, section.length / 2, section.length]) {
        state.localDistance = localDistance;
        for (const lookahead of [0, 1, 10, 50]) {
          for (const edgeChoice of [0, 1]) {
            assert.deepEqual(
              capture(() => TrackWorld.prototype.sampleRoute.call(host,
                vehicle, lookahead, edgeChoice)),
              capture(() => released.sampleRoute.call(host,
                vehicle, lookahead, edgeChoice)),
              `${archive} section ${index} sample ${localDistance}/${lookahead}/${edgeChoice}`,
            );
            comparisons += 1;
          }
        }
      }
    }
    assert.ok(comparisons > 100, `${archive} yielded too few comparisons`);
  }
});

test("事件注册、过期和碰撞快照与发行版一致", () => {
  installWorldOverrides(TrackWorld);
  const names = ["updateEvents", "registerEventPairs", "expireEventEffects",
    "consumeExpiredEventEffects", "commitEventSnapshot", "queryEventObb"];
  function fixture() {
    const log = [];
    const events = Array.from({ length: 10 }, (_, id) => ({
      slot12: (time, owner) => log.push(["advance", id, time, owner]),
      registerKartPair: position => {
        log.push(["register", id, position.x]);
        return id !== 3;
      },
      expireEffects: time => {
        log.push(["expire", id, time]);
        return id === 2 ? [`effect:${time}`] : [];
      },
      firstOverlap: (box, filter) => {
        log.push(["overlap", id, box, filter]);
        return id === 0 ? { id } : undefined;
      },
    }));
    return { log, host: {
      data: { eventRuntimes: events }, eventClientWorldElements: "owner",
      activeEventRuntimes: [], expiredEventEffects: [],
    } };
  }
  function scenario(methods) {
    const { log, host } = fixture();
    host.expireEventEffects = methods.expireEventEffects;
    methods.updateEvents.call(host, 120);
    methods.registerEventPairs.call(host, { x: 1, y: 2, z: 3 }, 130);
    methods.commitEventSnapshot.call(host);
    const hits = methods.queryEventObb.call(host, "box", "filter");
    methods.expireEventEffects.call(host, 140);
    const expired = methods.consumeExpiredEventEffects.call(host);
    return { log, active: host.activeEventRuntimes.length,
      pending: host.pendingEventRuntimes, hits, expired,
      afterConsume: host.expiredEventEffects };
  }
  const handwritten = Object.fromEntries(names.map(name => [name, TrackWorld.prototype[name]]));
  assert.deepEqual(scenario(handwritten), scenario(released));
});

test("真实 p3553 路线门正反穿越、状态提交与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  const handwritten = TrackWorld.prototype;
  let exercisedTransitions = 0;
  for (const archive of ["track_village_R01.rho", "track_village_R06.rho"]) {
    const sections = await realTrackSections(archive);
    const data = { firstSection: 0, lastSection: sections.length - 1, lapTarget: 2 };
    function run(methods, sectionIndex, previous, current) {
      const vehicle = {};
      const routeStates = new WeakMap();
      const initial = {
        section: sectionIndex, lap: 1, localDistance: 0,
        completedDistance: 75, distance: 75,
        resetAux68: 3, resetAux74: 4, resetAux80: 5, resetAux8C: 6,
      };
      routeStates.set(vehicle, initial);
      const host = {
        sections, data, routeStates,
        requireRouteState: methods.requireRouteState,
        projectSectionDistance: methods.projectSectionDistance,
      };
      const tags = [];
      const result = capture(() => methods.updateRoute.call(host,
        vehicle, previous, current, (tag, frame) => tags.push([tag, frame])));
      return { result, tags, state: routeStates.get(vehicle) };
    }
    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
      const section = sections[sectionIndex];
      const gates = [...section.outgoing, ...section.incoming];
      for (const { gate } of gates) {
        const triangle = gate.triangles[0];
        const centroid = {
          x: (triangle[0].x + triangle[1].x + triangle[2].x) / 3,
          y: (triangle[0].y + triangle[1].y + triangle[2].y) / 3,
          z: (triangle[0].z + triangle[1].z + triangle[2].z) / 3,
        };
        for (const direction of [-1, 1]) {
          const previous = Object.fromEntries(["x", "y", "z"].map(axis =>
            [axis, centroid[axis] - gate.normal[axis] * 5 * direction]));
          const current = Object.fromEntries(["x", "y", "z"].map(axis =>
            [axis, centroid[axis] + gate.normal[axis] * 5 * direction]));
          const actual = run(handwritten, sectionIndex, previous, current);
          const expected = run(released, sectionIndex, previous, current);
          assert.deepEqual(actual, expected,
            `${archive} section ${sectionIndex} ${gate.name} direction ${direction}`);
          if (expected.state.section !== sectionIndex) exercisedTransitions += 1;
        }
      }
    }
  }
  assert.ok(exercisedTransitions > 0, "real track gates should exercise transitions");
});

test("碰撞表面优先级与场景重置调用顺序和发行版一致", () => {
  installWorldOverrides(TrackWorld);
  const handwritten = TrackWorld.prototype;
  function collision(methods, fractions) {
    const log = [];
    const makeSurface = (name, fraction) => ({
      queryBest: (...args) => { log.push([name, "query", ...args]); return fraction; },
      buildHit: (...args) => { log.push([name, "hit", ...args]); return name; },
      queryObb: box => { log.push([name, "obb", box]); return [name]; },
    });
    const host = {
      surface: makeSurface("static", fractions.static),
      ...(fractions.moving === undefined ? {} :
        { movingSurface: makeSurface("moving", fractions.moving) }),
      ...(fractions.obstacle === undefined ? {} :
        { obstacleSurface: makeSurface("obstacle", fractions.obstacle) }),
    };
    const origin = { x: 1, y: 2, z: 3 };
    const movement = { x: 4, y: 5, z: 6 };
    return {
      ray: methods.rayQuery.call(host, origin, movement, false),
      roadObb: methods.queryObb.call(host, "road-box"),
      obstacleObb: methods.queryObstacleObb.call(host, "obstacle-box"),
      log,
    };
  }
  for (const fractions of [
    { static: 0.2, moving: 0.3, obstacle: 0.4 },
    { static: 0.3, moving: 0.2, obstacle: 0.4 },
    { static: 0.3, moving: 0.3, obstacle: 0.1 },
    { static: 0.3, moving: 0.3, obstacle: 0.3 },
    { static: Infinity, moving: Infinity, obstacle: 0.8 },
    { static: Infinity, moving: Infinity, obstacle: Infinity },
    { static: 0.5 },
  ]) {
    assert.deepEqual(collision(handwritten, fractions), collision(released, fractions));
  }

  function rendering(methods) {
    const log = [];
    const scene = name => ({
      update: (...args) => log.push([name, "update", ...args]),
      reset: (...args) => log.push([name, "reset", ...args]),
    });
    const host = {
      renderScene: scene("render"), skydomeScene: scene("sky"),
      lensFlare: {
        update: (...args) => log.push(["flare", "update", ...args]),
        reset: () => log.push(["flare", "reset"]),
        setEnabled: enabled => log.push(["flare", "enabled", enabled]),
      },
      movingSurface: {
        update: time => log.push(["moving", "update", time]),
        rebase: () => log.push(["moving", "rebase"]),
      },
      data: { eventRuntimes: [{ reset: () => log.push(["event", "reset"]) }] },
      pendingEventRuntimes: ["pending"],
      activeEventRuntimes: ["active"], expiredEventEffects: ["expired"],
      updateRender: methods.updateRender,
    };
    methods.updateRender.call(host, 1, "frame", "camera", "viewport");
    methods.setLensFlareEnabled.call(host, true);
    methods.updateMovingRoads.call(host, 2);
    methods.resetRender.call(host, 3, "frame", "camera", "viewport");
    return { log, pending: host.pendingEventRuntimes,
      active: host.activeEventRuntimes, expired: host.expiredEventEffects };
  }
  assert.deepEqual(rendering(handwritten), rendering(released));
});

test("真实 p3553 路线重置、投影刷新和强制跳段与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  const sections = await realTrackSections("track_village_R01.rho");
  function run(methods) {
    const vehicle = {};
    const host = {
      sections,
      data: { firstSection: 0, lastSection: sections.length - 1 },
      routeStates: new WeakMap(),
      requireRouteState: methods.requireRouteState,
      projectSectionDistance: methods.projectSectionDistance,
    };
    const sample = sections.at(-1).frames[0].position;
    methods.resetRouteState.call(host, vehicle, sample);
    const reset = methods.getRouteState.call(host, vehicle);
    const surface = methods.currentRouteSurface.call(host, vehicle);
    const projected = methods.refreshRouteProjection.call(host, vehicle, sample);
    const pose = methods.prepareCurrentSectionReset.call(host, vehicle);
    methods.commitCurrentSectionReset.call(host, vehicle);
    methods.warpRouteToSection.call(host, vehicle, 0);
    const warped = methods.getRouteState.call(host, vehicle);
    const invalidWarp = capture(() => methods.warpRouteToSection.call(host,
      vehicle, sections.length + 2));
    return { reset, surface, projected, pose, warped, invalidWarp };
  }
  assert.deepEqual(run(TrackWorld.prototype), run(released));
});

test("真实 p3553 路线重新关联在车体离轨后与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  let comparisons = 0;
  for (const archive of ["track_village_R01.rho", "track_village_R06.rho"]) {
    const sections = await realTrackSections(archive);
    function run(methods, position) {
      const vehicle = {};
      const state = { section: 0, lap: 1, localDistance: 0,
        completedDistance: 42, distance: 42 };
      const routeStates = new WeakMap([[vehicle, state]]);
      const host = { sections, routeStates,
        requireRouteState: methods.requireRouteState,
        projectSectionDistance: methods.projectSectionDistance };
      const result = capture(() => methods.associateRoute.call(host, vehicle, position));
      return { result, state: routeStates.get(vehicle) };
    }
    for (const section of sections) {
      for (const frame of section.frames.slice(0, 5)) {
        for (const lift of [-10, -0.1, 0, 0.25, 5]) {
          const position = {
            x: Math.fround(frame.position.x + frame.up.x * lift),
            y: Math.fround(frame.position.y + frame.up.y * lift),
            z: Math.fround(frame.position.z + frame.up.z * lift),
          };
          assert.deepEqual(run(TrackWorld.prototype, position), run(released, position),
            `${archive} route association at ${frame.position.x}/${lift}`);
          comparisons += 1;
        }
      }
    }
  }
  assert.ok(comparisons > 100);
});

test("真实 p3553 路线段的 warp 与 rail 落点提交和发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  const source = await realTrackSections("track_village_R01.rho");
  const start = source.find(section => section.frames.length > 2 && section.outgoing.length > 0);
  const rail = source.find(section => section.frames.length > 2);
  assert.ok(start && rail);
  const edge = { ...start.outgoing[0], section: 1 };
  const sections = [
    { ...start, surface: "warpnext", outgoing: [edge] },
    { ...rail, surface: "rail_test", outgoing: [] },
  ];
  function hostFor(methods, railDistance = 20) {
    const vehicle = {};
    const routeStates = new WeakMap([[vehicle, {
      section: 0, lap: 1, localDistance: 0,
      completedDistance: 42, distance: 42,
    }]]);
    return { vehicle, routeStates, host: {
      sections, routeStates,
      data: { firstSection: 1, lapTarget: 1, railCaptureDistance: railDistance },
      requireRouteState: methods.requireRouteState,
      projectSectionDistance: methods.projectSectionDistance,
      railCaptureDistance: methods.railCaptureDistance,
    } };
  }
  function warpScenario(methods) {
    const { vehicle, host, routeStates } = hostFor(methods);
    const pose = capture(() => methods.warpNextDestination.call(host, vehicle));
    const tags = [];
    const landed = capture(() => methods.completeWarpNextRailLanding.call(host,
      vehicle, (tag, frame) => tags.push([tag, frame])));
    const again = capture(() => methods.completeWarpNextRailLanding.call(host, vehicle));
    return { pose, landed, again, tags, state: routeStates.get(vehicle),
      captureDistance: capture(() => methods.railCaptureDistance.call(host)) };
  }
  assert.deepEqual(warpScenario(TrackWorld.prototype), warpScenario(released));

  function railScenario(methods, position, railDistance) {
    const { vehicle, host, routeStates } = hostFor(methods, railDistance);
    host.sections = [{ ...sections[0], surface: "road" }, sections[1]];
    const tags = [];
    const landed = capture(() => methods.completeRailContactLanding.call(host,
      vehicle, position, (tag, frame) => tags.push([tag, frame])));
    const again = landed.ok && landed.value ? capture(() =>
      methods.completeRailContactLanding.call(host, vehicle, position)) : undefined;
    return { landed, again, tags, state: routeStates.get(vehicle) };
  }
  const frame = rail.frames[1];
  for (const distance of [0.01, 1, 20, 100]) {
    for (const lift of [0, 0.1, 2, 40]) {
      const position = {
        x: Math.fround(frame.position.x + frame.up.x * lift),
        y: Math.fround(frame.position.y + frame.up.y * lift),
        z: Math.fround(frame.position.z + frame.up.z * lift),
      };
      assert.deepEqual(railScenario(TrackWorld.prototype, position, distance),
        railScenario(released, position, distance), `rail ${distance}/${lift}`);
    }
  }
});

test("路线外层更新开关与赛道资源释放顺序和发行版一致", () => {
  installWorldOverrides(TrackWorld);
  function outerScenario(methods, updateEnabled, routeEnabled) {
    const log = [];
    const routeState = { section: 1 };
    const host = {
      data: { start: { position: { x: 1, y: 2, z: 3 } } },
      updateRoute: (...args) => log.push(["update", ...args]),
      requireRouteState: vehicle => { log.push(["state", vehicle]); return routeState; },
    };
    const result = methods.runOuterRoutePass.call(host, "vehicle", "prev", "current",
      "tag", updateEnabled, routeEnabled);
    return { start: methods.getStart.call(host), result, log };
  }
  for (const updateEnabled of [false, true]) {
    for (const routeEnabled of [false, true]) {
      assert.deepEqual(outerScenario(TrackWorld.prototype, updateEnabled, routeEnabled),
        outerScenario(released, updateEnabled, routeEnabled));
    }
  }

  function disposeScenario(methods) {
    const log = [];
    const texture = Object.assign(Object.create(D9.prototype), {
      dispose: () => log.push("texture"),
    });
    const materialA = { map: texture, lightMap: texture,
      dispose: () => log.push("material-a") };
    const materialB = { map: texture,
      dispose: () => log.push("material-b") };
    const mesh = (name, material) => Object.assign(Object.create(D2.prototype), {
      geometry: { dispose: () => log.push(`geometry-${name}`) }, material,
    });
    const objects = [mesh("a", materialA), mesh("b", [materialA, materialB]),
      {}, mesh("c", materialB)];
    const host = {
      lensFlare: { dispose: () => log.push("flare") },
      renderScene: { dispose: () => log.push("render") },
      skydomeScene: { dispose: () => log.push("sky") },
      group: { traverse: visitor => objects.forEach(visitor) },
    };
    methods.dispose.call(host);
    return log;
  }
  assert.deepEqual(disposeScenario(TrackWorld.prototype), disposeScenario(released));
  assert.deepEqual(disposeScenario(TrackWorld.prototype), [
    "flare", "render", "sky", "geometry-a", "texture", "material-a",
    "geometry-b", "material-b", "geometry-c",
  ]);
});

test("rail.bml registry 的重复 ID、未知 ID 与缺失数据行为和发行版一致", () => {
  installWorldOverrides(TrackWorld);
  const defaultConfig = { minVelocity: 1, maxVelocity: 2, accelFactor: 3,
    resistFactor: 4, gravityFactor: 5 };
  const first = { ...defaultConfig, id: "rail-a", maxVelocity: 10 };
  const second = { ...defaultConfig, id: "rail-a", maxVelocity: 20 };
  for (const registry of [undefined,
    { records: [], defaultConfig },
    { records: [first, second], defaultConfig }]) {
    const host = { data: { railConfig: registry } };
    for (const id of ["rail-a", "rail-b", ""]) {
      assert.deepEqual(capture(() => TrackWorld.prototype.lookupRailConfig.call(host, id)),
        capture(() => released.lookupRailConfig.call(host, id)));
    }
  }
});

test("真实 p3553 赛道构造的状态、场景挂载及校验顺序与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  const track = await realTrackData("track_village_R01.rho");
  const base = {
    resourceVersion: "p3553", trackId: "track_village_R01",
    sections: track.sections, firstSection: track.firstSection,
    lastSection: track.lastSection, start: track.start,
    collisionTriangles: track.collisionTriangles,
    movingRoadTriangles: [], obstacleAnimators: [], eventRuntimes: [],
    roadIssues: [], deferredRoadTriangles: [], runtimeIssues: [],
  };
  assert.ok(base.sections.length > 0 && base.collisionTriangles.length > 0);
  const renderScene = {
    settings: { cameraFar: 250, fog: { color: 123 } },
    clientWorldElements: () => [], clientWorldBounds: () => [],
  };
  const staticCtor = function (triangles, query) {
    return new StaticTrackSurface(triangles, query, {
      p3553ObbQuery: Oo, p3553ObbBounds: di0, roadDescriptorIssue: Vm,
    });
  };
  const obstacleCtor = function (triangles, query) {
    return new ObstacleSurface(triangles, query, Oo);
  };
  // The generated constructor is now replaced. Build an isolated baseline
  // straight from the immutable formatted release source for this comparison.
  const { parse } = await import("@babel/parser");
  const releaseText = await readFile(path.join(root, "recovered/formatted/index.js"), "utf8");
  const releaseClass = parse(releaseText, { sourceType: "module" }).program.body.find(
    node => node.type === "ClassDeclaration" && node.id.name === "_L");
  assert.ok(releaseClass);
  const constructorNode = releaseClass.body.body.find(node =>
    node.type === "ClassMethod" && node.kind === "constructor");
  assert.ok(constructorNode);
  const fields = releaseClass.body.body.filter(node => node.type === "ClassProperty")
    .map(node => releaseText.slice(node.start, node.end)).join("\n");
  const constructorSource = releaseText.slice(constructorNode.start, constructorNode.end);
  const OriginalWorld = new Function("T2", "Oo", "Ai0", "Ri", "Fl", "mi0", "gi0", "eE",
    `return class OriginalWorld { ${constructorSource}\n${fields}\n }`)(
    T2, Oo, () => false, Ri, Fl, staticCtor, class {}, obstacleCtor);
  function dependencies() {
    return {
      makeGroup: () => new T2(),
      p3553ObbQuery: Oo, legacyObbQuery: () => false,
      isRailDescriptor: Ri, movingDescriptorIssue: Fl,
      makeStaticSurface: (triangles, query) => new staticCtor(triangles, query),
      makeMovingSurface: () => { throw new Error("unexpected moving surface"); },
      makeObstacleSurface: (triangles, query) => new obstacleCtor(triangles, query),
    };
  }
  function make(data, handwritten, renderer = renderScene) {
    const scene = new T2();
    const skydome = { object: new T2() };
    const flare = { object: new T2() };
    if (handwritten === "generated") {
      return new TrackWorld(data, scene, renderer, skydome, flare);
    }
    if (handwritten) return createTrackWorld(TrackWorld, data, scene,
      renderer, skydome, flare, dependencies());
    const original = new OriginalWorld(data, scene, renderer, skydome, flare);
    Object.setPrototypeOf(original, TrackWorld.prototype);
    return original;
  }
  function summary(world) {
    const vehicle = {};
    world.resetRouteState(vehicle, base.sections[base.lastSection].frames[0].position);
    return {
      ownFields: Object.keys(world),
      prototype: Object.getPrototypeOf(world) === TrackWorld.prototype,
      data: world.data === base,
      sections: world.sections === base.sections,
      cameraFar: world.cameraFar, fog: world.fog,
      scene: { name: world.group.name,
        matrixAutoUpdate: world.group.matrixAutoUpdate,
        matrixWorldNeedsUpdate: world.group.matrixWorldNeedsUpdate,
        children: world.group.children.map(child => child.name),
        skydome: world.skydome?.name },
      surfaceTriangles: world.surface.triangles.length,
      obstacleTriangles: world.obstacleSurface?.triangles.length,
      obbQuery: world.triangleObbQuery === Oo,
      obstacleOwner: world.obstacleClientWorldElements === renderScene.clientWorldElements,
      obstacleBounds: world.obstacleClientWorldBounds === renderScene.clientWorldBounds,
      eventOwner: world.eventClientWorldElements === renderScene.clientWorldElements,
      obstacleKartPaired: world.obstacleKartPaired,
      activeEvents: world.activeEventRuntimes,
      expiredEffects: world.expiredEventEffects,
      routeState: world.getRouteState(vehicle),
    };
  }
  assert.deepEqual(summary(make(base, true)), summary(make(base, false)));
  assert.deepEqual(summary(make(base, "generated")), summary(make(base, false)));
  const withDynamicObjects = { ...base,
    obstacleTriangles: base.collisionTriangles.slice(0, 2),
    obstacleAnimators: [{}], eventRuntimes: [{}],
  };
  assert.deepEqual(summary(make(withDynamicObjects, true)),
    summary(make(withDynamicObjects, false)));
  assert.deepEqual(summary(make(withDynamicObjects, "generated")),
    summary(make(withDynamicObjects, false)));

  for (const data of [
    { ...base, sections: [] },
    { ...base, firstSection: base.sections.length + 1 },
    { ...base, sections: [{ ...base.sections[0],
      outgoing: [{ section: base.sections.length + 1 }], incoming: [] }] },
    { ...base, roadIssues: ["missing-road"] },
    { ...base, runtimeIssues: ["unknown-event"] },
  ]) {
    assert.deepEqual(capture(() => make(data, true)),
      capture(() => make(data, false)));
    assert.deepEqual(capture(() => make(data, "generated")),
      capture(() => make(data, false)));
  }
  const missingOwners = { settings: renderScene.settings };
  for (const data of [
    { ...base, movingRoadTriangles: [{ roadDescriptor: {}, origin: { mesh: {} } }] },
    { ...base, obstacleAnimators: [{}] },
    { ...base, eventRuntimes: [{}] },
  ]) {
    assert.deepEqual(capture(() => make(data, true, missingOwners)),
      capture(() => make(data, false, missingOwners)));
    assert.deepEqual(capture(() => make(data, "generated", missingOwners)),
      capture(() => make(data, false, missingOwners)));
  }
});

test("真实 p3553 三角形的障碍物配对、射线命中和 OBB 与发行版一致", async () => {
  installWorldOverrides(TrackWorld);
  const triangles = (await realTrackData("track_village_R01.rho"))
    .collisionTriangles.slice(0, 12);
  assert.equal(triangles.length, 12);
  function run(methods) {
    const log = [];
    const animators = triangles.map((triangle, index) => ({
      update: (time, elements, bounds, paired) =>
        log.push(["update", index, time, elements, bounds, paired]),
      registrationCenter: () => ({ x: 0, y: 0, z: 0 }),
      modelRadius: () => 1000,
      updateSnapshot: () => { log.push(["snapshot", index]); return [triangle]; },
    }));
    const world = {
      data: { resourceVersion: "p3553", obstacleAnimators: animators },
      obstacleClientWorldElements: "elements",
      obstacleClientWorldBounds: "bounds",
      obstacleKartPaired: false,
      obstacleKartPairs: new WeakSet(),
      pendingObstacleTriangles: undefined,
      obstacleSurface: undefined,
      triangleObbQuery: Oo,
    };
    const position = { x: 0, y: 0, z: 0 };
    methods.updateObstacles.call(world, 1, position);
    methods.registerObstaclePair.call(world, position);
    const pendingCount = world.pendingObstacleTriangles.length;
    methods.updateObstacles.call(world, 2, position);
    methods.registerObstaclePair.call(world, position);
    methods.commitObstacleSnapshot.call(world);
    const surface = world.obstacleSurface;
    const rayResults = triangles.map(triangle => {
      const center = {
        x: (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
        y: (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
        z: (triangle.a.z + triangle.b.z + triangle.c.z) / 3,
      };
      const start = Object.fromEntries(["x", "y", "z"].map(axis =>
        [axis, center[axis] - triangle.normal[axis] * 5]));
      const motion = Object.fromEntries(["x", "y", "z"].map(axis =>
        [axis, triangle.normal[axis] * 10]));
      const fraction = surface.queryBest(start, motion, true);
      return { fraction, hit: Number.isFinite(fraction) ?
        structuredClone(surface.buildHit(start, motion, fraction)) : undefined };
    });
    const obb = {
      center: { x: 0, y: 0, z: 0 },
      axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 },
        { x: 0, y: 0, z: 1 }],
      halfExtents: [1e6, 1e6, 1e6],
    };
    return { log, pendingCount, paired: world.obstacleKartPaired,
      afterCommit: world.pendingObstacleTriangles,
      triangleCount: surface.triangles.length,
      rayResults, obb: surface.queryObb(obb) };
  }
  assert.deepEqual(run(TrackWorld.prototype), run(released));
});
