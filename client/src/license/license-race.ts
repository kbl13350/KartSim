import { storyRaceOf } from "../story/story-race";

/**
 * The 驾照考试 time limit inside a race: the mission timer counts the step's
 * time down from GO, and running out ends the race as failed (the release
 * RiderSchoolSpeedStage retires the rider when its missionTimer reaches 0).
 */

interface TimerLifecycle {
  phase: number;
  startAtMs: number;
  finishAtMs: number;
  effectiveTime(rawNowMs: number): number;
  forceFinish?(rawNowMs: number, result: { failed: boolean }): unknown[];
}

export interface LicenseTimerStage {
  host: {
    paused: boolean;
    session: { selection?: unknown; lifecycle: TimerLifecycle; warpHud?: { hidden?: boolean } };
    handleTimeAttackActions?(actions: unknown[], rawNowMs: number): void;
  };
  ui?: { action2D?: { setMissionTime?(remainingMs: number | undefined): void } };
}

/** The mission timer's red digits take over for the last ten seconds. */
export const MISSION_TIMER_WARN_MS = 10_000;

/** "mm", "ss", "cc" (hundredths) of a remaining time, floored at zero. */
export function missionTimerDigits(remainingMs: number): [string, string, string] {
  const total = Math.max(0, Math.floor(remainingMs / 10));
  const pad = (value: number): string => String(value).padStart(2, "0");
  return [pad(Math.min(99, Math.floor(total / 6000))), pad(Math.floor(total / 100) % 60), pad(total % 100)];
}

/** Milliseconds a step has left at race time raceMs (never below zero). */
export function licenseRemainingMs(limitMs: number, raceMs: number): number {
  return Math.max(0, limitMs - Math.max(0, raceMs));
}

/** Show the time left and fail the race when it runs out. No-op without a time limit. */
export function updateLicenseTimer(stage: LicenseTimerStage, rawNowMs: number): void {
  const { host } = stage;
  const limit = storyRaceOf(host.session.selection)?.timeLimitMs;
  if (!limit || limit <= 0) return;
  const lifecycle = host.session.lifecycle;
  const started = lifecycle.startAtMs !== 0;
  const raceMs = started ? lifecycle.effectiveTime(rawNowMs) - lifecycle.startAtMs : 0;
  // Before GO the timer shows the full time; it stays up until the finish.
  const shown = lifecycle.finishAtMs === 0 && !host.session.warpHud?.hidden;
  stage.ui?.action2D?.setMissionTime?.(shown ? licenseRemainingMs(limit, raceMs) : undefined);
  if (!started || lifecycle.finishAtMs !== 0 || host.paused || lifecycle.phase !== 2) return;
  if (raceMs < limit || !lifecycle.forceFinish) return;
  const actions = lifecycle.forceFinish(rawNowMs, { failed: true });
  if (actions.length) host.handleTimeAttackActions?.(actions, rawNowMs);
}
