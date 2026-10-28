/** Original 勇者组队竞速赛: opposing teams race on the same bridge in opposite directions. */
export const BRAVE_GAMEPLAY = "brave";
export const BRAVE_CHANNEL = "speedTeamCombine";
export const BRAVE_GAME_TYPE = 31;
export const BRAVE_TRACK_ID = "village_R07";
export const BRAVE_LABEL = "勇者组队竞速赛";
export const BRAVE_RULESET = "web-brave-v1";
export const BRAVE_CAPACITIES = [4, 6, 8] as const;

export interface BraveRaceRules {
  ruleset: typeof BRAVE_RULESET;
  /** The other team extracts the reversed route from the same track.1s scene. */
  forwardTeam: 1 | 2;
}

export function isBraveTrack(trackId: unknown): boolean {
  return trackId === BRAVE_TRACK_ID;
}

export function isBraveRaceRules(value: unknown): value is BraveRaceRules {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rules = value as Record<string, unknown>;
  return rules.ruleset === BRAVE_RULESET && (rules.forwardTeam === 1 || rules.forwardTeam === 2);
}

export function freezeBraveRaceRules(value: unknown): Readonly<BraveRaceRules> | undefined {
  return isBraveRaceRules(value)
    ? Object.freeze({ ruleset: value.ruleset, forwardTeam: value.forwardTeam }) : undefined;
}

export function sameBraveRaceRules(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) return left === right;
  return isBraveRaceRules(left) && isBraveRaceRules(right) &&
    left.ruleset === right.ruleset && left.forwardTeam === right.forwardTeam;
}

/** Original rule: at least four racers and equally sized red and blue teams. */
export function isBraveRoster(value: unknown): boolean {
  if (!Array.isArray(value) || !BRAVE_CAPACITIES.includes(value.length as 4 | 6 | 8)) return false;
  const red = value.filter(entry => entry?.team === 1).length;
  const blue = value.filter(entry => entry?.team === 2).length;
  return red === blue && red + blue === value.length && value.every(entry =>
    entry && entry.ai !== true && Number.isInteger(entry.slot) && entry.slot >= 0 &&
    entry.slot < 8 && (entry.slot < 4 ? entry.team === 1 : entry.team === 2));
}
