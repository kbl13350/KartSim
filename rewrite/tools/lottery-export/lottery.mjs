// Rows of server-go/internal/data/lottery/lottery.json: the CN box table
// (zeta_/cn/lottery/lottery.xml). A box is a category-24 item; opening one
// draws a stock from the reward sets of its rewardList row in effect, with
// the reward's prob as a weight within its set.

import { beijingMillis } from "../career-export/dictionary.mjs";

const attr = (node, name) => node.attributes.find(item => item.name === name)?.value;

function integer(raw, label, problem, min = 0) {
  const value = Number(raw);
  if (raw === undefined || raw.trim() === "" || !Number.isSafeInteger(value) || value < min) {
    problem(`${label}: bad integer ${JSON.stringify(raw)}`);
    return undefined;
  }
  return value;
}

/** "from~to" Beijing times as Unix ms; "*" is open (0 from, 0 to). */
function period(text, label, problem) {
  const [from, to] = (text ?? "").split("~").map(part => part.trim());
  const start = from === "*" ? 0 : beijingMillis(from);
  const end = to === "*" ? 0 : beijingMillis(to);
  if (start === undefined || end === undefined) {
    problem(`${label}: bad period ${JSON.stringify(text)}`);
    return undefined;
  }
  return { from: start, to: end };
}

/**
 * The lotteries (by item id), their reward sets, the stocks they draw and
 * the names of every item involved (item.kml, "category:itemId").
 */
export function lotteryRows(root, stocks, itemNames, problem) {
  if (root.name !== "lotteryTable") problem(`lottery.xml root is ${root.name}`);
  const lotteries = [];
  const sets = {};
  const stockIds = new Set();
  const named = new Set();
  for (const node of root.children.filter(item => item.name === "lottery")) {
    const id = integer(attr(node, "id"), "lottery id", problem, 1);
    if (id === undefined) continue;
    const label = `lottery ${id}`;
    if (lotteries.some(other => other.id === id)) {
      problem(`${label} repeated`);
      continue;
    }
    for (const set of node.children.filter(item => item.name === "rewardSet")) {
      const setId = integer(attr(set, "id"), `${label} rewardSet`, problem, 1);
      if (setId === undefined) continue;
      const rewards = set.children.filter(item => item.name === "reward").flatMap(reward => {
        const stockId = integer(attr(reward, "stockId"), `rewardSet ${setId} stockId`, problem, 1);
        const weight = integer(attr(reward, "prob"), `rewardSet ${setId} prob`, problem);
        if (stockId === undefined || weight === undefined) return [];
        stockIds.add(stockId);
        const summary = Number(attr(reward, "summary") ?? 0);
        return [{ stockId, weight, ...(summary > 0 ? { summary } : {}) }];
      });
      // Boxes of one series repeat the same set under each box.
      if (setId in sets && JSON.stringify(sets[setId]) !== JSON.stringify(rewards))
        problem(`rewardSet ${setId} repeated with other rewards`);
      sets[setId] ??= rewards;
    }
    const lists = node.children.filter(item => item.name === "rewardList").flatMap(list => {
      const when = period(attr(list, "period"), `${label} rewardList`, problem);
      const refs = (attr(list, "refRewardSetId") ?? "").split(",").map(part => Number(part.trim()));
      if (!when || refs.some(ref => !Number.isSafeInteger(ref) || ref <= 0)) {
        problem(`${label}: bad rewardList`);
        return [];
      }
      return [{ ...when, sets: refs }];
    });
    const needOther = Number(attr(node, "needOther") ?? 0);
    const retry = Number(attr(node, "retryCount") ?? 0);
    const rpLimit = Number(attr(node, "rpLimit") ?? 0);
    const caption = attr(node, "dialogCaption")?.trim();
    const desc = attr(node, "dialogDesc")?.trim();
    lotteries.push({ id, lists,
      ...(caption ? { caption } : {}), ...(desc ? { desc } : {}),
      ...(needOther > 0 ? { needOther } : {}), ...(retry > 0 ? { retry } : {}),
      ...(rpLimit > 0 ? { rpLimit } : {}) });
    named.add(`24:${id}`);
    if (needOther > 0) named.add(`24:${needOther}`);
  }
  for (const lottery of lotteries)
    for (const list of lottery.lists)
      for (const ref of list.sets)
        if (!(ref in sets)) problem(`lottery ${lottery.id}: unknown rewardSet ${ref}`);
  const usedStocks = {};
  for (const stockId of [...stockIds].sort((a, b) => a - b)) {
    const stock = stocks.get(stockId);
    if (!stock || stock.items.length === 0) {
      problem(`lottery reward stock ${stockId} is not in stock.kml`);
      continue;
    }
    usedStocks[stockId] = stock.items;
    for (const item of stock.items) named.add(`${item.category}:${item.itemId}`);
  }
  const names = {};
  for (const key of [...named].sort()) {
    const name = itemNames.get(key);
    if (name) names[key] = name;
  }
  lotteries.sort((a, b) => a.id - b.id);
  return { lotteries, sets, stocks: usedStocks, names };
}
