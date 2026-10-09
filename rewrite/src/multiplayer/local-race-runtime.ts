/**
 * Local participant runtime for an already assembled multiplayer race.
 *
 * The readable LocalRaceController assembles assets and physics, then these
 * functions own the race clock, resets, route effects, warp presentation and
 * per-frame lifecycle.
 */

// The controller supplies physics, track and mode owners. Its shape will narrow
// as those owners are migrated into maintained modules.
export type LocalRaceHost = Record<string, any>;

export interface LocalRaceDependencies {
  states: {
    Ready: number;
    Countdown: number;
    Racing: number;
    PostFinish: number;
  };
  beginResetState(state: any): any;
  advanceResetState(state: any, nowMs: number): {
    state: any;
    actions: string[];
  };
  routeTagFamily(tag: string): string;
  isStartBoosterWindow(startAtMs: number, relativeNowMs: number): boolean;
}

/** Start a player-requested reset, respecting the roadblock runner rule. */
export function requestLocalRaceReset(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  playerRequested = true,
): boolean {
  if (race.disposed || race.lifecycle.state !== deps.states.Racing || race.resetState.phase !== 0)
    return false;
  if (playerRequested && race.isRoadBlockRunner) {
    race.roadBlockResetNoticePending = true;
    return false;
  }
  if (!race.physics.beginResetInitiation(playerRequested)) return false;
  race.lte?.cancel();
  race.resetState = deps.beginResetState(race.resetState);
  race.resetSoundPending = true;
  return true;
}

/** Request a reset for falling below the track, a physics event or a stalled kart. */
export function checkLocalRaceAutomaticReset(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  nowMs: number,
  stepSeconds: number,
): void {
  if (race.lifecycle.state !== deps.states.Racing) return;

  if (race.physics.body.position.y < -5) {
    race.physics.prepareLowHeightResetPose();
    race.coordinator.synchronizePositionAnchor();
    race.requestReset(false);
  }
  // A kart held by an item (bubble, missile, barricade, banana spin) is stopped on
  // purpose; neither the wall timers nor the low-speed timer may reset it. They ask
  // again every slice while the kart is still stuck, so their requests are dropped.
  // A crush asks only once: its request waits in the item effects until the hold ends.
  const itemEffects = race.physics.itemEffects;
  if (itemEffects?.suppressesAutomaticReset) {
    race.physics.consumeAutomaticResetRequest();
    race.lowSpeedResetStartedAtMs = 0;
    return;
  }
  const crushed = itemEffects?.consumeCrushReset() === true;
  if (race.physics.consumeAutomaticResetRequest() || crushed) {
    race.requestReset(false);
    return;
  }
  if (race.warpNext.blocksDriving() || !race.physics.lowSpeedAutomaticResetActive(stepSeconds)) {
    race.lowSpeedResetStartedAtMs = 0;
    return;
  }
  if (race.lowSpeedResetStartedAtMs === 0) race.lowSpeedResetStartedAtMs = nowMs;
  if (race.lowSpeedResetStartedAtMs !== 0 &&
      ((race.lowSpeedResetStartedAtMs + 2000) >>> 0) < nowMs) {
    race.lowSpeedResetStartedAtMs = 0;
    race.requestReset(false);
  }
}

/** Apply the staged checkpoint reset and restore the surface-specific physics. */
export function advanceLocalRaceReset(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  nowMs: number,
): void {
  const transition = deps.advanceResetState(race.resetState, nowMs);
  race.resetState = transition.state;
  for (const action of transition.actions) {
    if (action === "complete-checkpoint-pose") {
      const checkpoint = race.track.prepareCurrentSectionReset(race.physics);
      if (checkpoint.surface &&
          !race.physics.canHandleRouteSurfaceTag(`${checkpoint.surface}:in:next`))
        throw new Error(`多人复位暂未接入特殊路面 ${checkpoint.surface}。`);
      race.track.commitCurrentSectionReset(race.physics);
      race.physics.completeCheckpointPose(checkpoint, true);
      race.coordinator.synchronizePositionAnchor();
      if (checkpoint.surface?.includes("rail")) race.physics.prepareRailCheckpointReentry();
      race.track.setLensFlareEnabled(checkpoint.surface === "lensflare");
      if (checkpoint.surface) {
        const tag = `${checkpoint.surface}:in:next`;
        if (!race.physics.handleRouteSurfaceTag(tag))
          throw new Error(`多人复位路段 ${checkpoint.surface} 无物理处理器。`);
        race.handleLocalRouteTag(tag);
      }
    } else if (action === "suspend-physics") {
      race.physics.setFullPhysicsBypass(true);
    } else if (action === "resume-physics") {
      race.physics.setFullPhysicsBypass(false);
    } else {
      race.physics.restoreResetInteraction();
    }
  }
}

/** Accept the server's finish and race-over clocks exactly once. */
export function acceptLocalRaceEndTiming(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  finishDeadline: number | undefined,
  raceOverAt: number | undefined,
  resultsReady: boolean,
): void {
  if (race.disposed) return;
  if (finishDeadline !== undefined && race.finishDeadline === undefined) {
    race.finishDeadline = finishDeadline;
    race.pendingActions.push(
      ...race.lifecycle.acceptTiming(3, finishDeadline - race.clockOriginMs, 0),
    );
  }
  if (raceOverAt !== undefined && race.raceOverAt === undefined) {
    if (race.lifecycle.state === deps.states.Racing && finishDeadline !== undefined)
      race.forcedElapsedMs = race.elapsedMs(finishDeadline);
    race.raceOverAt = raceOverAt;
    race.lte?.cancel();
    race.pendingActions.push(
      ...race.lifecycle.acceptTiming(4, raceOverAt - race.clockOriginMs, 0),
    );
    race.physics.setRaceMotionLocked(true);
  }
  race.resultsReady = resultsReady;
}

/** Forward route tags to warp, presentation and weather owners. */
export function handleLocalRaceRouteTag(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  tag: string,
): void {
  const family = deps.routeTagFamily(tag);
  const entering = tag.includes(":in:");
  if (tag === "warpnext:in:next" && race.lifecycle.state === deps.states.Racing) {
    race.applyWarpActions(race.warpNext.enter(
      tag, race.track.warpNextDestination(race.physics),
      race.routeClockMs, race.track.data.warp,
    ));
  }
  if (family === "flash" || family.startsWith("shake") || family.startsWith("wave"))
    race.pendingRouteTags.push(tag);
  if (family === "lensflare") race.track.setLensFlareEnabled(entering);
  if (family === "norain" || family === "rail, norain") {
    race.assets.rain?.setEnabled(!entering);
    race.assets.rainAudio?.setRainEnabled(!entering);
  }
  if (family === "nosnow") race.assets.snow?.setEnabled(!entering);
}

/** Apply a warp controller transition and retain actions for the renderer. */
export function applyLocalRaceWarpActions(race: LocalRaceHost, actions: any[]): void {
  for (const action of actions) {
    if (action.kind === "start-warp-presentation") {
      race.lte?.cancel();
      race.physics.itemEffects?.clear();
      race.physics.setWarpPresentationActive(true);
      race.physics.setWarpPressProtected(true);
    } else if (action.kind === "freeze-camera") {
      if (!race.assets.map.warpNextCamera)
        throw new Error("warpnextcamera_cam 缺失；多人不能沿用旧镜头。");
    } else if (action.kind === "teleport") {
      race.physics.completeCheckpointPose(action.frame, action.clearMotion);
      race.physics.setWarpPressProtected(false);
      if (action.clearMotion) race.coordinator.completeWarpNextRailLanding();
      else race.coordinator.deferWarpNextRailLanding();
      race.coordinator.synchronizePositionAnchor();
    } else if (action.kind === "finish-warp-presentation") {
      race.physics.setWarpPresentationActive(false);
      race.physics.setFullPhysicsBypass(false);
      race.physics.restoreResetInteraction();
    }
    race.pendingWarpActions.push(action);
  }
}

/** Convert the absolute server start into the six-second countdown clock. */
export function scheduleLocalRaceStart(race: LocalRaceHost, startAtMs: number): void {
  if (race.disposed || race.scheduled)
    throw new Error("本局起跑安排已释放或已设置。");
  if (!Number.isFinite(startAtMs) || startAtMs < 0)
    throw new Error("本局起跑时钟无效。");
  race.scheduled = true;
  race.clockOriginMs = Math.trunc(startAtMs) - 6000;
  race.lifecycle.acceptTiming(1, 6000, 0);
}

export function localRaceScheduledStartAtMs(race: LocalRaceHost): number {
  return race.scheduled ? race.lifecycle.startAtMs + race.clockOriginMs : 0;
}

export function localRaceStartBoosterWindow(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  nowMs: number,
): boolean {
  return race.scheduled &&
    deps.isStartBoosterWindow(race.lifecycle.startAtMs, Math.trunc(nowMs) - race.clockOriginMs);
}

export function localRaceProgress(race: LocalRaceHost): {
  distance: number;
  lap: number;
  finishElapsedMs?: number;
} {
  const route = race.track.getRouteState(race.physics);
  return {
    distance: route.distance,
    lap: route.lap,
    ...(race.naturallyFinished
      ? { finishElapsedMs: race.lifecycle.finishedElapsedMs }
      : {}),
  };
}

export function localRaceElapsedMs(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  nowMs: number,
): number {
  if (!race.scheduled || race.lifecycle.state < deps.states.Racing) return 0;
  if (race.lifecycle.state >= deps.states.PostFinish)
    return race.forcedElapsedMs ?? race.lifecycle.finishedElapsedMs;
  return Math.max(0, Math.trunc(nowMs) - race.clockOriginMs - race.lifecycle.startAtMs);
}

/** Drive the local kart and lifecycle from a wall-clock update. */
export function updateLocalRace(
  race: LocalRaceHost,
  deps: LocalRaceDependencies,
  nowMs: number,
  stepSeconds: number,
): any[] {
  race.boostGaugeFull = false;
  if (race.disposed) return [];
  if (!Number.isFinite(nowMs) || nowMs < 0)
    throw new Error("本局更新时间无效。");

  const frameClock = Math.trunc(nowMs) >>> 0;
  race.routeClockMs = frameClock;
  race.track.updateMovingRoads(frameClock);
  if (!race.scheduled) {
    race.physics.updateLockedIngameClock(frameClock);
    return [];
  }

  const relativeNow = Math.trunc(nowMs) - race.clockOriginMs;
  if (relativeNow < 0) {
    race.physics.updateLockedIngameClock(frameClock);
    return [];
  }

  if (race.lifecycle.state === deps.states.Racing && race.physics.consumeRailResetRequest())
    race.requestReset(false);
  race.checkAutomaticReset(frameClock, stepSeconds);
  race.advanceReset(frameClock);
  if (race.lifecycle.state === deps.states.Racing)
    race.lapTiming.update(relativeNow, race.track.getRouteState(race.physics).lap);

  const actions = [
    ...race.pendingActions.splice(0),
    ...race.lifecycle.update({
      nowMs: relativeNow,
      routeProgress: race.roadblock && !race.isRoadBlockRunner
        ? 0 : race.track.getRouteState(race.physics).lap,
      routeTotal: race.track.data.lapTarget,
      resultRosterReady: race.resultsReady,
    }),
  ].map(action => {
    if ("atMs" in action) return { ...action, atMs: action.atMs + race.clockOriginMs };
    if (action.kind === "release-race")
      return { ...action, startAtMs: action.startAtMs + race.clockOriginMs };
    return action;
  });

  for (const action of actions) {
    if (action.kind === "natural-finish") race.naturallyFinished = true;
    if (action.kind === "release-race") {
      race.physics.setRaceMotionLocked(false);
      race.physics.synchronizeClock(frameClock);
    }
  }

  if (race.lifecycle.state !== deps.states.Racing) {
    race.giant?.setDrivingActive(false);
    race.lte?.cancel();
    // Item effects end at the finish line (and never start before the race).
    race.physics.itemEffects?.clear();
    race.physics.setRaceMotionLocked(true);
    if (race.lifecycle.state === deps.states.PostFinish)
      race.coordinator.run(frameClock, stepSeconds);
    else if (race.lifecycle.state === deps.states.Ready ||
             race.lifecycle.state === deps.states.Countdown)
      race.physics.updateLockedIngameClock(frameClock);
    else race.physics.synchronizeClock(frameClock);
    return actions;
  }

  race.lte?.update(frameClock, race.lteAvailable());
  race.giant?.setDrivingActive(!race.resetSuspended && !race.warpNext.blocksDriving());
  race.coordinator.run(frameClock, stepSeconds);
  if (race.physics.consumeRailResetRequest()) race.requestReset(false);
  race.applyWarpActions(race.warpNext.tick(frameClock));
  race.boostGaugeFull = race.physics.updateModeInventory();
  return actions;
}
