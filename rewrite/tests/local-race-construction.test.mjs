import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { initializeLocalRace } from "../src/multiplayer/local-race-construction.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const originalClass = parse(release, { sourceType: "module" }).program.body
  .find(node => node.id?.name === "Ci0");
assert.ok(originalClass);
const constructor = originalClass.body.body.find(member =>
  member.key?.name === "constructor");
assert.ok(constructor);
const constructorBody = release.slice(constructor.body.start + 1,
  constructor.body.end - 1);

function run(kind, options = {}) {
  const calls = [];
  class Lte { constructor() { this.motion = "lte motion"; calls.push("lte created"); } }
  class Giant {
    constructor(_active, compensate) {
      this.compensate = compensate;
      calls.push("giant created");
    }
  }
  class Physics {
    constructor(...args) {
      calls.push(["physics created", args.slice(2)]);
      this.body = {
        position: { x: 1, y: 2, z: 3 },
        right: { x: 1, y: 0, z: 0 },
        forward: { x: 0, y: 0, z: 1 },
        up: { x: 0, y: 1, z: 0 },
      };
      this.state = {};
    }
    resetFromRouteFrame(frame) { calls.push(["reset", frame]); }
    setRaceMotionLocked(value) { calls.push(["motion lock", value]); }
    compensateGiantBooster() { calls.push("giant booster"); }
  }
  class Track {
    constructor(...args) { calls.push(["track created", args.length]); }
    group = { add: object => calls.push(["group add", object]) };
    getStart() { return "start frame"; }
    rayQuery() { calls.push("ray"); return { point: { x: 10, y: 0, z: 0 } }; }
    resetRouteState(_physics, position) {
      calls.push(["route reset", position.x]);
    }
    currentRouteSurface() { return "lensflare"; }
    setLensFlareEnabled(enabled) { calls.push(["flare", enabled]); }
    getRouteState() { return { distance: 12.5 }; }
  }
  class Coordinator {
    constructor(_admission, _track, _physics, onTag) {
      calls.push("coordinator created");
      this.onTag = onTag;
    }
  }
  const validate = () => calls.push("start slots validated");
  const hasLte = value => !!value;
  const validRp = value => !!value;
  const sameRp = (left, right) => left?.id === right?.id;
  const hasGiant = value => !!value;
  const place = (_position, _right, slot, ray) => {
    calls.push(["place", slot]);
    return ray({}, {});
  };
  const ops = {
    validateStartSlots: validate, hasLteMode: hasLte,
    validRpDraws: validRp, sameRp, hasGiantMode: hasGiant,
    makeLte: () => new Lte(),
    makeGiant: callback => new Giant(true, callback),
    makePhysics: (...args) => new Physics(...args),
    makeTrack: (...args) => new Track(...args),
    placeAtStart: place,
    makeCoordinator: (...args) => new Coordinator(...args),
    racingState: "Racing",
  };
  const Original = new Function("deps", `with (deps) {
    return function(e,t,i) { ${constructorBody} };
  }`)({
    iL: validate, ko: hasLte, ba: validRp, t7: sameRp, Io: hasGiant,
    D40: Lte, pL: Giant, AL: Physics, _L: Track, rL: place,
    yL: Coordinator, X2: { Racing: "Racing" },
  });
  const room = {
    raceId: options.oldRace ? 9 : 3,
    roster: options.missingPlayer ? [] : [{ playerId: "local" }],
    trackId: options.wrongTrack ? "bad" : "track",
    startSlots: { local: 2 },
    lte: options.lte ? {} : undefined,
    giant: options.giant ? {} : undefined,
    rp: options.rp ? { id: 1,
      draws: { local: { kartId: 7, flyingPetId: 8 } } } : undefined,
    roadblock: options.roadblock ? { runnerId: "local" } : undefined,
    item: options.raceItem,
  };
  const mode = options.lte ? "lte" : options.giant ? "giant" :
    options.rp ? "rp" : options.roadblock ? "roadblock" : options.item ? "item" : "ordinary";
  const assets = {
    raceId: 3,
    participants: options.missingVehicle ? [] : [{
      playerId: "local",
      vehicle: { physicsParams: {}, collisionShape: {} },
      profile: { equipment: { itemIds: {
        3: options.wrongRpItem ? 100 : 7, 52: 8,
      } } },
    }],
    map: { data: { trackId: "track" }, scene: {}, renderScene: {},
      skydome: {}, admission: {} },
    drivingMode: mode === "ordinary" ? undefined
      : mode === "item" ? { kind: mode, team: !!options.team } : { kind: mode },
    mode: options.team ? "team" : "individual",
    speed: options.speed ?? 4,
    rp: room.rp,
    channel: { adjustCollision: true },
    checkClientFramerate: true,
    lensFlare: {},
  };
  if (options.coins) assets.lteCoins = {
    object: "coins",
    attach(_coordinator, position, available) {
      calls.push(["coins attached", position().x, available()]);
    },
  };
  const owner = {
    lifecycle: { state: "Racing" },
    resetState: { phase: 0 },
    warpNext: { blocksDriving: () => false },
    handleLocalRouteTag: tag => calls.push(["route tag", tag]),
  };
  let error;
  try {
    if (kind === "original") Original.call(owner, assets, room, "local");
    else initializeLocalRace(owner, assets, room, "local", ops);
  } catch (caught) { error = caught.message; }
  if (owner.coordinator) owner.coordinator.onTag("rail");
  if (owner.giant) owner.giant.compensate();
  return {
    error, calls: JSON.parse(JSON.stringify(calls)), roadblock: owner.roadblock,
    isRoadBlockRunner: owner.isRoadBlockRunner,
    startPose: owner.startPose,
    bodyPosition: owner.physics?.body.position,
    progress: owner.physics?.state.trackProgress,
    lteMotion: owner.lte?.motion,
    giant: !!owner.giant,
  };
}

test("local race asset validation and runtime construction match release", () => {
  for (const scenario of [
    {}, { team: true }, { team: true, speed: 3 }, { lte: true },
    { giant: true }, { rp: true }, { roadblock: true }, { coins: true },
    { oldRace: true }, { missingPlayer: true }, { missingVehicle: true },
    { wrongTrack: true }, { rp: true, wrongRpItem: true },
  ]) {
    assert.deepEqual(run("rewritten", scenario), run("original", scenario),
      JSON.stringify(scenario));
  }
});

test("item races need their race.item and run without 组队集气", () => {
  const team = { ruleset: "web-item-v1", table: "team" };
  const built = run("rewritten", { item: true, team: true, speed: 7, raceItem: team });
  assert.equal(built.error, undefined);
  // makePhysics(params, shape, team, team infinite, team charge, ...)
  const physics = built.calls.find(call => Array.isArray(call) && call[0] === "physics created");
  assert.deepEqual(physics[1].slice(0, 4), [true, false, false, { kind: "item", team: true }]);
  // An ordinary standard-speed team race keeps its team charge.
  const speed = run("rewritten", { team: true, speed: 7 });
  const speedPhysics = speed.calls.find(call => Array.isArray(call) && call[0] === "physics created");
  assert.deepEqual(speedPhysics[1].slice(0, 3), [true, false, true]);
  for (const scenario of [
    { item: true, team: true, speed: 7 },
    { item: true, team: true, speed: 7, raceItem: { ruleset: "web-item-v1", table: "indi" } },
    { team: true, speed: 7, raceItem: team },
  ]) {
    assert.equal(run("rewritten", scenario).error, "道具赛身份与本机玩法不一致。",
      JSON.stringify(scenario));
  }
});
