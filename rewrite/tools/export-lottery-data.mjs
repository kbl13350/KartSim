#!/usr/bin/env node
// Export the lottery tables the data service draws from (server-go/LOTTERY.md:
// the 寻宝 board, the 精品道具场 and the box opening of 我的物品) into
// server-go/internal/data/lottery/lottery.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-lottery-data.mjs            write lottery.json
//   node --import tsx tools/export-lottery-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-lottery-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   zeta_/cn/lottery/lottery.xml          the 扭蛋 / 开箱 lotteries and their reward sets
//   zeta_/cn/content/treasureHunt.xml     the 寻宝 reward table (no probabilities: the
//                                         data service derives them, LOTTERY.md 3)
//   zeta_/cn/content/lotteryMileage.xml   lottery mileage (保底) prizes
//   zeta_/cn/shop/data/stock.kml          the items of every reward and pack stock
//   zeta_/cn/shop/data/item.kml           item names, descriptions and count items
//   server-go/internal/data/economy/catalog.json   names of shop items item.kml lacks
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { parseStocks } from "./economy-export/shop-data.mjs";
import { itemRows, lotteryRows, mileageRows, packRows, parseItemTable, stockRows,
  treasureHuntRows } from "./lottery-export/lottery.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/lottery");

const SOURCES = {
  lottery: "zeta_/cn/lottery/lottery.xml",
  treasureHunt: "zeta_/cn/content/treasureHunt.xml",
  mileage: "zeta_/cn/content/lotteryMileage.xml",
  stocks: "zeta_/cn/shop/data/stock.kml",
  items: "zeta_/cn/shop/data/item.kml",
};

const problems = [];
const warnings = [];
const problem = message => problems.push(message);
const warn = message => warnings.push(message);

const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

const [lotteryRoot, huntRoot, mileageRoot, stocks, items] = await Promise.all([
  parseXmlAt(SOURCES.lottery), parseXmlAt(SOURCES.treasureHunt), parseXmlAt(SOURCES.mileage),
  parseXmlAt(SOURCES.stocks).then(parseStocks), parseXmlAt(SOURCES.items).then(parseItemTable),
]);
const catalog = JSON.parse(readFileSync(path.join(projectRoot, "server-go/internal/data/economy/catalog.json"), "utf8"));

const { lotteries, rewardSets } = lotteryRows(lotteryRoot, { items, stocks, problem, warn });
const mileage = mileageRows(mileageRoot, { stocks, lotteries, problem, warn });
const treasureHunts = treasureHuntRows(huntRoot, { stocks, items, problem });
const packs = packRows(stocks, { lotteries, treasureHunts });

const stockIds = [
  ...rewardSets.flatMap(set => set.rewards.map(reward => reward.stockId)),
  ...mileage.flatMap(row => row.prizes.map(prize => prize.stockId)),
  ...treasureHunts.flatMap(hunt => hunt.rewards.map(reward => reward.stockId)),
  ...packs.map(pack => pack.stockId),
];
const stockTable = stockRows(stocks, stockIds, { items, problem });
const itemTable = itemRows(items);
const named = new Set(itemTable.map(item => `${item.category}:${item.itemId}`));
const catalogNamed = new Set(catalog.items.map(item => `${item.category}:${item.itemId}`));
for (const stock of stockTable)
  for (const item of stock.items) {
    const key = `${item.category}:${item.itemId}`;
    if (!named.has(key) && !catalogNamed.has(key) && !stock.name) problem(`stock ${stock.stockId}: item ${key} has no name`);
  }

const document = formatDocument({
  generatedFrom: `rewrite/tools/export-lottery-data.mjs over mirror/${manifest.version} revision ` +
    `${manifest.revision}: ${SOURCES.lottery} (lotteries keyed by their category-24 item, one reward drawn ` +
    `from each listed set by weight), ${SOURCES.treasureHunt}, ${SOURCES.mileage} (type lottery), on-sale packs ` +
    `of the materials from ${SOURCES.stocks}, names from ${SOURCES.items}. Periods are Beijing time. ` +
    "Do not edit by hand.",
  lotteries, rewardSets, mileage, treasureHunts, packs, stocks: stockTable, items: itemTable,
});

if (problems.length > 0) {
  for (const message of problems.slice(0, 50)) console.error(`problem: ${message}`);
  console.error(`${problems.length} problems`);
  process.exit(1);
}
const file = path.join(outDir, "lottery.json");
if (checkOnly) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== document.text) {
    console.error("lottery.json stale; run tools/export-lottery-data.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, document.text);
}
for (const message of warnings) console.log(`warning: ${message}`);
const rewards = rewardSets.reduce((sum, set) => sum + set.rewards.length, 0);
console.log(`lotteries ${lotteries.length} (${rewardSets.length} sets, ${rewards} rewards), ` +
  `mileage ${mileage.length}, treasure hunts ${treasureHunts.length} ` +
  `(${treasureHunts.reduce((sum, hunt) => sum + hunt.rewards.length, 0)} rewards), packs ${packs.length}, ` +
  `stocks ${stockTable.length}, items ${itemTable.length}, ${(document.text.length / 1024).toFixed(0)} KiB, ` +
  `version ${document.version}`);
