import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  FlyingPetIdleMotion, FlyingPetRaceState, FLYING_PET_RACE_MOTIONS,
  advanceFlyingPetSpring, visibleFlyingPet,
} from "../src/world/flying-pet-state.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = nodes.find(item => item.id?.name === name ||
    item.type === "VariableDeclaration" && item.declarations.some(part => part.id.name === name));
  assert.ok(node, `${name} missing`);
  return release.slice(node.start, node.end);
}
const originals = new Function(
  ["$L", "ar0", "cr0", "n9", "ur0", "hr0", "dr0"].map(declaration).join("\n") +
    "\nreturn { cr0, hr0, ur0, dr0, or0 };",
)();

function plain(value) { return JSON.parse(JSON.stringify(value)); }

function runIdle(Type) {
  const log = [];
  const clips = new Map(FLYING_PET_RACE_MOTIONS.map(motion =>
    [motion, { id: motion, header: [0, 0, 100] }]));
  const randomValues = [13, 3, 35, 4, 77, 2];
  const random = { next: () => randomValues.shift() };
  const animation = { bind(clip, intro, restore, outro, carry) {
    log.push([clip.id, intro, restore, outro, carry]);
  } };
  const idle = new Type(clips, animation, random);
  for (const elapsed of [0, 50, 250, 60, 600]) {
    idle.update(elapsed);
    log.push(["state", idle.next, idle.remaining]);
  }
  idle.reset();
  log.push(["reset", idle.next, idle.remaining]);
  return plain(log);
}

function runRace(Type) {
  const state = new Type();
  const output = [];
  const matrix = Array(16).fill(0);
  matrix[0] = matrix[5] = matrix[10] = 1;
  matrix[12] = 4; matrix[13] = 2; matrix[14] = 3;
  state.launch();
  for (const time of [100, 200, 501, 600, 1000, 1200, 1800, 2100]) {
    matrix[12] += 0.2;
    const alive = state.update(time, matrix, [1, 1, 1], elapsed => output.push(["idle", elapsed]));
    output.push({ time, alive, state: plain(state) });
  }
  state.disable();
  state.enable();
  output.push({ afterToggle: plain(state) });
  return output;
}

test("flying pet idle motion selection and timing match release", () => {
  assert.deepEqual(runIdle(FlyingPetIdleMotion), runIdle(originals.cr0));
});

test("flying pet launch, follow spring and visibility match release", () => {
  assert.deepEqual(runRace(FlyingPetRaceState), runRace(originals.hr0));
  for (const [role, visible] of [["local", true], ["local", false], ["remote", true]])
    assert.equal(visibleFlyingPet(role, visible), originals.dr0(role, visible));
  const position = [4, 0, 3], velocity = [0.5, 0, -0.5], target = [5, 1, 2];
  const originalPosition = [...position], originalVelocity = [...velocity];
  assert.equal(advanceFlyingPetSpring(position, velocity, target, 16),
    originals.ur0(originalPosition, originalVelocity, target, 16));
  assert.deepEqual(position, originalPosition);
  assert.deepEqual(velocity, originalVelocity);
});
