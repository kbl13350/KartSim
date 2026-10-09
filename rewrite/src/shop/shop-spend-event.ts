/**
 * The mall's 累计消费活动 (server-go/ECONOMY.md 3.4 and 6): GET
 * /api/shop/spend-event, strictly validated, drawn as the original
 * stage_mqShop tcCashEvent window (tcCashWindow@zz with one tcCashSlotCard
 * per step) at stage_window@cn tcCashWndPos, under the 充值 / 输入兑奖券
 * buttons.
 *
 * Display only: the data service grants no reward, so a reached step shows
 * the reached slot frame and nothing can be claimed. The window shows from
 * the event's start until its reward period ends (the service's display
 * period); after the event period, spending no longer counts and the steps
 * not reached show 活动结束. Anything unexpected (no event, an older service
 * without the endpoint, a malformed answer) hides the window.
 */
import type { AccountSession } from "../account/account-session";
import { kindIconMarkup } from "./shop-icons";
import {
  attr, find, SHOP_STRINGS, ShopLayout, TC_CASH_SLOT, TC_CASH_WINDOW, type ShopNode, type ShopRect,
} from "./shop-original";
import { BmlTree, element, place, setImageSeries, setText, setTexture } from "./shop-widgets";

export const SHOP_SPEND_EVENT_PATH = "/api/shop/spend-event";

export interface SpendEventReward {
  readonly name: string;
  readonly category: number;
  readonly itemId: number;
  readonly count: number;
  /** Rental days of the reward; 0 = permanent. */
  readonly days: number;
  /** The shop catalog kind when the reward is a catalog item, else "etc". */
  readonly iconHint: string;
}

export interface SpendEventStep {
  readonly step: number;
  /** 点券 spent in the event period that reaches this step. */
  readonly value: number;
  readonly stockId: number;
  readonly reward: SpendEventReward;
}

export interface SpendEventPeriod {
  /** ISO 8601 with its offset, as served (Beijing time). */
  readonly start: string;
  /** Inclusive to the second ("…05:59:59" lasts until 06:00:00). */
  readonly end: string;
  readonly startMs: number;
  /** The first millisecond after the period. */
  readonly endMs: number;
}

export interface SpendEvent {
  readonly eventType: "use";
  readonly eventPeriod: SpendEventPeriod;
  readonly rewardPeriod: SpendEventPeriod;
  readonly steps: readonly SpendEventStep[];
}

export interface SpendEventStatus {
  /** The event on display, or null when there is none. */
  readonly event: SpendEvent | null;
  /** 点券 the account spent in the event period. */
  readonly spent: number;
  /** Still in the event period (spending counts). */
  readonly active: boolean;
  /** The data service clock (Unix ms). */
  readonly serverTime: number;
}

/** A spend-event answer that does not have the agreed shape. */
export class SpendEventError extends Error {
  constructor(readonly path: string, detail: string) {
    super(`累计消费活动 ${path} ${detail}`);
    this.name = "SpendEventError";
  }
}

type Json = Record<string, unknown>;

function object(value: unknown, path: string): Json {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new SpendEventError(path, "必须是对象");
  return value as Json;
}

function integer(value: unknown, path: string, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum)
    throw new SpendEventError(path, `必须是不小于 ${minimum} 的整数`);
  return value;
}

function text(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new SpendEventError(path, "必须是非空字符串");
  return value;
}

/** ISO 8601 date and time with seconds and an explicit offset. */
const ISO_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

function instant(value: unknown, path: string): { iso: string; ms: number } {
  const iso = text(value, path);
  const match = ISO_TIME.exec(iso);
  const ms = match ? Date.parse(iso) : Number.NaN;
  if (!match || !Number.isFinite(ms)) throw new SpendEventError(path, "必须是带时区的 ISO 8601 时间");
  const [, , month, day, hour, minute, second] = match.map(Number) as number[];
  if (month! < 1 || month! > 12 || day! < 1 || day! > 31 || hour! > 23 || minute! > 59 || second! > 59)
    throw new SpendEventError(path, "时间无效");
  return { iso, ms };
}

function period(value: unknown, path: string): SpendEventPeriod {
  const raw = object(value, path);
  const start = instant(raw.start, `${path}.start`);
  const end = instant(raw.end, `${path}.end`);
  if (end.ms < start.ms) throw new SpendEventError(path, "结束早于开始");
  return { start: start.iso, end: end.iso, startMs: start.ms, endMs: end.ms + 1000 };
}

/** The window has room for this many steps on its 440-pixel bar. */
export const SPEND_EVENT_MAX_STEPS = 8;

function parseEvent(value: unknown): SpendEvent {
  const raw = object(value, "event");
  // Only 累计消费 exists here; 累计充值 has no counterpart (ECONOMY.md 3.4).
  if (raw.eventType !== "use") throw new SpendEventError("event.eventType", "必须是 use");
  const eventPeriod = period(raw.eventPeriod, "event.eventPeriod");
  const rewardPeriod = period(raw.rewardPeriod, "event.rewardPeriod");
  if (rewardPeriod.endMs < eventPeriod.endMs)
    throw new SpendEventError("event.rewardPeriod", "必须在活动结束之后结束");
  if (!Array.isArray(raw.steps) || !raw.steps.length || raw.steps.length > SPEND_EVENT_MAX_STEPS)
    throw new SpendEventError("event.steps", `必须是 1–${SPEND_EVENT_MAX_STEPS} 项的数组`);
  let previous: SpendEventStep | undefined;
  const steps = raw.steps.map((entry: unknown, index: number): SpendEventStep => {
    const path = `event.steps[${index}]`;
    const step = object(entry, path);
    const reward = object(step.reward, `${path}.reward`);
    const parsed: SpendEventStep = {
      step: integer(step.step, `${path}.step`, 1),
      value: integer(step.value, `${path}.value`, 1),
      stockId: integer(step.stockId, `${path}.stockId`, 0),
      reward: {
        name: text(reward.name, `${path}.reward.name`),
        category: integer(reward.category, `${path}.reward.category`, 1),
        itemId: integer(reward.itemId, `${path}.reward.itemId`, 0),
        count: integer(reward.count, `${path}.reward.count`, 1),
        days: integer(reward.days, `${path}.reward.days`, 0),
        iconHint: text(reward.iconHint, `${path}.reward.iconHint`),
      },
    };
    if (previous && (parsed.step <= previous.step || parsed.value <= previous.value))
      throw new SpendEventError(path, "步骤与数值必须递增");
    previous = parsed;
    return parsed;
  });
  return { eventType: "use", eventPeriod, rewardPeriod, steps };
}

/** Validates a parsed GET /api/shop/spend-event body {event, spent, active, serverTime}. */
export function parseSpendEventStatus(value: unknown): SpendEventStatus {
  const raw = object(value, "根");
  const spent = integer(raw.spent, "spent", 0);
  if (typeof raw.active !== "boolean") throw new SpendEventError("active", "必须是布尔值");
  if (typeof raw.serverTime !== "number" || !Number.isFinite(raw.serverTime) || raw.serverTime <= 0)
    throw new SpendEventError("serverTime", "必须是时间戳");
  const event = raw.event === null ? null : parseEvent(raw.event);
  return { event, spent, active: raw.active, serverTime: raw.serverTime };
}

/**
 * The event status, or undefined when there is nothing to show: no event,
 * a service without the endpoint (404), any failure or a malformed answer.
 */
export async function fetchSpendEvent(session: Pick<AccountSession, "authorizedFetch">,
  signal?: AbortSignal): Promise<SpendEventStatus | undefined> {
  try {
    const response = await session.authorizedFetch(SHOP_SPEND_EVENT_PATH, {
      method: "GET", headers: { Accept: "application/json" }, cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) return undefined;
    const status = parseSpendEventStatus(await response.json());
    return spendEventShown(status) ? status : undefined;
  } catch {
    return undefined;
  }
}

/** Shown from the event's start until its reward period ends. */
export function spendEventShown(status: SpendEventStatus): status is SpendEventStatus & { event: SpendEvent } {
  const event = status.event;
  return !!event && status.serverTime >= event.eventPeriod.startMs && status.serverTime < event.rewardPeriod.endMs;
}

/** "2026-9-17 6:00": the period's own wall clock (Beijing time), unpadded like the original. */
export function formatSpendEventTime(iso: string): string {
  const match = ISO_TIME.exec(iso);
  if (!match) return iso;
  const [, year, month, day, hour, minute] = match;
  return `${year}-${Number(month)}-${Number(day)} ${Number(hour)}:${minute}`;
}

/** tcCashEventPeriod: "活动期间 : 2026-9-17 6:00 ~ 2026-10-15 5:59". */
export function spendEventPeriodText(event: Pick<SpendEvent, "eventPeriod">): string {
  return SHOP_STRINGS.tcCashEventPeriod.replace("%s",
    `${formatSpendEventTime(event.eventPeriod.start)} ~ ${formatSpendEventTime(event.eventPeriod.end)}`);
}

/** The slot's caption: "10 个" (countFormat), "7 天" (periodFormat) or 无限制 (permanent). */
export function spendRewardLabel(reward: Pick<SpendEventReward, "count" | "days">): string {
  if (reward.count > 1) return SHOP_STRINGS.countFormat.replace("%d", String(reward.count));
  if (reward.days > 0) return SHOP_STRINGS.periodFormat.replace("%d", String(reward.days));
  return SHOP_STRINGS.unlimited;
}

/** Bar width: step i sits under the middle of its slot, whose right edge is at width·(i+1)/n. */
export function spendProgressWidth(steps: readonly Pick<SpendEventStep, "value">[], spent: number,
  width: number, slot: number): number {
  if (!steps.length || spent <= 0) return 0;
  const last = steps.at(-1)!.value;
  if (spent >= last) return width;
  let fromValue = 0, fromX = 0;
  for (let index = 0; index < steps.length; index++) {
    const toValue = steps[index]!.value;
    const toX = width * (index + 1) / steps.length - slot / 2;
    if (spent < toValue) return Math.round(fromX + (toX - fromX) * (spent - fromValue) / (toValue - fromValue));
    fromValue = toValue;
    fromX = toX;
  }
  return width;
}

/** A reward picture: the shop's item preview where it has one; returns its cleanup. */
export type SpendRewardPicture = (reward: SpendEventReward, host: HTMLElement) => (() => void) | void;

const WINDOW_RECT: ShopRect = { x: 0, y: 0, width: 550, height: 184 };
const WINDOW_LAYOUT = new ShopLayout(TC_CASH_WINDOW, WINDOW_RECT);

/** The node `node` sits in, under root. */
function parentOf(root: ShopNode, node: ShopNode): ShopNode | undefined {
  for (const child of root.children) {
    if (child === node) return root;
    const found = parentOf(child, node);
    if (found) return found;
  }
  return undefined;
}
const SLOT_RECT: ShopRect = { x: 0, y: 0, width: 80, height: 80 };
const SLOT_LAYOUT = new ShopLayout(TC_CASH_SLOT, SLOT_RECT);
/** tcCashEventTitle1@cn: 累计消费活动 (title0 is 累计充值活动). */
const TITLE_IMAGE = "tcCashEventTitle1@cn";

/** The tcCash window; hidden until a shown event is set. */
export class SpendEventPanel {
  readonly element: HTMLElement;
  private readonly tree = new BmlTree(WINDOW_LAYOUT);
  private readonly steps: HTMLElement;
  private cleanups: (() => void)[] = [];

  constructor(private readonly picture?: SpendRewardPicture) {
    const root = this.tree.element;
    root.classList.add("ks-shop-spend");
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", SHOP_STRINGS.tcCashEvent1);
    root.hidden = true;
    this.element = root;
    const title = this.tree.named("title");
    setTexture(title, TITLE_IMAGE);
    title.setAttribute("role", "heading");
    title.setAttribute("aria-level", "2");
    title.setAttribute("aria-label", SHOP_STRINGS.tcCashEvent1);
    setText(this.tree.named("tcCashPointStr"), SHOP_STRINGS.tcCashPoint1);
    this.steps = this.tree.named("stepWindow");
  }

  /** Where the window stands (stage_window tcCashWndPos), in its parent's pixels. */
  place(rect: ShopRect): void {
    place(this.element, { ...rect, width: WINDOW_RECT.width, height: WINDOW_RECT.height });
  }

  /** Shows the status, or hides the window (undefined or nothing to show). */
  render(status: SpendEventStatus | undefined): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    if (!status || !spendEventShown(status)) {
      this.element.hidden = true;
      this.steps.replaceChildren();
      return;
    }
    const { event, spent, active } = status;
    const tree = this.tree;
    this.element.hidden = false;
    this.element.dataset.active = String(active);
    setText(tree.named("period"), spendEventPeriodText(event));
    setText(tree.named("help"), active ? SHOP_STRINGS.tcCashEventHelp1 : SHOP_STRINGS.tcCashEventClose1);
    setText(tree.named("tcCashPoint"), String(spent));
    tree.named("tcCashPoint").setAttribute("aria-label", `${SHOP_STRINGS.tcCashPoint1} ${spent}`);
    const last = event.steps.at(-1)!.value;
    // The battery fills from the bottom; the bar runs under the slots.
    const fill = tree.named("pointProgress");
    const fillNode = find(TC_CASH_WINDOW, "pointProgress");
    const fillRect = WINDOW_LAYOUT.relative(fillNode, parentOf(TC_CASH_WINDOW, fillNode) ?? TC_CASH_WINDOW);
    const height = Math.round(fillRect.height * Math.min(1, spent / last));
    fill.hidden = height <= 0;
    fill.style.top = `${fillRect.y + fillRect.height - height}px`;
    fill.style.height = `${height}px`;
    // The texture keeps its size: the lower part of it shows (uv crop).
    fill.style.backgroundSize = `100% ${fillRect.height}px`;
    fill.style.backgroundPosition = "0 100%";
    const bar = tree.named("progressBar");
    const barWidth = WINDOW_LAYOUT.rect(find(TC_CASH_WINDOW, "progressBar")).width;
    const width = spendProgressWidth(event.steps, spent, barWidth, SLOT_RECT.width);
    bar.hidden = width <= 0;
    bar.style.width = `${width}px`;
    bar.style.backgroundSize = `${barWidth}px 100%`;
    const stepWidth = WINDOW_LAYOUT.rect(find(TC_CASH_WINDOW, "stepWindow")).width;
    this.steps.replaceChildren(...event.steps.map((step, index) =>
      this.renderStep(step, index, event.steps.length, stepWidth, spent, active)));
  }

  private renderStep(step: SpendEventStep, index: number, count: number, width: number,
    spent: number, active: boolean): HTMLElement {
    const slot = new BmlTree(SLOT_LAYOUT);
    const root = slot.element;
    root.classList.add("ks-shop-spend-step");
    const reached = spent >= step.value;
    root.dataset.reached = String(reached);
    // The slot's right edge is at width·(i+1)/n (tcCashSlotCard adjust "0 44").
    const rect = SLOT_LAYOUT.rect(TC_CASH_SLOT);
    root.style.left = `${Math.round(width * (index + 1) / count - rect.width)}px`;
    root.style.top = `${rect.y}px`;
    const button = slot.named("tcEventReward");
    setImageSeries(button, reached ? "shop_chargePoint_slot_c_" : "shop_chargePoint_slot_n_");
    (button as HTMLButtonElement).disabled = true;
    button.tabIndex = -1;
    const label = spendRewardLabel(step.reward);
    const status = reached ? "已达成" : active ? "未达成" : "活动结束";
    button.setAttribute("aria-label", `${step.value} ${step.reward.name} ${label} ${status}`);
    button.title = `${step.reward.name}（${label}）\n累计消费 ${step.value} 个电池${reached ? "，已达成" : ""}`;
    const item = slot.named("rewardStockItem");
    item.hidden = false;
    item.classList.add("ks-shop-spend-item");
    item.dataset.hint = step.reward.iconHint;
    const art = element("span", "ks-shop-art");
    art.insertAdjacentHTML("beforeend", kindIconMarkup(step.reward.iconHint));
    item.append(art);
    try {
      const cleanup = this.picture?.(step.reward, art);
      if (cleanup) this.cleanups.push(cleanup);
    } catch { /* The kind icon stays. */ }
    const caption = slot.named("rewardCount");
    caption.hidden = false;
    setText(caption, label);
    setText(slot.named("point"), String(step.value));
    slot.named("close").hidden = active || reached;
    for (const name of ["complete", "close"]) {
      const node = find(TC_CASH_SLOT, name);
      setTexture(slot.named(name), attr(node, "texture"));
    }
    slot.named("effect").hidden = true;
    return root;
  }

  dispose(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.element.remove();
  }
}
