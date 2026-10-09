import assert from "node:assert/strict";
import test from "node:test";
import {
  applyLocalRaceWarpActions, checkLocalRaceAutomaticReset, requestLocalRaceReset, updateLocalRace,
  type LocalRaceDependencies,
} from "./local-race-runtime";
import { LocalRaceController } from "./local-race-controller";
import { createItemDriver } from "../driving/item-test-fixtures";

const states = { Ready: 0, Countdown: 1, Racing: 2, PostFinish: 3 };
const dependencies: LocalRaceDependencies = {
  states,
  beginResetState: state => ({ ...state, phase: 1, startMs: 1 }),
  advanceResetState: state => ({ state, actions: [] }),
  routeTagFamily: tag => tag.split(":")[0]!,
  isStartBoosterWindow: () => false,
};

/** A racing local owner around a real item-race AL. */
function itemRace() {
  const physics = createItemDriver(373).vehicle;
  const resets: boolean[] = [];
  const race: Record<string, any> = {
    disposed: false,
    physics,
    lifecycle: { state: states.Racing },
    resetState: { phase: 0 },
    lowSpeedResetStartedAtMs: 0,
    isRoadBlockRunner: false,
    warpNext: { blocksDriving: () => false },
    coordinator: { synchronizePositionAnchor() {} },
    pendingWarpActions: [],
    requestReset(playerRequested = true) {
      resets.push(playerRequested);
      return requestLocalRaceReset(race, dependencies, playerRequested);
    },
  };
  return { race, physics, resets };
}

test("an item hold suppresses the wall and low-speed automatic resets", () => {
  const { race, physics, resets } = itemRace();
  physics.itemEffects.apply("trap", 2000);
  physics.runtime.automaticResetRequest = true;
  // Holding forward at zero speed would start the 2 s stall timer.
  physics.lowSpeedAutomaticResetActive = () => true;
  race.lowSpeedResetStartedAtMs = 500;
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  assert.deepEqual(resets, []);
  assert.equal(race.lowSpeedResetStartedAtMs, 0);
  assert.equal(physics.runtime.automaticResetRequest, false, "the wall request is discarded");

  physics.itemEffects.clear();
  physics.runtime.automaticResetRequest = true;
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  assert.deepEqual(resets, [false], "without an effect the reset goes through");
  assert.equal(physics.runtime.fullPhysicsBypass, true);
});

test("a crush during a banana spin resets the kart once the spin ends", () => {
  const { race, physics, resets } = itemRace();
  physics.itemEffects.apply("spin", 2000);
  // A directional press obstacle flattens the spinning kart: a one-shot reset request.
  physics.activateDirectionalPress(2);
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  assert.deepEqual(resets, [], "no reset while the spin suppresses automatic resets");
  checkLocalRaceAutomaticReset(race, dependencies, 9016, 1 / 60);
  assert.deepEqual(resets, []);

  physics.itemEffects.end("spin");
  checkLocalRaceAutomaticReset(race, dependencies, 9032, 1 / 60);
  assert.deepEqual(resets, [false], "the crush reset was kept, not discarded");
  race.resetState = { phase: 0 };
  checkLocalRaceAutomaticReset(race, dependencies, 9048, 1 / 60);
  assert.deepEqual(resets, [false], "and it fires only once");
});

test("wall timer requests during an item hold are dropped, not deferred", () => {
  const { race, physics, resets } = itemRace();
  physics.itemEffects.apply("spin", 2000);
  physics.runtime.automaticResetRequest = true;
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  physics.itemEffects.end("spin");
  checkLocalRaceAutomaticReset(race, dependencies, 9016, 1 / 60);
  assert.deepEqual(resets, []);
});

test("a crush outside an item hold resets once, as in speed races", () => {
  const { race, physics, resets } = itemRace();
  physics.activateDirectionalPress(2);
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  assert.deepEqual(resets, [false]);
  race.resetState = { phase: 0 };
  checkLocalRaceAutomaticReset(race, dependencies, 9016, 1 / 60);
  assert.deepEqual(resets, [false]);
});

test("falling off the track still resets a kart that is held by an item", () => {
  const { race, physics, resets } = itemRace();
  physics.itemEffects.apply("barrier", 500);
  physics.body.position.y = -6;
  checkLocalRaceAutomaticReset(race, dependencies, 9000, 1 / 60);
  assert.deepEqual(resets, [false]);
  assert.equal(physics.itemEffects.active.size, 0, "the reset cleared the effect");
});

test("warp presentation and leaving the racing state clear item effects", () => {
  const warping = itemRace();
  warping.physics.itemEffects.apply("reverse", 3000);
  applyLocalRaceWarpActions(warping.race, [{ kind: "start-warp-presentation" }]);
  assert.equal(warping.physics.itemEffects.active.size, 0);

  const finishing = itemRace();
  finishing.physics.itemEffects.apply("slow", 3000);
  Object.assign(finishing.race, {
    scheduled: true, clockOriginMs: 0, routeClockMs: 0, pendingActions: [],
    lifecycle: { state: states.PostFinish, update: () => [] },
    lapTiming: { update() {} },
    track: {
      updateMovingRoads() {}, getRouteState: () => ({ lap: 3, distance: 0 }),
      data: { lapTarget: 3 },
    },
    coordinator: { run() {}, synchronizePositionAnchor() {} },
    checkAutomaticReset() {},
    advanceReset() {},
  });
  updateLocalRace(finishing.race, dependencies, 20_000, 1 / 60);
  assert.equal(finishing.physics.itemEffects.active.size, 0);
  assert.equal(finishing.physics.runtime.driveScale, 1);
});

test("disposing the local race owner clears item effects", () => {
  const { physics } = itemRace();
  physics.itemEffects.apply("shrink", 1500);
  const race = Object.assign(Object.create(LocalRaceController.prototype), {
    disposed: false, physics, warpNext: { reset() {} },
    coordinator: { dispose() {} },
    track: { group: { removeFromParent() {}, clear() {} } },
  }) as LocalRaceController;
  race.dispose();
  assert.equal(physics.itemEffects.active.size, 0);
  assert.equal(physics.runtime.raceMotionLocked, true);
});
