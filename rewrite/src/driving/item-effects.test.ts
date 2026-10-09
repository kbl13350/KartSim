import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_EFFECT_TUNING, type ItemEffectEvent } from "./item-effects";
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

test("banana spin: two yaw turns without drive or grip, then driving resumes", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const entrySpeed = driver.horizontalSpeed;
  assert.ok(entrySpeed > 40);
  vehicle.runtime.physicsState = 3; // a running booster is cancelled by the hit
  vehicle.runtime.stateRemainingMs = 2000;
  assert.equal(effects.apply("spin", 2000), true);
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

test("water bubble: the kart stops and floats, escape mashing shortens it, then a blue shield", () => {
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
  assert.ok(vehicle.body.position.y > 0.6 && vehicle.body.position.y < 1, `${vehicle.body.position.y}`);
  assert.equal(vehicle.state.y, vehicle.body.position.y, "the published pose floats too");
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

test("missile launch: a visible roll in the air, back on the anchor, locked for 1500 ms", () => {
  const driver = cruising();
  const vehicle = driver.vehicle;
  const effects = vehicle.itemEffects;
  const anchor = { ...vehicle.body.position };
  const forward = { ...vehicle.body.forward };
  assert.equal(effects.apply("launch", 1500), true);
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
  assert.ok(Math.abs(peak - ITEM_EFFECT_TUNING.launchHeight) < 0.01, `${peak}`);
  driver.run(16);
  assert.ok(vehicle.body.up.y < -0.99, "upside down at the top of the arc");
  const wrench = { force: { x: 0, y: 0, z: 0 }, torque: { x: 0, y: 0, z: 0 } };
  vehicle.copyNetworkWrench(wrench);
  const arcAcceleration = -8 * ITEM_EFFECT_TUNING.launchHeight /
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
