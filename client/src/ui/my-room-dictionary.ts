import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";
import { G1, T, V0, f5, m9, s2, st } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import type { DictionaryClaim, DictionarySummary } from "../myroom/myroom-api";
import { ImageCache, type MyRoomDataLibrary } from "../myroom/myroom-data";
import { askDictionaryReward } from "./my-room-dialogs";
import { myRoomHudColor, myRoomHudTextRender, readMyRoomStringBag, type MyRoomHudNode } from "./my-room-hud";

/**
 * The release 道具图鉴 (dialog.rho/itemDictionary itemDictionary@zz): the
 * main page with the four group cards (车辆 / 角色 / 装备 / 装饰), each with
 * three collection gauges and the first collected item of each; a group's
 * list page (itemTabGroup) with its sub tabs, the kart engine grade bar, the
 * name search and the itemDictionaryCard grid, 9 columns. The owner claims
 * the K币 of newly collected items with 领取奖励 (itemDictionaryReward@zz); a
 * visitor (浏览图鉴) only looks.
 */

interface ResourceFile { bytes(): Promise<Uint8Array> }

export interface MyRoomDictionaryLibrary extends MyRoomDataLibrary {
  canonicalCandidates(path: string): Array<ResourceFile & { text?(): Promise<string> }>;
}

/** The shop catalog's name and kart type of an item. */
export interface DictionaryItemInfo {
  name: string;
  internalId: string;
  /** Karts: 1 item kart, 2 speed kart. */
  kartType?: number;
}

/** Item pictures (the shop's garage snapshots); undefined keeps the name. */
export interface DictionaryPictureSource {
  picture(category: number, itemId: number, internalId: string,
    signal: AbortSignal): Promise<HTMLCanvasElement | undefined>;
  dispose(): void;
}

export interface MyRoomDictionaryOptions {
  library: MyRoomDictionaryLibrary;
  root: HTMLElement;
  summary: DictionarySummary;
  /** Names and kart types by itemKey(category, itemId). */
  items: ReadonlyMap<string, DictionaryItemInfo>;
  pictures?: DictionaryPictureSource;
  /** The owner's own dictionary: 领取奖励 is offered. */
  editable: boolean;
  claim?(): Promise<DictionaryClaim>;
  /** A release notice. */
  notice(title: string, message: string): Promise<unknown> | void;
  onClose(): void;
}

export interface MyRoomDictionaryWindow { dispose(): void }

type Rect = { x: number; y: number; width: number; height: number };

const FOLDER = "dialog/itemDictionary";
const FONT_FAMILY = "KartSim Dictionary";
const STAGE = { x: 0, y: 0, width: 1600, height: 900 };
const COLUMNS = 9;
const CARD = { width: 146, height: 140 };
const MARGIN = 3;
const ROW_HEIGHT = CARD.height + MARGIN;
const GRADES = 14; // engineGrade0 全部引擎 … engineGrade13 迅引擎
const PICTURES_KEPT = 160;
/** Strings of etc_/baseStringBag.xml the window names (cn). */
const BASE_STRINGS: Record<string, string> = {
  itemDictionary: "道具图鉴", itemDictionaryVisit: "浏览图鉴", koin: "K币",
  dictionaryRewardDlgTitle: "图鉴收藏奖励",
  dictionaryRewardDlgDesc: "图鉴中新添道具数量为 %d个，|可领取[%s] %d个奖励。|确认要领取奖励吗？",
  cancel: "取消", close: "关闭",
};
/** gui_/monocoque frame.bml DefaultFocusedButton: Normal, MouseOn, Clicked, Disabled columns. */
const FOCUSED_FRAME_X = [164, 188, 212, 236];

export interface DictionarySub {
  category: number;
  /** Karts only: 2 speed, 1 item. */
  kartType?: number;
  /** The main page's Graduation name prefix. */
  gauge: string;
  /** Infix of the CharPanel / count labels (total<label>Per, registed<label>Count). */
  label: string;
  /** The representative item's container. */
  rep: string;
  /** The sub tab's title (drawn on its collect_btn_2depthMenu art). */
  title: string;
}

/** The groups in card / tab order, with their sub tabs (collect_btn_2depthMenu<group><sub>). */
export const DICTIONARY_GROUPS: ReadonlyArray<{ tab: string; card: string; subs: readonly DictionarySub[] }> = [
  { tab: "kartTabBtn", card: "kartGroupBtn", subs: [
    { category: 3, gauge: "totalKart", title: "全部车辆", label: "Kart", rep: "repItem3_0" },
    { category: 3, kartType: 2, gauge: "speedKart", title: "竞速车辆", label: "SpeedKart", rep: "repItem3_2" },
    { category: 3, kartType: 1, gauge: "itemKart", title: "道具车辆", label: "ItemKart", rep: "repItem3_1" }] },
  { tab: "characterTabBtn", card: "characterGroupBtn", subs: [
    { category: 1, gauge: "character", title: "角色", label: "Character", rep: "repItem1" },
    { category: 21, gauge: "pet", title: "宠物", label: "Pet", rep: "repItem21" },
    { category: 52, gauge: "flyingPet", title: "飞行宠物", label: "FlyingPet", rep: "repItem52" }] },
  { tab: "equipTabBtn", card: "equipGroupBtn", subs: [
    { category: 9, gauge: "balloon", title: "气球", label: "Balloon", rep: "repItem9" },
    { category: 11, gauge: "headBand", title: "头饰", label: "HeadBand", rep: "repItem11" },
    { category: 8, gauge: "goggle", title: "护目镜", label: "Goggle", rep: "repItem8" }] },
  { tab: "decoTabBtn", card: "decoGroupBtn", subs: [
    { category: 26, gauge: "aura", title: "炫光", label: "Aura", rep: "repItem26" },
    { category: 2, gauge: "paint", title: "喷漆", label: "Paint", rep: "repItem2" },
    { category: 27, gauge: "skidMark", title: "印迹", label: "SkidMark", rep: "repItem27" }] },
];

const SUBS = DICTIONARY_GROUPS.flatMap(group => group.subs);

export const itemKey = (category: number, itemId: number): string => `${category}:${itemId}`;

export interface DictionaryEntry {
  category: number;
  itemId: number;
  collected: boolean;
  name: string;
  internalId: string;
}

/**
 * A sub tab's items in the release order; grade (1-13) keeps karts of that
 * engine grade, search keeps names containing it.
 */
export function dictionaryEntries(summary: DictionarySummary, sub: DictionarySub,
  items: ReadonlyMap<string, DictionaryItemInfo>,
  filter: { grade?: number; search?: string } = {}): DictionaryEntry[] {
  const row = summary.categories.find(category => category.category === sub.category);
  if (!row) return [];
  const collected = new Set(row.collected);
  const search = filter.search?.trim().toLowerCase();
  return row.items.flatMap(itemId => {
    const info = items.get(itemKey(sub.category, itemId));
    if (sub.kartType !== undefined && info?.kartType !== sub.kartType) return [];
    if (filter.grade && summary.kartGrades.get(itemId) !== filter.grade) return [];
    const name = info?.name || String(itemId);
    if (search && !name.toLowerCase().includes(search)) return [];
    return [{ category: sub.category, itemId, collected: collected.has(itemId), name,
      internalId: info?.internalId ?? "" }];
  });
}

/** collected / total of entries and the whole percent the gauges show. */
export function dictionaryProgress(entries: readonly DictionaryEntry[]):
  { collected: number; total: number; percent: number } {
  const collected = entries.filter(entry => entry.collected).length;
  const total = entries.length;
  return { collected, total, percent: total ? Math.floor(collected * 100 / total) : 0 };
}

/** dictionaryRewardDlgDesc lines: "%d" new items, "[%s]" the reward, "%d" its count. */
export function dictionaryRewardLines(template: string, items: number, reward: string, count: number): string[] {
  return template.replace("%d", String(items)).replace("%s", reward).replace("%d", String(count)).split("|");
}

const attribute = (node: MyRoomHudNode, name: string): string | undefined =>
  T(node, name) as string | undefined;

export async function openMyRoomDictionary(options: MyRoomDictionaryOptions): Promise<MyRoomDictionaryWindow> {
  const library = options.library;
  const find = (name: string, extension: string) => U1(library, [FOLDER], name, extension) as ResourceFile;
  const [windowBytes, cardBytes, bagBytes, fontBytes] = await Promise.all([
    find("itemDictionary@zz", ".bml").bytes(), find("itemDictionaryCard", ".bml").bytes(),
    find("itemDictionary_stringBag", ".bml").bytes(),
    (U1(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf") as ResourceFile).bytes(),
  ]);
  const font = await f5(FONT_FAMILY, fontBytes);
  const strings = new Map<string, string>(Object.entries(BASE_STRINGS));
  for (const [key, value] of readMyRoomStringBag(s2(bagBytes) as MyRoomHudNode)) strings.set(key, value);
  return new DictionaryWindow(options, s2(windowBytes) as MyRoomHudNode, s2(cardBytes) as MyRoomHudNode,
    strings, font);
}

class DictionaryWindow implements MyRoomDictionaryWindow {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  readonly search = document.createElement("input");
  private readonly context: CanvasRenderingContext2D;
  private readonly buttons: CanvasHitController<string>;
  private readonly observer?: ResizeObserver;
  private readonly images: ImageCache;
  private readonly textures = new Map<string, string | null>();
  private regions: Array<CanvasHitRegion<string>> = [];
  private hovered?: string;
  private pressed?: string;
  private summary: DictionarySummary;
  private page: "main" | "list" = "main";
  private group = 0;
  private sub = 0;
  private grade = 0;
  private query = "";
  private scroll = 0;
  private gridRect?: Rect;
  private gridHeight = 0;
  private comboOpen = false;
  private comboRect?: Rect;
  private busy = false;
  private disposed = false;
  private warned = false;
  private lastPointerY?: number;
  /** The card being drawn (itemDictionaryCard). */
  private entry?: DictionaryEntry;
  private readonly entryCache = new Map<string, DictionaryEntry[]>();
  /** Item pictures by itemKey, most recently used last; null: none. */
  private readonly pictures = new Map<string, HTMLCanvasElement | null>();
  private readonly picturePending = new Map<string, AbortController>();
  private wantedPictures = new Set<string>();
  private readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;

  constructor(readonly options: MyRoomDictionaryOptions, readonly definition: MyRoomHudNode,
    readonly card: MyRoomHudNode, readonly strings: Map<string, string>, readonly font: FontFace) {
    this.summary = options.summary;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建道具图鉴窗口");
    this.context = context;
    this.images = new ImageCache(options.library, () => this.render());
    this.element.dataset.uiLayer = "dialog";
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", options.editable ? this.text("itemDictionary") ?? "道具图鉴"
      : `${this.summary.nickname} 的道具图鉴`);
    this.element.tabIndex = -1;
    Object.assign(this.element.style, { position: "absolute", inset: "0", zIndex: "3" });
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    this.search.type = "search";
    this.search.maxLength = 10;
    this.search.autocomplete = "off";
    this.search.placeholder = this.text("giveItemName") ?? "请输入道具名称";
    this.search.setAttribute("aria-label", this.search.placeholder);
    Object.assign(this.search.style, { position: "absolute", margin: "0", padding: "0 4px",
      boxSizing: "border-box", border: "none", outline: "none", background: "transparent", color: "white",
      fontFamily: `'${FONT_FAMILY}', sans-serif`, fontWeight: "bold" });
    this.search.hidden = true;
    this.search.addEventListener("input", this.onSearch);
    this.element.append(this.canvas, this.search);
    options.root.append(this.element);
    this.buttons = new CanvasHitController(this.canvas, this.element, () => STAGE, (hovered, pressed) => {
      this.hovered = hovered;
      this.pressed = pressed;
      this.render();
    });
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerdown", this.onPointerMove);
    this.element.addEventListener("keydown", this.onKeyDown);
    if (typeof ResizeObserver !== "undefined") {
      this.observer = new ResizeObserver(() => this.render());
      this.observer.observe(options.root);
    }
    this.render();
    this.element.focus();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.observer?.disconnect();
    this.buttons.dispose();
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerdown", this.onPointerMove);
    this.element.removeEventListener("keydown", this.onKeyDown);
    this.search.removeEventListener("input", this.onSearch);
    for (const abort of this.picturePending.values()) abort.abort();
    this.picturePending.clear();
    for (const picture of this.pictures.values()) if (picture) picture.width = picture.height = 0;
    this.pictures.clear();
    try { this.options.pictures?.dispose(); } catch { /* Best effort. */ }
    this.element.remove();
    G1(this.font);
    this.previousFocus?.isConnected && this.previousFocus.focus();
  }

  private close(): void {
    if (this.busy) return;
    this.dispose();
    this.options.onClose();
  }

  private text(key: string): string | undefined { return this.strings.get(key); }

  /** A release texture: the cn variant of an @zz name first, then the name, then without the suffix. */
  private texture(name: string | undefined): HTMLCanvasElement | undefined {
    if (!name) return undefined;
    let path = this.textures.get(name);
    if (path === undefined) {
      const names = name.includes("@zz")
        ? [name.replace("@zz", "@cn"), name, name.replace("@zz", "")] : [name];
      path = names.map(candidate => `${FOLDER}/${candidate}.png`)
        .find(candidate => this.options.library.canonicalCandidates(candidate).length > 0) ?? null;
      this.textures.set(name, path);
    }
    return path ? this.images.get(path) : undefined;
  }

  /** The sprite of an autoLoadImage series ("…_@zz" or "…_") for state 0-3. */
  private seriesSprite(series: string, state: number): HTMLCanvasElement | undefined {
    return this.texture(series.replace(/(@zz)?$/, `${state + 1}$1`));
  }

  private currentSub(): DictionarySub { return DICTIONARY_GROUPS[this.group]!.subs[this.sub]!; }

  /** A sub tab's entries, filtered on the list page (memoized per summary). */
  private entries(sub: DictionarySub, filtered = false): DictionaryEntry[] {
    const grade = filtered && sub.category === 3 ? this.grade : 0;
    const search = filtered ? this.query.trim() : "";
    const key = `${sub.gauge}|${grade}|${search}`;
    let entries = this.entryCache.get(key);
    if (!entries) {
      entries = dictionaryEntries(this.summary, sub, this.options.items, { grade, search });
      this.entryCache.set(key, entries);
    }
    return entries;
  }

  render(): void {
    if (this.disposed) return;
    const width = this.options.root.clientWidth;
    const height = this.options.root.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (this.canvas.width !== pixelWidth) this.canvas.width = pixelWidth;
    if (this.canvas.height !== pixelHeight) this.canvas.height = pixelHeight;
    const context = this.context;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, pixelWidth, pixelHeight);
    context.setTransform(width / STAGE.width * ratio, 0, 0, height / STAGE.height * ratio, 0, 0);
    this.regions = [];
    this.gridRect = undefined;
    this.wantedPictures = new Set();
    this.search.hidden = this.page !== "list";
    this.draw(this.definition, STAGE);
    if (this.comboOpen && this.page === "list") this.drawGradeList();
    this.buttons.update(this.regions);
    // Pictures of cards no longer shown are not drawn any more.
    for (const [key, abort] of this.picturePending) {
      if (this.wantedPictures.has(key)) continue;
      abort.abort();
      this.picturePending.delete(key);
    }
  }

  private visible(node: MyRoomHudNode, name: string): boolean {
    switch (name) {
      case "mainPage": return this.page === "main";
      case "itemTabGroup": return this.page === "list";
      case "rewardBtn": return this.options.editable;
      case "kartEngineGradeBar": return this.group === 0;
      case "homBtn": return false;
    }
    if (/^repItem/.test(name)) return this.page === "main";
    if (/Mask\d$/.test(name)) return false; // the gauge is drawn whole by its Graduation
    const over = /^(\w+)MaskOver$/.exec(name);
    if (over) {
      const sub = SUBS.find(item => item.gauge === over[1]);
      return !!sub && dictionaryProgress(this.entries(sub)).percent >= 100;
    }
    const entry = this.entry;
    if (entry) {
      if (name === "mouseOver") return this.hovered === this.cardKey(entry);
      if (name === "registedStat") return !entry.collected;
      if (name === "itemName") return this.hovered === this.cardKey(entry);
      if (name === "itemNameContainer" || name === "kartLevel" || name === "selected" || name === "selected2")
        return false;
    }
    return attribute(node, "visible") !== "false";
  }

  private draw(node: MyRoomHudNode, parent: Rect): void {
    try {
      this.drawNode(node, parent);
    } catch (error) {
      // One node that cannot be laid out (a texture still loading) must not stop the rest.
      if (!this.warned) console.warn("道具图鉴控件绘制失败", attribute(node, "name") ?? node.name, error);
      this.warned = true;
    }
  }

  private drawNode(node: MyRoomHudNode, parent: Rect): void {
    const name = attribute(node, "name") ?? "";
    if (node.name === "Skip" || node.name === "StringBag") return;
    if (!this.visible(node, name)) return;
    const series = attribute(node, "autoLoadImage") ?? attribute(node, "autoLoadImageBoard") ??
      this.subTabSeries(name);
    const image = this.texture(attribute(node, "image") ?? attribute(node, "texture")) ??
      (series ? this.seriesSprite(series, 0) : undefined);
    // Frames belong to the shared window skins this window draws itself; the layout needs only the box.
    // tabBtnGroup's leftTopWH="0 0" (no size) spans its parent.
    const position = attribute(node, "leftTopWH")?.trim().split(/\s+/);
    const layout = attribute(node, "frame") || attribute(node, "listFrame") || position?.length === 2
      ? { ...node, attributes: node.attributes.filter(item => item.name !== "frame" && item.name !== "listFrame")
        .map(item => item.name === "leftTopWH" && position?.length === 2
          ? { ...item, value: `${position.join(" ")} ${parent.width} ${parent.height}` } : item) }
      : node;
    const rect = V0(layout, parent, undefined, image ? { image, width: image.width, height: image.height } : undefined) as Rect;
    const color = attribute(node, "color");
    if (color && node.name === "Panel" && !attribute(node, "texture")) {
      this.context.fillStyle = myRoomHudColor(color);
      this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    switch (name) {
      case "itemSelector": this.drawGrid(rect); return;
      case "itemListBar": this.drawScrollBar(rect); return;
      case "gradeListBox": this.drawGradeCombo(rect); return;
      case "searchEdit": this.placeSearch(rect); return;
      case "rewardBtn": this.drawRewardButton(rect); return;
      case "shopItemContainer": if (this.entry) this.drawPicture(this.entry, rect, true); return;
      case "totalCollectPercent": this.drawTotalBar(image, rect); return;
      case "curCollectPercent": this.drawSubBar(image, rect); return;
    }
    if (/^repItem/.test(name)) {
      this.drawRepresentative(name, rect);
      return;
    }

    if ((node.name === "ImageButton" || node.name === "ImageBoardButton") && series) {
      this.drawButton(name, series, rect);
    } else if (node.name === "Graduation") {
      if (image) this.drawGauge(node, name, image, rect);
    } else if (node.name === "CharPanel") {
      if (image) this.drawPercent(name, image, rect);
    } else if (image) {
      const uv = attribute(node, "uvRect")?.split(/\s+/).map(Number);
      if (uv?.length === 4)
        this.context.drawImage(image, uv[0]!, uv[1]!, uv[2]! - uv[0]!, uv[3]! - uv[1]!,
          rect.x, rect.y, rect.width, rect.height);
      else this.context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }
    const label = this.label(node, name);
    if (label) this.drawLabel(node, label, this.labelRect(node, rect));
    for (const child of node.children) this.draw(child, rect);
  }

  private drawButton(name: string, series: string, rect: Rect): void {
    const key = name;
    const tab = DICTIONARY_GROUPS.findIndex(group => group.tab === name);
    const sub = /^subTab_(\d)$/.exec(name);
    const selected = this.page === "list" && (tab >= 0 ? tab === this.group : sub ? Number(sub[1]) === this.sub : false);
    const state = selected ? 2 : st(key, this.hovered, this.pressed);
    const sprite = this.seriesSprite(series, state);
    if (sprite) this.context.drawImage(sprite, rect.x, rect.y, rect.width, rect.height);
    this.regions.push({ key, rect, label: this.buttonLabel(name), activate: () => this.activate(name) });
  }

  /** subTab_N have no series in the BML: collect_btn_2depthMenu<group><sub>_<state>@zz. */
  private subTabSeries(name: string): string | undefined {
    const sub = /^subTab_(\d)$/.exec(name);
    return sub ? `collect_btn_2depthMenu${this.group + 1}${Number(sub[1]) + 1}_@zz` : undefined;
  }

  private buttonLabel(name: string): string {
    if (name === "close") return this.text("close") ?? "关闭";
    if (name === "backBtn") return "返回";
    if (name === "leftGrade") return this.gradeName((this.grade + GRADES - 1) % GRADES);
    if (name === "rightGrade") return this.gradeName((this.grade + 1) % GRADES);
    const sub = /^subTab_(\d)$/.exec(name);
    if (sub) return DICTIONARY_GROUPS[this.group]!.subs[Number(sub[1])]?.title ?? name;
    const group = DICTIONARY_GROUPS.findIndex(item => item.tab === name || item.card === name);
    if (group >= 0) return ["车辆", "角色", "装备", "装饰"][group]!;
    return name;
  }

  private gradeName(grade: number): string { return this.text(`engineGrade${grade}`) ?? String(grade); }

  private label(node: MyRoomHudNode, name: string): string | undefined {
    const summary = this.summary;
    switch (name) {
      case "registedItemCount": return String(summary.collected);
      case "totalItemCount": return ` / ${summary.total}`;
      case "itemName": return this.entry?.name;
    }
    if (this.page === "list" && (name === "curCnt" || name === "totalCnt")) {
      const progress = dictionaryProgress(this.entries(this.currentSub()));
      return name === "curCnt" ? String(progress.collected) : String(progress.total);
    }
    const count = /^(registed|total)(\w+)Count$/.exec(name);
    if (count) {
      const sub = SUBS.find(item => item.label === count[2]);
      if (sub) {
        const progress = dictionaryProgress(this.entries(sub));
        return count[1] === "registed" ? String(progress.collected) : ` / ${progress.total}`;
      }
    }
    if (node.name === "ImageButton" && (name === "leftGrade" || name === "rightGrade"))
      return this.buttonLabel(name);
    const raw = attribute(node, "text");
    if (!raw || node.name === "ImageButton" || node.name === "CharPanel") return undefined;
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    if (key) return this.text(key);
    // Template placeholders ("-", " / -", Korean samples) are not shown.
    return /[가-힣]|^-?\s*$|^ \/ -$/.test(raw) ? undefined : raw;
  }

  /** The bottom notices are wider than their 100px boxes. */
  private labelRect(node: MyRoomHudNode, rect: Rect): Rect {
    return /^#sb\(dictionaryNotice/.test(attribute(node, "text") ?? "") ? { ...rect, width: 380 } : rect;
  }

  private drawLabel(node: MyRoomHudNode, text: string, rect: Rect): void {
    const alignment = attribute(node, "textAlign") ?? "";
    const render = myRoomHudTextRender(attribute(node, "textRender"));
    const button = node.name === "ImageButton";
    m9(this.context, text, rect, {
      family: FONT_FAMILY, size: render.size, kind: "label",
      color: myRoomHudColor(attribute(node, "textColor")),
      align: button || alignment.includes("center") ? "center" : alignment.includes("right") ? "right" : "left",
      verticalAlign: button || alignment.includes("vcenter") || alignment === "center" ? "center" : "top",
      stroke: render.stroke,
      strokeColor: myRoomHudColor(attribute(node, "textColor2"), "black"),
    });
  }

  /** The ring fills clockwise from the top by the collected share. */
  private drawGauge(node: MyRoomHudNode, name: string, sprite: HTMLCanvasElement, rect: Rect): void {
    const prefix = /^(\w+)Gauge$/.exec(name)?.[1];
    if (prefix) {
      const sub = SUBS.find(item => item.gauge === prefix);
      const { collected, total } = sub ? dictionaryProgress(this.entries(sub)) : { collected: 0, total: 0 };
      const fraction = total ? collected / total : 0;
      if (fraction <= 0) return;
      const context = this.context;
      context.save();
      context.beginPath();
      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      context.moveTo(centerX, centerY);
      context.arc(centerX, centerY, Math.max(rect.width, rect.height), -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, fraction));
      context.closePath();
      context.clip();
      this.drawUv(node, sprite, rect);
      context.restore();
      return;
    }
    this.drawUv(node, sprite, rect); // MaskOver at 100%
  }

  private drawUv(node: MyRoomHudNode, sprite: HTMLCanvasElement, rect: Rect): void {
    const uv = attribute(node, "uvRect")?.split(/\s+/).map(Number);
    if (uv?.length === 4)
      this.context.drawImage(sprite, uv[0]!, uv[1]!, uv[2]! - uv[0]!, uv[3]! - uv[1]!,
        rect.x, rect.y, rect.width, rect.height);
    else this.context.drawImage(sprite, rect.x, rect.y, rect.width, rect.height);
  }

  /** CharPanel digits (fontStr "1234567890", 14x19 each, spaceOffset -1), right aligned. */
  private drawPercent(name: string, sprite: HTMLCanvasElement, rect: Rect): void {
    const label = /^total(\w+)Per$/.exec(name)?.[1];
    const sub = SUBS.find(item => item.label === label);
    if (!sub) return;
    const digits = String(dictionaryProgress(this.entries(sub)).percent);
    const glyph = { width: 14, height: 19 };
    const advance = glyph.width - 1;
    let x = rect.x + rect.width - glyph.width;
    for (const digit of [...digits].reverse()) {
      const index = "1234567890".indexOf(digit);
      if (index >= 0)
        this.context.drawImage(sprite, index * glyph.width, 0, glyph.width, glyph.height,
          x, rect.y, glyph.width, glyph.height);
      x -= advance;
    }
  }

  private drawTotalBar(piece: HTMLCanvasElement | undefined, rect: Rect): void {
    const fraction = this.summary.total ? this.summary.collected / this.summary.total : 0;
    if (piece && fraction > 0)
      this.context.drawImage(piece, rect.x, rect.y, 1144 * Math.min(1, fraction), piece.height);
  }

  private drawSubBar(piece: HTMLCanvasElement | undefined, rect: Rect): void {
    const progress = dictionaryProgress(this.entries(this.currentSub()));
    const fraction = progress.total ? progress.collected / progress.total : 0;
    if (piece && fraction > 0)
      this.context.drawImage(piece, rect.x, rect.y, rect.width * Math.min(1, fraction), rect.height);
  }

  /** 领取奖励: the DefaultFocusedButton skin (gui_/monocoque/frame_new01). */
  private drawRewardButton(rect: Rect): void {
    const state = this.busy ? 3 : st("rewardBtn", this.hovered, this.pressed);
    const sprite = this.images.get("gui_/monocoque/frame_new01.png");
    const context = this.context;
    if (sprite) {
      const x0 = FOCUSED_FRAME_X[state]!;
      const columns: Array<[number, number, number, number]> = [
        [x0, 4, rect.x, 4], [x0 + 4, 16, rect.x + 4, rect.width - 8], [x0 + 20, 4, rect.x + rect.width - 4, 4]];
      const rows: Array<[number, number, number, number]> = [
        [62, 6, rect.y, 6], [68, 36, rect.y + 6, rect.height - 12], [104, 6, rect.y + rect.height - 6, 6]];
      for (const [sx, sw, dx, dw] of columns)
        for (const [sy, sh, dy, dh] of rows) context.drawImage(sprite, sx, sy, sw, sh, dx, dy, dw, dh);
    } else {
      context.fillStyle = "rgb(0, 119, 255)";
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
    m9(context, this.text("getReward") ?? "领取奖励", rect, {
      family: FONT_FAMILY, size: 16, kind: "label",
      color: state === 2 ? "rgb(24, 55, 104)" : state === 3 ? "rgb(220, 220, 220)" : "white",
      align: "center", verticalAlign: "center", stroke: 0, strokeColor: "black" });
    this.regions.push({ key: "rewardBtn", rect, label: this.text("getReward") ?? "领取奖励",
      disabled: this.busy, activate: () => this.activate("rewardBtn") });
  }

  private cardKey(entry: DictionaryEntry): string { return `item:${itemKey(entry.category, entry.itemId)}`; }

  /** The item's picture fitted into rect, else its name. */
  private drawPicture(entry: DictionaryEntry, rect: Rect, nameWithout: boolean): void {
    const picture = this.picture(entry);
    const context = this.context;
    if (picture && picture.width && picture.height) {
      const scale = Math.min(rect.width / picture.width, rect.height / picture.height);
      const width = picture.width * scale;
      const height = picture.height * scale;
      context.drawImage(picture, rect.x + (rect.width - width) / 2, rect.y + (rect.height - height) / 2, width, height);
    } else if (nameWithout) {
      m9(context, entry.name, { x: rect.x + 8, y: rect.y + 8, width: rect.width - 16, height: rect.height - 16 }, {
        family: FONT_FAMILY, size: 14, kind: "label", color: "rgb(84, 100, 129)", align: "center",
        verticalAlign: "center", stroke: 0, strokeColor: "black" });
    }
  }

  private picture(entry: DictionaryEntry): HTMLCanvasElement | undefined {
    const key = itemKey(entry.category, entry.itemId);
    this.wantedPictures.add(key);
    if (this.pictures.has(key)) {
      const picture = this.pictures.get(key)!;
      this.pictures.delete(key);
      this.pictures.set(key, picture);
      return picture ?? undefined;
    }
    const source = this.options.pictures;
    if (source && !this.picturePending.has(key)) {
      const abort = new AbortController();
      this.picturePending.set(key, abort);
      const settle = (picture: HTMLCanvasElement | null) => {
        if (this.picturePending.get(key) !== abort) {
          if (picture) picture.width = picture.height = 0;
          return;
        }
        this.picturePending.delete(key);
        this.storePicture(key, picture);
        this.render();
      };
      source.picture(entry.category, entry.itemId, entry.internalId, abort.signal)
        .then(picture => settle(picture ?? null), () => settle(null));
    }
    return undefined;
  }

  private storePicture(key: string, picture: HTMLCanvasElement | null): void {
    this.pictures.set(key, picture);
    while (this.pictures.size > PICTURES_KEPT) {
      const [oldest, value] = this.pictures.entries().next().value as [string, HTMLCanvasElement | null];
      this.pictures.delete(oldest);
      if (value) value.width = value.height = 0;
    }
  }

  /** The first collected item of a sub tab, inside its gauge ring. */
  private drawRepresentative(name: string, rect: Rect): void {
    const sub = SUBS.find(item => item.rep === name);
    const entry = sub && this.entries(sub).find(item => item.collected);
    if (entry) this.drawPicture(entry, rect, false);
  }

  private drawGrid(area: Rect): void {
    // GridSelectorDivLoad maxLine="4": four rows show; the rest scroll.
    const rect = { ...area, height: Math.min(area.height, 4 * ROW_HEIGHT + MARGIN) };
    this.gridRect = rect;
    const entries = this.entries(this.currentSub(), true);
    const rows = Math.ceil(entries.length / COLUMNS);
    this.gridHeight = rows * ROW_HEIGHT + MARGIN;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.gridHeight - rect.height)));
    const context = this.context;
    context.save();
    context.beginPath();
    context.rect(rect.x, rect.y, rect.width, rect.height);
    context.clip();
    const first = Math.floor(this.scroll / ROW_HEIGHT);
    for (let row = first; row < rows; row++) {
      const y = rect.y + MARGIN + row * ROW_HEIGHT - this.scroll;
      if (y > rect.y + rect.height) break;
      for (let column = 0; column < COLUMNS; column++) {
        const entry = entries[row * COLUMNS + column];
        if (!entry) break;
        const cell = { x: rect.x + MARGIN + column * (CARD.width + MARGIN), y, ...CARD };
        this.entry = entry;
        try {
          this.draw(this.card, cell);
        } finally {
          this.entry = undefined;
        }
        const visible = { ...cell, y: Math.max(cell.y, rect.y),
          height: Math.min(cell.y + cell.height, rect.y + rect.height) - Math.max(cell.y, rect.y) };
        if (visible.height > 20)
          this.regions.push({ key: this.cardKey(entry), rect: visible,
            label: `${entry.name}${entry.collected ? "（已收藏）" : "（未收藏）"}`, activate: () => undefined });
      }
    }
    context.restore();
  }

  private drawScrollBar(rect: Rect): void {
    const grid = this.gridRect;
    if (!grid || this.gridHeight <= grid.height) return;
    const context = this.context;
    context.fillStyle = "rgba(42, 55, 80, 0.18)";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    const thumbHeight = Math.max(50, rect.height * grid.height / this.gridHeight);
    const range = this.gridHeight - grid.height;
    const thumbY = rect.y + (rect.height - thumbHeight) * (this.scroll / range);
    context.fillStyle = "rgba(84, 100, 129, 0.75)";
    context.fillRect(rect.x + 2, thumbY, rect.width - 4, thumbHeight);
    this.regions.push({ key: "scrollTrack", rect, label: "滚动道具列表",
      activate: () => {
        const middle = thumbY + thumbHeight / 2;
        const pointerY = this.lastPointerY ?? middle;
        this.scrollBy((pointerY < middle ? -1 : 1) * grid.height * 0.9);
      } });
  }

  private drawGradeCombo(rect: Rect): void {
    this.comboRect = rect;
    const context = this.context;
    const hovered = this.hovered === "gradeCombo";
    context.fillStyle = hovered ? "rgba(0, 119, 255, 0.08)" : "rgba(255, 255, 255, 0)";
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    m9(context, this.gradeName(this.grade), rect, {
      family: FONT_FAMILY, size: 14, kind: "label", color: "rgb(22, 152, 246)", align: "center",
      verticalAlign: "center", stroke: 0, strokeColor: "black" });
    this.regions.push({ key: "gradeCombo", rect, label: `引擎：${this.gradeName(this.grade)}`,
      activate: () => { this.comboOpen = !this.comboOpen; this.render(); } });
  }

  private drawGradeList(): void {
    const rect = this.comboRect;
    if (!rect) return;
    const context = this.context;
    for (let grade = 0; grade < GRADES; grade++) {
      const item = { x: rect.x, y: rect.y + rect.height + grade * 26, width: rect.width, height: 26 };
      const key = `grade:${grade}`;
      context.fillStyle = this.hovered === key ? "rgb(214, 228, 248)" : grade === this.grade
        ? "rgb(234, 242, 252)" : "rgb(250, 251, 253)";
      context.fillRect(item.x, item.y, item.width, item.height);
      context.strokeStyle = "rgb(150, 165, 190)";
      context.lineWidth = 1;
      context.strokeRect(item.x + 0.5, item.y + 0.5, item.width - 1, item.height - 1);
      m9(context, this.gradeName(grade), item, {
        family: FONT_FAMILY, size: 14, kind: "label", color: "rgb(22, 152, 246)", align: "center",
        verticalAlign: "center", stroke: 0, strokeColor: "black" });
      this.regions.push({ key, rect: item, label: this.gradeName(grade), activate: () => {
        this.comboOpen = false;
        this.setGrade(grade);
      } });
    }
  }

  /** The search box is a real input over the release Edit. */
  private placeSearch(rect: Rect): void {
    const scaleY = this.options.root.clientHeight / STAGE.height;
    Object.assign(this.search.style, {
      left: `${rect.x / STAGE.width * 100}%`, top: `${rect.y / STAGE.height * 100}%`,
      width: `${rect.width / STAGE.width * 100}%`, height: `${rect.height / STAGE.height * 100}%`,
      fontSize: `${Math.max(9, 14 * scaleY)}px`,
    });
  }

  private activate(name: string): void {
    if (this.busy) return;
    this.comboOpen = false;
    if (name === "close") {
      this.close();
      return;
    }
    if (name === "rewardBtn") {
      void this.reward();
      return;
    }
    const group = DICTIONARY_GROUPS.findIndex(item => item.tab === name || item.card === name);
    if (group >= 0) this.openList(group, 0);
    else if (name === "backBtn") {
      this.page = "main";
      this.search.blur();
    } else if (/^subTab_\d$/.test(name)) this.openList(this.group, Number(name.slice(-1)));
    else if (name === "leftGrade") this.setGrade((this.grade + GRADES - 1) % GRADES);
    else if (name === "rightGrade") this.setGrade((this.grade + 1) % GRADES);
    this.render();
  }

  private openList(group: number, sub: number): void {
    const changedGroup = group !== this.group || this.page !== "list";
    this.page = "list";
    this.group = group;
    this.sub = sub;
    this.scroll = 0;
    if (changedGroup) {
      this.grade = 0;
      this.query = "";
      this.search.value = "";
    }
  }

  private setGrade(grade: number): void {
    this.grade = grade;
    this.scroll = 0;
    this.render();
  }

  private scrollBy(delta: number): void {
    const grid = this.gridRect;
    if (!grid) return;
    this.scroll = Math.max(0, Math.min(this.scroll + delta, Math.max(0, this.gridHeight - grid.height)));
    this.render();
  }

  private async reward(): Promise<void> {
    if (!this.options.claim || this.busy) return;
    const title = this.text("itemDictionary") ?? "道具图鉴";
    const summary = this.summary;
    if (summary.claimable <= 0) {
      await this.options.notice(title, this.text("newDictionaryItemZero") ?? "暂无新收藏道具。");
      return;
    }
    const rewardName = this.text("koin") ?? "K币";
    this.busy = true;
    this.render();
    let confirmed = false;
    try {
      confirmed = await askDictionaryReward({
        library: this.options.library, root: this.options.root,
        title: this.text("dictionaryRewardDlgTitle") ?? "图鉴收藏奖励",
        lines: dictionaryRewardLines(this.text("dictionaryRewardDlgDesc") ?? "", summary.claimable, rewardName,
          summary.claimable * summary.reward.count),
        count: summary.claimable * summary.reward.count,
        fontFamily: FONT_FAMILY,
        ok: this.text("getReward") ?? "领取奖励", cancel: this.text("cancel") ?? "取消",
      });
    } catch {
      confirmed = false;
    }
    if (!confirmed || this.disposed) {
      this.busy = false;
      this.render();
      return;
    }
    let message: string;
    try {
      const claim = await this.options.claim();
      this.summary = claim.dictionary;
      this.entryCache.clear();
      message = (this.text("getRewardSuccess") ?? "发放图鉴奖励[%s] %d个。")
        .replace("%s", rewardName).replace("%d", String(claim.koin));
    } catch (error) {
      const code = (error as { code?: string }).code;
      message = code === "NOTHING_TO_CLAIM" ? this.text("noMoreGetRewardItem") ?? "无法领取更多奖励。"
        : this.text("addRewardError") ?? "奖励领取失败。";
    }
    this.busy = false;
    this.render();
    if (!this.disposed) await this.options.notice(title, message);
  }

  private readonly onSearch = (): void => {
    this.query = this.search.value;
    this.scroll = 0;
    this.render();
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.height) this.lastPointerY = (event.clientY - bounds.top) * STAGE.height / bounds.height;
    if (event.type === "pointerdown" && this.comboOpen && !this.hovered?.startsWith("grade")) {
      this.comboOpen = false;
      this.render();
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.page === "list" && !this.comboOpen) this.scrollBy(event.deltaY);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (this.comboOpen) {
      this.comboOpen = false;
      this.render();
    } else if (this.page === "list") {
      this.page = "main";
      this.render();
      this.element.focus();
    } else this.close();
  };
}
