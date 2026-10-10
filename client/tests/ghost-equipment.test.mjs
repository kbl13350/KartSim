import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { ghostEquipmentFromKsv, ghostEquipmentProfile, ghostItemId } from
  "../src/timeattack/ghost-equipment.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
const source = name => {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node);
  return release.slice(node.start, node.end);
};
const defaultProfile = () => ({ name: "local",
  equipment: { itemIds: { 99: 123 } } });
const original = new Function("gr",
  `${source("zh0")}\n${source("U_")}\n${source("P3")}; return { zh0, U_, P3 };`)(
    defaultProfile);

test("modern and legacy KSV equipment projections match the release", () => {
  const modern = {
    character: 1, kart: 3, kartPaint: 2, characterColor: 70,
    plate: 4, goggle: 8, balloon: 9, headband: 11, cane: 16,
    equ2: 22, replay: 23, equ3: 24, apparel: 25, equ4: 26,
    plateText: "BLUE", startSlot: 4,
  };
  const legacy = { character: 1, kart: 3, paint: 70,
    plateText: "OLD", startSlot: 2 };
  for (const input of [modern, legacy]) {
    assert.deepEqual(ghostEquipmentFromKsv(input, "rider"),
      original.zh0(input, "rider"));
  }
  const normalized = ghostEquipmentFromKsv(modern, "rider");
  assert.deepEqual(ghostEquipmentProfile(normalized, defaultProfile),
    original.U_(normalized));
  for (const value of [undefined, 0, 34, -1, 1.25]) {
    let expected, actual;
    try { expected = original.P3(value); }
    catch (error) { expected = error.message; }
    try { actual = ghostItemId(value); }
    catch (error) { actual = error.message; }
    assert.deepEqual(actual, expected);
  }
});
