import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import {
  CURRENT_SUMMARY_KEY,
  LEGACY_SUMMARY_KEY,
  commonGhostTimeBase,
  ghostExportFilename,
  makeGhostRecordKey,
  readGhostSummaryEntries,
  restoreGhostSummaries,
  safeGhostFilenamePart,
} from "../src/game/ghost-records.ts";

const source = readFileSync(
  fileURLToPath(new URL("../../recovered/formatted/index.js", import.meta.url)),
  "utf8",
);
const names = new Set(["LD", "V_", "N_", "Dh0", "Vh0", "O_"]);
const declarations = parse(source, { sourceType: "module" }).program.body
  .filter(node => node.type === "FunctionDeclaration" && names.has(node.id.name))
  .map(node => source.slice(node.start, node.end));
assert.equal(declarations.length, names.size, "all released Ghost helpers were found");

const entries = new Map();
const storage = {
  getItem(key) { return entries.get(key) ?? null; },
};
const context = { localStorage: storage };
runInNewContext(`
  const PD = ${JSON.stringify(CURRENT_SUMMARY_KEY)};
  const Fh0 = ${JSON.stringify(LEGACY_SUMMARY_KEY)};
  const Pt = { trackIdFromKey: key => key.split("\\0")[0] ?? "" };
  ${declarations.join("\n")}
  globalThis.reference = { LD, V_, N_, Dh0, Vh0, O_ };
`, context);
const reference = context.reference;
const plain = value => JSON.parse(JSON.stringify(value));

test("record keys, export filenames and sanitizer match the release", () => {
  const tracks = ["Village_R01", "ICE/S02", "山谷·终点", "a\0b", "  .  "];
  const names = [undefined, "车手", "a:b?c", "<>:\"/\\|?*", "...", " name . ", "\u0001\u001f"];
  const times = [undefined, -30.8, 0, 123456.9, NaN, Infinity];
  for (const track of tracks) {
    for (const version of ["国服", "国服复古", "韩服复古"]) {
      const key = makeGhostRecordKey(track, 7, 0, version);
      assert.equal(key, reference.LD(track, 7, 0, version));
      for (const name of names) {
        if (name !== undefined) assert.equal(safeGhostFilenamePart(name), reference.N_(name));
        for (const time of times) {
          assert.equal(ghostExportFilename(key, name, time), reference.V_(key, name, time));
        }
      }
    }
  }
});

test("mixed and missing Ghost time bases match the release", () => {
  const cases = [
    [],
    [{ timeBase: "countdown" }],
    [{ timeBase: "countdown" }, { timeBase: "countdown" }],
    [{ timeBase: "countdown" }, { timeBase: "elapsed" }],
    [{ timeBase: "countdown" }, {}],
    [{}, {}],
  ];
  for (const sources of cases) {
    assert.equal(commonGhostTimeBase(sources), reference.Dh0(sources));
  }
});

test("current summaries win over legacy and replay payloads migrate unchanged", () => {
  const current = [
    ["trackA\0speed", { elapsedMs: 1000, replay: { stamps: [1, 2] } }],
    ["trackB", { elapsedMs: 2000, hasGhost: false }],
  ];
  const legacy = [
    ["trackA\0speed", { elapsedMs: 5000, replay: { stamps: [3] } }],
    ["trackC", { elapsedMs: 3000, replay: { stamps: [4] } }],
  ];
  entries.set(CURRENT_SUMMARY_KEY, JSON.stringify(current));
  entries.set(LEGACY_SUMMARY_KEY, JSON.stringify(legacy));
  assert.deepEqual(
    plain(readGhostSummaryEntries(CURRENT_SUMMARY_KEY, storage)),
    plain(reference.O_(CURRENT_SUMMARY_KEY)),
  );
  assert.deepEqual(plain(restoreGhostSummaries(storage)), plain(reference.Vh0()));

  entries.delete(LEGACY_SUMMARY_KEY);
  assert.deepEqual(plain(restoreGhostSummaries(storage)), plain(reference.Vh0()));
  entries.delete(CURRENT_SUMMARY_KEY);
  assert.deepEqual(plain(restoreGhostSummaries(storage)), plain(reference.Vh0()));
});

test("invalid persisted summary shapes keep the released error", () => {
  for (const serialized of ["{}", "null", "broken json"]) {
    entries.set(CURRENT_SUMMARY_KEY, serialized);
    let actualError;
    let referenceError;
    try { restoreGhostSummaries(storage); } catch (error) { actualError = error; }
    try { reference.Vh0(); } catch (error) { referenceError = error; }
    assert.equal(actualError?.message, referenceError?.message);
  }
  entries.delete(CURRENT_SUMMARY_KEY);
});
