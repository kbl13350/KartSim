import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage chunk routes model, radar and upgrade metadata to readable modules", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageTopLevelBusinessOverrides: string[];
  };
  const expected = new Map([
    ["Yi", "garagePartModelDuration"], ["Zi", "createGaragePartCamera"],
    ["Je", "loadGaragePartModelScene"], ["la", "calculateGarageRadar"],
    ["Yt", "garageRadarPoint"], ["ga", "drawGarageRadar"],
    ["ea", "parseGarageTuneAbilities"], ["ta", "parseGarageExceedTypes"],
    ["sa", "parseGarageExceedChangeRules"],
    ["oa", "parseGarageRadarInput"], ["ca", "parseGarageRadarWeights"],
    ["da", "loadGarageRadarParameters"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageTopLevelBusinessOverrides,
    [...expected.keys()]);
  const functions = new Map(parse(generated, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration")
    .map(node => [node.id!.name, generated.slice(node.start!, node.end!)]));
  for (const [name, implementation] of expected)
    assert.match(functions.get(name) ?? "", new RegExp(`\\b${implementation}\\(`), name);
});
