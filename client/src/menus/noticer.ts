import { te } from "../generated/library.js";
import { clipToStage, loadBml, mapTree, node, nodeName, paintText, prepare, withAttributes, type BmlLibrary,
  type Node, type NodeState, type WindowView } from "../ui/bml-kit";
import type { MenusApi, MiniNotice } from "./menus-api";

/**
 * 迷你提示窗 (dialog2_noticer noticer@zz): the bubble over the taskbar's
 * noticer button with the admin notices and the rider's reminders (奖励箱
 * items, completed quests), one page at a time. It opens by itself when
 * the reminders change and from the button; it never blocks the page
 * under it (its window is clipped to the bubble).
 */

const FOLDER = "dialog2_/noticer";
const ROOTS = [FOLDER, "stage_/common"];
/** Over the noticer button (tray leftTopTex 168 10 on the 834-high taskbar row). */
const BUBBLE = { x: 56, y: 674, width: 266, height: 148 };
const POLL_MS = 60_000;

export interface NoticerOptions {
  library: BmlLibrary;
  root: HTMLElement;
  api: MenusApi;
  onRewardBox?(): void;
  onQuests?(): void;
  onActivate?(): void;
}

export class Noticer {
  private view?: WindowView;
  private loading?: Promise<WindowView | undefined>;
  private notices: MiniNotice[] = [];
  private page = 0;
  private shown = false;
  private suspended = false;
  private disposed = false;
  private seen = "";
  private timer?: ReturnType<typeof setInterval>;

  constructor(readonly options: NoticerOptions) {
    this.timer = setInterval(() => { if (!this.suspended) void this.refresh(true); }, POLL_MS);
    void this.refresh(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.view?.dispose();
  }

  get open(): boolean {
    return this.shown;
  }

  /** The taskbar button: show the latest notices, or hide the bubble. */
  async toggle(): Promise<void> {
    if (this.shown) {
      this.hide();
      return;
    }
    await this.refresh(false);
    this.page = 0;
    await this.show();
  }

  /** Hidden with the taskbar (races). */
  setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    if (suspended) this.hide();
  }

  /**
   * Re-read the notices; with `auto` the bubble opens when they differ
   * from the ones the rider last saw.
   */
  async refresh(auto: boolean): Promise<void> {
    if (this.disposed) return;
    let result;
    try {
      result = await this.options.api.notices();
    } catch {
      return;
    }
    if (this.disposed) return;
    this.notices = result.notices;
    this.page = Math.min(this.page, Math.max(0, this.notices.length - 1));
    const key = JSON.stringify(this.notices);
    if (auto && key !== this.seen && this.notices.length && !this.suspended) {
      this.page = 0;
      await this.show();
    } else {
      this.view?.render();
    }
  }

  hide(): void {
    this.shown = false;
    if (this.view) this.view.element.hidden = true;
  }

  private async show(): Promise<void> {
    if (this.disposed || this.suspended) return;
    this.seen = JSON.stringify(this.notices);
    const view = this.view ?? await (this.loading ??= this.load());
    if (!view || this.disposed || this.suspended) return;
    this.shown = true;
    view.element.hidden = false;
    if (!view.element.isConnected) view.show();
    else view.render();
  }

  private async load(): Promise<WindowView | undefined> {
    const { library } = this.options;
    const raw = await loadBml(library, FOLDER, "noticer@zz");
    const bubble = mapTree({ ...raw, name: "Window" }, entry => entry === raw ? undefined
      : nodeName(entry) === "noticer" ? withAttributes(entry, { name: "noticerClose" }) : undefined);
    const definition = node("Container", { windowRect: "fullscreen" }, [withAttributes({ ...bubble, name: "Window" }, {
      windowSize: undefined, adjust: undefined, align: undefined,
      leftTopWH: `${BUBBLE.x} ${BUBBLE.y} ${BUBBLE.width} ${BUBBLE.height}` })]);
    const prepared = prepare(library, definition, ROOTS);
    const view = await te.load({
      library, root: this.options.root, definition: prepared, roots: ROOTS, smoothImages: true, modal: false,
      label: "迷你提示窗", onCancel: () => this.hide(), state: (entry: Node) => this.state(entry),
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return undefined;
    }
    // Above the lobby pages and the taskbar (z 2), like the messenger window.
    view.element.dataset.uiLayer = "dialog";
    // The page counter sits 22 above the bubble and the arrow 6 under it.
    clipToStage(view.element, [{ x: BUBBLE.x - 4, y: BUBBLE.y - 26, width: BUBBLE.width + 12, height: BUBBLE.height + 36 }]);
    this.view = view;
    return view;
  }

  private state(entry: Node): NodeState {
    const notice = this.notices[this.page];
    switch (nodeName(entry)) {
      case "noticerClose": return { label: "关闭", action: () => this.hide() };
      case "noticePageInfo": return { text: this.notices.length ? `${this.page + 1}/${this.notices.length}` : "0/0" };
      case "scrollLeft": return { label: "上一条", action: () => this.turn(-1) };
      case "scrollRight": return { label: "下一条", action: () => this.turn(1) };
      case "noticeTitle": return paintText(notice?.title ?? "", { size: 14, bold: true, align: "center", middle: true,
        color: "rgb(84,100,129)" });
      case "noticeMsg": {
        const open = notice?.kind === "rewardBox" ? this.options.onRewardBox
          : notice?.kind === "quest" ? this.options.onQuests : undefined;
        const text = paintText(notice?.message ?? "没有新的提示。", { size: 14, align: "center", middle: true,
          color: "rgb(84,100,129)", lineGap: 5 });
        return open ? { ...text, label: notice!.title, action: () => { this.hide(); open(); } } : text;
      }
    }
    return {};
  }

  private turn(step: number): void {
    if (!this.notices.length) return;
    this.page = (this.page + step + this.notices.length) % this.notices.length;
    this.options.onActivate?.();
    this.view?.render();
  }
}
