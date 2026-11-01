import assert from "node:assert/strict";
import test from "node:test";
import { DEATHMATCH_RULES } from "./deathmatch-rules";
import { validateDeathmatchRace } from "./deathmatch-validation";
import { raceMotionMembers, raceMotionSlot } from "./race-motion-slots";
import { isValidRoomSnapshot } from "./room-validation";

function room(phase = "racing"): Record<string, any> {
  const equipment = { itemIds: Object.fromEntries([
    1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
    32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
  ].map(slot => [slot, slot === 1 || slot === 3 ? 1 : 0])), kartSerial: 0, valueAt3E: 0, exceedType: 0 };
  const members = Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, name: `P${i}`, slot: i,
    team: i < 4 ? 1 : 2, ready: true, equipment }));
  const roster = members.map(member => ({ ...member, slot: member.slot % 4 * 2 + member.team - 1 }));
  const snapshot: Record<string, any> = { roomId: "arena", revision: 1, name: "Deathmatch", mode: "team",
    capacity: 8, speedVersion: "国服", speed: 7, resourceVersion: "p3553", channelName: "speedTeamCombine",
    gameplay: "deathmatch", hostId: "p0", phase, members, trackId: "ice_D01" };
  if (phase === "open") return snapshot;
  const deathmatch = { ...DEATHMATCH_RULES, fallY: -100, eventSequence: 0, scores: { 1: 0, 2: 0 },
    spawns: Array.from({ length: 8 }, (_, slot) => ({ slot, position: { x: slot * 10, y: 10, z: 0 },
      forward: { x: 0, y: 0, z: 1 } })), players: Object.fromEntries(roster.map(player => [player.playerId,
      { lifeSeq: 0, alive: true, spawnSlot: player.slot, protectedUntil: 0, respawnAt: null, kills: 0, deaths: 0 }])) };
  snapshot.race = { raceId: "round", channelName: snapshot.channelName, gameplay: "deathmatch",
    trackId: snapshot.trackId, loadingDeadline: 100, roster, loadedIds: members.map(p => p.playerId), deathmatch,
    teamScores: { 1: 0, 2: 0 }, startSlots: Object.fromEntries(roster.map(p => [p.playerId, p.slot])) };
  if (phase !== "loading") Object.assign(snapshot.race, { startAt: 200, finishDeadline: 180200 });
  return snapshot;
}

function finish(snapshot: Record<string, any>, winner: 0 | 1 | 2): void {
  snapshot.phase = "finished";
  const race = snapshot.race;
  race.deathmatch.outcome = { reason: "timeout", winningTeam: winner, endedAt: race.finishDeadline };
  race.raceOverAt = race.finishDeadline + 3000;
  if (winner) race.winningTeam = winner;
  race.results = race.roster.map((p: any, i: number) => ({ playerId: p.playerId, rank: i + 1,
    elapsedMs: null, points: race.deathmatch.players[p.playerId].kills }));
}

test("all deathmatch room phases accept the original team slot mapping and score-only outcome", () => {
  for (const phase of ["open", "loading", "countdown", "racing"]) assert.ok(isValidRoomSnapshot(room(phase)), phase);
  for (const winner of [0, 1, 2] as const) {
    const snapshot = room();
    Object.assign(snapshot.race.deathmatch.players.p3, { alive: false, respawnAt: null, deaths: 1 });
    finish(snapshot, winner);
    assert.ok(isValidRoomSnapshot(snapshot), `winning team ${winner}`);
  }
  const random = room("open"); delete random.trackId; random.randomTrackCode = 0;
  assert.ok(isValidRoomSnapshot(random));
  const departed = room(); departed.members.pop();
  Object.assign(departed.race.deathmatch.players.p7, { alive: false, respawnAt: null });
  assert.ok(isValidRoomSnapshot(departed), "departed racers remain in the frozen match without respawning");
});

test("deathmatch validation rejects mismatched state, arena, roster and race finish semantics", () => {
  for (const mutate of [
    (s: any) => { s.race.trackId = s.trackId = "village_R01"; },
    (s: any) => { s.capacity = 6; },
    (s: any) => { s.closedSlots = [7]; },
    (s: any) => { delete s.race.deathmatch; },
    (s: any) => { s.race.startSlots.p1 = 7; },
    (s: any) => { s.race.roster[0].team = 2; },
    (s: any) => { s.race.deathmatch.players.p0.spawnSlot = 1; },
    (s: any) => { s.race.deathmatch.players.extra = s.race.deathmatch.players.p0; },
    (s: any) => { s.race.finishWindowMs = 10000; },
    (s: any) => { s.race.finishes = [{ playerId: "p0", elapsedMs: 1000 }]; },
    (s: any) => { s.race.teamScores[1] = 5; },
    (s: any) => { s.race.finishDeadline = 1500; },
  ]) {
    const snapshot = room(); mutate(snapshot);
    assert.equal(isValidRoomSnapshot(snapshot), false);
  }
  const result = room(); finish(result, 1); result.race.results[0].points = 1;
  assert.equal(isValidRoomSnapshot(result), false);
  const mixed = room(); mixed.gameplay = mixed.race.gameplay = "ordinary";
  assert.throws(() => validateDeathmatchRace(mixed, mixed.race), /其他玩法/);
});

test("deathmatch network motion uses the frozen arena slot and excludes waiting room members", () => {
  const snapshot = room();
  assert.equal(raceMotionSlot(snapshot.race, snapshot.members[1]), 2, "lobby seat 1 is arena spawn 2");
  assert.equal(raceMotionSlot(snapshot.race, snapshot.members[4]), 1, "lobby seat 4 is arena spawn 1");
  const waiting = { playerId: "waiting", slot: 0 };
  assert.deepEqual(raceMotionMembers(snapshot.race, [...snapshot.members, waiting]), snapshot.members);
  assert.throws(() => raceMotionSlot(snapshot.race, waiting), /冻结出生位/);
  delete snapshot.race.startSlots.p0;
  assert.throws(() => raceMotionSlot(snapshot.race, snapshot.members[0]), /冻结出生位/);
});
