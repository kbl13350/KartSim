import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage score and preview actions delegate to readable TypeScript", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageScoreBusinessOverrides: string[];
    handwrittenGarageViewFieldActionsOverrides: string[];
  };
  const scores = new Map([
    ["Me", "calculateGarageVehicleScores"],
    ["tn", "parseGarageSkillScoreTable"],
    ["ln", "parseGaragePartGradeGrid"],
    ["rs", "roundGarageScore"],
    ["_s", "projectGarageScoreField"],
    ["Nt", "garageScoreInteger"],
    ["ut", "scoreGarageBody"],
    ["cn", "inverseGaragePartScore"],
    ["hn", "garageGradeContains"],
    ["un", "combineGarageXunScores"],
    ["yn", "applyGarageLegacyParts"],
    ["sn", "garageXunSkillBonus"],
  ]);
  const actions = new Map([
    ["inventoryScroll", "createGarageInventoryScroll"],
    ["cancelPreview", "createGarageCancelPreviewButton"],
    ["removePart", "createGarageRemovePartButton"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageScoreBusinessOverrides,
    [...scores.keys()]);
  assert.deepEqual(manifest.handwrittenGarageViewFieldActionsOverrides,
    [...actions.keys()]);
  const ast = parse(generated, { sourceType: "module" });
  const functions = new Map(ast.program.body
    .filter(node => node.type === "FunctionDeclaration")
    .map(node => [node.id!.name, generated.slice(node.start!, node.end!)]));
  for (const [name, implementation] of scores)
    assert.match(functions.get(name) ?? "", new RegExp(`\\b${implementation}\\(`), name);
  const view = ast.program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const fields = new Map(view.body.body.flatMap(node =>
    node.type === "ClassProperty" && node.key.type === "Identifier" ?
      [[node.key.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, implementation] of actions)
    assert.match(fields.get(name) ?? "", new RegExp(`\\b${implementation}\\(`), name);
});
