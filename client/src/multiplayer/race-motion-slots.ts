import { isBraveRaceRules } from "./lobby-brave-mode";

export interface RaceMotionSlots {
  raceId?: string;
  brave?: unknown;
  startSlots?: unknown;
  roster?: unknown;
}

/** Members joining during a brave race wait for the next frozen roster. */
export function raceMotionMembers<T extends { playerId: string }>(race: RaceMotionSlots | undefined,
  members: readonly T[]): T[] {
  if (race?.brave === undefined) return [...members];
  if (!isBraveRaceRules(race.brave) || !Array.isArray(race.roster))
    throw new Error("勇者竞速动作帧缺少本局冻结名单。");
  const racers = new Set(race.roster.map(entry => entry.playerId));
  return members.filter(member => racers.has(member.playerId));
}

/** Brave motion identities follow the race's shuffled grid, not lobby seats. */
export function raceMotionSlot(race: RaceMotionSlots | undefined,
  member: { playerId: string; slot: number }): number {
  if (race?.brave === undefined) return member.slot;
  const slots = race.startSlots;
  const slot = slots && typeof slots === "object" && !Array.isArray(slots)
    ? (slots as Record<string, unknown>)[member.playerId] : undefined;
  if (!isBraveRaceRules(race.brave) || typeof slot !== "number" ||
      !Number.isInteger(slot) || slot < 0 || slot > 7) {
    throw new Error("勇者竞速动作帧缺少本局冻结起跑位。");
  }
  return slot;
}
