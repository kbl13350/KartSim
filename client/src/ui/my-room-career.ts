import { CanvasHitController, type CanvasHitRegion } from "./canvas-hit-controller";
import { G1, T, V0, f5, m9, s2, st } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import type { CareerCompletion, CareerProgress, CareerSummary } from "../myroom/myroom-api";
import {
  ImageCache, emblemIconPath, gloveIconPath, loadCareerTable, loadEmblemTable,
  type CareerInfo, type MyRoomDataLibrary,
} from "../myroom/myroom-data";
import { myRoomHudColor, myRoomHudTextRender, readMyRoomStringBag, type MyRoomHudNode } from "./my-room-hud";

/**
 * The release career window 成就 (dialog2_newCareer newCareer@zz): the tab
 * column (成就概要, then 普通 / 多人游戏 / 单人游戏 / 车库 sub tabs), the summary
 * page with the four completion gauges and 近期获得成就, and a tab's career
 * list (careerTemplate rows) with the 全部/未完成/可完成/完成 filter. The owner
 * completes a reached career with 点击完成; a visitor only looks.
 */

interface ResourceFile { bytes(): Promise<Uint8Array> }

export interface MyRoomCareerLibrary extends MyRoomDataLibrary {
  canonicalCandidates(path: string): Array<ResourceFile & { text?(): Promise<string> }>;
}

export interface MyRoomCareerOptions {
  library: MyRoomCareerLibrary;
  root: HTMLElement;
  summary: CareerSummary;
  /** The owner's own window: 点击完成 is offered. */
  editable: boolean;
  complete?(careerId: number): Promise<CareerCompletion>;
  /** Re-reads the summary after a completion. */
  reload?(): Promise<CareerSummary>;
  /** A release notice (the completion popup, errors). */
  notice(title: string, message: string): Promise<unknown> | void;
  onClose(): void;
}

export interface MyRoomCareerWindow { dispose(): void }

type Rect = { x: number; y: number; width: number; height: number };

const FOLDER = "dialog2_/newCareer";
const FONT_FAMILY = "KartSim Career";
const STAGE = { x: 0, y: 0, width: 1600, height: 900 };
const ROW_HEIGHT = 138;
/** Strings of DataPack1 etc_/baseStringBag.xml the window names (cn). */
const BASE_STRINGS: Record<string, string> = {
  career: "成就", multiPlay: "多人游戏", singlePlay: "单人游戏", garage: "车库",
  timeAttack: "计时赛", license: "驾照考试", challenge: "挑战模式", scenario: "故事模式",
  trainingCenter: "车手学院", parts: "部件", exchangeSystem: "合成", kartune: "车辆升级",
  close: "关闭", ok: "确定", reward: "奖励",
};
const FILTERS = ["all", "playing", "complete", "rewarded"] as const;
type Filter = typeof FILTERS[number];
/** Sub tabs (subType) and the main type each belongs to. */
const TABS: Array<{ sub: number; main: number }> = [
  { sub: 1, main: 1 }, { sub: 2, main: 1 }, { sub: 3, main: 1 },
  { sub: 4, main: 2 }, { sub: 5, main: 2 }, { sub: 6, main: 2 }, { sub: 7, main: 2 },
  { sub: 8, main: 3 }, { sub: 9, main: 3 }, { sub: 10, main: 3 }, { sub: 11, main: 3 }, { sub: 16, main: 3 },
  { sub: 12, main: 4 }, { sub: 14, main: 4 }, { sub: 15, main: 4 },
];

const attribute = (node: MyRoomHudNode, name: string): string | undefined =>
  T(node, name) as string | undefined;

export interface CareerRow { info: CareerInfo; progress: CareerProgress }

/** The value a career needs: a multi career needs each of its careers. */
export function careerTarget(info: CareerInfo): number {
  return info.multiIds.length ? info.multiIds.length : info.clearValue;
}

/** Distance careers (46 by theme, 50 with a replay camera) count 0.1 km. */
const DISTANCE_CAREER_TYPES = new Set([46, 50]);

/**
 * The "(%d/%d)" condition after a career's description; distance careers
 * use careerInfoFormat_Distance "%s (%.1f/%.1f)" in km.
 */
export function careerCondition(info: CareerInfo, value: number,
                                format: { normal: string; distance: string }): string {
  if (!info.showCondition) return info.desc;
  const target = careerTarget(info);
  const shown = Math.min(value, target);
  if (DISTANCE_CAREER_TYPES.has(info.careerType)) {
    return format.distance.replace("%s", info.desc).replace("%.1f", (shown / 10).toFixed(1))
      .replace("%.1f", (target / 10).toFixed(1));
  }
  return format.normal.replace("%s", info.desc).replace("%d", String(shown)).replace("%d", String(target));
}

/**
 * The careers a tab lists: chained stages appear once the previous stage is
 * done, hidden careers once reached; then the filter.
 */
export function careerRows(table: ReadonlyMap<number, CareerInfo>,
  progress: readonly CareerProgress[], sub: number, filter: Filter): CareerRow[] {
  const rows: CareerRow[] = [];
  for (const item of progress) {
    const info = table.get(item.id);
    if (!info || info.subType !== sub || item.locked) continue;
    if (info.hidden && item.state === "playing") continue;
    if (filter !== "all" && item.state !== filter) continue;
    rows.push({ info, progress: item });
  }
  return rows;
}

/** 成就概要 gauges: rewarded / all careers of each main type. */
export function careerTotals(table: ReadonlyMap<number, CareerInfo>,
  progress: readonly CareerProgress[]): Array<{ done: number; total: number }> {
  const totals = [1, 2, 3, 4].map(() => ({ done: 0, total: 0 }));
  for (const item of progress) {
    const info = table.get(item.id);
    const bucket = info && totals[info.mainType - 1];
    if (!bucket) continue;
    bucket.total++;
    if (item.state === "rewarded") bucket.done++;
  }
  return totals;
}

export function careerDate(ms: number | undefined): string {
  if (!ms) return "";
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}`;
}

export async function openMyRoomCareer(options: MyRoomCareerOptions): Promise<MyRoomCareerWindow> {
  const library = options.library;
  const find = (name: string, extension: string) =>
    U1(library, [FOLDER], name, extension) as ResourceFile;
  const [windowBytes, templateBytes, recentBytes, bagBytes, careers, emblems, fontBytes] = await Promise.all([
    find("newCareer@zz", ".bml").bytes(), find("careerTemplate", ".bml").bytes(),
    find("completeCareerTemplate", ".bml").bytes(), find("newCareer_stringBag", ".bml").bytes(),
    loadCareerTable(library), loadEmblemTable(library),
    (U1(library, ["gui_/font"], "SourceHanSansCN-Bold", ".otf") as ResourceFile).bytes(),
  ]);
  const font = await f5(FONT_FAMILY, fontBytes);
  const strings = new Map<string, string>(Object.entries(BASE_STRINGS));
  for (const [key, value] of readMyRoomStringBag(s2(bagBytes) as MyRoomHudNode)) strings.set(key, value);
  const view = new CareerWindow(options, s2(windowBytes) as MyRoomHudNode, s2(templateBytes) as MyRoomHudNode,
    s2(recentBytes) as MyRoomHudNode, strings, careers, emblems, font);
  return view;
}

class CareerWindow implements MyRoomCareerWindow {
  readonly element = document.createElement("div");
  readonly canvas = document.createElement("canvas");
  private readonly context: CanvasRenderingContext2D;
  private readonly buttons: CanvasHitController<string>;
  private readonly observer?: ResizeObserver;
  private readonly images: ImageCache;
  private regions: Array<CanvasHitRegion<string>> = [];
  private hovered?: string;
  private pressed?: string;
  private summary: CareerSummary;
  private tab = 0; // 0 成就概要, else a subType
  private filter: Filter = "all";
  private comboOpen = false;
  private scroll = 0;
  private listRect?: Rect;
  private listHeight = 0;
  private busy = false;
  private disposed = false;
  /** The row being drawn (careerTemplate) or the recent completion. */
  private row?: CareerRow;
  private recent?: { info: CareerInfo; at: number };
  private readonly previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement : undefined;

  constructor(readonly options: MyRoomCareerOptions, readonly definition: MyRoomHudNode,
    readonly template: MyRoomHudNode, readonly recentTemplate: MyRoomHudNode,
    readonly strings: Map<string, string>, readonly careers: Map<number, CareerInfo>,
    readonly emblems: Map<number, { name: string }>, readonly font: FontFace) {
    this.summary = options.summary;
    const context = this.canvas.getContext("2d");
    if (!context) throw new Error("无法创建成就窗口");
    this.context = context;
    this.images = new ImageCache(options.library, () => this.render());
    this.element.dataset.uiLayer = "dialog";
    this.element.setAttribute("role", "dialog");
    this.element.setAttribute("aria-modal", "true");
    this.element.setAttribute("aria-label", options.editable ? "成就" : `${this.summary.nickname} 的成就`);
    this.element.tabIndex = -1;
    Object.assign(this.element.style, { position: "absolute", inset: "0", zIndex: "3" });
    Object.assign(this.canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
    this.element.append(this.canvas);
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

  private texture(name: string | undefined): HTMLCanvasElement | undefined {
    return name ? this.images.get(`${FOLDER}/${name}.png`) : undefined;
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
    this.listRect = undefined;
    this.draw(this.definition, STAGE);
    if (this.comboOpen) this.drawComboList();
    this.buttons.update(this.regions);
  }

  private visible(node: MyRoomHudNode, name: string): boolean {
    if (name === "completePopupWnd" || name === "blinkLoadingWindow") return false;
    if (name === "careerSummaryBg") return this.tab === 0;
    if (name === "careerDetailWindow") return this.tab !== 0;
    if (name === "emptyTabBg") return this.tab !== 0 && this.rows().length === 0;
    if (name === "tabNew") return false; // drawn by the tab
    const row = this.row;
    if (row) {
      const lines = this.conditionLines(row);
      if (name === "completeCareerBg") return row.progress.state === "rewarded";
      if (name === "career_size1") return lines.length <= 1;
      if (name === "career_size2") return lines.length === 2;
      if (name === "career_size3") return lines.length >= 3;
      if (name === "rewardContainer") return row.info.rewardEmblemId > 0;
      if (name === "rewardStock") return false;
      if (name === "completeBtn") return this.options.editable && row.progress.state === "complete";
      if (name === "careerHelpIcon") return !!row.info.help;
    }
    return attribute(node, "visible") !== "false";
  }

  private draw(node: MyRoomHudNode, parent: Rect): void {
    try {
      this.drawNode(node, parent);
    } catch (error) {
      // One node that cannot be laid out must not stop the rest (or the hit regions).
      if (!this.warned) console.warn("成就窗口控件绘制失败", attribute(node, "name") ?? node.name, error);
      this.warned = true;
    }
  }

  private warned = false;

  private drawNode(node: MyRoomHudNode, parent: Rect): void {
    const name = attribute(node, "name") ?? "";
    if (node.name === "Skip" || node.name === "StringBag") return;
    if (!this.visible(node, name)) return;
    const image = this.texture(attribute(node, "image") ?? attribute(node, "texture"));
    // Frames (the combo's DefaultEdit) belong to the shared window templates,
    // which this window draws itself; the layout needs only the box.
    const layout = attribute(node, "frame") || attribute(node, "listFrame")
      ? { ...node, attributes: node.attributes.filter(item => item.name !== "frame" && item.name !== "listFrame") }
      : node;
    const rect = V0(layout, parent, undefined, image ? { image, width: image.width, height: image.height } : undefined) as Rect;
    const color = attribute(node, "color");
    if (color && node.name === "Panel" && !attribute(node, "texture")) {
      this.context.fillStyle = myRoomHudColor(color);
      this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    if (name === "careerList") {
      this.drawList(rect);
      return;
    }
    if (name === "careerScrollBar") {
      this.drawScrollBar(rect);
      return;
    }
    if (name === "tabDetailCombo") {
      this.drawCombo(rect);
      return;
    }
    if (name === "lastestSetCareerLabel") this.drawRecent(parent, rect);

    const tab = /^tab_(\d+|SummaryButton)$/.exec(name);
    const states = attribute(node, "autoLoadImage");
    if ((node.name === "ImageButton" || node.name === "NewCareerCompleteButton") && states) {
      const key = this.buttonKey(name);
      const selected = tab ? (tab[1] === "SummaryButton" ? 0 : Number(tab[1])) === this.tab : false;
      const stateIndex = this.busy && name === "completeBtn" ? 3
        : selected ? 2 : st(key, this.hovered, this.pressed);
      const sprite = this.texture(`${states}${stateIndex + 1}`);
      if (sprite) this.context.drawImage(sprite, rect.x, rect.y, rect.width, rect.height);
      const row = this.row;
      this.regions.push({ key, rect, label: this.buttonLabel(name),
        activate: () => this.activate(name, row) });
    } else {
      const sprite = this.paintedImage(name) ?? image;
      if (sprite) {
        const uv = attribute(node, "uvRect")?.split(/\s+/).map(Number);
        if (uv?.length === 4)
          this.context.drawImage(sprite, uv[0]!, uv[1]!, uv[2]! - uv[0]!, uv[3]! - uv[1]!,
            rect.x, rect.y, rect.width, rect.height);
        else if (/^SummaryGaugePanel_\d$/.test(name)) this.drawGauge(sprite, rect, name);
        else this.context.drawImage(sprite, rect.x, rect.y, rect.width, rect.height);
      }
    }
    if (tab && tab[1] !== "SummaryButton" && this.tabHasComplete(Number(tab[1]))) {
      const badge = this.texture("career_img_newICON");
      if (badge) this.context.drawImage(badge, rect.x - 14, rect.y + 6, 32, 18);
    }
    const label = this.label(node, name);
    if (label) this.drawLabel(node, label, rect);
    for (const child of node.children) this.draw(child, rect);
  }

  private buttonKey(name: string): string {
    return name === "completeBtn" && this.row ? `complete:${this.row.info.id}` : name;
  }

  private buttonLabel(name: string): string {
    if (name === "cancelButton") return this.text("close") ?? "关闭";
    if (name === "tab_SummaryButton") return this.text("careerSummary") ?? "成就概要";
    if (name === "completeBtn") return `${this.text("achievementCareer") ?? "点击完成"} ${this.row?.info.title ?? ""}`;
    const sub = Number(/^tab_(\d+)$/.exec(name)?.[1]);
    return this.tabTitle(sub) ?? name;
  }

  private tabTitle(sub: number): string | undefined {
    const node = this.findNode(this.definition, `tab_${sub}`);
    const label = node?.children.find(child => child.name === "Label");
    const key = /^#sb\(([^)]+)\)$/.exec(label ? attribute(label, "text") ?? "" : "")?.[1];
    return key ? this.text(key) : undefined;
  }

  private findNode(node: MyRoomHudNode, name: string): MyRoomHudNode | undefined {
    if (attribute(node, "name") === name) return node;
    for (const child of node.children) {
      const found = this.findNode(child, name);
      if (found) return found;
    }
    return undefined;
  }

  /** Images painted per row or for the header. */
  private paintedImage(name: string): HTMLCanvasElement | undefined {
    const row = this.row;
    if (row && name === "careerIcon") return this.icon(row.info.texture);
    if (row && name === "rewardEmblem") return this.images.get(emblemIconPath(row.info.rewardEmblemId));
    if (row && name === "careerPoint") return this.texture(this.pointTexture(row));
    if (row && /^careerInfoStar/.test(name)) {
      const done = this.starDone(row, name);
      return this.texture(done ? "career_img_star_1" : "career_img_star_0");
    }
    if (this.recent && name === "completeCareerIcon") return this.icon(`s_${this.recent.info.texture}`);
    if (name === "grove") {
      const path = gloveIconPath(this.summary.glove);
      return path ? this.images.get(path) : undefined;
    }
    return undefined;
  }

  private icon(texture: string): HTMLCanvasElement | undefined {
    return texture ? this.images.get(`${FOLDER}/icon/${texture}.png`) : undefined;
  }

  /** career_img_point<state>_<tier>: tier 1-10 is rewardPoint 5-50. */
  private pointTexture(row: CareerRow): string {
    const tier = Math.max(1, Math.min(10, Math.round(row.info.rewardPoint / 5)));
    const state = row.progress.state === "rewarded" ? 3 : row.progress.state === "complete" ? 2 : 1;
    return `career_img_point${state}_${tier}`;
  }

  private conditionLines(row: CareerRow): Array<{ text: string; done: boolean }> {
    if (row.info.multiIds.length) {
      return row.info.multiIds.slice(0, 3).map(id => {
        const part = this.careers.get(id);
        const state = this.summary.careers.find(item => item.id === id)?.state;
        return { text: part?.title ?? String(id), done: state === "rewarded" };
      });
    }
    const text = careerCondition(row.info, row.progress.value, {
      normal: this.text("careerInfoFormat_Default") ?? "%s (%d/%d)",
      distance: this.text("careerInfoFormat_Distance") ?? "%s (%.1f/%.1f)",
    });
    return [{ text, done: row.progress.state !== "playing" }];
  }

  private starDone(row: CareerRow, name: string): boolean {
    const lines = this.conditionLines(row);
    const index = name === "careerInfoStar" ? 0 : Number(/_(\d)$/.exec(name)?.[1] ?? 1) - 1;
    return lines[index]?.done ?? false;
  }

  private label(node: MyRoomHudNode, name: string): string | undefined {
    const summary = this.summary;
    const row = this.row;
    switch (name) {
      case "riderLvLabel": return `Lv.${summary.level}`;
      case "riderNameLabel": return summary.nickname;
      case "careerPointLabel": return String(summary.points);
      case "tabDetailTitle": return this.tabTitle(this.tab);
    }
    const total = /^SummaryLabel_(\d)$/.exec(name);
    if (total) {
      const bucket = careerTotals(this.careers, summary.careers)[Number(total[1]) - 1];
      return bucket ? `${bucket.done} / ${bucket.total}` : undefined;
    }
    if (row) {
      if (name === "careerName") return row.info.title;
      if (name === "careerHelp") return row.progress.untracked
        ? `${row.info.help}（当前版本暂不统计）` : row.info.help;
      if (name === "careerCompleteDate") return careerDate(row.progress.completedAt);
      const lines = this.conditionLines(row);
      if (name === "careerInfo") return lines[0]?.text;
      const info = /^careerInfo_(\d)_(\d)$/.exec(name);
      if (info) return lines[Number(info[2]) - 1]?.text;
    }
    if (this.recent) {
      if (name === "completeCareerName") return this.recent.info.title;
      if (name === "completeCareerDate") return careerDate(this.recent.at);
    }
    const raw = attribute(node, "text");
    if (!raw) return undefined;
    const key = /^#sb\(([^)]+)\)$/.exec(raw)?.[1];
    if (key) return this.text(key);
    // Template placeholders ("name", "Lv.0", Korean samples) are not shown.
    return node.name === "Label" && /[가-힣]|^name$|^careerName$|^1999/.test(raw) ? undefined : raw;
  }

  private drawLabel(node: MyRoomHudNode, text: string, rect: Rect): void {
    const alignment = attribute(node, "textAlign") ?? "";
    const render = myRoomHudTextRender(attribute(node, "textRender"));
    m9(this.context, text, rect, {
      family: FONT_FAMILY, size: render.size, kind: "label",
      color: myRoomHudColor(attribute(node, "textColor")),
      align: alignment.includes("right") ? "right"
        : alignment.includes("center") || alignment.includes("hcenter") ? "center" : "left",
      verticalAlign: alignment.includes("vcenter") || alignment === "center" ? "center" : "top",
      stroke: render.stroke,
      strokeColor: myRoomHudColor(attribute(node, "textColor2"), "black"),
    });
  }

  private drawGauge(sprite: HTMLCanvasElement, rect: Rect, name: string): void {
    const bucket = careerTotals(this.careers, this.summary.careers)[Number(name.slice(-1)) - 1];
    const fraction = bucket && bucket.total ? bucket.done / bucket.total : 0;
    if (fraction <= 0) return;
    this.context.drawImage(sprite, 0, 0, sprite.width * fraction, sprite.height,
      rect.x, rect.y, rect.width * fraction, rect.height);
  }

  /** 近期获得成就: completeCareerTemplate rows in two columns under the label. */
  private drawRecent(parent: Rect, label: Rect): void {
    this.summary.recent.slice(0, 6).forEach((item, index) => {
      const info = this.careers.get(item.id);
      if (!info) return;
      const area = { x: label.x + (index % 2) * 494, y: label.y + 34 + Math.floor(index / 2) * 104,
        width: 484, height: 94 };
      this.recent = { info, at: item.completedAt };
      try {
        this.draw(this.recentTemplate, { ...area });
      } finally {
        this.recent = undefined;
      }
    });
    void parent;
  }

  private rows(): CareerRow[] {
    return careerRows(this.careers, this.summary.careers, this.tab, this.filter);
  }

  private tabHasComplete(sub: number): boolean {
    return this.summary.careers.some(item => item.state === "complete" && !item.locked &&
      this.careers.get(item.id)?.subType === sub);
  }

  private drawList(rect: Rect): void {
    this.listRect = rect;
    const rows = this.rows();
    this.listHeight = rows.length * ROW_HEIGHT;
    this.scroll = Math.max(0, Math.min(this.scroll, Math.max(0, this.listHeight - rect.height)));
    const context = this.context;
    context.save();
    context.beginPath();
    context.rect(rect.x - 4, rect.y, rect.width + 40, rect.height);
    context.clip();
    const first = Math.floor(this.scroll / ROW_HEIGHT);
    for (let index = first; index < rows.length; index++) {
      const y = rect.y + index * ROW_HEIGHT - this.scroll;
      if (y > rect.y + rect.height) break;
      this.row = rows[index];
      try {
        this.draw(this.template, { x: rect.x, y, width: 972, height: 136 });
      } finally {
        this.row = undefined;
      }
    }
    context.restore();
    // Buttons scrolled out of the list cannot be clicked.
    this.regions = this.regions.filter(region => !region.key.startsWith("complete:") ||
      (region.rect.y >= rect.y - 1 && region.rect.y + region.rect.height <= rect.y + rect.height + 1));
  }

  private drawScrollBar(rect: Rect): void {
    const list = this.listRect;
    if (!list || this.listHeight <= list.height) return;
    const context = this.context;
    const track = { ...rect, height: list.height };
    context.fillStyle = "rgba(42, 55, 80, 0.18)";
    context.fillRect(track.x, track.y, track.width, track.height);
    const thumbHeight = Math.max(50, track.height * list.height / this.listHeight);
    const range = this.listHeight - list.height;
    const thumbY = track.y + (track.height - thumbHeight) * (this.scroll / range);
    context.fillStyle = "rgba(84, 100, 129, 0.75)";
    context.fillRect(track.x + 2, thumbY, track.width - 4, thumbHeight);
    this.regions.push({ key: "scrollTrack", rect: track, label: "滚动成就列表",
      activate: () => {
        const middle = thumbY + thumbHeight / 2;
        const step = list.height * 0.9;
        const pointerY = this.lastPointerY ?? middle;
        this.scrollBy(pointerY < middle ? -step : step);
      } });
  }

  private lastPointerY?: number;

  private comboRect?: Rect;

  private drawCombo(rect: Rect): void {
    this.comboRect = rect;
    const context = this.context;
    context.fillStyle = "rgb(250, 251, 253)";
    context.strokeStyle = "rgb(150, 165, 190)";
    context.lineWidth = 1;
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
    context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
    m9(context, this.text(this.filter) ?? this.filter, { ...rect, x: rect.x + 10, width: rect.width - 30 }, {
      family: FONT_FAMILY, size: 16, kind: "label", color: "rgb(42, 55, 80)", align: "left",
      verticalAlign: "center", stroke: 0, strokeColor: "black" });
    context.fillStyle = "rgb(84, 100, 129)";
    context.beginPath();
    context.moveTo(rect.x + rect.width - 18, rect.y + rect.height / 2 - 3);
    context.lineTo(rect.x + rect.width - 8, rect.y + rect.height / 2 - 3);
    context.lineTo(rect.x + rect.width - 13, rect.y + rect.height / 2 + 4);
    context.fill();
    this.regions.push({ key: "combo", rect, label: "筛选成就",
      activate: () => { this.comboOpen = !this.comboOpen; this.render(); } });
  }

  private drawComboList(): void {
    const rect = this.comboRect;
    if (!rect) return;
    const context = this.context;
    FILTERS.forEach((filter, index) => {
      const item = { x: rect.x, y: rect.y + rect.height + index * 24, width: rect.width, height: 24 };
      const hovered = this.hovered === `filter:${filter}`;
      context.fillStyle = hovered ? "rgb(214, 228, 248)" : "rgb(250, 251, 253)";
      context.fillRect(item.x, item.y, item.width, item.height);
      context.strokeStyle = "rgb(150, 165, 190)";
      context.strokeRect(item.x + 0.5, item.y + 0.5, item.width - 1, item.height - 1);
      m9(context, this.text(filter) ?? filter, { ...item, x: item.x + 10, width: item.width - 12 }, {
        family: FONT_FAMILY, size: 16, kind: "label", color: "rgb(42, 55, 80)", align: "left",
        verticalAlign: "center", stroke: 0, strokeColor: "black" });
      this.regions.push({ key: `filter:${filter}`, rect: item, label: this.text(filter) ?? filter,
        activate: () => {
          this.filter = filter;
          this.comboOpen = false;
          this.scroll = 0;
          this.render();
        } });
    });
  }

  private activate(name: string, row?: CareerRow): void {
    if (this.busy) return;
    this.comboOpen = false;
    if (name === "cancelButton") {
      this.close();
      return;
    }
    if (name === "tab_SummaryButton") this.selectTab(0);
    const tab = /^tab_(\d+)$/.exec(name);
    if (tab) this.selectTab(Number(tab[1]));
    if (name === "completeBtn" && row) void this.complete(row);
    this.render();
  }

  private selectTab(tab: number): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.scroll = 0;
    this.filter = "all";
  }

  private scrollBy(delta: number): void {
    const list = this.listRect;
    if (!list) return;
    this.scroll = Math.max(0, Math.min(this.scroll + delta, Math.max(0, this.listHeight - list.height)));
    this.render();
  }

  private async complete(row: CareerRow): Promise<void> {
    if (!this.options.complete || this.busy) return;
    this.busy = true;
    this.render();
    let completion: CareerCompletion | undefined;
    try {
      completion = await this.options.complete(row.info.id);
      this.summary = this.options.reload ? await this.options.reload() : this.summary;
    } catch (error) {
      this.busy = false;
      this.render();
      const message = error instanceof Error ? error.message : String(error);
      await this.options.notice(this.text("achievementPopupTitle") ?? "完成成就",
        message === "CAREER_ALREADY_COMPLETED" ? "成就已完成" : this.text("errorMsg") ?? message);
      return;
    }
    this.busy = false;
    this.render();
    // The release message box shows one line.
    const parts = [`${row.info.title} ${this.text("completePopupString") ?? "成就已完成"}`];
    if (completion.emblem) parts.push(`获得徽章：${this.emblems.get(completion.emblem)?.name ?? completion.emblem}`);
    if (completion.point) parts.push(`成就积分 +${completion.point}`);
    await this.options.notice(this.text("achievementPopupTitle") ?? "完成成就", parts.join("，"));
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    const bounds = this.canvas.getBoundingClientRect();
    if (bounds.height) this.lastPointerY = (event.clientY - bounds.top) * STAGE.height / bounds.height;
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.tab !== 0) this.scrollBy(event.deltaY);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (this.comboOpen) {
        this.comboOpen = false;
        this.render();
      } else this.close();
    }
  };
}
