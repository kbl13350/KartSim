/**
 * Phase-3 behaviour of the item race controller (ITEM_MODE.md Appendix C):
 * equipment passives, special items, EMP, changers, pushes and HUD feed.
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { ItemXmlNode } from "./item-bml";
import { ItemIdx } from "./item-catalog";
import { createAnimalBoosterTable, createItemPassiveTable } from "./item-passives";
import { ITEM_RACE_TUNING, threeToClient } from "./item-race-rules";
import { itemRoll } from "./item-roll";
import {
  MATE, OTHER, RIVAL, SELF, SERVER_OFFSET_MS, controllerFixture, pose, settle,
  type ControllerFixture, type SentItem,
} from "./item-race-test-support";

const server = (localMs: number) => localMs + SERVER_OFFSET_MS;

const node = (name: string, attributes: Record<string, string> = {}, children: ItemXmlNode[] = []): ItemXmlNode =>
  ({ name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children });

/** A passive table: kart 900 with `kart`, character 901, pet 902, goggle 903, balloon 904, headband 905. */
function passives(rows: { kart?: Record<string, string>; character?: Record<string, string>;
  pet?: Record<string, string>; goggle?: Record<string, string>; balloon?: Record<string, string>;
  headBand?: Record<string, string> }) {
  const children: ItemXmlNode[] = [];
  const ids = { kart: "900", character: "901", pet: "902", goggle: "903", balloon: "904", headBand: "905" } as const;
  for (const [tag, values] of Object.entries(rows))
    children.push(node(tag, { id: ids[tag as keyof typeof ids], ...values }));
  return createItemPassiveTable(node("itemtable", {}, children));
}

const EQUIPPED = { "1": 901, "3": 900, "21": 902, "8": 903, "9": 904, "11": 905, "52": 0 };

function equipped(rows: Parameters<typeof passives>[0], options: { teamRace?: boolean; trackId?: string } = {}) {
  return controllerFixture({ passives: passives(rows), itemIds: { [SELF]: EQUIPPED }, ...options });
}

/** A minimal game node (like item-race-controller.test.ts) with changers and a use count. */
function serve(f: ControllerFixture, slots: number[] = [-1, -1]) {
  const state = { slots: [...slots], useId: 100, targets: [] as string[], etaMs: 0,
    count: undefined as number | undefined, reject: undefined as string | undefined };
  f.connection.reply = ({ action, fields }: SentItem) => {
    if (state.reject) throw new Error(state.reject);
    const startAt = server(f.state.now);
    switch (action) {
      case "cube":
        return { type: "item", action: "grant", cubeId: fields.cubeId,
          itemId: state.slots[0] === -1 ? null : state.slots[0], slots: [...state.slots],
          changers: { slot: -1, item: -1, itemArmed: true } };
      case "use":
        state.slots = [...state.slots.slice(1), -1];
        return { type: "item", action: "used", playerId: SELF, useId: ++state.useId,
          itemId: fields.itemId, targets: fields.targetId ? [fields.targetId] : state.targets,
          startAt, etaMs: state.etaMs, ...(fields.point ? { point: fields.point } : {}),
          ...(state.count ? { count: state.count } : {}), slots: [...state.slots] };
      case "hit":
        return { type: "item", action: "hit", playerId: SELF, ...fields };
      default:
        return { type: "item", action: "slots", slots: [...state.slots] };
    }
  };
  return state;
}

async function holding(f: ControllerFixture, slots: number[]) {
  const state = serve(f, slots);
  f.controller.cube(1);
  await settle();
  return state;
}

function at(f: ControllerFixture, nowMs: number) {
  f.state.now = nowMs;
  f.controller.update(nowMs);
}

function press(f: ControllerFixture, nowMs: number) {
  f.state.now = nowMs;
  f.controller.handleCommand({ kind: "use", phase: "press" }, nowMs);
}

function used(f: ControllerFixture, event: { useId: number; itemId: number; playerId?: string;
  targets?: string[]; startAt: number; etaMs?: number; point?: { x: number; y: number; z: number };
  count?: number }) {
  f.connection.emit({ action: "used", playerId: RIVAL, targets: [], etaMs: 0, ...event });
}

const applied = (f: ControllerFixture) =>
  f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs]);

// ---- equipment passives (C.2) ---------------------------------------------

test("a kart or pet that defends an item blocks it fully; the shield is kept", async () => {
  const f = equipped({ kart: { devil: "100" }, pet: { rocket: "100" } });
  await holding(f, [10, -1]);
  press(f, 0);                                                   // shield until 2000
  used(f, { useId: 5, itemId: ItemIdx.devil, targets: [SELF], startAt: server(0) });
  used(f, { useId: 6, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(0), etaMs: 400 });
  at(f, 400);
  at(f, 1500);
  assert.deepEqual(f.connection.of("hit"), [
    { useId: 6, itemId: 7, result: "blocked", by: "pet" },
    { useId: 5, itemId: 2, result: "blocked", by: "kart" },
  ]);
  assert.deepEqual(f.physics.itemEffects.applied, []);
  assert.equal(f.controller.shieldUntil, 2000, "the equipment came first");
  const hits = f.presenter.of("hit").map(call => call[0] as Record<string, unknown>);
  assert.deepEqual(hits.map(hit => [hit.useId, hit.by]), [[6, "pet"], [5, "kart"]]);
  assert.deepEqual(f.controller.hudState(1500).log.map(row => row.failed), [true, true]);
  // A guide rocket is not in the rocket defence.
  used(f, { useId: 7, itemId: ItemIdx.guideRocket, targets: [SELF], startAt: server(3000), etaMs: 400 });
  at(f, 3400);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 7, itemId: 33, result: "hit" });
});

test("a banana kart eats bananas (dropped and on the track): unaffected, the banana is spent", () => {
  const f = equipped({ kart: { banana: "100" } });
  serve(f);
  at(f, 0);
  used(f, { useId: 9, itemId: ItemIdx.banana, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 1 }) });
  at(f, 600);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 9, itemId: 8, result: "blocked", by: "eat" }]);
  assert.equal(f.controller.areas.has(9), false);
  assert.deepEqual(f.physics.itemEffects.applied, []);
  f.controller.hazard({ id: 3, itemIdx: ItemIdx.banana });
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 0, itemId: 8, result: "blocked", by: "eat", hazardId: 3 });
  // A big banana too.
  used(f, { useId: 10, itemId: ItemIdx.bigBanana, startAt: server(1000), point: threeToClient({ x: 0, y: 0, z: 6 }) });
  at(f, 1600);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 10, itemId: 85, result: "blocked", by: "eat" });
});

test("iceBanana works only on ice tracks; mines are eaten with the lucci bonus", () => {
  const ice = equipped({ kart: { iceBanana: "100" } }, { trackId: "ice_I01" });
  serve(ice);
  ice.controller.hazard({ id: 1, itemIdx: ItemIdx.banana });
  assert.equal(ice.connection.of("hit")[0]!.by, "eat");
  const village = equipped({ kart: { iceBanana: "100" } }, { trackId: "village_I01" });
  serve(village);
  village.controller.hazard({ id: 1, itemIdx: ItemIdx.banana });
  assert.equal(village.connection.of("hit")[0]!.result, "hit");

  const f = equipped({ kart: { mine: "100", eatMine: "100" }, character: { lucciMine: "100" } });
  serve(f);
  at(f, 0);
  used(f, { useId: 11, itemId: ItemIdx.mine, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 1 }) });
  at(f, 600);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 11, itemId: 17, result: "blocked", by: "eat", variant: "bonus" }]);
  // Without eatMine the kart is only unaffected; an egg mine needs the egg ability.
  const g = equipped({ kart: { mine: "100" } });
  serve(g);
  g.controller.hazard({ id: 2, itemIdx: ItemIdx.mine });
  assert.deepEqual(g.connection.of("hit"), [{ useId: 0, itemId: 17, result: "blocked", by: "kart", hazardId: 2 }]);
  at(g, 0);
  used(g, { useId: 12, itemId: ItemIdx.eggMine, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 1 }) });
  at(g, 600);
  assert.deepEqual(g.connection.of("hit").at(-1), { useId: 12, itemId: 82, result: "hit" });
  assert.deepEqual(applied(g).at(-1), ["launch", 1500]);
});

test("a balloon softens a missile to AffectSmall once per use; double rockets land 200 ms apart", () => {
  const f = equipped({ balloon: { prob: "100" } });
  serve(f);
  at(f, 0);
  used(f, { useId: 20, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(0), etaMs: 500, count: 2 });
  assert.equal((f.presenter.of("used")[0]![0] as Record<string, unknown>).count, 2);
  at(f, 500);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 20, itemId: 7, result: "hit", variant: "balloon", shot: 0 }]);
  assert.deepEqual(applied(f), [["launch", 1000]]);
  at(f, 699);
  assert.equal(f.connection.of("hit").length, 1);
  assert.equal(f.controller.hudState(699).warning, "rocket", "the second missile still comes");
  at(f, 700);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 20, itemId: 7, result: "hit", shot: 1 });
  assert.deepEqual(applied(f).at(-1), ["launch", 1500]);
  // Gold rockets ignore balloons.
  used(f, { useId: 21, itemId: ItemIdx.goldRocket, targets: [SELF], startAt: server(5000), etaMs: 300 });
  at(f, 5300);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 21, itemId: 32, result: "hit" });
  // A shield stops the first missile only.
  const g = controllerFixture();
  const state = serve(g, [10, -1]);
  g.controller.cube(1);
  void state;
  return settle().then(() => {
    press(g, 0);
    used(g, { useId: 30, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(0), etaMs: 300, count: 2 });
    at(g, 300);
    at(g, 500);
    assert.deepEqual(g.connection.of("hit"), [
      { useId: 30, itemId: 7, result: "blocked", by: "shield", shot: 0 },
      { useId: 30, itemId: 7, result: "hit", shot: 1 },
    ]);
  });
});

test("the UFO: headband shortens it, 奇奇 turns it into BonusAffect, shield and angel do nothing", async () => {
  const f = equipped({ headBand: { probability: "100" }, character: { lucciUfo: "100" } });
  await holding(f, [10, -1]);
  press(f, 0);
  used(f, { useId: 3, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(0), etaMs: 600 });
  at(f, 600);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 3, itemId: 3, result: "hit", variant: "headband" }]);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs, entry.options.source]),
    [["slow", 1500, 3]]);
  const g = equipped({ character: { lucciUfo: "100" } });
  serve(g);
  at(g, 0);
  used(g, { useId: 4, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(0), etaMs: 600 });
  at(g, 600);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 4, itemId: 3, result: "hit", variant: "bonus" }]);
  assert.deepEqual(applied(g), [["slow", 3000]]);
});

test("waterAngel: a water trap ends quickly (variant quick); infected bombs lock items afterwards", () => {
  const f = equipped({ kart: { waterAngel: "100" } });
  serve(f);
  at(f, 0);
  used(f, { useId: 40, itemId: ItemIdx.snowBomb, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(f, 1000);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 40, itemId: 34, result: "hit", variant: "quick" }]);
  const trap = f.physics.itemEffects.applied[0]!;
  assert.deepEqual([trap.kind, trap.durationMs, trap.options.quick, trap.options.escapeImmunityMs,
    trap.options.afterBoost], ["trap", 500, true, 2000, true]);

  const g = controllerFixture();
  serve(g);
  at(g, 0);
  used(g, { useId: 41, itemId: ItemIdx.infectedBomb, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(g, 1000);
  const bubble = g.physics.itemEffects.applied[0]!;
  assert.deepEqual([bubble.kind, bubble.durationMs, bubble.options.escapeImmunityMs, bubble.options.afterBoost],
    ["trap", 2000, 0, false]);
  assert.equal(g.controller.hudState(2999).lock, undefined);
  assert.deepEqual(g.controller.hudState(3000).lock, { remainingMs: 5000 });
  // The water fly variant: snow fly 1500; the infected fly locks for its AfterBoost.
  used(g, { useId: 42, itemId: ItemIdx.infectedWaterFly, targets: [SELF], startAt: server(10000), etaMs: 500 });
  at(g, 10500);
  assert.deepEqual(applied(g).at(-1), ["trap", 1000]);
  assert.deepEqual(g.controller.hudState(11500).lock, { remainingMs: 2000 });
});

test("goggles thin and shorten the cloud; dark clouds use the overlay", () => {
  const f = equipped({ goggle: { trans: "0.7", cloudTime: "0.35" } });
  serve(f);
  at(f, 0);
  used(f, { useId: 4, itemId: ItemIdx.cloud2, targets: [SELF], startAt: server(0) });
  at(f, 666);
  const cloud = f.controller.hudState(666).cloud!;
  assert.ok(Math.abs(cloud.opacity - 0.3) < 1e-9);
  assert.ok(f.controller.hudState(666 + 3499).cloud);
  assert.equal(f.controller.hudState(666 + 3500).cloud, undefined);
  used(f, { useId: 5, itemId: ItemIdx.darkCloud2, targets: [SELF], startAt: server(10000) });
  at(f, 10666);
  const overlay = f.controller.hudState(10666).overlay!;
  assert.equal(overlay.kind, "darkCloud");
  assert.equal(overlay.untilMs, 10666 + 3500);
  assert.ok(Math.abs(overlay.opacity - 0.3) < 1e-9);
  assert.equal(f.controller.hudState(10666).cloud, undefined);
});

// ---- special items (C.4) ----------------------------------------------------

test("EMP clears only a UFO slow that is running, for every teammate it covers (C.1)", async () => {
  const f = controllerFixture({ teamRace: true });
  const state = await holding(f, [12, 12]);
  // No UFO: my EMP does nothing at all.
  state.targets = [SELF, MATE];
  press(f, 0);
  await settle();
  at(f, 600);
  assert.deepEqual(f.physics.itemEffects.ended, []);
  assert.equal(f.presenter.of("kartEffect").filter(call => call[1] === "emp").length, 0);
  // A UFO lands on me and on my teammate; the next EMP clears both, from the end of its Use.
  used(f, { useId: 7, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(1000), etaMs: 500 });
  at(f, 1500);
  assert.deepEqual(applied(f), [["slow", 3000]]);
  f.state.now = 1500;
  f.connection.emit({ action: "hit", playerId: MATE, useId: 8, itemId: 3, userId: RIVAL, result: "hit" });
  press(f, 2000);
  await settle();
  at(f, 2499);
  assert.deepEqual(f.physics.itemEffects.ended, []);
  at(f, 2500);
  assert.deepEqual(f.physics.itemEffects.ended, ["slow"]);
  assert.deepEqual(f.presenter.of("kartEffect").filter(call => call[1] === "emp"),
    [[SELF, "emp", 2500, 1500], [MATE, "emp", 2500, 1500]]);
  assert.ok(f.presenter.of("endKartEffect").some(call => call[0] === MATE && call[1] === "slow"));
  // A tiger rocket's slow is not a UFO: an EMP leaves it.
  const g = controllerFixture();
  serve(g);
  at(g, 0);
  used(g, { useId: 9, itemId: ItemIdx.tigerRocket, targets: [SELF], startAt: server(0), etaMs: 300 });
  at(g, 300);
  used(g, { useId: 10, itemId: ItemIdx.emp, playerId: SELF, targets: [SELF], startAt: server(400) });
  at(g, 900);
  assert.deepEqual(g.physics.itemEffects.ended, []);
});

test("blind rockets slow and cover the screen; the lion mask spins without a warning", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.tigerRocket, targets: [SELF], startAt: server(0), etaMs: 400 });
  assert.equal(f.controller.hudState(100).warning, "rocket");
  at(f, 400);
  assert.deepEqual(applied(f), [["slow", 4000]]);
  assert.deepEqual(f.controller.hudState(400).overlay, { kind: "tiger", untilMs: 4400, opacity: 1 });
  used(f, { useId: 2, itemId: ItemIdx.lionMaskRocket, targets: [SELF], startAt: server(5000), etaMs: 400 });
  assert.equal(f.controller.hudState(5100).warning, undefined);
  at(f, 5400);
  assert.deepEqual(applied(f).at(-1), ["spin", 2000]);
  assert.deepEqual(f.controller.hudState(5400).overlay, { kind: "lion", untilMs: 7400, opacity: 1 });
  used(f, { useId: 3, itemId: ItemIdx.honeyBee, targets: [SELF], startAt: server(8000), etaMs: 900 });
  assert.equal(f.controller.hudState(8100).warning, "waterfly");
  at(f, 8900);
  assert.equal(f.controller.hudState(8900).overlay?.kind, "honey");
});

test("devil variants reverse their own keys; snowman shrinks; tornado stops for 2000", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.newDevil, targets: [SELF], startAt: server(0) });
  used(f, { useId: 2, itemId: ItemIdx.drrMine, targets: [SELF, OTHER], startAt: server(0) });
  used(f, { useId: 3, itemId: ItemIdx.devil, targets: [SELF], startAt: server(0) });
  at(f, 1500);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs, entry.options.mode]),
    [["reverse", 5000, "forwardBack"], ["reverse", 5000, "all"], ["reverse", 3000, "steering"]]);
  used(f, { useId: 4, itemId: ItemIdx.snowman, targets: [SELF], startAt: server(2000), etaMs: 500 });
  at(f, 2500);
  assert.deepEqual(applied(f).at(-1), ["shrink", 2000]);
  used(f, { useId: 5, itemId: ItemIdx.abyssBarricade, playerId: RIVAL, targets: [OTHER], startAt: server(3000) });
  f.connection.emit({ action: "placed", useId: 5, itemId: 135, playerId: RIVAL, point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(f, 4266);
  assert.deepEqual(applied(f).at(-1), ["barrier", 2000]);
});

test("gold and protect shields: invincible from the end of Use, not against clouds", async () => {
  const f = controllerFixture();
  await holding(f, [36, 81]);
  press(f, 0);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "invincible", 500, 2500, { itemId: 36 }]);
  await settle();
  used(f, { useId: 1, itemId: ItemIdx.devil, targets: [SELF], startAt: server(-1400) }); // lands at 100
  at(f, 100);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 1, itemId: 2, result: "hit" }, "not yet invincible");
  used(f, { useId: 2, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(500), etaMs: 400 });
  used(f, { useId: 3, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(500), etaMs: 500 });
  used(f, { useId: 4, itemId: ItemIdx.cloud2, targets: [SELF], startAt: server(500) });
  at(f, 900);
  at(f, 1000);
  at(f, 1200);
  assert.deepEqual(f.connection.of("hit").slice(1), [
    { useId: 2, itemId: 7, result: "blocked", by: "shield" },
    { useId: 3, itemId: 3, result: "blocked", by: "shield" },
    { useId: 4, itemId: 114, result: "hit" },
  ]);
  assert.equal(f.presenter.of("endKartEffect").filter(call => call[1] === "shield").length, 0,
    "a gold shield is not a spent shield");
  at(f, 3000);
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(3000), etaMs: 300 });
  at(f, 3300);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 5, itemId: 7, result: "hit" });
  // Someone else's gold shield shows on their kart.
  used(f, { useId: 6, itemId: ItemIdx.protectShield, playerId: RIVAL, startAt: server(4000) });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "invincible", 4500, 4000, { itemId: 81 }]);
});

test("boosters, super shield, gold magnet and sirens start their own effects", async () => {
  const f = controllerFixture();
  const state = await holding(f, [31, 18]);
  press(f, 0);
  assert.deepEqual(f.physics.boosterCalls, [{ kind: "animal" }]);
  await settle();
  press(f, 100);
  assert.deepEqual(f.physics.boosterCalls.at(-1), { kind: "super" });
  assert.equal(f.controller.shieldUntil, 3100);
  await settle();
  state.slots = [24, 106];
  f.controller.cube(2);
  await settle();
  press(f, 4000);
  assert.deepEqual(f.physics.boosterCalls.at(-1), { kind: "item", options: { durationMs: 3000 } });
  await settle();
  press(f, 8000);
  assert.deepEqual(f.physics.boosterCalls.at(-1), { kind: "item", options: { durationMs: 2200 } });
  assert.equal(f.controller.shieldUntil, 10200);
  await settle();
  state.slots = [6, -1];
  f.controller.cube(3);
  await settle();
  press(f, 11000);
  assert.deepEqual(f.physics.boosterCalls.at(-1), { kind: "item" });
  // The gold magnet pulls with a shield.
  const g = controllerFixture();
  await holding(g, [103, -1]);
  g.poses.set(RIVAL, pose({ x: 0, y: 0, z: 40 }));
  press(g, 1000);
  at(g, 1000 + ITEM_RACE_TUNING.aimLockMs);
  g.state.now = 1700;
  g.controller.handleCommand({ kind: "use", phase: "release" }, 1700);
  assert.equal(g.physics.itemEffects.applied[0]!.kind, "pull");
  assert.equal(g.controller.shieldUntil, 4700);
});

test("an opponent's siren spins me when I touch it; a siren kart is immune", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 10 }));
  used(f, { useId: 1, itemId: ItemIdx.siren, playerId: RIVAL, targets: [RIVAL], startAt: server(0) });
  at(f, 100);
  assert.equal(f.connection.of("hit").length, 0);
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 2 }));
  at(f, 200);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 1, itemId: 24, result: "hit" }]);
  assert.deepEqual(applied(f), [["spin", 2000]]);
  at(f, 300);
  assert.equal(f.connection.of("hit").length, 1, "once per use");
  // After its Use the siren no longer knocks.
  used(f, { useId: 2, itemId: ItemIdx.siren, playerId: OTHER, targets: [OTHER], startAt: server(0) });
  f.poses.set(OTHER, pose({ x: 0, y: 0, z: 1 }));
  at(f, 3001);
  assert.equal(f.connection.of("hit").length, 1);
  const g = equipped({ kart: { siren: "100" } });
  serve(g);
  at(g, 0);
  g.poses.set(RIVAL, pose({ x: 0, y: 0, z: 1 }));
  used(g, { useId: 3, itemId: ItemIdx.sirenShield, playerId: RIVAL, targets: [RIVAL], startAt: server(0) });
  at(g, 100);
  assert.equal(g.connection.of("hit").length, 0, "the siren shield knocks after its Use");
  at(g, 300);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 3, itemId: 106, result: "blocked", by: "kart" }]);
});

test("tigerGhost: invisible to the other team, translucent to teammates, cannot be aimed at", async () => {
  const f = controllerFixture({ teamRace: true });
  await holding(f, [7, 101]);
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 30 }));
  used(f, { useId: 1, itemId: ItemIdx.tigerGhost, playerId: RIVAL, targets: [RIVAL], startAt: server(0) });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "invisible", 500, 7000, { visibleToMe: false, itemId: 101 }]);
  used(f, { useId: 2, itemId: ItemIdx.tigerGhost, playerId: MATE, targets: [MATE], startAt: server(0) });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "invisible", 500, 7000, { visibleToMe: true, itemId: 101 }]);
  press(f, 600);
  assert.equal(f.controller.aim?.phase, "aiming");
  assert.equal(f.controller.aim?.targetId, undefined);
  f.controller.handleCommand({ kind: "use", phase: "cancel" }, 600);
  at(f, 7500);
  press(f, 7500);
  assert.equal(f.controller.aim?.targetId, RIVAL);
});

test("lockdown rockets hold the target and slow the user's other opponents in the field", () => {
  // I am the target: held for AffectMain.
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.lockdownRocket, targets: [SELF], startAt: server(0), etaMs: 500 });
  at(f, 500);
  assert.deepEqual(applied(f), [["hold", 2000]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 1, itemId: 104, result: "hit" }]);
  // Another opponent near the target: the field (500 ms after impact, 1000 ms long) slows me.
  const g = controllerFixture({ teamRace: true });
  serve(g);
  at(g, 0);
  g.poses.set(OTHER, pose({ x: 0, y: 0, z: 10 }));
  used(g, { useId: 2, itemId: ItemIdx.blockRocket, playerId: RIVAL, targets: [OTHER], startAt: server(0), etaMs: 500 });
  at(g, 999);
  assert.equal(g.connection.of("hit").length, 0);
  at(g, 1000);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 2, itemId: 117, result: "hit" }]);
  assert.deepEqual(applied(g), [["slow", 3000]]);
  // The user's teammates are never in its field; outside the radius nothing happens.
  const h = controllerFixture({ teamRace: true });
  serve(h);
  at(h, 0);
  h.poses.set(RIVAL, pose({ x: 0, y: 0, z: 10 }));
  used(h, { useId: 3, itemId: ItemIdx.lockdownRocket, playerId: MATE, targets: [RIVAL], startAt: server(0), etaMs: 500 });
  at(h, 1200);
  used(h, { useId: 4, itemId: ItemIdx.lockdownRocket, playerId: RIVAL, targets: [MATE], startAt: server(0), etaMs: 500 });
  h.poses.set(MATE, pose({ x: 0, y: 0, z: 40 }));
  at(h, 1300);
  at(h, 2100);
  assert.equal(h.connection.of("hit").length, 0);
});

test("waterbombFly rides its target, then bursts and traps the target and opponents nearby", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.waterbombFly, targets: [SELF], startAt: server(0), etaMs: 800 });
  assert.equal(f.controller.hudState(100).warning, "waterfly");
  at(f, 800);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "timeBomb", 800, 2000, { itemId: 120 }]);
  assert.equal(f.connection.of("hit").length, 0);
  at(f, 2800);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 1, itemId: 120, result: "hit" }]);
  const trap = f.physics.itemEffects.applied[0]!;
  assert.deepEqual([trap.kind, trap.durationMs, trap.options.escapeImmunityMs], ["trap", 2000, 1000]);
  // Near the target I am caught too; far away I am not.
  const g = controllerFixture();
  serve(g);
  at(g, 0);
  g.poses.set(OTHER, pose({ x: 0, y: 0, z: 10 }));
  used(g, { useId: 2, itemId: ItemIdx.waterbombFly, targets: [OTHER], startAt: server(0), etaMs: 800 });
  at(g, 800);
  assert.deepEqual(g.presenter.of("kartEffect").at(-1), [OTHER, "timeBomb", 800, 2000, { itemId: 120 }]);
  at(g, 2800);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 2, itemId: 120, result: "hit" }]);
  const h = controllerFixture();
  serve(h);
  at(h, 0);
  h.poses.set(OTHER, pose({ x: 0, y: 0, z: 40 }));
  used(h, { useId: 3, itemId: ItemIdx.waterbombFly, targets: [OTHER], startAt: server(0), etaMs: 800 });
  at(h, 2800);
  at(h, 3000);
  assert.equal(h.connection.of("hit").length, 0);
});

test("the talisman holds and locks me; its five arrows in order end it early", async () => {
  const f = controllerFixture();
  await holding(f, [7, -1]);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.talisman, targets: [SELF], startAt: server(0), etaMs: 500 });
  at(f, 500);
  assert.deepEqual(applied(f), [["hold", 4000]]);
  assert.deepEqual(f.controller.hudState(500).lock, { remainingMs: 4000 });
  const qte = f.controller.hudState(500).talisman!;
  assert.equal(qte.keys.length, 5);
  assert.equal(qte.done, 0);
  press(f, 600);
  assert.equal(f.controller.aim, undefined, "no items while held");
  const effects = f.physics.itemEffects;
  const wrong = (["left", "right", "up", "down"] as const).find(direction => direction !== qte.keys[0])!;
  effects.directionPresses.push({ direction: qte.keys[0]!, atMs: 0 }, { direction: wrong, atMs: 0 });
  at(f, 700);
  assert.equal(f.controller.hudState(700).talisman?.done, 0, "a wrong arrow starts over");
  assert.equal(f.controller.hudState(700).talisman?.failedAtMs, 700);
  assert.deepEqual(f.presenter.of("sound").slice(-2).map(call => call[1]), ["입력성공", "입력실패"]);
  effects.directionPresses.push(...qte.keys.map(direction => ({ direction, atMs: 0 })));
  at(f, 800);
  assert.deepEqual(effects.escapedHolds, [500]);
  assert.deepEqual(f.connection.of("escape"), [{ useId: 1 }], "the node ends its lock, the others the hold");
  assert.equal(f.controller.hudState(800).talisman, undefined);
  assert.deepEqual(f.controller.hudState(800).lock, { remainingMs: 500 });
  at(f, 1300);
  assert.equal(f.controller.hudState(1300).lock, undefined);
});

test("someone else's talisman hold ends when they escape it early", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 3, itemId: ItemIdx.talisman, targets: [RIVAL], startAt: server(0), etaMs: 500,
    playerId: OTHER });
  f.state.now = 500;
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 3, itemId: 137, userId: OTHER, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "hold", 500, 4000, { itemId: 137 }]);
  f.state.now = 1500;
  f.connection.emit({ action: "escaped", playerId: RIVAL, useId: 3, itemId: 137 });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "hold", 500, 1500, { itemId: 137 }]);
  assert.equal(f.controller.remoteHolds.size, 0);
});

test("dropped specials: mines launch, the spring trap knocks back, oil covers the screen", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.springMine, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 1 }) });
  used(f, { useId: 2, itemId: ItemIdx.forceZone, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 20 }) });
  used(f, { useId: 3, itemId: ItemIdx.oil, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 40 }) });
  used(f, { useId: 4, itemId: ItemIdx.waterMine, startAt: server(0), point: threeToClient({ x: 0, y: 0, z: 60 }) });
  at(f, 500);
  f.physics.body.position = { x: 0, y: 0, z: 18 };
  at(f, 600);
  f.physics.body.position = { x: 0, y: 0, z: 40 };
  at(f, 700);
  f.physics.body.position = { x: 0, y: 0, z: 57 };
  at(f, 800);
  assert.equal(f.connection.of("hit").length, 3, "the water mine triggers at its Set size (2), not 10");
  f.physics.body.position = { x: 0, y: 0, z: 59 };
  at(f, 900);
  assert.deepEqual(f.connection.of("hit").map(hit => hit.itemId), [129, 25, 46, 37]);
  assert.deepEqual(applied(f), [["launch", 1500], ["knockback", 500], ["trap", 2000]]);
  assert.equal(f.controller.hudState(700).overlay?.kind, "oil");
  assert.equal(f.controller.areas.size, 0, "each trap is spent on its victim");
});

test("remote hits show the variant's duration; a remote UFO is tracked for EMP", () => {
  const f = controllerFixture({ teamRace: true });
  serve(f);
  at(f, 0);
  f.state.now = 100;
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 5, itemId: 7, userId: MATE, result: "hit",
    variant: "balloon" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "launch", 100, 1000]);
  assert.equal((f.presenter.of("hit").at(-1)![0] as Record<string, unknown>).variant, "balloon");
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 6, itemId: 9, userId: MATE, result: "hit",
    variant: "quick" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "trap", 100, 500]);
  at(f, 600);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "escapeShield", 600, 2000]);
  f.state.now = 1000;
  f.connection.emit({ action: "hit", playerId: MATE, useId: 7, itemId: 3, userId: RIVAL, result: "hit",
    variant: "headband" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "slow", 1000, 1500]);
  assert.equal(f.controller.remoteUfoSlows.get(MATE), 2500);
  // A special item's effect names its item for the presenter (a snow bomb's ice, a lockdown hold).
  f.connection.emit({ action: "hit", playerId: OTHER, useId: 12, itemId: 34, userId: MATE, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [OTHER, "trap", 1000, 3000, { itemId: 34 }]);
  f.connection.emit({ action: "hit", playerId: OTHER, useId: 13, itemId: 104, userId: MATE, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [OTHER, "hold", 1000, 2000, { itemId: 104 }]);
  // A lockdown field victim is anyone but the use's target.
  used(f, { useId: 14, itemId: ItemIdx.blockRocket, playerId: MATE, targets: [RIVAL], startAt: server(0), etaMs: 500 });
  f.state.now = 1000;
  f.connection.emit({ action: "hit", playerId: OTHER, useId: 14, itemId: 117, userId: MATE, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [OTHER, "slow", 1000, 3000, { itemId: 117 }]);
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 14, itemId: 117, userId: MATE, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [RIVAL, "hold", 500, 2000, { itemId: 117 }]);
  f.connection.emit({ action: "hit", playerId: MATE, useId: 8, itemId: 2, userId: RIVAL, result: "blocked", by: "kart" });
  assert.equal((f.presenter.of("hit").at(-1)![0] as Record<string, unknown>).by, "kart");
  used(f, { useId: 9, itemId: ItemIdx.emp, playerId: MATE, targets: [MATE, SELF], startAt: server(1000) });
  at(f, 1500);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "emp", 1500, 1500]);
  assert.equal(f.controller.remoteUfoSlows.has(MATE), false);
});

// ---- server pushes, HUD feed, finish ------------------------------------------

test("server pushes: gained items, the 迅 start item flash and in-race lucci", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 100);
  f.connection.emit({ action: "slots", slots: [8, -1], changers: { slot: 2, item: 0, itemArmed: true },
    reason: "start", itemId: 8 });
  let hud = f.controller.hudState(100);
  assert.deepEqual(hud.slots, [8, -1]);
  assert.equal(hud.startItemFlash, 100);
  assert.deepEqual(f.presenter.of("startItemFlash"), [[100]]);
  assert.deepEqual(hud.infoCard, { itemIdx: 8 });
  assert.equal(hud.changers?.slot, 2);
  assert.equal(f.controller.hudState(100 + ITEM_RACE_TUNING.startItemFlashKeepMs).startItemFlash, undefined);
  f.connection.emit({ action: "slots", slots: [8, 10], reason: "gain", itemId: 10 });
  assert.deepEqual(f.controller.hudState(200).slots, [8, 10]);
  f.state.now = 300;
  f.connection.emit({ action: "lucci", amount: 10, reason: "balloon" });
  hud = f.controller.hudState(300);
  assert.deepEqual(hud.lucci, { amount: 10, atMs: 300 });
  assert.equal(f.controller.hudState(300 + ITEM_RACE_TUNING.lucciNoticeMs).lucci, undefined);
});

test("a gain pushed while my use is in flight waits for the use's reply", async () => {
  const f = controllerFixture();
  serve(f);
  f.connection.reply = ({ fields }) => ({ type: "item", action: "grant", cubeId: fields.cubeId, itemId: 5,
    slots: [5, 7], changers: { slot: 0, item: 0, itemArmed: true } });
  f.controller.cube(1);
  await settle();
  let resolve: (value: unknown) => void = () => {};
  f.connection.reply = () => new Promise(done => { resolve = done; });
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 40 }));
  press(f, 0);
  at(f, ITEM_RACE_TUNING.aimLockMs);
  f.state.now = 700;
  f.controller.handleCommand({ kind: "use", phase: "release" }, 700);
  assert.deepEqual(f.controller.hudState(700).slots, [7, -1]);
  // The node pushes the magnet's firing2Gain before the use's reply.
  f.connection.emit({ action: "slots", slots: [7, 6], reason: "gain", itemId: 6 });
  assert.deepEqual(f.controller.hudState(700).slots, [7, -1], "not shifted twice");
  resolve({ type: "item", action: "used", playerId: SELF, useId: 50, itemId: 5, targets: [RIVAL],
    startAt: server(700), etaMs: 0, slots: [7, 6] });
  await settle();
  assert.deepEqual(f.controller.hudState(700).slots, [7, 6]);
});

test("the server's slotIcons name the special booster's icon", async () => {
  const f = controllerFixture();
  f.connection.reply = ({ fields }) => ({ type: "item", action: "grant", cubeId: fields.cubeId,
    itemId: 31, slots: [31, -1], slotIcons: [266, 0], changers: { slot: 0, item: 0, itemArmed: true } });
  f.controller.cube(1);
  await settle();
  assert.deepEqual(f.controller.hudState(0).slotIcons, [266, undefined]);
  f.connection.emit({ action: "slots", slots: [6, 31], reason: "gain", itemId: 6 });
  assert.deepEqual(f.controller.hudState(0).slotIcons, [undefined, 266]);
});

test("the special booster shows the kart's animal icon", async () => {
  const animalBoosters = createAnimalBoosterTable(node("animalBoosterList", {},
    [node("animalBooster", { kartId: "900", iconId: "241" })]));
  const f = controllerFixture({ itemIds: { [SELF]: EQUIPPED }, animalBoosters });
  await holding(f, [6, 31]);
  assert.deepEqual(f.controller.hudState(0).slotIcons, [undefined, 241]);
  const g = controllerFixture({ animalBoosters });
  await holding(g, [31, -1]);
  assert.equal(g.controller.hudState(0).slotIcons, undefined, "another kart: the item icon");
});

test("countdown tutorial boards and the perfect start", () => {
  const team = controllerFixture({ teamRace: true });
  team.state.racing = false;
  assert.equal(team.controller.hudState(0).tutorial, "avoidTeamkill");
  const solo = controllerFixture({ changers: { slot: 50, item: 0, itemArmed: false } });
  solo.state.racing = false;
  assert.equal(solo.controller.hudState(0).tutorial, "changer");
  assert.equal(controllerFixture().controller.hudState(0).tutorial, undefined);
  solo.state.racing = true;
  at(solo, 100);
  assert.equal(solo.controller.hudState(100).tutorial, undefined);
  assert.equal(solo.controller.perfectStart, false);
  solo.physics.runtime.physicsState = 1;
  at(solo, 200);
  solo.physics.runtime.physicsState = 0;
  at(solo, 300);
  assert.equal(solo.controller.perfectStart, true);
});

test("the passive roll is the shared deterministic one (race, use, victim, kind)", () => {
  const roll = itemRoll({ raceId: "seed", useId: 5, victimId: SELF, kind: "devil" });
  const hit = (percent: number) => {
    const f = controllerFixture({ passives: passives({ kart: { devil: String(percent) } }),
      itemIds: { [SELF]: EQUIPPED }, raceId: "seed" });
    serve(f);
    at(f, 0);
    used(f, { useId: 5, itemId: ItemIdx.devil, targets: [SELF], startAt: server(0) });
    at(f, 1500);
    return f.connection.of("hit")[0];
  };
  assert.deepEqual(hit(roll + 1), { useId: 5, itemId: 2, result: "blocked", by: "kart" });
  assert.deepEqual(hit(roll), { useId: 5, itemId: 2, result: "hit" });
});
