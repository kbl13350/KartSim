import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { WarpNextController, warpLetterboxRatio, warpPresentationBlinkVisible } from "../src/vehicle/warp-next-controller.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = nodes.find(node => (node.type === "ClassDeclaration" || node.type === "FunctionDeclaration")
    ? node.id.name === name : node.type === "VariableDeclaration" &&
      node.declarations.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const Original = new Function(`${[
  "D30", "gv", "Ss", "N30", "nd", "Qk",
].map(declaration).join("\n")}\nreturn { Qk, N30, gv };`)();

const frame = {
  position: { x: 12, y: 3, z: -6 },
  forward: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
};

function snapshot(controller, actions) {
  return {
    phase: controller.phase, startMs: controller.startMs,
    destination: controller.destination,
    config: controller.config,
    fairyFovFactorValue: controller.fairyFovFactorValue,
    fairyCameraResetPending: controller.fairyCameraResetPending,
    warpFinishNotified: controller.warpFinishNotified,
    blocksDriving: controller.blocksDriving(),
    fairyFovFactor: controller.fairyFovFactor(),
    actions,
  };
}

function standard(Type) {
  const controller = new Type();
  const states = [];
  states.push(snapshot(controller, controller.enter("other", frame, 1000)));
  states.push(snapshot(controller, controller.enter("warpnext:in:next", frame, 1000)));
  states.push(snapshot(controller, controller.enter("warpnext:in:next", frame, 1001)));
  for (const offset of [0, 99, 100, 374, 500, 2499, 2500, 2999, 3000, 3999, 4000, 4374, 4375]) {
    const at = 1000 + offset;
    const visible = controller.presentationVisible(at);
    const ratio = controller.blackBarRatio(at);
    states.push({ ...snapshot(controller, controller.tick(at)), visible, ratio });
  }
  states.push(snapshot(controller, controller.tick(5500)));
  return states;
}

function fairy(Type, config) {
  const controller = new Type();
  const states = [snapshot(controller, controller.enter("warpnext:in:next", frame, 200, config))];
  for (const at of [200, 201, 600, 1399, 1400, 1401])
    states.push(snapshot(controller, controller.tick(at)));
  return states;
}

test("standard and fairy warp timing, actions and camera state match release", () => {
  assert.deepEqual(standard(WarpNextController), standard(Original.Qk));
  for (const config of [
    { inType: "fairy", outType: "fairy", outTime: 1200, outFovAdjust: true, outFovBase: 600 },
    { inType: "fairy", outType: "other", outTime: 1200 },
  ]) assert.deepEqual(fairy(WarpNextController, config), fairy(Original.Qk, config));
  for (const elapsed of [-1, 0, 100, 375, 500, 4000, 4374, 4375])
    assert.equal(warpLetterboxRatio(elapsed), Original.N30(elapsed));
  for (const elapsed of [-1, 0, 99, 100, 199, 200, 500, 1000])
    assert.equal(warpPresentationBlinkVisible(elapsed), Original.gv(elapsed));
});
