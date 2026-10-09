/** Owns the multiplayer race HUD, minimap, time gap, Giant Boost and item race layers. */

import {
  emptyItemHudState, itemHudSlots, itemSlotCapacity,
  type ItemHudOptions, type ItemHudState,
} from "./item-hud-state";
import type { ItemSlotDefinition, ItemSlotOverlay } from "./item-slot-hud";

/** What MultiplayerRaceHud needs of the item HUD (item-hud.ts ItemHud). */
export interface ItemHudLayer {
  state: ItemHudState;
  setState(state: ItemHudState): void;
  setOptions(options: ItemHudOptions): void;
  update(timeMs: number, rank?: unknown): void;
  renderUnder(renderer: unknown, width: number, height: number): void;
  renderOver(renderer: unknown, width: number, height: number): void;
  reset(): void;
  dispose(): void;
}

export interface ItemHudLayerOptions {
  capacity: 2 | 3;
  slots?: ItemSlotDefinition;
  options?: ItemHudOptions;
}

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
  /** item-mode(hud): the item race layer, for drivingMode.kind === "item". */
  loadItemHud?(library: unknown, options: ItemHudLayerOptions): Promise<ItemHudLayer>;
  /** item-mode(hud): the saved in-race item options. */
  itemHudOptions?(): ItemHudOptions;
  normalizeRank(rank: unknown, namespace?: string): unknown;
  racingState: unknown;
  viewportWidth: number;
  viewportHeight: number;
}

export class MultiplayerRaceHud {
  readonly gap: ReturnType<MultiplayerHudDependencies["createGap"]>;
  gapView?: any;
  giant?: any;
  item?: ItemHudLayer;
  /** Whether the item race controller has fed a state yet. */
  itemStateFed = false;
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
    const itemRace = race.drivingMode?.kind === "item";
    const shown = race.drivingMode?.kind === "roadblock" ? {
      ...source,
      rank: { ...source.rank, tree: { ...source.rank.tree,
        children: source.rank.tree.children.filter((child: any) =>
          !rankNodes.has(child.node) &&
          dependencies.attribute(child.node, "texture") !== "diagonal"),
      } },
    } : source;
    // Item races have no N2O gauge and no team gauge (ITEM_MODE.md §1).
    const assets = itemRace ? { ...shown, boostVisible: false, teamBoostVisible: false } : shown;
    const map = race.map;
    const minimap = await dependencies.loadMinimap(library, map.path,
      map.metadata, map.minimap, map.environment, map.stageBinding,
      race.participants.length - 1, Boolean(race.roadblockRunnerId));
    let ui: any;
    try {
      ui = dependencies.createHud(assets, minimap);
      if (local.vehicle.classicHud && !itemRace)
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
      if (itemRace) {
        if (!dependencies.loadItemHud) throw new Error("道具赛 HUD 未接入。");
        const capacity = itemSlotCapacity(local.vehicle.physicsParams?.itemSlotCapacity);
        hud.item = await dependencies.loadItemHud(library, {
          capacity, slots: ui.definition?.items,
          options: dependencies.itemHudOptions?.(),
        });
        hud.item.setState(emptyItemHudState(capacity));
      }
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
    // Before the controller's first state, size the empty row from the physics slots.
    const capacity = physics.itemSlotCapacity;
    if (this.item && !this.itemStateFed && (capacity === 2 || capacity === 3) &&
        this.item.state.capacity !== capacity)
      this.item.setState(emptyItemHudState(capacity));
    const item = this.item?.state;
    this.ui.update({
      body: physics.body,
      currentLap: track.getRouteState(physics).lap,
      totalLaps: laps,
      elapsedMs: race.elapsedMs(time),
      bestMs: race.lapTiming.bestLapMs,
      ...(rank ? { rank: this.competition
        ? this.dependencies.normalizeRank(rank, "kartsim")
        : this.anonymous ? this.dependencies.normalizeRank(rank) : rank } : {}),
      ...(item ? itemSlotInput(item) : {
        speedSlots: physics.timeAttackSpeedSlots(),
        speedSlotDisabled: physics.timeAttackSpeedSlotDisabled(),
        speedSlotWindowStartMs: physics.timeAttackSpeedSlotWindowStartMs(),
      }),
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
    this.item?.update(time, this.ui);
  }

  /** item-mode(hud): this frame's item state from the item race controller. */
  setItemState(state: ItemHudState): void {
    if (this.disposed || !this.item) return;
    this.itemStateFed = true;
    this.item.setState(state);
  }

  setItemHudOptions(options: ItemHudOptions): void {
    if (!this.disposed) this.item?.setOptions(options);
  }

  /** The 350 ms Alt swap of the item slots, when the state carries no progress. */
  startItemSlotReorder(): void {
    if (!this.disposed && this.item) this.ui.startSlotReorder();
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
    this.item?.renderUnder(renderer, width, height);
    this.giant?.renderBefore(renderer, width, height, this.ui.boostGaugeFullActive());
    this.giant?.renderBoost(renderer, width, height);
    this.giant?.renderAfter(renderer, width, height, this.ui.boostGaugeFullActive());
    this.ui.render(renderer, width, height);
    this.giant?.renderPanels(renderer, width, height);
    this.item?.renderOver(renderer, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearGiant();
    this.item?.dispose();
    this.item = undefined;
    this.gapView?.dispose();
    this.ui.dispose();
  }
}

/** The race HUD slot input of an item race: item slots, lock and countdown. */
export function itemSlotInput(state: ItemHudState): {
  speedSlots: number[]; speedSlotDisabled: boolean[]; speedSlotWindowStartMs: number;
  itemSlotOverlay: ItemSlotOverlay; slotReorderProgress?: number;
} {
  const slots = itemHudSlots(state);
  const lockMs = state.lock?.remainingMs;
  const bombMs = state.timeBomb?.remainingMs;
  return {
    speedSlots: slots,
    speedSlotDisabled: slots.map(() => false),
    speedSlotWindowStartMs: 0,
    itemSlotOverlay: {
      locked: lockMs !== undefined && lockMs > 0,
      // One slotTimer: the time bomb is the more urgent countdown.
      countdownMs: bombMs !== undefined && bombMs > 0 ? bombMs : lockMs,
    },
    ...(state.reorderProgress !== undefined
      ? { slotReorderProgress: state.reorderProgress } : {}),
  };
}
