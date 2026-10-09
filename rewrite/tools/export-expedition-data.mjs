#!/usr/bin/env node
// Export the 赛车探险队 (racing expedition) table the data service runs into
// server-go/internal/data/expedition/expedition.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-expedition-data.mjs            write expedition.json
//   node --import tsx tools/export-expedition-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-expedition-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   zeta_/cn/content/racingExpedition/racingExpeditionMission.xml
//       the weekly rules, bonus constants and tables, and the 94 missions
//   zeta_/cn/shop/data/stock.kml   the items of each mission's reward stock
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { parseStocks } from "./economy-export/shop-data.mjs";
import { expeditionRows } from "./expedition-export/expedition.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/expedition");

const SOURCES = {
  missions: "zeta_/cn/content/racingExpedition/racingExpeditionMission.xml",
  stocks: "zeta_/cn/shop/data/stock.kml",
};

const problems = [];
const problem = message => problems.push(message);

const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

const stocks = parseStocks(await parseXmlAt(SOURCES.stocks));
const rows = expeditionRows(await parseXmlAt(SOURCES.missions), stocks, problem);
if (problems.length > 0 || !rows) {
  for (const message of problems) console.error(`problem: ${message}`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `rewrite/tools/export-expedition-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.missions} (rules, bonus constants in thousandths, kart tuning by difficulty 1-5 in tenths of a percent, reinforced parts in reward points, missions) ` +
    `and the reward stocks' items from ${SOURCES.stocks}. Do not edit by hand.`,
  ...rows,
});
const file = path.join(outDir, "expedition.json");
if (checkOnly) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== document.text) {
    console.error("expedition.json stale; run tools/export-expedition-data.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, document.text);
}
console.log(`missions ${rows.missions.length}, reward stocks ${Object.keys(rows.rewardStocks).length}, ` +
  `kart tuning levels ${Object.keys(rows.kartTuning).length}, parts totals ${Object.keys(rows.parts).length}, ` +
  `version ${document.version}`);
