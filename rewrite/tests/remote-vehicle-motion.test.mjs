import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  VehicleMotionSender, VehicleMotionReceiver, isNewMotionSequence,
} from "../src/vehicle/remote-vehicle-motion.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const statements = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = statements.find(item =>
    (item.type === "FunctionDeclaration" || item.type === "ClassDeclaration") && item.id.name === name);
  assert.ok(node, name);
  return release.slice(node.start, node.end);
}
const legacy = new Function(`${original("No")}; ${original("I40")}; ${original("k40")};
  return { No, I40, k40 };`)();

function senderState(sender) {
  return { landing: sender.landing, collision: sender.collision, strength: sender.strength };
}
function receiverState(receiver) {
  return { state: receiver.state, landing: receiver.landing, collision: receiver.collision,
    landingPending: receiver.landingPending, collisionPending: receiver.collisionPending };
}
function exercise(kind) {
  const sender = kind === "original" ? new legacy.I40() : new VehicleMotionSender();
  const receiver = kind === "original" ? new legacy.k40() : new VehicleMotionReceiver();
  const outputs = [];
  const states = [];
  const source = { forwardSpeed: 30, rawSteer: -0.4, tireTransient: 0.3,
    boosterState: 3, instantAccelerationActive: true, motorcycle: 0,
    visualScaleMode: 1, collisionStrength: 0.75,
    landingTrigger: false, collisionHit: false };
  outputs.push(receiver.consume());
  const samples = [
    [{ ...source }, { forward: 1, reverse: 0 }, undefined],
    [{ ...source, landingTrigger: true }, { forward: 0, reverse: 2 }, { pose: "boost" }],
    [{ ...source, collisionHit: true, collisionStrength: 0.9 }, { forward: 0, reverse: 0 }, null],
    [{ ...source, collisionStrength: 0.4 }, { forward: 1, reverse: 1 }, false],
  ];
  for (const [motion, lamps, animation] of samples) {
    const frame = sender.capture(motion, lamps, animation);
    outputs.push(frame);
    states.push(senderState(sender));
    receiver.receive(frame);
    states.push(receiverState(receiver));
    outputs.push(receiver.consume());
    outputs.push(receiver.consume());
    states.push(receiverState(receiver));
  }
  return { outputs, states };
}

test("remote vehicle motion capture and one-shot reception match release", () => {
  assert.deepEqual(exercise("rewritten"), exercise("original"));
  for (const [incoming, current] of [
    [1, 0], [0, 0], [0, 0xffffffff], [0xffffffff, 0],
    [0x80000000, 0], [12, 20],
  ]) assert.equal(isNewMotionSequence(incoming, current), legacy.No(incoming, current));
});
