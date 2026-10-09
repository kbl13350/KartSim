/** Publishes rank, time gap, tachometer and the final multiplayer scene frame. */

interface RaceRankRow { participantId: unknown; [key: string]: unknown }
interface RaceRankBoard {
  rank?: number;
  rows: RaceRankRow[];
  [key: string]: unknown;
}
interface RaceProgress { distance?: number; lap?: number; [key: string]: unknown }
interface RaceResult { playerId: unknown; elapsedMs: number | null }

export interface RacePresenterHudHost {
  playerId: unknown;
  race: { roster: Array<{ playerId: unknown; name: string }> };
  runtime: {
    local: {
      lifecycle: { state: unknown };
      physics: {
        giant?: { setRank(rank: number | undefined): void };
        consumeTeamGaugeFullAnimation(): boolean;
        consumeTimeAttackTachometerGaugePreserve(): unknown;
        consumeTimeAttackTachometerNormalBooster(): unknown;
      };
      track: { skydome?: unknown };
      raceProgress(): RaceProgress | undefined;
    };
    remotes: {
      rankDisconnected(playerId: unknown): boolean;
      hasDeparted(playerId: unknown): boolean;
      raceProgress(playerId: unknown): RaceProgress | undefined;
    };
    finishDeadline: number | undefined;
    finishSnapshot(): RaceResult[];
    resultSnapshot(): RaceResult[] | undefined;
    latencyMs(playerId: unknown): number | undefined;
    localDraftHudActive(): boolean;
    draftPresentationVisible(playerId: unknown): boolean;
  };
  rankRoster: {
    progress(playerId: unknown): unknown;
    out(playerId: unknown): boolean;
  };
  views: Map<unknown, unknown>;
  hud: {
    markerTints(): unknown;
    startTeamBoostGaugeFull(): void;
    update(local: unknown, nowMs: number,
      remotePoses: unknown[], board: RaceRankBoard): void;
    timeGapEnabled: boolean;
    hideTimeGap(): void;
    updateTimeGap(local: unknown, nowMs: number,
      progress: Array<{ playerId: unknown; name: string;
        progress: RaceProgress | undefined }>, playerId: unknown): void;
  };
  action2d: { setFinishDeadline(deadline: number | undefined): void };
  warpHudHidden: boolean;
  gaugePreserve: { update(nowMs: number, value: unknown): unknown };
  tachometer: unknown;
  audioStarted: boolean;
  assets: { draftAudio: {
    update(draftVisible: boolean, localHudActive: boolean): void;
  } };
  scene: unknown;
  camera: unknown;
}

export interface RacePresenterHudDependencies {
  rankByProgress(roster: RacePresenterHudHost["race"]["roster"],
    playerId: unknown, progress: (playerId: unknown) => unknown,
    tints: unknown, finish: RaceResult[],
    latency: (playerId: unknown) => number | undefined): RaceRankBoard | undefined;
  rankFallback(roster: RacePresenterHudHost["race"]["roster"],
    playerId: unknown, tints: unknown,
    latency: (playerId: unknown) => number | undefined): RaceRankBoard;
  rankWithResults(board: RaceRankBoard, results: RaceResult[]): RaceRankBoard;
  updateTachometer(tachometer: unknown,
    physics: RacePresenterHudHost["runtime"]["local"]["physics"],
    nowMs: number, unsignedNowMs: number, secondUnsignedNowMs: number,
    elapsed: number, gaugePreserve: unknown,
    normalBooster: unknown, draftHudActive: boolean): void;
  prepareScene(scene: unknown, camera: unknown, force?: boolean): void;
  racingState: unknown;
}

export function finishRacePresenterFrame(host: RacePresenterHudHost,
  nowMs: number, remotePoses: unknown[],
  dependencies: RacePresenterHudDependencies): void {
  const { runtime, race, playerId, hud } = host;
  const { local, remotes } = runtime;
  const { physics, track } = local;
  const latency = (id: unknown) => remotes.rankDisconnected(id)
    ? undefined : runtime.latencyMs(id);
  const tints = hud.markerTints();
  // Not in the release: a racer out of the race before it reported any
  // progress (it never loaded, or left first) would keep the progress board
  // from ever forming, so it is left off the board.
  const roster = race.roster.some(racer => remotes.hasDeparted(racer.playerId))
    ? race.roster.filter(racer => !remotes.hasDeparted(racer.playerId) ||
      host.rankRoster.progress(racer.playerId) !== undefined)
    : race.roster;
  const progressBoard = dependencies.rankByProgress(roster, playerId,
    id => host.rankRoster.progress(id), tints,
    runtime.finishSnapshot(), latency);
  physics.giant?.setRank(progressBoard === undefined
    ? undefined : progressBoard.rank! - 1);

  let board = progressBoard ?? dependencies.rankFallback(roster,
    playerId, hud.markerTints(), id => remotes.rankDisconnected(id)
      ? undefined : runtime.latencyMs(id));
  const results = runtime.resultSnapshot();
  if (results) board = dependencies.rankWithResults(board, results);
  board = {
    ...board,
    rows: board.rows.map(row => ({
      ...row,
      out: host.rankRoster.out(row.participantId),
      disconnected: remotes.rankDisconnected(row.participantId),
    })),
  };
  host.action2d.setFinishDeadline(local.lifecycle.state === dependencies.racingState
    ? runtime.finishDeadline : undefined);
  if (physics.consumeTeamGaugeFullAnimation()) hud.startTeamBoostGaugeFull();
  hud.update(local, nowMs, remotePoses, board);
  if (hud.timeGapEnabled && host.warpHudHidden) hud.hideTimeGap();
  if (hud.timeGapEnabled && !host.warpHudHidden) {
    const finishes = runtime.finishSnapshot();
    hud.updateTimeGap(local, nowMs,
      race.roster.filter(racer => host.views.has(racer.playerId)).map(racer => {
        const progress = racer.playerId === playerId
          ? local.raceProgress() : remotes.raceProgress(racer.playerId);
        const finish = finishes.find(result => result.playerId === racer.playerId);
        return {
          playerId: racer.playerId,
          name: racer.name,
          progress: finish ? {
            distance: progress?.distance ?? 0,
            lap: progress?.lap ?? 0,
            finishElapsedMs: finish.elapsedMs,
          } : progress,
        };
      }), playerId);
  }

  const unsignedNowMs = Math.trunc(nowMs) >>> 0;
  const preservedGauge = host.gaugePreserve.update(nowMs,
    physics.consumeTimeAttackTachometerGaugePreserve());
  dependencies.updateTachometer(host.tachometer, physics, nowMs,
    unsignedNowMs, unsignedNowMs, 0, preservedGauge,
    physics.consumeTimeAttackTachometerNormalBooster(),
    runtime.localDraftHudActive());
  if (host.audioStarted) {
    host.assets.draftAudio.update(runtime.draftPresentationVisible(playerId),
      runtime.localDraftHudActive());
  }
  dependencies.prepareScene(host.scene, host.camera, false);
  if (track.skydome) dependencies.prepareScene(track.skydome, host.camera);
}
