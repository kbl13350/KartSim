import type { TimeAttackAction } from "./lifecycle";

interface Action2D {
  scheduleStart(atMs: number): void;
  showLap(lap: number, nowMs: number): void;
  showFinalLap(nowMs: number): void;
  showFinish(nowMs: number): void;
  showNewRecord(nowMs: number): void;
}

interface CountdownAudio {
  playNumber(): void;
  playGo(): void;
  playLap(): void;
  playFinalLap(): void;
}

interface TimeAttackResultView {
  show(result: { elapsedMs: number; bestMs: number; [key: string]: unknown }): void;
}

/** Minimal interface between the handwritten action logic and release presenter. */
export interface TimeAttackActionStage {
  readonly action2D: Action2D;
  readonly countdownAudio: CountdownAudio;
  ui?: {
    trackInfoCard?: { slideOut(): void };
    result?: TimeAttackResultView;
  };
  host: {
    session: {
      flyingPet?: { launch(): void };
      linkedCharacterPresentation?: { setMode(mode: number): void };
      raceAura?: { requestDespawn?(): void };
      cameraMode?: string;
      readyCamera?: { start(): void };
      pendingCharacterFinishMotion: number;
      lifecycle: {
        effectiveTime(rawNowMs: number): number;
        resultBeatTarget(): boolean;
        acceptLocalCompletion(): void;
      };
    };
    scene: { visible: boolean };
    input: { setEnabled(enabled: boolean): void };
    driveCameraman: { reset(): void };
    surroundCameraman: { reset(): void };
    getPhysics(): {
      setRaceMotionLocked(locked: boolean): void;
      timeAttackResultCounts(): Record<string, unknown>;
    };
    hud: {
      finishPerformanceRace(): void;
      showDebugText(message: string, kind: string): void;
    };
    audio: { bgm?: { playResult(beatTarget: boolean): void } };
    handleTimeAttackActionAudio(action: TimeAttackAction, rawNowMs: number): boolean;
    returnToReady(): Promise<unknown>;
    promoteTimeAttackRecord(elapsedMs: number, counts: Record<string, unknown>): Promise<unknown>;
  };
  handleTimeAttackFinishAction(action: TimeAttackAction, rawNowMs: number): boolean;
  showTimeAttackResult(action: Extract<TimeAttackAction, { kind: "show-result" }>, rawNowMs: number): void;
}

/** Apply lifecycle events in order; a finish event can change the lifecycle mid-batch. */
export function dispatchTimeAttackActions(
  stage: TimeAttackActionStage,
  actions: TimeAttackAction[],
  rawNowMs: number,
): void {
  const { host } = stage;
  for (const action of actions) {
    if (action.kind === "schedule-start-effect") {
      stage.action2D.scheduleStart(action.atMs);
      continue;
    }
    if (action.kind === "countdown-number" && action.value === 2) {
      host.session.flyingPet?.launch();
      host.session.linkedCharacterPresentation?.setMode(4);
    }
    if (action.kind === "countdown-number" && action.value === 1) {
      host.session.raceAura?.requestDespawn?.();
    }
    if (stage.handleTimeAttackFinishAction(action, rawNowMs)) continue;
    if (host.handleTimeAttackActionAudio(action, rawNowMs)) continue;
    switch (action.kind) {
      case "ready-camera":
        host.session.cameraMode = "ready";
        host.scene.visible = true;
        host.session.readyCamera?.start();
        host.input.setEnabled(true);
        break;
      case "switch-drive-camera":
        host.session.cameraMode = "drive";
        host.scene.visible = true;
        host.driveCameraman.reset();
        break;
      case "release-race":
        host.input.setEnabled(true);
        host.getPhysics().setRaceMotionLocked(false);
        break;
    }
  }
}

/** Countdown, lap and final-lap cues consumed by the HUD and audio owner. */
export function playTimeAttackActionAudio(
  stage: TimeAttackActionStage,
  action: TimeAttackAction,
  rawNowMs: number,
): boolean {
  const { host } = stage;
  switch (action.kind) {
    case "countdown-number":
      stage.countdownAudio.playNumber();
      return true;
    case "countdown-go":
      stage.countdownAudio.playGo();
      stage.ui?.trackInfoCard?.slideOut();
      return true;
    case "lap":
      stage.countdownAudio.playLap();
      stage.action2D.showLap(action.value, host.session.lifecycle.effectiveTime(rawNowMs));
      return true;
    case "final-lap":
      stage.countdownAudio.playFinalLap();
      stage.action2D.showFinalLap(host.session.lifecycle.effectiveTime(rawNowMs));
      return true;
    default:
      return false;
  }
}

/** Freeze driving at the finish, show the result, then return to Ready. */
export function handleTimeAttackFinishAction(
  stage: TimeAttackActionStage,
  action: TimeAttackAction,
  rawNowMs: number,
): boolean {
  const { host } = stage;
  switch (action.kind) {
    case "finish":
      host.session.pendingCharacterFinishMotion =
        host.session.lifecycle.resultBeatTarget() ? 12 : 13;
      host.getPhysics().setRaceMotionLocked(true);
      host.hud.finishPerformanceRace();
      stage.action2D.showFinish(host.session.lifecycle.effectiveTime(rawNowMs));
      host.session.lifecycle.acceptLocalCompletion();
      return true;
    case "switch-surround-camera":
      host.session.cameraMode = "surround";
      host.surroundCameraman.reset();
      return true;
    case "play-result-bgm":
      host.audio.bgm?.playResult(action.beatTarget);
      return true;
    case "show-result":
      stage.showTimeAttackResult(action, rawNowMs);
      return true;
    case "return-to-ready":
      host.returnToReady().catch(error => {
        host.hud.showDebugText(
          `Ready stage fail-closed：${error instanceof Error ? error.message : String(error)}`,
          "error",
        );
      });
      return true;
    default:
      return false;
  }
}

/** Display the race counts and persist a new local record when qualified. */
export function showTimeAttackResult(
  stage: TimeAttackActionStage,
  action: Extract<TimeAttackAction, { kind: "show-result" }>,
  rawNowMs: number,
): void {
  const { host } = stage;
  const result = stage.ui?.result;
  if (!result) throw new Error("TimeAttack result renderer 尚未建立。");
  const counts = host.getPhysics().timeAttackResultCounts();
  result.show({ elapsedMs: action.elapsedMs, bestMs: action.bestMs, ...counts });
  if (action.bestMs === action.elapsedMs) {
    stage.action2D.showNewRecord(host.session.lifecycle.effectiveTime(rawNowMs));
  }
  if (action.isNewRecord) {
    host.promoteTimeAttackRecord(action.elapsedMs, counts).catch(error => {
      host.hud.showDebugText(
        `TimeAttack record 保存失败：${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    });
  }
}
