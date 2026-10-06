import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isValidRoomSnapshot } from "./room-validation";

globalThis.document = { createElement: () => ({ relList: { supports: () => true } }) } as unknown as Document;
const { G2, To, W6, _X, sR, tt } = await import("../generated/formats.js");
const { Io, Vw, X6, Zl, bI, ba, ko, w90 } = await import("../generated/library.js");
const { zo0 } = await import("../generated/world.js");

// Execute the immutable formatted release implementation with its released helpers.
const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const constants = source.indexOf("const Uo = 39,");
const roomParser = source.indexOf("function bP(", constants);
const eventParser = source.indexOf("function zo0(", roomParser);
assert.ok(constants > 0 && roomParser > constants && eventParser > roomParser);
const release = new Function("W6", "To", "X6", "w90", "G2", "tt", "_X", "bI",
  "Zl", "sR", "ba", "ko", "Vw", "Io",
  `${source.slice(constants, eventParser)}\nreturn bP;`)(
    W6, To, X6, w90, G2, tt, _X, bI, Zl, sR, ba, ko, Vw, Io,
  ) as (value: unknown) => boolean;

type Fixture = Record<string, any>;
const copy = <T>(value: T): T => structuredClone(value);
const equipment = (): Fixture => ({
  itemIds: Object.fromEntries([
    1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
    32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
  ].map(slot => [slot, slot === 1 || slot === 3 ? 1 : 0])),
  kartSerial: 0, valueAt3E: 0, exceedType: 0,
});
const member = (id: string, slot: number, team: number | null = null): Fixture => ({
  playerId: id, name: `Player ${id}`, slot, team, ready: true, equipment: equipment(),
});
const room = (options: { gameplay?: string; mode?: "individual" | "team";
  phase?: string; players?: number; trackId?: string; randomTrackCode?: number } = {}): Fixture => {
  const mode = options.mode ?? "individual";
  const gameplay = options.gameplay ?? "ordinary";
  const players = options.players ?? (gameplay === "roadblock" ? 5 : 2);
  const channelName = mode === "team" ? "speedTeamCombine" : "speedIndiCombine";
  const members = Array.from({ length: players }, (_, index) =>
    member(`p${index + 1}`, mode === "team" && index % 2 ? Math.floor(index / 2) + 4 : Math.floor(index / 2),
      mode === "team" ? (index % 2 ? 2 : 1) : null));
  if (mode === "individual") members.forEach((entry, index) => { entry.slot = index; });
  const value: Fixture = {
    roomId: "room-1", revision: 1, name: "Test Room", mode, capacity: 8,
    speedVersion: "国服", channelName, speed: 7, gameplay,
    resourceVersion: "p3553", hostId: "p1", phase: options.phase ?? "open", members,
  };
  if (options.randomTrackCode !== undefined) value.randomTrackCode = options.randomTrackCode;
  else if (gameplay === "roadblock" || gameplay === "lte") value.randomTrackCode = 0;
  else value.trackId = options.trackId ?? "village_R01";
  if (value.phase !== "open") {
    const raceTrack = gameplay === "lte" ? "jurassic_R02" : value.trackId ?? "village_R01";
    value.race = {
      raceId: "race-1", channelName, gameplay, trackId: raceTrack,
      loadingDeadline: 100, roster: copy(members), loadedIds: members.map(entry => entry.playerId),
    };
    if (gameplay === "roadblock") value.race.roadblock = {
      ruleset: "web-roadblock-v1", runnerId: "p1", limitMs: 180000,
      noRunnerManualReset: true,
    };
    if (gameplay === "lte") value.race.lte = { ruleset: "web-lte-v1", featureSet: "dodge-trial" };
    if (gameplay === "giant") value.race.giant = { ruleset: "p948-giant-p3553-web-v1" };
    if (gameplay === "rp") value.race.rp = {
      ruleset: "web-rp-speed-v1", poolRevision: "a".repeat(64),
      draws: Object.fromEntries(members.map(entry =>
        [entry.playerId, { kartId: 1, flyingPetId: 0 }])),
    };
    if (value.phase !== "loading") {
      value.race.startAt = 200;
      if (gameplay === "roadblock") value.race.finishDeadline = 180200;
    }
    if (value.phase === "finished") {
      if (gameplay === "roadblock") {
        value.race.finishDeadline = 180200;
        value.race.roadblockOutcome = { runnerWon: true, reason: "finish", endAt: 1200 };
        value.race.raceOverAt = 4200;
        value.race.results = [];
        value.race.finishes = [{ playerId: "p1", elapsedMs: 1000 }];
      } else {
        value.race.finishWindowMs = 10000;
        value.race.finishes = [{ playerId: "p1", elapsedMs: 1000 }];
        value.race.finishDeadline = 10200;
        value.race.raceOverAt = 16200;
        value.race.results = members.map((entry, index) => ({
          playerId: entry.playerId, rank: index + 1,
          elapsedMs: index === 0 ? 1000 : null, points: index === 0 ? 10 : 0,
        }));
        if (mode === "team") {
          value.race.winningTeam = 1;
          value.race.teamScores = { 1: 10, 2: 0 };
        }
      }
    }
  }
  return value;
};

function sameAsRelease(value: unknown, label: string): void {
  assert.equal(isValidRoomSnapshot(value), release(value), label);
}

test("all valid room phases, teams, and game modes match release", () => {
  const fixtures: Fixture[] = [];
  for (const phase of ["open", "loading", "countdown", "racing", "finished"]) {
    for (const gameplay of ["ordinary", "grip", "shadow", "rp", "lte", "giant", "roadblock"]) {
      for (const mode of gameplay === "roadblock" || gameplay === "giant" ?
        ["individual"] as const : ["individual", "team"] as const) {
        fixtures.push(room({ gameplay, mode, phase }));
      }
    }
  }
  for (const fixture of fixtures) {
    assert.equal(release(fixture), true,
      `fixture must be accepted by release: ${fixture.gameplay}/${fixture.mode}/${fixture.phase}`);
    sameAsRelease(fixture, `${fixture.gameplay}/${fixture.mode}/${fixture.phase}`);
  }
  const shadowInfinit = room({ gameplay: "shadow" });
  shadowInfinit.channelName = "speedIndiInfinit";
  shadowInfinit.speed = 4;
  sameAsRelease(shadowInfinit, "shadow at speed 4");
  for (const version of ["p3528", "p3543"]) {
    const legacyRoom = room();
    legacyRoom.resourceVersion = version;
    sameAsRelease(legacyRoom, `ordinary with ${version} assets`);
  }
});

test("generated room server event parser uses the handwritten validator", () => {
  const accepted = { type: "room", room: room({ phase: "racing", gameplay: "giant" }) };
  assert.deepEqual(zo0(accepted), accepted);
  const rejected = copy(accepted);
  rejected.room.race.giant.ruleset = "invalid";
  assert.equal(zo0(rejected), undefined);
});

test("room fields, members, kick vote and equipment match release", () => {
  const base = room();
  const variants: Array<[string, (value: Fixture) => void]> = [
    ["empty id", value => { value.roomId = ""; }],
    ["control character", value => { value.name = "room\n"; }],
    ["revision fraction", value => { value.revision = 1.5; }],
    ["wrong channel", value => { value.channelName = "speedTeamCombine"; }],
    ["wrong resource version", value => { value.resourceVersion = "p3543"; value.gameplay = "rp"; }],
    ["invalid random code", value => { delete value.trackId; value.randomTrackCode = 9; }],
    ["valid random code", value => { delete value.trackId; value.randomTrackCode = 8; }],
    ["auto start", value => { value.autoStartAt = 0; }],
    ["negative auto start", value => { value.autoStartAt = -1; }],
    ["duplicate slot", value => { value.members[1].slot = 0; }],
    ["closed occupied slot", value => { value.closedSlots = [0]; }],
    ["closed empty slot", value => { value.closedSlots = [2]; }],
    ["missing host", value => { value.hostId = "absent"; }],
    ["invalid member team", value => { value.members[0].team = 3; }],
    ["missing equipment slot", value => { delete value.members[0].equipment.itemIds[1]; }],
    ["system kart without id", value => {
      value.members[0].equipment.itemIds[3] = 0;
      value.members[0].equipment.systemKart = "village_R01";
    }],
    ["invalid chat", value => { value.chat = [
      { sequence: 1, playerId: "p1", name: "Player p1", text: "   " },
    ]; }],
    ["valid kick vote", value => { value.kickVote = {
      voteId: "vote-1", targetId: "p2", eligibleIds: ["p1"],
      yesIds: ["p1"], noIds: [], deadline: 1200,
    }; }],
    ["invalid kick vote", value => { value.kickVote = {
      voteId: "vote-1", targetId: "p2", eligibleIds: ["p1", "p2"],
      yesIds: ["p1"], noIds: [], deadline: 1200,
    }; }],
  ];
  for (const [label, mutate] of variants) {
    const value = copy(base); mutate(value); sameAsRelease(value, label);
  }
});

test("race roster, results and mode-specific rules match release", () => {
  const fixtures = [
    room({ phase: "finished" }), room({ phase: "finished", mode: "team" }),
    room({ phase: "finished", gameplay: "rp" }),
    room({ phase: "finished", gameplay: "lte" }),
    room({ phase: "finished", gameplay: "giant" }),
    room({ phase: "finished", gameplay: "roadblock" }),
  ];
  const variants: Array<[string, number, (value: Fixture) => void]> = [
    ["roster duplicate", 0, value => { value.race.roster[1].playerId = "p1"; }],
    ["roster equipment missing", 0, value => { delete value.race.roster[0].equipment; }],
    ["loaded foreign id", 0, value => { value.race.loadedIds[0] = "foreign"; }],
    ["returned before finished", 0, value => { value.phase = "racing"; value.race.returnedIds = ["p1"]; }],
    ["finish window missing", 0, value => { delete value.race.finishWindowMs; }],
    ["result rank", 0, value => { value.race.results[0].rank = 2; }],
    ["result points", 0, value => { value.race.results[0].points = 11; }],
    ["team score too high", 1, value => { value.race.teamScores[1] = 40; }],
    ["team score missing", 1, value => { delete value.race.teamScores; }],
    ["RP draw missing", 2, value => { delete value.race.rp.draws.p2; }],
    ["RP hash uppercase", 2, value => { value.race.rp.poolRevision = "A".repeat(64); }],
    ["LTE wrong track", 3, value => { value.race.trackId = "village_R01"; }],
    ["Giant wrong ruleset", 4, value => { value.race.giant.ruleset = "bad"; }],
    ["Roadblock wrong runner", 5, value => { value.race.roadblock.runnerId = "foreign"; }],
    ["Roadblock timeout", 5, value => {
      value.race.roadblockOutcome = { runnerWon: false, reason: "timeout", endAt: 180200 };
      value.race.raceOverAt = 183200;
      delete value.race.finishes;
    }],
    ["Roadblock finish missing record", 5, value => { delete value.race.finishes; }],
    ["race finish ID uses released String coercion", 0, value => {
      value.members[0].playerId = "1";
      value.hostId = "1";
      value.race.roster[0].playerId = "1";
      value.race.loadedIds[0] = "1";
      value.race.finishes[0].playerId = 1;
      value.race.results[0].playerId = 1;
    }],
  ];
  for (const [label, index, mutate] of variants) {
    const value = copy(fixtures[index]!); mutate(value); sameAsRelease(value, label);
  }
});

test("deterministic JSON mutation sweep matches release", () => {
  const seeds = [room(), room({ phase: "finished", mode: "team" }),
    room({ phase: "racing", gameplay: "roadblock" }),
    room({ phase: "finished", gameplay: "lte" })];
  const scalars: unknown[] = [undefined, null, false, 0, 1, -1, 1.5, "", "x", [], {}];
  let comparisons = 0;
  for (const seed of seeds) {
    for (const property of Object.keys(seed)) {
      for (const scalar of scalars) {
        const changed = copy(seed);
        changed[property] = scalar;
        sameAsRelease(changed, `${seed.gameplay}/${seed.phase}.${property}=${String(scalar)}`);
        comparisons++;
      }
    }
    if (seed.race) {
      for (const property of Object.keys(seed.race)) {
        for (const scalar of scalars) {
          const changed = copy(seed);
          changed.race[property] = scalar;
          sameAsRelease(changed, `${seed.gameplay}/${seed.phase}.race.${property}`);
          comparisons++;
        }
      }
    }
  }
  assert.ok(comparisons >= 500);
});
