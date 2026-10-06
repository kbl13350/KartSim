import type { TimeAttackAction } from "./lifecycle";

export interface TimeAttackStageLifecycle {
  host: {
    session: {
      lifecycle: {
        tick(input: {
          rawNowMs: number;
          routeProgress: number;
          finishThreshold: number;
          currentLap: number;
          totalLaps: number;
        }): TimeAttackAction[];
      };
    };
    getTrack(): { data: { lapTarget?: number } };
    handleTimeAttackActions(actions: TimeAttackAction[], rawNowMs: number): void;
  };
  timeAttackParam?: unknown;
  ui?: { dispose(): void };
  ghostRouteProgress?: unknown;
  ghostPoses: unknown[];
  ghostPoseBuffer: unknown[];
  setInterface(value: unknown): void;
  restartRace(): void;
  disposeInterface(): void;
}

/** Enter the race stage with a fresh interface and reset its race owners. */
export function enterTimeAttackStage(
  stage: TimeAttackStageLifecycle,
  transition: { param?: unknown; owners?: unknown } | undefined,
  createInterface: (owners: unknown) => unknown,
): void {
  stage.timeAttackParam = transition?.param;
  stage.setInterface(transition ? createInterface(transition.owners) : undefined);
  stage.restartRace();
}

export function disposeTimeAttackInterface(stage: TimeAttackStageLifecycle): void {
  stage.ui?.dispose();
}

/** Drop the previous race's Ghost route and interface before entering Ready. */
export function exitTimeAttackStage(stage: TimeAttackStageLifecycle): void {
  stage.ghostRouteProgress = undefined;
  stage.ghostPoses = [];
  stage.ghostPoseBuffer = [];
  stage.disposeInterface();
  stage.timeAttackParam = undefined;
  stage.setInterface(undefined);
}

/** Re-run the lifecycle at a newly committed route lap, then dispatch events. */
export function updateTimeAttackRoute(
  stage: TimeAttackStageLifecycle,
  rawNowMs: number,
  previousLap: number,
  currentLap: number,
): void {
  if (currentLap === previousLap) return;
  const totalLaps = stage.host.getTrack().data.lapTarget ?? Number.MAX_SAFE_INTEGER;
  const actions = stage.host.session.lifecycle.tick({
    rawNowMs,
    routeProgress: currentLap,
    finishThreshold: totalLaps,
    currentLap,
    totalLaps,
  });
  stage.host.handleTimeAttackActions(actions, rawNowMs);
}
