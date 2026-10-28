import { FormulaRaceEngine, type FormulaNpcSample, type FormulaRaceSnapshot } from './formula-engine';
import type { FormulaRaceRequest } from './formula-race';
import { FormulaHud } from './formula-ui';
import type { TimeAttackAction } from '../timeattack/lifecycle';

/** Adapter to the recovered solo renderer/physics. AI samples are live world
 * poses, not replay stamps. Only this boundary touches the legacy host. */
export class FormulaRuntime {
  readonly engine: FormulaRaceEngine;
  private hud?: FormulaHud;
  private disposed = false;
  private returning = false;
  private returnRetryAtMs = 0;
  private returnGeneration = 0;
  private rawNowMs = 0;
  private keyTarget?: Window;
  private frameHost?: any;
  state: FormulaRaceSnapshot;
  private readonly keydown = (event: KeyboardEvent): void => {
    if (event.code !== 'Space' || event.repeat) return;
    if (event.target instanceof HTMLElement && (event.target.isContentEditable ||
        /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))) return;
    if (!this.canActivate()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.activate();
  };

  constructor(readonly request: FormulaRaceRequest, private readonly host: any,
    private readonly track: any, private readonly physics: any) {
    const data = track.data;
    this.engine = new FormulaRaceEngine({
      sections: track.sections, firstSection: data.firstSection, lastSection: data.lastSection,
      start: track.getStart(), laps: data.lapTarget,
      difficulty: request.difficulty, groupId: request.groupId, round: request.round,
      trackId: request.trackId,
      groundAt: position => {
        // Surface queries reuse a scratch hit. Each NPC must own its position.
        const hit = track.rayQuery({ ...position, y: position.y + 5 },
          { x: 0, y: -12, z: 0 }, false);
        return hit ? { ...hit.point } : undefined;
      },
    });
    this.state = this.engine.snapshot;
  }

  /** Published only after the entire race has loaded successfully. */
  mount(): void {
    this.hud = new FormulaHud({ root: this.host.root, library: this.host.getLibrary(),
      onActivate: () => this.activate() });
    this.keyTarget = this.host.root.ownerDocument.defaultView ?? undefined;
    this.keyTarget?.addEventListener('keydown', this.keydown, true);
    this.renderHud();
  }

  reset(): void {
    this.engine.reset();
    this.state = this.engine.snapshot;
    this.request.result = undefined;
    this.returning = false;
    this.returnRetryAtMs = 0;
    this.returnGeneration++;
    this.applyBoost(false);
    this.renderHud();
  }

  private canActivate(): boolean {
    return !this.disposed && this.frameHost && this.frameHost.session.formula === this && !this.frameHost.paused &&
      this.frameHost.session.lifecycle.phase === 2;
  }

  activate(): boolean {
    if (!this.canActivate() || !this.engine.activate()) return false;
    this.state = this.engine.snapshot;
    this.applyBoost(true);
    this.renderHud();
    return true;
  }

  private applyBoost(active: boolean): void {
    // Reconstructed force multiplier, kept separate from drift N2O inventory.
    this.physics.setMultiplayerDrivingScales({ catchupDrag: 1, catchupSteering: 1,
      draftAcceleration: active ? 2.2 : 1, chargerDuration: 1 });
  }

  /** Called once per render after local physics, including after local finish. */
  update(rawNowMs: number, frameHost: any): void {
    this.frameHost = frameHost;
    this.rawNowMs = rawNowMs;
    if (this.disposed || this.returning || frameHost.session.formula !== this) return;
    const lifecycle = frameHost.session.lifecycle;
    if (!frameHost.paused && lifecycle.startAtMs && lifecycle.phase >= 2) {
      const elapsedMs = Math.max(0, lifecycle.effectiveTime(rawNowMs) - lifecycle.startAtMs);
      const body = this.physics.body;
      const finished = lifecycle.finishElapsedMs > 0 && lifecycle.forcedResult !== 'failed';
      const snapshot = this.state = this.engine.update(elapsedMs, {
        position: { ...body.position }, forward: { ...body.forward },
        progress: this.track.getRouteState(this.physics).distance,
        speedKmh: this.physics.state.speedKmh ?? Math.hypot(body.linearVelocity?.x ?? 0,
          body.linearVelocity?.y ?? 0, body.linearVelocity?.z ?? 0) * 3.6,
        name: this.request.playerName ?? frameHost.session.localName ?? '自己',
        finished,
        finishedMs: finished ? lifecycle.finishElapsedMs : undefined,
      });
      this.applyBoost(snapshot.boosting);
      if (snapshot.raceOver && rawNowMs >= this.returnRetryAtMs) {
        if (!this.request.result) {
          this.request.result = this.engine.settle();
          this.physics.setRaceMotionLocked(true);
          frameHost.input.setEnabled(false);
        }
        this.returning = true;
        const generation = ++this.returnGeneration;
        const current = (): boolean => !this.disposed && generation === this.returnGeneration &&
          frameHost.session.formula === this;
        const retry = (error?: unknown): void => {
          if (!current()) return;
          this.returning = false;
          this.returnRetryAtMs = this.rawNowMs + 2000;
          if (error !== undefined)
            this.host.hud.showDebugText(`极速方程结算返回失败：${String(error)}`, 'error');
        };
        // Finish rendering this frame before Ready disposes its scene owners.
        queueMicrotask(() => {
          if (!current()) return;
          // The app's navigation boundary logs load failures and resolves its
          // Promise. Confirm that it actually left the race before accepting
          // success, and back off instead of retrying on every render frame.
          Promise.resolve().then(() => current() ? this.host.returnToReady() : undefined)
            .then(() => { if (current() && frameHost.shell.started) retry(); }, retry);
        });
      }
    }
    this.renderHud();
  }

  private renderHud(): void {
    const state = this.state;
    const lifecycle = this.frameHost?.session.lifecycle;
    this.hud?.update({ round: this.request.round, rank: state.playerRank,
      energy: state.charge, boosting: state.boosting, hits: state.hits, inPit: state.inPit,
      paused: !!this.frameHost?.paused || (lifecycle?.phase ?? 0) < 2,
      finished: (lifecycle?.finishElapsedMs ?? 0) > 0,
      countdown: state.finishDeadlineMs === undefined ? undefined
        : Math.max(0, Math.ceil((state.finishDeadlineMs - state.timeMs) / 1000)),
    });
  }

  playback(index: number): { sample(timeMs: number): unknown; visitRouteStamps(): void } {
    const id = this.state.npcs[index]?.id;
    if (id === undefined) throw new Error(`极速方程缺少 NPC ${index + 1}`);
    return {
      sample: () => {
        const pose = this.state.npcs[index]!;
        return { sample: { status: pose.boosting ? 3 : 0, timeMs: this.state.timeMs },
          formulaPose: pose, speedKmh: pose.speedKmh };
      },
      visitRouteStamps: () => {},
    };
  }

  startNpc(index: number): FormulaNpcSample { return this.state.npcs[index]!; }

  /** Let normal finish lock the player, but keep the NPC field alive until the
   * first finisher's 30-second deadline. No time-attack record/result is saved. */
  consumes(action: TimeAttackAction): boolean {
    return action.kind === 'show-result' || action.kind === 'return-to-ready' ||
      action.kind === 'play-result-bgm';
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.returnGeneration++;
    this.applyBoost(false);
    this.keyTarget?.removeEventListener('keydown', this.keydown, true);
    this.hud?.dispose();
  }
}

export function formulaOf(session: unknown): FormulaRuntime | undefined {
  return (session as { formula?: FormulaRuntime } | undefined)?.formula;
}
