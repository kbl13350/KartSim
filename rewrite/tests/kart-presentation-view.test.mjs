import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { Group, Matrix4 } from "three";
import { KartPresentationView } from "../src/world/kart-presentation-view.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = declarations.find(item => item.id?.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};
const makeOriginal = new Function("T2", "_o", "N90", "c7", "u5",
  `${sourceOf("cn")}\n${sourceOf("Vg")}; return Vg;`);

function pose(offset = 0) {
  return {
    right: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    x: 1.25 + offset, y: -3.5, z: 7.25,
    visualScale: { x: 1.25, y: 0.8, z: 1.5 },
  };
}

function run(kind) {
  const calls = [];
  class Wheels {
    constructor(...args) { calls.push(["wheels created", args.length]); }
    reset() { calls.push("wheels reset"); }
    update(_pose, time, state) { calls.push(["wheels update", time, state]); }
  }
  const balloon = () => {
    calls.push("balloon created");
    return new Group();
  };
  const dispose = model => { calls.push(["dispose", model.name]); };
  const scene = new Group();
  const View = kind === "original"
    ? makeOriginal(Group, Matrix4, Wheels, balloon, dispose)
    : KartPresentationView;
  const view = kind === "original" ? new View(scene)
    : new View(scene, {
      makeWheelPresentation: (...args) => new Wheels(...args),
      makeBalloon: balloon, disposeObject: dispose,
    });
  const config = {
    attachments: Array(17).fill("missing"),
    isTransformAutoCharge: true, autoChargeLowSpeed: 100, transformTime: 500,
  };
  config.attachments[16] = "balloon";
  const nodes = { nodes: new Map() };
  const model = new Group();
  model.name = "first model";
  const animation = {
    state: 2,
    reset(time) { calls.push(["animation reset", time]); },
    updateCurrentState(time) { calls.push(["current", time]); return "current"; },
    enterDualUse() { calls.push("dual use"); this.state = 3; },
    update(...args) { calls.push(["animation update", ...args]); return "animated"; },
  };
  view.setModel(model, config, animation, { resource: 1 }, nodes);
  const attachmentPresent = view.getAttachment(16) instanceof Group;
  const results = [];
  results.push(view.update(pose(), 100, {
    displaySpeedKmh: 150, physicsState: 1, dualMode: true,
  }));
  results.push(view.update(pose(2), 200));
  const rotated = new Matrix4().makeRotationY(0.25);
  view.setLocalAffectBasis(rotated);
  view.resetAnimation();
  results.push(view.enterDualUse());
  results.push(view.updateRemote(pose(1), 250, {
    displaySpeedKmh: 80, physicsState: 4, dualMode: false,
  }));
  const matrices = {
    root: view.root.matrix.toArray(),
    modelWorld: view.modelMount.matrixWorld.toArray(),
    affect: view.affectBasis.toArray(),
  };
  const second = new Group();
  second.name = "second model";
  view.setModel(second, config, animation);
  view.releaseBorrowedModel();
  const borrowed = {
    rootParent: view.root.parent,
    importedModel: view.importedModel,
    presentationState: view.presentationState,
  };
  view.setModel(new Group(), config, animation);
  view.dispose();
  return {
    calls, results, matrices, attachmentPresent,
    borrowed, sceneChildren: scene.children.length,
    modelChildren: view.modelMount.children.length,
    visualConfigAfterDispose: view.getVisualConfig(),
  };
}

test("kart model mount, animation, wheel and disposal match release", () => {
  assert.deepEqual(run("rewritten"), run("original"));
});
