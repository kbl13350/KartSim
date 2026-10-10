import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bundledVehicleSpecCatalog } from "../physics/bundled";
import { itemRaceVehicleSpec } from "../physics/item-race-tuning";
import { itemBoosterDurationMs, itemSlotCapacityFor } from "./item-mode";
import {
  admittedItemMode, createItemDriver, createSpeedDriver, testTuning, throttleInput,
  type TestDriver,
} from "./item-test-fixtures";

const f32 = Math.fround;
const driftInput = {
  ...throttleInput, steer: 1, rawSteer: 1, rawDriftHeld: true, derivedDriftHeld: true,
};

function drift(driver: TestDriver): void {
  const vehicle = driver.vehicle;
  vehicle.handleDrivingCommand({ kind: "drift-start", direction: 1 }, driftInput);
  driver.run(1500, driftInput);
  vehicle.handleDrivingCommand({ kind: "drift-stop", active: false }, throttleInput);
  // The drift window commits its charge once the drift has decayed.
  driver.run(1000);
}

function trajectory(driver: TestDriver, milliseconds: number): number[] {
  const samples: number[] = [];
  driver.run(milliseconds, throttleInput, 16, vehicle =>
    samples.push(vehicle.body.position.z, vehicle.body.linearVelocity.z));
  return samples;
}

test("item karts keep item indices in slots sized by ItemSlotCapacity", () => {
  const catalog = bundledVehicleSpecCatalog();
  assert.equal(catalog.lookup(373, 7).spec.itemSlotCapacity, 3);
  assert.equal(catalog.lookup(1, 7).spec.itemSlotCapacity, 2);
  assert.equal(itemSlotCapacityFor({ itemSlotCapacity: 3 }), 3);
  assert.equal(itemSlotCapacityFor({ itemSlotCapacity: 2 }), 2);
  assert.equal(itemSlotCapacityFor({}), 2);

  const threeSlots = createItemDriver(373).vehicle;
  assert.equal(threeSlots.itemMode, true);
  assert.ok(threeSlots.itemEffects);
  assert.equal(threeSlots.itemSlotCapacity, 3);
  assert.deepEqual(threeSlots.itemSlots(), [-1, -1, -1]);
  threeSlots.setItemSlots([7, 6]);
  assert.deepEqual(threeSlots.itemSlots(), [7, 6, -1]);
  assert.equal(threeSlots.state.nitro, 1);
  // The HUD and the time-attack slot getter read the same live store.
  assert.equal(threeSlots.timeAttackSpeedSlots(), threeSlots.itemSlots());
  threeSlots.setItemSlots([]);
  assert.deepEqual(threeSlots.itemSlots(), [-1, -1, -1]);
  assert.throws(() => threeSlots.setItemSlots([1, 2, 3, 4]), /最多 3 个/);
  assert.throws(() => threeSlots.setItemSlots([1.5]), /道具槽/);
  assert.throws(() => threeSlots.setItemSlots([-2]), /道具槽/);

  const twoSlots = createItemDriver(1).vehicle;
  assert.equal(twoSlots.itemSlotCapacity, 2);
  twoSlots.setItemSlots([111, 113]);
  // A checkpoint-free full reset rebuilds the runtime with the item capacity.
  twoSlots.reset(0, 0.3, 0, 0);
  assert.deepEqual(twoSlots.itemSlots(), [-1, -1]);

  const speed = createSpeedDriver(373).vehicle;
  assert.equal(speed.itemMode, false);
  assert.equal(speed.itemEffects, undefined);
  assert.equal(speed.itemSlotCapacity, 0);
  assert.deepEqual(speed.itemSlots(), []);
  assert.equal(speed.timeAttackSpeedSlots().length, testTuning(373).speedSlotCapacity);
  assert.throws(() => speed.setItemSlots([6]), /只有道具赛/);
  assert.equal(speed.startItemBooster(), false);
});

test("the constructor admits the frozen item mode once vI knows game types 2 and 4", () => {
  const mode = admittedItemMode();
  if (!mode) return; // vI is extended by the lobby area; the fixture installs item mode meanwhile.
  assert.equal(mode.kind, "item");
  const vehicle = createItemDriver(373).vehicle;
  assert.deepEqual(vehicle.speedRaceMode, mode);
  assert.equal(vehicle.itemMode, true);
});

test("Ctrl and Alt never spend or reorder item slots as nitro", () => {
  const item = createItemDriver(373);
  item.run(500);
  item.vehicle.setItemSlots([6, 7, 6]);
  item.vehicle.handleDrivingCommand({ kind: "use-item-or-booster" }, throttleInput);
  item.vehicle.handleDrivingCommand({ kind: "reorder-items" }, throttleInput);
  item.vehicle.queueNitroSeamless();
  item.run(100);
  assert.deepEqual(item.vehicle.itemSlots(), [6, 7, 6]);
  assert.equal(item.vehicle.runtime.physicsState, 0);
  assert.equal(item.vehicle.startNormalBooster(throttleInput), false);

  // The same commands still spend nitro in a speed race.
  const speed = createSpeedDriver(373);
  speed.run(500);
  speed.vehicle.runtime.speedSlots[0] = 6;
  speed.vehicle.handleDrivingCommand({ kind: "use-item-or-booster" }, throttleInput);
  assert.equal(speed.vehicle.runtime.physicsState, 3);
  assert.deepEqual(speed.vehicle.timeAttackSpeedSlots(), [-1, -1]);
});

test("drifting never charges a booster in item races; the drift-exit boost stays", () => {
  const speed = createSpeedDriver(373);
  speed.run(3000);
  speed.vehicle.runtime.committedGauge = f32(speed.vehicle.tuning.driftMaxGauge - 10);
  drift(speed);
  // The race runtime converts a full gauge after the frame; speed races gain a nitro.
  assert.equal(speed.vehicle.updateModeInventory(), true);
  assert.deepEqual(speed.vehicle.timeAttackSpeedSlots(), [6, -1]);

  const item = createItemDriver(373);
  item.run(3000);
  item.vehicle.runtime.committedGauge = f32(item.vehicle.tuning.driftMaxGauge - 10);
  let pending = 0;
  item.vehicle.handleDrivingCommand({ kind: "drift-start", direction: 1 }, driftInput);
  item.run(1500, driftInput, 16, vehicle => {
    pending = Math.max(pending, vehicle.runtime.pendingGauge);
  });
  assert.equal(item.vehicle.state.drifting, true);
  assert.equal(pending, 0);
  item.vehicle.handleDrivingCommand({ kind: "drift-stop", active: false }, throttleInput);
  // Forward pressed in the drift-exit window still gives the state-2 instant boost.
  for (let frame = 0; frame < 60 && !(item.vehicle.runtime.driftLifecycleB50 > 0); frame += 1)
    item.run(16);
  assert.ok(item.vehicle.runtime.driftLifecycleB50 > 0);
  item.vehicle.handleDrivingCommand({ kind: "forward-up" }, throttleInput);
  item.vehicle.handleDrivingCommand({ kind: "forward-down" }, throttleInput);
  assert.equal(item.vehicle.runtime.physicsState, 2);
  item.run(500);
  assert.equal(item.vehicle.updateModeInventory(), false);
  assert.deepEqual(item.vehicle.itemSlots(), [-1, -1, -1]);
  assert.equal(item.vehicle.runtime.committedGauge, f32(item.vehicle.tuning.driftMaxGauge - 10));
});

test("the item start booster uses StartBoosterTimeItem and the item start acceleration", () => {
  const tuning = testTuning(373);
  assert.equal(tuning.startBoosterTimeItem, 1300);
  assert.equal(tuning.startBoosterTimeSpeed, 1400);
  assert.notEqual(tuning.startForwardAccelItem, tuning.startForwardAccelSpeed);

  const item = createItemDriver(373);
  item.vehicle.startRaceBooster();
  assert.equal(item.vehicle.runtime.physicsState, 1);
  assert.equal(item.vehicle.runtime.stateRemainingMs, 1300);
  // A speed kart given the item values follows exactly the same path.
  const reference = createSpeedDriver(373, {
    startBoosterTimeSpeed: tuning.startBoosterTimeItem,
    startForwardAccelSpeed: tuning.startForwardAccelItem,
    boostAccelFactor: tuning.boostAccelFactorOnlyItem,
  });
  reference.vehicle.startRaceBooster();
  assert.deepEqual(trajectory(item, 2000), trajectory(reference, 2000));

  const speed = createSpeedDriver(373);
  speed.vehicle.startRaceBooster();
  assert.equal(speed.vehicle.runtime.stateRemainingMs, 1400);
});

test("a booster item runs physics state 3 for itemBoosterTime with BoostAccelFactorOnlyItem", () => {
  const tuning = testTuning(373);
  const item = createItemDriver(373);
  item.run(1000);
  assert.equal(item.vehicle.startItemBooster(), true);
  assert.equal(item.vehicle.runtime.physicsState, 3);
  assert.equal(item.vehicle.runtime.stateRemainingMs, tuning.itemBoosterTime);
  assert.equal(item.vehicle.state.boostTime, tuning.itemBoosterTime * 0.001);
  assert.equal(item.vehicle.audioState(), 3);

  const reference = createSpeedDriver(373, {
    normalBoosterTime: tuning.itemBoosterTime,
    boostAccelFactor: tuning.boostAccelFactorOnlyItem,
  });
  reference.run(1000);
  reference.vehicle.runtime.speedSlots[0] = 6;
  assert.equal(reference.vehicle.startNormalBooster(throttleInput), true);
  assert.deepEqual(trajectory(item, 3500), trajectory(reference, 3500));
  assert.equal(item.vehicle.runtime.physicsState, 0, "the boost expired");

  // Booster factor aliasing: a kart without BoostAccelFactorOnlyItem keeps the speed factor.
  const fallback = createItemDriver(373, { boostAccelFactorOnlyItem: undefined });
  const fallbackReference = createSpeedDriver(373, { normalBoosterTime: tuning.itemBoosterTime });
  fallback.run(1000);
  fallbackReference.run(1000);
  fallback.vehicle.startItemBooster();
  fallbackReference.vehicle.runtime.speedSlots[0] = 6;
  fallbackReference.vehicle.startNormalBooster(throttleInput);
  assert.deepEqual(trajectory(fallback, 1000), trajectory(fallbackReference, 1000));
});

test("a booster item never chains into the dual booster, even on a dual-booster engine", () => {
  const tuning = testTuning(373, { dualBoosterEnabled: true });
  assert.notEqual(tuning.itemBoosterTime, tuning.normalBoosterTime);
  const states = (driver: TestDriver) => {
    const seen: number[] = [];
    driver.run(3500, throttleInput, 16, vehicle => {
      if (seen.at(-1) !== vehicle.runtime.physicsState) seen.push(vehicle.runtime.physicsState);
    });
    return seen;
  };
  const item = createItemDriver(373, { dualBoosterEnabled: true });
  item.run(1500);
  assert.equal(item.vehicle.startItemBooster(), true);
  assert.deepEqual(states(item), [3, 0], "no automatic state 10 inside the item booster");
  assert.equal(item.vehicle.runtime.dualReadyRemainingMs, 0);

  // Speed races keep the released automatic dual booster.
  const speed = createSpeedDriver(373, { dualBoosterEnabled: true });
  speed.run(1500);
  speed.vehicle.runtime.speedSlots[0] = 6;
  assert.equal(speed.vehicle.startNormalBooster(throttleInput), true);
  assert.ok(states(speed).includes(10));
});

test("a booster item is refused while the kart is locked, held or reset", () => {
  const item = createItemDriver(373);
  item.vehicle.setRaceMotionLocked(true);
  assert.equal(item.vehicle.startItemBooster(), false);
  item.vehicle.setRaceMotionLocked(false);
  item.run(500);
  item.vehicle.itemEffects.apply("trap", 2000);
  assert.equal(item.vehicle.startItemBooster(), false);
  item.run(2000);
  assert.equal(item.vehicle.startItemBooster(), true);
  item.vehicle.beginResetInitiation(false);
  assert.equal(item.vehicle.startItemBooster(), false);
});

test("a booster item ends a magnet pull", () => {
  const item = createItemDriver(373);
  item.run(1000);
  const target = { x: 0, y: 0, z: 500 };
  assert.equal(item.vehicle.itemEffects.apply("pull", 3000, { target: () => target }), true);
  assert.equal(item.vehicle.runtime.physicsState, 16);
  assert.equal(item.vehicle.startItemBooster(), true);
  assert.equal(item.vehicle.itemEffects.active.has("pull"), false);
  assert.equal(item.vehicle.runtime.physicsState, 3);
});

test("a booster item the server refused is cancelled", () => {
  const item = createItemDriver(373);
  item.run(1000);
  const before = item.vehicle.runtime.resultBoosterCount;
  assert.equal(item.vehicle.startItemBooster(), true);
  item.run(100);
  assert.equal(item.vehicle.cancelItemBooster(), true);
  assert.equal(item.vehicle.runtime.physicsState, 0);
  assert.equal(item.vehicle.runtime.stateRemainingMs, 0);
  assert.equal(item.vehicle.state.boostTime, 0);
  assert.equal(item.vehicle.runtime.resultBoosterCount, before, "the refused booster does not count");
  assert.equal(item.vehicle.cancelItemBooster(), false, "nothing left to cancel");

  // Only the item booster state: a magnet pull is left alone.
  const pulled = createItemDriver(373);
  pulled.run(1000);
  pulled.vehicle.itemEffects.apply("pull", 3000, { target: () => ({ x: 0, y: 0, z: 500 }) });
  assert.equal(pulled.vehicle.cancelItemBooster(), false);
  assert.equal(pulled.vehicle.runtime.physicsState, 16);
  assert.equal(createSpeedDriver(373).vehicle.cancelItemBooster(), false);
});

// ---- phase 3: booster kinds and the item-race kart overlays ----

/** The kart's own BodyParam attributes, as the race loader reads `param@cn.xml` (else `param.xml`). */
function kartParameterAttributes(folder: string): Record<string, string> {
  const base = new URL(`../../../recovered/data-full/DataPack2/kart_/${folder}/`, import.meta.url);
  let xml: string;
  try { xml = readFileSync(new URL("param@cn.xml", base), "utf8"); }
  catch { xml = readFileSync(new URL("param.xml", base), "utf8"); }
  const tag = /<BodyParam\b([\s\S]*?)\/?>/.exec(xml)![1]!;
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w.]+)\s*=\s*(?:'([^']*)'|"([^"]*)")/g))
    attributes[match[1]!] ??= match[2] ?? match[3]!;
  return attributes;
}

test("item boosts: the booster item, the special booster and the super shield run their own times", () => {
  const tuning = testTuning(373);
  assert.equal(itemBoosterDurationMs(tuning), 3000);
  assert.equal(itemBoosterDurationMs(tuning, "animal"), 4000);
  assert.equal(itemBoosterDurationMs(tuning, "super"), 3500);
  for (const [kind, expected] of [["item", 3000], ["animal", 4000], ["super", 3500]] as const) {
    const driver = createItemDriver(373);
    driver.run(1000);
    assert.equal(driver.vehicle.startItemBooster(kind), true, kind);
    assert.equal(driver.vehicle.runtime.physicsState, 3);
    assert.equal(driver.vehicle.runtime.stateRemainingMs, expected, kind);
    assert.equal(driver.vehicle.state.boostTime, expected * 0.001);
  }
  const siren = createItemDriver(373);
  siren.run(1000);
  assert.equal(siren.vehicle.startItemBooster("item", { durationMs: 3000 }), true);
  assert.equal(siren.vehicle.runtime.stateRemainingMs, 3000);
  assert.equal(siren.vehicle.startItemBooster("item", { durationMs: 0 }), false);
  assert.throws(() => siren.vehicle.startItemBooster("rocket"), /未知的道具加速/);
  // The special booster lasts longer on the same item factor.
  const animal = createItemDriver(373);
  const item = createItemDriver(373);
  for (const driver of [animal, item]) driver.run(1000);
  animal.vehicle.startItemBooster("animal");
  item.vehicle.startItemBooster("item");
  assert.deepEqual(trajectory(animal, 2900), trajectory(item, 2900));
  animal.run(600);
  item.run(600);
  assert.equal(animal.vehicle.runtime.physicsState, 3);
  assert.equal(item.vehicle.runtime.physicsState, 0);
});

test("item races boost with the kart XML BoosterAccelFactorItem and the flying pet's 204 bonus", () => {
  const attributes = kartParameterAttributes("justice_Z7GT"); // kart 373 正义 HT+
  assert.equal(attributes.BoosterAccelFactorItem, "1.65");
  const spec = bundledVehicleSpecCatalog().lookup(373, 7).spec;
  assert.equal(spec.boostAccelFactorOnlyItem, 1.5, "the captured CN table");
  const mode = { kind: "item" };
  const overlaid = itemRaceVehicleSpec(spec, mode, { body: { attributes: Object.entries(attributes)
    .map(([name, value]) => ({ name, value })) } }, 5 /* 卡啾-玄武, tune group 204 */);
  assert.equal(overlaid.boostAccelFactorOnlyItem, f32(1.65));
  assert.equal(overlaid.itemBoosterTime, 3250);
  assert.equal(itemRaceVehicleSpec(spec, { kind: "speed" }, attributes, 5), spec,
    "speed races keep the release spec");

  const tuning = testTuning(373, {
    boostAccelFactorOnlyItem: overlaid.boostAccelFactorOnlyItem,
    itemBoosterTime: overlaid.itemBoosterTime,
  });
  const item = createItemDriver(373, tuning);
  item.run(1000);
  assert.equal(item.vehicle.startItemBooster(), true);
  assert.equal(item.vehicle.runtime.stateRemainingMs, 3250);
  const reference = createSpeedDriver(373, { normalBoosterTime: 3250, boostAccelFactor: f32(1.65) });
  reference.run(1000);
  reference.vehicle.runtime.speedSlots[0] = 6;
  assert.equal(reference.vehicle.startNormalBooster(throttleInput), true);
  const boosted = trajectory(item, 3000);
  assert.deepEqual(boosted, trajectory(reference, 3000));
  const table = createItemDriver(373);
  table.run(1000);
  table.vehicle.startItemBooster();
  const tableRun = trajectory(table, 3000);
  assert.ok(boosted.at(-2)! > tableRun.at(-2)! + 1, "1.65 pulls ahead of the table's 1.5");
});
