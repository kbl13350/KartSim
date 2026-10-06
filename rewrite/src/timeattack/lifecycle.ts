/** Events emitted by a single-player time attack. The presenter applies them. */
export type TimeAttackAction =
  | { kind: "ready-camera" }
  | { kind: "schedule-start-effect"; atMs: number }
  | { kind: "countdown-prepare" }
  | { kind: "countdown-number"; value: 1 | 2 | 3 }
  | { kind: "switch-drive-camera" }
  | { kind: "release-race"; startAtMs: number }
  | { kind: "countdown-go" }
  | { kind: "pause-race" }
  | { kind: "resume-race" }
  | { kind: "finish"; elapsedMs: number }
  | { kind: "switch-surround-camera" }
  | { kind: "play-result-bgm"; beatTarget: boolean }
  | { kind: "final-lap" }
  | { kind: "lap"; value: number }
  | {
    kind: "show-result";
    elapsedMs: number;
    previousBestMs: number | null;
    bestMs: number;
    isNewRecord: boolean;
  }
  | { kind: "return-to-ready" };

export interface TimeAttackTick {
  rawNowMs: number;
  currentLap: number;
  totalLaps: number;
  routeProgress: number;
  finishThreshold: number;
}

/** The original client keeps all race timestamps in unsigned 32-bit milliseconds. */
function clockMs(value: number): number {
  return Math.trunc(value) >>> 0;
}

function isAfter(now: number, threshold: number): boolean {
  return clockMs(now) > clockMs(threshold);
}

/** Counts completed laps and retains the fastest completed lap. */
export class LapTiming {
  bestLapMs = 0;
  timedLap = 0;
  lapStartedAtMs = 0;

  reset(): void {
    this.bestLapMs = this.timedLap = this.lapStartedAtMs = 0;
  }

  update(nowMs: number, currentLap: number): boolean {
    if (currentLap !== this.timedLap + 1) return false;
    const completedLap = this.timedLap !== 0;
    if (completedLap) {
      const duration = (nowMs - this.lapStartedAtMs) >>> 0;
      this.bestLapMs = this.bestLapMs === 0
        ? duration
        : Math.min(this.bestLapMs, duration);
    }
    this.lapStartedAtMs = nowMs;
    this.timedLap = currentLap;
    return completedLap;
  }
}

/**
 * The time attack clock and event state machine. It does no rendering or I/O;
 * the generated presenter consumes its actions until that layer is migrated.
 */
export class TimeAttackLifecycle {
  readonly previousBestMs: number | null;
  phase = 0; // 0 idle, 1 countdown, 2 racing, 3 finish accepted, 4 result, 5 paused
  countdownSubstate = 0;
  startAtMs = 0;
  finishAtMs = 0;
  finishElapsedMs = 0;
  lapTiming = new LapTiming();
  pausedTotalMs = 0;
  pauseAnchorRawMs = 0;
  finalLapShown = false;
  returnedToReady = false;

  constructor(previousBestMs: number | null = null) {
    this.previousBestMs = previousBestMs;
  }

  get bestLapMs(): number {
    return this.lapTiming.bestLapMs;
  }

  resultBeatTarget(): boolean {
    return this.previousBestMs === null || this.finishElapsedMs < this.previousBestMs;
  }

  reset(): TimeAttackAction[] {
    this.phase = 0;
    this.countdownSubstate = 0;
    this.startAtMs = 0;
    this.finishAtMs = 0;
    this.finishElapsedMs = 0;
    this.lapTiming.reset();
    this.pausedTotalMs = 0;
    this.pauseAnchorRawMs = 0;
    this.finalLapShown = false;
    this.returnedToReady = false;
    return [{ kind: "ready-camera" }];
  }

  tick(input: TimeAttackTick): TimeAttackAction[] {
    const rawNow = clockMs(input.rawNowMs);
    if (this.phase === 5) {
      if (this.pauseAnchorRawMs === 0) {
        this.pauseAnchorRawMs = rawNow;
      } else {
        this.pausedTotalMs = clockMs(
          this.pausedTotalMs + clockMs(rawNow - this.pauseAnchorRawMs),
        );
        this.pauseAnchorRawMs = rawNow;
      }
      return [];
    }
    const now = clockMs(rawNow - this.pausedTotalMs);
    switch (this.phase) {
      case 0:
        this.phase = 1;
        this.startAtMs = clockMs(now + 7000);
        return [{ kind: "schedule-start-effect", atMs: clockMs(this.startAtMs - 3000) }];
      case 1:
        return this.updateCountdown(now);
      case 2:
        return this.updateRacing(now, input);
      case 3:
        return this.updateFinishAccepted(now);
      case 4:
        return this.updateResult(now);
      default:
        return [];
    }
  }

  togglePause(rawNowMs: number): TimeAttackAction[] {
    const now = clockMs(rawNowMs);
    if (this.phase === 2) {
      this.phase = 5;
      this.pauseAnchorRawMs = now;
      return [{ kind: "pause-race" }];
    }
    if (this.phase === 5) {
      this.pausedTotalMs = clockMs(
        this.pausedTotalMs + clockMs(now - this.pauseAnchorRawMs),
      );
      this.pauseAnchorRawMs = 0;
      this.phase = 2;
      return [{ kind: "resume-race" }];
    }
    return [];
  }

  effectiveTime(rawNowMs: number): number {
    const now = clockMs(rawNowMs);
    const currentPauseMs = this.phase === 5 && this.pauseAnchorRawMs !== 0
      ? clockMs(now - this.pauseAnchorRawMs)
      : 0;
    return clockMs(now - clockMs(this.pausedTotalMs + currentPauseMs));
  }

  isStartBoosterWindow(rawNowMs: number): boolean {
    const now = clockMs(rawNowMs);
    return this.startAtMs !== 0 &&
      clockMs(this.startAtMs + 100) >= now &&
      clockMs(this.startAtMs - 100) <= now;
  }

  acceptLocalCompletion(): void {
    if (this.phase === 2 && this.finishAtMs !== 0) this.phase = 3;
  }

  updateCountdown(now: number): TimeAttackAction[] {
    const threshold = (beforeStartMs: number) => now >= clockMs(this.startAtMs - beforeStartMs);
    switch (this.countdownSubstate) {
      case 0:
        if (!threshold(6000)) return [];
        this.countdownSubstate = 1;
        return [{ kind: "countdown-prepare" }];
      case 1:
        if (!threshold(3000)) return [];
        this.countdownSubstate = 2;
        return [{ kind: "countdown-number", value: 3 }, { kind: "switch-drive-camera" }];
      case 2:
        if (!threshold(2000)) return [];
        this.countdownSubstate = 3;
        return [{ kind: "countdown-number", value: 2 }];
      case 3:
        if (!threshold(1000)) return [];
        this.countdownSubstate = 4;
        return [{ kind: "countdown-number", value: 1 }];
      case 4:
        if (!threshold(0)) return [];
        this.phase = 2;
        return [{ kind: "release-race", startAtMs: this.startAtMs }, { kind: "countdown-go" }];
      default:
        return [];
    }
  }

  updateRacing(now: number, input: TimeAttackTick): TimeAttackAction[] {
    const newLap = this.updateLapTiming(now, input.currentLap);
    if (
      this.countdownSubstate === 4 &&
      input.routeProgress > input.finishThreshold &&
      this.finishAtMs === 0
    ) {
      this.finishAtMs = now;
      this.finishElapsedMs = clockMs(now - this.startAtMs);
      return [
        { kind: "finish", elapsedMs: this.finishElapsedMs },
        { kind: "switch-surround-camera" },
        { kind: "play-result-bgm", beatTarget: this.resultBeatTarget() },
      ];
    }
    if (newLap) {
      if (input.currentLap === input.totalLaps) {
        if (!this.finalLapShown) {
          this.finalLapShown = true;
          return [{ kind: "final-lap" }];
        }
      } else if (input.currentLap > 1) {
        return [{ kind: "lap", value: input.currentLap }];
      }
    }
    return [];
  }

  updateLapTiming(now: number, currentLap: number): boolean {
    return this.lapTiming.update(now, currentLap);
  }

  updateFinishAccepted(now: number): TimeAttackAction[] {
    if (!isAfter(now, this.finishAtMs + 3000)) return [];
    this.phase = 4;
    const bestMs = this.previousBestMs === null
      ? this.finishElapsedMs
      : Math.min(this.previousBestMs, this.finishElapsedMs);
    return [{
      kind: "show-result",
      elapsedMs: this.finishElapsedMs,
      previousBestMs: this.previousBestMs,
      bestMs,
      isNewRecord: this.previousBestMs === null || this.finishElapsedMs <= this.previousBestMs,
    }];
  }

  updateResult(now: number): TimeAttackAction[] {
    if (this.returnedToReady || !isAfter(now, this.finishAtMs + 8000)) return [];
    this.returnedToReady = true;
    return [{ kind: "return-to-ready" }];
  }
}
