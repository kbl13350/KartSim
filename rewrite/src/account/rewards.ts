/**
 * Race rewards (ECONOMY.md 2, 7.7): multiplayer `race.rewards` from the game
 * node and the time attack settlement on the data service.
 */
import { parseAccountSummary } from "./account-api";
import type { AccountSummary } from "./account-session";

export interface RaceReward { exp: number; lucci: number }

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function amount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 &&
    value <= 1_000_000_000 ? value : undefined;
}

/** `race.rewards` ({playerId: {exp, lucci}}); malformed entries are skipped. */
export function parseRaceRewards(value: unknown): Map<string, RaceReward> {
  const rewards = new Map<string, RaceReward>();
  if (!record(value)) return rewards;
  for (const [playerId, entry] of Object.entries(value)) {
    if (!record(entry)) continue;
    const exp = amount(entry.exp);
    const lucci = amount(entry.lucci);
    if (exp === undefined || lucci === undefined) continue;
    rewards.set(playerId, { exp, lucci });
  }
  return rewards;
}

/** "+85经验 +120金币" for a result row. */
export function formatRaceReward(reward: RaceReward): string {
  return `+${reward.exp}经验 +${reward.lucci}金币`;
}

export interface TimeAttackSettlement {
  exp: number;
  lucci: number;
  newRecord: boolean;
  /** The daily reward limit was reached; nothing (or less) was credited. */
  capped: boolean;
  summary?: AccountSummary;
}

export interface SettleSession {
  requestJson(path: string, init?: RequestInit): Promise<unknown>;
  applySummary?(summary: AccountSummary): void;
}

export function newRequestId(random: () => string = () => crypto.randomUUID()): string {
  try {
    return random();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function settlementSummary(body: Record<string, unknown>): AccountSummary | undefined {
  for (const key of ["account", "summary"]) {
    const value = body[key];
    if (record(value) && record(value.progress) && record(value.wallet)) {
      try { return parseAccountSummary(value); } catch { return undefined; }
    }
  }
  return undefined;
}

/** `POST /api/timeattack/settle`; the returned account summary is applied to the session. */
export async function settleTimeAttack(session: SettleSession,
  run: { trackId: string; elapsedMs: number; requestId?: string }):
  Promise<TimeAttackSettlement> {
  const body = await session.requestJson("/api/timeattack/settle", {
    method: "POST",
    body: JSON.stringify({ trackId: run.trackId, elapsedMs: Math.round(run.elapsedMs),
      requestId: run.requestId ?? newRequestId() }),
  });
  const value = record(body) ? body : {};
  const summary = settlementSummary(value);
  if (summary) session.applySummary?.(summary);
  return {
    exp: amount(value.exp) ?? 0,
    lucci: amount(value.lucci) ?? 0,
    newRecord: value.newRecord === true,
    capped: value.capped === true,
    ...(summary ? { summary } : {}),
  };
}
