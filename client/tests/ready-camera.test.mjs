import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { Matrix4, PerspectiveCamera } from "three";
import {
  ReadyCameraController, applyReadyCameraMatrix, findNamedCamera,
  findReadyCameraPath, matrixFromPlayerFrame, matrixFromPose, prsController,
  warpNextCamera,
} from "../src/vehicle/ready-camera.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function textOf(name) {
  const node = declarations.find(item =>
    (item.type === "FunctionDeclaration" || item.type === "ClassDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const code = ["Zk", "k30", "Z8", "td", "L30", "P30", "F30", "O30", "Jk"]
  .map(textOf).join("\n");
const Original = new Function("deps", `with (deps) { ${code}\n${textOf("I30")};
  return { I30, Zk, k30, Z8, td, L30, P30, F30, O30, Jk }; }`);

const identity = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
function node(className, name, children = [], controller) {
  return {
    kind: "node", className, name, children,
    position: [0, 0, 0], transform: identity, scale: [1, 1, 1],
    slotOccurrences: [undefined, controller ? { value: controller } : undefined],
  };
}
function fixture() {
  const log = [];
  const cameraNode = node("ReCamera", "ready_cam");
  cameraNode.position = [0, 1, 2];
  cameraNode.camera = {
    projectionMode: 0, fieldOfViewDegrees: 60, nearClip: 0.3, farClip: 400,
  };
  const parent = node("ReNode", "arm", [cameraNode], { prs: true, id: "parent" });
  parent.position = [2, 0, 0];
  const root = node("ReNode", "root", [parent]);
  root.kind = "node";
  const model = { root };
  const player = {
    position: { x: 3, y: 4, z: 5 },
    right: { x: 1, y: 0, z: 0 },
    forward: { x: 0, y: 1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  };
  const deps = {
    v2: Matrix4,
    P6(value) { log.push(["is PRS", value?.id ?? null]); return value?.prs === true; },
    Nm(controller) { log.push(["unsupported PRS", controller.id]); return undefined; },
    zG() { log.push(["runtime"]); return { anchor: 99, previousCycle: 88, reverseHalf: true }; },
    PW(controller, runtime, now, pose) {
      log.push(["animate PRS", controller.id, now, runtime.anchor]);
      return { ...pose, position: [pose.position[0] + 1, pose.position[1], pose.position[2]] };
    },
    we(degrees, aspect) { log.push(["fov", degrees, aspect]); return degrees * aspect / 2; },
  };
  const ops = {
    isPrsController: deps.P6,
    unsupportedPrs: deps.Nm,
    createPrsRuntime: deps.zG,
    animatePrs: deps.PW,
    fieldOfView: deps.we,
  };
  return { log, model, cameraNode, parent, root, player, deps, ops };
}

function snapshotCamera(camera) {
  return {
    matrixAutoUpdate: camera.matrixAutoUpdate,
    position: camera.position.toArray(), up: camera.up.toArray(),
    quaternion: camera.quaternion.toArray(), fov: camera.fov,
    near: camera.near, far: camera.far,
    projectionMatrix: camera.projectionMatrix.toArray(),
    world: camera.matrixWorld.toArray(),
  };
}
function snapshotPath(path) {
  return path.map(entry => ({
    source: entry.source.name,
    controller: entry.controller?.id ?? null,
    runtime: entry.runtime ? { ...entry.runtime } : null,
  }));
}
function runReady(kind, modify = () => {}) {
  const f = fixture();
  modify(f);
  const legacy = Original(f.deps);
  try {
    const owner = kind === "original" ? new legacy.I30(f.model)
      : new ReadyCameraController(f.model, f.ops);
    const states = [snapshotPath(owner.path)];
    owner.start(); states.push(snapshotPath(owner.path));
    for (const time of [0, 150, 2 ** 32 + 51]) {
      const camera = new PerspectiveCamera(50, 1.5, 0.1, 1000);
      owner.apply(camera, time, f.player);
      states.push(snapshotCamera(camera));
    }
    return { states, log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("animated ready camera path and projection match release", () => {
  for (const modify of [
    () => {},
    f => { f.root.kind = "track"; },
    f => { f.parent.children = []; },
    f => { f.cameraNode.camera.projectionMode = 2; },
    f => { f.cameraNode.camera.fieldOfViewController = {}; },
    f => { f.deps.Nm = () => "unsupported animation"; f.ops.unsupportedPrs = f.deps.Nm; },
  ]) assert.deepEqual(runReady("rewritten", modify), runReady("original", modify));
});

test("ready camera matrix helpers match release", () => {
  const f = fixture();
  const legacy = Original(f.deps);
  const pose = {
    basis: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
    position: [10, 11, 12], scale: [2, 3, 4],
  };
  assert.deepEqual(matrixFromPose(pose).elements, legacy.F30(pose.basis, pose.position, pose.scale).elements);
  assert.deepEqual(matrixFromPlayerFrame(f.player).elements, legacy.k30(f.player).elements);
  assert.deepEqual(snapshotPath(findReadyCameraPath(f.root, f.ops)), snapshotPath(legacy.L30(f.root)));
  assert.equal(prsController(f.parent, f.ops), legacy.P30(f.parent));
  assert.equal(findNamedCamera(f.root, "ready_cam"), legacy.Jk(f.root, "ready_cam"));
  const elements = new Matrix4().makeTranslation(1, 2, 3).elements;
  const originalCamera = new PerspectiveCamera(45, 1.5, 0.1, 100);
  const rewrittenCamera = new PerspectiveCamera(45, 1.5, 0.1, 100);
  legacy.Zk(originalCamera, elements, f.cameraNode.camera);
  applyReadyCameraMatrix(rewrittenCamera, elements, f.cameraNode.camera, f.ops.fieldOfView);
  assert.deepEqual(snapshotCamera(rewrittenCamera), snapshotCamera(originalCamera));
});

function runWarp(kind, modify = () => {}) {
  const f = fixture();
  const scene = node("ReNode", "scene", [f.cameraNode]);
  f.cameraNode.name = "warpnextcamera_cam";
  const model = { root: { kind: "track", scene } };
  let readWorld = () => new Matrix4().makeTranslation(3, 4, 5).elements;
  modify(model, f, value => { readWorld = value; });
  const owner = { clientWorldElements(node) {
    f.log.push(["world", node.name]);
    return readWorld(node);
  } };
  const legacy = Original(f.deps);
  try {
    const apply = kind === "original" ? legacy.O30(model, owner)
      : warpNextCamera(model, { ...owner, fieldOfView: f.ops.fieldOfView });
    if (!apply) return { found: false, log: f.log };
    const camera = new PerspectiveCamera(45, 2, 0.1, 100);
    apply(camera);
    return { found: true, camera: snapshotCamera(camera), log: f.log };
  } catch (error) { return { error: error.message, log: f.log }; }
}

test("warpnext live camera adapter matches release and validation branches", () => {
  for (const modify of [
    () => {},
    model => { model.root.kind = "node"; },
    model => { model.root.scene.children = []; },
    (_model, f) => { f.cameraNode.className = "ReNode"; },
    (_model, f) => { f.cameraNode.camera.projectionMode = 1; },
    (_model, f) => { f.cameraNode.camera.nearClipController = {}; },
    (_model, _f, setReadWorld) => { setReadWorld(() => undefined); },
  ]) assert.deepEqual(runWarp("rewritten", modify), runWarp("original", modify));
});
