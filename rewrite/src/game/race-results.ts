/** Return the player ids highlighted by the result screen. */
export function highlightedResultPlayers(
  mode: string,
  roster: ReadonlyArray<{ playerId: string; team?: unknown }>,
  results: ReadonlyArray<{ playerId: string; rank: number; elapsedMs: number | null }>,
  winningTeam: unknown,
): string[] {
  return results
    .filter((result) => mode === "team"
      ? roster.find((player) => player.playerId === result.playerId)?.team === winningTeam
      : result.rank <= 3 && result.elapsedMs !== null)
    .map((result) => result.playerId);
}
