import type { Gameplay } from "./lobby-actions";

/** Gameplay modes that the local multiplayer client can create and load. */
const playableModes = new Set<Gameplay>([
  "ordinary", "grip", "shadow", "roadblock", "lte", "giant", "rp",
]);

export function isPlayableGameplay(value: unknown): value is Gameplay {
  return typeof value === "string" && playableModes.has(value as Gameplay);
}
