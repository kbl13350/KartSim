import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage score, part, layout and preview helpers delegate to TypeScript", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageSupportBusinessOverrides: string[];
  };
  const expected = new Map([
    ["nn", "parseGarageFactoryAbilityScores"],
    ["ns", "parseGarageWeightTable"],
    ["gn", "parseGarageXunPartValues"],
    ["cs", "loadGarageScoreSource"],
    ["_i", "parseGarageEnchantSpecs"],
    ["Ls", "garagePartOrdinal"],
    ["Ns", "garageXunPartOrdinal"],
    ["$n", "garagePartDisplayName"],
    ["qt", "garagePartCardLayout"],
    ["Wa", "garagePreparationCardLayout"],
    ["An", "planGarageDrawOrder"],
    ["Fn", "loadGarageDefaultPreviews"],
    ["Mn", "bindGarageHoverPreview"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageSupportBusinessOverrides,
    [...expected.keys()]);
  const functions = new Map(parse(generated, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration")
    .map(node => [node.id!.name, generated.slice(node.start!, node.end!)]));
  for (const [name, implementation] of expected) {
    assert.match(generated, new RegExp(`\\b${implementation}\\b`), name);
    assert.ok((functions.get(name) ?? "").includes(`${implementation}(`), name);
  }
});
