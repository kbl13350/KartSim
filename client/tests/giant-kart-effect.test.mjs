import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { GiantKartEffect } from "../src/vehicle/giant-kart-effect.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(source, { sourceType: "module" }).program.body;
const constants = nodes.find((node) => node.type === "VariableDeclaration" &&
  node.declarations.some((part) => part.id.name === "w9"));
const interpolation = nodes.find((node) => node.type === "FunctionDeclaration" && node.id.name === "sd");
const originalClass = nodes.find((node) => node.type === "ClassDeclaration" && node.id.name === "pL");
assert.ok(constants && interpolation && originalClass);
const Original = new Function(`${source.slice(constants.start, constants.end)}
  ${source.slice(interpolation.start, interpolation.end)}
  ${source.slice(originalClass.start, originalClass.end)}
  return pL;`)();

function plain(value) {
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
  return value;
}

function snapshot(effect, applied, compensated) {
  return plain({
    main: effect.main, extra: effect.extra, stamp: effect.stamp,
    mainScale: effect.mainScale, cameraScale: effect.cameraScale,
    flatten: effect.flatten, frozen: effect.frozen,
    sizePending: effect.sizePending, sizeAnchor: effect.sizeAnchor,
    sizeNodes: effect.sizeNodes, sizeStart: effect.sizeStart,
    target: effect.target, pressDuration: effect.pressDuration,
    pressStart: effect.pressStart, restoreRequested: effect.restoreRequested,
    restoreAnchor: effect.restoreAnchor, resets: effect.resets,
    packets: effect.packets, visuals: effect.visuals,
    released: effect.released, behind: effect.behind,
    publishedScale: effect.publishedScale, drivingActive: effect.drivingActive,
    cells: effect.cells, flattened: effect.flattened, forceBonus: effect.forceBonus,
    applied, compensated,
  });
}

function runLocal(Type) {
  const applied = [];
  let compensated = 0;
  const effect = new Type(true, () => { compensated += 1; });
  const other = new Type(true);
  effect.setRank(2);
  effect.setDrivingActive(true);
  const apply = (...scales) => applied.push(scales.map((scale) => ({ ...scale })));
  effect.processWallCollision(1000, 4);
  for (const time of [1000, 1001, 1200, 1600, 1951]) effect.updateVehicle(time, apply);
  effect.processWallCollision(1500, 4);
  effect.processWallCollision(2000, 4);
  effect.nativeFlattenMode(2);
  effect.nativeFlattenMode(0);
  for (const time of [2200, 2300, 2600, 2800]) effect.updateVehicle(time, apply);
  effect.processKartContact(other, 4, 2, 3000, false);
  effect.updateEffects(3101);
  const before = snapshot(effect, applied, compensated);
  const packets = effect.consumePackets();
  const visuals = effect.consumeVisuals();
  effect.reset();
  const afterReset = snapshot(effect, applied, compensated);
  effect.dispose();
  return { before, packets, visuals, afterReset,
    afterDispose: snapshot(effect, applied, compensated) };
}

function runRemote(Type) {
  const applied = [];
  const effect = new Type(false);
  effect.receive({ main: 4, extra: 0, status: 0 }, 100);
  for (const time of [100, 200, 500, 800, 1051])
    effect.updateVehicle(time, (...scales) => applied.push(scales.map((scale) => ({ ...scale }))));
  effect.receive({ main: 4, extra: 0, status: 1 }, 1100);
  for (const time of [1100, 1200, 1701, 1800])
    effect.updateVehicle(time, (...scales) => applied.push(scales.map((scale) => ({ ...scale }))));
  return snapshot(effect, applied, 0);
}

test("giant kart growth, squash, reset and packets match the release", () => {
  assert.deepEqual(runLocal(GiantKartEffect), runLocal(Original));
  assert.deepEqual(runRemote(GiantKartEffect), runRemote(Original));
});
