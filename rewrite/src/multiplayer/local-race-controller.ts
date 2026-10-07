import { initializeLocalRace } from "./local-race-construction.js";
import type { LocalRaceConstructionOps } from "./local-race-construction.js";
import {
  requestLocalRaceReset, checkLocalRaceAutomaticReset, advanceLocalRaceReset,
  acceptLocalRaceEndTiming, handleLocalRaceRouteTag, applyLocalRaceWarpActions,
  scheduleLocalRaceStart, localRaceScheduledStartAtMs, localRaceStartBoosterWindow,
  localRaceProgress, localRaceElapsedMs, updateLocalRace,
} from "./local-race-runtime.js";
import type { LocalRaceDependencies } from "./local-race-runtime.js";

/** Factories for state owners supplied by the recovered game runtime. */
export interface LocalRaceControllerDependencies {
  construction: LocalRaceConstructionOps;
  runtime: LocalRaceDependencies;
  makeLapTiming(): any;
  makeLifecycle(): any;
  makeResetState(): any;
  makeWarpNext(): any;
  resetVisible(state: any, value: unknown): boolean;
}

/** Local player's race state after multiplayer assets are assembled. */
export class LocalRaceController {
  readonly dependencies: LocalRaceControllerDependencies;
  assets: any;
  lapTiming: any;
  boostGaugeFull = false;
  physics: any;
  track: any;
  lifecycle: any;
  startPose: any;
  coordinator: any;
  scheduled = false;
  clockOriginMs = 0;
  disposed = false;
  lte: any;
  giant: any;
  isRoadBlockRunner: any;
  roadblock: any;
  naturallyFinished = false;
  forcedElapsedMs: number | undefined;
  readonly pendingActions: any[] = [];
  finishDeadline: number | undefined;
  raceOverAt: number | undefined;
  resultsReady = false;
  resetState: any;
  lowSpeedResetStartedAtMs = 0;
  resetSoundPending = false;
  roadBlockResetNoticePending = false;
  readonly pendingRouteTags: string[] = [];
  warpNext: any;
  readonly pendingWarpActions: any[] = [];
  routeClockMs = 0;

  constructor(assets: any, room: any, playerId: string,
    dependencies: LocalRaceControllerDependencies) {
    this.dependencies = dependencies;
    this.lapTiming = dependencies.makeLapTiming();
    this.lifecycle = dependencies.makeLifecycle();
    this.resetState = dependencies.makeResetState();
    this.warpNext = dependencies.makeWarpNext();
    initializeLocalRace(this, assets, room, playerId, dependencies.construction);
  }

  consumeLocalRouteTags(): string[] { return this.pendingRouteTags.splice(0); }
  consumeWarpActions(): any[] { return this.pendingWarpActions.splice(0); }

  lteAvailable(): boolean {
    return !this.disposed &&
      this.lifecycle.state === this.dependencies.runtime.states.Racing &&
      this.resetState.phase === 0 && !this.warpNext.blocksDriving() &&
      this.physics.lteDodgeAvailable();
  }

  handleModeDrivingCommand(command: unknown, time: unknown): boolean {
    return this.lte?.dispatch(command, time, this.lteAvailable()) ?? false;
  }

  cancelModeDrivingInput(): void { this.lte?.cancel(); }

  requestReset(playerRequested = true): boolean {
    return requestLocalRaceReset(this, this.dependencies.runtime, playerRequested);
  }

  consumeResetSound(): boolean {
    const pending = this.resetSoundPending;
    this.resetSoundPending = false;
    return pending;
  }

  consumeRoadBlockResetNotice(): boolean {
    const pending = this.roadBlockResetNoticePending;
    this.roadBlockResetNoticePending = false;
    return !!pending;
  }

  get resetStartedAt(): number | undefined {
    return this.resetState.phase !== 0 && this.resetState.startMs !== 0
      ? this.resetState.startMs : undefined;
  }

  checkAutomaticReset(now: number, stepSeconds: number): void {
    checkLocalRaceAutomaticReset(this, this.dependencies.runtime, now, stepSeconds);
  }

  resetVisible(value: unknown): boolean {
    return this.dependencies.resetVisible(this.resetState, value);
  }

  get resetSuspended(): boolean {
    return this.resetState.phase === 1 || this.resetState.phase === 2;
  }

  advanceReset(now: number): void {
    advanceLocalRaceReset(this, this.dependencies.runtime, now);
  }

  acceptEndTiming(finishDeadline: number | undefined,
    raceOverAt: number | undefined, resultsReady: boolean): void {
    acceptLocalRaceEndTiming(this, this.dependencies.runtime,
      finishDeadline, raceOverAt, resultsReady);
  }

  handleLocalRouteTag(tag: string): void {
    handleLocalRaceRouteTag(this, this.dependencies.runtime, tag);
  }

  applyWarpActions(actions: any[]): void { applyLocalRaceWarpActions(this, actions); }
  scheduleStart(startAt: number): void { scheduleLocalRaceStart(this, startAt); }
  get scheduledStartAtMs(): number { return localRaceScheduledStartAtMs(this); }
  isStartBoosterWindow(now: number): boolean {
    return localRaceStartBoosterWindow(this, this.dependencies.runtime, now);
  }
  raceProgress(): ReturnType<typeof localRaceProgress> { return localRaceProgress(this); }
  elapsedMs(now: number): number { return localRaceElapsedMs(this, this.dependencies.runtime, now); }
  update(now: number, stepSeconds: number): void {
    updateLocalRace(this, this.dependencies.runtime, now, stepSeconds);
  }

  queueRemoteKart(kart: unknown, collide: unknown): void {
    this.coordinator.queueRemoteKart(kart, collide);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.roadBlockResetNoticePending = false;
    this.lte?.dispose();
    this.giant?.dispose();
    if (this.giant) this.physics.clearGiantRaceEffects();
    this.warpNext.reset();
    this.physics.hardCancelControls();
    this.physics.setRaceMotionLocked(true);
    this.coordinator.dispose();
    this.track.group.removeFromParent();
    this.track.group.clear();
  }
}
