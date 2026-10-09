import assert from "node:assert/strict";
import test from "node:test";

import { createItemDriver, throttleInput, type TestDriver } from "../driving/item-test-fixtures";
import { ItemIdx } from "./item-catalog";
import { ItemRaceController } from "./item-race-controller";
import { threeToClient } from "./item-race-rules";
import {
  FakeItemConnection, FakePresenter, RIVAL, SELF, SERVER_OFFSET_MS, pose, settle, testItemCatalog,
} from "./item-race-test-support";

/** The controller on a real item-race AL, stepped like the race frame (controller, then physics). */
function realRace() {
  const driver = createItemDriver(373);
  const physics = driver.vehicle;
  const connection = new FakeItemConnection();
  const presenter = new FakePresenter();
  const poses = new Map<string, ReturnType<typeof pose>>();
  let now = 0;
  let slots = [-1, -1];
  connection.reply = ({ action, fields }) => {
    if (action === "cube") return { type: "item", action: "grant", cubeId: fields.cubeId,
      itemId: slots[0], slots };
    if (action === "use") {
      slots = [...slots.slice(1), -1];
      return { type: "item", action: "used", playerId: SELF, useId: 50, itemId: fields.itemId,
        targets: fields.targetId ? [fields.targetId] : [], startAt: now + SERVER_OFFSET_MS,
        etaMs: 0, slots };
    }
    return { type: "item", action };
  };
  const controller = new ItemRaceController({
    playerId: SELF,
    roster: [{ playerId: SELF, name: "我", team: null }, { playerId: RIVAL, name: "对手", team: null }],
    teamRace: false,
    catalog: testItemCatalog(),
    physics,
    connection,
    local: { racing: () => true, suspended: () => false },
    remotes: { pose: id => poses.get(id), racing: id => poses.has(id) },
    toLocalMs: serverMs => serverMs - SERVER_OFFSET_MS,
    now: () => now,
    presenter,
    log: (message, error) => { throw new Error(`${message}: ${String(error)}`); },
  });
  const step = (driver: TestDriver, milliseconds: number) => {
    for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
      now += 16;
      controller.update(now);
      driver.run(16, throttleInput, 16);
    }
  };
  return {
    driver, physics, connection, presenter, poses, controller,
    get now() { return now; },
    give: async (value: number[]) => { slots = value; controller.cube(1); await settle(); },
    step: (milliseconds: number) => step(driver, milliseconds),
  };
}

test("a used booster runs the item booster state on the real kart", async () => {
  const race = realRace();
  race.step(500);
  // Kart 373 has ItemSlotCapacity 3.
  assert.equal(race.physics.itemSlotCapacity, 3);
  await race.give([ItemIdx.booster, ItemIdx.rocket, -1]);
  assert.deepEqual([...race.physics.itemSlots()], [6, 7, -1]);
  race.controller.handleCommand({ kind: "use", phase: "press" }, race.now);
  assert.equal(race.physics.runtime.physicsState, 3);
  assert.deepEqual([...race.physics.itemSlots()], [7, -1, -1]);
  await settle();
  assert.deepEqual([...race.physics.itemSlots()], [7, -1, -1]);
});

test("a rocket launches the real kart for Affect.life and the presenter follows its effects", () => {
  const race = realRace();
  race.step(500);
  const start = race.now;
  race.connection.emit({ action: "used", playerId: RIVAL, useId: 3, itemId: ItemIdx.rocket,
    targets: [SELF], startAt: start + SERVER_OFFSET_MS, etaMs: 400 });
  race.step(416);
  assert.ok(race.physics.itemEffects.active.has("launch"));
  assert.ok(race.physics.itemEffects.cameraBasis, "the camera keeps the pre-hit basis");
  assert.equal(race.physics.itemEffects.canUseItem, false);
  const launch = race.presenter.of("kartEffect").find(call => call[1] === "launch")!;
  assert.equal(launch[0], SELF);
  assert.equal(launch[3], 1500);
  assert.ok(Math.abs((launch[2] as number) - (start + 400)) <= 32);
  assert.deepEqual(race.connection.of("hit"), [{ useId: 3, itemId: 7, result: "hit" }]);
  race.step(1600);
  assert.ok(!race.physics.itemEffects.active.has("launch"));
  assert.ok(race.presenter.of("endKartEffect").some(call => call[1] === "launch"));
});

test("a water bomb traps the real kart, then the blue shield shows and protects it", () => {
  const race = realRace();
  race.step(500);
  const position = race.physics.body.position;
  // Thrown a second ago: it bursts now where the kart is.
  race.connection.emit({ action: "used", playerId: RIVAL, useId: 4, itemId: ItemIdx.waterBomb,
    targets: [], startAt: race.now - 1000 + SERVER_OFFSET_MS, etaMs: 0,
    point: threeToClient({ x: position.x, y: position.y, z: position.z }) });
  race.step(32);
  assert.ok(race.physics.itemEffects.active.has("trap"));
  assert.equal(race.physics.itemEffects.immune, true);
  race.step(2100);
  assert.ok(!race.physics.itemEffects.active.has("trap"));
  assert.ok(race.physics.itemEffects.escapeShieldRemainingMs > 0);
  assert.ok(race.presenter.of("kartEffect").some(call => call[0] === SELF && call[1] === "escapeShield"));
  // Under the blue shield a rocket is blocked by escape.
  race.connection.emit({ action: "used", playerId: RIVAL, useId: 5, itemId: ItemIdx.rocket,
    targets: [SELF], startAt: race.now + SERVER_OFFSET_MS, etaMs: 300 });
  race.step(400);
  assert.deepEqual(race.connection.of("hit").at(-1), { useId: 5, itemId: 7, result: "blocked", by: "escape" });
});

test("a locked magnet pulls the real kart toward the opponent", async () => {
  const race = realRace();
  race.step(800);
  await race.give([ItemIdx.magnet, -1]);
  const body = race.physics.body;
  const ahead = { x: body.position.x + body.forward.x * 60, y: body.position.y,
    z: body.position.z + body.forward.z * 60 };
  race.poses.set(RIVAL, pose(ahead, body.forward));
  race.controller.handleCommand({ kind: "use", phase: "press" }, race.now);
  race.step(700);
  assert.equal(race.controller.aim?.phase, "ontarget");
  race.controller.handleCommand({ kind: "use", phase: "release" }, race.now);
  assert.deepEqual(race.connection.of("use"), [{ itemId: 5, targetId: RIVAL }]);
  assert.ok(race.physics.itemEffects.active.has("pull"));
  assert.equal(race.physics.runtime.physicsState, 16);
  const before = Math.hypot(ahead.x - body.position.x, ahead.z - body.position.z);
  race.step(300);
  const after = Math.hypot(ahead.x - body.position.x, ahead.z - body.position.z);
  assert.ok(after < before - 5, `${before} → ${after}`);
});
