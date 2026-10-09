/** Garage selector presentation and input shell. Equipment decisions live in garage-selection. */
import { drawOwnershipBadge } from "./ownership-badge";

export const GARAGE_WIDTH = 1600;
export const GARAGE_HEIGHT = 900;
export const GARAGE_FONT = "P3528 Source Han Sans CN Garage";

export interface GarageTopTab { key: string; category?: string }

/** dialog.rho/garageDialog top tabs as released; 锁定, 网吧 and 使用 had no category. */
export const releaseGarageTopTabs: readonly GarageTopTab[] = [
  { key: "favoriteItem", category: "favorite" },
  { key: "lockedItem" },
  { key: "pcCafe" },
  { key: "kartBody", category: "kart" },
  { key: "character", category: "character" },
  { key: "equip", category: "equip" },
  { key: "useful" },
  { key: "deco", category: "deco" },
];

/** Web tabs: 锁定 and 网吧 have no Web data and are hidden; 使用 lists items in use. */
export const webGarageTopTabs: readonly GarageTopTab[] = releaseGarageTopTabs
  .filter(tab => tab.key !== "lockedItem" && tab.key !== "pcCafe")
  .map(tab => tab.key === "useful" ? { ...tab, category: "using" } : tab);

type AnyFunction = (...args: any[]) => any;
/** Host services retain the release's asset, canvas and DOM implementations. */
export interface GarageSelectionViewOps {
  document: any;
  window: any;
  ResizeObserver: new (callback: AnyFunction) => any;
  requestAnimationFrame(callback: AnyFunction): number;
  cancelAnimationFrame(id: number): void;
  performance: { now(): number };
  CanvasDrawing: new (canvas: any) => any;
  Scrollbar: new (callback: AnyFunction) => any;
  TouchSwipe: new (...args: any[]) => any;
  touchSwipeConfig: any;
  touchSwipeThreshold: any;
  buildWindows: AnyFunction;
  gridStep: AnyFunction;
  draftProfile: AnyFunction;
  normalizeKartKey: AnyFunction;
  kartAppearancePath: AnyFunction;
  appearanceMatches: AnyFunction;
  loadPanels: AnyFunction;
  cardRect: AnyFunction;
  validateKart: AnyFunction;
  validateCharacter: AnyFunction;
  loadAssets: AnyFunction;
  attribute: AnyFunction;
  child: AnyFunction;
  drawFrame: AnyFunction;
  drawText: AnyFunction;
  frameContent: AnyFunction;
  captionRect: AnyFunction;
  layoutRect: AnyFunction;
  drawImage: AnyFunction;
  drawCardImage: AnyFunction;
  drawScrollbar: AnyFunction;
  spriteSourceX: AnyFunction;
  itemKey: AnyFunction;
  hoverState: AnyFunction;
  drawIcon: AnyFunction;
  equipmentSlot: any;
  kartProgression: AnyFunction;
  engineFamily: AnyFunction;
  engineLevelText: AnyFunction;
  classicLevelText: AnyFunction;
  drawLabel: AnyFunction;
  measureText: AnyFunction;
  tooltipRect: AnyFunction;
  noticeLayout: AnyFunction;
  drawNoticePanel: AnyFunction;
  resizeCanvas: AnyFunction;
  pixelRatio: AnyFunction;
  itemGrid: AnyFunction;
  positionInput: AnyFunction;
  pointInRect: AnyFunction;
  moveHover: AnyFunction;
  playClick: AnyFunction;
}

export interface GarageHit {
  id: string;
  kind: string;
  value?: any;
  rect: { x: number; y: number; width: number; height: number };
}

/** These kinds have no ordinary hover cue in the native selector. */
export function suppressGarageHoverCue(kind: string | undefined): boolean {
  return kind === "item" || kind === "favorite" || kind === "appearance" ||
    kind === "search" || kind === "appearanceCancel";
}

/** The business methods below are provided by the existing garage-selection source. */
export function createGarageSelectionViewClass(ops: GarageSelectionViewOps) {
  abstract class GarageSelectionView {
    options: any;
    assets: any;
    element = ops.document.createElement("div");
    canvas = ops.document.createElement("canvas");
    search = ops.document.createElement("input");
    context: any;
    drawing: any;
    resizeObserver: any;
    renderPixelRatio = 1;
    onWindowResize = () => this.render();
    category = "favorite";
    subCategory = "whole";
    draftProfile: any;
    hits: GarageHit[] = [];
    offset = 0;
    hovered: string | undefined;
    pressed: string | undefined;
    shown = false;
    /** Top category tabs; tests may swap in the released list. */
    topTabs: readonly GarageTopTab[] = webGarageTopTabs;
    disposed = false;
    frozen = false;
    animationFrame = 0;
    searchQuery = "";
    searchState = 0;
    searchTooltipVisible = false;
    livePanels: any;
    previewPointer: number | undefined;
    previewPointerX = 0;
    scrollPointer: number | undefined;
    scroll: any;
    touchSwipe = new ops.TouchSwipe(ops.touchSwipeConfig, ops.touchSwipeThreshold,
      (direction: number) => this.scroll.wheel(direction));
    windows: any;
    appearanceDialog: any;
    legacyAppearance = new Map();
    favoriteKeyCache: any;

    constructor(options: any, assets: any) {
      this.options = options;
      this.assets = assets;
      this.drawing = new ops.CanvasDrawing(this.canvas);
      this.context = this.drawing.context;
      this.windows = ops.buildWindows(assets.definition, assets.frames);
      this.scroll = new ops.Scrollbar((position: number) => {
        this.offset = position * ops.gridStep(assets.grid);
        this.render();
      });
      this.draftProfile = ops.draftProfile(options.profile, options.selectedKartItemId,
        options.selectedCharacterItemId, options.selectedKartSystemKey);
      const key = ops.normalizeKartKey(options.selectedKartSystemKey);
      const appearance = ops.kartAppearancePath(options.selectedKartPath);
      if (key && appearance && ops.appearanceMatches(key.key, appearance))
        this.legacyAppearance.set(key.key, appearance);
      this.prepareElements();
      this.element.className = "client-dialog";
      this.element.dataset.uiLayer = "dialog";
      this.element.hidden = true;
      this.element.append(this.canvas, this.search);
      options.root.append(this.element);
      this.resizeObserver = new ops.ResizeObserver(() => this.render());
      this.resizeObserver.observe(options.root);
      ops.window.addEventListener("resize", this.onWindowResize);
      ops.loadPanels(options.library, options.environment, options.stageBinding,
        () => this.render(),
        ops.cardRect(assets.cardDefinition, { x: 0, y: 0, width: 0, height: 0 }),
        this.rect("charKartPreview"))
        .then((panels: any) => {
          if (this.disposed) panels.dispose();
          else { this.livePanels = panels; this.render(); }
        })
        .catch(() => {});
    }

    static async load(options: any): Promise<any> {
      ops.validateKart(options.catalog.karts, options.selectedKartItemId,
        options.selectedKartSystemKey);
      ops.validateCharacter(options.catalog.characters, options.selectedCharacterItemId, "人物");
      const assets = await ops.loadAssets(options.library);
      return new (this as any)(options, assets);
    }

    abstract subTabs(): any[];
    abstract filteredItems(): any[];
    abstract categoryItems(): any[];
    abstract allCategoryItems(): any[];
    abstract favoriteCategoryItems(): any[];
    abstract decorationItems(): any[];
    abstract favoriteKey(item: any): string | undefined;
    abstract favoriteKeys(): Set<string>;
    abstract toggleFavoriteItem(item: any): void;
    abstract clampFavoriteOffset(): void;
    abstract selectCategory(category: string): void;
    abstract selectSubCategory(category: string): void;
    abstract selectItem(item: any): void;
    abstract commitItem(item: any): void;
    abstract selectDecoration(item: any): void;
    abstract confirm(): void;
    abstract activate(action: GarageHit): void;
    abstract selectedKart(): any;
    abstract selectLegacyAppearance(level: string): void;

    show(): void {
      if (this.disposed) return;
      this.frozen = false;
      this.shown = true;
      this.element.hidden = false;
      this.showEmptyFavoriteNotice();
      this.canvas.hidden = false;
      this.search.hidden = false;
      ops.window.addEventListener("keydown", this.onKeyDown);
      this.render();
      this.animationFrame = ops.requestAnimationFrame(this.onAnimationFrame);
      this.canvas.focus();
    }
    freeze(): void {
      if (this.disposed) return;
      this.frozen = true;
      ops.cancelAnimationFrame(this.animationFrame);
      this.element.style.pointerEvents = "none";
    }
    unfreeze(): void {
      if (this.disposed) return;
      this.frozen = false;
      this.element.style.pointerEvents = "auto";
      this.render();
      this.animationFrame = ops.requestAnimationFrame(this.onAnimationFrame);
    }
    dispose(): void {
      if (this.disposed) return;
      this.disposed = true;
      ops.cancelAnimationFrame(this.animationFrame);
      this.scroll.dispose();
      this.resizeObserver.disconnect();
      ops.window.removeEventListener("resize", this.onWindowResize);
      ops.window.removeEventListener("keydown", this.onKeyDown);
      this.canvas.removeEventListener("pointermove", this.onPointerMove);
      this.canvas.removeEventListener("pointerdown", this.onPointerDown);
      this.canvas.removeEventListener("pointerup", this.onPointerUp);
      this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
      this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
      this.canvas.removeEventListener("wheel", this.onWheel);
      this.search.removeEventListener("keydown", this.onSearchKeyDown);
      this.search.removeEventListener("pointerdown", this.onSearchPointerDown);
      this.search.removeEventListener("pointermove", this.onSearchPointerMove);
      this.search.removeEventListener("pointerleave", this.onSearchPointerLeave);
      this.canvas.remove();
      this.search.remove();
      this.drawing.dispose();
      this.element.remove();
      this.livePanels?.dispose();
    }

    prepareElements(): void {
      Object.assign(this.canvas.style, {
        position: "absolute", inset: "0", width: "100%", height: "100%",
        imageRendering: "pixelated", pointerEvents: "auto",
      });
      this.canvas.hidden = true;
      this.canvas.tabIndex = 0;
      this.canvas.setAttribute("role", "dialog");
      this.canvas.setAttribute("aria-label", this.text("itemTitle"));
      this.search.className = "window-edit";
      Object.assign(this.search.style, {
        position: "absolute", boxSizing: "border-box", border: "0", outline: "0",
        background: "transparent", color: "rgb(223, 223, 223)",
        font: `16px "${GARAGE_FONT}"`, padding: "0",
      });
      this.search.hidden = true;
      this.search.maxLength = Number(ops.attribute(ops.child(this.assets.definition, "searchEdit"), "maxChar"));
      this.search.spellcheck = false;
      this.search.autocomplete = "off";
      this.search.setAttribute("aria-label", this.text("searchTooltip"));
      this.canvas.addEventListener("pointermove", this.onPointerMove);
      this.canvas.addEventListener("pointerdown", this.onPointerDown);
      this.canvas.addEventListener("pointerup", this.onPointerUp);
      this.canvas.addEventListener("pointercancel", this.onPointerCancel);
      this.canvas.addEventListener("pointerleave", this.onPointerLeave);
      this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
      this.search.addEventListener("keydown", this.onSearchKeyDown);
      this.search.addEventListener("pointerdown", this.onSearchPointerDown);
      this.search.addEventListener("pointermove", this.onSearchPointerMove);
      this.search.addEventListener("pointerleave", this.onSearchPointerLeave);
    }

    render(): void {
      if (!this.shown || this.disposed) return;
      this.resizeCanvas();
      this.drawing.beginFrame();
      this.context.clearRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);
      this.context.imageSmoothingEnabled = true;
      this.hits = [];
      const caption = this.rect("captionDlgFrame");
      const cards = this.liveCards();
      const kart = this.selectedKart();
      const character = ops.validateCharacter(this.options.catalog.characters,
        this.draftProfile.equipment.itemIds[1], "人物");
      this.livePanels?.render(ops.performance.now(), GARAGE_WIDTH, GARAGE_HEIGHT, cards,
        this.rect("charKartPreview"), kart, character, this.draftProfile,
        undefined, true, this.renderPixelRatio, this.drawing);
      this.context.fillStyle = "rgba(0, 0, 0, 0.392)";
      this.context.fillRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);
      const frame = this.assets.frames.get("BigCaptionDialog");
      ops.drawFrame(this.context, frame, this.assets.caption.image, caption);
      ops.drawText(this.context, this.text("itemTitle"),
        ops.captionRect(frame, caption, this.assets.captionOffset),
        20, "white", "center", "button");
      this.drawPreview();
      this.drawItemBox();
      this.drawButtons();
      this.drawCloseButton();
      this.positionSearch();
      if (this.appearanceDialog) this.drawAppearanceDialog();
      this.drawing.endFrame();
      this.canvas.style.cursor = this.hovered === undefined ? "default" : "pointer";
    }
    drawPreview(): void {
      const preview = this.rect("previewWindow");
      ops.drawImage(this.context, this.assets.previewBackground, preview);
      this.livePanels?.drawPreview(this.context, this.rect("charKartPreview"));
      ops.drawImage(this.context, this.assets.previewFrame, preview);
    }
    drawItemBox(): void {
      const itemBox = this.rect("itemBox");
      this.context.fillStyle = "rgb(160, 170, 184)";
      this.context.fillRect(itemBox.x, itemBox.y, itemBox.width, itemBox.height);
      ops.drawFrame(this.context, this.assets.frames.get("TabBoxLarge"),
        this.assets.frame02.image, this.rect("itemCatTabHolder"));
      this.drawTopTabs();
      this.drawSubTabs();
      this.drawItems();
      this.drawSearch();
    }
    drawTopTabs(): void {
      const tabHolder = ops.frameContent(this.assets.frames.get("TabBoxLarge"), this.rect("itemCatTabHolder"));
      const baseline = ops.layoutRect(this.assets.tabDefinition, tabHolder,
        this.assets.tabStyle.states[0].frame);
      let margin = Number(ops.attribute(ops.child(this.assets.definition, "tabMarginCont"), "adjust").split(" ")[0]);
      this.topTabs.forEach(tab => {
        const label = this.text(tab.key);
        const rect = { ...baseline, x: baseline.x + margin, width: this.tabTextWidth(label) + 40 };
        margin += rect.width;
        const id = `category:${tab.category ?? tab.key}`;
        const selected = tab.category === this.category;
        const state = this.assets.tabStyle.states[this.tabState(id, selected)];
        ops.drawFrame(this.context, state.frame, this.assets.frame02.image, rect);
        ops.drawText(this.context, label, ops.frameContent(state.frame, rect),
          Number(state.textRender.replace("bold", "")), state.textColor, "center", "button");
        if (tab.category && !selected)
          this.addHit({ id, kind: "category", value: tab.category, rect });
      });
    }
    drawSubTabs(): void {
      const tabs = this.subTabs();
      const baseline = ops.layoutRect(this.assets.subTabDefinition, this.rect("itemSubCatHolder"),
        this.assets.subTabStyle.states[0].frame);
      const margin = Number(ops.attribute(ops.child(this.assets.definition, "subTabMarginCont"), "adjust").split(" ")[0]);
      let offset = 0;
      tabs.forEach(tab => {
        const label = this.text(tab.key);
        const rect = { ...baseline, x: baseline.x + offset, width: this.tabTextWidth(label) + margin };
        offset += rect.width;
        const id = `sub:${tab.value}`;
        const selected = tab.value === this.subCategory;
        const state = this.assets.subTabStyle.states[this.tabState(id, selected)];
        ops.drawFrame(this.context, state.frame, this.assets.frame01.image, rect);
        ops.drawText(this.context, label, ops.frameContent(state.frame, rect),
          Number(state.textRender.replace("bold", "")), state.textColor, "center", "button");
        if (!selected) this.addHit({ id, kind: "subCategory", value: tab.value, rect });
      });
    }
    tabTextWidth(label: string): number {
      return ops.measureText(this.context, label, { family: GARAGE_FONT, size: 16 }).width;
    }
    tabState(id: string, selected: boolean): number {
      return selected ? 3 : ops.hoverState(id, this.hovered, this.pressed);
    }
    drawItems(): void {
      const items = this.filteredItems();
      const grid = this.itemGrid(items.length);
      grid.cells.forEach((rect: GarageHit["rect"], index: number) => {
        const item = items[grid.firstItem + index];
        this.addHit({ id: ops.itemKey(item), kind: "item", value: item, rect });
        this.drawCard(item, rect);
      });
      const scrollbar = this.scroll.layout(this.assets.scrollbar, this.rect("itemListBar"),
        grid.positionCount, this.offset / ops.gridStep(this.assets.grid));
      if (grid.positionCount > 1)
        ops.drawScrollbar(this.context, this.assets.scrollbar,
          this.assets.frame01.image, scrollbar, this.scroll.buttonState);
    }
    showEmptyFavoriteNotice(): void {
      if (this.category === "favorite" && this.filteredItems().length === 0)
        this.showFavoriteNotice("favoriteItemNone");
    }
    showFavoriteNotice(key: string, item?: string): void {
      const frame = this.assets.frames.get("CaptionDialog");
      const layout = ops.noticeLayout(this.assets.noticeDefinition, frame).window;
      const message = item === undefined ? this.text(key) : this.text(key).replace("%s", item);
      this.options.onNotice(layout, message, (context: any) => this.drawNotice(context, message));
    }
    drawNotice(context: any, message: string): void {
      const frame = this.assets.frames.get("CaptionDialog");
      const assets = {
        definition: this.assets.noticeDefinition, frame, frameImage: this.assets.frame01.image,
        iconImage: this.assets.noticeIcon.image, captionOffset: this.assets.noticeCaptionOffset,
      };
      const layout = ops.noticeLayout(assets.definition, frame);
      ops.drawNoticePanel(context, assets, layout, this.text("notice"), [message], GARAGE_FONT);
    }

    drawCard(item: any, rect: GarageHit["rect"]): void {
      const equipped = item.itemId === this.draftProfile.equipment.itemIds[ops.equipmentSlot[item.kind]] &&
        (item.kind !== "kart" || item.itemId !== 0 ||
          item.systemKey === this.draftProfile.equipment.systemKart);
      const rarity = item.kind === "kart" && item.vehicleRarityLevel !== undefined
        ? this.assets.qualityCards.get(item.vehicleRarityLevel) : undefined;
      const image = rarity ?? (equipped ? this.assets.selectedCard : this.assets.card);
      const hovered = this.hovered === ops.itemKey(item);
      ops.drawCardImage(this.context, image, {
        x: rarity ? ops.spriteSourceX(rarity.width, hovered) : hovered ? 0 : rect.width,
        y: 0, width: rect.width, height: rect.height,
      }, rect);
      this.drawCardTitle(item, rect);
      this.livePanels?.drawCard(this.context, item, ops.cardRect(this.assets.cardDefinition, rect));
      this.drawKartLevelBadge(item, rect);
      if (equipped)
        ops.drawFrame(this.context, this.assets.selectedFrame, this.assets.frame01.image, rect);
      this.drawFavoriteCheck(item, rect);
      // Rentals from the account inventory show their remaining time.
      drawOwnershipBadge(this.context, item, rect, GARAGE_FONT);
    }
    drawFavoriteCheck(item: any, rect: GarageHit["rect"]): void {
      const key = this.favoriteKey(item);
      if (key === undefined) return;
      const check = ops.layoutRect(ops.child(this.assets.cardDefinition, "favoriteItemCheck"), rect);
      const selected = this.favoriteKeys().has(key);
      ops.drawIcon(this.context, this.assets.favoriteMark[selected ? 1 : 0], check);
      this.addHit({ id: `favorite:${ops.itemKey(item)}`, kind: "favorite", value: item, rect: check });
    }
    drawKartLevelBadge(item: any, rect: GarageHit["rect"]): void {
      if (item.kind !== "kart") return;
      const serial = item.itemId === this.draftProfile.equipment.itemIds[3]
        ? this.draftProfile.equipment.kartSerial : 0;
      const progression = ops.kartProgression(this.draftProfile.garage, item.itemId, serial).progression;
      const level = progression?.level;
      const family = ops.engineFamily(item.engineGrade);
      const label = ops.engineLevelText(item.engineGrade, level);
      if (!family || !label || !progression || progression.kind !== family) return;
      const background = family === "xun" ? this.assets.xunLevelBadges.get(level)
        : this.assets.levelBackground;
      if (!background) return;
      const x = rect.x + rect.width - (family === "xun" ? 12 : 10) - background.width;
      const y = rect.y + (family === "xun" ? 47 : 46);
      this.context.drawImage(background.image, x, y);
      if (family === "classic") {
        const classicLabel = ops.classicLevelText(level);
        if (!classicLabel) return;
        ops.drawLabel(this.context, classicLabel,
          { x, y, width: background.width, height: background.height }, {
            family: GARAGE_FONT, size: 12, stroke: 1, kind: "label", color: "white",
            strokeColor: "rgba(113, 0, 0, 0.95)", align: "center", verticalAlign: "center",
          });
      }
    }
    drawCardTitle(item: any, rect: GarageHit["rect"]): void {
      const key = item.kind === "kart" && item.vehicleRarityLevel === 6
        ? "ultimateNameLabel" : "itemNameLabel";
      const label = ops.child(this.assets.cardDefinition, key);
      const size = Number(ops.attribute(label, "textRender").replace("bold", ""));
      const [alpha, red, green, blue] = ops.attribute(label, "textColor").split(/\s+/).map(Number);
      const font = { family: GARAGE_FONT, size };
      const container = ops.layoutRect(ops.child(this.assets.cardDefinition, "itemNameContainer"), rect);
      const labelRect = ops.layoutRect(label, container, undefined, undefined,
        ops.measureText(this.context, item.title, font));
      ops.drawLabel(this.context, item.title, labelRect, {
        ...font, kind: "label", color: `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`,
        align: "left", verticalAlign: "top",
      });
    }
    liveCards(): any[] {
      const items = this.filteredItems();
      const grid = this.itemGrid(items.length);
      return grid.cells.map((rect: GarageHit["rect"], index: number) => {
        const item = items[grid.firstItem + index];
        return { item, kartShadow: item.kind === "kart" ? true : undefined,
          rect: ops.cardRect(this.assets.cardDefinition, rect) };
      });
    }
    drawSearch(): void {
      const rect = this.rect("searchBtn");
      const state = this.searchState === 5 ? 0 : this.searchState;
      ops.drawImage(this.context, this.assets.search[state], rect);
      this.addHit({ id: "search", kind: "search",
        rect: { x: rect.x, y: rect.y, width: 30, height: rect.height } });
      this.drawSearchTooltip();
    }
    drawSearchTooltip(): void {
      if (!this.searchTooltipVisible) return;
      const message = this.text("searchTooltip");
      const font = { family: GARAGE_FONT, size: 14 };
      const frame = this.assets.frames.get("DefaultTooltipNew");
      const rect = ops.tooltipRect(ops.child(this.assets.definition, "searchEditTooltip"),
        this.rect("searchBtn"), frame, ops.measureText(this.context, message, font));
      ops.drawFrame(this.context, frame, this.assets.searchTooltipFrame.image, rect);
      ops.drawLabel(this.context, message, ops.frameContent(frame, rect), {
        ...font, kind: "label", color: "white", align: "left", verticalAlign: "top",
      });
    }
    drawCloseButton(): void {
      const frame = this.assets.frames.get("BigCaptionDialog");
      const rect = ops.layoutRect(this.assets.closeDefinition,
        ops.frameContent(frame, this.rect("captionDlgFrame")));
      const state = ops.hoverState("close", this.hovered, this.pressed);
      ops.drawIcon(this.context, this.assets.close[state], rect);
      this.addHit({ id: "close", kind: "confirm", rect });
    }
    drawButtons(): void {
      this.drawTextButton("confirm", this.text("ok"), this.rect("ok"));
      this.drawTextButton("cancel", this.text("cancel"), this.rect("cancel"));
    }
    drawTextButton(kind: string, label: string, rect: GarageHit["rect"]): void {
      const stateIndex = ops.hoverState(kind, this.hovered, this.pressed) + 1;
      const style = this.assets.buttonStyles.get(kind === "confirm" ? "ok" : "cancel").states[stateIndex - 1];
      ops.drawFrame(this.context, style.frame, this.assets.buttonFrame.image, rect);
      ops.drawText(this.context, label, ops.frameContent(style.frame, rect),
        Number(style.textRender.replace("bold", "")), style.textColor, "center", "button");
      this.addHit({ id: kind, kind, rect });
    }
    drawAppearanceDialog(): void {
      const dialog = this.appearanceDialog;
      if (!dialog) return;
      const rect = { x: 490, y: 282, width: 620, height: 300 };
      this.context.fillStyle = "rgba(0, 0, 0, 0.58)";
      this.context.fillRect(0, 0, GARAGE_WIDTH, GARAGE_HEIGHT);
      this.addHit({ id: "appearance:cancel", kind: "appearanceCancel",
        rect: { x: 0, y: 0, width: GARAGE_WIDTH, height: GARAGE_HEIGHT } });
      const frame = this.assets.frames.get("CaptionDialog");
      ops.drawFrame(this.context, frame, this.assets.frame01.image, rect);
      ops.drawText(this.context, `${dialog.family.title} · 等级外观`,
        { x: rect.x + 24, y: rect.y + 10, width: rect.width - 48, height: 34 },
        20, "white", "center", "button");
      ops.drawText(this.context, "仅切换模型外观；车辆身份与性能参数保持不变",
        { x: rect.x + 24, y: rect.y + 62, width: rect.width - 48, height: 30 },
        15, "rgb(210, 225, 241)", "center", "button");
      const names: Record<string, string> = { rookie: "Rookie", l3: "L3", l2: "L2", l1: "L1" };
      dialog.family.states.forEach((state: { level: string }, index: number) => {
        this.drawAppearanceButton(`appearance:${state.level}`, names[state.level]!,
          { x: rect.x + 48 + index * 132, y: rect.y + 112, width: 116, height: 48 }, state.level);
      });
      this.drawAppearanceCancelButton({ x: rect.x + 237, y: rect.y + 218, width: 146, height: 48 });
    }
    drawAppearanceButton(id: string, label: string, rect: GarageHit["rect"], level: string): void {
      const stateIndex = ops.hoverState(id, this.hovered, this.pressed) + 1;
      const style = this.assets.buttonStyles.get("ok").states[stateIndex - 1];
      ops.drawFrame(this.context, style.frame, this.assets.buttonFrame.image, rect);
      ops.drawText(this.context, label, ops.frameContent(style.frame, rect),
        Number(style.textRender.replace("bold", "")), style.textColor, "center", "button");
      this.addHit({ id, kind: "appearance", value: level, rect });
    }
    drawAppearanceCancelButton(rect: GarageHit["rect"]): void {
      const id = "appearance:cancel-button";
      const stateIndex = ops.hoverState(id, this.hovered, this.pressed) + 1;
      const style = this.assets.buttonStyles.get("cancel").states[stateIndex - 1];
      ops.drawFrame(this.context, style.frame, this.assets.buttonFrame.image, rect);
      ops.drawText(this.context, this.text("cancel"), ops.frameContent(style.frame, rect),
        Number(style.textRender.replace("bold", "")), style.textColor, "center", "button");
      this.addHit({ id, kind: "appearanceCancel", rect });
    }

    text(key: string): string {
      if (key === "legacyMuseum") return "经典测试";
      if (key === "pet") return this.assets.strings.get(key) ?? "宠物";
      const value = this.assets.strings.get(key);
      if (value === undefined)
        throw new Error(`P3528 GarageDialog 缺少 StringBag key：${key}。`);
      return value;
    }
    resizeCanvas(): void {
      const bounds = this.options.root.getBoundingClientRect();
      const result = ops.resizeCanvas(this.canvas, this.context, bounds.width, bounds.height,
        ops.pixelRatio(), GARAGE_WIDTH, GARAGE_HEIGHT, GARAGE_WIDTH, GARAGE_HEIGHT);
      this.renderPixelRatio = result.scaleX;
    }
    rect(key: string): GarageHit["rect"] {
      const value = this.windows.get(key);
      if (!value) throw new Error(`P3528 GarageDialog 缺少布局节点：${key}。`);
      return value;
    }
    itemGrid(count: number): any {
      const list = this.rect("itemList");
      const card = ops.layoutRect(this.assets.cardDefinition, list);
      return ops.itemGrid(this.assets.grid, list, card, count,
        this.offset / ops.gridStep(this.assets.grid));
    }
    positionSearch(): void {
      const rect = this.rect("searchEdit");
      const bounds = this.options.root.getBoundingClientRect();
      ops.positionInput(this.search, rect, bounds.width / GARAGE_WIDTH, bounds.height / GARAGE_HEIGHT);
    }
    clearSearch(): void {
      this.search.value = "";
      this.searchQuery = "";
      this.searchState = 0;
      this.searchTooltipVisible = false;
      this.search.blur();
    }
    addHit(hit: GarageHit): void { this.hits.push(hit); }
    hitAt(event: any): GarageHit | undefined {
      const bounds = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) * GARAGE_WIDTH) / bounds.width;
      const y = ((event.clientY - bounds.top) * GARAGE_HEIGHT) / bounds.height;
      const candidates = this.appearanceDialog
        ? this.hits.filter(hit => hit.kind === "appearance" || hit.kind === "appearanceCancel")
        : this.hits;
      return [...candidates].reverse().find(hit => ops.pointInRect(x, y, hit.rect));
    }

    onPointerMove = (event: any): void => {
      this.searchTooltipVisible = false;
      if (this.touchSwipe.isActive(event.pointerId)) {
        this.touchSwipe.move(event.pointerId, event.clientY);
        return;
      }
      if (event.pointerId === this.scrollPointer) {
        this.scroll.move(this.eventPoint(event), (event.buttons & 1) !== 0);
        return;
      }
      if (event.pointerId === this.previewPointer) {
        const point = this.eventPoint(event);
        this.livePanels?.rotatePreview(point.x - this.previewPointerX);
        this.previewPointerX = point.x;
        this.render();
        return;
      }
      const hit = this.hitAt(event);
      const id = hit?.id;
      this.moveSearchButton(id);
      if (id === this.hovered) return;
      const suppress = suppressGarageHoverCue(hit?.kind);
      this.hovered = ops.moveHover(this.hovered, id,
        this.options.onHover && !suppress && id !== "appearance:cancel"
          ? { playHover: this.options.onHover } : undefined);
      this.render();
    };
    onPointerDown = (event: any): void => {
      if (event.button !== 0) return;
      const point = this.eventPoint(event);
      const hit = this.hitAt(event);
      this.pressSearchButton(hit);
      if (this.beginScroll(event, point)) return;
      if (this.beginTouchSwipe(event, point)) return;
      if (this.beginPreviewDrag(event, point)) return;
      if (hit) this.beginButtonPress(hit, event);
    };
    beginButtonPress(hit: GarageHit, event: any): void {
      this.options.onInteraction?.();
      this.pressed = hit.id;
      this.hovered = hit.id;
      this.canvas.setPointerCapture(event.pointerId);
      if (hit.kind === "item") {
        ops.playClick(this.options.onActivate ? { playClick: this.options.onActivate } : undefined);
        this.selectItem(hit.value);
      } else this.render();
    }
    onPointerUp = (event: any): void => {
      if (this.touchSwipe.isActive(event.pointerId)) {
        this.finishTouchSwipe(event);
        return;
      }
      if (this.endScroll(event)) return;
      if (event.pointerId === this.previewPointer) {
        this.previewPointer = undefined;
        this.livePanels?.resetPreviewRotation();
        this.releasePointer(event);
        this.render();
        return;
      }
      const hit = this.releasedButton(event);
      this.pressed = undefined;
      this.releasePointer(event);
      if (hit) {
        ops.playClick(hit.id === "appearance:cancel" ? undefined
          : this.options.onActivate ? { playClick: this.options.onActivate } : undefined);
        this.activate(hit);
      } else this.render();
    };
    releasedButton(event: any): GarageHit | undefined {
      const hit = this.hitAt(event);
      if (hit && hit.id === this.pressed) return hit.kind === "item" ? undefined : hit;
      return undefined;
    }
    onPointerCancel = (event: any): void => {
      if (this.touchSwipe.isActive(event.pointerId)) {
        this.touchSwipe.finish(event.pointerId);
        this.releasePointer(event);
        this.render();
        return;
      }
      if (!this.endScroll(event)) {
        if (event.pointerId === this.previewPointer) {
          this.previewPointer = undefined;
          this.livePanels?.resetPreviewRotation();
        }
        this.pressed = undefined;
        this.moveSearchButton(undefined);
        this.releasePointer(event);
        this.render();
      }
    };
    onPointerLeave = (): void => {
      this.scroll.leave();
      this.hovered = undefined;
      this.moveSearchButton(undefined);
      this.render();
    };
    onWheel = (event: any): void => {
      if (this.appearanceDialog || event.deltaY === 0) return;
      const point = this.eventPoint(event);
      if (this.insideItemScroll(point) && this.scroll.wheel(event.deltaY > 0 ? 1 : -1))
        event.preventDefault();
    };
    insideItemScroll(point: { x: number; y: number }): boolean {
      return ["itemSelect", "itemListBar"].some(key =>
        ops.pointInRect(point.x, point.y, this.rect(key)));
    }
    beginPreviewDrag(event: any, point: { x: number; y: number }): boolean {
      if (event.button !== 0 || !ops.pointInRect(point.x, point.y, this.rect("charKartPreview")))
        return false;
      this.options.onInteraction?.();
      this.previewPointer = event.pointerId;
      this.previewPointerX = point.x;
      this.canvas.setPointerCapture(event.pointerId);
      return true;
    }
    beginScroll(event: any, point: { x: number; y: number }): boolean {
      if (event.button !== 0 || !this.scroll.down(point)) return false;
      this.options.onInteraction?.();
      this.scrollPointer = event.pointerId;
      this.canvas.setPointerCapture(event.pointerId);
      return true;
    }
    beginTouchSwipe(event: any, point: { x: number; y: number }): boolean {
      if (event.pointerType !== "touch" || !this.insideItemScroll(point)) return false;
      this.options.onInteraction?.();
      this.touchSwipe.begin(event.pointerId, event.clientY);
      this.canvas.setPointerCapture(event.pointerId);
      return true;
    }
    finishTouchSwipe(event: any): void {
      const moved = this.touchSwipe.finish(event.pointerId);
      this.releasePointer(event);
      if (moved) { this.render(); return; }
      const hit = this.hitAt(event);
      if (hit) this.activate(hit);
      else this.render();
    }
    endScroll(event: any): boolean {
      if (event.pointerId !== this.scrollPointer) return false;
      this.scrollPointer = undefined;
      this.scroll.up();
      this.releasePointer(event);
      return true;
    }
    releasePointer(event: any): void {
      if (this.canvas.hasPointerCapture(event.pointerId))
        this.canvas.releasePointerCapture(event.pointerId);
    }
    eventPoint(event: any): { x: number; y: number } {
      const bounds = this.canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - bounds.left) * GARAGE_WIDTH) / bounds.width,
        y: ((event.clientY - bounds.top) * GARAGE_HEIGHT) / bounds.height,
      };
    }

    onSearchKeyDown = (event: any): void => {
      if (event.key !== "Enter" || event.isComposing) return;
      event.preventDefault();
      this.options.onInteraction?.();
      ops.playClick(this.options.onActivate ? { playClick: this.options.onActivate } : undefined);
      this.commitSearch();
    };
    commitSearch(): void {
      this.searchQuery = this.search.value;
      this.offset = 0;
      this.scroll.reset();
      this.livePanels?.resetPreviewRotation();
      this.render();
    }
    moveSearchButton(id: string | undefined): void {
      if (id !== "search") {
        if (this.searchState !== 1) this.searchState = 0;
        return;
      }
      if (this.searchState === 0) this.searchState = 5;
    }
    pressSearchButton(hit: GarageHit | undefined): void {
      if (hit?.kind === "search")
        this.searchState = this.searchState === 1 ? 3 : 2;
      else { this.searchState = 0; this.searchTooltipVisible = false; }
    }
    activateSearch(): void {
      const repeat = this.searchState === 3;
      if (this.searchState !== 2 && !repeat) { this.render(); return; }
      this.searchState = 1;
      this.search.focus();
      if (repeat) this.commitSearch();
      else this.render();
    }
    toggleSearchFocus(): void {
      this.searchState = this.searchState === 1 ? 0 : 1;
      if (this.searchState === 1) this.search.focus();
      else this.search.blur();
      this.render();
    }
    onSearchPointerDown = (event: any): void => {
      if (event.button !== 0) return;
      this.options.onInteraction?.();
      ops.playClick(this.options.onActivate ? { playClick: this.options.onActivate } : undefined);
      this.searchState = 1;
      this.searchTooltipVisible = true;
      this.render();
    };
    onSearchPointerMove = (): void => {
      this.searchTooltipVisible = this.searchState === 1;
      this.render();
    };
    onSearchPointerLeave = (): void => {
      this.searchTooltipVisible = false;
      this.render();
    };
    onKeyDown = (event: any): void => {
      const action: Record<string, () => void> = {
        Escape: () => this.options.onCancel(),
        F1: () => this.toggleSearchFocus(),
        F5: () => this.commitSearch(),
      };
      const selected = action[event.key];
      if (selected) { event.preventDefault(); selected(); }
    };
    onAnimationFrame = (): void => {
      if (this.frozen) return;
      if (this.livePanels) this.render();
      if (!this.disposed)
        this.animationFrame = ops.requestAnimationFrame(this.onAnimationFrame);
    };
  }
  return GarageSelectionView;
}
