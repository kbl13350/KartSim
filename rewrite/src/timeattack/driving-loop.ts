import { licenseItemsOf } from "../license/license-item-race";

interface RouteProgress { lap: number }

interface DrivingPhysics {
  body: { position: unknown };
  synchronizeClock(nowMs: number): void;
  consumeRailResetRequest(): boolean;
  consumeSpeedSlotReordered(): boolean;
  updateModeInventory(): boolean;
  timeAttackTeamGaugeSettledAtMs(): number;
}

interface DrivingTrack {
  data: { lapTarget?: number };
  getRouteState(physics: DrivingPhysics): RouteProgress;
  updateObstacles(nowMs: number, position: unknown): void;
  registerObstaclePair(position: unknown): void;
  commitObstacleSnapshot(): void;
}

interface DrivingLifecycle {
  phase: number;
  effectiveTime(rawNowMs: number): number;
  tick(input: {
    rawNowMs: number;
    routeProgress: number;
    finishThreshold: number;
    currentLap: number;
    totalLaps: number;
  }): unknown;
}

export interface TimeAttackDrivingStage {
  host: {
    session: {
      lifecycle: DrivingLifecycle;
      coordinator?: {
        run(nowMs: number, snapshot: unknown): {
          schedule: { nowMs: number };
          route: RouteProgress;
        };
      };
      tachometer?: unknown;
      warpBlackBar?: { setRatio(ratio: number): void };
      warpCameraFrozen?: boolean;
    };
    shell: { started: boolean; halted: boolean };
    ghostRecorder?: { update(nowMs: number): void };
    audio: { interfaceAudio?: { playSlotChanger(): void } };
    warpNext: {
      tick(nowMs: number): unknown;
      presentationVisible(nowMs: number): boolean;
      blackBarRatio(nowMs: number): number;
    };
    presentationClockMs: number;
    kartView: { root: { visible: boolean } };
    getPhysics(): DrivingPhysics;
    getTrack(): DrivingTrack;
    getDrivingSnapshot(): unknown;
    advanceResetCompletion(nowMs: number): void;
    handleTimeAttackActions(actions: unknown, rawNowMs: number): void;
    drainDrivingInput(effectiveNowMs: number, rawNowMs: number): void;
    updateActiveRaceCamera(nowMs: number): void;
    updateTimeAttackRoute(rawNowMs: number, previousLap: number, nextLap: number): void;
    applyWarpNextActions(actions: unknown): void;
  };
  ui?: {
    gameplayUi?: {
      startSlotReorder(): void;
      startBoostGaugeFull(): void;
      startTeamBoostGaugeFull(): void;
    };
  };
  lastTeamGaugeSettledAtMs: number;
  checkLowHeightReset(nowMs: number): void;
  checkAutomaticReset(nowMs: number): void;
  initiateSpeedReset(allowCurrentSpeed: boolean): void;
}

export interface DrivingLoopDependencies {
  isDrivingPhase(phase: number): boolean;
  isRaceFinished(lifecycle: DrivingLifecycle): boolean;
  countdownPhase: number;
  finishAcceptedPhase: number;
  refreshTachometer(tachometer: unknown): void;
}

/** Advance lifecycle, physics coordination, Ghost recording and race UI once. */
export function updateTimeAttackDriving(
  stage: TimeAttackDrivingStage,
  rawNowMs: number,
  dependencies: DrivingLoopDependencies,
): void {
  const { host } = stage;
  const effectiveNowMs = host.session.lifecycle.effectiveTime(rawNowMs);
  host.advanceResetCompletion(effectiveNowMs);
  stage.checkLowHeightReset(effectiveNowMs);
  stage.checkAutomaticReset(effectiveNowMs);

  const previousRoute = host.getTrack().getRouteState(host.getPhysics());
  const lapTarget = host.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER;
  const actions = host.session.lifecycle.tick({
    rawNowMs,
    routeProgress: previousRoute.lap,
    finishThreshold: lapTarget,
    currentLap: previousRoute.lap,
    totalLaps: host.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER,
  });
  host.handleTimeAttackActions(actions, rawNowMs);
  if (!host.shell.started) return;

  host.drainDrivingInput(effectiveNowMs, rawNowMs);
  if (!dependencies.isDrivingPhase(host.session.lifecycle.phase)) {
    host.getPhysics().synchronizeClock(effectiveNowMs);
    host.getTrack().updateObstacles(effectiveNowMs, host.getPhysics().body.position);
    host.getTrack().registerObstaclePair(host.getPhysics().body.position);
    host.getTrack().commitObstacleSnapshot();
    host.updateActiveRaceCamera(effectiveNowMs);
    return;
  }

  if (host.getPhysics().consumeRailResetRequest()) stage.initiateSpeedReset(false);
  if (host.shell.halted) {
    host.getPhysics().synchronizeClock(effectiveNowMs);
    return;
  }
  const drivingSnapshot = host.getDrivingSnapshot();
  if (!host.session.coordinator) {
    throw new Error("TimeAttack normal coordinator 尚未建立。");
  }
  // 驾照考试 item steps: the item race runs before the physics step (道具赛 order).
  const licenseItems = licenseItemsOf(host.session);
  licenseItems?.update(host as never, rawNowMs);
  if (licenseItems?.consumeSlotChangerSound()) host.audio.interfaceAudio?.playSlotChanger();
  const { schedule, route } = host.session.coordinator.run(effectiveNowMs, drivingSnapshot);
  host.updateTimeAttackRoute(rawNowMs, previousRoute.lap, route.lap);
  if (host.session.lifecycle.phase >= dependencies.countdownPhase &&
      host.session.lifecycle.phase <= dependencies.finishAcceptedPhase) {
    host.ghostRecorder?.update(effectiveNowMs);
  }
  if (host.getPhysics().consumeRailResetRequest()) stage.initiateSpeedReset(false);
  if (host.getPhysics().consumeSpeedSlotReordered()) {
    stage.ui?.gameplayUi?.startSlotReorder();
    host.audio.interfaceAudio?.playSlotChanger();
  }
  if (host.getPhysics().updateModeInventory()) {
    if (host.session.tachometer) dependencies.refreshTachometer(host.session.tachometer);
    stage.ui?.gameplayUi?.startBoostGaugeFull();
  }
  const settledAtMs = host.getPhysics().timeAttackTeamGaugeSettledAtMs();
  if (settledAtMs !== stage.lastTeamGaugeSettledAtMs) {
    stage.lastTeamGaugeSettledAtMs = settledAtMs;
    if (settledAtMs !== 0) stage.ui?.gameplayUi?.startTeamBoostGaugeFull();
  }
  if (!dependencies.isRaceFinished(host.session.lifecycle)) {
    host.applyWarpNextActions(host.warpNext.tick(host.presentationClockMs));
  }
  if (!host.warpNext.presentationVisible(host.presentationClockMs)) {
    host.kartView.root.visible = false;
  }
  host.session.warpBlackBar?.setRatio(host.warpNext.blackBarRatio(host.presentationClockMs));
  if (!host.session.warpCameraFrozen) host.updateActiveRaceCamera(schedule.nowMs);
}
