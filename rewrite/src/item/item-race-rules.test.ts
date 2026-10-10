import assert from "node:assert/strict";
import test from "node:test";

import { ItemIdx, loadItemCatalog } from "./item-catalog";
import { clientToThree } from "./item-cube-source";
import {
  ITEM_RACE_TUNING, bananaPoint, chooseAimTarget, clientToThreePoint, decideHit,
  effectStartOffsetMs, kartEffectOf, physicsEffect, projectToStage, teamColor, threeToClient,
  victimsText, warningOf, waterBombPoint,
} from "./item-race-rules";
import { ItemSlotMirror, normalizeSlots } from "./item-race-slots";
import { testItemCatalog } from "./item-race-test-support";
import { ITEM_CONTAINERS, loadMirrorLibrary } from "./item-test-fixtures";

const catalog = testItemCatalog();
const behaviour = (idx: number) => catalog.get(idx)!.behaviour;

test("protocol points are client z-up coordinates, the inverse of clientToThree", () => {
  const client = { x: 12.5, y: -40, z: 3 };
  const three = clientToThreePoint(client);
  assert.deepEqual(three, clientToThree([client.x, client.y, client.z]));
  assert.deepEqual(threeToClient(three), client);
  assert.deepEqual(threeToClient({ x: 1, y: 2, z: 3 }), { x: 1, y: -3, z: 2 });
  assert.ok(!Object.is(threeToClient({ x: 0, y: 0, z: 0 }).y, -0));
});

test("banana and water bomb points follow Appendix B", () => {
  const pose = { position: { x: 1, y: 2, z: 3 }, forward: { x: 0, y: 0, z: 1 } };
  assert.deepEqual(bananaPoint(pose, behaviour(ItemIdx.banana)), { x: 1, y: 2, z: -1 });
  assert.deepEqual(waterBombPoint(pose, { x: 10, y: 0, z: 0 }, behaviour(ItemIdx.waterBomb), 1000),
    { x: 11, y: 2, z: 23 });
});

test("effects start after the projectile ETA or the delay, plus the warning", () => {
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.rocket), 800), 800);
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.rocket), 5000), 1500, "capped at Use.life");
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.waterFly), 1900), 1900);
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.devil), 0), 1500);
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.thunderbolt), 0), 2100);
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.cloud2), 0), 666);
  assert.equal(effectStartOffsetMs(behaviour(ItemIdx.slotLock), 0), 2000);
  assert.equal(physicsEffect("cloud"), undefined);
  assert.equal(physicsEffect("trap"), "trap");
  assert.equal(kartEffectOf("lock"), undefined);
  assert.equal(warningOf(ItemIdx.guideRocket), "rocket");
  assert.equal(warningOf(ItemIdx.waterFly), "waterfly");
  assert.equal(warningOf(ItemIdx.devil), undefined);
});

test("defences (C.2): escape, equipment, invincible, shield, angel, then partial outcomes", () => {
  const none = { immune: false, shield: false, angel: false, invincible: false, suspended: false };
  const decide = (idx: number, defences: Partial<typeof none>, equipment = {}) =>
    decideHit(idx, behaviour(idx), { ...none, ...defences }, equipment);
  assert.deepEqual(decide(ItemIdx.rocket, {}), { result: "hit" });
  assert.deepEqual(decide(ItemIdx.rocket, { immune: true, shield: true }), { result: "blocked", by: "escape" });
  assert.deepEqual(decide(ItemIdx.rocket, { shield: true, angel: true }), { result: "blocked", by: "shield" });
  assert.deepEqual(decide(ItemIdx.waterBomb, { shield: true }), { result: "hit" });
  assert.deepEqual(decide(ItemIdx.waterBomb, { angel: true }), { result: "blocked", by: "angel" });
  assert.deepEqual(decide(ItemIdx.devil, { shield: true, angel: true }), { result: "hit" });
  assert.deepEqual(decide(ItemIdx.cloud2, { shield: true, angel: true }), { result: "hit" });
  assert.deepEqual(decide(ItemIdx.thunderbolt, { shield: true }), { result: "hit" });
  assert.deepEqual(decide(ItemIdx.barricade, { shield: true }), { result: "blocked", by: "shield" });
  assert.deepEqual(decide(ItemIdx.slotLock, { immune: true, angel: true, suspended: true, invincible: true }),
    { result: "hit" });
  assert.deepEqual(decide(ItemIdx.rocket, { suspended: true }), { result: "blocked" });
  // The UFO: neither the shield nor the angel (only EMP clears it, and only after it landed).
  assert.deepEqual(decide(ItemIdx.ufo, { shield: true, angel: true }), { result: "hit" });
  // The gold / protect shield blocks every attack, the devil family too, but not a cloud.
  assert.deepEqual(decide(ItemIdx.devil, { invincible: true }), { result: "blocked" });
  assert.deepEqual(decide(ItemIdx.ufo, { invincible: true, shield: true }), { result: "blocked" });
  assert.deepEqual(decide(ItemIdx.darkCloud2, { invincible: true }), { result: "hit" });
  // Equipment full defences come before the shield items; the shield is kept.
  assert.deepEqual(decide(ItemIdx.rocket, { shield: true }, { block: { by: "kart" } }),
    { result: "blocked", by: "kart" });
  assert.deepEqual(decide(ItemIdx.mine, {}, { block: { by: "eat", bonus: true } }),
    { result: "blocked", by: "eat", variant: "bonus" });
  assert.deepEqual(decide(ItemIdx.rocket, { immune: true }, { block: { by: "pet" } }),
    { result: "blocked", by: "escape" });
  // Partial outcomes only when nothing stops the hit.
  assert.deepEqual(decide(ItemIdx.rocket, {}, { variant: "balloon" }), { result: "hit", variant: "balloon" });
  assert.deepEqual(decide(ItemIdx.rocket, { shield: true }, { variant: "balloon" }),
    { result: "blocked", by: "shield" });
  assert.deepEqual(decide(ItemIdx.ufo, { angel: true }, { variant: "headband" }),
    { result: "hit", variant: "headband" });
});

test("warnings follow the families; the lion mask rocket gives none", () => {
  const warn = (idx: number) => warningOf(idx, behaviour(idx));
  for (const idx of [ItemIdx.rocket, ItemIdx.goldRocket, ItemIdx.tigerRocket, ItemIdx.lockdownRocket,
    ItemIdx.snowman, ItemIdx.ufo, ItemIdx.talisman, ItemIdx.guideRocket]) assert.equal(warn(idx), "rocket", String(idx));
  for (const idx of [ItemIdx.waterFly, ItemIdx.snowWaterFly, ItemIdx.waterbombFly, ItemIdx.honeyBee])
    assert.equal(warn(idx), "waterfly", String(idx));
  for (const idx of [ItemIdx.lionMaskRocket, ItemIdx.devil, ItemIdx.banana, ItemIdx.cloud2])
    assert.equal(warn(idx), undefined, String(idx));
  assert.equal(physicsEffect("hold"), "hold");
  assert.equal(physicsEffect("knockback"), "knockback");
  assert.equal(physicsEffect("invincible"), undefined);
  assert.equal(kartEffectOf("hold"), "hold");
});

test("the aim candidate is the nearest opponent ahead inside the cone and range", () => {
  const pose = { position: { x: 0, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 2 } };
  const at = (playerId: string, x: number, z: number) => ({ playerId, position: { x, y: 0, z } });
  assert.equal(chooseAimTarget(pose, []), undefined);
  assert.equal(chooseAimTarget(pose, [at("behind", 0, -10)]), undefined);
  assert.equal(chooseAimTarget(pose, [at("wide", 10, 10)]), undefined);
  assert.equal(chooseAimTarget(pose, [at("far", 0, ITEM_RACE_TUNING.aimRangeM + 1)]), undefined);
  assert.equal(chooseAimTarget(pose, [at("far", 0, 120), at("near", 3, 30), at("edge", 0, 5)])?.playerId,
    "edge");
  const cone = Math.tan(ITEM_RACE_TUNING.aimConeHalfAngleDegrees * Math.PI / 180) * 100;
  assert.equal(chooseAimTarget(pose, [at("inside", cone - 0.5, 100)])?.playerId, "inside");
  assert.equal(chooseAimTarget(pose, [at("outside", cone + 0.5, 100)]), undefined);
});

test("stage projection maps the camera's clip space onto 1600×900", () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  // A projection that divides by -z (looking down -z).
  const perspective = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0];
  const camera = { matrixWorldInverse: { elements: identity }, projectionMatrix: { elements: perspective } };
  assert.deepEqual(projectToStage(camera, { x: 0, y: 0, z: -10 }), { x: 800, y: 450 });
  assert.deepEqual(projectToStage(camera, { x: 10, y: 10, z: -10 }), { x: 1600, y: 0 });
  assert.equal(projectToStage(camera, { x: 0, y: 0, z: 10 }), undefined, "behind the camera");
  // A view translation moves the point.
  const moved = { ...camera, matrixWorldInverse: { elements: [...identity.slice(0, 12), -5, 0, 0, 1] } };
  assert.deepEqual(projectToStage(moved, { x: 5, y: 0, z: -10 }), { x: 800, y: 450 });
});

test("log teams and merged victim names", () => {
  assert.equal(teamColor(1, false), "solo");
  assert.equal(teamColor(1, true), "red");
  assert.equal(teamColor(2, true), "blue");
  assert.equal(teamColor(null, true), "solo");
  assert.equal(victimsText([]), "");
  assert.equal(victimsText(["甲"]), "甲");
  assert.equal(victimsText(["甲", "乙", "丙"]), "甲 等3人");
});

test("the slot mirror applies pending uses and swaps over the confirmed slots", () => {
  const mirror = new ItemSlotMirror(3);
  assert.deepEqual(mirror.slots, [-1, -1, -1]);
  mirror.confirm([7, 10]);
  assert.deepEqual(mirror.slots, [7, 10, -1]);
  const swap = mirror.begin("swap");
  const use = mirror.begin("use");
  assert.deepEqual(mirror.slots, [7, -1, -1]);
  // A grant answered before them changes the base; the pending operations stay on top.
  mirror.confirm([7, 10, 6]);
  assert.deepEqual(mirror.slots, [7, 6, -1]);
  mirror.reject(swap);
  assert.deepEqual(mirror.slots, [10, 6, -1]);
  mirror.confirm([10, 6, -1], use);
  assert.deepEqual(mirror.slots, [10, 6, -1]);
  assert.equal(mirror.pending.length, 0);
  // A swap with one item does nothing.
  mirror.confirm([10, -1, -1]);
  mirror.begin("swap");
  assert.deepEqual(mirror.slots, [10, -1, -1]);
  assert.deepEqual(normalizeSlots([5, 300, -7, 2], 3), [5, 300, -1]);
  assert.deepEqual(normalizeSlots([5], 2), [5, -1]);
  assert.equal(new ItemSlotMirror(0).capacity, 2);
  mirror.reset();
  assert.deepEqual(mirror.slots, [-1, -1, -1]);
});

test("the test catalog behaves exactly like the original item.bml catalog", async () => {
  const real = await loadItemCatalog(await loadMirrorLibrary(ITEM_CONTAINERS));
  for (const item of real.items) {
    assert.deepEqual(catalog.get(item.idx)?.behaviour, item.behaviour, item.name);
    const aim = item.states.get("Aim");
    if (aim) assert.deepEqual(catalog.get(item.idx)!.states.get("Aim")!.auxFx, aim.auxFx, item.name);
  }
});
