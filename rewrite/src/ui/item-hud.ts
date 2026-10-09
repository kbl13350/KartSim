/**
 * The item race HUD layer (道具赛): reticle, target warning, cloud cover,
 * changer cards, scanning icons and the text notices, drawn around the race
 * HUD by MultiplayerRaceHud like the Giant Boost layer. The item slots
 * themselves stay in the race HUD (item-slot-hud.ts).
 */

import {
  loadAbuseText, loadItemDescriptions, loadItemHudAssets,
  type HudImage, type HudNode, type HudRect, type ItemDescription,
  type ItemHudAssetDependencies, type ItemHudAssets,
} from "./item-hud-assets";
import { ItemHudCloud, type ItemHudCloudDependencies } from "./item-hud-cloud";
import { buildItemHudCommands, type HudPanelCommand, type ItemHudRankRow } from "./item-hud-commands";
import { defaultItemHudOptions } from "./item-hud-options";
import {
  ITEM_RACE_ITEM_IDS, emptyItemHudState, type ItemHudOptions, type ItemHudState,
} from "./item-hud-state";
import { HudTextRasterizer, ITEM_HUD_TEXT_CACHE_LIMIT, type HudTextCanvas } from "./item-hud-text";
import type { ItemSlotDefinition } from "./item-slot-hud";

export interface ItemHudRenderer {
  enableUiSmoothing(): void;
  update(commands: unknown[], time: number): void;
  render(renderer: unknown, width: number, height: number): void;
  dispose(): void;
}

export interface ItemHudDependencies extends ItemHudAssetDependencies {
  /** The race HUD overlay renderer (library.js fn). */
  createRenderer(): ItemHudRenderer;
  /** The cloud2 cover; without it the cover is not drawn. */
  cloud?: ItemHudCloudDependencies;
  createTextCanvas?(): HudTextCanvas | undefined;
  /** Where load problems that do not stop the race are reported. */
  warn?(message: string): void;
}

/** The race HUD rank board as the scanning icons need it. */
export interface ItemHudRankSource {
  definition: { rank: { boardGeometry: unknown; rows: {
    listGeometry: unknown; rowWidth: number; local: { height: number }; other: { height: number };
  } } };
  rankRows?: readonly ItemHudRankRow[];
}

export interface ItemHudLoadOptions {
  capacity?: 2 | 3;
  /** The race HUD's slot definition: Slot type 0 and item_s icons for scanning. */
  slots?: ItemSlotDefinition;
  /** Item names and descriptions; the original tables are read when omitted. */
  describe?(idx: number): ItemDescription | undefined;
  options?: ItemHudOptions;
  /** Item ids whose icons load with the HUD. */
  itemIds?: readonly number[];
}

const noticeFolder = "item/itemStateNotice";

export class ItemHud {
  state: ItemHudState;
  options: ItemHudOptions;
  readonly noticeIcons = new Map<number, HudImage | null>();
  readonly smallIcons = new Map<number, HudImage | null>();
  readonly text: HudTextRasterizer;
  renderer: ItemHudRenderer;
  commands: HudPanelCommand[] = [];
  disposed = false;
  private readonly pendingIcons = new Set<string>();
  private fallbackIcon?: HudImage | null;

  constructor(readonly library: unknown, readonly assets: ItemHudAssets,
    readonly abuseText: string, readonly describe: (idx: number) => ItemDescription | undefined,
    readonly cloud: ItemHudCloud | undefined, readonly slots: ItemSlotDefinition | undefined,
    readonly dependencies: ItemHudDependencies, options: ItemHudLoadOptions = {}) {
    this.state = emptyItemHudState(options.capacity ?? 2);
    this.options = options.options ?? defaultItemHudOptions();
    this.text = new HudTextRasterizer(dependencies.createTextCanvas);
    this.renderer = dependencies.createRenderer();
    this.renderer.enableUiSmoothing();
  }

  static async load(library: unknown, dependencies: ItemHudDependencies,
    options: ItemHudLoadOptions = {}): Promise<ItemHud> {
    const [assets, abuseText, descriptions] = await Promise.all([
      loadItemHudAssets(library, dependencies),
      loadAbuseText(library, dependencies),
      options.describe ? undefined : loadItemDescriptions(library, dependencies),
    ]);
    let cloud: ItemHudCloud | undefined;
    if (dependencies.cloud) {
      try {
        cloud = await ItemHudCloud.load(library, dependencies.cloud);
      } catch (error) {
        dependencies.warn?.(`乌云遮挡未载入：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const describe = options.describe ?? ((idx: number) => descriptions!.get(idx));
    const hud = new ItemHud(library, assets, abuseText, describe, cloud, options.slots,
      dependencies, options);
    try {
      await hud.prepareIcons(options.itemIds ?? ITEM_RACE_ITEM_IDS);
      return hud;
    } catch (error) {
      hud.dispose();
      throw error;
    }
  }

  setState(state: ItemHudState): void { this.state = state; }
  setOptions(options: ItemHudOptions): void { this.options = { ...options }; }

  async prepareIcons(ids: readonly number[]): Promise<void> {
    await Promise.all([
      ...ids.map(idx => this.loadNoticeIcon(idx)),
      this.slots ? this.slots.resources.prepare(ids)
        : Promise.all(ids.map(idx => this.loadSmallIcon(idx))),
    ]);
  }

  noticeIcon = (idx: number): HudImage | undefined => {
    const icon = this.noticeIcons.get(idx);
    if (icon !== undefined) return icon ?? this.fallbackIcon ?? undefined;
    void this.loadNoticeIcon(idx);
    return undefined;
  };

  smallIcon = (idx: number): HudImage | undefined => {
    if (this.slots) return this.slots.resources.smallIcon(idx);
    const icon = this.smallIcons.get(idx);
    if (icon !== undefined) return icon ?? undefined;
    void this.loadSmallIcon(idx);
    return undefined;
  };

  /** Builds this frame's panels; `rank` places the scanning icons. */
  update(timeMs: number, rank?: ItemHudRankSource): void {
    if (this.disposed) return;
    const tick = Math.trunc(timeMs) >>> 0;
    this.cloud?.update(this.state.cloud, tick);
    if (this.text.size > ITEM_HUD_TEXT_CACHE_LIMIT) this.dropTextTextures();
    const small = this.slots;
    this.commands = buildItemHudCommands(this.assets, {
      state: this.state, options: this.options, timeMs,
      noticeIcon: this.noticeIcon, smallIcon: this.smallIcon,
      smallSlot: small ? { frame: small.small, texture: small.frameTexture,
        textureName: small.frameTextureName } : undefined,
      describe: this.describe, abuseText: this.abuseText, text: this.text.draw,
      rank: rank && this.state.scan?.length ? this.rankLayout(rank) : undefined,
    }).over;
    this.renderer.update(this.commands, tick);
  }

  /** Under the race HUD: the screen cover (mq_window draws cloud2Effect first). */
  renderUnder(renderer: unknown, width: number, height: number): void {
    if (!this.disposed) this.cloud?.render(renderer, width, height);
  }

  renderOver(renderer: unknown, width: number, height: number): void {
    if (!this.disposed && this.commands.length) this.renderer.render(renderer, width, height);
  }

  reset(): void {
    if (this.disposed) return;
    this.state = emptyItemHudState(this.state.capacity);
    this.commands = [];
    this.renderer.update([], 0);
    this.cloud?.reset();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
    this.cloud?.dispose();
    this.text.clear();
  }

  /** The rank list origin as release JJ computes it (l5 of the board, then of the list). */
  private rankLayout(source: ItemHudRankSource) {
    const { rank } = source.definition;
    const place = this.dependencies.place;
    const board = place(rank.boardGeometry, { left: 0, top: 0, right: 1600, bottom: 900 });
    const list = place(rank.rows.listGeometry, { left: 0, top: 0,
      right: board.right - board.left, bottom: board.bottom - board.top });
    return { left: board.left + list.left, top: board.top + list.top,
      rowWidth: rank.rows.rowWidth, rowHeight: rank.rows.other.height,
      rows: source.rankRows ?? [] };
  }

  /** Text textures are cached per string; past the limit start over. */
  private dropTextTextures(): void {
    this.renderer.dispose();
    this.renderer = this.dependencies.createRenderer();
    this.renderer.enableUiSmoothing();
    this.text.clear();
  }

  private async loadNoticeIcon(idx: number): Promise<void> {
    if (!Number.isInteger(idx) || idx < 0 || this.noticeIcons.has(idx)) return;
    const key = `notice:${idx}`;
    if (this.pendingIcons.has(key)) return;
    this.pendingIcons.add(key);
    try {
      this.noticeIcons.set(idx, await this.texture(noticeFolder, `item${idx}`));
    } catch {
      this.noticeIcons.set(idx, null);
      if (this.fallbackIcon === undefined) {
        try { this.fallbackIcon = await this.texture(noticeFolder, "item_none"); }
        catch { this.fallbackIcon = null; }
      }
    } finally {
      this.pendingIcons.delete(key);
    }
  }

  private async loadSmallIcon(idx: number): Promise<void> {
    if (!Number.isInteger(idx) || idx < 0 || this.smallIcons.has(idx)) return;
    const key = `small:${idx}`;
    if (this.pendingIcons.has(key)) return;
    this.pendingIcons.add(key);
    try { this.smallIcons.set(idx, await this.texture("item/slot", `item_s${idx}`)); }
    catch { this.smallIcons.set(idx, null); }
    finally { this.pendingIcons.delete(key); }
  }

  private async texture(folder: string, name: string): Promise<HudImage> {
    const deps = this.dependencies;
    return deps.decodeTexture(await deps.findResource(this.library, [folder], name).bytes());
  }
}

export type { HudNode, HudRect };
