import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ITEM_EFFECT_TUNING, type ItemDirectionPress, type ItemEffectEvent, type ItemEffectKind,
} from "./item-effects";
import { integrateVehicleRoadOrientation } from "./orientation-integration";
import {
  createItemDriver, neutralInput, throttleInput, type TestDriver, type TestVehicle,
} from "./item-test-fixtures";

const f32 = Math.fround;

/** A kart cruising straight down +z on the flat road. */
function cruising(milliseconds = 3000): TestDriver {
  const driver = createItemDriver(373);
  driver.run(milliseconds);
  driver.vehicle.itemEffects.consumeEvents();
  return driver;
}

function heading(vehicle: TestVehicle): number {
  return Math.atan2(vehicle.body.forward.x, vehicle.body.forward.z);
}

function ends(events: ItemEffectEvent[]): Array<[string, string | undefined]> {
  return events.filter(event => event.phase === "end").map(event => [event.kind, event.reason]);
}

function horizontal(vehicle: TestVehicle): { x: number; z: number } {
  return { x: vehicle.body.position.x, z: vehicle.body.position.z };
}

test("banana spin (two turns asked for): yaw turns without drive or grip, then driving resumes", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const entrySpeed = driver.horizontalSpeed;
  assert.ok(entrySpeed > 40);
  vehicle.runtime.physicsState = 3; // a running booster is cancelled by the hit
  vehicle.runtime.stateRemainingMs = 2000;
  assert.equal(effects.apply("spin", 2000, { turns: 2 }), true);
  assert.equal(vehicle.runtime.physicsState, 0);
  assert.deepEqual([...effects.active], ["spin"]);
  assert.equal(effects.canUseItem, true);
  assert.equal(effects.suppressesDrive, true);
  assert.equal(effects.suppressesAutomaticReset, true);
  assert.ok(effects.cameraBasis.forward.z > 0.999, "the camera keeps the entry heading");

  let turned = 0;
  let previous = heading(vehicle);
  let hitFrames = 0;
  let strength = 0;
  driver.run(1984, throttleInput, 16, current => {
    const now = heading(current);
    let delta = now - previous;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    turned += delta;
    previous = now;
    if (current.runtime.collisionMotionHit) {
      hitFrames += 1;
      strength = current.runtime.collisionMotionStrength;
    }
  });
  assert.equal(hitFrames, 1, "one medium hit motion for the character");
  assert.equal(strength, ITEM_EFFECT_TUNING.spinImpactStrength);
  assert.ok(Math.abs(Math.abs(turned) - 4 * Math.PI) < 0.35, `turned ${turned}`);
  assert.ok(driver.horizontalSpeed < entrySpeed * 0.15, "the slide bleeds off speed with forward held");
  assert.ok(effects.active.has("spin"));
  driver.run(16);
  assert.equal(effects.active.size, 0);
  assert.deepEqual(ends(effects.consumeEvents()), [["spin", "expired"]]);
  assert.ok(Math.abs(Math.sin(heading(vehicle))) < 0.3, "ends facing roughly down the road");
  const slow = driver.horizontalSpeed;
  driver.run(1000);
  assert.ok(driver.horizontalSpeed > slow + 5, "drive and grip are back");
});

test("water bubble: the kart stops where it was, escape mashing shortens it, then a blue shield", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const anchor = horizontal(vehicle);
  assert.equal(effects.apply("trap", 2000), true);
  assert.equal(effects.canUseItem, false);
  assert.equal(effects.immune, true);
  assert.equal(effects.holdsBody, true);
  assert.equal(effects.apply("spin", 2000), false, "no new hit while trapped");
  driver.run(1000);
  assert.deepEqual(horizontal(vehicle), anchor);
  assert.equal(vehicle.body.linearVelocity.x, 0);
  assert.equal(vehicle.body.linearVelocity.z, 0);
  // The bubble model lifts the drawn kart into itself (item-kart-motion.ts); physics holds it on the road.
  assert.ok(Math.abs(vehicle.body.position.y) < 0.1, `${vehicle.body.position.y}`);
  assert.equal(vehicle.state.y, vehicle.body.position.y);
  assert.equal(effects.remainingMs("trap"), 1000);
  driver.run(984);
  assert.ok(effects.active.has("trap"));
  driver.run(16);
  assert.equal(effects.active.has("trap"), false);
  assert.deepEqual(ends(effects.consumeEvents()), [["trap", "expired"]]);
  assert.equal(effects.canUseItem, true);
  assert.equal(effects.immune, true, "blue shield (EscapeAffect)");
  assert.equal(effects.escapeShieldRemainingMs, 2000);
  assert.equal(effects.apply("launch", 1500), false);
  driver.run(500);
  assert.ok(vehicle.body.position.y < 0.1, "the kart dropped back onto the road");
  driver.run(1500);
  assert.equal(effects.immune, false);
  assert.equal(effects.apply("spin", 100), true);

  // Each left/right press removes 120 ms; the bubble always lasts at least 500 ms.
  const escaping = cruising().vehicle.itemEffects;
  escaping.apply("trap", 2000);
  for (let press = 0; press < 5; press += 1) assert.equal(escaping.escapePress(), true);
  assert.equal(escaping.remainingMs("trap"), 1400);
  for (let press = 0; press < 20; press += 1) escaping.escapePress();
  assert.equal(escaping.remainingMs("trap"), ITEM_EFFECT_TUNING.escapeMinimumMs);
  assert.equal(cruising().vehicle.itemEffects.escapePress(), false, "no bubble, nothing to escape");
});

test("by default physics neither spins, lifts nor rolls a hit kart: the hit's kart motion draws that", () => {
  for (const kind of ["spin", "launch", "trap"] as const) {
    const driver = cruising();
    const vehicle = driver.vehicle;
    const start = { ...vehicle.body.position };
    const startHeading = heading(vehicle);
    assert.equal(vehicle.itemEffects.apply(kind, 1500), true);
    let highest = 0;
    let lowestUp = 1;
    driver.run(1200, throttleInput, 16, current => {
      highest = Math.max(highest, current.body.position.y - start.y);
      lowestUp = Math.min(lowestUp, current.body.up.y);
    });
    assert.ok(highest < 0.1, `${kind} lift ${highest}`);
    assert.ok(lowestUp > 0.99, `${kind} roll`);
    assert.ok(Math.abs(Math.sin(heading(vehicle) - startHeading)) < 0.05, `${kind} turned`);
  }
});

test("an escaped bubble ends early and reports the escape", () => {
  const driver = cruising();
  const effects = driver.vehicle.itemEffects;
  effects.apply("trap", 2000, { escapeImmunityMs: 1000 });
  driver.run(96);
  for (let press = 0; press < 20; press += 1) effects.escapePress();
  driver.run(400);
  assert.ok(effects.active.has("trap"));
  driver.run(16);
  assert.deepEqual(ends(effects.consumeEvents()), [["trap", "escaped"]]);
  // The bubble ended at 500 ms; the frame ran on to 512 ms inside the blue shield.
  assert.equal(effects.escapeShieldRemainingMs, 988);
});

test("missile launch (an arc asked for): a visible roll in the air, back on the anchor, locked for 1500 ms", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const anchor = { ...vehicle.body.position };
  const forward = { ...vehicle.body.forward };
  const arc = { height: 2.5, turns: 1 };
  assert.equal(effects.apply("launch", 1500, arc), true);
  assert.equal(effects.canUseItem, false);
  assert.equal(effects.immune, false);
  let peak = 0;
  let lowestUp = 1;
  let hit = 0;
  driver.run(496, throttleInput, 16, current => {
    peak = Math.max(peak, current.body.position.y - anchor.y);
    lowestUp = Math.min(lowestUp, current.body.up.y);
    if (current.runtime.collisionMotionHit) hit = current.runtime.collisionMotionStrength;
  });
  assert.equal(hit, ITEM_EFFECT_TUNING.launchImpactStrength, "strong crash motion");
  assert.ok(Math.abs(peak - arc.height) < 0.01, `${peak}`);
  driver.run(16);
  assert.ok(vehicle.body.up.y < -0.99, "upside down at the top of the arc");
  const wrench = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } };
  vehicle.copyNetworkWrench(wrench);
  const arcAcceleration = -8 * arc.height /
    (ITEM_EFFECT_TUNING.launchAirMs / 1000) ** 2;
  assert.equal(wrench.force.y, f32(vehicle.tuning.mass * arcAcceleration),
    "remote clients extrapolate the same parabola");
  assert.deepEqual(vehicle.body.forward, forward);

  // The sent angular velocity extrapolates the same roll the next frame shows.
  const predicted = {
    body: {
      position: { ...vehicle.body.position }, linearVelocity: { x: 0, y: 0, z: 0 },
      angularVelocity: { ...vehicle.body.angularVelocity },
      right: { ...vehicle.body.right }, forward: { ...vehicle.body.forward }, up: { ...vehicle.body.up },
    },
    runtime: { motionMode: 0, railRelativeOrientation: [], freeOrientationLatch: true },
    visualScaleMode: () => 0,
  };
  integrateVehicleRoadOrientation(predicted as never, f32(0.016));
  driver.run(16);
  for (const axis of ["x", "y", "z"] as const)
    assert.ok(Math.abs(predicted.body.up[axis] - vehicle.body.up[axis]) < 1e-3);

  driver.run(480);
  assert.deepEqual(vehicle.body.position, anchor, "landed where it was hit");
  assert.ok(vehicle.body.up.y > 0.999);
  assert.equal(driver.horizontalSpeed, 0);
  driver.run(480);
  assert.ok(effects.active.has("launch"), "stunned on the ground until 1500 ms");
  assert.equal(driver.horizontalSpeed, 0);
  driver.run(16);
  assert.deepEqual(ends(effects.consumeEvents()), [["launch", "expired"]]);
  driver.run(1000);
  assert.ok(driver.horizontalSpeed > 5, "drives away afterwards");
});

test("devil reverse, UFO slow and thunderbolt shrink follow their timelines", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;

  assert.equal(effects.apply("reverse", 3000, { elapsedMs: 1000 }), true);
  assert.equal(effects.steeringInverted, true);
  assert.equal(effects.remainingMs("reverse"), 2000);
  assert.equal(effects.canUseItem, true);

  assert.equal(effects.apply("slow", 3000), true);
  assert.equal(vehicle.runtime.driveScale, f32(0.4));
  assert.equal(vehicle.runtime.dragScale, 2);
  assert.equal(effects.apply("shrink", 1500), true);
  assert.equal(vehicle.runtime.driveScale, f32(0.2));
  assert.deepEqual(vehicle.runtime.eventScaleTarget, { x: f32(0.6), y: f32(0.6), z: f32(0.6) });
  driver.run(1000);
  assert.equal(vehicle.collisionShape.scaleX, f32(0.6), "the collision box and model shrank");
  assert.equal(vehicle.state.visualScale.x, f32(0.6));
  driver.run(496);
  assert.ok(effects.active.has("shrink"));
  driver.run(16);
  assert.equal(effects.active.has("shrink"), false);
  assert.equal(vehicle.runtime.driveScale, f32(0.4));
  assert.deepEqual(vehicle.runtime.eventScaleTarget, { x: 1, y: 1, z: 1 });
  assert.equal(effects.steeringInverted, true);
  driver.run(496);
  assert.equal(effects.steeringInverted, false);
  driver.run(1000);
  assert.equal(effects.active.size, 0);
  assert.equal(vehicle.runtime.driveScale, 1);
  assert.equal(vehicle.runtime.dragScale, 1);
  assert.equal(vehicle.collisionShape.scaleX, 1);
  assert.deepEqual(ends(effects.consumeEvents()),
    [["shrink", "expired"], ["reverse", "expired"], ["slow", "expired"]]);
});

test("a UFO slows the kart well below its cruising speed until EMP removes it", () => {
  const free = cruising(6000);
  const slowed = cruising(3000);
  slowed.vehicle.itemEffects.apply("slow", 3000);
  slowed.run(3000 - 16);
  assert.ok(slowed.horizontalSpeed < free.horizontalSpeed * 0.75,
    `${slowed.horizontalSpeed} vs ${free.horizontalSpeed}`);
  assert.equal(slowed.vehicle.itemEffects.end("slow"), true);
  assert.equal(slowed.vehicle.runtime.driveScale, 1);
  assert.equal(slowed.vehicle.itemEffects.end("slow"), false);
});

test("barricade: a hard stop for 500 ms without the flatten side effects", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const anchor = horizontal(vehicle);
  let pets = 0;
  vehicle.addFlyingPetListener(() => { pets += 1; });
  assert.equal(effects.apply("barrier", 500), true);
  assert.equal(effects.canUseItem, false);
  driver.run(16);
  assert.equal(vehicle.consumeCollisionAudioStrength(), ITEM_EFFECT_TUNING.barrierImpactStrength);
  driver.run(480);
  assert.deepEqual(horizontal(vehicle), anchor);
  assert.equal(driver.horizontalSpeed, 0);
  assert.equal(vehicle.visualScaleMode(), 0);
  assert.equal(vehicle.runtime.pressProtected1C0, false);
  assert.equal(vehicle.runtime.pressState, 0);
  assert.equal(pets, 0);
  assert.equal(effects.apply("barrier", 500), false, "one barricade at a time");
  driver.run(16);
  assert.deepEqual(ends(effects.consumeEvents()), [["barrier", "expired"]]);
  driver.run(500);
  assert.ok(driver.horizontalSpeed > 2);
});

test("magnet: state 16 pulls the kart toward a moving target until it arrives", () => {
  const driver = cruising(1000);
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const target = { x: 20, y: 0, z: vehicle.body.position.z + 80 };
  assert.equal(effects.apply("pull", 3000, { target: () => target }), true);
  assert.equal(vehicle.runtime.physicsState, 16);
  assert.equal(vehicle.audioState(), 16, "the magnet loop plays from the physics state");
  let arrivedAt = 0;
  let arrivalGap = Infinity;
  let topSpeed = 0;
  driver.run(3000, throttleInput, 16, current => {
    target.z += 0.32; // the target keeps driving away at 20 m/s
    topSpeed = Math.max(topSpeed, driver.horizontalSpeed);
    if (!arrivedAt && !current.itemEffects.active.has("pull")) {
      arrivedAt = driver.nowMs;
      arrivalGap = Math.hypot(target.x - current.body.position.x, target.z - current.body.position.z);
    }
    if (current.itemEffects.active.has("pull")) {
      const velocity = current.body.linearVelocity;
      const toTarget = { x: target.x - current.body.position.x, z: target.z - current.body.position.z };
      const cosine = (velocity.x * toTarget.x + velocity.z * toTarget.z) /
        (Math.hypot(velocity.x, velocity.z) * Math.hypot(toTarget.x, toTarget.z));
      assert.ok(cosine > 0.98);
    }
  });
  assert.ok(arrivedAt > 0, "caught up within the magnet time");
  assert.ok(topSpeed > 45 && topSpeed <= ITEM_EFFECT_TUNING.pullMaximumSpeed + 1, `${topSpeed}`);
  assert.deepEqual(ends(effects.consumeEvents()), [["pull", "arrived"]]);
  assert.ok(arrivalGap <= ITEM_EFFECT_TUNING.pullArrivalDistance + 1, `${arrivalGap}`);
  assert.notEqual(vehicle.runtime.physicsState, 16);

  const lost = cruising(1000).vehicle.itemEffects;
  let available = true;
  lost.apply("pull", 3000, { target: () => available ? { x: 0, y: 0, z: 1e4 } : undefined });
  available = false;
  lost.beginSubstep(f32(0.002));
  assert.deepEqual(ends(lost.consumeEvents()), [["pull", "target-lost"]]);
  assert.throws(() => lost.apply("pull", 3000), /缺少目标/);

  const expiring = cruising(1000);
  expiring.vehicle.itemEffects.apply("pull", 3000, { target: () => ({ x: 0, y: 0, z: 1e6 }) });
  expiring.run(3000);
  assert.deepEqual(ends(expiring.vehicle.itemEffects.consumeEvents()), [["pull", "expired"]]);
});

test("held hits never stack: launch replaces a barricade, a bubble keeps the ground anchor", () => {
  const driver = cruising();
  const effects = driver.vehicle.itemEffects;
  const anchor = { ...driver.vehicle.body.position };
  effects.apply("barrier", 500);
  driver.run(100);
  assert.equal(effects.apply("launch", 1500), true);
  driver.run(400);
  assert.equal(effects.apply("trap", 2000), true);
  driver.run(1000);
  assert.equal(driver.vehicle.body.position.x, anchor.x);
  assert.equal(driver.vehicle.body.position.z, anchor.z);
  assert.ok(driver.vehicle.body.position.y - anchor.y < 1, "floats from the ground, not mid-air");
  assert.ok(driver.vehicle.body.up.y > 0.999);
  const events: ItemEffectEvent[] = effects.consumeEvents();
  assert.deepEqual(ends(events), [["barrier", "replaced"], ["launch", "replaced"]]);
  assert.deepEqual(events.filter(event => event.phase === "start").map(event => event.kind),
    ["barrier", "launch", "trap"]);
});

test("clear, resets and the bypass path end every effect", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  effects.apply("reverse", 3000);
  effects.apply("slow", 3000);
  effects.apply("shrink", 3000);
  effects.apply("trap", 2000);
  driver.run(500);
  effects.clear();
  assert.equal(effects.active.size, 0);
  assert.equal(effects.immune, false, "no blue shield after a forced clear");
  assert.equal(effects.steeringInverted, false);
  assert.equal(vehicle.runtime.driveScale, 1);
  assert.equal(vehicle.runtime.dragScale, 1);
  assert.deepEqual(vehicle.runtime.eventScaleTarget, { x: 1, y: 1, z: 1 });
  assert.deepEqual(vehicle.body.linearVelocity, { x: 0, y: 0, z: 0 });
  assert.equal(new Set(ends(effects.consumeEvents()).map(([, reason]) => reason)).has("cleared"), true);

  effects.apply("launch", 1500);
  driver.run(100);
  assert.equal(vehicle.beginResetInitiation(true), true);
  assert.equal(effects.active.size, 0, "a checkpoint reset clears");
  assert.equal(effects.apply("spin", 2000), false, "nothing applies during the reset bypass");
  vehicle.setFullPhysicsBypass(false);

  effects.apply("reverse", 3000);
  vehicle.setFullPhysicsBypass(true);
  driver.run(1000, neutralInput);
  assert.equal(effects.remainingMs("reverse"), 2000, "timers run on the bypass path");
  vehicle.setFullPhysicsBypass(false);
  vehicle.reset(0, 0.3, 0, 0);
  assert.equal(effects.active.size, 0, "a full reset forgets effects");
  assert.equal(vehicle.runtime.driveScale, 1);
});

test("apply validates kinds and durations", () => {
  const effects = cruising(100).vehicle.itemEffects;
  assert.throws(() => effects.apply("freeze" as never, 1000), /未知的道具效果/);
  assert.equal(effects.apply("spin", 0), false);
  assert.equal(effects.apply("spin", Number.NaN), false);
  assert.equal(effects.apply("spin", 2000, { elapsedMs: 2000 }), false, "already over");
  assert.equal(effects.apply("spin", 2000, { elapsedMs: 500 }), true);
  assert.equal(effects.remainingMs("spin"), 1500);
});

/** Base-0 state lives of an original `item.rho/<folder>/item.bml` (first block wins). */
function itemLives(folder: string): Map<string, number> {
  const xml = readFileSync(new URL(
    `../../../recovered/data-full/item.rho/${folder}/item.bml.xml`, import.meta.url), "utf8");
  const lives = new Map<string, number>();
  for (const match of xml.matchAll(/<state name="([^"]+)" life="(\d+)"/g))
    if (!lives.has(match[1]!)) lives.set(match[1]!, Number(match[2]));
  return lives;
}

test("original item.bml lives drive every victim timeline to the millisecond", () => {
  const cases: Array<[string, ItemEffectKind, string]> = [
    ["banana", "spin", "Affect"],
    ["waterBomb", "trap", "Affect"],
    ["waterFly", "trap", "Affect"],
    ["timeBomb", "trap", "Affect"],
    ["waterMine", "trap", "Affect"],
    ["rocket", "launch", "Affect"],
    ["mine", "launch", "Affect"],
    ["devil", "reverse", "Affect"],
    ["ufo", "slow", "Affect"],
    ["thunderbolt", "shrink", "Affect"],
    ["barricade", "barrier", "StateAffect"],
    ["magnet", "pull", "Use"],
  ];
  const waterBomb = itemLives("waterBomb");
  assert.equal(waterBomb.get("EscapeAffect"), ITEM_EFFECT_TUNING.escapeImmunityMs);
  assert.ok(ITEM_EFFECT_TUNING.launchAirMs < itemLives("rocket").get("Affect")!,
    "a missile lands before its Affect ends");
  for (const [folder, kind, state] of cases) {
    const lives = itemLives(folder);
    const life = lives.get(state)!;
    assert.ok(life > 0, `${folder}.${state}`);
    const driver = cruising(1000);
    const effects = driver.vehicle.itemEffects;
    const escape = lives.get("EscapeAffect");
    assert.equal(effects.apply(kind, life, {
      escapeImmunityMs: escape, target: () => ({ x: 0, y: 0, z: 1e6 }),
    }), true, folder);
    driver.run(life - 8, throttleInput, 8);
    assert.ok(effects.active.has(kind), `${folder} still running at ${life - 8} ms`);
    driver.run(8, throttleInput, 8);
    assert.equal(effects.active.has(kind), false, `${folder} ends at ${life} ms`);
    assert.deepEqual(ends(effects.consumeEvents()), [[kind, "expired"]], folder);
    if (kind === "trap") assert.equal(effects.escapeShieldRemainingMs, escape, folder);
  }
});

// ---- phase 3: reverse variants, knockback, hold, quick trap, escape boost ----

function cruisingKart(kartId: number, milliseconds = 3000): TestDriver {
  const driver = createItemDriver(kartId);
  driver.run(milliseconds);
  driver.vehicle.itemEffects.consumeEvents();
  return driver;
}

test("reverse modes: devil swaps left/right, newDevil forward/back, drrMine every key", () => {
  // Original lives: devil Affect 3000, newDevil and drmad (drrMine) Affect 5000.
  assert.equal(itemLives("devil").get("Affect"), 3000);
  assert.equal(itemLives("newDevil").get("Affect"), 5000);
  assert.equal(itemLives("drmad").get("Affect"), 5000);
  const driver = cruising();
  const effects = driver.vehicle.itemEffects;
  assert.equal(effects.reverseMode, undefined);
  assert.equal(effects.apply("reverse", 3000), true, "the default mode is the devil's");
  assert.equal(effects.steeringInverted, true);
  assert.equal(effects.forwardBackSwapped, false);
  assert.equal(effects.reverseMode, "steering");

  const back = cruising().vehicle.itemEffects;
  assert.equal(back.apply("reverse", 5000, { mode: "forwardBack", source: 38 }), true);
  assert.equal(back.steeringInverted, false);
  assert.equal(back.forwardBackSwapped, true);
  assert.equal(back.reverseMode, "forwardBack");

  const all = cruising().vehicle.itemEffects;
  assert.equal(all.apply("reverse", 5000, { mode: "all", source: 23 }), true);
  assert.equal(all.reverseMode, "all");
  assert.throws(() => all.apply("reverse", 1000, { mode: "sideways" as never }), /反向方式/);

  // A devil during a newDevil: each keeps its own end; one reverse effect throughout.
  const both = cruising();
  const mixed = both.vehicle.itemEffects;
  mixed.apply("reverse", 5000, { mode: "forwardBack", source: 38 });
  both.run(1000);
  mixed.apply("reverse", 3000, { mode: "steering", source: 2 });
  assert.equal(mixed.reverseMode, "all");
  assert.equal(mixed.remainingMs("reverse"), 4000);
  both.run(3008);
  assert.equal(mixed.reverseMode, "forwardBack", "the devil ended at 4000 ms");
  both.run(1000);
  assert.equal(mixed.reverseMode, undefined);
  const events: ItemEffectEvent[] = mixed.consumeEvents();
  assert.deepEqual(events.map(event => [event.kind, event.phase]),
    [["reverse", "start"], ["reverse", "end"]], "one start and one end for the whole reverse");
});

test("an EMP-style end removes only its own source: no UFO, no effect", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  // Tiger rocket (99) slows and blinds for its Affect; no UFO is running.
  assert.equal(itemLives("tigerRocket").get("Affect"), 4000);
  effects.apply("slow", 4000, { source: 99 });
  assert.equal(effects.hasSource("slow", 3), false);
  assert.equal(effects.end("slow", 3), false, "EMP finds no UFO slow: nothing happens");
  assert.equal(effects.active.has("slow"), true);
  assert.equal(vehicle.runtime.driveScale, f32(0.4));

  // A UFO (3) lands on top; EMP lifts the UFO and the tiger slow stays.
  driver.run(1000);
  effects.apply("slow", 3000, { source: 3 });
  assert.equal(effects.hasSource("slow", 3), true);
  assert.equal(effects.remainingMs("slow"), 3000);
  assert.equal(effects.end("slow", 3), true);
  assert.equal(effects.hasSource("slow", 3), false);
  assert.equal(effects.active.has("slow"), true);
  assert.equal(effects.remainingMs("slow"), 3000, "back to the tiger rocket's own end");
  assert.equal(vehicle.runtime.driveScale, f32(0.4));
  assert.deepEqual(ends(effects.consumeEvents()), []);

  // The last source ends the effect; without a source every cause ends.
  assert.equal(effects.end("slow", 99), true);
  assert.equal(effects.active.has("slow"), false);
  assert.equal(vehicle.runtime.driveScale, 1);
  assert.deepEqual(ends(effects.consumeEvents()), [["slow", "cancelled"]]);
  effects.apply("slow", 3000, { source: 3 });
  effects.apply("slow", 3000, { source: 99 });
  assert.equal(effects.end("slow"), true);
  assert.equal(effects.active.size, 0);
});

test("spring trap knockback: pushed back along the reverse heading for 500 ms without control", () => {
  const lives = itemLives("forceZone");
  const life = lives.get("Affect")!;
  assert.equal(life, 500);
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const forward = { ...vehicle.body.forward };
  const entrySpeed = driver.horizontalSpeed;
  const start = horizontal(vehicle);
  vehicle.runtime.physicsState = 3;
  assert.equal(effects.apply("knockback", life), true);
  assert.equal(vehicle.runtime.physicsState, 0, "the hit ends a boost");
  assert.equal(effects.suppressesDrive, true);
  assert.equal(effects.suppressesAutomaticReset, true);
  assert.equal(effects.canUseItem, true);
  assert.equal(effects.holdsBody, false, "collisions keep running");
  const velocity = vehicle.body.linearVelocity;
  const along = velocity.x * forward.x + velocity.z * forward.z;
  assert.ok(Math.abs(along + entrySpeed * ITEM_EFFECT_TUNING.knockbackRestitution) < 0.01 ||
    along <= -ITEM_EFFECT_TUNING.knockbackMinimumSpeed + 0.01, `${along}`);
  let hit = 0;
  driver.run(life - 8, throttleInput, 8, current => {
    if (current.runtime.collisionMotionHit) hit = current.runtime.collisionMotionStrength;
    const back = current.body.linearVelocity.x * forward.x + current.body.linearVelocity.z * forward.z;
    assert.ok(back < 0, "still moving backward with forward held");
  });
  assert.equal(hit, ITEM_EFFECT_TUNING.knockbackImpactStrength);
  const end = horizontal(vehicle);
  const travelled = (end.x - start.x) * forward.x + (end.z - start.z) * forward.z;
  assert.ok(travelled < -2, `pushed back ${travelled} m`);
  assert.ok(vehicle.body.forward.z > 0.999, "the heading stays down the road");
  assert.ok(effects.active.has("knockback"));
  driver.run(8, throttleInput, 8);
  assert.deepEqual(ends(effects.consumeEvents()), [["knockback", "expired"]]);
  driver.run(1500);
  const forwardSpeed = vehicle.body.linearVelocity.x * forward.x + vehicle.body.linearVelocity.z * forward.z;
  assert.ok(forwardSpeed > 5, "drives on afterwards");

  // A fixed push speed; a kart standing still is pushed at the minimum.
  const still = createItemDriver(373);
  assert.equal(still.vehicle.itemEffects.apply("knockback", 500), true);
  assert.ok(Math.abs(still.vehicle.body.linearVelocity.z + ITEM_EFFECT_TUNING.knockbackMinimumSpeed) < 1e-3);
  const fixed = cruising().vehicle;
  fixed.itemEffects.apply("knockback", 500, { speed: 12 });
  assert.ok(Math.abs(fixed.body.linearVelocity.z + 12) < 1e-3);
  // Never while held; a spin replaces it.
  const held = cruising().vehicle.itemEffects;
  held.apply("barrier", 500);
  assert.equal(held.apply("knockback", 500), false);
  const spun = cruising().vehicle.itemEffects;
  spun.apply("knockback", 500);
  assert.equal(spun.apply("spin", 2000), true);
  assert.deepEqual(ends(spun.consumeEvents()), [["knockback", "replaced"]]);
});

test("hold (talisman, lockdown, abyss barricade): stopped in place, no items, QTE escape", () => {
  assert.equal(itemLives("talisman").get("Affect"), 4000);
  assert.equal(itemLives("talisman").get("EscapeAffect"), 500);
  assert.equal(itemLives("lockdownRocket").get("AffectMain"), 2000);
  assert.equal(itemLives("abyssBarricade").get("StateAffect"), 2000);
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const anchor = horizontal(vehicle);
  assert.equal(effects.directionPress("left"), false, "no hold, no QTE");
  assert.equal(effects.apply("hold", 4000), true);
  assert.equal(effects.holdsBody, true);
  assert.equal(effects.canUseItem, false);
  assert.equal(effects.immune, false, "a held kart can still be hit");
  assert.equal(vehicle.startItemBooster(), false);
  driver.run(1000);
  assert.deepEqual(horizontal(vehicle), anchor);
  assert.equal(driver.horizontalSpeed, 0);
  assert.equal(effects.escapePress(), false, "mashing only breaks bubbles");
  for (const direction of ["up", "left", "down", "right"] as const)
    assert.equal(effects.directionPress(direction), true);
  assert.equal(effects.directionPress("sideways" as never), false);
  const presses: ItemDirectionPress[] = effects.consumeDirectionPresses();
  assert.deepEqual(presses.map(press => press.direction),
    ["up", "left", "down", "right"]);
  assert.deepEqual(effects.consumeDirectionPresses(), []);
  // The QTE succeeded: the original EscapeAffect (500 ms) plays, then the kart is free.
  assert.equal(effects.escapeHold(500), true);
  assert.equal(effects.remainingMs("hold"), 500);
  driver.run(496);
  assert.ok(effects.active.has("hold"));
  driver.run(8);
  assert.deepEqual(ends(effects.consumeEvents()), [["hold", "escaped"]]);
  assert.equal(effects.immune, false, "no protection by default");
  assert.equal(effects.escapeHold(), false);
  driver.run(1000);
  assert.ok(driver.horizontalSpeed > 2);

  // Immediate escape, the expiry path and an immunity window after it.
  const quickEscape = cruising().vehicle.itemEffects;
  quickEscape.apply("hold", 2000);
  quickEscape.directionPress("up");
  assert.equal(quickEscape.escapeHold(), true);
  assert.equal(quickEscape.active.has("hold"), false);
  assert.deepEqual(quickEscape.consumeDirectionPresses(), [], "presses end with the hold");
  const expiring = cruising();
  expiring.vehicle.itemEffects.apply("hold", 2000, { escapeImmunityMs: 500 });
  expiring.run(2000);
  assert.deepEqual(ends(expiring.vehicle.itemEffects.consumeEvents()), [["hold", "expired"]]);
  assert.equal(expiring.vehicle.itemEffects.escapeShieldRemainingMs, 500);
});

test("holds stack with the later end, never lift a launched kart and give way to a bubble", () => {
  const driver = cruising();
  const effects = driver.vehicle.itemEffects;
  effects.apply("hold", 2000);
  driver.run(1000);
  assert.equal(effects.apply("hold", 4000), true, "a talisman during a lockdown field");
  assert.equal(effects.remainingMs("hold"), 4000);
  assert.equal(effects.apply("hold", 500), true);
  assert.equal(effects.remainingMs("hold"), 4000, "a shorter hold never cuts it");
  assert.equal(effects.apply("barrier", 500), false);
  assert.equal(effects.apply("trap", 2000), true, "a bubble replaces the hold");
  assert.deepEqual(ends(effects.consumeEvents()), [["hold", "replaced"]]);

  const launched = cruising().vehicle.itemEffects;
  launched.apply("launch", 1500);
  assert.equal(launched.apply("hold", 2000), false);
  const replaced = cruising().vehicle.itemEffects;
  replaced.apply("hold", 2000);
  assert.equal(replaced.apply("launch", 1500), true, "a missile still flips a held kart");
});

test("waterAngel quick escape: the bubble ends 500 ms after it formed", () => {
  const life = itemLives("waterBomb").get("Affect")!;
  const driver = cruising();
  const effects = driver.vehicle.itemEffects;
  assert.equal(effects.apply("trap", life, { quick: true, escapeImmunityMs: 2000 }), true);
  assert.equal(effects.remainingMs("trap"), ITEM_EFFECT_TUNING.quickTrapMs);
  driver.run(496);
  assert.ok(effects.active.has("trap"));
  driver.run(8);
  assert.deepEqual(ends(effects.consumeEvents()), [["trap", "expired"]]);
  assert.equal(effects.immune, true, "the blue shield still follows");
  assert.equal(cruising().vehicle.itemEffects.apply("trap", 2000, { quick: true, elapsedMs: 500 }),
    false, "a quick bubble already over");
});

test("escape boost: a forward press within 1000 ms of a bubble gives the drift instant boost", () => {
  // 373 正义 HT+ has UseExtendedAfterBooster; driftBoostTick 0 means the 0.5 s default.
  const driver = cruisingKart(373);
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  assert.equal(vehicle.tuning.useExtendedAfterBooster, true);
  effects.apply("trap", 2000);
  vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(vehicle.runtime.physicsState, 0, "not while trapped");
  driver.run(2000);
  assert.equal(effects.active.has("trap"), false);
  assert.equal(effects.escapeBoostReady, true);
  assert.ok(effects.escapeBoostRemainingMs > 980 && effects.escapeBoostRemainingMs <= 1000);
  driver.run(500);
  vehicle.handleDrivingCommand({ kind: "forward-up" }, neutralInput);
  vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(vehicle.runtime.physicsState, 2);
  assert.equal(vehicle.runtime.driftLifecycleB44, f32(0.5));
  assert.equal(effects.escapeBoostReady, false, "one boost per escape");
  driver.run(496);
  assert.equal(vehicle.runtime.physicsState, 2);
  driver.run(16);
  assert.equal(vehicle.runtime.physicsState, 0);

  // Too late, no ability, not a water bubble, or a forced clear: nothing.
  const late = cruisingKart(373);
  late.vehicle.itemEffects.apply("trap", 2000);
  late.run(3008);
  late.vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(late.vehicle.runtime.physicsState, 0);
  const plain = cruisingKart(1);
  assert.equal(plain.vehicle.tuning.useExtendedAfterBooster, false);
  assert.equal(plain.vehicle.tuning.useExtendedAfterBoosterMore, false);
  plain.vehicle.itemEffects.apply("trap", 1000);
  plain.run(1100);
  plain.vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(plain.vehicle.runtime.physicsState, 0);
  const dry = cruisingKart(373);
  dry.vehicle.itemEffects.apply("trap", 1000, { afterBoost: false });
  dry.run(1100);
  assert.equal(dry.vehicle.itemEffects.escapeBoostReady, false);
  const cleared = cruisingKart(373);
  cleared.vehicle.itemEffects.apply("trap", 1000);
  cleared.run(500);
  cleared.vehicle.itemEffects.clear();
  assert.equal(cleared.vehicle.itemEffects.escapeBoostReady, false);
  const rehit = cruisingKart(373);
  rehit.vehicle.itemEffects.apply("trap", 1000, { escapeImmunityMs: 0 });
  rehit.run(1100);
  assert.equal(rehit.vehicle.itemEffects.escapeBoostReady, true);
  rehit.vehicle.itemEffects.apply("spin", 2000);
  assert.equal(rehit.vehicle.itemEffects.escapeBoostReady, false, "a new hit closes the window");
});

test("escape boost on a 迅 item kart: driftBoostTick and driftBoostMulAccelFactor", () => {
  // 1513 概念车I 迅: useExtendedAfterBoosterMore, driftBoostTick 500, driftBoostMulAccelFactor 1.31.
  const boosted = cruisingKart(1513, 1500);
  const reference = cruisingKart(1513, 1500);
  assert.equal(boosted.vehicle.tuning.useExtendedAfterBoosterMore, true);
  assert.equal(boosted.vehicle.tuning.driftBoostTick, 500);
  for (const driver of [boosted, reference]) {
    driver.vehicle.itemEffects.apply("trap", 1000);
    driver.run(1100);
  }
  boosted.vehicle.handleDrivingCommand({ kind: "forward-up" }, neutralInput);
  boosted.vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(boosted.vehicle.runtime.physicsState, 2);
  assert.equal(boosted.vehicle.runtime.driftLifecycleB44, f32(0.5));
  boosted.run(480);
  reference.run(480);
  assert.ok(boosted.horizontalSpeed > reference.horizontalSpeed + 0.5,
    `${boosted.horizontalSpeed} vs ${reference.horizontalSpeed}`);
});
