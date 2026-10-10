/**
 * Pure helpers of the lottery screens: item and pack lines, periods, the
 * original #sb strings with their %d / %s / [color] markup, and what a draw
 * result means for the screen (holdings, notices).
 */
import type { Currency } from "../account/account-session";
import { CURRENCY_LABELS, formatAmount } from "../shop/shop-model";
import type { DrawResult, LotteryActivity, LotteryItem, LotteryPack } from "./lottery-api";

/** "天蝎 迅", "测试气球 ×10", "测试角色（30天）", "酷币 ×5". */
export function itemLine(item: Pick<LotteryItem, "name" | "count" | "days" | "currency">): string {
  const name = item.name || "道具";
  const count = item.count > 1 || item.currency ? ` ×${formatAmount(item.count)}` : "";
  const days = item.days > 0 ? `（${item.days}天）` : "";
  return `${name}${count}${days}`;
}

/** A reward's items on one line. */
export function itemsLine(items: readonly LotteryItem[]): string {
  return items.map(itemLine).join(" + ");
}

/** "47 点券". */
export function packPrice(pack: Pick<LotteryPack, "price" | "currency">): string {
  return `${formatAmount(pack.price)} ${CURRENCY_LABELS[pack.currency]}`;
}

/** Whether the wallet covers a pack. */
export function affordable(pack: Pick<LotteryPack, "price" | "currency">,
  wallet: Readonly<Record<Currency, number>> | undefined): boolean {
  return !!wallet && wallet[pack.currency] >= pack.price;
}

function day(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}

/**
 * The 使用期 line of an activity: "2026.10.1 ~ 2026.10.22", "2026.10.1开始",
 * "2026.10.22截止" (the original periodFormatBegin / periodFormat), or ""
 * when it never ends.
 */
export function periodLine(activity: Pick<LotteryActivity, "start" | "end">): string {
  if (activity.start !== undefined && activity.end !== undefined)
    return `${day(activity.start)} ~ ${day(activity.end - 1000)}`;
  if (activity.start !== undefined) return `${day(activity.start)}开始`;
  if (activity.end !== undefined) return `${day(activity.end - 1000)}截止`;
  return "";
}

/** "1.0000%"-style text of a parts-per-million chance, trimmed: "0.0666%". */
export function chanceText(ppm: number): string {
  const percent = ppm / 10_000;
  if (percent >= 1) return `${percent.toFixed(2).replace(/\.?0+$/, "")}%`;
  return `${percent.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

/**
 * Fills an original string: "%d"/"%s" in order (the release's sprintf),
 * "%1!s!" style positions, and drops [color:…]…[/color] markup; "|" stays a
 * line break for setText.
 */
export function fillString(template: string, ...values: Array<string | number>): string {
  let next = 0;
  return template
    .replace(/%(\d)!s!/g, (_whole, index: string) => String(values[Number(index) - 1] ?? ""))
    .replace(/%[ds]/g, () => String(values[next++] ?? ""))
    .replace(/\[color:[^\]]*\]|\[\/color\]/g, "");
}

/** Counts of the screen's items after a draw ("category:itemId"). */
export function holding(result: Pick<DrawResult, "holdings">, category: number, itemId: number): number | undefined {
  return result.holdings.get(`${category}:${itemId}`);
}

/** Why a request stopped, for the notice line; undefined when it did not. */
export function stopMessage(result: Pick<DrawResult, "stopped" | "draws">): string | undefined {
  const stopped = result.stopped;
  if (!stopped) return undefined;
  const name = stopped.item?.name ?? "道具";
  switch (stopped.code) {
    case "INSUFFICIENT_ITEMS":
      return result.draws.length > 0 ? `${name}不足，已停止。` : `${name}持有数量不足，无法使用。`;
    case "ALREADY_OWNED":
      // The original 您已持有该道具，请重新尝试 (lotteryExceedTrialCount): nothing of that use was spent.
      return `抽到了已永久持有的「${name}」，本次未消耗道具，请重新尝试。`;
    case "LOTTERY_EMPTY":
      return "这个抽奖道具目前没有可抽取的奖励。";
    default:
      return `已停止（${stopped.code}）。`;
  }
}

/** Every item a result granted: the draws then the mileage prizes. */
export function grantedItems(result: Pick<DrawResult, "draws" | "prizes">): LotteryItem[] {
  return [...result.draws.flatMap(draw => draw.items), ...result.prizes.flatMap(prize => prize.items)];
}
