import { C8, te } from "../generated/library.js";
import type { AccountSession } from "../account/account-session";
import { clone, drawFitted, indexRows, loadBml, loadStrings, mapTree, node, nodeName, paintText, prepare,
  resolveStrings, withAttributes, type BmlLibrary, type Node, type NodeState, type Rect,
  type WindowView } from "../ui/bml-kit";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import { ItemIcons } from "./item-icons";
import { menuErrorMessage, type MenusApi, type RewardBoxEntry } from "./menus-api";

/**
 * 奖励箱 (GiftBoxStage over stage_rewardBox mq_window@zz): the rewards
 * of quests, the club racing center and admins wait here, eight
 * RewardBoxCards a page, until the rider takes one (领取) or the page
 * (领取本页道具). Hovering a card shows its giftDesc tooltip.
 */

const FOLDER = "stage_/rewardBox";
const ROOTS = [FOLDER, "stage_/common", "gui_/window/menu"];
const PER_PAGE = 8;
const CARD = { width: 478, height: 94, gapX: 6, gapY: 6 };
const TOOLTIP_HEIGHT = 216;
const DAY = 24 * 60 * 60 * 1000;
const CURRENCY_NAMES: Record<string, string> = { lucci: "金币", koin: "酷币", coupon: "点券" };

export interface RewardBoxScreenOptions {
  library: BmlLibrary;
  root: HTMLElement;
  api: MenusApi;
  session?: AccountSession;
  /** Data-service clock (Unix ms). */
  now?(): number;
  onClose(): void;
  onActivate?(): void;
  /** How many rewards wait now (after a claim). */
  onChanged?(count: number): void;
}

/** "1,000金币" for a currency entry, "道具 ×3" for items. */
export function rewardTitle(entry: Pick<RewardBoxEntry, "name" | "count" | "currency">): string {
  if (entry.currency) return /\d/.test(entry.name) ? entry.name : `${entry.count.toLocaleString("en-US")}${entry.name}`;
  return entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name;
}

/** The release dateTimeFormat "%d-%d-%d %d:%02d" in Beijing time. */
export function formatBoxTime(ms: number): string {
  const date = new Date(ms + 8 * 60 * 60 * 1000);
  return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()} ${date.getUTCHours()}:${
    String(date.getUTCMinutes()).padStart(2, "0")}`;
}

/** 保管时间 left: whole days, or hours on the last day. */
export function storageLeft(expiresAt: number, now: number): string {
  const left = Math.max(0, expiresAt - now);
  if (left >= DAY) return `${Math.floor(left / DAY)}天`;
  return `${Math.max(1, Math.ceil(left / (60 * 60 * 1000)))}小时`;
}

export function rewardDescription(entry: RewardBoxEntry): string {
  if (entry.currency) {
    return `${entry.count.toLocaleString("en-US")} ${CURRENCY_NAMES[entry.currency] ?? entry.name}|领取后直接存入账户。`;
  }
  return `数量：${entry.count}个|使用期限：${entry.days > 0 ? `${entry.days}天` : "永久"}`;
}

/** "已成功领取：A、B等3个道具。" and the release hint where to find them. */
export function claimedMessage(names: string[]): string {
  let list = names.join("、");
  if ([...list].length > 22) list = `${[...names[0] ?? ""].slice(0, 16).join("")}等${names.length}个道具`;
  return `已成功领取：${list}。|（领取的道具可以在我的道具中确认。）`;
}

export class RewardBoxScreen {
  private view?: WindowView;
  private entries: RewardBoxEntry[] = [];
  private page = 0;
  private busy = false;
  private disposed = false;
  private message?: AbortController;
  private readonly icons: ItemIcons;
  private strings = new Map<string, string>();

  private constructor(readonly options: RewardBoxScreenOptions) {
    this.icons = new ItemIcons(options.library, options.session, () => this.view?.render());
  }

  static async open(options: RewardBoxScreenOptions): Promise<RewardBoxScreen> {
    const screen = new RewardBoxScreen(options);
    try {
      const box = await options.api.rewardBox();
      screen.entries = box.entries;
      await screen.build();
    } catch (error) {
      screen.dispose();
      throw error;
    }
    return screen;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.message?.abort();
    this.view?.dispose();
    this.icons.dispose();
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private get pages(): number {
    return Math.max(1, Math.ceil(this.entries.length / PER_PAGE));
  }

  private entry(index: number): RewardBoxEntry | undefined {
    return this.entries[this.page * PER_PAGE + index];
  }

  private async build(): Promise<void> {
    const { library } = this.options;
    const [raw, card, strings] = await Promise.all([loadBml(library, FOLDER, "mq_window@zz"),
      loadBml(library, FOLDER, "rewardBoxCard@zz"), loadStrings(library, FOLDER, "stage_stringBag")]);
    this.strings = strings;
    const cardChildren = resolveStrings(card, strings).children;
    let tooltip: Node | undefined;
    let definition = mapTree(resolveStrings(raw, strings), entry => {
      if (entry.name === "GridSelector") {
        // GridSelector storageGridSelector: two RewardBoxCards a row.
        return { ...withAttributes(entry, {}), name: "Container", children: entry.children.map((child, index) =>
          node("Window", { name: `reward${index}`, leftTopWH: `${(index % 2) * (CARD.width + CARD.gapX)} ${
            Math.floor(index / 2) * (CARD.height + CARD.gapY)} ${CARD.width} ${CARD.height}` },
          cardChildren.map(clone))) };
      }
      if (nodeName(entry) === "giftDesc") {
        tooltip = entry;
        return node("Container", { name: "giftDescRemoved", visible: "false" });
      }
      return undefined;
    });
    // One positioned tooltip a card, drawn after the cards: under the top two rows, over the bottom two.
    if (tooltip) {
      const template = tooltip;
      definition = mapTree(definition, entry => nodeName(entry) !== "InnerCanvas" ? undefined : {
        ...entry, children: [...entry.children, ...Array.from({ length: PER_PAGE }, (_unused, index) => {
          const row = Math.floor(index / 2);
          const x = 1 + (index % 2) * (CARD.width + CARD.gapX);
          const top = row * (CARD.height + CARD.gapY);
          const y = row < 2 ? top + CARD.height + 4 : top - TOOLTIP_HEIGHT - 4;
          return { ...withAttributes(clone(template), { windowRect: undefined,
            leftTopWH: `${x} ${y} ${CARD.width} ${TOOLTIP_HEIGHT}`, name: `giftDesc${index}` }) };
        })],
      });
    }
    definition = await this.decorate(definition);
    const prepared = prepare(library, definition, ROOTS);
    const rows = new WeakMap<Node, number>();
    indexRows(prepared, "reward", rows);
    indexRows(prepared, "giftDesc", rows);
    if (this.disposed) return;
    const view = await te.load({
      library, root: this.options.root, definition: prepared, roots: ROOTS, smoothImages: true, modal: true,
      label: strings.get("rewardBox") ?? "奖励箱", onCancel: () => this.options.onClose(),
      state: (entry: Node) => this.state(entry, rows),
    }) as WindowView;
    if (this.disposed) {
      view.dispose();
      return;
    }
    this.view = view;
    view.show();
  }

  private async decorate(definition: Node): Promise<Node> {
    if (definition.name === "CaptionWindow") return await C8(this.options.library, definition, FOLDER) as Node;
    return { ...definition, children: await Promise.all(definition.children.map(child => this.decorate(child))) };
  }

  private state(entry: Node, rows: WeakMap<Node, number>): NodeState {
    const name = nodeName(entry);
    const row = rows.get(entry);
    if (row !== undefined) return this.cardState(name, row);
    switch (name) {
      case "garageWindow": return { text: this.strings.get("rewardBox") ?? "奖励箱" };
      case "cancelButton": return { label: "关闭", action: () => this.options.onClose() };
      case "Label": return paintText(this.strings.get("helpMessage")?.trim() ?? "", { size: 14, align: "center",
        color: "rgb(207,221,240)", outline: true, middle: true, lineGap: 6 });
      case "btnPageReceive": {
        const ids = Array.from({ length: PER_PAGE }, (_unused, index) => this.entry(index)?.id)
          .filter((id): id is number => id !== undefined);
        return { label: this.strings.get("pageReceive") ?? "领取本页道具", disabled: !ids.length || this.busy,
          action: () => void this.claim(ids) };
      }
      case "page": return { text: `${this.page + 1} / ${this.pages}` };
      case "prevPage": return this.page > 0 ? { label: "上一页", action: () => this.turn(-1) } : { label: "上一页" };
      case "nextPage": return this.page < this.pages - 1 ? { label: "下一页", action: () => this.turn(1) }
        : { label: "下一页" };
    }
    return {};
  }

  private cardState(name: string, index: number): NodeState {
    const reward = this.entry(index);
    if (/^reward\d$/.test(name)) return reward ? { visible: true, hoverRegion: `card${index}` } : { visible: false };
    if (/^giftDesc\d$/.test(name))
      return { visible: !!reward && this.view?.hoveredRegionId === `card${index}` };
    if (!reward) return {};
    switch (name) {
      case "lblGiftTitleBody": return { text: rewardTitle(reward) };
      case "pnlGiftBoxIcon": return { paint: (context: CanvasRenderingContext2D, rect: Rect) => {
        const icon = this.icons.icon(reward);
        if (icon) drawFitted(context, icon, rect, reward.currency ? 2 : 1);
      } };
      case "lblRider": return { text: this.strings.get("storagePeriod") ?? "保管时间" };
      case "lblRiderBody": return { text: storageLeft(reward.expiresAt, this.now()) };
      case "storageType": return { text: reward.currency ? "" : reward.days > 0
        ? (this.strings.get("storageDay") ?? "%d 天").replace("%d", String(reward.days)) : "永久" };
      case "btnReceive": return { label: `领取 ${rewardTitle(reward)}`, disabled: this.busy,
        action: () => void this.claim([reward.id]) };
      case "giftItemNameI": return { text: rewardTitle(reward) };
      case "lblReceivedTime": return { text: formatBoxTime(reward.createdAt) };
      case "lblMessage": return { text: reward.message };
      case "lblGiftDesc": return paintText(rewardDescription(reward), { size: 14, color: "white" });
    }
    return {};
  }

  private turn(step: number): void {
    this.page = Math.min(this.pages - 1, Math.max(0, this.page + step));
    this.options.onActivate?.();
    this.view?.render();
  }

  private notice(title: string, text: string): void {
    this.message?.abort();
    const abort = new AbortController();
    this.message = abort;
    void openMessengerMessage(this.options.library as never, this.options.root, title, text, {}, abort.signal)
      .catch(() => false);
  }

  private async claim(ids: number[]): Promise<void> {
    if (this.busy || this.disposed || !ids.length) return;
    this.busy = true;
    this.view?.render();
    try {
      const result = await this.options.api.claimRewardBox(ids);
      if (this.disposed) return;
      this.entries = result.entries;
      this.page = Math.min(this.page, this.pages - 1);
      this.options.onChanged?.(this.entries.length);
      this.notice(this.strings.get("receiveRewardItemSuccess") ?? "成功领取道具",
        claimedMessage(result.claimed.map(rewardTitle)));
    } catch (error) {
      if (this.disposed) return;
      this.notice(this.strings.get("receiveRewardItemFail") ?? "领取道具失败", menuErrorMessage(error));
      // Taken elsewhere or expired: show what is left.
      try {
        this.entries = (await this.options.api.rewardBox()).entries;
        this.page = Math.min(this.page, this.pages - 1);
        this.options.onChanged?.(this.entries.length);
      } catch { /* The page stays as it was. */ }
    } finally {
      this.busy = false;
      this.view?.render();
    }
  }
}
