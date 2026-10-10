import { C8, te } from "../generated/library.js";
import type { DownloadJob, GroupStatus, ResourceManager } from "../resources/resource-manager";
import type { ResourceGroup } from "../resources/resource-groups";
import { FONT, ImageCache, indexRows, node, nodeName, paintText, prepare, type BmlLibrary, type Node, type NodeState,
  type Rect, type Texture, type WindowView } from "./bml-kit";

/**
 * 资源下载 drawn by the release window renderer in the 任务 dialog's look
 * (dialog2_questInfo2: CaptionDialog, the grey list caption, TitleCap,
 * the right-slot caption, its row buttons and progress gauge): the
 * resource groups on the left, the chosen one on the right with its size,
 * download state, gauge and 下载 / 暂停 / 删除, and for 赛道 the themes,
 * ten a page. Also the small window shown while a page's first resources
 * download (正在下载…资源, 后台下载).
 */

const FOLDER = "dialog2_/questInfo2";
const ROOTS = [FOLDER, "stage_/common"];
const ROW = { width: 300, height: 26, gap: 3 };
const CELL = { width: 196, height: 26, gapX: 6, gapY: 4 };
const CELLS = 10;
const FILE_ROWS = 6;
/** Row button art: the left box (state), the stretched middle, the right cap. */
const ROW_LEFT = 72;
const ROW_RIGHT = 12;
const TEXT = "rgb(42,55,80)";

/** "341.4 MB", "1.24 GB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

function percentOf(status: GroupStatus): string {
  const value = status.totalBytes ? Math.floor(status.progressBytes / status.totalBytes * 100) : 0;
  return value < 1 && status.progressBytes > 0 ? "<1%" : `${value}%`;
}

/** A group's state in words: 已下载, 下载中 52%, 已下载 <1%, 未下载. */
export function statusText(status: GroupStatus): string {
  if (status.state === "complete") return "已下载";
  if (status.queued) return `下载中 ${percentOf(status)}`;
  return status.state === "partial" ? `已下载 ${percentOf(status)}` : "未下载";
}

/** The short text in a row button's left box. */
export function rowStatus(status: GroupStatus): string {
  if (status.state === "complete") return "完成";
  if (status.queued) return "下载中";
  return status.state === "partial" ? percentOf(status) : "未下载";
}

/** A row button image kept crisp at any width: left box, stretched middle, right cap. */
function drawRow(context: CanvasRenderingContext2D, image: Texture, rect: Rect): void {
  const left = Math.min(ROW_LEFT, image.width / 2);
  const right = Math.min(ROW_RIGHT, image.width / 4);
  const scale = rect.height / image.height;
  const leftWidth = left * scale;
  const rightWidth = right * scale;
  context.drawImage(image.image, 0, 0, left, image.height, rect.x, rect.y, leftWidth, rect.height);
  context.drawImage(image.image, left, 0, image.width - left - right, image.height, rect.x + leftWidth, rect.y,
    Math.max(0, rect.width - leftWidth - rightWidth), rect.height);
  context.drawImage(image.image, image.width - right, 0, right, image.height, rect.x + rect.width - rightWidth,
    rect.y, rightWidth, rect.height);
}

function drawLabel(context: CanvasRenderingContext2D, text: string, x: number, y: number, options: {
  size?: number; bold?: boolean; color?: string; align?: CanvasTextAlign; width?: number;
} = {}): void {
  context.save();
  context.font = `${options.bold ? "bold " : ""}${options.size ?? 13}px ${FONT}`;
  context.textBaseline = "middle";
  context.textAlign = options.align ?? "left";
  context.fillStyle = options.color ?? "black";
  let shown = text;
  if (options.width) {
    while ([...shown].length > 1 && context.measureText(shown).width > options.width)
      shown = `${[...shown].slice(0, -2).join("")}…`;
  }
  context.fillText(shown, x, y);
  context.restore();
}

/** gui_monocoque frame01: the TitleCapBottomGrey pieces (frame.bml). */
const FRAME_TEXTURE = "gui_/monocoque/frame01.png";
const GREY = { left: [161, 8, 9, 1], right: [170, 8, 9, 1], client: [168, 7, 2, 6], bottomLeft: [161, 11, 9, 8],
  bottomMiddle: [169, 11, 1, 8], bottomRight: [170, 11, 9, 8] } as const;

/**
 * TitleCapBottomGrey drawn whole: the release frame's bottom piece has a
 * zero-width middle (margins 9 + 9 of 18), which the frame renderer skips,
 * leaving a white strip; sampling unsmoothed also keeps the atlas
 * neighbours from bleeding into the edges.
 */
function drawGreyPanel(context: CanvasRenderingContext2D, frame: Texture, rect: Rect): void {
  const piece = (source: readonly number[], x: number, y: number, width: number, height: number) => {
    if (width > 0 && height > 0) context.drawImage(frame.image, source[0]!, source[1]!, source[2]!, source[3]!,
      x, y, width, height);
  };
  const side = GREY.left[2];
  const bottom = GREY.bottomLeft[3];
  const body = rect.height - bottom;
  context.save();
  context.imageSmoothingEnabled = false;
  piece(GREY.client, rect.x + side, rect.y, rect.width - side * 2, body);
  piece(GREY.left, rect.x, rect.y, side, body);
  piece(GREY.right, rect.x + rect.width - side, rect.y, side, body);
  piece(GREY.bottomLeft, rect.x, rect.y + body, side, bottom);
  piece(GREY.bottomMiddle, rect.x + side, rect.y + body, rect.width - side * 2, bottom);
  piece(GREY.bottomRight, rect.x + rect.width - side, rect.y + body, side, bottom);
  context.restore();
}

/** The 任务 gauge (img_questGageBG / On, 비활성 when there is nothing to do) with its text. */
function drawGauge(context: CanvasRenderingContext2D, images: ImageCache, rect: Rect, ratio: number,
  text: string, active: boolean): void {
  const suffix = active ? "" : "_비활성";
  const back = images.named(ROOTS, `img_questGageBG${suffix}`);
  const fill = images.named(ROOTS, `img_questGageOn${suffix}`);
  if (back) context.drawImage(back.image, rect.x, rect.y, rect.width, rect.height);
  const part = Math.max(0, Math.min(1, ratio));
  if (fill && part > 0) {
    context.drawImage(fill.image, 0, 0, fill.width * part, fill.height, rect.x, rect.y, rect.width * part,
      rect.height);
  }
  context.save();
  context.font = `bold 12px ${FONT}`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineWidth = 3;
  context.strokeStyle = "rgba(0,0,0,.75)";
  context.strokeText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  context.fillStyle = "white";
  context.fillText(text, rect.x + rect.width / 2, rect.y + rect.height / 2 + 1);
  context.restore();
}

/** A TextButton's state: the renderer draws `text`; `label` names it for assistive tech. */
function button(text: string, action?: () => void, disabled = false): NodeState {
  return { text, label: text, disabled: disabled || !action, ...(action && !disabled ? { action } : {}) };
}

async function decorate(library: BmlLibrary, definition: Node): Promise<Node> {
  if (definition.name === "CaptionWindow" && definition.attributes.some(entry => entry.name === "setCloseButton"))
    return await C8(library, definition, FOLDER) as Node;
  return { ...definition, children: await Promise.all(definition.children.map(child => decorate(library, child))) };
}

async function loadWindow(library: BmlLibrary, root: HTMLElement, definition: Node, label: string,
  onCancel: () => void, state: (entry: Node) => NodeState,
  prepared?: (definition: Node) => void): Promise<WindowView> {
  const tree = prepare(library, await decorate(library, definition), ROOTS);
  // The renderer hands the state callback the very nodes of this tree.
  prepared?.(tree);
  return await te.load({
    library, root, definition: tree, roots: ROOTS, smoothImages: true, modal: true, label, onCancel, state,
  }) as WindowView;
}

/** The 资源下载 window's tree: the group list, the detail and the theme grid. */
export function resourceWindowDefinition(groupCount: number): Node {
  const rows = Array.from({ length: groupCount }, (_unused, index) => node("Window", { name: `groupRow${index}`,
    leftTopWH: `0 ${index * (ROW.height + ROW.gap)} ${ROW.width} ${ROW.height}` }, [
    node("ImageButton", { name: "groupBtn", leftTopWH: `0 0 ${ROW.width} ${ROW.height}`, alphaBlend: "true" }),
  ]));
  const cells = Array.from({ length: CELLS }, (_unused, index) => node("Window", { name: `themeCell${index}`,
    leftTopWH: `${(index % 2) * (CELL.width + CELL.gapX)} ${Math.floor(index / 2) * (CELL.height + CELL.gapY)} ${
      CELL.width} ${CELL.height}` }, [
    node("ImageButton", { name: "themeBtn", leftTopWH: `0 0 ${CELL.width} ${CELL.height}`, alphaBlend: "true" }),
  ]));
  return node("Panel", { windowRect: "fullscreen", color: "100 0 0 0", alphaBlend: "true" }, [
    node("CaptionWindow", { name: "resourceDialog", windowRect: "0 0 780 640", frame: "CaptionDialog",
      caption: "资源下载", captionPos: "0 1", align: "center", setCloseButton: "closeButton", textRender: "bold" }, [
      // The grey list frame fills the column (no InnerFrame around it: its white band showed above and below),
      // top and bottom level with the detail panel.
      node("CaptionWindow", { name: "groupCaption", windowSize: "318 468", adjust: "0 7", frame: "CaptionWindowGrey" }, [
        // Captions draw at 20px; this one uses a label in the list's face instead.
        node("Label", { name: "groupCaptionText", windowSize: "290 26", adjust: "8 -26", textRender: "bold15",
          textColor: "white", textAlign: "left|vcenter" }),
        node("Container", { name: "groupRows", windowSize: `${ROW.width} 432`, adjust: "3 4" }, rows),
      ]),
      node("Container", { name: "detail", windowSize: "420 470", adjust: "327 7" }, [
        node("Label", { name: "detailTitle", windowSize: "420 30", adjust: "0 0", frame: "TitleCap",
          textRender: "bold", textColor: "white", textAlign: "center" }),
        // TitleCapBottomGrey, painted (greyPanel): the renderer skips its zero-width bottom middle.
        node("Label", { name: "detailBack", windowSize: "422 438", adjust: "-2 30" }),
        node("Container", { windowSize: "422 438", adjust: "-2 30" }, [
          node("ImageBoard", { windowSize: "246 18", adjust: "0 6", image: "img_periodBG", align: "hcenter",
            alphaBlend: "true" }, [
            node("Label", { name: "detailSize", windowSize: "246 18", adjust: "0 0", textAlign: "center",
              textRender: "bold12", textColor: "black" }),
          ]),
          node("Label", { name: "detailDesc", windowSize: "392 40", adjust: "0 32", align: "hcenter" }),
          // The release size of img_stateBarBG (its right slot does not stretch), its caption in a smaller face.
          node("CaptionWindow", { name: "statusCaption", windowSize: "344 86", adjust: "0 80",
            frame: "CaptionWindowRightSlot", align: "hcenter" }, [
            node("Label", { name: "statusCaptionText", windowSize: "200 20", adjust: "10 -21", textRender: "bold14",
              textColor: "white", textAlign: "left|vcenter", text: "下载状态" }),
            node("Label", { name: "statusText", windowSize: "75 17", adjust: "257 -19", textRender: "bold12",
              textColor: "white", textAlign: "center" }),
            node("Label", { name: "gauge", windowSize: "274 22", adjust: "0 10", align: "hcenter" }),
            node("Label", { name: "gaugeDetail", windowSize: "320 32", adjust: "0 38", align: "hcenter" }),
          ]),
          node("TextButton", { name: "primaryButton", windowSize: "110 28", adjust: "95 178", textRender: "bold14" }),
          node("TextButton", { name: "secondaryButton", windowSize: "110 28", adjust: "217 178",
            textRender: "bold14" }),
          node("ImageBoard", { name: "themeHeader", windowSize: "398 30", adjust: "0 222", image: "img_도전과제BG",
            align: "hcenter", alphaBlend: "true" }, [
            node("Label", { name: "themeHeaderText", windowSize: "398 30", adjust: "0 -2", textRender: "bold14",
              textColor: "white", textAlign: "center" }),
          ]),
          node("Container", { name: "themeGrid", windowSize: "398 146", adjust: "0 258", align: "hcenter" }, cells),
          node("TextButton", { name: "themePrev", windowSize: "70 24", adjust: "100 408", textRender: "bold12" }),
          node("Label", { name: "themePage", windowSize: "80 24", adjust: "171 408" }),
          node("TextButton", { name: "themeNext", windowSize: "70 24", adjust: "252 408", textRender: "bold12" }),
          node("Label", { name: "fileList", windowSize: "386 114", adjust: "0 256", align: "hcenter" }),
          node("Label", { name: "detailTip", windowSize: "386 34", adjust: "0 388", align: "hcenter" }),
        ]),
      ]),
      node("Label", { name: "summary", windowSize: "520 24", adjust: "6 484" }),
      node("TextButton", { name: "downloadAll", windowSize: "96 28", adjust: "546 482", textRender: "bold14" }),
      node("TextButton", { name: "pauseAll", windowSize: "96 28", adjust: "648 482", textRender: "bold14" }),
      node("Label", { name: "footer", windowSize: "740 20", adjust: "6 516" }),
      node("TextButton", { name: "okButton", windowRect: "0 0 94 32", align: "hcenter|bottom", textRender: "bold14" }),
    ]),
  ]);
}

export interface ResourceWindowOptions {
  onActivate?(): void;
  onClose?(): void;
}

const TIP = "首页资源启动时优先下载；进入小屋、商城等页面时自动下载该页面的资源，赛道在比赛加载时下载。" +
  "也可以在这里提前下载，或删除不用的资源。";

/** The open 资源下载 window (one at a time). */
let openWindow: ResourceWindow | undefined;

export function isResourceWindowOpen(): boolean {
  return !!openWindow;
}

export class ResourceWindow {
  private view?: WindowView;
  private selected: string;
  private child?: string;
  private themePage = 0;
  private confirmView?: WindowView;
  private busy = false;
  private spaceText = "";
  private spaceTimer?: ReturnType<typeof setInterval>;
  private release?: () => void;
  private disposed = false;
  private readonly images: ImageCache;

  private constructor(readonly manager: ResourceManager, readonly library: BmlLibrary, readonly root: HTMLElement,
    readonly options: ResourceWindowOptions) {
    this.images = new ImageCache(library, () => this.view?.render());
    this.selected = manager.groups[0]?.id ?? "home";
  }

  /** Opens the window (or keeps the open one); resolves once it shows. */
  static async open(manager: ResourceManager, library: BmlLibrary, root: HTMLElement,
    options: ResourceWindowOptions = {}): Promise<ResourceWindow> {
    if (openWindow) return openWindow;
    const window = new ResourceWindow(manager, library, root, options);
    openWindow = window;
    try {
      await window.build();
    } catch (error) {
      window.dispose();
      throw error;
    }
    return window;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (openWindow === this) openWindow = undefined;
    this.release?.();
    clearInterval(this.spaceTimer);
    this.confirmView?.dispose();
    this.view?.dispose();
    this.options.onClose?.();
  }

  private async build(): Promise<void> {
    const rows = new WeakMap<Node, number>();
    const cells = new WeakMap<Node, number>();
    const view = await loadWindow(this.library, this.root, resourceWindowDefinition(this.manager.groups.length),
      "资源下载", () => this.close(), entry => this.state(entry, rows, cells), tree => {
        indexRows(tree, "groupRow", rows);
        indexRows(tree, "themeCell", cells);
      });
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.view = view;
    this.release = this.manager.subscribe(() => this.view?.render());
    this.updateSpace();
    this.spaceTimer = setInterval(() => this.updateSpace(), 5_000);
    view.show();
    void this.manager.refresh().catch(() => undefined);
  }

  private close(): void {
    this.options.onActivate?.();
    this.dispose();
  }

  private updateSpace(): void {
    const storage = this.root.ownerDocument.defaultView?.navigator.storage;
    void storage?.estimate?.().then(estimate => {
      if (typeof estimate.quota !== "number" || typeof estimate.usage !== "number") return;
      this.spaceText = `浏览器可用空间 ${formatBytes(Math.max(0, estimate.quota - estimate.usage))}`;
      this.view?.render();
    }).catch(() => undefined);
  }

  /** The group the detail shows: a theme of 赛道 when one is chosen. */
  private current(): ResourceGroup | undefined {
    const parent = this.manager.group(this.selected);
    return (this.child && parent?.children?.find(entry => entry.id === this.child)) || parent;
  }

  private select(id: string): void {
    this.options.onActivate?.();
    this.selected = id;
    this.child = undefined;
    this.themePage = 0;
    this.view?.render();
  }

  private selectChild(id: string): void {
    this.options.onActivate?.();
    this.child = this.child === id ? undefined : id;
    this.view?.render();
  }

  private hovered(entry: Node): boolean {
    return (this.view as unknown as { hovered?: Node } | undefined)?.hovered === entry;
  }

  private rowPaint(entry: Node, group: ResourceGroup, selected: boolean, width: number) {
    return (context: CanvasRenderingContext2D, rect: Rect) => {
      const status = this.manager.status(group.id);
      const look = status.state === "complete" ? "btn_완료_" : "btn_진행중_";
      const image = this.images.named(ROOTS, `${look}${selected ? 5 : this.hovered(entry) ? 2 : 1}`);
      if (image) drawRow(context, image, rect);
      const middle = rect.y + rect.height / 2 + 1;
      drawLabel(context, rowStatus(status), rect.x + 37, middle, { bold: true, align: "center", size: 12 });
      // The selected look has an arrow at the right end: the size keeps clear of it.
      drawLabel(context, group.title, rect.x + 78, middle, { width: rect.width - 78 - 8 - (width > 200 ? 76 : 0) });
      if (width > 200) drawLabel(context, formatBytes(group.bytes), rect.x + rect.width - 22, middle,
        { size: 12, align: "right", color: "rgb(70,80,100)" });
    };
  }

  private state(entry: Node, rows: WeakMap<Node, number>, cells: WeakMap<Node, number>): NodeState {
    const name = nodeName(entry);
    const row = rows.get(entry);
    if (row !== undefined) {
      const group = this.manager.groups[row];
      if (/^groupRow\d+$/.test(name)) return { visible: !!group };
      if (name === "groupBtn" && group) return { label: group.title, action: () => this.select(group.id),
        paint: this.rowPaint(entry, group, group.id === this.selected, ROW.width) };
      return {};
    }
    const cell = cells.get(entry);
    if (cell !== undefined) {
      const theme = this.themes()[this.themePage * CELLS + cell];
      if (/^themeCell\d+$/.test(name)) return { visible: !!theme };
      if (name === "themeBtn" && theme) return { label: theme.title, action: () => this.selectChild(theme.id),
        paint: this.rowPaint(entry, theme, theme.id === this.child, CELL.width) };
      return {};
    }
    const group = this.current();
    const status = group ? this.manager.status(group.id) : undefined;
    const themes = this.themes();
    const pages = Math.max(1, Math.ceil(themes.length / CELLS));
    switch (name) {
      case "resourceDialog": return { text: "资源下载" };
      case "closeButton": return { label: "关闭", action: () => this.close() };
      case "okButton": return button("关闭", () => this.close());
      case "groupCaptionText": return { text: `资源分类（${this.manager.groups.length}）` };
      case "detailTitle": return { text: this.titleOf(group) };
      case "detailSize": return { text: group ? `共 ${formatBytes(group.bytes)} · ${group.containers.length} 个文件` : "" };
      case "detailBack": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const frame = this.images.path(FRAME_TEXTURE);
        if (frame) drawGreyPanel(context, frame, rect);
      } };
      case "detailDesc": return paintText(group?.description ?? "", { size: 13, color: "black", lineGap: 4 });
      case "statusText": return { text: !status ? "" : status.state === "complete" ? "已下载"
        : status.queued ? "下载中" : status.state === "partial" ? "部分下载" : "未下载" };
      case "gauge": return !group || !status ? {} : { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) =>
        drawGauge(context, this.images, rect, status.totalBytes ? status.progressBytes / status.totalBytes : 1,
          `${formatBytes(status.progressBytes)} / ${formatBytes(status.totalBytes)}（${percentOf(status)}）`,
          status.state !== "complete" || status.queued) };
      case "gaugeDetail": return paintText(this.gaugeDetail(group), { size: 12, color: TEXT, align: "center",
        lineGap: 3 });
      case "primaryButton": return group && status ? this.primary(group, status) : { visible: false };
      case "secondaryButton": return group && status ? this.secondary(group, status) : { visible: false };
      case "themeHeaderText": return { text: themes.length ? `按主题下载（${themes.length} 个）`
        : `主要文件（共 ${group?.containers.length ?? 0} 个，按大小）` };
      case "fileList": return themes.length || !group ? { visible: false } : { text: "",
        paint: (context: CanvasRenderingContext2D, rect: Rect) => this.paintFiles(context, rect, group) };
      case "themeGrid": return { visible: themes.length > 0 };
      case "themePrev": return { ...button("上一页", () => this.turn(-1), this.themePage <= 0),
        visible: themes.length > CELLS };
      case "themeNext": return { ...button("下一页", () => this.turn(1), this.themePage >= pages - 1),
        visible: themes.length > CELLS };
      case "themePage": return themes.length > CELLS ? paintText(`${this.themePage + 1} / ${pages}`, { size: 13,
        color: "black", align: "center", middle: true, bold: true }) : { visible: false };
      case "detailTip": return themes.length ? { visible: false } : paintText(TIP, { size: 11, color: "rgb(70,80,100)",
        lineGap: 6 });
      case "summary": {
        const totals = this.manager.totals();
        return paintText(`已下载 ${formatBytes(totals.cachedBytes)} / ${formatBytes(totals.totalBytes)}　${
          this.spaceText}`, { size: 13, color: TEXT, bold: true, middle: true });
      }
      case "downloadAll": return button("全部下载", () => this.downloadAll());
      case "pauseAll": return button("暂停全部", () => this.pauseAll(), !this.manager.activeJobs().length);
      case "footer": return paintText(this.footer(), { size: 12, color: TEXT, middle: true });
    }
    return {};
  }

  /** The group's largest containers, a row each: name, size and whether it is here. */
  private paintFiles(context: CanvasRenderingContext2D, rect: Rect, group: ResourceGroup): void {
    const flying = new Map(this.manager.inFlight().map(item => [item.name, item]));
    const files = group.containers.map(name => ({ name, size: this.manager.bytesOf([name]) }))
      .sort((a, b) => b.size - a.size).slice(0, FILE_ROWS);
    const height = rect.height / FILE_ROWS;
    files.forEach((file, index) => {
      const y = rect.y + index * height;
      if (index % 2 === 0) {
        context.fillStyle = "rgba(255,255,255,.45)";
        context.fillRect(rect.x, y, rect.width, height);
      }
      const middle = y + height / 2 + 1;
      const loading = flying.get(file.name);
      const cached = this.manager.isCached(file.name);
      const state = cached ? "已下载" : loading
        ? `下载中 ${Math.floor(loading.loadedBytes / Math.max(1, loading.totalBytes) * 100)}%` : "未下载";
      drawLabel(context, file.name, rect.x + 8, middle, { size: 12, width: rect.width - 150 });
      drawLabel(context, formatBytes(file.size), rect.x + rect.width - 82, middle,
        { size: 12, align: "right", color: "rgb(70,80,100)" });
      drawLabel(context, state, rect.x + rect.width - 8, middle, { size: 12, bold: true, align: "right",
        color: cached ? "rgb(40,140,60)" : loading ? "rgb(30,100,200)" : "rgb(150,80,60)" });
    });
  }

  private themes(): readonly ResourceGroup[] {
    return this.manager.group(this.selected)?.children ?? [];
  }

  private titleOf(group: ResourceGroup | undefined): string {
    if (!group) return "";
    const parent = this.manager.group(this.selected);
    return parent && parent !== group ? `${parent.title} · ${group.title}` : group.title;
  }

  private gaugeDetail(group: ResourceGroup | undefined): string {
    if (!group) return "";
    const names = new Set(group.containers);
    const flying = this.manager.inFlight().filter(item => names.has(item.name));
    if (flying.length) return `正在下载：${flying.slice(0, 2).map(item =>
      `${item.name} ${formatBytes(item.loadedBytes)}/${formatBytes(item.totalBytes)}`).join("，")}${
      flying.length > 2 ? ` 等 ${flying.length} 个` : ""}`;
    if (group.required) return "启动时优先下载，不能删除。";
    const status = this.manager.status(group.id);
    if (status.state === "complete") return "已全部下载，可删除以释放空间（之后用到时会重新下载）。";
    return `还需下载 ${formatBytes(Math.max(0, status.totalBytes - status.cachedBytes))}。`;
  }

  private primary(group: ResourceGroup, status: GroupStatus): NodeState {
    if (status.queued) return button("暂停", () => {
      this.options.onActivate?.();
      this.manager.cancelGroup(group.id);
    });
    if (status.state === "complete") return button("已下载", undefined, true);
    return button(status.state === "partial" ? "继续下载" : "下载", () => {
      this.options.onActivate?.();
      this.manager.downloadGroup(group.id, "normal");
    });
  }

  /** 删除 asks in a release CaptionDialog first; 首页 is never deleted. */
  private secondary(group: ResourceGroup, status: GroupStatus): NodeState {
    const removable = !group.required && !status.queued && this.manager.removableBytes(group.id) > 0 && !this.busy;
    return button("删除", () => void this.confirmDelete(group), !removable);
  }

  private async confirmDelete(group: ResourceGroup): Promise<void> {
    if (this.confirmView || this.busy || this.disposed) return;
    this.options.onActivate?.();
    const freed = this.manager.removableBytes(group.id);
    const kept = this.manager.status(group.id).cachedBytes - freed;
    const text = `删除“${this.titleOf(group)}”已下载的资源，释放 ${formatBytes(freed)}？|` +
      `之后用到时会重新下载${kept > 0 ? `；首页也要用的 ${formatBytes(kept)} 会保留` : ""}。`;
    let view: WindowView | undefined;
    const close = () => {
      if (this.confirmView === view) this.confirmView = undefined;
      view?.dispose();
    };
    const remove = () => {
      this.options.onActivate?.();
      close();
      this.busy = true;
      this.view?.render();
      void this.manager.removeGroup(group.id).finally(() => {
        this.busy = false;
        this.view?.render();
      });
    };
    const cancel = () => {
      this.options.onActivate?.();
      close();
    };
    const definition = node("Panel", { windowRect: "fullscreen", color: "100 0 0 0", alphaBlend: "true" }, [
      node("CaptionWindow", { name: "confirmDialog", windowRect: "0 0 440 200", frame: "CaptionDialog",
        caption: "删除资源", captionPos: "0 1", align: "center", setCloseButton: "closeButton", textRender: "bold" }, [
        node("Label", { name: "confirmText", windowSize: "400 72", adjust: "0 18", align: "hcenter" }),
        node("TextButton", { name: "confirmOk", leftTopWH: "0 0 100 30", align: "hcenter;bottom", adjust: "-56 10",
          textRender: "bold14" }),
        node("TextButton", { name: "confirmCancel", leftTopWH: "0 0 100 30", align: "hcenter;bottom", adjust: "56 10",
          textRender: "bold14" }),
      ]),
    ]);
    try {
      view = await loadWindow(this.library, this.root, definition, "删除资源", cancel, entry => {
        switch (nodeName(entry)) {
          case "confirmDialog": return { text: "删除资源" };
          case "confirmText": return paintText(text, { size: 14, color: TEXT, align: "center", middle: true,
            lineGap: 8 });
          case "confirmOk": return button("确定", remove);
          case "closeButton": return { label: "取消", action: cancel };
          case "confirmCancel": return button("取消", cancel);
        }
        return {};
      });
    } catch (error) {
      console.error("删除确认窗口打开失败", error);
      return;
    }
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.confirmView = view;
    view.show();
    view.focus("confirmCancel");
  }

  private footer(): string {
    const jobs = this.manager.activeJobs();
    const failure = this.manager.lastFailure();
    if (this.busy) return "正在删除…";
    if (jobs.length) return `下载任务：${jobs.slice(0, 3).map((job: DownloadJob) =>
      `${job.label} ${formatBytes(job.doneBytes())}/${formatBytes(job.totalBytes)}`).join("，")}${
      jobs.length > 3 ? ` 等 ${jobs.length} 个` : ""}`;
    if (failure) return `下载失败：${failure}`;
    return "当前没有下载任务。";
  }

  private turn(step: number): void {
    const pages = Math.max(1, Math.ceil(this.themes().length / CELLS));
    this.options.onActivate?.();
    this.themePage = Math.min(pages - 1, Math.max(0, this.themePage + step));
    this.view?.render();
  }

  private downloadAll(): void {
    this.options.onActivate?.();
    for (const group of this.manager.groups) if (this.manager.status(group.id).state !== "complete")
      this.manager.downloadGroup(group.id, "low");
  }

  private pauseAll(): void {
    this.options.onActivate?.();
    for (const job of this.manager.activeJobs()) job.cancel();
  }
}

/**
 * The small window while a page's first resources download: its size and
 * gauge, and 后台下载 (or the close button) to go on and let them finish in
 * the background. Resolves when the job ends or the player goes on.
 */
export async function waitForResources(library: BmlLibrary, root: HTMLElement, manager: ResourceManager,
  job: DownloadJob, title: string): Promise<void> {
  const images = new ImageCache(library, () => view?.render());
  let view: WindowView | undefined;
  let skip!: () => void;
  const skipped = new Promise<void>(resolve => { skip = resolve; });
  const definition = node("Panel", { windowRect: "fullscreen", color: "100 0 0 0", alphaBlend: "true" }, [
    node("CaptionWindow", { name: "waitDialog", windowRect: "0 0 460 210", frame: "CaptionDialog",
      caption: `正在下载${title}资源`, captionPos: "0 1", align: "center", setCloseButton: "closeButton",
      textRender: "bold" }, [
      node("Label", { name: "waitText", windowSize: "420 44", adjust: "0 14", align: "hcenter" }),
      node("Label", { name: "gauge", windowSize: "274 22", adjust: "0 66", align: "hcenter" }),
      node("TextButton", { name: "skipButton", windowRect: "0 0 110 30", align: "hcenter|bottom", textRender: "bold14" }),
    ]),
  ]);
  let release: (() => void) | undefined;
  try {
    view = await loadWindow(library, root, definition, `正在下载${title}资源`, () => skip(), entry => {
      const done = job.doneBytes();
      switch (nodeName(entry)) {
        case "waitDialog": return { text: `正在下载${title}资源` };
        case "waitText": return paintText(`首次进入${title}需要下载 ${formatBytes(job.totalBytes)}，` +
          "也可以先进入，资源会在后台继续下载。", { size: 13, color: TEXT, align: "center", lineGap: 6 });
        case "gauge": return { text: "", paint: (context: CanvasRenderingContext2D, rect: Rect) => drawGauge(context,
          images, rect, job.totalBytes ? done / job.totalBytes : 1,
          `${formatBytes(done)} / ${formatBytes(job.totalBytes)}`, true) };
        case "closeButton": return { label: "后台下载", action: () => skip() };
        case "skipButton": return button("后台下载", () => skip());
      }
      return {};
    });
    release = manager.subscribe(() => view?.render());
    view.show();
  } catch (error) {
    // The window is a convenience: without it the page waits for the job.
    console.warn("资源下载窗口打开失败", error);
  }
  try {
    await Promise.race([job.done.catch(() => undefined), skipped]);
  } finally {
    release?.();
    view?.dispose();
  }
}
