import type { ChaseRule } from "./story-chase";

/**
 * A story race rides on the solo race selection: the race builder takes its
 * rival ghosts and lap count from here instead of the time attack record
 * store, the result screen skips saving records, and leaving the race hands
 * the outcome back to story mode.
 */

export interface StoryGhostSource {
  equipment: Record<string, unknown> & { startSlot?: number };
  record: unknown;
  timeBase?: string;
  /** Tracing / Escape: the rival's playback runs this many ms ahead (+) or behind (−). */
  timeOffsetMs?: number;
}

export interface StoryRaceOutcome {
  /** The player crossed the finish line. */
  finished: boolean;
  /** Race time from GO, in milliseconds; 0 when not finished. */
  elapsedMs: number;
  /** A mission the race decided before the finish line (Tracing / Escape). */
  cleared?: boolean;
}

export interface StoryRaceRequest {
  ghosts: StoryGhostSource[];
  laps?: number;
  /** Tracing (追击) / Escape (逃脱): judged every frame against the rival ghost. */
  chase?: ChaseRule;
  /**
   * 驾照考试: the step's time limit in ms from GO. The mission timer counts
   * it down and running out fails the race.
   */
  timeLimitMs?: number;
  /** Put the player's own kart, rider and Ready options back. */
  restore(): void;
  /** Clear rule of a finished race, asked at the finish line for the mission result. */
  judge?(elapsedMs: number): boolean;
  /** Runs once Ready has been rebuilt after the race. */
  onReturn(outcome: StoryRaceOutcome): void;
}

export function storyRaceOf(selection: unknown): StoryRaceRequest | undefined {
  if (!selection || typeof selection !== "object") return undefined;
  const story = (selection as { story?: unknown }).story;
  return story && typeof story === "object" ? story as StoryRaceRequest : undefined;
}

/** Read the outcome from the running session before the race is released. */
export function storyRaceOutcome(session: unknown): StoryRaceOutcome {
  const lifecycle = (session as { lifecycle?: { finishElapsedMs?: number;
    forcedResult?: "cleared" | "failed" } } | undefined)?.lifecycle;
  const elapsedMs = lifecycle?.finishElapsedMs ?? 0;
  const forced = lifecycle?.forcedResult;
  const outcome: StoryRaceOutcome = { finished: elapsedMs > 0 && forced !== "failed", elapsedMs };
  // Only a chase decides the result itself; otherwise the step's judge does.
  if (forced !== undefined) outcome.cleared = forced === "cleared";
  return outcome;
}
