#!/usr/bin/env node
// Export the My Room career (成就) and emblem (徽章) data the data service
// evaluates into server-go/internal/data/career/careers.json.
//
// Usage, from rewrite/:
//   node --import tsx tools/export-career-data.mjs            write careers.json
//   node --import tsx tools/export-career-data.mjs --check    exit 1 if it is stale
//   node --import tsx tools/export-career-data.mjs --out DIR  write elsewhere
//
// Sources (mirror/p3553, read through the browser's resource library):
//   etc_/career/newCareer@cn.xml   the CN career table of the new career window
//                                  (dialog2_newCareer); only the fields the
//                                  server needs to judge and reward a career
//                                  are kept, the client shows titles itself
//   etc_/emblem/emblem@cn.xml      the CN emblem ids
//   the time-attack track catalog  trackId -> career themeId (TrackThemeEntity)
//   zeta_/cn/content/itemDictionary.xml   the 道具图鉴 content -> dictionary.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";
import { careerRows, emblemIds, trackThemes } from "./career-export/careers.mjs";
import { dictionaryRows } from "./career-export/dictionary.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outIndex = args.indexOf("--out");
const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1] ?? "")
  : path.join(projectRoot, "server-go/internal/data/career");

const SOURCES = {
  careers: "etc_/career/newCareer@cn.xml",
  emblems: "etc_/emblem/emblem@cn.xml",
  dictionary: "zeta_/cn/content/itemDictionary.xml",
};

const problems = [];
const problem = message => problems.push(message);

const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;

const emblems = emblemIds(await parseXmlAt(SOURCES.emblems), problem);
const duplicates = [];
const careers = careerRows(await parseXmlAt(SOURCES.careers), new Set(emblems), problem, duplicates);
const themes = trackThemes(await library.timeAttackTrackCatalog(), problem);

const document = formatDocument({
  generatedFrom: `rewrite/tools/export-career-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.careers} (judging and reward fields only), ` +
    `${SOURCES.emblems} ids, and the time-attack track catalog themes as career themeIds. ` +
    "Do not edit by hand.",
  careers,
  emblems,
  trackThemes: themes,
});

const dictionary = dictionaryRows(await parseXmlAt(SOURCES.dictionary), problem);
const dictionaryDocument = formatDocument({
  generatedFrom: `rewrite/tools/export-career-data.mjs over mirror/${manifest.version} ` +
    `revision ${manifest.revision}: ${SOURCES.dictionary} (category lists in display order, kart engine grades, ` +
    "embargo dates as Unix ms, the reward per new item). Do not edit by hand.",
  ...dictionary,
});

if (problems.length > 0) {
  for (const message of problems) console.error(`problem: ${message}`);
  process.exit(1);
}
const outputs = [["careers.json", document], ["dictionary.json", dictionaryDocument]];
if (checkOnly) {
  const stale = outputs.filter(([name, doc]) => {
    const file = path.join(outDir, name);
    return !existsSync(file) || readFileSync(file, "utf8") !== doc.text;
  });
  if (stale.length) {
    console.error(`${stale.map(([name]) => name).join(", ")} stale; run tools/export-career-data.mjs`);
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  for (const [name, doc] of outputs) writeFileSync(path.join(outDir, name), doc.text);
}
if (duplicates.length > 0) console.log(`repeated career ids (first row kept): ${duplicates.join(", ")}`);
console.log(`careers ${careers.length}, emblems ${emblems.length}, ` +
  `track themes ${Object.keys(themes).length}, version ${document.version}; dictionary ` +
  `${dictionary.categories.reduce((sum, row) => sum + row.items.length, 0)} items in ` +
  `${dictionary.categories.length} categories, ${dictionary.embargo.length} embargo rows`);
