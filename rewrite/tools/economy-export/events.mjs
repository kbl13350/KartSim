// The shop's tcCash event (zeta_/cn/content/tcCashEvent.xml, the stage_mqShop
// 累计消费 window) as server-go/internal/data/economy/events.json. Display
// only: the data service reports how many coupons (电池) an account spent in
// the event period but grants no reward.

/** Event kinds the export accepts: "use" is 累计消费 (spend). */
export const SPEND_EVENT_TYPE = "use";
/** Times in tcCashEvent.xml are Beijing time without an offset. */
export const BEIJING_OFFSET = "+08:00";

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * "2026-09-17T06:00:00~2026-10-15T05:59:59" -> {start, end} as ISO 8601 with
 * +08:00. Both ends are inclusive to the second, as the original writes them
 * (an end of 05:59:59 means until 06:00:00). Returns undefined when malformed
 * or open-ended.
 */
export function beijingPeriod(text) {
  const parts = (text ?? "").split("~").map(part => part.trim());
  if (parts.length !== 2 || !parts.every(part => LOCAL_TIME.test(part))) return undefined;
  const [start, end] = parts.map(part => `${part}${BEIJING_OFFSET}`);
  if (!(Date.parse(start) < Date.parse(end))) return undefined;
  return { start, end };
}

/**
 * events.json rows for the parsed tcCashEvent.xml events: periods in Beijing
 * time, steps in order with the reward stock resolved through stock.kml
 * (one item: name from item.kml, else the stock name; count and days of the
 * stock item). iconHint is the shop catalog kind when the reward is a
 * catalog item (e.g. "slotBg"), otherwise "etc" (materials and boxes the
 * shop does not sell).
 */
export function spendEvents(rawEvents, { stocks, shopItems, sellable, problem }) {
  return rawEvents.flatMap((raw, index) => {
    const label = `tcCashEvent ${index}`;
    const eventPeriod = beijingPeriod(raw.eventPeriod);
    const rewardPeriod = beijingPeriod(raw.rewardPeriod);
    if (raw.eventType !== SPEND_EVENT_TYPE) {
      problem(`${label}: eventType ${JSON.stringify(raw.eventType)}, only "${SPEND_EVENT_TYPE}" (累计消费) is supported`);
      return [];
    }
    if (!eventPeriod || !rewardPeriod) {
      problem(`${label}: periods ${raw.eventPeriod} / ${raw.rewardPeriod} must be closed "from~to" local times`);
      return [];
    }
    if (Date.parse(rewardPeriod.start) > Date.parse(eventPeriod.start) ||
        Date.parse(rewardPeriod.end) < Date.parse(eventPeriod.end))
      problem(`${label}: rewardPeriod ${raw.rewardPeriod} does not cover eventPeriod ${raw.eventPeriod}`);
    if (raw.steps.length === 0) problem(`${label}: no reward steps`);
    const steps = [...raw.steps].sort((a, b) => a.step - b.step).map((step, position, sorted) => {
      if (step.step !== position + 1) problem(`${label}: steps are not numbered 1..${sorted.length}`);
      if (position > 0 && step.value <= sorted[position - 1].value)
        problem(`${label}: step ${step.step} value ${step.value} does not exceed the previous step`);
      const stock = stocks.get(step.stockId);
      if (!stock) { problem(`${label} step ${step.step}: stock ${step.stockId} is not in stock.kml`); return undefined; }
      if (stock.items.length !== 1) {
        problem(`${label} step ${step.step}: stock ${step.stockId} grants ${stock.items.length} items, expected 1`);
        return undefined;
      }
      const [item] = stock.items;
      const key = `${item.category}:${item.itemId}`;
      const name = shopItems.get(key)?.name || stock.name;
      if (!name) problem(`${label} step ${step.step}: reward ${key} has no name`);
      return {
        step: step.step, value: step.value, stockId: step.stockId,
        reward: { name, category: item.category, itemId: item.itemId, count: item.count, days: item.days,
          iconHint: sellable.get(key)?.kind ?? "etc" },
      };
    }).filter(Boolean);
    return [{ eventType: raw.eventType, eventPeriod, rewardPeriod, steps }];
  });
}
