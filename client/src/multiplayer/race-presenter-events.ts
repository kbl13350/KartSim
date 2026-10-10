/** Applies multiplayer race timing, route, and finish actions before camera work. */

export interface RacePresenterAction {
  kind: string;
  step?: number;
  atMs?: number;
  value?: number;
  outcome?: string;
}

export interface RacePresenterEventsHost {
  runtime: {
    local: {
      lifecycle: { state: unknown };
      track: { data: { lapTarget?: number } };
      consumeResetSound(): boolean;
      consumeLocalRouteTags(): unknown[];
    };
    finishDeadline?: number;
    roadBlockRemaining(nowMs: number): number | undefined;
    roadBlockRunnerProgress(): { lap: number } | undefined;
  };
  race: {
    roadblock?: boolean;
  };
  roadblockHud?: {
    setRemaining(remaining: number): void;
    setRunnerLaps(lap: number | undefined, target: number): void;
  };
  finishCountdown: { update(nowMs: number, deadline?: number): boolean };
  countdown?: {
    playFinishNumber(): void;
    playNumber(): void;
    playLap(): void;
    playFinalLap(): void;
  };
  cameraShake: { leave(force: boolean): void };
  cameraWave: { leave(): void };
  lightFactor: { update(): void };
  linkedPresentations: Map<unknown, { setMode(mode: number): void }>;
  views: Map<unknown, { resetAnimation(): void }>;
  flyingPet?: { launch(): void };
  assets: {
    participants: Array<{
      vehicle: { accessories: Array<{
        kind: string;
        render: { requestDespawn?(): void };
      }> };
    }>;
  };
  cameraMode: string;
  drive: { reset(): void };
  surround: { reset(): void };
  action2d: {
    scheduleStart(atMs: number | undefined): void;
    showLap(value: number | undefined, nowMs: number): void;
    showFinalLap(nowMs: number): void;
    showRetire(nowMs: number): void;
    showWinner(nowMs: number): void;
    showFinish(nowMs: number): void;
    showRaceOver(nowMs: number): void;
  };
  localRetirePending: boolean;
  finishBlackBar: { start(nowMs: number): void };
  bgm?: {
    playResult(won: boolean): void;
    playMultiplayerFinish(won: boolean): void;
  };
  winnerMotion: { acceptLocalFinish(outcome: string | undefined): void };
  playReset(): void;
  handleRouteTag(tag: unknown): void;
  applyLocalWarpActions(): void;
  playGoAndHideTrackInfo(): void;
}

export interface RacePresenterEventDependencies {
  racingState: unknown;
}

export function advanceRacePresenterEvents(host: RacePresenterEventsHost,
  nowMs: number, actions: RacePresenterAction[],
  dependencies: RacePresenterEventDependencies): void {
  const local = host.runtime.local;
  const track = local.track;
  const remaining = host.race.roadblock
    ? host.runtime.roadBlockRemaining(nowMs) : undefined;
  if (remaining !== undefined) {
    host.roadblockHud?.setRemaining(remaining);
    const lapTarget = track.data.lapTarget;
    if (lapTarget === undefined) {
      throw new Error("挡人HUD缺少赛道圈数。");
    }
    host.roadblockHud?.setRunnerLaps(
      host.runtime.roadBlockRunnerProgress()?.lap, lapTarget);
  }
  if (host.finishCountdown.update(nowMs,
    local.lifecycle.state === dependencies.racingState
      ? host.runtime.finishDeadline : undefined)) {
    host.countdown?.playFinishNumber();
  }
  if (local.consumeResetSound()) {
    host.cameraShake.leave(true);
    host.cameraWave.leave();
    host.playReset();
  }
  for (const tag of local.consumeLocalRouteTags()) host.handleRouteTag(tag);
  host.applyLocalWarpActions();
  host.lightFactor.update();

  for (const action of actions) {
    if (action.kind === "countdown") {
      if (action.step === 2) {
        for (const [playerId, linked] of host.linkedPresentations) {
          linked.setMode(4);
          host.views.get(playerId)?.resetAnimation();
        }
      }
      host.countdown?.playNumber();
      if (action.step === 2) host.flyingPet?.launch();
      if (action.step === 3) {
        for (const participant of host.assets.participants) {
          participant.vehicle.accessories.find(accessory =>
            accessory.kind === "aura")?.render.requestDespawn?.();
        }
      }
    }
    if (action.kind === "count-go") host.playGoAndHideTrackInfo();
    if (action.kind === "lap") host.countdown?.playLap();
    if (action.kind === "final-lap") host.countdown?.playFinalLap();
    if (action.kind === "switch-drive-camera") {
      host.cameraMode = "drive";
      host.drive.reset();
    }
    if (action.kind === "switch-surround-camera") {
      host.cameraMode = "surround";
      host.surround.reset();
    }
    if (action.kind === "start-effect") host.action2d.scheduleStart(action.atMs);
    if (action.kind === "lap") host.action2d.showLap(action.value, nowMs);
    if (action.kind === "final-lap") host.action2d.showFinalLap(nowMs);
    if (action.kind === "forced-finish" && !host.race.roadblock) {
      host.localRetirePending = true;
      host.action2d.showRetire(nowMs);
      host.finishBlackBar.start(nowMs);
      host.bgm?.playResult(false);
    }
    if (action.kind === "natural-finish" && !host.race.roadblock) {
      host.winnerMotion.acceptLocalFinish(action.outcome);
      host.finishBlackBar.start(nowMs);
      host.bgm?.playMultiplayerFinish(action.outcome === "winner");
      if (action.outcome === "winner") host.action2d.showWinner(nowMs);
      else host.action2d.showFinish(nowMs);
    }
    if (action.kind === "raceover") host.action2d.showRaceOver(nowMs);
  }
}
