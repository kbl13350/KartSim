import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { ActiveRaceCoordinator } from "../src/multiplayer/active-race-coordinator.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "ClassDeclaration" && item.id.name === "Ui0");
assert.ok(node);
const originalClass = release.slice(node.start, node.end);

function fixture(failure) {
  const log = [];
  let gaugeCallback;
  class Presentation { constructor() { log.push(["presentation"]); } }
  class Slipstream {
    constructor() { log.push(["slipstream"]); this.presentationVisible = true; this.hudActive = false; }
  }
  class Framerate {
    constructor(enabled, opponents, fps) { log.push(["framerate", enabled, opponents, fps]); }
    dispose() { log.push(["framerateDispose"]); }
  }
  class Local {
    constructor(_assets, _room, playerId) {
      log.push(["local", playerId]);
      this.physics = { enqueueMultiplayerTeamTarget(target) { log.push(["teamTarget", target]); } };
      this.giant = undefined;
    }
    queueRemoteKart(virtualKart, collide) {
      log.push(["queue", virtualKart.name]);
      this.virtualKart = virtualKart;
      this.collide = collide;
    }
    raceProgress() { return 12; }
    dispose() { log.push(["localDispose"]); }
  }
  class Cadence {
    constructor(_room, playerId) { log.push(["cadence", playerId]); }
    dispose() { log.push(["cadenceDispose"]); }
  }
  class Remotes {
    constructor(_assets, _connection, _now, _fail, _cadence) { log.push(["remotes"]); }
    updateGiantEffects(time) { log.push(["remoteGiant", time]); }
    raceProgress() { return 20; }
  }
  const resolveRemoteCollision = (_physics, _remotes, balance, hit) => {
    log.push(["collision", balance, hit]); return 7;
  };
  const deps = {
    normalizeRp: rp => { log.push(["rp", rp.id]); return `rp:${rp.id}`; },
    createCollisionFramerate: (...args) => new Framerate(...args),
    createLocal: (...args) => new Local(...args),
    createCadence: (...args) => new Cadence(...args),
    createRemotes: (...args) => new Remotes(...args),
    resolveRemoteCollision,
    createPresentation: () => new Presentation(),
    createSlipstream: () => new Slipstream(),
    bindClock: () => {}, scheduleStart: () => {}, updateRoom: () => {},
    updateFrame: () => {}, updateRemoteViews: () => {}, roadblockRemaining: () => {},
    dispose: () => {},
  };
  const Original = new Function("I40", "fE", "mI", "Ni0", "Ci0", "Vi0", "Bi0", "Di0",
    `${originalClass}\nreturn Ui0;`)(
      Presentation, Slipstream, deps.normalizeRp, Framerate, Local, Cadence,
      Remotes, resolveRemoteCollision,
    );
  const assets = {
    channel: { name: failure === "channel" ? "wrong" : "match", adjustCollision: true },
    checkClientFramerate: true, mode: "team", speed: 1,
    participants: [{ playerId: "self", collisionBalance: 9 }, { playerId: "rival" }],
    dispose() { log.push(["assetsDispose"]); },
  };
  const room = {
    channelName: "match", roster: [{ playerId: "self", team: 2 }],
    rp: { id: 3 }, roadblock: { runnerId: "rival" }, lte: { id: 4 }, giant: { id: 5 },
  };
  const connection = {
    playerId: "self", sendTeamCharge: failure === "team" ? undefined : () => {},
    subscribeTeamGauge(callback) { gaugeCallback = callback; log.push(["subscribe"]);
      return () => log.push(["unsubscribe"]); },
    latencyMs: input => input + 1,
  };
  return { log, deps, Original, assets, room, connection,
    gauge: event => gaugeCallback?.(event) };
}

function exercise(rewritten, failure) {
  const { log, deps, Original, assets, room, connection, gauge } = fixture(failure);
  let owner;
  try {
    owner = rewritten
      ? new ActiveRaceCoordinator(assets, room, connection, () => 10, () => {}, 60, deps)
      : new Original(assets, room, connection, () => 10, () => {}, 60);
  } catch (error) {
    return { error: error.message, log };
  }
  owner.room = { phase: "racing", race: { results: [1], finishes: [2] } };
  gauge({ team: 2, sequence: 1, target: 40 });
  gauge({ team: 2, sequence: 1, target: 50 });
  owner.remoteFrameUpdated = true;
  owner.local.virtualKart.slot12(20);
  const collision = owner.local.collide("hit");
  return {
    fields: {
      rp: owner.rpIdentity, roadblock: owner.roadblockIdentity,
      lte: owner.lteIdentity, giant: owner.giantIdentity,
      teamSequence: owner.teamSequence, collision,
      raceSnapshot: owner.raceSnapshot(), resultSnapshot: owner.resultSnapshot(),
      finishSnapshot: owner.finishSnapshot(), runner: owner.roadBlockRunnerProgress(),
      latency: owner.latencyMs(4), giantEffectsEnded: owner.giantEffectsEnded,
      draft: owner.draftPresentationVisible("self"),
      localHud: owner.localDraftHudActive(),
    },
    log,
  };
}

test("active race coordinator construction, team gauge and remote collision match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});

test("active race coordinator constructor cleanup matches release", () => {
  for (const failure of ["channel", "team"])
    assert.deepEqual(exercise(true, failure), exercise(false, failure), failure);
});

test("an item team race freezes race.item and needs no team gauge channel", () => {
  const { log, deps, assets, room, connection } = fixture();
  assets.speed = 7;
  assets.drivingMode = Object.freeze({ kind: "item", team: true });
  room.item = { ruleset: "web-item-v1", table: "team", extra: 1 };
  delete connection.sendTeamCharge;
  delete connection.subscribeTeamGauge;
  // The item race needs the item channel and the item catalog.
  assert.throws(() => new ActiveRaceCoordinator(assets, room, connection, () => 10, () => {},
    60, deps), /道具赛通道/);
  connection.sendItem = async () => ({});
  connection.subscribeItem = () => { log.push(["subscribeItem"]); return () => log.push(["offItem"]); };
  assets.itemCatalog = { get: () => undefined };
  const owner = new ActiveRaceCoordinator(assets, room, connection, () => 10, () => {}, 60, deps);
  assert.deepEqual(owner.itemIdentity, { ruleset: "web-item-v1", table: "team" });
  assert.ok(Object.isFrozen(owner.itemIdentity));
  assert.equal(owner.offTeam, undefined);
  assert.ok(!log.some(entry => entry[0] === "subscribe"));
  assert.ok(owner.itemRace);
  assert.equal(owner.local.items, owner.itemRace);
  assert.equal(owner.local.itemRace, owner.itemRace);
  assert.ok(log.some(entry => entry[0] === "subscribeItem"));
  // A speed team race at standard speed still requires it.
  const speed = fixture("team");
  speed.assets.speed = 7;
  assert.throws(() => new ActiveRaceCoordinator(speed.assets, speed.room, speed.connection,
    () => 10, () => {}, 60, speed.deps), /组队集气/);
});
