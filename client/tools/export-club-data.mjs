#!/usr/bin/env node
// Export the club marks and frames the data service checks into
// server-go/internal/data/club/club.json.
//
// Usage, from client/:
//   node --import tsx tools/export-club-data.mjs            write club.json
//   node --import tsx tools/export-club-data.mjs --check    exit 1 if it is stale
//
// Sources (mirror/p3553, read through the browser's resource library):
//   etc_/clubMark/clubMark@cn.xml               the 493 marks: club level, order, the 9 basic ones
//   etc_/clubMark/clubFrame/clubFrame@cn.xml    the frames by club level and the top-3 rank frames
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { clubRows } from "./club-export/club.mjs";
import { formatDocument } from "./economy-export/canonical.mjs";
import { loadResourceLibrary, parseNormalizedXml, uniqueBytes } from "./economy-export/resource-library.mjs";

const rewriteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(rewriteDir, "..");
const checkOnly = process.argv.includes("--check");
const outDir = path.join(projectRoot, "server-go/internal/data/club");
const SOURCES = { marks: "etc_/clubMark/clubMark@cn.xml", frames: "etc_/clubMark/clubFrame/clubFrame@cn.xml" };

const problems = [];
const { library, xml, manifest } = await loadResourceLibrary(projectRoot);
const parseXmlAt = async canonical =>
  parseNormalizedXml(xml.parseResourceXml, await uniqueBytes(library, canonical)).root;
const rows = clubRows(await parseXmlAt(SOURCES.marks), await parseXmlAt(SOURCES.frames),
  message => problems.push(message));
if (problems.length > 0) {
  for (const message of problems) console.error(`problem: ${message}`);
  process.exit(1);
}
const document = formatDocument({
  generatedFrom: `client/tools/export-club-data.mjs over mirror/${manifest.version} revision ${manifest.revision}: ` +
    `${SOURCES.marks} (marks) and ${SOURCES.frames} (frames). Do not edit by hand.`,
  ...rows,
});
const file = path.join(outDir, "club.json");
if (checkOnly) {
  if (!existsSync(file) || readFileSync(file, "utf8") !== document.text) {
    console.error("club.json stale; run tools/export-club-data.mjs");
    process.exit(1);
  }
} else {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(file, document.text);
}
console.log(`marks ${rows.marks.length}, frames ${rows.frames.length}, version ${document.version}`);
