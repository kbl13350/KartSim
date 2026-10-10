// Level table and level-up koin rewards (server-go/ECONOMY.md 1).
import { attr } from "./shop-data.mjs";

/** etc_/level/leveltable@cn.xml: <Levels rpLimit><Level nextRp tryLevel glove name/>... */
export function parseLevelTable(root) {
  if (root.name !== "Levels") throw new Error(`leveltable root is ${root.name}`);
  const rpLimit = Number(attr(root, "rpLimit"));
  if (!Number.isSafeInteger(rpLimit) || rpLimit <= 0) throw new Error("leveltable rpLimit invalid");
  const rows = root.children.filter(node => node.name === "Level");
  const levels = rows.map((node, level) => {
    const raw = attr(node, "nextRp");
    const last = level === rows.length - 1;
    if ((raw === undefined) !== last)
      throw new Error(`level ${level}: nextRp must be present on every level except the last`);
    const nextExp = raw === undefined ? undefined : Number(raw.trim());
    if (nextExp !== undefined && (!Number.isSafeInteger(nextExp) || nextExp <= 0))
      throw new Error(`level ${level}: nextRp ${raw} invalid`);
    const glove = (attr(node, "glove") ?? "").trim();
    const gloveName = (attr(node, "name") ?? "").trim();
    const tryLevel = Number(attr(node, "tryLevel"));
    if (!glove || !gloveName || !Number.isInteger(tryLevel))
      throw new Error(`level ${level}: glove/name/tryLevel missing`);
    return nextExp === undefined
      ? { level, glove, gloveName, tryLevel }
      : { level, nextExp, glove, gloveName, tryLevel };
  });
  for (let index = 1; index < levels.length - 1; index++) {
    if (levels[index].nextExp <= levels[index - 1].nextExp)
      throw new Error(`level ${index}: nextRp not increasing`);
  }
  if (rpLimit <= levels.at(-2).nextExp) throw new Error("rpLimit below the last threshold");
  return { rpLimit, levels };
}

const KOIN_CATEGORY = 56; // itemTable kind "money" (酷币 / Koin)

/**
 * Koin per level from etc_/level/levelupreward@cn.xml. Each <Level curLevel>
 * lists stock ids; a stock whose items are all category 56 grants koin equal
 * to the summed itemCount (stock.kml). The Korean/Chinese comment on the same
 * line ("酷币 (20个)") is cross-checked; a comment alone is used only when the
 * stock is missing from stock.kml.
 */
export function koinRewardsFromData(rewardText, stocks) {
  const rewards = {};
  const issues = [];
  let current;
  for (const line of rewardText.split(/\r?\n/)) {
    const level = /<Level\s[^>]*curLevel\s*=\s*['"]\s*(\d+)\s*['"]/.exec(line);
    if (level) current = Number(level[1]);
    const stock = /<stock\s[^>]*stockId\s*=\s*['"]\s*(\d+)\s*['"]/.exec(line);
    if (!stock || current === undefined) continue;
    const stockId = Number(stock[1]);
    const commentAmount = /酷币\s*\(?\s*(\d+)/.exec(line);
    const entry = stocks.get(stockId);
    let amount;
    if (entry) {
      if (entry.items.length > 0 && entry.items.every(item => item.category === KOIN_CATEGORY))
        amount = entry.items.reduce((sum, item) => sum + item.count, 0);
      if (commentAmount && amount !== Number(commentAmount[1]))
        issues.push(`level ${current} stock ${stockId}: stock.kml koin ${amount ?? 0} != comment ${commentAmount[1]}`);
    } else if (commentAmount) {
      amount = Number(commentAmount[1]);
      issues.push(`level ${current} stock ${stockId}: missing from stock.kml, used comment ${amount}`);
    }
    if (amount !== undefined && current > 0) rewards[current] = (rewards[current] ?? 0) + amount;
  }
  return { rewards, issues };
}

/**
 * ECONOMY.md 1 table, used only if levelupreward@cn.xml yields nothing and
 * otherwise as a cross-check: 20 at levels 3, 9, ... 105 (= 3 mod 6) and at
 * 109, 30 at 115, 50 at 121 (21 levels).
 */
export function koinRewardsByRule(maxLevel) {
  const rewards = {};
  for (let level = 1; level <= maxLevel; level++) {
    if (level === 115) rewards[level] = 30;
    else if (level === 121) rewards[level] = 50;
    else if ((level <= 105 && level % 6 === 3) || level === 109) rewards[level] = 20;
  }
  return rewards;
}

export function diffRewards(a, b) {
  const levels = [...new Set([...Object.keys(a), ...Object.keys(b)])].map(Number).sort((x, y) => x - y);
  return levels.filter(level => a[level] !== b[level])
    .map(level => `L${level}: data ${a[level] ?? 0} / rule ${b[level] ?? 0}`);
}
