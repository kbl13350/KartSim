/** Owns the multiplayer race HUD, minimap, time gap and Giant Boost overlay. */

export interface MultiplayerHudDependencies {
  createGap(): {
    update(...args: unknown[]): unknown;
  };
  loadTimeGap(library: unknown, target: unknown): Promise<any>;
  resolveDye(library: unknown, itemId: number, category: number):
    Promise<{ primary: number }>;
  loadHudAssets(library: unknown, selection: unknown, slot: number,
    grade: number): Promise<any>;
  attribute(node: unknown, name: string): string | undefined;
  loadMinimap(library: unknown, path: string, metadata: unknown,
    minimap: unknown, environment: unknown, binding: unknown,
    ghostCount: number, roadblock: boolean): Promise<any>;
  createHud(assets: unknown, minimap: unknown): any;
  loadGiant(library: unknown): Promise<any>;
  normalizeRank(rank: unknown, namespace?: string): unknown;
  racingState: unknown;
  viewportWidth: number;
  viewportHeight: number;
}

export class MultiplayerRaceHud {
  readonly gap: ReturnType<MultiplayerHudDependencies["createGap"]>;
  gapView?: any;
  giant?: any;
  disposed = false;

  constructor(readonly ui: any, readonly tints: Map<unknown, number | undefined>,
    readonly anonymous = false, readonly competition = false,
    readonly runnerId: unknown = undefined,
    readonly dependencies: MultiplayerHudDependencies) {
    this.gap = dependencies.createGap();
  }

  get timeGapEnabled(): boolean { return Boolean(this.gapView) && !this.disposed; }

  async loadTimeGap(library: unknown, target: unknown): Promise<void> {
    this.gapView = await this.dependencies.loadTimeGap(library, target);
  }

  updateTimeGap(race: any, time: number, before: unknown, after: unknown): void {
    if (!this.gapView || this.disposed) return;
    const elapsed = race.elapsedMs(time);
    this.gapView.update(this.gap.update(elapsed,
      race.lifecycle.state === this.dependencies.racingState,
      before, after, race.physics.body.linearVelocity,
      this.anonymous, this.competition), elapsed);
  }

  static async load<Hud extends MultiplayerRaceHud>(library: unknown, race: any,
    localPlayerId: unknown, dependencies: MultiplayerHudDependencies,
    create: (ui: any, tints: Map<unknown, number | undefined>,
      anonymous: boolean, competition: boolean, runnerId: unknown) => Hud): Promise<Hud> {
    const local = race.participants.find((participant: any) =>
      participant.playerId === localPlayerId);
    if (!local) throw new Error("多人 HUD 缺少本机成员。");
    const colors = await Promise.all(race.participants.map(async (participant: any) => {
      const dyeId = participant.characterDyeId ??
        participant.profile.equipment.itemIds[70];
      return [participant.playerId, dyeId === 0 ? undefined :
        (await dependencies.resolveDye(library, dyeId, 70)).primary & 0xffffff] as const;
    }));
    const source = await dependencies.loadHudAssets(library,
      local.vehicle.tachometerSelection, 0, local.vehicle.kartItem.engineGrade);
    const rankNodes = new Set([
      source.rank.rank, source.rank.suffix, source.rank.riderCount,
    ]);
    const assets = race.drivingMode?.kind === "roadblock" ? {
      ...source,
      rank: { ...source.rank, tree: { ...source.rank.tree,
        children: source.rank.tree.children.filter((child: any) =>
          !rankNodes.has(child.node) &&
          dependencies.attribute(child.node, "texture") !== "diagonal"),
      } },
    } : source;
    const map = race.map;
    const minimap = await dependencies.loadMinimap(library, map.path,
      map.metadata, map.minimap, map.environment, map.stageBinding,
      race.participants.length - 1, Boolean(race.roadblockRunnerId));
    let ui: any;
    try {
      ui = dependencies.createHud(assets, minimap);
      if (local.vehicle.classicHud)
        await ui.loadClassicBoost(library, race.mode === "team");
      ui.enableUiSmoothing();
      if (race.drivingMode?.kind === "roadblock") ui.setTimeInfoVisible(false);
      const tints = new Map<unknown, number | undefined>(colors);
      ui.setLocalMarkerTint(tints.get(localPlayerId));
      minimap.setLocalRunnerFlag(race.roadblockRunnerId === localPlayerId);
      const hud = create(ui, tints, race.anonymous, race.competition,
        race.roadblockRunnerId);
      if (race.drivingMode?.kind === "giant")
        hud.giant = await dependencies.loadGiant(library);
      return hud;
    } catch (error) {
      if (ui) ui.dispose();
      else minimap.dispose();
      throw error;
    }
  }

  update(race: any, time: number, ghosts: any[], rank?: unknown): void {
    if (this.disposed) return;
    this.giant?.update(time);
    const { physics, track } = race;
    const gauges = physics.timeAttackTachometerGauges();
    const laps = track.data.lapTarget;
    if (laps === undefined) throw new Error("多人 HUD 缺少赛道圈数。");
    this.ui.update({
      body: physics.body,
      currentLap: track.getRouteState(physics).lap,
      totalLaps: laps,
      elapsedMs: race.elapsedMs(time),
      bestMs: race.lapTiming.bestLapMs,
      ...(rank ? { rank: this.competition
        ? this.dependencies.normalizeRank(rank, "kartsim")
        : this.anonymous ? this.dependencies.normalizeRank(rank) : rank } : {}),
      speedSlots: physics.timeAttackSpeedSlots(),
      speedSlotDisabled: physics.timeAttackSpeedSlotDisabled(),
      speedSlotWindowStartMs: physics.timeAttackSpeedSlotWindowStartMs(),
      boostRatio: gauges.mainRatio,
      teamBoostRatio: gauges.teamRatio,
      teamBooster: gauges.teamBooster,
      ghosts: ghosts.map(ghost => ({
        ...ghost.pose, markerTint: this.tints.get(ghost.playerId),
        ...(this.runnerId ? { runnerFlag: ghost.playerId === this.runnerId } : {}),
      })),
    }, Math.trunc(time) >>> 0, this.dependencies.viewportWidth,
    this.dependencies.viewportHeight);
    this.giant?.updateBoost(time, this.ui.boostGaugeFullActive(), gauges.mainRatio);
  }

  hideTimeGap(): void { this.gapView?.update([], 0); }
  markerTints(): Map<unknown, number | undefined> { return this.tints; }
  startTeamBoostGaugeFull(): void { this.ui.startTeamBoostGaugeFull(); }
  startBoostGaugeFull(): void {
    this.giant?.requestBoostFull();
    this.ui.startBoostGaugeFull();
  }
  giantStage(cells: number, time: number): void { this.giant?.stage(cells, time); }
  clearGiant(): void { this.giant?.dispose(); this.giant = undefined; }

  render(renderer: unknown): void {
    if (this.disposed) return;
    const { viewportWidth: width, viewportHeight: height } = this.dependencies;
    this.giant?.renderBefore(renderer, width, height, this.ui.boostGaugeFullActive());
    this.giant?.renderBoost(renderer, width, height);
    this.giant?.renderAfter(renderer, width, height, this.ui.boostGaugeFullActive());
    this.ui.render(renderer, width, height);
    this.giant?.renderPanels(renderer, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearGiant();
    this.gapView?.dispose();
    this.ui.dispose();
  }
}
