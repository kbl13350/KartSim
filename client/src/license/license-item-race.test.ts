import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Group } from "three";

import { ITEM_REGISTRY, ItemIdx } from "../item/item-catalog";
import {
  controllerFixture, pose, settle, RIVAL, SELF, SERVER_OFFSET_MS, type ControllerFixture,
} from "../item/item-race-test-support";
import type { Vec3 } from "../item/item-race-rules";
import type { LicenseStepSetup } from "./license-api";
import { LicenseItemAuthority, type LicenseItemTarget } from "./license-item-authority";
import { LicenseItemRace, licenseItemPlan, scriptedAttack } from "./license-item-race";
import { licenseDummies, licenseTargets } from "./license-item-targets";
import type { LicenseMissionSpec } from "./license-mission";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** The real controller on the license authority, the server clock 1000 ms ahead as in the fixture. */
function race(options: { capacity?: 1 | 2; startSlots?: number[]; cubeItem?: number; refill?: boolean;
  changers?: { slot: number; item: number }; changeTo?: number; targets?: LicenseItemTarget[];
  landing?(itemId: number, point: Vec3): Vec3 | undefined } = {}) {
  const f = controllerFixture({ capacity: options.capacity ?? 2,
    ...(options.changers ? { changers: { ...options.changers, itemArmed: false } } : {}) });
  const hits: Array<[string, number]> = [];
  const authority = new LicenseItemAuthority({
    playerId: SELF, catalog: f.catalog, capacity: options.capacity ?? 2,
    startSlots: options.startSlots ?? [],
    ...(options.cubeItem !== undefined ? { cubeItem: options.cubeItem } : {}),
    refill: options.refill ?? false,
    ...(options.changers ? { changers: options.changers } : {}),
    ...(options.changeTo !== undefined ? { changeTo: options.changeTo } : {}),
    now: () => f.state.now + SERVER_OFFSET_MS,
    position: () => ({ ...f.physics.body.position }),
    targets: options.targets ?? [],
    onTargetHit: (target, itemId) => hits.push([target.id, itemId]),
    ...(options.landing ? { landing: options.landing } : {}),
  });
  authority.subscribeItem(event => f.connection.emit(event as never));
  f.connection.reply = request => authority.sendItem(request.action as never, request.fields);
  for (const target of options.targets ?? []) f.poses.set(target.id, pose(target.pose.position));
  return { f, authority, hits };
}

async function frames(f: ControllerFixture, authority: LicenseItemAuthority, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 16) {
    f.state.now += 16;
    f.controller.update(f.state.now);
    authority.update(f.state.now + SERVER_OFFSET_MS);
    await settle();
  }
}

const target = (id: string, position: Vec3): LicenseItemTarget => ({ id, pose: { position }, alive: true });
const press = (f: ControllerFixture, phase: "press" | "release") =>
  f.controller.handleCommand({ kind: "use", phase }, f.state.now);

test("获得道具: a box gives the booster into the one slot and Ctrl boosts", async () => {
  const { f, authority } = race({ capacity: 1, cubeItem: ItemIdx.booster });
  authority.start();
  await frames(f, authority, 50);
  assert.deepEqual(f.controller.slots.slots, [-1]);
  f.controller.cube(70);
  await frames(f, authority, 50);
  assert.deepEqual(f.controller.slots.slots, [ItemIdx.booster]);
  // The one slot is full: the next box gives nothing.
  f.controller.cube(71);
  await frames(f, authority, 50);
  assert.deepEqual(authority.currentSlots, [ItemIdx.booster]);
  press(f, "press");
  await frames(f, authority, 50);
  assert.equal(f.physics.boosters, 1);
  assert.deepEqual(f.controller.slots.slots, [-1]);
});

test("导弹练习: the missile locks on the board, hits it and comes back (nonLimitItem)", async () => {
  const board = target(RIVAL, { x: 0, y: 0, z: 60 });
  const { f, authority, hits } = race({ capacity: 1, startSlots: [ItemIdx.rocket], refill: true,
    targets: [board] });
  authority.start();
  await frames(f, authority, 50);
  assert.deepEqual(f.controller.slots.slots, [ItemIdx.rocket]);
  press(f, "press");
  await frames(f, authority, 800);
  assert.equal(f.controller.aim?.phase, "ontarget");
  press(f, "release");
  await frames(f, authority, 50);
  assert.deepEqual(f.connection.of("use"), [{ itemId: ItemIdx.rocket, targetId: RIVAL }]);
  assert.deepEqual(authority.currentSlots, [ItemIdx.rocket], "the rocket is given again");
  // 60 units at the rocket's speed, at least the 300 ms floor.
  await frames(f, authority, 1500);
  assert.deepEqual(hits, [[RIVAL, ItemIdx.rocket]]);
});

test("水炸弹练习: a water bomb thrown at the target traps it when it lands", async () => {
  const board = target(RIVAL, { x: 0, y: 0, z: 25 });
  const { f, authority, hits } = race({ capacity: 1, startSlots: [ItemIdx.waterBomb], targets: [board] });
  authority.start();
  await frames(f, authority, 50);
  press(f, "press");
  await frames(f, authority, 50);
  assert.equal(f.connection.of("use").length, 1);
  assert.deepEqual(hits, [], "not before it lands");
  await frames(f, authority, 1200);
  assert.deepEqual(hits, [[RIVAL, ItemIdx.waterBomb]]);
});

test("水炸弹练习: thrown at the red mark, the bomb lands on the board 200 units on", async () => {
  const far = target(RIVAL, { x: 0, y: 0, z: 200 });
  const { f, authority, hits } = race({ capacity: 1, startSlots: [ItemIdx.waterBomb], targets: [far],
    landing: () => ({ ...far.pose.position }) });
  authority.start();
  await frames(f, authority, 50);
  press(f, "press");
  await frames(f, authority, 1200);
  assert.deepEqual(hits, [[RIVAL, ItemIdx.waterBomb]]);
  // Without a landing it falls where it was thrown, short of the board.
  const short = race({ capacity: 1, startSlots: [ItemIdx.waterBomb], targets: [target(RIVAL, { x: 0, y: 0, z: 200 })] });
  short.authority.start();
  await frames(short.f, short.authority, 50);
  press(short.f, "press");
  await frames(short.f, short.authority, 1200);
  assert.deepEqual(short.hits, []);
});

test("道具换位卡: one card (oneTime) swaps the time bomb behind the magnet once", async () => {
  const { f, authority } = race({ startSlots: [ItemIdx.timeBomb, ItemIdx.magnet],
    changers: { slot: 1, item: 0 } });
  authority.start();
  await frames(f, authority, 50);
  f.controller.handleCommand({ kind: "swap" }, f.state.now);
  await frames(f, authority, 400);
  assert.deepEqual(f.controller.slots.slots, [ItemIdx.magnet, ItemIdx.timeBomb]);
  await assert.rejects(authority.sendItem("swap"), /NO_SLOT_CHANGER/);
});

test("道具变更卡: Z turns the time bomb of the one slot into the magnet, once", async () => {
  const { f, authority } = race({ capacity: 1, startSlots: [ItemIdx.timeBomb],
    changers: { slot: 0, item: 1 }, changeTo: ItemIdx.magnet });
  authority.start();
  await frames(f, authority, 50);
  f.controller.handleCommand({ kind: "change" }, f.state.now);
  await frames(f, authority, 50);
  assert.deepEqual(f.controller.slots.slots, [ItemIdx.magnet]);
  await assert.rejects(authority.sendItem("change"), /NO_ITEM_CHANGER/);
});

test("护盾练习 / 逃脱水炸弹: the scripted water fly traps the kart unless the shield is up", async () => {
  {
    const { f, authority } = race({ capacity: 1, startSlots: [ItemIdx.shield] });
    authority.start();
    await frames(f, authority, 50);
    authority.attack(ItemIdx.waterFly, "npc", 1500);
    await frames(f, authority, 300);
    press(f, "press");
    await frames(f, authority, 1800);
    assert.equal(f.physics.itemEffects.applied.length, 0);
    assert.deepEqual(f.connection.of("hit").map(hit => [hit.result, hit.by]), [["blocked", "shield"]]);
  }
  {
    const { f, authority } = race();
    authority.start();
    await frames(f, authority, 50);
    authority.attack(ItemIdx.waterFly, "npc", 300);
    await frames(f, authority, 600);
    assert.deepEqual(f.physics.itemEffects.applied.map(effect => effect.kind), ["trap"]);
  }
});

test("克服大魔王: the scripted devil reverses the steering", async () => {
  const { f, authority } = race();
  authority.start();
  await frames(f, authority, 50);
  authority.attack(ItemIdx.devil, "npc", 0);
  await frames(f, authority, 2000);
  assert.deepEqual(f.physics.itemEffects.applied.map(effect => [effect.kind, effect.durationMs]),
    [["reverse", 3000]]);
});

const byName = new Map(ITEM_REGISTRY.map(entry => [entry.name, { idx: entry.idx }]));
const catalog = { byName: (name: string) => byName.get(name) as never };

function spec(step: number, mission: number, setup: LicenseStepSetup): LicenseMissionSpec {
  return { step, mission, rule: "item", setup, progress: { objective: false } };
}

test("the release set-up of each item step", async () => {
  const license = JSON.parse(await readFile(path.resolve(project,
    "../server-go/internal/data/license/license.json"), "utf8")) as
    { licenses: Array<{ steps: Array<{ step: number; mission: number; rule: string; setup: LicenseStepSetup }> }> };
  const steps = new Map(license.licenses.flatMap(entry => entry.steps).map(step => [step.step, step]));
  const plan = (n: number) => {
    const row = steps.get(n)!;
    assert.equal(row.rule, "item", `step ${n}`);
    return licenseItemPlan(spec(n, row.mission, row.setup), catalog);
  };
  assert.deepEqual(plan(2), { capacity: 1, startSlots: [], cubeItem: ItemIdx.booster, refill: false,
    changers: { slot: 0, item: 0 }, clearOnTargets: false });
  assert.deepEqual(plan(4), { capacity: 1, startSlots: [ItemIdx.rocket], refill: true,
    changers: { slot: 0, item: 0 }, clearOnTargets: true });
  // 道具换位卡: two slots, one swap card; 道具变更卡: one slot, Z gives the magnet once.
  assert.deepEqual(plan(8).changers, { slot: 1, item: 0 });
  assert.deepEqual(plan(8).startSlots, [ItemIdx.timeBomb, ItemIdx.magnet]);
  assert.deepEqual({ ...plan(19) }, { capacity: 1, startSlots: [ItemIdx.timeBomb], changeTo: ItemIdx.magnet,
    refill: false, changers: { slot: 0, item: 1 }, clearOnTargets: false });
  assert.equal(plan(20).cubeItem, ItemIdx.rocket);
  assert.deepEqual(plan(25).startSlots, [ItemIdx.booster]);
  // 逃脱水炸弹 throws its water bomb at the player; 水炸弹练习's mark is the player's own.
  assert.equal(scriptedAttack("waterbomb", plan(13)), ItemIdx.waterBomb);
  assert.equal(scriptedAttack("waterbomb", plan(11)), undefined);
  assert.equal(scriptedAttack("waterfly", plan(9)), ItemIdx.waterFly);
  assert.equal(scriptedAttack("devil1", plan(25)), ItemIdx.devil);
  assert.equal(scriptedAttack("booster", plan(2)), undefined);
});

test("targets stand at the course's target dummies: boards, the iron and their names", () => {
  const dummy = (name: string, position: number[]) =>
    ({ kind: "ToDummy", name, transform: { position, basis: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] } });
  const objects = [dummy("iron", [431, 180, 23]), dummy("target1", [170, 454, 20]),
    dummy("target0", [174, 222, 20]), dummy("start", [305, 180, 23]), { kind: "ToItemCube", name: "ic00" }];
  const dummies = licenseDummies(objects);
  assert.deepEqual(dummies.map(entry => entry.name), ["target0", "target1", "iron"]);
  const targets = licenseTargets(dummies, { targetName: "target2" });
  assert.deepEqual(targets.map(entry => [entry.id, entry.role, entry.name]),
    [["target0", "board", "海盗船长"], ["target1", "board", "海盗船长"], ["iron", "iron", "铁块"]]);
  // three.js: client (x, y, z-up) → (x, z, -y); a board is aimed at its face, above its foot.
  assert.deepEqual(targets[2]!.pose.position, { x: 431, y: 23, z: -180 });
  assert.ok(targets[0]!.pose.position.y > 20);
  // 磁铁练习 names the iron for its target0.
  assert.deepEqual(licenseTargets(dummies.slice(0, 1), { targetName: "iron" }).map(entry => entry.role), ["iron"]);
});

/** A license item race on fakes: the real controller and authority, targets without models. */
function itemRace(spec: LicenseMissionSpec, plan: ReturnType<typeof licenseItemPlan>,
  targets: ReturnType<typeof licenseTargets>) {
  const f = controllerFixture({ capacity: plan.capacity });
  const hits: string[] = [];
  const field = {
    object: new Group(), targets,
    reset() { for (const target of targets) target.alive = true; },
    hit(target: { alive: boolean; id: string }) { target.alive = false; hits.push(target.id); },
    update() {}, dispose() {},
  };
  const Race = LicenseItemRace as unknown as new (...args: unknown[]) => LicenseItemRace;
  const items = new Race(spec, plan, f.catalog, f.physics, field, undefined, undefined, undefined, "license");
  // The time attack race as the item race reads it: racing from 0 until a finish.
  const host = {
    session: { lifecycle: { phase: 2, startAtMs: 1, finishAtMs: 0, effectiveTime: (raw: number) => raw } },
    drivingInput: { inverted: false, swapped: false,
      setSteeringInverted(value: boolean) { this.inverted = value; },
      setForwardReverseSwap(value: boolean) { this.swapped = value; } },
  };
  items.update(host, 100);
  return { items, f, hits, host };
}

const hitBoard = (items: LicenseItemRace, target: unknown) =>
  (items as unknown as { targetHit(target: unknown, itemId: number): void }).targetHit(target, ItemIdx.rocket);

test("连续导弹: with every board down the boxes give the magnet; 导弹练习 clears on its board", async () => {
  const dummies = licenseDummies([
    ...[0, 1].map(n => ({ kind: "ToDummy", name: `target${n}`, transform: { position: [0, -30 - n * 30, 0] } })),
    { kind: "ToDummy", name: "iron", transform: { position: [0, -200, 0] } },
  ]);
  const streak = spec(20, 11, { slotCount: 1, cubeItem: "rocket", targetName: "target2" });
  const { items } = itemRace(streak, licenseItemPlan(streak, catalog),
    licenseTargets(dummies, { targetName: "target2" }));
  assert.equal(items.objectiveMet, false);
  assert.equal(streak.progress.failure, "任务失败：没有用导弹击中赛道上所有的海盗船长。");
  const authority = items.authority;
  const grant = async () => ((await authority.sendItem("cube", { cubeId: 1 })) as { itemId: number | null }).itemId;
  authority.start();
  assert.equal(await grant(), ItemIdx.rocket);
  for (const target of items.targets.targets.filter(entry => entry.role === "board")) hitBoard(items, target);
  assert.equal(items.objectiveMet, true);
  assert.equal(streak.progress.objective, true);
  assert.equal(items.consumeClear(), false, "连续导弹 still finishes at the goal");
  await authority.sendItem("use", { itemId: ItemIdx.rocket });
  assert.equal(await grant(), ItemIdx.magnet);
  items.dispose();

  const missile = spec(4, 3, { slotCount: 1, slots: ["rocket"], nonLimitItem: true, targetName: "target2" });
  const practice = itemRace(missile, licenseItemPlan(missile, catalog),
    licenseTargets(dummies.slice(0, 1), { targetName: "target2" }));
  hitBoard(practice.items, practice.items.targets.targets[0]);
  assert.equal(practice.items.consumeClear(), true);
  assert.equal(practice.items.consumeClear(), false);
  practice.items.dispose();

  // A missile landing after the goal was judged no longer counts.
  const late = itemRace(missile, licenseItemPlan(missile, catalog),
    licenseTargets(dummies.slice(0, 1), { targetName: "target2" }));
  late.host.session.lifecycle.finishAtMs = 5000;
  late.items.update(late.host, 5100);
  hitBoard(late.items, late.items.targets.targets[0]);
  assert.equal(missile.progress.objective, false);
  assert.equal(late.items.consumeClear(), false);
  late.items.dispose();

  // A step without boards (获得道具) meets its objective from the start.
  const boost = spec(2, 1, { slotCount: 1, cubeItem: "booster" });
  const plain = itemRace(boost, licenseItemPlan(boost, catalog), []);
  assert.equal(boost.progress.objective, true);
  plain.items.dispose();
});

test("克服大魔王: the devil's swapped steering ends with the race", () => {
  const devil = spec(14, 5, {});
  const { items, f, host } = itemRace(devil, licenseItemPlan(devil, catalog), []);
  Object.assign(f.physics.itemEffects, { steeringInverted: true, forwardBackSwapped: true });
  items.update(host, 200);
  assert.deepEqual([host.drivingInput.inverted, host.drivingInput.swapped], [true, true]);
  // Left for the menu mid-reverse (no frame clears it): the next race steers normally.
  items.dispose();
  assert.deepEqual([host.drivingInput.inverted, host.drivingInput.swapped], [false, false]);
});
