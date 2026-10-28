import assert from "node:assert/strict";
import test from "node:test";
import { createSpeedDriver, neutralInput, throttleInput, type TestDriver } from "../driving/item-test-fixtures";
import { DrivingAction } from "../input/driving-input";
import { HazardTraps, REMOTE_TRAP_TUNING, pressTrapEscape } from "./hazard-traps";
import { ItemIdx } from "./item-catalog";
import type { ItemPairObject, ItemPairWorld } from "./item-cubes";
import type { ItemHazardSource } from "./item-hazards";
import type { ItemPresenterPose, ItemRacePresenter } from "./item-race-presenter";
import { carriedHazards } from "./hazard-scenery-items";

const MINE = { x: 0, y: 0.5, z: 30 };
const TRAP_MS = 2000;
const SHIELD_MS = 2000;

function source(): ItemHazardSource {
  return {
    hazards: [{ id: 7, name: "mo_dfdf548+", kind: "waterMine", itemIdx: ItemIdx.waterMine, radius: 2,
      clientPosition: [MINE.x, -MINE.z, MINE.y], position: { ...MINE }, anchor: {}, onlyItemGame: false }],
    cooldownMs: 3000,
  };
}

type Call = [string, ...unknown[]];

function fakePresenter(calls: Call[]): ItemRacePresenter {
  const record = (name: string) => (...args: unknown[]) => { calls.push([name, ...args]); };
  return {
    object: {} as never,
    used: record("used"), placed: record("placed"), hit: record("hit"), removed: record("removed"),
    kartEffect: record("kartEffect"), endKartEffect: record("endKartEffect"), sound: record("sound"),
    stopSound: record("stopSound"), update: () => {}, reset: record("reset"), dispose: record("dispose"),
  } as unknown as ItemRacePresenter;
}

/** The race coordinator's half of the pairing: one contact, run once per frame. */
function fakeWorld(): ItemPairWorld & { contacts: ItemPairObject[] } {
  const contacts: ItemPairObject[] = [];
  return {
    contacts,
    isKartPeer: () => true,
    queueKartPairObject: (contact: ItemPairObject) => { contacts.push(contact); },
  } as never;
}

function pose(position: { x: number; y: number; z: number }): ItemPresenterPose {
  return { position: { ...position }, right: { x: -1, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 } };
}

function setup(canTrigger = () => true) {
  const calls: Call[] = [];
  const traps = new HazardTraps(source(), undefined, TRAP_MS, SHIELD_MS, fakePresenter(calls));
  const driver = createSpeedDriver();
  const world = fakeWorld();
  traps.attach(world, { physics: driver.vehicle, playerId: "me", canTrigger });
  /** One race frame: physics, the pairing, then the presenter frame. */
  const frame = (input = throttleInput, remotes: Parameters<HazardTraps["present"]>[5] = []) => {
    driver.run(16, input);
    for (const contact of world.contacts) contact.slot13({}, driver.nowMs);
    traps.present(driver.nowMs, {}, 1600, 900, pose(driver.vehicle.body.position), remotes);
  };
  return { calls, traps, driver, world, frame };
}

function driveInto(driver: TestDriver, frame: () => void): number {
  for (let index = 0; index < 400; index += 1) {
    frame();
    if (driver.vehicle.itemEffects.active.has("trap")) return driver.nowMs;
  }
  throw Error("the kart never reached the water mine");
}

test("a legacy track spring renders and knocks a speed kart back with its Affect duration", () => {
  const anchor = { kind: "node", className: "Relement", children: [] };
  assert.equal(carriedHazards([{ kind: "ToMovableObject", name: "mo_forcezone", object: anchor,
    property: { name: "property", attributes: [], children: [{ name: "object", children: [],
      attributes: [{ name: "type", value: "forceZone" }] }] } }])[0]?.anchor, anchor,
  "an empty authored anchor still receives the spring's visible Set model");
  const calls: Call[] = [];
  const springs: ItemHazardSource = { ...source(), hazards: source().hazards.map(hazard => ({
    ...hazard, kind: "forceZone", itemIdx: ItemIdx.forceZone, radius: 3,
  })) };
  const traps = new HazardTraps(springs, undefined, TRAP_MS, SHIELD_MS, fakePresenter(calls), 500);
  const driver = createSpeedDriver();
  const world = fakeWorld();
  traps.attach(world, { physics: driver.vehicle, playerId: "me", canTrigger: () => true });
  let hit = false;
  for (let i = 0; i < 400; i++) {
    driver.run(16);
    for (const contact of world.contacts) contact.slot13({}, driver.nowMs);
    traps.present(driver.nowMs, {}, 640, 360, pose(driver.vehicle.body.position));
    if (driver.vehicle.itemEffects.active.has("knockback")) { hit = true; break; }
  }
  assert.ok(hit, "the kart reaches the authored spring trigger");
  assert.equal(driver.vehicle.itemEffects.active.has("trap"), false);
  const start = driver.vehicle.body.position.z;
  driver.run(400);
  assert.ok(driver.vehicle.body.position.z < start - 1, "spring reverses the kart's motion");
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[2] === "knockback" && call[4] === 500));
  assert.equal((calls.find(call => call[0] === "hit")![1] as { itemId: number }).itemId, ItemIdx.forceZone);
  driver.run(200);
  assert.equal(driver.vehicle.itemEffects.active.has("knockback"), false);
});

test("a speed kart gets item effects and is trapped where it touches a carried water mine", () => {
  const { calls, driver, frame } = setup();
  assert.notEqual(driver.vehicle.itemMode, true, "not an item race kart");
  assert.ok(driver.vehicle.itemEffects, "the trap layer added the effects");
  driveInto(driver, frame);
  const at = { ...driver.vehicle.body.position };
  assert.ok(Math.hypot(at.x - MINE.x, at.z - MINE.z) <= 2.5, `trapped at ${JSON.stringify(at)}`);
  const hit = calls.find(call => call[0] === "hit")![1] as Record<string, unknown>;
  assert.deepEqual({ itemId: hit.itemId, victimId: hit.victimId, result: hit.result },
    { itemId: ItemIdx.waterMine, victimId: "me", result: "hit" });
  frame();
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[1] === "me" && call[2] === "trap" &&
    call[4] === TRAP_MS), "the bubble shows for Affect.life");
  for (let index = 0; index < 60; index += 1) frame();
  const held = driver.vehicle.body.position;
  assert.ok(Math.hypot(held.x - at.x, held.z - at.z) < 0.05, "the bubble holds the kart in place");
  assert.ok(driver.horizontalSpeed < 0.01);
});

test("left/right mashing breaks the bubble early; then the blue shield, and no escape booster", () => {
  const { calls, driver, frame } = setup();
  const start = driveInto(driver, frame);
  const effects = driver.vehicle.itemEffects;
  for (let press = 0; press < 20; press += 1) {
    pressTrapEscape(effects, [{ action: press % 2 ? DrivingAction.SteerLeft : DrivingAction.SteerRight, down: true }],
      true);
    frame(neutralInput);
    if (!effects.active.has("trap")) break;
  }
  for (let index = 0; index < 40 && effects.active.has("trap"); index += 1) frame(neutralInput);
  const out = driver.nowMs - start;
  assert.ok(out < TRAP_MS - 500, `escaped after ${out} ms`);
  frame(neutralInput);
  assert.ok(calls.some(call => call[0] === "endKartEffect" && call[2] === "trap"));
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[2] === "escapeShield"));
  assert.equal(effects.immune, true, "the shield keeps the mine off for a while");
  assert.equal(effects.escapeBoostEndMs, 0, "speed races give no escape booster");
});

test("presses outside a bubble, or before GO, do nothing", () => {
  const { driver } = setup();
  const effects = driver.vehicle.itemEffects;
  let pressed = 0;
  const counting = { active: effects.active, escapePress: () => { pressed += 1; return true; } };
  pressTrapEscape(counting, [{ action: DrivingAction.SteerLeft, down: true }], true);
  pressTrapEscape(undefined, [{ action: DrivingAction.SteerLeft, down: true }], true);
  assert.equal(pressed, 0);
});

test("no trap while the race says no (countdown, reset, warp)", () => {
  const { driver, frame } = setup(() => false);
  for (let index = 0; index < 200; index += 1) frame();
  assert.ok(driver.vehicle.body.position.z > MINE.z + 5, "drove straight through");
  assert.equal(driver.vehicle.itemEffects.active.has("trap"), false);
});

test("a remote racer that stops dead in a water mine shows a bubble until it drives off", () => {
  const { calls, frame } = setup(() => false);
  const tuning = REMOTE_TRAP_TUNING;
  let rival = { x: 0, y: 0.5, z: 20 };
  let passer = { x: 0.5, y: 0.5, z: 20 };
  const racers = () => [{ playerId: "rival", pose: pose(rival) }, { playerId: "passer", pose: pose(passer) }];
  // Both run into the mine at 40 m/s; the rival stops in it, the other drives
  // through and brakes to a halt just past it.
  let passerSpeed = 0.64;
  for (let index = 0; index < 20 + Math.ceil(tuning.stillWindowMs / 16) + 2; index += 1) {
    rival = { ...rival, z: Math.min(MINE.z + 1, rival.z + 0.64) };
    if (passer.z > MINE.z + 2) passerSpeed = Math.max(0, passerSpeed - 0.06);
    passer = { ...passer, z: passer.z + passerSpeed };
    frame(throttleInput, racers());
  }
  assert.equal(passerSpeed, 0, "the passer has stopped too");
  const bubbles = calls.filter(call => call[0] === "kartEffect" && call[2] === "trap");
  assert.deepEqual(bubbles.map(call => call[1]), ["rival"], "only the racer that stopped");
  assert.equal(bubbles[0]![4], TRAP_MS);
  assert.ok(calls.some(call => call[0] === "hit" && (call[1] as { victimId: string }).victimId === "rival"));
  // Half a second in it breaks out and drives away: the bubble ends, the shield shows.
  for (let index = 0; index < 20; index += 1) frame(throttleInput, racers());
  for (let index = 0; index < 5; index += 1) {
    rival = { ...rival, z: rival.z + 0.64 };
    frame(throttleInput, racers());
  }
  assert.ok(calls.some(call => call[0] === "endKartEffect" && call[1] === "rival" && call[2] === "trap"));
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[1] === "rival" && call[2] === "escapeShield"));
});

test("a remote racer parked away from the mines gets no bubble", () => {
  const { calls, frame } = setup(() => false);
  const parked = { x: 30, y: 0.5, z: 30 };
  for (let index = 0; index < 60; index += 1) frame(throttleInput, [{ playerId: "parked", pose: pose(parked) }]);
  assert.equal(calls.some(call => call[0] === "kartEffect"), false);
});

test("a remote bubble that runs its full Affect.life is followed by the blue shield", () => {
  const { calls, frame } = setup(() => false);
  let rival = { x: 0, y: 0.5, z: 26 };
  const racers = () => [{ playerId: "rival", pose: pose(rival) }];
  for (let index = 0; index < 8; index += 1) {
    rival = { ...rival, z: Math.min(MINE.z, rival.z + 0.64) };
    frame(throttleInput, racers());
  }
  for (let index = 0; index < Math.ceil((TRAP_MS + 600) / 16); index += 1) frame(throttleInput, racers());
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[1] === "rival" && call[2] === "trap"));
  assert.ok(calls.some(call => call[0] === "kartEffect" && call[1] === "rival" && call[2] === "escapeShield"));
  assert.equal(calls.some(call => call[0] === "endKartEffect" && call[1] === "rival"), false);
});
