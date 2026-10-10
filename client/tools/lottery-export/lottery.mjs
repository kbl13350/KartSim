// Rows of server-go/internal/data/lottery/lottery.json: the original CN
// lottery (扭蛋 / 开箱) tables, the 寻宝 (treasure hunt) reward table, the
// lottery mileage (保底) prizes and the original packs that sell their
// materials. Pure functions over parsed resource nodes so the rules can be
// tested without the resource library.
//
// Sources (zeta_/cn): lottery/lottery.xml, content/treasureHunt.xml,
// content/lotteryMileage.xml, shop/data/stock.kml and shop/data/item.kml.

import { CURRENCY_BY_PRICE_TYPE, COUPON_PLACEHOLDER_MIN, EVENT_HOOK, HARMLESS_RESTRICTIONS,
  LUCCI_PLACEHOLDER_MIN, LUCCI_TOKEN_MAX } from "../economy-export/offers.mjs";

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

/** The category of the lottery items themselves (道具 that open a lottery). */
export const LOTTERY_CATEGORY = 24;

const LOCAL_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * "2026-07-16T06:00:00~2026-08-13T05:59:59" as {start, end} in ISO 8601
 * with +08:00 (Beijing time, both ends inclusive to the second). "*" leaves
 * an end open (omitted). Undefined when malformed.
 */
export function lotteryPeriod(text) {
  const parts = (text ?? "").split("~").map(part => part.trim());
  if (parts.length !== 2) return undefined;
  const period = {};
  for (const [index, part] of parts.entries()) {
    if (part === "*") continue;
    if (!LOCAL_TIME.test(part)) return undefined;
    period[index === 0 ? "start" : "end"] = `${part}+08:00`;
  }
  if (period.start && period.end && !(Date.parse(period.start) < Date.parse(period.end))) return undefined;
  return period;
}

function positiveInt(raw) {
  const value = Number((raw ?? "").trim());
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function nonNegativeInt(raw) {
  const value = Number((raw ?? "").trim());
  return (raw ?? "").trim() !== "" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

/**
 * item.kml rows with the fields the lottery screens show: name, itemEffect
 * (the 道具 description lines) and isAdditional (a count item).
 */
export function parseItemTable(root) {
  if (root.name !== "itemList") throw new Error(`item.kml root is ${root.name}`);
  const items = new Map();
  for (const node of root.children) {
    if (node.name !== "item") continue;
    const category = nonNegativeInt(attr(node, "itemCatId"));
    const itemId = nonNegativeInt(attr(node, "itemId"));
    if (category === undefined || itemId === undefined) continue;
    const key = `${category}:${itemId}`;
    if (items.has(key)) continue; // the first row wins, like parseShopItems
    items.set(key, {
      category, itemId,
      name: (attr(node, "itemName") ?? "").trim(),
      effect: (attr(node, "itemEffect") ?? "").trim(),
      count: (attr(node, "isAdditional") ?? "").trim().toLowerCase() === "true",
    });
  }
  return items;
}

/**
 * lottery.xml: every <lottery id> with its reward list (one rewardList: the
 * sets drawn, one reward from each) and the reward sets they reference.
 * Lotteries whose id is not a category-24 item in item.kml cannot be owned
 * and are skipped with a warning.
 */
export function lotteryRows(root, { items, stocks, problem, warn }) {
  if (root.name !== "lotteryTable") throw new Error(`lottery.xml root is ${root.name}`);
  const lotteries = [];
  const sets = new Map();
  const usedSets = new Set();
  for (const node of root.children) {
    if (node.name !== "lottery") continue;
    const itemId = positiveInt(attr(node, "id"));
    if (itemId === undefined) { problem(`lottery without a valid id`); continue; }
    const label = `lottery ${itemId}`;
    for (const child of node.children) {
      if (child.name !== "rewardSet") continue;
      const id = positiveInt(attr(child, "id"));
      if (id === undefined) { problem(`${label}: rewardSet without id`); continue; }
      const rewards = child.children.filter(reward => reward.name === "reward").map(reward => {
        const stockId = positiveInt(attr(reward, "stockId"));
        const weight = nonNegativeInt(attr(reward, "prob"));
        if (stockId === undefined || weight === undefined) {
          problem(`${label} set ${id}: reward ${attr(reward, "stockId")} prob ${attr(reward, "prob")}`);
          return undefined;
        }
        if (!stocks.has(stockId)) problem(`${label} set ${id}: stock ${stockId} is not in stock.kml`);
        else if (stocks.get(stockId).items.length === 0) problem(`${label} set ${id}: stock ${stockId} is empty`);
        const row = { stockId, weight };
        if ((attr(reward, "needToNotice") ?? "").trim() === "true") row.notice = true;
        const summary = positiveInt(attr(reward, "summary"));
        if (summary !== undefined) row.summary = summary;
        return row;
      }).filter(Boolean);
      const previous = sets.get(id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(rewards))
        problem(`rewardSet ${id} is defined twice with different rewards`);
      sets.set(id, rewards);
    }
    const lists = node.children.filter(child => child.name === "rewardList");
    if (lists.length !== 1) { problem(`${label}: ${lists.length} rewardLists, expected 1`); continue; }
    const period = lotteryPeriod(attr(lists[0], "period"));
    if (!period) problem(`${label}: period ${attr(lists[0], "period")}`);
    const refs = (attr(lists[0], "refRewardSetId") ?? "").split(",").map(part => positiveInt(part));
    if (refs.length === 0 || refs.some(ref => ref === undefined)) {
      problem(`${label}: refRewardSetId ${attr(lists[0], "refRewardSetId")}`);
      continue;
    }
    const item = items.get(`${LOTTERY_CATEGORY}:${itemId}`);
    if (!item) { warn(`${label} is not a category-${LOTTERY_CATEGORY} item; skipped`); continue; }
    const row = { itemId, name: item.name || (attr(node, "dialogCaption") ?? "").trim(), sets: refs };
    if (!row.name) problem(`${label}: no name`);
    const caption = (attr(node, "dialogCaption") ?? "").trim();
    if (caption && caption !== row.name) row.caption = caption;
    const desc = (attr(node, "dialogDesc") ?? "").trim();
    if (desc) row.desc = desc;
    if (item.effect) row.effect = item.effect;
    const dialog = (attr(node, "openDialog") ?? "").trim();
    if (dialog) row.dialog = dialog;
    if (period?.start) row.start = period.start;
    if (period?.end) row.end = period.end;
    // needOther is the key item consumed with each use (变形齿轮, 幸运车胎);
    // clientNeedOther names client-side display items and is not a key.
    // The box opening of 我的物品 (store OpenBox) keeps these original rules.
    const retry = positiveInt(attr(node, "retryCount"));
    if (retry !== undefined) row.retry = retry;
    const rpLimit = positiveInt(attr(node, "rpLimit"));
    if (rpLimit !== undefined) row.rpLimit = rpLimit;
    const key = positiveInt(attr(node, "needOther"));
    if (key !== undefined) {
      if (!items.has(`${LOTTERY_CATEGORY}:${key}`)) problem(`${label}: key item ${key} is not in item.kml`);
      row.key = key;
    }
    for (const ref of refs) usedSets.add(ref);
    lotteries.push(row);
  }
  for (const lottery of lotteries)
    for (const ref of lottery.sets)
      if (!sets.has(ref)) problem(`lottery ${lottery.itemId}: rewardSet ${ref} is not defined`);
  const rewardSets = [...sets].filter(([id]) => usedSets.has(id)).sort(([a], [b]) => a - b)
    .map(([id, rewards]) => {
      if (!rewards.some(reward => reward.weight > 0)) warn(`rewardSet ${id} has no reward with a weight`);
      return { id, rewards };
    });
  lotteries.sort((a, b) => a.itemId - b.itemId);
  return { lotteries, rewardSets };
}

/**
 * lotteryMileage.xml lotteries of type "lottery": points (one per use) and
 * the prizes they reach. bingoSet rows belong to the BINGO screen.
 */
export function mileageRows(root, { stocks, lotteries, problem, warn }) {
  if (root.name !== "lotteryMileage") throw new Error(`lotteryMileage.xml root is ${root.name}`);
  const known = new Set(lotteries.map(lottery => lottery.itemId));
  const rows = [];
  for (const node of root.children) {
    if (node.name !== "lottery" || attr(node, "type") !== "lottery") continue;
    const itemId = positiveInt(attr(node, "itemId"));
    const label = `mileage ${attr(node, "itemId")}`;
    if (itemId === undefined || Number(attr(node, "itemCatId")) !== LOTTERY_CATEGORY) {
      problem(`${label}: expected a category-${LOTTERY_CATEGORY} lottery`);
      continue;
    }
    if (!known.has(itemId)) { warn(`${label}: no such lottery; skipped`); continue; }
    const prizes = node.children.filter(child => child.name === "prize").map(prize => ({
      points: positiveInt(attr(prize, "points")), stockId: positiveInt(attr(prize, "stockId")),
    }));
    if (prizes.length === 0 || prizes.some(prize => !prize.points || !prize.stockId || !stocks.has(prize.stockId))) {
      problem(`${label}: invalid prizes`);
      continue;
    }
    prizes.sort((a, b) => a.points - b.points);
    if (new Set(prizes.map(prize => prize.points)).size !== prizes.length) problem(`${label}: repeated points`);
    const row = { itemId, prizes };
    const eventItemId = positiveInt(attr(node, "eventItemId"));
    if (eventItemId !== undefined) row.eventItemId = eventItemId;
    rows.push(row);
  }
  return rows.sort((a, b) => a.itemId - b.itemId);
}

/** treasureHunt.xml reward sets (寻宝): materials, theme and rewards. */
export function treasureHuntRows(root, { stocks, items, problem }) {
  if (root.name !== "TreasureHuntRewardTable") throw new Error(`treasureHunt.xml root is ${root.name}`);
  const rows = [];
  for (const node of root.children) {
    if (node.name !== "rewardSet") continue;
    const id = positiveInt(attr(node, "id"));
    const label = `treasureHunt ${attr(node, "id")}`;
    const period = lotteryPeriod(attr(node, "openPeriod"));
    const material = positiveInt(attr(node, "needMaterialId"));
    const eventMaterial = positiveInt(attr(node, "needEventMaterialId"));
    const otherMaterial = positiveInt(attr(node, "needOtherMaterialId"));
    const theme = (attr(node, "themeName") ?? "").trim();
    if (id === undefined || !period || !material || !otherMaterial || !theme) {
      problem(`${label}: id, openPeriod, materials and themeName are required`);
      continue;
    }
    // The materials are category-34 count items (寻宝放大镜, 幸运藏宝图).
    for (const materialId of [material, eventMaterial, otherMaterial].filter(Boolean))
      if (!items.get(`34:${materialId}`)?.count) problem(`${label}: material 34:${materialId} is not a count item`);
    const rewards = node.children.filter(child => child.name === "reward").map(reward => {
      const stockId = positiveInt(attr(reward, "stockId"));
      if (!stockId || !stocks.has(stockId)) { problem(`${label}: reward stock ${attr(reward, "stockId")}`); return undefined; }
      const row = { stockId };
      const summary = positiveInt(attr(reward, "summary"));
      if (summary !== undefined) row.summary = summary;
      const acquireCount = positiveInt(attr(reward, "acquireCount"));
      if (acquireCount !== undefined) row.acquireCount = acquireCount;
      if ((attr(reward, "effect") ?? "").trim() === "true") row.effect = true;
      return row;
    }).filter(Boolean);
    const summaries = rewards.filter(reward => reward.summary).map(reward => reward.summary).sort((a, b) => a - b);
    if (summaries.some((value, index) => value !== index + 1)) problem(`${label}: summary slots are not 1..${summaries.length}`);
    if (rewards.some(reward => reward.acquireCount && !reward.summary)) problem(`${label}: a 保底 reward has no summary slot`);
    if (new Set(rewards.map(reward => reward.stockId)).size !== rewards.length) problem(`${label}: repeated stock`);
    const row = { id, theme, material, otherMaterial, rewards };
    if (eventMaterial) row.eventMaterial = eventMaterial;
    if (period.start) row.start = period.start;
    if (period.end) row.end = period.end;
    const stockCardId = positiveInt(attr(node, "stockCardId"));
    if (stockCardId) row.stockCardId = stockCardId;
    rows.push(row);
  }
  return rows.sort((a, b) => a.id - b.id);
}

/** Why an original stock cannot be sold as a pack (offers.mjs stockRejection without the one-item rule). */
export function packRejection(stock) {
  if (!stock.isOnSale) return "notOnSale";
  if (stock.items.length === 0) return "empty";
  if (stock.price === undefined || stock.priceType === undefined) return "noPrice";
  if (!CURRENCY_BY_PRICE_TYPE.has(stock.priceType)) return `priceType${stock.priceType}`;
  if (stock.price <= 0) return "zeroPrice";
  if (stock.priceType === 1 && stock.price >= LUCCI_PLACEHOLDER_MIN) return "lucciPlaceholder";
  if (stock.priceType === 1 && stock.price <= LUCCI_TOKEN_MAX) return "lucciTokenPrice";
  if (stock.priceType === 0 && stock.price >= COUPON_PLACEHOLDER_MIN) return "couponPlaceholder";
  if (stock.isOnceADay) return "onceADay";
  if (EVENT_HOOK.test(stock.onBuyOk)) return "eventHook";
  if (stock.restriction && !stock.restriction.split("|").every(token => HARMLESS_RESTRICTIONS.has(token.trim())))
    return "restriction";
  if (stock.items.some(item => item.count < 1)) return "zeroCount";
  return undefined;
}

/**
 * The original on-sale packs of the lottery materials: stocks that contain a
 * lottery item or a treasure-hunt material, and stocks made only of a
 * lottery key item (幸运车胎). Bundled extras (balloons and the like) come
 * with the pack.
 */
export function packRows(stocks, { lotteries, treasureHunts }) {
  const lotteryItems = new Set(lotteries.map(lottery => `${LOTTERY_CATEGORY}:${lottery.itemId}`));
  const keys = new Set(lotteries.filter(lottery => lottery.key).map(lottery => `${LOTTERY_CATEGORY}:${lottery.key}`));
  const materials = new Set(treasureHunts.flatMap(hunt =>
    [hunt.material, hunt.eventMaterial, hunt.otherMaterial].filter(Boolean).map(id => `34:${id}`)));
  const packs = [];
  for (const stock of stocks.values()) {
    const keysOf = stock.items.map(item => `${item.category}:${item.itemId}`);
    const relevant = keysOf.some(key => lotteryItems.has(key) || materials.has(key)) ||
      (keysOf.length > 0 && keysOf.every(key => keys.has(key)));
    if (!relevant || packRejection(stock)) continue;
    packs.push({ stockId: stock.stockId, name: stock.name, currency: CURRENCY_BY_PRICE_TYPE.get(stock.priceType),
      price: stock.price, ...(stock.rpLimit > 0 ? { minExp: stock.rpLimit } : {}) });
  }
  return packs.sort((a, b) => a.stockId - b.stockId);
}

/** The stocks the document references, with their items. */
export function stockRows(stocks, ids, { items, problem }) {
  return [...new Set(ids)].sort((a, b) => a - b).map(stockId => {
    const stock = stocks.get(stockId);
    if (!stock) { problem(`stock ${stockId} is not in stock.kml`); return undefined; }
    for (const item of stock.items)
      if (item.days < 0 || item.count < 1) problem(`stock ${stockId}: item ${item.category}:${item.itemId} count ${item.count} days ${item.days}`);
    const row = { stockId, items: stock.items.map(item => ({ category: item.category, itemId: item.itemId,
      count: item.count, days: item.days })) };
    // The stock name names items item.kml lacks (categories 63-66).
    if (stock.items.some(item => !items.get(`${item.category}:${item.itemId}`)?.name) && stock.name) row.name = stock.name;
    return row;
  }).filter(Boolean);
}

/**
 * The names of every named item.kml row (the data service names rewards of
 * boxes, the 赛车探险队 and the lottery screens with them). count marks
 * count items (isAdditional); effect is kept for the lottery items and
 * materials the screens describe.
 */
export function itemRows(items) {
  const rows = [];
  for (const item of items.values()) {
    if (!item.name) continue;
    const row = { category: item.category, itemId: item.itemId, name: item.name };
    if (item.count) row.count = true;
    if (item.effect && (item.category === LOTTERY_CATEGORY || item.category === 34)) row.effect = item.effect;
    rows.push(row);
  }
  return rows.sort((a, b) => a.category - b.category || a.itemId - b.itemId);
}
