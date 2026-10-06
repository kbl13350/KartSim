/** Validation of the full `room` server event payload (release function `bP`). */

export type ResourceVersion = "p3528" | "p3543" | "p3553";
export type RoomMode = "individual" | "team";
export type Gameplay = "ordinary" | "grip" | "shadow" | "roadblock" | "lte" | "giant" | "rp";
export type RoomPhase = "open" | "loading" | "countdown" | "racing" | "finished";
export type ChannelName = "speedIndiCombine" | "speedTeamCombine" |
  "speedIndiInfinit" | "speedTeamInfinit";

export interface RoomEquipment {
  itemIds: Record<number, number>;
  kartSerial: number;
  valueAt3E: number;
  exceedType: number;
  systemKart?: string;
  systemKartVariant?: string;
}

export interface RoomMember {
  playerId: string;
  name: string;
  slot: number;
  ready: boolean;
  team: 1 | 2 | null;
  changing?: boolean;
  initial?: string;
  equipment?: RoomEquipment;
}

export interface ChatMessage {
  sequence: number;
  playerId: string;
  name: string;
  text: string;
}

export interface KickVote {
  voteId: string;
  targetId: string;
  eligibleIds: string[];
  yesIds: string[];
  noIds: string[];
  deadline: number;
}

// The released race validator coerces these IDs with String(), so the type
// cannot promise a string even when the matching roster ID is a string.
export interface RaceFinish { playerId: unknown; elapsedMs: number }
export interface RaceResult {
  playerId: unknown;
  rank: number;
  elapsedMs: number | null;
  points: number;
}

export interface RaceSnapshot {
  raceId: string;
  channelName: ChannelName;
  gameplay?: Gameplay;
  trackId: string;
  loadingDeadline: number;
  roster: RoomMember[];
  loadedIds: string[];
  returnedIds?: string[];
  startAt?: number;
  finishWindowMs?: number;
  finishDeadline?: number;
  raceOverAt?: number;
  finishes?: RaceFinish[];
  results?: RaceResult[];
  chat?: ChatMessage[];
  winningTeam?: 1 | 2;
  teamScores?: { 1: number; 2: number };
  rp?: { ruleset: "web-rp-speed-v1"; poolRevision: string;
    draws: Record<string, { kartId: number; flyingPetId: number }> };
  lte?: { ruleset: "web-lte-v1"; featureSet: "dodge-trial" };
  giant?: { ruleset: "p948-giant-p3553-web-v1" };
  roadblock?: { ruleset: "web-roadblock-v1"; runnerId: unknown;
    limitMs: 180000; noRunnerManualReset: true };
  roadblockOutcome?: { runnerWon: boolean; reason: "finish" | "timeout" | "runner-left";
    endAt: number };
}

export interface RoomSnapshot {
  roomId: string;
  revision: number;
  name: string;
  mode: RoomMode;
  capacity: number;
  speedVersion: "国服";
  channelName: ChannelName;
  speed: 4 | 7;
  gameplay?: Gameplay;
  resourceVersion: ResourceVersion;
  hostId: string;
  phase: RoomPhase;
  members: RoomMember[];
  trackId?: string;
  randomTrackCode?: number;
  autoStartAt?: number;
  closedSlots?: number[];
  kickVote?: KickVote;
  locked?: boolean;
  chat?: ChatMessage[];
  raceError?: "LOAD_TIMEOUT" | "LOAD_FAILED" | "MEMBER_LEFT" | "HOST_CANCELLED";
  race?: RaceSnapshot;
}

type Data = Record<string, unknown>;

const channelRules: Record<ChannelName, { mode: RoomMode; speed: 4 | 7 }> = {
  speedIndiCombine: { mode: "individual", speed: 7 },
  speedTeamCombine: { mode: "team", speed: 7 },
  speedIndiInfinit: { mode: "individual", speed: 4 },
  speedTeamInfinit: { mode: "team", speed: 4 },
};
const gameplayNames = new Set<Gameplay>([
  "ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp",
]);
const randomTrackCodes = new Set([0, 3, 4, 5, 6, 7, 8, 30, 40]);
const equipmentSlots = [
  1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30, 31,
  32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
];
const giantTracks = new Set([
  "village_R01", "village_I04", "village_I05", "forest_I03", "forest_I04",
  "forest_I05", "forest_I07", "desert_I03", "ice_I03", "tomb_I04",
  "pirate_I03", "moonhill_I01", "moonhill_I03", "gold_I01", "gold_I03",
  "china_I01", "china_I04",
]);
const lteTracks = new Set(["jurassic_R02", "beach_R05", "moonhill_R06"]);
const roadblockTracks = new Set([
  "desert_I01", "village_I02", "village_R01", "ice_I05", "ice_R04", "tomb_I01",
  "tomb_R01", "mine_I02", "fairy_I04", "china_I02", "castle_I02", "castle_I03",
  "castle_I06", "park_R01", "steam_I01", "jurassic_R01", "forest_I01_rvs",
  "forest_I05_rvs", "forest_I07_rvs", "village_I01_rvs", "village_I13_rvs",
  "ice_I02_rvs", "ice_I04_rvs", "northeu_I04_rvs",
]);

function record(value: unknown): value is Data {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && [...value].length >= min &&
    [...value].length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

function integer(value: unknown, min: number, max: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= min && Number(value) <= max;
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function trackId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
}

function validGameplay(value: unknown): value is Gameplay {
  return typeof value === "string" && gameplayNames.has(value as Gameplay);
}

function channel(value: unknown): value is ChannelName {
  return typeof value === "string" && Object.hasOwn(channelRules, value);
}

function gameplayForChannel(gameplay: unknown, channelName: unknown,
  version: unknown): boolean {
  if ((gameplay !== undefined && !validGameplay(gameplay)) || !channel(channelName)) return false;
  if (gameplay === "roadblock" || gameplay === "giant") {
    return channelName === "speedIndiCombine" && (version === undefined || version === "p3553");
  }
  if (gameplay === "rp") return version === undefined || version === "p3553";
  if (gameplay === "lte") {
    return channelRules[channelName].speed === 7 && (version === undefined || version === "p3553");
  }
  return gameplay === undefined || gameplay === "ordinary" ||
    ((gameplay === "shadow" || channelRules[channelName].speed === 7) &&
      (version === undefined || version === "p3553"));
}

function validChat(value: unknown): value is ChatMessage {
  return record(value) && integer(value.sequence, 1, Number.MAX_SAFE_INTEGER) &&
    text(value.playerId, 1, 64) && text(value.name, 1, 18) &&
    text(value.text, 1, 120) && !!value.text.trim();
}

function validChatList(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length <= 32 && value.every(validChat);
}

function validEquipment(value: unknown): value is RoomEquipment {
  if (!record(value) || !record(value.itemIds)) return false;
  const ids = value.itemIds;
  const unsigned = (entry: unknown, max: number): boolean =>
    Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) <= max;
  return Object.keys(ids).length === equipmentSlots.length &&
    equipmentSlots.every(slot => unsigned(ids[slot], 65535)) &&
    Number(ids[1]) > 0 && unsigned(value.kartSerial, 65535) &&
    unsigned(value.valueAt3E, 255) && unsigned(value.exceedType, 65535) &&
    (ids[3] === 0 ? trackId(value.systemKart) : value.systemKart === undefined) &&
    (value.systemKartVariant === undefined ||
      (ids[3] === 0 && trackId(value.systemKartVariant)));
}

function validMembers(value: unknown, capacity: number, hostId: string):
  { ids: Set<string>; slots: Set<number> } | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > capacity) return undefined;
  const ids = new Set<string>();
  const slots = new Set<number>();
  for (const member of value) {
    if (!record(member) || !text(member.playerId, 1, 64) ||
        !text(member.name, 1, 18) || !integer(member.slot, 0, 7) ||
        typeof member.ready !== "boolean" ||
        (member.team !== null && member.team !== 1 && member.team !== 2) ||
        ids.has(member.playerId) || slots.has(member.slot) ||
        (member.changing !== undefined && typeof member.changing !== "boolean") ||
        (member.initial !== undefined && !text(member.initial, 0, 64)) ||
        (member.equipment !== undefined && !validEquipment(member.equipment))) return undefined;
    ids.add(member.playerId);
    slots.add(member.slot);
  }
  return ids.has(hostId) ? { ids, slots } : undefined;
}

function validKickVote(value: unknown, memberIds: Set<string>, hostId: string,
  phase: unknown): value is KickVote {
  if (!record(value) || !text(value.voteId, 1, 64) ||
      !text(value.targetId, 1, 64) || !Array.isArray(value.eligibleIds) ||
      !Array.isArray(value.yesIds) || !Array.isArray(value.noIds) ||
      !finiteNonnegative(value.deadline)) return false;
  const eligible = new Set<unknown>(value.eligibleIds);
  return eligible.size === value.eligibleIds.length && value.eligibleIds.length <= 7 &&
    value.eligibleIds.every((id: unknown) => text(id, 1, 64)) &&
    value.yesIds.every((id: unknown) => eligible.has(id)) &&
    value.noIds.every((id: unknown) => eligible.has(id)) &&
    new Set([...value.yesIds, ...value.noIds]).size ===
      value.yesIds.length + value.noIds.length &&
    phase === "open" && memberIds.has(value.targetId) &&
    !value.eligibleIds.some((id: string) => !memberIds.has(id) || id === value.targetId) &&
    value.yesIds.includes(hostId) && !value.eligibleIds.includes(value.targetId);
}

function validRp(value: unknown, rosterIds: Set<string>): boolean {
  if (!record(value) || value.ruleset !== "web-rp-speed-v1" ||
      typeof value.poolRevision !== "string" || !/^[a-f0-9]{64}$/.test(value.poolRevision) ||
      !record(value.draws)) return false;
  const draws = value.draws;
  return Object.keys(draws).length === rosterIds.size &&
    Object.entries(draws).every(([id, draw]) => rosterIds.has(id) && record(draw) &&
      integer(draw.kartId, 1, 65535) && integer(draw.flyingPetId, 0, 65535));
}

function validModeData(race: Data, gameplay: Gameplay, rosterIds: Set<string>): boolean {
  if (gameplay === "rp" ? !validRp(race.rp, rosterIds) : race.rp !== undefined) return false;
  if (gameplay === "lte" ?
      !(record(race.lte) && race.lte.ruleset === "web-lte-v1" &&
        race.lte.featureSet === "dodge-trial" && lteTracks.has(String(race.trackId))) :
      race.lte !== undefined) return false;
  if (gameplay === "giant" ?
      !(record(race.giant) && race.giant.ruleset === "p948-giant-p3553-web-v1" &&
        giantTracks.has(String(race.trackId))) : race.giant !== undefined) return false;
  return true;
}

function validRoadblockRace(room: Data, race: Data, rosterIds: Set<string>): boolean {
  const rules = race.roadblock;
  if (!record(rules) || rules.ruleset !== "web-roadblock-v1" ||
      !rosterIds.has(String(rules.runnerId)) || rules.limitMs !== 180000 ||
      rules.noRunnerManualReset !== true ||
      (race.roster as unknown[]).length < 5 || !roadblockTracks.has(String(race.trackId)) ||
      race.finishWindowMs !== undefined || race.winningTeam !== undefined ||
      race.teamScores !== undefined) return false;
  if (room.phase === "loading") {
    return race.startAt === undefined && race.finishDeadline === undefined &&
      race.roadblockOutcome === undefined && race.results === undefined &&
      race.raceOverAt === undefined && race.finishes === undefined;
  }
  if (!finiteNonnegative(race.startAt) || !Array.isArray(race.loadedIds) ||
      race.loadedIds.length < 5 || !race.loadedIds.includes(rules.runnerId) ||
      race.finishDeadline !== race.startAt + 180000) return false;
  if (room.phase !== "finished") {
    return race.roadblockOutcome === undefined && race.results === undefined &&
      race.raceOverAt === undefined && race.finishes === undefined;
  }
  const outcome = race.roadblockOutcome;
  if (!record(outcome) || typeof outcome.runnerWon !== "boolean" ||
      !["finish", "timeout", "runner-left"].includes(String(outcome.reason)) ||
      !finiteNonnegative(outcome.endAt) || outcome.endAt < race.startAt ||
      outcome.endAt > race.finishDeadline ||
      outcome.runnerWon !== (outcome.reason === "finish") ||
      race.raceOverAt !== outcome.endAt + 3000 ||
      !Array.isArray(race.results) || race.results.length !== 0 ||
      (outcome.reason === "timeout" && outcome.endAt !== race.finishDeadline)) return false;
  if (outcome.reason === "finish") {
    return Array.isArray(race.finishes) && race.finishes.length === 1 &&
      record(race.finishes[0]) && race.finishes[0].playerId === rules.runnerId &&
      race.finishes[0].elapsedMs === outcome.endAt - race.startAt;
  }
  return race.finishes === undefined;
}

function validOrdinaryRace(room: Data, race: Data, rosterIds: Set<string>): boolean {
  if (race.roadblock !== undefined || race.roadblockOutcome !== undefined ||
      (race.finishWindowMs !== undefined && race.finishWindowMs !== 10000) ||
      (race.chat !== undefined && !validChatList(race.chat))) return false;
  if (race.finishes !== undefined) {
    if (!Array.isArray(race.finishes) || race.finishes.length > (race.roster as unknown[]).length ||
        !race.finishes.every(finish => record(finish) &&
          rosterIds.has(String(finish.playerId)) && integer(finish.elapsedMs, 0, 4294967294)) ||
        new Set(race.finishes.map(finish => finish.playerId)).size !== race.finishes.length) return false;
  }
  for (const deadline of [race.finishDeadline, race.raceOverAt]) {
    if (deadline !== undefined && !finiteNonnegative(deadline)) return false;
  }
  if (race.finishDeadline !== undefined &&
      (!(race.finishes as unknown[] | undefined)?.length || race.finishWindowMs !== 10000)) return false;
  if (room.phase === "finished") {
    if (race.finishDeadline === undefined ||
        race.raceOverAt !== Number(race.finishDeadline) + 6000 ||
        !Array.isArray(race.results) ||
        race.results.length !== (race.loadedIds as unknown[]).length) return false;
    if (room.mode === "team") {
      if (race.winningTeam !== 1 && race.winningTeam !== 2) return false;
      if (!record(race.teamScores) || !integer(race.teamScores[1], 0, 39) ||
          !integer(race.teamScores[2], 0, 39)) return false;
    } else if (race.winningTeam !== undefined || race.teamScores !== undefined) return false;
    const seen = new Set<string>();
    for (const [index, result] of race.results.entries()) {
      if (!record(result) || !(race.loadedIds as unknown[]).includes(String(result.playerId)) ||
          seen.has(String(result.playerId)) || result.rank !== index + 1 ||
          !(result.elapsedMs === null || integer(result.elapsedMs, 0, 4294967294)) ||
          typeof result.points !== "number" || !integer(result.points + 5, 0, 15)) return false;
      seen.add(String(result.playerId));
    }
  } else if (race.raceOverAt !== undefined || race.results !== undefined ||
      race.winningTeam !== undefined || race.teamScores !== undefined) return false;
  return room.phase === "loading" ? race.startAt === undefined :
    finiteNonnegative(race.startAt) && (race.loadedIds as unknown[]).length > 0;
}

/** Mirrors the released client's acceptance boundary for JSON room snapshots. */
export function isValidRoomSnapshot(value: unknown): value is RoomSnapshot {
  if (!record(value) || !text(value.roomId, 1, 64) ||
      !integer(value.revision, 1, Number.MAX_SAFE_INTEGER) || !text(value.name, 1, 18) ||
      (value.mode !== "individual" && value.mode !== "team") ||
      !integer(value.capacity, 2, 8) || value.speedVersion !== "国服" ||
      !channel(value.channelName) || channelRules[value.channelName].mode !== value.mode ||
      channelRules[value.channelName].speed !== value.speed ||
      !gameplayForChannel(value.gameplay, value.channelName, value.resourceVersion) ||
      !["p3528", "p3543", "p3553"].includes(String(value.resourceVersion)) ||
      !text(value.hostId, 1, 64) ||
      !["open", "loading", "countdown", "racing", "finished"].includes(String(value.phase)) ||
      (value.trackId !== undefined && !trackId(value.trackId)) ||
      (value.randomTrackCode !== undefined &&
        (typeof value.randomTrackCode !== "number" ||
          !randomTrackCodes.has(value.randomTrackCode) || value.resourceVersion !== "p3553" ||
          value.trackId !== undefined)) ||
      (value.trackId === undefined && value.randomTrackCode === undefined) ||
      (value.autoStartAt !== undefined &&
        (value.phase !== "open" || !finiteNonnegative(value.autoStartAt))) ||
      (value.closedSlots !== undefined &&
        (!Array.isArray(value.closedSlots) || value.closedSlots.length > 8 ||
          new Set(value.closedSlots).size !== value.closedSlots.length ||
          !value.closedSlots.every(slot => integer(slot, 0, 7))))) return false;
  const members = validMembers(value.members, value.capacity, value.hostId);
  if (!members || (value.locked !== undefined && typeof value.locked !== "boolean") ||
      (value.chat !== undefined && !validChatList(value.chat))) return false;
  if (value.kickVote !== undefined &&
      !validKickVote(value.kickVote, members.ids, value.hostId, value.phase)) return false;
  const capacity = value.capacity as number;
  const gameplay: Gameplay = value.gameplay === undefined ? "ordinary" : value.gameplay as Gameplay;
  if ((gameplay === "roadblock" &&
        (capacity < 5 || value.randomTrackCode !== 0 || value.trackId !== undefined)) ||
      (gameplay === "lte" && (value.randomTrackCode !== 0 || value.trackId !== undefined)) ||
      (gameplay === "giant" &&
        (value.randomTrackCode !== undefined ? value.randomTrackCode !== 0 :
          !giantTracks.has(String(value.trackId ?? "")))) ||
      (Array.isArray(value.closedSlots) && value.closedSlots.some(slot =>
        members.slots.has(slot) ||
        (value.mode === "team" ? slot % 4 >= capacity / 2 : slot >= capacity))) ||
      (value.raceError !== undefined &&
        !["LOAD_TIMEOUT", "LOAD_FAILED", "MEMBER_LEFT", "HOST_CANCELLED"]
          .includes(String(value.raceError)))) return false;
  if (value.phase === "open") return value.race === undefined;
  const race = value.race;
  if (!record(race) || race.channelName !== value.channelName ||
      !gameplayForChannel(race.gameplay, race.channelName, value.resourceVersion) ||
      (race.gameplay === undefined ? "ordinary" : race.gameplay) !== gameplay ||
      !text(race.raceId, 1, 64) || !trackId(race.trackId) ||
      (value.randomTrackCode === undefined && race.trackId !== value.trackId) ||
      !finiteNonnegative(race.loadingDeadline) ||
      !Array.isArray(race.roster) || !Array.isArray(race.loadedIds) ||
      !isValidRoomSnapshot({ ...value, phase: "open", race: undefined, members: race.roster })) return false;
  const rosterIds = new Set<string>(race.roster.map((member: RoomMember) => member.playerId));
  if (race.roster.some((member: RoomMember) => !member.equipment) ||
      new Set(race.loadedIds).size !== race.loadedIds.length ||
      !race.loadedIds.every((id: unknown) => typeof id === "string" && rosterIds.has(id)) ||
      (value.members as RoomMember[]).some(member => !rosterIds.has(member.playerId)) ||
      (race.returnedIds !== undefined &&
        (value.phase !== "finished" || !Array.isArray(race.returnedIds) ||
          new Set(race.returnedIds).size !== race.returnedIds.length ||
          !race.returnedIds.every((id: unknown) => typeof id === "string" && rosterIds.has(id)))) ||
      !validModeData(race, gameplay, rosterIds)) return false;
  return gameplay === "roadblock" ? validRoadblockRace(value, race, rosterIds) :
    validOrdinaryRace(value, race, rosterIds);
}
