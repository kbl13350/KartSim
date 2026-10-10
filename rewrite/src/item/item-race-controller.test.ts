import assert from "node:assert/strict";
import test from "node:test";

import { ItemIdx } from "./item-catalog";
import { ITEM_RACE_TUNING, threeToClient } from "./item-race-rules";
import {
  MATE, OTHER, RIVAL, SELF, SERVER_OFFSET_MS, controllerFixture, pose, settle,
  type ControllerFixture, type SentItem,
} from "./item-race-test-support";

const server = (localMs: number) => localMs + SERVER_OFFSET_MS;

/** A minimal game node: slots, uses and replies like lobby/item_mode.go. */
function serve(f: ControllerFixture, slots: number[] = [-1, -1]) {
  const state = { slots: [...slots], useId: 100, targets: [] as string[], etaMs: 0,
    reject: undefined as string | undefined, count: undefined as number | undefined,
    changers: { slot: -1, item: -1, itemArmed: true } as { slot: number; item: number; itemArmed: boolean },
    change: 6 };
  f.connection.reply = ({ action, fields }: SentItem) => {
    if (state.reject) throw new Error(state.reject);
    const startAt = server(f.state.now);
    switch (action) {
      case "cube":
        state.changers = { ...state.changers, itemArmed: true };
        return { type: "item", action: "grant", cubeId: fields.cubeId,
          itemId: state.slots[0] === -1 ? null : state.slots[0], slots: [...state.slots],
          changers: { ...state.changers } };
      case "use": {
        if (state.slots[0] !== fields.itemId) throw new Error("ITEM_NOT_HELD");
        state.slots = [...state.slots.slice(1), -1];
        return { type: "item", action: "used", playerId: SELF, useId: ++state.useId,
          itemId: fields.itemId, targets: fields.targetId ? [fields.targetId] : state.targets,
          startAt, etaMs: state.etaMs, ...(fields.point ? { point: fields.point } : {}),
          ...(state.count ? { count: state.count } : {}),
          slots: [...state.slots], changers: { ...state.changers } };
      }
      case "swap":
        state.slots = [state.slots[1]!, state.slots[0]!, ...state.slots.slice(2)];
        if (state.changers.slot > 0) state.changers = { ...state.changers, slot: state.changers.slot - 1 };
        return { type: "item", action: "slots", slots: [...state.slots], changers: { ...state.changers } };
      case "change":
        state.slots = [state.change, ...state.slots.slice(1)];
        state.changers = { ...state.changers, itemArmed: false,
          item: state.changers.item > 0 ? state.changers.item - 1 : state.changers.item };
        return { type: "item", action: "slots", slots: [...state.slots], changers: { ...state.changers } };
      case "hit":
        return { type: "item", action: "hit", playerId: SELF, ...fields,
          ...(fields.itemId === ItemIdx.banana && fields.useId ? { removed: true } : {}) };
      case "place":
        return { type: "item", action: "placed", playerId: SELF, ...fields };
      case "slots":
        return { type: "item", action: "slots", slots: [...state.slots], changers: { ...state.changers } };
      case "escape":
        return { type: "item", action: "escaped", playerId: SELF, ...fields };
      default:
        throw new Error("INVALID_ACTION");
    }
  };
  return state;
}

/** Fill the slots through a cube grant. */
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

function release(f: ControllerFixture, nowMs: number) {
  f.state.now = nowMs;
  f.controller.handleCommand({ kind: "use", phase: "release" }, nowMs);
}

function used(f: ControllerFixture, event: { useId: number; itemId: number; playerId?: string;
  targets?: string[]; startAt: number; etaMs?: number; point?: { x: number; y: number; z: number } }) {
  f.connection.emit({ action: "used", playerId: RIVAL, targets: [], etaMs: 0, ...event });
}

test("cube grants mirror the server slots, report the capacity and show the card", async () => {
  const f = controllerFixture({ capacity: 3 });
  f.connection.reply = ({ fields }) => ({ type: "item", action: "grant", cubeId: fields.cubeId,
    itemId: 7, slots: [7, -1, -1] });
  f.controller.cube(12);
  assert.deepEqual(f.connection.of("cube"), [{ cubeId: 12, capacity: 3 }]);
  await settle();
  assert.deepEqual(f.physics.slotsSet.at(-1), [7, -1, -1]);
  let hud = f.controller.hudState(0);
  assert.deepEqual(hud.slots, [7, -1, -1]);
  assert.equal(hud.capacity, 3);
  assert.deepEqual(hud.infoCard, { itemIdx: 7 });
  // No changers reported: no Alt / Z (no unlimited swaps, C.6).
  assert.equal(hud.slotChanger, 0);
  assert.equal(hud.itemChanger, 0);
  assert.deepEqual(hud.changers, { slot: 0, item: 0, slotUsable: false, itemUsable: false });
  at(f, ITEM_RACE_TUNING.infoCardMs);
  assert.equal(f.controller.hudState(ITEM_RACE_TUNING.infoCardMs).infoCard, undefined);

  // Re-eating the same cube: nothing granted and the abuse message.
  f.connection.reply = ({ fields }) => ({ type: "item", action: "grant", cubeId: fields.cubeId,
    itemId: null, reason: "abusing", slots: [7, -1, -1] });
  at(f, 5000);
  f.controller.cube(12);
  await settle();
  hud = f.controller.hudState(5000);
  assert.equal(hud.abuseUntil, 5000 + ITEM_RACE_TUNING.abuseNoticeMs);
  assert.deepEqual(hud.slots, [7, -1, -1]);
  assert.equal(f.controller.hudState(7001).abuseUntil, undefined);

  // A rejected cube request never fails the race and keeps the slots.
  f.connection.reply = () => { throw new Error("INVALID_USE"); };
  f.controller.cube(13);
  await settle();
  assert.deepEqual(f.controller.hudState(7001).slots, [7, -1, -1]);
  assert.match(String(f.logs.at(-1)), /道具箱 13/);
});

test("the booster fires at once; the slots shift before the reply and follow it", async () => {
  const f = controllerFixture();
  await holding(f, [6, 7]);
  press(f, 1000);
  assert.equal(f.physics.boosters, 1);
  assert.deepEqual(f.controller.hudState(1000).slots, [7, -1]);
  assert.deepEqual(f.physics.slotsSet.at(-1), [7, -1]);
  assert.deepEqual(f.connection.of("use"), [{ itemId: 6 }]);
  await settle();
  const usedEvent = f.presenter.of("used")[0]![0] as Record<string, unknown>;
  assert.equal(usedEvent.itemId, 6);
  assert.equal(usedEvent.userId, SELF);
  assert.equal(usedEvent.startMs, 1000);
  assert.deepEqual(f.controller.hudState(1000).infoCard, { itemIdx: 7 });
});

test("a rejected use restores the last confirmed slots and never throws", async () => {
  const f = controllerFixture();
  const state = await holding(f, [7, 13]);
  // Time bomb in slot 0 after a swap that the server rejects.
  state.reject = "INVALID_USE";
  f.controller.handleCommand({ kind: "swap" }, 100);
  assert.deepEqual(f.controller.hudState(100).slots, [13, 7]);
  await settle();
  assert.deepEqual(f.controller.hudState(100).slots, [7, 13]);
  state.reject = undefined;
  f.controller.handleCommand({ kind: "swap" }, 200);
  await settle();
  assert.deepEqual(f.controller.hudState(200).slots, [13, 7]);
  state.reject = "ITEM_LOCKED";
  press(f, 1000);
  assert.deepEqual(f.controller.hudState(1000).slots, [7, -1]);
  assert.equal(f.controller.hudState(1000).timeBomb?.remainingMs, 3000);
  await settle();
  assert.deepEqual(f.controller.hudState(1000).slots, [13, 7]);
  assert.equal(f.controller.hudState(1000).timeBomb, undefined);
  assert.deepEqual(f.presenter.of("endKartEffect").at(-1), [SELF, "timeBomb"]);
  assert.ok(f.logs.some(entry => String(entry).includes("ITEM_LOCKED")));
});

test("the shield starts on the key press, the angel when Use ends (C.5)", async () => {
  const f = controllerFixture({ teamRace: true });
  const state = await holding(f, [10, 11]);
  press(f, 1000);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "shield", 1000, 2000]);
  assert.equal(f.controller.shieldUntil, 3000);
  await settle();
  state.targets = [SELF, MATE];
  press(f, 1100);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "angel", 1600, 4000]);
  await settle();
  // The teammate's angel starts on the server's startAt + Use.life.
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "angel", 1600, 4000]);
  assert.equal(f.controller.angelUntil, 5600);
});

test("a banana is dropped behind; it catches its user only after the grace", async () => {
  const f = controllerFixture();
  await holding(f, [8, -1]);
  press(f, 1000);
  const point = f.connection.of("use")[0]!.point;
  assert.deepEqual(point, threeToClient({ x: 0, y: 0, z: -4 }));
  await settle();
  f.physics.body.position = { x: 0, y: 0, z: -4.5 };
  at(f, 2000);
  assert.equal(f.connection.of("hit").length, 0, "inside the owner grace");
  at(f, 1000 + 500 + ITEM_RACE_TUNING.bananaOwnerGraceMs + 1);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs]),
    [["spin", 2000]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 101, itemId: 8, result: "hit" }]);
  await settle();
  assert.deepEqual(f.presenter.of("removed"), [[101]]);
  at(f, 3000);
  assert.equal(f.connection.of("hit").length, 1, "reported once");
});

test("someone else's banana spins every kart that runs into it", async () => {
  const f = controllerFixture();
  serve(f);
  at(f, 1000);
  used(f, { useId: 7, itemId: ItemIdx.banana, startAt: server(1000),
    point: threeToClient({ x: 0, y: 0, z: 30 }) });
  f.physics.body.position = { x: 0, y: 0, z: 30.5 };
  at(f, 1400);
  assert.equal(f.connection.of("hit").length, 0, "not yet on the road");
  at(f, 1500);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 7, itemId: 8, result: "hit" }]);
  // With a shield the banana is blocked (and consumed by the server).
  const g = controllerFixture();
  const state = await holding(g, [10, -1]);
  void state;
  press(g, 1000);
  used(g, { useId: 9, itemId: ItemIdx.banana, startAt: server(900),
    point: threeToClient({ x: 0, y: 0, z: 1 }) });
  at(g, 1500);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 9, itemId: 8, result: "blocked", by: "shield" }]);
  assert.equal(g.physics.itemEffects.applied.length, 0);
});

test("a water bomb lands ahead and traps opponents in its blast window", async () => {
  const f = controllerFixture({ teamRace: true });
  await holding(f, [9, -1]);
  press(f, 1000);
  assert.deepEqual(f.connection.of("use")[0]!.point, threeToClient({ x: 0, y: 0, z: 30 }));
  await settle();
  // My own and my teammate's bombs never trap me.
  f.physics.body.position = { x: 0, y: 0, z: 30 };
  at(f, 2500);
  used(f, { useId: 20, itemId: ItemIdx.waterBomb, playerId: MATE, startAt: server(2500),
    point: threeToClient({ x: 0, y: 0, z: 30 }) });
  at(f, 4000);
  assert.equal(f.connection.of("hit").length, 0);
  // An opponent's bomb does, with the blue shield after the bubble.
  used(f, { useId: 21, itemId: ItemIdx.waterBomb, playerId: RIVAL, startAt: server(4000),
    point: threeToClient({ x: 0, y: 0, z: 35 }) });
  at(f, 4900);
  assert.equal(f.connection.of("hit").length, 0, "still in the air");
  at(f, 5100);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs,
    entry.options.escapeImmunityMs]), [["trap", 2000, 2000]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 21, itemId: 9, result: "hit" }]);
});

test("rockets aim at the nearest opponent ahead, lock on and fire on release", async () => {
  const f = controllerFixture();
  await holding(f, [7, 7]);
  f.poses.set(OTHER, pose({ x: 60, y: 0, z: 10 }));          // outside the cone
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 50 }));
  press(f, 1000);
  assert.equal(f.controller.aim?.phase, "inrange");
  assert.equal(f.controller.aim?.targetId, RIVAL);
  assert.deepEqual(f.presenter.of("sound").at(-1), [7, "inrange", { key: "item-aim", loop: true }]);
  at(f, 1000 + ITEM_RACE_TUNING.aimLockMs - 1);
  assert.equal(f.controller.aim?.phase, "inrange");
  at(f, 1000 + ITEM_RACE_TUNING.aimLockMs);
  assert.equal(f.controller.aim?.phase, "ontarget");
  assert.deepEqual(f.presenter.of("sound").at(-1), [7, "ontarget", { key: "item-aim", loop: true }]);
  // The reticle sits on the target's projection (identity view, w = -z projection).
  const camera = { matrixWorldInverse: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
    projectionMatrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0] } };
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: -50 }));
  f.controller.present({ nowMs: 1700, camera, width: 1600, height: 900 });
  const hud = f.controller.hudState(1700);
  assert.equal(hud.aim?.phase, "ontarget");
  assert.equal(hud.aim?.x, 800);
  assert.ok(Math.abs(hud.aim!.y - (1 - 0.6 / 50) / 2 * 900) < 1e-9);
  assert.equal(f.presenter.of("update").length, 1);
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 50 }));
  release(f, 1800);
  assert.deepEqual(f.connection.of("use"), [{ itemId: 7, targetId: RIVAL }]);
  assert.deepEqual(f.presenter.of("stopSound").at(-1), ["item-aim"]);
  assert.equal(f.controller.hudState(1800).aim, undefined);
  await settle();

  // No lock: a misfire without a target.
  f.poses.clear();
  press(f, 3000);
  assert.equal(f.controller.aim?.phase, "aiming");
  release(f, 3100);
  assert.deepEqual(f.presenter.of("sound").at(-1), [7, "misfire", undefined]);
  assert.deepEqual(f.connection.of("use").at(-1), { itemId: 7 });
});

test("aiming skips teammates, drops on cancel and switches targets", async () => {
  const f = controllerFixture({ teamRace: true });
  await holding(f, [7, -1]);
  f.poses.set(MATE, pose({ x: 0, y: 0, z: 10 }));
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 80 }));
  press(f, 1000);
  assert.equal(f.controller.aim?.targetId, RIVAL);
  f.poses.set(OTHER, pose({ x: 0, y: 0, z: 20 }));
  at(f, 1500);
  assert.equal(f.controller.aim?.targetId, OTHER);
  assert.equal(f.controller.aim?.phase, "inrange");
  f.controller.handleCommand({ kind: "use", phase: "cancel" }, 1600);
  assert.equal(f.controller.aim, undefined);
  release(f, 1700);
  assert.equal(f.connection.of("use").length, 0);
});

test("a magnet locked on an opponent pulls the kart toward it", async () => {
  const f = controllerFixture();
  await holding(f, [5, -1]);
  f.poses.set(RIVAL, pose({ x: 1, y: 0, z: 40 }));
  press(f, 1000);
  at(f, 1000 + ITEM_RACE_TUNING.aimLockMs);
  release(f, 1700);
  const pull = f.physics.itemEffects.applied[0]!;
  assert.equal(pull.kind, "pull");
  assert.equal(pull.durationMs, 3000);
  assert.deepEqual((pull.options.target as () => unknown)(), { x: 1, y: 0, z: 40 });
  assert.deepEqual(f.connection.of("use"), [{ itemId: 5, targetId: RIVAL }]);
});

test("a rocket at me warns until it arrives, then launches the kart once", async () => {
  const f = controllerFixture();
  serve(f);
  at(f, 1000);
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 800 });
  at(f, 1200);
  assert.equal(f.controller.hudState(1200).warning, "rocket");
  at(f, 1799);
  assert.equal(f.connection.of("hit").length, 0);
  at(f, 1850);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry =>
    [entry.kind, entry.durationMs, entry.options.elapsedMs]), [["launch", 1500, 50]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 5, itemId: 7, result: "hit" }]);
  const hud = f.controller.hudState(1850);
  assert.equal(hud.warning, undefined);
  assert.deepEqual(hud.notices.map(notice => [notice.kind, notice.itemIdx, notice.text]),
    [["bad", 7, "对手"]]);
  assert.deepEqual(hud.log.map(row => [row.attacker, row.victim, row.itemIdx, row.failed, row.team]),
    [["对手", "我", 7, false, "solo"]]);
  const hit = f.presenter.of("hit")[0]![0] as Record<string, unknown>;
  assert.equal(hit.victimId, SELF);
  assert.equal(hit.result, "hit");
  at(f, 3000);
  assert.equal(f.connection.of("hit").length, 1);
  // A water fly warns with its own vignette.
  used(f, { useId: 6, itemId: ItemIdx.waterFly, targets: [SELF], startAt: server(3000), etaMs: 900 });
  at(f, 3100);
  assert.equal(f.controller.hudState(3100).warning, "waterfly");
});

test("shield, angel, EMP and escape immunity block the hits they cover", async () => {
  const f = controllerFixture({ teamRace: true });
  const state = await holding(f, [10, 12]);
  press(f, 1000);                                          // shield until 3000
  await settle();
  used(f, { useId: 1, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 300 });
  used(f, { useId: 2, itemId: ItemIdx.guideRocket, targets: [SELF], startAt: server(1000), etaMs: 400 });
  at(f, 1300);
  at(f, 1400);
  assert.deepEqual(f.connection.of("hit"), [
    { useId: 1, itemId: 7, result: "blocked", by: "shield" },
    { useId: 2, itemId: 33, result: "hit" },
  ]);
  assert.ok(f.presenter.calls.some(call => call[0] === "endKartEffect" && call[2] === "shield"));
  assert.deepEqual(f.controller.hudState(1400).log.map(row => [row.failed, row.team]),
    [[true, "blue"], [false, "blue"]]);
  // Neither a shield nor an angel stops the UFO.
  void state;
  press(f, 2000);
  used(f, { useId: 3, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(2000), etaMs: 500 });
  at(f, 2500);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 3, itemId: 3, result: "hit" });
  // A teammate's angel covers me against the thunderbolt but not the devil.
  used(f, { useId: 4, itemId: ItemIdx.angel, playerId: MATE, targets: [MATE, SELF],
    startAt: server(5000) });
  used(f, { useId: 5, itemId: ItemIdx.thunderbolt, targets: [SELF], startAt: server(5000) });
  used(f, { useId: 6, itemId: ItemIdx.devil, targets: [SELF], startAt: server(5000) });
  at(f, 6500);
  at(f, 7100);
  assert.deepEqual(f.connection.of("hit").slice(-2), [
    { useId: 6, itemId: 2, result: "hit" },
    { useId: 5, itemId: 111, result: "blocked", by: "angel" },
  ]);
  assert.deepEqual(f.physics.itemEffects.applied.at(-1)?.kind, "reverse");
  // Trapped or under the blue shield: everything is blocked by escape.
  f.physics.itemEffects.immune = true;
  used(f, { useId: 7, itemId: ItemIdx.cloud2, targets: [SELF], startAt: server(9000) });
  at(f, 9700);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 7, itemId: 114, result: "blocked", by: "escape" });
  assert.equal(f.controller.hudState(9700).cloud, undefined);
  // A reset holds the kart: the hit misses.
  f.physics.itemEffects.immune = false;
  f.state.suspended = true;
  used(f, { useId: 8, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(10000), etaMs: 300 });
  at(f, 10300);
  assert.deepEqual(f.connection.of("hit").at(-1), { useId: 8, itemId: 7, result: "blocked" });
});

test("devil, thunderbolt and UFO land on the Appendix B timeline", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 1, itemId: ItemIdx.devil, targets: [SELF, OTHER], startAt: server(1000) });
  used(f, { useId: 2, itemId: ItemIdx.thunderbolt, targets: [SELF], startAt: server(1000) });
  used(f, { useId: 3, itemId: ItemIdx.ufo, targets: [SELF], startAt: server(1000), etaMs: 1200 });
  const kinds = () => f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs]);
  at(f, 2199);
  assert.deepEqual(kinds(), []);
  at(f, 2200);
  assert.deepEqual(kinds(), [["slow", 3000]]);
  at(f, 2500);
  assert.deepEqual(kinds(), [["slow", 3000], ["reverse", 3000]]);
  at(f, 3100);
  assert.deepEqual(kinds(), [["slow", 3000], ["reverse", 3000], ["shrink", 1500]]);
});

test("a slot lock blocks every item but the angel for its window", async () => {
  const f = controllerFixture();
  await holding(f, [7, 11]);
  used(f, { useId: 4, itemId: ItemIdx.slotLock, targets: [SELF, OTHER], startAt: server(1000) });
  at(f, 2999);
  assert.equal(f.controller.hudState(2999).lock, undefined);
  at(f, 3000);
  assert.deepEqual(f.controller.hudState(3000).lock, { remainingMs: 3000 });
  assert.deepEqual(f.connection.of("hit"), [{ useId: 4, itemId: 110, result: "hit" }]);
  press(f, 3500);
  assert.equal(f.connection.of("use").length, 0);
  assert.equal(f.controller.aim, undefined);
  f.controller.handleCommand({ kind: "swap" }, 3600);
  await settle();
  assert.deepEqual(f.controller.hudState(3600).slots, [11, 7]);
  press(f, 3700);
  assert.deepEqual(f.connection.of("use"), [{ itemId: 11 }]);
  await settle();
  at(f, 6000);
  assert.equal(f.controller.hudState(6000).lock, undefined);
  press(f, 6100);
  const aim = (controller: typeof f.controller) => controller.aim;
  assert.equal(aim(f.controller)?.itemId, 7);
});

test("the cloud covers the screen from Use until Set ends", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 1000);
  used(f, { useId: 4, itemId: ItemIdx.cloud2, targets: [SELF], startAt: server(1000) });
  at(f, 1665);
  assert.equal(f.controller.hudState(1665).cloud, undefined);
  at(f, 1666);
  assert.deepEqual(f.controller.hudState(1666).cloud, { opacity: 1, variant: 0 });
  at(f, 11665);
  assert.ok(f.controller.hudState(11665).cloud);
  at(f, 11666);
  assert.equal(f.controller.hudState(11666).cloud, undefined);
});

test("the targeted leader places the barricade ahead on its route and can run into it", async () => {
  const f = controllerFixture();
  serve(f);
  f.state.route = { x: 2, y: 1, z: 70 };
  at(f, 1000);
  used(f, { useId: 9, itemId: ItemIdx.barricade, targets: [SELF], startAt: server(1000) });
  assert.deepEqual(f.connection.of("place"), [{ useId: 9, point: threeToClient({ x: 2, y: 1, z: 70 }) }]);
  const placed = f.presenter.of("placed")[0]![0] as Record<string, unknown>;
  assert.deepEqual(placed.point, { x: 2, y: 1, z: 70 });
  assert.equal(placed.startMs, 1000);
  f.physics.body.position = { x: 2, y: 1, z: 68 };
  at(f, 2265);
  assert.equal(f.connection.of("hit").length, 0, "still rising");
  at(f, 2266);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs]),
    [["barrier", 500]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 9, itemId: 113, result: "hit" }]);
  // Without a route sample the barricade lands straight ahead.
  const g = controllerFixture();
  serve(g);
  g.controller.options.local.routePointAhead = () => undefined;
  used(g, { useId: 3, itemId: ItemIdx.barricade, targets: [SELF], startAt: server(0) });
  assert.deepEqual(g.connection.of("place")[0]!.point, threeToClient({ x: 0, y: 0, z: 70 }));
});

test("other opponents meet a placed barricade; the user's teammates do not", () => {
  const f = controllerFixture({ teamRace: true });
  serve(f);
  at(f, 1000);
  used(f, { useId: 9, itemId: ItemIdx.barricade, playerId: RIVAL, targets: [MATE],
    startAt: server(1000) });
  assert.equal(f.connection.of("place").length, 0);
  f.connection.emit({ action: "placed", useId: 9, itemId: 113, playerId: RIVAL,
    point: threeToClient({ x: 0, y: 0, z: 3 }) });
  at(f, 3000);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 9, itemId: 113, result: "hit" }]);
  const g = controllerFixture({ teamRace: true });
  serve(g);
  used(g, { useId: 9, itemId: ItemIdx.barricade, playerId: MATE, targets: [RIVAL],
    startAt: server(1000) });
  g.connection.emit({ action: "placed", useId: 9, itemId: 113, playerId: MATE,
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(g, 3000);
  assert.equal(g.connection.of("hit").length, 0);
});

test("my time bomb counts down, explodes where I am and traps me too", async () => {
  const f = controllerFixture({ teamRace: true });
  await holding(f, [13, 11]);
  press(f, 1000);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "timeBomb", 1000, 3000]);
  assert.equal(f.controller.hudState(1500).timeBomb?.remainingMs, 2500);
  await settle();
  f.physics.body.position = { x: 5, y: 2, z: 9 };
  at(f, 3999);
  assert.equal(f.connection.of("place").length, 0);
  at(f, 4000);
  assert.deepEqual(f.connection.of("place"), [{ useId: 101, point: threeToClient({ x: 5, y: 2, z: 9 }) }]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 101, itemId: 13, result: "hit" }]);
  assert.equal(f.physics.itemEffects.applied[0]!.kind, "trap");
  assert.equal(f.controller.hudState(4000).timeBomb, undefined);
  // With an angel the bomb is blocked.
  const g = controllerFixture({ teamRace: true });
  const state = await holding(g, [13, 11]);
  press(g, 1000);
  await settle();
  state.targets = [SELF, MATE];
  press(g, 1100);
  await settle();
  at(g, 4000);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 101, itemId: 13, result: "blocked", by: "angel" }]);
});

test("someone else's time bomb traps everyone near its placed point, even a little late", () => {
  const f = controllerFixture({ teamRace: true });
  serve(f);
  at(f, 1000);
  used(f, { useId: 5, itemId: ItemIdx.timeBomb, playerId: MATE, startAt: server(1000) });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "timeBomb", 1000, 3000]);
  f.physics.body.position = { x: 10, y: 0, z: 0 };
  at(f, 4050);
  f.connection.emit({ action: "placed", useId: 5, itemId: 13, playerId: MATE,
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(f, 4100);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 5, itemId: 13, result: "hit" }]);
  // A placement that arrives after the window checks once within the grace.
  const g = controllerFixture();
  serve(g);
  used(g, { useId: 6, itemId: ItemIdx.timeBomb, startAt: server(1000) });
  g.state.now = 5200;
  g.connection.emit({ action: "placed", useId: 6, itemId: 13, playerId: RIVAL,
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(g, 5250);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 6, itemId: 13, result: "hit" }]);
  const h = controllerFixture();
  serve(h);
  used(h, { useId: 6, itemId: ItemIdx.timeBomb, startAt: server(1000) });
  h.state.now = 5600;
  h.connection.emit({ action: "placed", useId: 6, itemId: 13, playerId: RIVAL,
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(h, 5650);
  assert.equal(h.connection.of("hit").length, 0);
});

test("scan events show the opponents' slots until their end", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 1000);
  f.connection.emit({ action: "scan", playerId: RIVAL, slots: [7, -1], until: server(9000) });
  assert.deepEqual(f.controller.hudState(8999).scan, [{ playerId: RIVAL, slots: [7, -1] }]);
  assert.equal(f.controller.hudState(9000).scan, undefined);
});

test("track hazards hit the kart and are reported with their id", async () => {
  const f = controllerFixture();
  await holding(f, [10, -1]);
  at(f, 1000);
  f.controller.hazard({ id: 4, itemIdx: ItemIdx.mine, position: { x: 1, y: 0, z: 2 } });
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => [entry.kind, entry.durationMs]),
    [["launch", 1500]]);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 0, itemId: 17, result: "hit", hazardId: 4 }]);
  const hit = f.presenter.of("hit")[0]![0] as Record<string, unknown>;
  assert.deepEqual(hit.position, { x: 1, y: 0, z: 2 });
  assert.equal(f.controller.hudState(1000).log.length, 0);
  press(f, 1100);
  f.controller.hazard({ id: 5, itemIdx: ItemIdx.waterMine });
  assert.deepEqual(f.connection.of("hit").at(-1),
    { useId: 0, itemId: 37, result: "blocked", by: "shield", hazardId: 5 });
  f.controller.hazard({ id: 6, itemIdx: ItemIdx.banana });
  assert.deepEqual(f.physics.itemEffects.applied.at(-1)?.kind, "spin");
});

test("remote hits drive the presenter, the log and merged good notices", async () => {
  const f = controllerFixture({ teamRace: true });
  const state = await holding(f, [2, -1]);
  at(f, 1000);
  used(f, { useId: 30, itemId: ItemIdx.waterFly, playerId: RIVAL, targets: [MATE],
    startAt: server(1000), etaMs: 500 });
  f.state.now = 1600;
  f.poses.set(MATE, pose({ x: 3, y: 0, z: 3 }));
  f.connection.emit({ action: "hit", playerId: MATE, useId: 30, itemId: 4, userId: RIVAL,
    result: "hit" });
  const hit = f.presenter.of("hit")[0]![0] as Record<string, unknown>;
  assert.equal(hit.victimId, MATE);
  assert.deepEqual(hit.position, { x: 3, y: 0, z: 3 });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "trap", 1500, 1000]);
  // The blue shield starts when the bubble ends (or when the racer escapes early).
  at(f, 2500);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "escapeShield", 2500, 2000]);
  f.state.now = 1600;
  assert.deepEqual(f.controller.hudState(1600).log.map(row =>
    [row.attacker, row.victim, row.itemIdx, row.failed, row.team]), [["对手", "队友", 4, false, "blue"]]);
  // A banana run over by someone else disappears.
  used(f, { useId: 31, itemId: ItemIdx.banana, playerId: OTHER, startAt: server(1600),
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 31, itemId: 8, userId: OTHER,
    result: "blocked", by: "shield", removed: true });
  assert.deepEqual(f.presenter.of("removed"), [[31]]);
  assert.deepEqual(f.presenter.of("endKartEffect").at(-1), [RIVAL, "shield"]);
  assert.equal(f.controller.areas.has(31), false);
  // My devil hits two opponents: one merged good notice.
  state.targets = [RIVAL, OTHER];
  press(f, 2000);
  await settle();
  f.state.now = 3500;
  f.connection.emit({ action: "hit", playerId: RIVAL, useId: 101, itemId: 2, userId: SELF, result: "hit" });
  f.state.now = 3600;
  f.connection.emit({ action: "hit", playerId: OTHER, useId: 101, itemId: 2, userId: SELF, result: "hit" });
  const good = f.controller.hudState(3600).notices.filter(notice => notice.kind === "good");
  assert.deepEqual(good.map(notice => [notice.itemIdx, notice.text, notice.at]), [[2, "对手 等2人", 3500]]);
  assert.deepEqual(f.presenter.of("kartEffect").slice(-2),
    [[RIVAL, "reverse", 3500, 3000], [OTHER, "reverse", 3500, 3000]]);
  // Remote self-buffs; an EMP with nobody under a UFO does nothing (C.1).
  used(f, { useId: 40, itemId: ItemIdx.shield, playerId: RIVAL, startAt: server(4000) });
  assert.deepEqual(f.presenter.calls.at(-1)!.slice(0, 3), ["kartEffect", RIVAL, "shield"]);
  used(f, { useId: 41, itemId: ItemIdx.emp, playerId: OTHER, targets: [OTHER, RIVAL], startAt: server(4000) });
  at(f, 4600);
  assert.deepEqual(f.presenter.calls.filter(call => call[0] !== "update").at(-1)!.slice(0, 2),
    ["used", { useId: 41, itemId: 12, userId: OTHER, targets: [OTHER, RIVAL], startMs: 4000, etaMs: 0 }]);
  assert.equal(f.presenter.of("kartEffect").filter(call => call[1] === "emp").length, 0);
});

test("Alt swaps the first two slots with the reorder animation and the changer sound", async () => {
  const f = controllerFixture();
  await holding(f, [7, 10]);
  f.controller.handleCommand({ kind: "swap" }, 1000);
  assert.equal(f.connection.of("swap").length, 1);
  assert.deepEqual(f.controller.hudState(1000).slots, [10, 7]);
  assert.equal(f.controller.hudState(1000).reorderProgress, 0);
  assert.equal(f.controller.hudState(1175).reorderProgress, 0.5);
  assert.equal(f.controller.hudState(1350).reorderProgress, undefined);
  assert.equal(f.controller.consumeSlotChangerSound(), true);
  assert.equal(f.controller.consumeSlotChangerSound(), false);
  await settle();
  assert.deepEqual(f.controller.hudState(1400).slots, [10, 7]);
  // One item: nothing to swap.
  const g = controllerFixture();
  await holding(g, [7, -1]);
  g.controller.handleCommand({ kind: "swap" }, 1000);
  assert.equal(g.connection.of("swap").length, 0);
});

test("Z redraws slot 0 once per new item and follows the server's changers (C.6)", async () => {
  const f = controllerFixture();
  const state = await holding(f, [7, 10]);
  state.changers = { slot: 3, item: 2, itemArmed: true };
  f.controller.cube(2);
  await settle();
  assert.deepEqual(f.controller.hudState(1000).changers, { slot: 3, item: 2, slotUsable: true, itemUsable: true });
  f.controller.handleCommand({ kind: "change" }, 1000);
  assert.deepEqual(f.connection.of("change"), [{}]);
  assert.equal(f.controller.consumeSlotChangerSound(), true);
  // In flight: one card less, no second change, no use, no swap.
  assert.deepEqual(f.controller.hudState(1000).changers, { slot: 3, item: 1, slotUsable: true, itemUsable: false });
  f.controller.handleCommand({ kind: "change" }, 1001);
  press(f, 1001);
  f.controller.handleCommand({ kind: "swap" }, 1001);
  assert.equal(f.connection.of("change").length, 1);
  assert.equal(f.connection.of("use").length, 0);
  assert.equal(f.connection.of("swap").length, 0);
  await settle();
  assert.deepEqual(f.controller.hudState(1100).slots, [6, 10]);
  assert.deepEqual(f.controller.hudState(1100).infoCard, { itemIdx: 6 });
  // Changed once: Z waits for the next new item.
  assert.deepEqual(f.controller.hudState(1100).changers, { slot: 3, item: 1, slotUsable: true, itemUsable: false });
  f.controller.handleCommand({ kind: "change" }, 1200);
  assert.equal(f.connection.of("change").length, 1);
  assert.equal(f.controller.consumeStatusMessage(), undefined);
  // A new item re-arms it.
  f.controller.cube(3);
  await settle();
  assert.equal(f.controller.hudState(1300).changers?.itemUsable, true);
  // A slot lock blocks Z (but not Alt).
  used(f, { useId: 4, itemId: ItemIdx.slotLock, targets: [SELF], startAt: server(1000) });
  at(f, 3000);
  assert.deepEqual(f.controller.hudState(3000).changers, { slot: 3, item: 1, slotUsable: true, itemUsable: false });
  f.controller.handleCommand({ kind: "change" }, 3000);
  assert.equal(f.connection.of("change").length, 1);
  // A refused change keeps the item and the card.
  at(f, 7000);
  state.reject = "ITEM_CHANGER_UNAVAILABLE";
  f.controller.handleCommand({ kind: "change" }, 7000);
  await settle();
  assert.equal(f.connection.of("change").length, 2);
  assert.deepEqual(f.controller.hudState(7000).slots, [6, 10]);
  assert.equal(f.controller.hudState(7000).changers?.item, 1);
  assert.ok(f.logs.some(entry => String(entry).includes("ITEM_CHANGER_UNAVAILABLE")));
});

test("Alt needs a card or a voucher; cards in flight count, a voucher shows ∞", async () => {
  const f = controllerFixture();
  const state = await holding(f, [7, 10]);
  state.changers = { slot: 1, item: 0, itemArmed: true };
  f.controller.cube(2);
  await settle();
  assert.deepEqual(f.controller.hudState(0).changers, { slot: 1, item: 0, slotUsable: true, itemUsable: false });
  f.controller.handleCommand({ kind: "swap" }, 100);
  f.controller.handleCommand({ kind: "swap" }, 101);
  assert.equal(f.connection.of("swap").length, 1, "one card, one swap");
  assert.deepEqual(f.controller.hudState(101).changers, { slot: 0, item: 0, slotUsable: false, itemUsable: false });
  await settle();
  assert.deepEqual(f.controller.hudState(500).slots, [10, 7]);
  f.controller.handleCommand({ kind: "swap" }, 600);
  assert.equal(f.connection.of("swap").length, 1);
  // A voucher: unlimited, shown as ∞; the legacy fields mirror the rows.
  state.changers = { slot: -1, item: -1, itemArmed: false };
  f.controller.cube(3);
  await settle();
  const hud = f.controller.hudState(700);
  assert.deepEqual(hud.changers, { slot: "infinite", item: "infinite", slotUsable: true, itemUsable: true });
  assert.equal(hud.slotChanger, "infinite");
  assert.equal(hud.itemChanger, "infinite");
  for (let index = 0; index < 3; index++) f.controller.handleCommand({ kind: "swap" }, 800 + index);
  assert.deepEqual(f.controller.hudState(803).slots, [7, 10]);
  await settle();
  assert.equal(f.connection.of("swap").length, 4);
  assert.deepEqual(f.controller.hudState(900).slots, [7, 10]);
  assert.equal(f.controller.hudState(900).changers?.slot, "infinite");
});

test("no item actions before the start, after the finish or while held", async () => {
  const f = controllerFixture();
  f.state.racing = false;
  f.controller.cube(1);
  assert.equal(f.connection.sent.length, 0);
  f.state.racing = true;
  await holding(f, [7, 6]);
  f.physics.itemEffects.canUseItem = false;
  press(f, 900);
  assert.equal(f.controller.aim, undefined);
  f.physics.itemEffects.canUseItem = true;
  f.state.suspended = true;
  press(f, 950);
  assert.equal(f.controller.aim, undefined);
  f.state.suspended = false;
  at(f, 1000);
  f.poses.set(RIVAL, pose({ x: 0, y: 0, z: 30 }));
  press(f, 1000);
  assert.ok(f.controller.aim);
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 900 });
  used(f, { useId: 6, itemId: ItemIdx.banana, startAt: server(1000), point: { x: 0, y: 0, z: 0 } });
  f.state.racing = false;
  at(f, 1100);
  assert.equal(f.controller.ended, true);
  assert.equal(f.controller.aim, undefined);
  assert.equal(f.controller.incoming.size, 0);
  assert.equal(f.controller.areas.size, 0);
  assert.deepEqual(f.presenter.of("stopSound").at(-1), ["item-aim"]);
  at(f, 3000);
  press(f, 3000);
  f.controller.cube(2);
  f.controller.hazard({ id: 1, itemIdx: ItemIdx.mine });
  assert.equal(f.connection.sent.filter(request => request.action !== "cube").length, 0);
  assert.equal(f.connection.of("cube").length, 1);
  // Remote events still reach the presenter after my finish.
  used(f, { useId: 7, itemId: ItemIdx.rocket, targets: [OTHER], startAt: server(3000), etaMs: 500 });
  assert.equal(f.presenter.of("used").length, 3);
  f.controller.dispose();
  assert.equal(f.connection.unsubscribed, true);
  f.controller.handleCommand({ kind: "swap" }, 4000);
  f.controller.update(4000);
});

test("local physics effects and the blue shield reach the presenter", () => {
  const f = controllerFixture();
  const effects = f.physics.itemEffects;
  effects.clockMs = 5000;
  effects.effects.set("trap", { startMs: 4900, endMs: 6900 });
  effects.events.push({ kind: "trap", phase: "start", atMs: 5000 });
  at(f, 2000);
  assert.deepEqual(f.presenter.of("kartEffect"), [[SELF, "trap", 1900, 2000]]);
  effects.events.push({ kind: "trap", phase: "end", atMs: 6900, reason: "expired" });
  effects.escapeShieldRemainingMs = 2000;
  at(f, 4000);
  assert.deepEqual(f.presenter.of("endKartEffect"), [[SELF, "trap"]]);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "escapeShield", 4000, 2000]);
  effects.escapeShieldRemainingMs = 0;
  at(f, 6000);
  assert.deepEqual(f.presenter.of("endKartEffect").at(-1), [SELF, "escapeShield"]);
});

test("a throwing presenter, physics or connection never reaches the race loop", async () => {
  const f = controllerFixture();
  await holding(f, [6, 7]);
  for (const method of ["used", "hit", "kartEffect", "update", "sound", "placed"] as const) {
    (f.presenter as unknown as Record<string, unknown>)[method] = () => { throw new Error("boom"); };
  }
  f.physics.setItemSlots = () => { throw new Error("slots"); };
  f.controller.options.connection.sendItem = () => { throw new Error("sync"); };
  assert.doesNotThrow(() => {
    press(f, 1000);
    used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 300 });
    at(f, 1400);
    f.controller.present({ nowMs: 1400, camera: undefined, width: 1, height: 1 });
    f.controller.hazard({ id: 1, itemIdx: ItemIdx.banana });
    f.connection.emit({ action: "hit", playerId: RIVAL, useId: 3, itemId: 7, userId: OTHER, result: "hit" });
  });
  await settle();
  assert.ok(f.logs.length > 0);
  // Without a presenter everything else still works.
  const g = controllerFixture({ presenter: false });
  await holding(g, [6, -1]);
  press(g, 1000);
  assert.equal(g.physics.boosters, 1);
});

test("reset forgets every transient state and the presenter's visuals", async () => {
  const f = controllerFixture();
  await holding(f, [7, 10]);
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(0), etaMs: 900 });
  f.connection.emit({ action: "scan", playerId: RIVAL, slots: [7, -1], until: server(9000) });
  f.controller.reset();
  assert.equal(f.controller.incoming.size, 0);
  assert.equal(f.controller.scans.size, 0);
  assert.deepEqual(f.controller.hudState(0).slots, [-1, -1]);
  assert.deepEqual(f.physics.slotsSet.at(-1), [-1, -1]);
  assert.deepEqual(f.presenter.calls.at(-1), ["reset"]);
});

// ---- regressions from the item race review ----

test("a refused booster is taken back and the item cannot boost twice", async () => {
  const f = controllerFixture();
  const state = await holding(f, [6, -1]);
  state.reject = "ITEM_LOCKED";
  press(f, 1000);
  assert.equal(f.physics.boosters, 1, "the boost starts on the key press");
  await settle();
  assert.equal(f.physics.cancelledBoosters, 1);
  assert.deepEqual(f.controller.hudState(1000).slots, [6, -1]);
  assert.equal(f.connection.of("slots").length, 0, "a slot lock leaves the slots in sync");
  state.reject = undefined;
  press(f, 6000);
  await settle();
  assert.equal(f.physics.boosters, 2);
  assert.equal(f.physics.cancelledBoosters, 1);
  assert.deepEqual(f.controller.hudState(6000).slots, [-1, -1]);
});

test("a refused shield or magnet stops covering and pulling the kart", async () => {
  const f = controllerFixture();
  const state = await holding(f, [10, 12]);
  state.reject = "ITEM_LOCKED";
  press(f, 1000);
  assert.equal(f.controller.shieldUntil, 3000);
  await settle();
  assert.equal(f.controller.shieldUntil, 0);
  assert.deepEqual(f.presenter.of("endKartEffect").at(-1), [SELF, "shield"]);
  state.reject = undefined;
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 300 });
  at(f, 1300);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 5, itemId: 7, result: "hit" }]);


  // Magnet aimed at a racer the server says is no longer racing.
  const g = controllerFixture();
  const magnet = await holding(g, [5, -1]);
  g.poses.set(RIVAL, pose({ x: 0, y: 0, z: 40 }));
  press(g, 1000);
  at(g, 1000 + ITEM_RACE_TUNING.aimLockMs);
  magnet.reject = "INVALID_TARGET";
  release(g, 1700);
  assert.equal(g.physics.itemEffects.applied.at(-1)?.kind, "pull");
  await settle();
  assert.deepEqual(g.physics.itemEffects.ended, ["pull"]);
  assert.deepEqual(g.controller.hudState(1700).slots, [5, -1]);
});

test("a refused angel ends only my own window; a teammate's angel still covers me", async () => {
  const f = controllerFixture({ teamRace: true });
  const state = await holding(f, [11, -1]);
  at(f, 500);
  // The teammate's angel covers me from 0 to 4000.
  used(f, { useId: 4, itemId: ItemIdx.angel, playerId: MATE, targets: [MATE, SELF], startAt: server(0) });
  state.reject = "ITEM_LOCKED";
  press(f, 1000);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "angel", 1500, 4000]);
  await settle();
  // The visual goes back to the teammate's window (500..4500).
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [SELF, "angel", 500, 4000]);
  state.reject = undefined;
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(3000), etaMs: 500 });
  used(f, { useId: 6, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(4000), etaMs: 500 });
  at(f, 3500);
  at(f, 4500);
  assert.deepEqual(f.connection.of("hit"), [
    { useId: 5, itemId: 7, result: "blocked", by: "angel" },
    { useId: 6, itemId: 7, result: "hit" },
  ]);

  // Without another angel, the refused one's visual ends.
  const g = controllerFixture({ teamRace: true });
  const solo = await holding(g, [11, -1]);
  solo.reject = "ITEM_LOCKED";
  press(g, 1000);
  await settle();
  assert.deepEqual(g.presenter.of("endKartEffect").at(-1), [SELF, "angel"]);
});

test("after ITEM_NOT_HELD the controller asks the server for its slots", async () => {
  const f = controllerFixture();
  const state = await holding(f, [6, 10]);
  // The server already spent the booster (its reply never arrived here).
  state.slots = [10, -1];
  press(f, 1000);
  await settle();
  assert.equal(f.physics.cancelledBoosters, 1);
  assert.equal(f.connection.of("slots").length, 1);
  assert.deepEqual(f.controller.hudState(1000).slots, [10, -1]);
  // The next press uses what the server really holds.
  press(f, 1100);
  await settle();
  assert.deepEqual(f.connection.of("use").at(-1), { itemId: 10 });
  assert.deepEqual(f.controller.hudState(1100).slots, [-1, -1]);
  assert.equal(f.connection.of("slots").length, 1);
});

test("two time bombs used close together both explode where I am", async () => {
  const f = controllerFixture({ teamRace: true });
  await holding(f, [13, 13]);
  press(f, 1000);
  await settle();
  press(f, 1200);
  await settle();
  assert.equal(f.controller.hudState(1200).timeBomb?.remainingMs, 2800, "the first to explode");
  f.physics.body.position = { x: 5, y: 0, z: 0 };
  at(f, 4000);
  assert.deepEqual(f.connection.of("place").map(place => place.useId), [101]);
  assert.equal(f.controller.hudState(4000).timeBomb?.remainingMs, 200);
  f.physics.body.position = { x: 50, y: 0, z: 0 };
  at(f, 4200);
  assert.deepEqual(f.connection.of("place"), [
    { useId: 101, point: threeToClient({ x: 5, y: 0, z: 0 }) },
    { useId: 102, point: threeToClient({ x: 50, y: 0, z: 0 }) },
  ]);
  assert.equal(f.controller.hudState(4200).timeBomb, undefined);

  // Both replies after both presses: each use still gets its own place.
  const g = controllerFixture({ teamRace: true });
  const state = await holding(g, [13, 13]);
  const replies: Array<() => void> = [];
  const answer = g.connection.reply;
  g.connection.reply = request => request.action !== "use" ? answer(request)
    : new Promise(resolve => { const reply = answer(request); replies.push(() => resolve(reply)); });
  press(g, 1000);
  press(g, 1200);
  for (const reply of replies.splice(0)) reply();
  await settle();
  void state;
  at(g, 4000);
  at(g, 4200);
  assert.deepEqual(g.connection.of("place").map(place => place.useId), [101, 102]);
  // A refused second bomb leaves the first one in place.
  const h = controllerFixture({ teamRace: true });
  const hs = await holding(h, [13, 13]);
  press(h, 1000);
  await settle();
  hs.reject = "ITEM_LOCKED";
  press(h, 1200);
  await settle();
  assert.deepEqual(h.presenter.of("kartEffect").at(-1), [SELF, "timeBomb", 1200, 2800]);
  hs.reject = undefined;
  at(h, 4000);
  assert.deepEqual(h.connection.of("place").map(place => place.useId), [101]);
});

test("a fast kart or a long frame cannot step over a banana", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 60, itemId: ItemIdx.banana, startAt: server(0),
    point: threeToClient({ x: 0, y: 0, z: 100 }) });
  used(f, { useId: 61, itemId: ItemIdx.banana, startAt: server(0),
    point: threeToClient({ x: 0, y: 0, z: 300 }) });
  // 200 km/h through a 100 ms frame: both samples outside the 2 m radius.
  f.physics.body.position = { x: 0, y: 0, z: 97.2 };
  at(f, 1100);
  assert.equal(f.connection.of("hit").length, 0);
  f.physics.body.position = { x: 0, y: 0, z: 102.8 };
  at(f, 1200);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 60, itemId: 8, result: "hit" }]);
  // A reset or warp jump is not a drive: the banana it passes is not hit.
  f.physics.body.position = { x: 0, y: 0, z: 290 };
  at(f, 3200);
  f.physics.body.position = { x: 0, y: 0, z: 310 };
  at(f, 3216);
  assert.equal(f.connection.of("hit").length, 1);
});

test("a spin or barricade the held kart cannot take is not reported; the banana stays", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 7, itemId: ItemIdx.banana, startAt: server(0),
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  // Launched by a rocket (held at its anchor): the kart cannot spin.
  f.physics.itemEffects.refuse.add("spin");
  at(f, 600);
  at(f, 700);
  assert.deepEqual(f.physics.itemEffects.refused, ["spin", "spin"]);
  assert.equal(f.connection.of("hit").length, 0);
  assert.equal(f.presenter.of("hit").length, 0);
  assert.equal(f.controller.hudState(700).notices.length, 0);
  assert.ok(f.controller.areas.has(7));
  // Released while still on the banana: it spins now, once.
  f.physics.itemEffects.refuse.clear();
  at(f, 800);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 7, itemId: 8, result: "hit" }]);
  assert.deepEqual(f.physics.itemEffects.applied.map(entry => entry.kind), ["spin"]);
  at(f, 900);
  assert.equal(f.connection.of("hit").length, 1);

  // A targeted hit the kart cannot take any more is reported as not landed.
  const g = controllerFixture();
  serve(g);
  at(g, 0);
  g.physics.itemEffects.refuse.add("launch");
  used(g, { useId: 8, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(0), etaMs: 300 });
  at(g, 300);
  assert.deepEqual(g.connection.of("hit"), [{ useId: 8, itemId: 7, result: "blocked" }]);
  const hit = g.presenter.of("hit")[0]![0] as Record<string, unknown>;
  assert.equal(hit.result, "blocked");
  assert.equal(g.controller.hudState(300).notices.length, 0);
  // A track banana the kart cannot take is not reported at all.
  g.physics.itemEffects.refuse.add("spin");
  g.controller.hazard({ id: 3, itemIdx: ItemIdx.banana });
  assert.equal(g.connection.of("hit").length, 1);
});

test("my early escape from a bubble is reported once", async () => {
  const f = controllerFixture();
  serve(f);
  at(f, 0);
  used(f, { useId: 21, itemId: ItemIdx.waterBomb, startAt: server(0),
    point: threeToClient({ x: 0, y: 0, z: 0 }) });
  at(f, 1000);
  assert.deepEqual(f.connection.of("hit"), [{ useId: 21, itemId: 9, result: "hit" }]);
  const effects = f.physics.itemEffects;
  effects.events.push({ kind: "trap", phase: "end", atMs: 1500, reason: "escaped" });
  at(f, 1500);
  assert.deepEqual(f.connection.of("escape"), [{ useId: 21 }]);
  effects.events.push({ kind: "trap", phase: "end", atMs: 1600, reason: "escaped" });
  at(f, 1600);
  assert.equal(f.connection.of("escape").length, 1);
  // A bubble that simply runs out is not an escape; a water mine escapes with its hazard id.
  f.controller.hazard({ id: 5, itemIdx: ItemIdx.waterMine });
  effects.events.push({ kind: "trap", phase: "end", atMs: 3600, reason: "expired" });
  at(f, 3600);
  assert.equal(f.connection.of("escape").length, 1);
  effects.immune = false;
  f.controller.hazard({ id: 6, itemIdx: ItemIdx.waterMine });
  effects.events.push({ kind: "trap", phase: "end", atMs: 4200, reason: "escaped" });
  at(f, 4200);
  assert.deepEqual(f.connection.of("escape").at(-1), { useId: 0, hazardId: 6 });
});

test("a remote racer's early escape ends its bubble and starts its blue shield then", () => {
  const f = controllerFixture({ teamRace: true });
  serve(f);
  at(f, 1000);
  used(f, { useId: 30, itemId: ItemIdx.waterFly, playerId: RIVAL, targets: [MATE],
    startAt: server(1000), etaMs: 500 });
  f.state.now = 1500;
  f.connection.emit({ action: "hit", playerId: MATE, useId: 30, itemId: 4, userId: RIVAL, result: "hit" });
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "trap", 1500, 1000]);
  f.state.now = 2000;
  f.connection.emit({ action: "escaped", playerId: MATE, useId: 30, itemId: 4 });
  assert.deepEqual(f.presenter.of("endKartEffect").at(-1), [MATE, "trap"]);
  assert.deepEqual(f.presenter.of("kartEffect").at(-1), [MATE, "escapeShield", 2000, 2000]);
  at(f, 2600);
  assert.equal(f.presenter.of("kartEffect").filter(call => call[1] === "escapeShield").length, 1);

  // Without an escape the blue shield starts when the bubble ends.
  const g = controllerFixture();
  serve(g);
  at(g, 1000);
  g.state.now = 1200;
  g.connection.emit({ action: "hit", playerId: OTHER, useId: 0, itemId: ItemIdx.waterMine, result: "hit",
    hazardId: 4 });
  assert.deepEqual(g.presenter.of("kartEffect").at(-1), [OTHER, "trap", 1200, 2000]);
  at(g, 3199);
  assert.equal(g.presenter.of("kartEffect").length, 1);
  at(g, 3216);
  assert.deepEqual(g.presenter.of("kartEffect").at(-1), [OTHER, "escapeShield", 3200, 2000]);
  // A late escape changes nothing.
  g.state.now = 3300;
  g.connection.emit({ action: "escaped", playerId: OTHER, useId: 0, itemId: ItemIdx.waterMine, hazardId: 4 });
  assert.equal(g.presenter.of("kartEffect").length, 2);
  assert.equal(g.presenter.of("endKartEffect").length, 0);
});

test("a cloud still on its way when I finish never covers me, so the presenter drops it", () => {
  const f = controllerFixture();
  serve(f);
  at(f, 1000);
  used(f, { useId: 4, itemId: ItemIdx.cloud2, targets: [SELF], startAt: server(1000) });
  used(f, { useId: 5, itemId: ItemIdx.rocket, targets: [SELF], startAt: server(1000), etaMs: 900 });
  f.state.racing = false;
  at(f, 1300);
  const hits = f.presenter.of("hit").map(call => call[0] as Record<string, unknown>);
  assert.deepEqual(hits.map(hit => [hit.useId, hit.victimId, hit.result, hit.by]),
    [[4, SELF, "blocked", undefined]]);
  assert.equal(f.connection.of("hit").length, 0, "nothing is reported after the finish");
});
