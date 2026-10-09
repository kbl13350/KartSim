#!/usr/bin/env node
// Export the box (开箱) table the data service draws from into
// server-go/internal/data/lottery/lottery.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-lottery-data.mjs            write lottery.json
//   node --import tsx tools/export-lottery-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-lottery-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   zeta_/cn/lottery/lottery.xml   the boxes (category-24 items), their reward
//                                  sets with weights and dated reward lists
//   zeta_/cn/shop/data/stock.kml   the items of each reward stock
//   zeta_/cn/shop/data/item.kml    the CN names of the boxes and rewards
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { parseShopItems, parseStocks } from "./economy-export/shop-data.mjs";
import { lotteryRows } from "./lottery-export/lottery.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/lottery");

const SOURCES = {
  lottery: "zeta_/cn/lottery/lottery.xml",
  stocks: "zeta_/cn/shop/data/stock.kml",
  items: "zeta_/cn/shop/data/item.kml",
};

const problems = [];
const problem = message => problems.push(message);

const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

const stocks = parseStocks(await parseXmlAt(SOURCES.stocks));
const items = parseShopItems(await parseXmlAt(SOURCES.items));
const names = new Map([...items].map(([key, item]) => [key, item.name]));
const rows = lotteryRows(await parseXmlAt(SOURCES.lottery), stocks, names, problem);
if (problems.length > 0) {
  for (const message of problems) console.error(`problem: ${message}`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `rewrite/tools/export-lottery-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.lottery} (periods as Unix ms, 0 = open; reward prob as a ` +
    `weight within its set), the reward stocks' items from ${SOURCES.stocks} and item names from ` +
    `${SOURCES.items}. Do not edit by hand.`,
  ...rows,
});
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
console.log(`lotteries ${rows.lotteries.length}, reward sets ${Object.keys(rows.sets).length}, ` +
  `stocks ${Object.keys(rows.stocks).length}, names ${Object.keys(rows.names).length}, ` +
  `${document.text.length} bytes, version ${document.version}`);
