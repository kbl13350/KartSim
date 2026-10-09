/** Owns the in-race HUD, its optional classic gauges and the draw command list. */
import { personalBoostFrame, teamBoostFrame, type RaceHudBoostFrame } from "./race-hud-boost";
import type { ItemSlotOverlay } from "./item-slot-hud";

export interface RaceHudGauge {
  state: { full: boolean };
  requestFull(): void;
  reset(): void;
  update(timeMs: number, ratio: number): void;
  render(camera: unknown, width: number, height: number): void;
  renderIcon(camera: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface RaceHudMinimap {
  setLocalMarkerTint(tint: unknown): void;
  reset(): void;
  update(timeMs: number, body: unknown, ghosts: unknown): void;
  render(camera: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface RaceHudRenderer {
  enableUiSmoothing(): void;
  update(commands: unknown[], timeMs: number): void;
  render(camera: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface RaceHudCache {
  drawOrder(tree: unknown, width: number, height: number, options: unknown): unknown[];
}

export interface RaceHudRankPresentation {
  update(rows: unknown[], timeMs: number,
    rowHeight: (row: { local?: boolean }) => number): unknown[];
  reset(): void;
}

export interface RaceHudDependencies {
  createShadow(texture: unknown): {
    render(camera: unknown, width: number, height: number): void;
    dispose(): void;
  };
  createRenderer(): RaceHudRenderer;
  createCache(): RaceHudCache;
  createRankPresentation(): RaceHudRankPresentation;
  createGaugePulse(): unknown;
  loadClassicGauge(library: unknown, kind: "team-main" | "personal" |
    "team-contribution"): Promise<RaceHudGauge>;
  validateTick(timeMs: number, label: string): number;
  /** Release XJ, now item-slot-hud.ts; `overlay` only in item races. */
  buildSpeedSlots(definition: unknown, slots: unknown, disabled: unknown,
    windowStartMs: unknown, timeMs: number, reorderProgress?: number,
    overlay?: ItemSlotOverlay): unknown[];
  buildTimeCommands(definition: unknown, input: unknown, width: number,
    height: number, cache: RaceHudCache): unknown[];
  buildRankCommands(definition: unknown, rank: unknown, width: number,
    height: number, cache: RaceHudCache, rowsCache: RaceHudCache): unknown[];
  buildTeamGaugeCommands(definition: unknown, frame: RaceHudBoostFrame,
    timeMs: number, width: number, height: number, cache: RaceHudCache): unknown[];
  materializeDrawOrder(order: unknown[], textures: unknown,
    cache: RaceHudCache): Array<{ node: unknown; kind: string; alpha?: number }>;
  requireDrawNode(order: unknown[], node: unknown, label: string): any;
  scaleGauge(command: unknown, ratio: number, label: string): any;
  alignMarker(gauge: unknown, marker: unknown): any;
  advanceGaugePulse(state: unknown, timeMs: number, ratio: number,
    threshold: number, label: string): { state: unknown; alpha: number };
  nativeSine(radians: number): number;
  reorderDurationMs: number;
}

export interface RaceHudDefinition {
  shadow: { texture: unknown };
  teamBoostVisible: boolean;
  boostVisible: boolean;
  items: unknown;
  time: unknown;
  rank: { rows: { local: { height: number }; other: { height: number } } };
  teamBoost: unknown;
  boost: { tree: unknown; textures: unknown; gauge: unknown; marker: unknown;
    full: unknown };
}

export interface RaceHudInput {
  boostRatio: number;
  teamBoostRatio: number;
  teamBooster: boolean;
  body: unknown;
  ghosts: unknown;
  rank?: { rows: unknown[]; [key: string]: unknown };
  speedSlots: unknown;
  speedSlotDisabled: unknown;
  speedSlotWindowStartMs: unknown;
  /** Item race: lock overlay and countdown over the slots. */
  itemSlotOverlay?: ItemSlotOverlay;
  /** Item race: the controller's own swap progress instead of the HUD timer. */
  slotReorderProgress?: number;
}

export class RaceHudController {
  classicBoost?: RaceHudGauge;
  classicTeamBoost?: RaceHudGauge;
  classicTeamVisible = false;
  disposed = false;
  readonly renderer: RaceHudRenderer;
  timeInfoVisible = true;
  readonly ingameShadow: ReturnType<RaceHudDependencies["createShadow"]>;
  readonly timeDrawCache: RaceHudCache;
  readonly boostDrawCache: RaceHudCache;
  readonly teamBoostDrawCache: RaceHudCache;
  readonly rankDrawCache: RaceHudCache;
  readonly rankPresentation: RaceHudRankPresentation;
  readonly rankRowDrawCache: RaceHudCache;
  gaugePulse: unknown;
  fullActive = false;
  fullAnchorMs = 0;
  teamFullActive = false;
  teamFullAnchorMs = 0;
  slotReorderActive = false;
  slotReorderAnchorMs?: number;
  hasCommands = false;
  /** The rank rows as last laid out (the item HUD puts scanning icons beside them). */
  rankRows?: unknown[];

  constructor(readonly definition: RaceHudDefinition,
    readonly minimap: RaceHudMinimap,
    private readonly dependencies: RaceHudDependencies) {
    this.renderer = dependencies.createRenderer();
    this.timeDrawCache = dependencies.createCache();
    this.boostDrawCache = dependencies.createCache();
    this.teamBoostDrawCache = dependencies.createCache();
    this.rankDrawCache = dependencies.createCache();
    this.rankPresentation = dependencies.createRankPresentation();
    this.rankRowDrawCache = dependencies.createCache();
    this.gaugePulse = dependencies.createGaugePulse();
    this.ingameShadow = dependencies.createShadow(definition.shadow.texture);
  }

  enableUiSmoothing(): void { this.renderer.enableUiSmoothing(); }
  setTimeInfoVisible(visible: boolean): void { this.timeInfoVisible = visible; }

  async loadClassicBoost(library: unknown, team = false): Promise<void> {
    if (this.disposed || this.classicBoost)
      throw new Error("经典氮气条不能重复装配。");
    const personal = await this.dependencies.loadClassicGauge(
      library, team ? "team-main" : "personal");
    let contribution: RaceHudGauge | undefined;
    try {
      if (this.disposed || this.classicBoost)
        throw new Error("经典氮气条装配已失效。");
      if (team)
        contribution = await this.dependencies.loadClassicGauge(library,
          "team-contribution");
      if (this.disposed || this.classicBoost)
        throw new Error("经典氮气条装配已失效。");
      this.classicBoost = personal;
      this.classicTeamBoost = contribution;
    } catch (error) {
      personal.dispose();
      contribution?.dispose();
      throw error;
    }
  }

  startBoostGaugeFull(): void {
    if (this.disposed) return;
    this.classicBoost?.requestFull();
    this.fullActive = true;
    this.fullAnchorMs = 0;
  }

  boostGaugeFullActive(): boolean {
    return this.classicBoost ? this.classicBoost.state.full : this.fullActive;
  }

  setLocalMarkerTint(tint: unknown): void {
    this.minimap.setLocalMarkerTint(tint);
  }

  startTeamBoostGaugeFull(): void {
    if (this.disposed) return;
    this.classicTeamBoost?.requestFull();
    this.teamFullActive = true;
    this.teamFullAnchorMs = 0;
  }

  startSlotReorder(): void {
    this.slotReorderActive = true;
    this.slotReorderAnchorMs = undefined;
  }

  reset(): void {
    if (this.disposed) return;
    this.classicBoost?.reset();
    this.classicTeamBoost?.reset();
    this.classicTeamVisible = false;
    this.rankPresentation.reset();
    this.minimap.reset();
    this.gaugePulse = this.dependencies.createGaugePulse();
    this.fullActive = false;
    this.fullAnchorMs = 0;
    this.teamFullActive = false;
    this.teamFullAnchorMs = 0;
    this.slotReorderActive = false;
    this.slotReorderAnchorMs = undefined;
    this.hasCommands = false;
    this.rankRows = undefined;
    this.renderer.update([], 0);
  }

  update(input: RaceHudInput, timeMs: number, width: number,
    height: number): void {
    if (this.disposed) return;
    const tick = this.dependencies.validateTick(timeMs, "gameplay UI tick");
    this.classicBoost?.update(tick, input.boostRatio);
    this.classicTeamVisible = !!this.classicTeamBoost &&
      this.definition.teamBoostVisible && input.teamBooster;
    if (this.classicTeamVisible)
      this.classicTeamBoost!.update(tick, input.teamBoostRatio);
    this.minimap.update(tick, input.body, input.ghosts);

    const boostFrame = this.boostFrame(tick, input.boostRatio);
    const rank = input.rank && {
      ...input.rank,
      rows: this.rankPresentation.update(input.rank.rows, tick,
        row => (row.local ? this.definition.rank.rows.local :
          this.definition.rank.rows.other).height),
    };
    this.rankRows = rank?.rows;
    const reorder = input.slotReorderProgress ?? this.slotReorderProgress(tick);
    const commands = [
      ...(input.itemSlotOverlay ? this.dependencies.buildSpeedSlots(this.definition.items,
        input.speedSlots, input.speedSlotDisabled, input.speedSlotWindowStartMs, tick,
        reorder, input.itemSlotOverlay) : this.dependencies.buildSpeedSlots(
        this.definition.items, input.speedSlots, input.speedSlotDisabled,
        input.speedSlotWindowStartMs, tick, reorder)),
      ...(this.timeInfoVisible ? this.dependencies.buildTimeCommands(
        this.definition.time, input, width, height, this.timeDrawCache) : []),
      ...(this.classicBoost ? [] : this.buildBoostGaugeCommands(
        boostFrame, tick, width, height, this.boostDrawCache)),
      ...(rank ? this.dependencies.buildRankCommands(this.definition.rank,
        rank, width, height, this.rankDrawCache,
        this.rankRowDrawCache) : []),
      ...(!this.classicTeamBoost && this.definition.teamBoostVisible &&
        input.teamBooster ? this.dependencies.buildTeamGaugeCommands(
          this.definition.teamBoost,
          this.teamBoostFrame(tick, input.teamBoostRatio), tick,
          width, height, this.teamBoostDrawCache) : []),
    ];
    this.hasCommands = commands.length > 0;
    this.renderer.update(commands, tick);
  }

  slotReorderProgress(timeMs: number): number | undefined {
    if (!this.slotReorderActive) return undefined;
    this.slotReorderAnchorMs ??= timeMs;
    const elapsed = (timeMs - this.slotReorderAnchorMs) >>> 0;
    if (elapsed > this.dependencies.reorderDurationMs) {
      this.slotReorderActive = false;
      this.slotReorderAnchorMs = undefined;
      return undefined;
    }
    return elapsed / this.dependencies.reorderDurationMs;
  }

  render(camera: unknown, width: number, height: number): void {
    if (this.disposed) return;
    this.minimap.render(camera, width, height);
    this.ingameShadow.render(camera, width, height);
    if (this.classicTeamVisible && this.classicTeamBoost && this.classicBoost) {
      if (!this.classicTeamBoost.state.full && this.classicBoost.state.full) {
        this.classicTeamBoost.render(camera, width, height);
        this.classicBoost.render(camera, width, height);
      } else {
        this.classicBoost.render(camera, width, height);
        this.classicTeamBoost.render(camera, width, height);
      }
      if (!this.classicBoost.state.full && !this.classicTeamBoost.state.full)
        this.classicTeamBoost.renderIcon(camera, width, height);
    } else this.classicBoost?.render(camera, width, height);
    if (this.hasCommands) this.renderer.render(camera, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.classicBoost?.dispose();
    this.classicTeamBoost?.dispose();
    this.rankPresentation.reset();
    this.minimap.dispose();
    this.ingameShadow.dispose();
    this.renderer.dispose();
  }

  boostFrame(timeMs: number, ratio: number): RaceHudBoostFrame {
    return personalBoostFrame(this, timeMs, ratio, this.dependencies.nativeSine);
  }

  teamBoostFrame(timeMs: number, ratio: number): RaceHudBoostFrame {
    return teamBoostFrame(this, timeMs, ratio, this.dependencies.nativeSine);
  }

  buildBoostGaugeCommands(frame: RaceHudBoostFrame, timeMs: number,
    width: number, height: number, cache: RaceHudCache): unknown[] {
    if (!this.definition.boostVisible) return [];
    const boost = this.definition.boost;
    const order = this.dependencies.materializeDrawOrder(
      cache.drawOrder(boost.tree, width, height, {
        visibility: (node: unknown) => node === boost.full ? frame.fullVisible : undefined,
      }), boost.textures, cache);
    const gauge = this.dependencies.requireDrawNode(order, boost.gauge,
      "boost gauge");
    const scaled = this.dependencies.scaleGauge(gauge, frame.ratio,
      "V1GenTacho");
    const marker = this.dependencies.alignMarker(scaled,
      this.dependencies.requireDrawNode(order, boost.marker, "boost marker"));
    const pulse = this.dependencies.advanceGaugePulse(this.gaugePulse,
      timeMs, frame.ratio, 0, "V1GenTacho");
    this.gaugePulse = pulse.state;
    return order.map(command => command.node === boost.gauge ? scaled :
      command.node === boost.marker ? { ...marker, alpha: pulse.alpha } :
      command.node === boost.full && command.kind === "panel" ?
        { ...command, alpha: frame.fullAlpha } : command);
  }
}
