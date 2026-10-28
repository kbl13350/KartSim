import type { TimeAttackAction } from "./lifecycle";
import { storyRaceOf } from "../story/story-race";
import type { TimeAttackRunDetails } from "../account/rewards";
import { encodeRunReplay, rankedRaceOf, recordSpeedChannel, replayBase64 } from "./ranked-race";
import { observeOf } from "./replay-observe";
import { settleBrowserTimeAttackRun } from "./timeattack-settle";
import { noteReplayRecorded, runRecordKey } from "./ready-replays";
import { formulaOf } from "../formula/formula-runtime";

interface Action2D {
  scheduleStart(atMs: number): void;
  showLap(lap: number, nowMs: number): void;
  showFinalLap(nowMs: number): void;
  showFinish(nowMs: number): void;
  /**
   * Story races: retire@zz (未完成) for a mission that failed. StoryAction2D
   * answers false when the banner did not load; the plain release Action2D
   * (a story race whose mission animation failed) shows it and answers nothing.
   */
  showRetire?(nowMs: number): boolean | void;
  showNewRecord(nowMs: number): void;
  /** Story races: the release mission success / fail animation. */
  showMissionResult?(success: boolean, nowMs: number): void;
}

interface CountdownAudio {
  playNumber(): void;
  playGo(): void;
  playLap(): void;
  playFinalLap(): void;
}

interface TimeAttackResultView {
  show(result: { elapsedMs: number; bestMs: number; [key: string]: unknown }): void;
  /** Later values for the shown result: the settled account reward. */
  patch?(values: Record<string, unknown>): void;
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
      selection?: unknown;
      /** The kart's catalog title (the record's 卡丁车). */
      vehicleTitle?: unknown;
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
    /** TIMEATTACK.md: the settle reports the run's settings, kart and (ranked) recording. */
    timeAttackReadyOptions?: unknown;
    ghostRecorder?: unknown;
    currentGhostEquipment?(): unknown;
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
    if (formulaOf(host.session)?.consumes(action)) continue;
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
        // OB 观看: nobody drives.
        host.input.setEnabled(!observeOf(host.session));
        break;
      case "switch-drive-camera":
        host.session.cameraMode = "drive";
        host.scene.visible = true;
        host.driveCameraman.reset();
        break;
      case "release-race":
        // OB 观看: the hidden local kart never drives (the arrows steer the replay camera).
        host.input.setEnabled(!observeOf(host.session));
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

/** 未完成 instead of 完成, when the race's Action2D has the banner. */
function showRetire(action2D: Action2D, nowMs: number): boolean {
  if (!action2D.showRetire) return false;
  try {
    return action2D.showRetire(nowMs) !== false;
  } catch {
    // The release Action2D throws when retire@zz was not loaded with it.
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
    case "finish": {
      // A story race shows whether the mission is met at the finish line.
      // A race the stage ended itself (a chase, a 驾照 time limit) carries its verdict.
      const forced = (action as { missionCleared?: boolean }).missionCleared;
      const cleared = forced === false ? false
        : storyRaceOf(host.session.selection)?.judge?.(action.elapsedMs);
      // The rider cheers (12) or cries (13): over the mission's verdict when
      // the race has one, else over the record it raced.
      host.session.pendingCharacterFinishMotion =
        (cleared ?? host.session.lifecycle.resultBeatTarget()) ? 12 : 13;
      host.getPhysics().setRaceMotionLocked(true);
      host.hud.finishPerformanceRace();
      const nowMs = host.session.lifecycle.effectiveTime(rawNowMs);
      // 未完成 (retire@zz) instead of 完成 when the mission failed, as the rider school stages do.
      if (cleared !== false || !showRetire(stage.action2D, nowMs)) stage.action2D.showFinish(nowMs);
      if (cleared !== undefined) stage.action2D.showMissionResult?.(cleared, nowMs);
      host.session.lifecycle.acceptLocalCompletion();
      return true;
    }
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
  // The signed-in account's reward fills the RP/Lucci slots once the data service credits it.
  if (!storyRaceOf(host.session.selection)) {
    const trackId = (host.session.selection as { trackId?: unknown } | undefined)?.trackId;
    const ranked = rankedRaceOf(host.session.selection);
    const details = runDetails(stage, typeof trackId === "string" ? trackId : undefined, action.elapsedMs, counts);
    const settled = settleBrowserTimeAttackRun(typeof trackId === "string" ? trackId : undefined,
      action.elapsedMs, result, message => host.hud.showDebugText(message, "error"),
      { ...(details ? { details } : {}), ...(ranked ? { requestId: ranked.requestId } : {}) });
    // The ranking window reads the settled rank when the race returns.
    if (ranked) ranked.settlement = settled.then(settlement => settlement && settlement.modeBestMs !== undefined
      ? { modeBestMs: settlement.modeBestMs, modeNewRecord: settlement.modeNewRecord === true,
        rank: settlement.rank ?? 0, topTen: settlement.topTen === true } : undefined);
  }
  // A story race is not a time attack record.
  if (action.bestMs === action.elapsedMs && !storyRaceOf(host.session.selection)) {
    stage.action2D.showNewRecord(host.session.lifecycle.effectiveTime(rawNowMs));
  }
  // Story races do not touch the time attack records.
  if (action.isNewRecord && !storyRaceOf(host.session.selection)) {
    const options = host.timeAttackReadyOptions as { speed: number; booster: number; version?: string;
      settingSpeed?: number } | undefined;
    const trackId = (host.session.selection as { trackId?: unknown } | undefined)?.trackId;
    host.promoteTimeAttackRecord(action.elapsedMs, counts).then(() => {
      // 我的回放 dates its cards from here; the record itself carries no time.
      if (typeof trackId === "string" && options) noteReplayRecorded(runRecordKey(trackId, options));
    }).catch(error => {
      host.hud.showDebugText(
        `TimeAttack record 保存失败：${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    });
  }
}

/**
 * TIMEATTACK.md: what the settle reports besides the time — the mode and
 * its settings, the kart and the counts, and a ranked run's recording.
 */
function runDetails(stage: TimeAttackActionStage, trackId: string | undefined, elapsedMs: number,
  counts: Record<string, unknown>): TimeAttackRunDetails | undefined {
  const { host } = stage;
  const selection = host.session.selection as { vehicleItemId?: unknown; vehicleSystemKey?: unknown } | undefined;
  const options = host.timeAttackReadyOptions as { speed?: unknown; booster?: unknown; version?: unknown;
    settingSpeed?: unknown } | undefined;
  if (!trackId || !options || typeof options.speed !== "number") return undefined;
  const ranked = rankedRaceOf(host.session.selection);
  const details: TimeAttackRunDetails = {
    mode: ranked ? "ranked" : "practice",
    speed: ranked ? ranked.speed : recordSpeedChannel({ speed: options.speed,
      ...(typeof options.version === "string" ? { version: options.version } : {}),
      ...(typeof options.settingSpeed === "number" ? { settingSpeed: options.settingSpeed } : {}) }),
    booster: ranked ? ranked.booster : typeof options.booster === "number" ? options.booster : 0,
    kart: { itemId: typeof selection?.vehicleItemId === "number" ? selection.vehicleItemId : 0,
      ...(typeof selection?.vehicleSystemKey === "string" ? { systemKey: selection.vehicleSystemKey } : {}),
      name: typeof host.session.vehicleTitle === "string" ? host.session.vehicleTitle : "" },
    crashCount: typeof counts.crashCount === "number" ? counts.crashCount : 0,
    boosterCount: typeof counts.boosterCount === "number" ? counts.boosterCount : 0,
  };
  if (ranked) {
    try {
      const recorder = host.ghostRecorder as { finish(): Array<{ record: { stamps: unknown[] } }> } | undefined;
      const recorded = recorder?.finish()[0];
      const equipment = host.currentGhostEquipment?.() as (Record<string, unknown> & { playerName?: string }) | undefined;
      if (recorded && recorded.record.stamps.length > 0 && equipment)
        details.replay = replayBase64(encodeRunReplay(recorded, equipment, trackId, elapsedMs, details.speed));
    } catch (error) {
      host.hud.showDebugText(`排位录像编码失败：${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
  return details;
}
