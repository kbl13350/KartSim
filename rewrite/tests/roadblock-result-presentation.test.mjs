import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { RoadblockResultPresentation, loadRoadblockResultParts } from "../src/world/roadblock-result-presentation.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "ClassDeclaration" && item.id.name === "Bv");
assert.ok(node);
const originalClass = release.slice(node.start, node.end);

function fixture() {
  const log = [];
  let groupId = 0;
  class Group {
    constructor() {
      this.id = `group${groupId++}`;
      this.matrix = {
        makeBasis: (...basis) => { log.push(["basis", this.id, basis]); return this.matrix; },
        setPosition: (...point) => { log.push(["position", this.id, point]); return this.matrix; },
        copy: matrix => log.push(["copy", this.id, matrix === this.matrix]),
      };
    }
    add(object) { log.push(["add", this.id, object.id]); }
    removeFromParent() { log.push(["remove", this.id]); }
  }
  class CameraPublisher {
    apply(camera, pose) { log.push(["camera", camera, pose]); }
  }
  class Vector {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  }
  const distance = () => ({
    reset(time) { log.push(["distanceReset", time]); },
    update(time) { log.push(["distanceUpdate", time]); return 5; },
  });
  const parseScene = bytes => {
    const path = new TextDecoder().decode(bytes);
    log.push(["parse", path]);
    if (path === "track/east/stage.1s")
      return { root: { kind: "track", trackObjects: [{
        kind: "TrackObject", name: "track", property: { children: [
          { name: "course", attrs: { reversePodium: "true" } },
        ] },
      }] } };
    return { root: { kind: "node" }, path };
  };
  const attribute = (item, name) => item.attrs[name];
  const buildScene = async (_parsed, _library, name, resolve, options) => {
    log.push(["build", name, options.advanceEnvironment]);
    resolve({ name: "tex" });
    return {
      object: { id: name },
      reset(time) { log.push(["reset", name, time]); },
      update(time, camera, width, height) { log.push(["update", name, time, camera, width, height]); },
      dispose() { log.push(["dispose", name]); },
    };
  };
  const resolveSource = (_library, path, reference) => {
    log.push(["resolve", path, reference.name]); return { status: "found" };
  };
  const validateStand = () => log.push(["validateStand"]);
  const startBasis = (_start, reverse) => {
    log.push(["startBasis", reverse]);
    return [
      { x: 1, y: 2, z: 3 },
      { x: 4, y: 5, z: 6 },
      { x: 7, y: 8, z: 9 },
    ];
  };
  const nativePoint = point => point;
  const runnerPose = (_basis, ground) => ({ ground });
  const cameraPose = (_basis, ground, current) => ({ ground, current });
  const dependencies = {
    parseScene, attribute, buildScene, resolveSource, validateStand,
    createGroup: () => new Group(), createCameraPublisher: () => new CameraPublisher(),
    createDistance: distance, startBasis, nativePoint,
    createVector: (x, y, z) => new Vector(x, y, z), runnerPose, cameraPose,
  };
  const library = {
    exactCanonicalCandidates(path) {
      log.push(["candidate", path]);
      return [{ bytes: async () => new TextEncoder().encode(path) }];
    },
  };
  const raceAssets = { map: {
    path: "track/east/stage.1s", environment: "env", stageBinding: "binding",
  }, participants: [{
    playerId: "runner",
    characters: { ordinary: {
      award: { enterResult(code) { log.push(["award", code]); } },
      scene: {
        reset() { log.push(["characterReset"]); },
        update(time, camera, width, height) { log.push(["characterUpdate", time, camera, width, height]); },
      },
    } },
    vehicle: { imported: { renderScene: { update(camera) { log.push(["kartUpdate", camera]); } } },
      accessories: [{ render: { scene: { update(time) { log.push(["accessoryUpdate", time]); } } } }],
      decoration: { scene: { update(time) { log.push(["decorationUpdate", time]); } } },
    },
  }] };
  const Original = new Function("T2", "Ol", "wr0", "y9", "T", "W1", "sn", "mr0",
    "fr0", "It", "H", "pr0", "gr0", `${originalClass}\nreturn Bv;`)(
      Group, CameraPublisher, distance, parseScene, attribute, buildScene,
      (sourceLibrary, path, _unused, reference) => resolveSource(sourceLibrary, path, reference),
      validateStand, startBasis, nativePoint, Vector, runnerPose, cameraPose,
    );
  const world = { track: {
    getStart: () => ({ position: { x: 2, y: 3, z: 4 } }),
    rayQuery: () => ({ point: { x: 2, y: 0, z: 4 } }),
  } };
  const view = {
    root: { visible: true, updateMatrixWorld(value) { log.push(["matrixWorld", value]); } },
    resetAnimation() { log.push(["resetAnimation"]); },
    updatePose(pose) { log.push(["runnerPose", pose]); },
  };
  const views = new Map([["runner", view], ["other", { root: { visible: true } }]]);
  const result = { roadblock: { runnerId: "runner" }, roadblockOutcome: { runnerWon: true } };
  return { log, dependencies, library, raceAssets, Original, world, views, result };
}

async function exercise(rewritten) {
  const data = fixture();
  const { log, dependencies, library, raceAssets, Original, world, views, result } = data;
  const owner = rewritten
    ? new RoadblockResultPresentation(...Object.values(await loadRoadblockResultParts(library, raceAssets, dependencies)), dependencies)
    : await Original.load(library, raceAssets);
  owner.show(10.8, world, raceAssets, views, result);
  owner.update(20, "camera", 640, 480);
  owner.dispose();
  owner.dispose();
  return JSON.parse(JSON.stringify({
    log, visible: [...views].map(([id, view]) => [id, view.root.visible]),
    disposed: owner.disposed,
  }));
}

test("roadblock result asset and camera lifecycle match the release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});
