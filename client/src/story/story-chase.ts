import { storyRaceOf } from "./story-race";

/**
 * Story Tracing (追击) and Escape (逃脱): the rival is a ghost that sets off
 * startOffset ms ahead of (Tracing) or behind (Escape) the player, and the gap
 * between them is measured along the route in metres (one world unit).
 *
 * Tracing: pass the rival before it finishes; once within `distance` metres,
 * falling more than that behind fails. (The release's own check is not in the
 * data: with a head start the rival begins further away than the limit on most
 * steps, so the limit applies from the first time the player closes in.)
 * Escape: stay ahead; being caught (gap 0) fails, reaching the finish clears.
 */

export interface ChaseRule {
  kind: "Tracing" | "Escape";
  startOffsetMs: number;
  /** Tracing limit in metres; Escape does not use it. */
  distanceM: number;
  /** The rival recording's own race time (KSV bestTimeMs). */
  rivalTimeMs: number;
}

export type ChaseVerdict = "cleared" | "failed";

/** Race ms at which the rival crosses the line. */
export function rivalFinishRaceMs(rule: ChaseRule): number {
  return rule.rivalTimeMs > 0 ? rule.rivalTimeMs - rule.startOffsetMs : Number.POSITIVE_INFINITY;
}

/** The tracingPanel number: metres the rival leads (Tracing) or trails (Escape). */
export function chaseHudMetres(rule: ChaseRule, leadM: number): number {
  const metres = rule.kind === "Tracing" ? -leadM : leadM;
  return Math.min(999, Math.max(0, Math.trunc(metres)));
}

/** Per race: arms the distance check and remembers the verdict. */
export class ChaseJudge {
  private armed = false;
  private verdict?: ChaseVerdict;

  constructor(readonly rule: ChaseRule) {}

  get result(): ChaseVerdict | undefined {
    return this.verdict;
  }

  /**
   * One racing frame. `raceMs` is the time since GO, `leadM` the route metres
   * the player is ahead of the rival (negative: behind).
   */
  update(raceMs: number, leadM: number): ChaseVerdict | undefined {
    if (this.verdict || raceMs <= 0 || !Number.isFinite(leadM)) return this.verdict;
    const { kind, distanceM, startOffsetMs } = this.rule;
    if (kind === "Tracing") {
      const behind = -leadM;
      if (behind <= 0) return (this.verdict = "cleared");
      if (behind <= distanceM) this.armed = true;
      if (this.armed && behind > distanceM) return (this.verdict = "failed");
      if (raceMs >= rivalFinishRaceMs(this.rule)) return (this.verdict = "failed");
    } else {
      // Both karts start on the grid: only once the rival is off and behind.
      if (raceMs >= Math.max(0, -startOffsetMs) && leadM > 0) this.armed = true;
      if (this.armed && leadM <= 0) return (this.verdict = "failed");
    }
    return undefined;
  }

  /** At the finish line: Escape is cleared; Tracing only ahead of the rival. */
  finish(elapsedMs: number): boolean {
    if (this.verdict) return this.verdict === "cleared";
    const cleared = this.rule.kind === "Escape" || elapsedMs < rivalFinishRaceMs(this.rule);
    this.verdict = cleared ? "cleared" : "failed";
    return cleared;
  }
}

/** The finish-line rule without per-frame state, for StoryRaceRequest.judge. */
export function chaseFinishCleared(rule: ChaseRule, elapsedMs: number): boolean {
  return new ChaseJudge(rule).finish(elapsedMs);
}

// ---------------------------------------------------------------------------
// Per-frame hook in the time attack stage update.

interface ChaseLifecycle {
  phase: number;
  startAtMs: number;
  finishAtMs: number;
  effectiveTime(rawNowMs: number): number;
  forceFinish?(rawNowMs: number, result: { failed: boolean }): unknown[];
}

export interface ChaseStage {
  host: {
    paused: boolean;
    session: {
      selection?: unknown;
      lifecycle: ChaseLifecycle;
      ghosts: unknown[];
      warpHud?: { hidden?: boolean };
    };
    getPhysics(): unknown;
    getTrack(): { getRouteState(owner: unknown): { distance: number } | undefined };
    handleTimeAttackActions?(actions: unknown[], rawNowMs: number): void;
  };
  ghostRouteProgress?: { distance(ghost: unknown): number };
  ui?: { action2D?: { setChaseDistance?(metres: number | undefined): void } };
}

const judges = new WeakMap<object, ChaseJudge>();

/** Route metres the player is ahead of the first ghost (negative: behind). */
export function chaseLeadMetres(stage: ChaseStage): number | undefined {
  const ghost = stage.host.session.ghosts[0];
  if (!ghost || !stage.ghostRouteProgress) return undefined;
  const player = stage.host.getTrack().getRouteState(stage.host.getPhysics())?.distance;
  if (player === undefined) return undefined;
  return Math.fround(player - stage.ghostRouteProgress.distance(ghost));
}

/** Show the gap and end the race once the chase is decided. No-op outside story chases. */
export function updateStoryChase(stage: ChaseStage, rawNowMs: number): void {
  const { host } = stage;
  const rule = storyRaceOf(host.session.selection)?.chase;
  if (!rule) return;
  const lifecycle = host.session.lifecycle;
  const lead = chaseLeadMetres(stage);
  const live = lead !== undefined && lifecycle.startAtMs !== 0 && lifecycle.finishAtMs === 0;
  stage.ui?.action2D?.setChaseDistance?.(live && !host.session.warpHud?.hidden
    ? chaseHudMetres(rule, lead!) : undefined);
  if (!live || host.paused || lifecycle.phase !== 2) return;
  // A new lifecycle per race (retry included) gets a fresh judge.
  let judge = judges.get(lifecycle);
  if (!judge) judges.set(lifecycle, judge = new ChaseJudge(rule));
  const raceMs = lifecycle.effectiveTime(rawNowMs) - lifecycle.startAtMs;
  const verdict = judge.update(raceMs, lead!);
  if (!verdict || !lifecycle.forceFinish) return;
  const actions = lifecycle.forceFinish(rawNowMs, { failed: verdict === "failed" });
  if (actions.length) host.handleTimeAttackActions?.(actions, rawNowMs);
}
