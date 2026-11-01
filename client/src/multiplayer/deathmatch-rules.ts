import { DEATHMATCH_TRACK_IDS } from "./lobby-deathmatch-mode";

/** Mode 58 is original; these match rules are reconstructed where no original table survives. */
export const DEATHMATCH_RULES = Object.freeze({ ruleset: "web-deathmatch-v1" as const,
  gameType: 58, originalCreateSpeed: 1, targetScore: 20, timeLimitMs: 180000,
  respawnMs: 3000, protectionMs: 2000, attributionMs: 5000, contactDistance: 5.5 });
export const DEATHMATCH_TRACKS = DEATHMATCH_TRACK_IDS;
export interface DeathmatchPoint { x: number; y: number; z: number }
export interface DeathmatchPlayer {
  lifeSeq: number; alive: boolean; spawnSlot: number; protectedUntil: number;
  respawnAt: number | null; kills: number; deaths: number;
}
export interface DeathmatchState {
  ruleset: "web-deathmatch-v1"; gameType: number; originalCreateSpeed: number;
  targetScore: number; timeLimitMs: number; respawnMs: number; protectionMs: number;
  attributionMs: number; contactDistance: number; fallY: number;
  spawns: Array<{ slot: number; position: DeathmatchPoint; forward: DeathmatchPoint }>;
  scores: { 1: number; 2: number }; players: Record<string, DeathmatchPlayer>; eventSequence: number;
  outcome?: { reason: "target-score" | "timeout" | "team-left"; winningTeam: 0 | 1 | 2; endedAt: number };
}
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);
const uint = (v: unknown) => Number.isSafeInteger(v) && Number(v) >= 0;
const clock = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const point = (v: unknown) => object(v) && [v.x, v.y, v.z].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 1e6);
export function isDeathmatchState(v: unknown, ids?: ReadonlySet<string>): v is DeathmatchState {
  if (!object(v) || Object.entries(DEATHMATCH_RULES).some(([k, n]) => v[k] !== n) ||
      typeof v.fallY !== "number" || !Number.isFinite(v.fallY) || !Array.isArray(v.spawns) || v.spawns.length !== 8 ||
      !v.spawns.every((s: any, i: number) => object(s) && s.slot === i && point(s.position) && point(s.forward)) ||
      !object(v.scores) || !uint(v.scores[1]) || !uint(v.scores[2]) || !uint(v.eventSequence) || !object(v.players)) return false;
  const entries = Object.entries(v.players);
  if (entries.length < 2 || entries.length > 8 || (ids && (entries.length !== ids.size || entries.some(([id]) => !ids.has(id))))) return false;
  if (!entries.every(([, p]) => object(p) && uint(p.lifeSeq) && typeof p.alive === "boolean" &&
      uint(p.spawnSlot) && p.spawnSlot < 8 && clock(p.protectedUntil) && uint(p.kills) && uint(p.deaths) &&
      // Departed racers and a finished match retain a dead life with no respawn timer.
      (p.respawnAt === null || (!p.alive && clock(p.respawnAt))))) return false;
  return v.outcome === undefined || (object(v.outcome) && [0, 1, 2].includes(v.outcome.winningTeam) &&
    ["target-score", "timeout", "team-left"].includes(v.outcome.reason) && clock(v.outcome.endedAt));
}
/** Freeze only rules/geometry; scoreboard and life state legitimately change during play. */
export function deathmatchIdentity(v: unknown): string | undefined {
  if (!isDeathmatchState(v)) return undefined;
  return JSON.stringify({ ...DEATHMATCH_RULES, fallY: v.fallY, spawns: v.spawns,
    players: Object.entries(v.players).map(([id, p]) => [id, p.spawnSlot]).sort() });
}
export const isDeathmatchTrack = (v: unknown): boolean => DEATHMATCH_TRACKS.includes(v as typeof DEATHMATCH_TRACKS[number]);
