#!/usr/bin/env node
// Export the 驾照考试 (rider school) table the data service judges into
// server-go/internal/data/license/license.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-license-data.mjs            write license.json
//   node --import tsx tools/export-license-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-license-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   etc_/riderSchool/riderSchool@cn.xml          the 42 mission steps (track, time limit, laps)
//   etc_/riderSchool/riderSchoolLocale@cn.xml    steps by license, names, reward stocks, PRO qualification
//   etc_/riderSchool/outRun/outRun<step>@zz.xml  the duel rivals and their .ksv ghosts
//   etc_/riderSchool/outRun/<ksv>.ksv            a rival's best time (the time to beat)
//   zeta_/cn/shop/data/stock.kml                 the items of each reward stock
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { parseStocks } from "./economy-export/shop-data.mjs";
import { licenseRows, localeRows, missionRows, outRunRow } from "./license-export/license.mjs";
import { ksvCompression } from "../src/codecs/ksv-compression.ts";
import { decodeKsvFile } from "../src/game/ghost/ksv-codec.ts";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/license");

const ROOT = "etc_/riderSchool";
const SOURCES = {
  missions: `${ROOT}/riderSchool@cn.xml`,
  locale: `${ROOT}/riderSchoolLocale@cn.xml`,
  outRun: step => `${ROOT}/outRun/outRun${step}@zz.xml`,
  ksv: name => `${ROOT}/outRun/${name}.ksv`,
  stocks: "zeta_/cn/shop/data/stock.kml",
};
const KSV_Z_CEILINGS = [1500, 3000];

const problems = [];
const problem = message => problems.push(message);

const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

function bestTimeMs(bytes) {
  let failure;
  for (const ceiling of KSV_Z_CEILINGS) {
    try {
      return decodeKsvFile(bytes, ceiling, ksvCompression).bestTimeMs;
    } catch (error) {
      failure = error;
    }
  }
  throw failure;
}

const missions = missionRows(await parseXmlAt(SOURCES.missions), problem);
const locale = localeRows(await parseXmlAt(SOURCES.locale), problem);
const stocks = parseStocks(await parseXmlAt(SOURCES.stocks));
const outRuns = new Map();
for (const mission of missions.values()) {
  if (mission.mission !== 21) continue;
  const outRun = outRunRow(await parseXmlAt(SOURCES.outRun(mission.step)), problem);
  try {
    outRun.rivalMs = bestTimeMs(new Uint8Array(await uniqueBytes(library, SOURCES.ksv(outRun.ksv))));
  } catch (error) {
    problem(`step ${mission.step}: ${outRun.ksv}.ksv: ${error instanceof Error ? error.message : error}`);
  }
  outRuns.set(mission.step, outRun);
}
const tracks = new Set(library.mapAssets().map(file =>
  path.posix.basename(path.posix.dirname(file.virtualPath)).replace(/^track_/, "").toLowerCase()));
const rows = licenseRows({ missions, locale, outRuns, stocks, tracks }, problem);
if (problems.length > 0) {
  for (const message of problems) console.error(`problem: ${message}`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `rewrite/tools/export-license-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.missions} (steps), ${SOURCES.locale} (licenses, names, ` +
    `reward stocks, PRO qualification), ${ROOT}/outRun (duel rivals; rivalMs is the .ksv best time) ` +
    `and the reward stocks' items from ${SOURCES.stocks}. Do not edit by hand.`,
  ...rows,
});
const file = path.join(outDir, "license.json");
if (checkOnly) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== document.text) {
    console.error("license.json stale; run tools/export-license-data.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, document.text);
}
console.log(`licenses ${rows.licenses.length}, steps ${rows.licenses.reduce((sum, license) => sum + license.steps.length, 0)}, ` +
  `reward stocks ${Object.keys(rows.rewardStocks).length}, version ${document.version}`);
