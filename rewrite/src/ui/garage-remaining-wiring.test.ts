import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("remaining Garage functions and catalog groups use readable modules", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageRemainingPrimitiveOverrides: string[];
    handwrittenGarageRemainingCatalogOverrides: string[];
  };
  const functions = new Map([
    ["Bt", "garageGameTypeAllowed"], ["Ni", "garagePartCategoryId"],
    ["_t", "garageStageLayout"], ["Fi", "garageAvailableVehicleFunctions"],
    ["xt", "garagePartCardLayoutForKind"], ["se", "garageNativeStatePath"],
    ["Ut", "garageExpectedProgressionKind"], ["Wi", "garagePartPresentation"],
    ["ht", "garageFactoryAbilityDraft"], ["Zt", "garageFactorySignature"],
    ["Ta", "garageClassicUpgradeLines"], ["Na", "garageNeedsLoadingLabel"],
    ["En", "garageShowMaxPart"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageRemainingPrimitiveOverrides,
    [...functions.keys()]);
  const catalog = new Map([
    ["Ai", "garageDefaultWidth"], ["Ve", "garageStageDirectory"],
    ["Ot", "garageFontPath"], ["ji", "garageDefaultPartFields"],
    ["Ji", "garageNativeRarityValues"], ["H", "garageRadarAttributes"],
    ["Ye", "garageExceedChoices"], ["It", "garageSidePanelInset"],
    ["ba", "garageResetPrompt"], ["Jt", "garageClassicUpgradeDirectory"],
    ["es", "garageXunUpgradeDirectory"], ["Oa", "garageSkillPanelPath"],
    ["ts", "garagePreparationDirectory"], ["Xa", "garageSkillDialogRect"],
    ["Ct", "garageXunSkillAttributes"], ["Se", "garageScoreFields"],
    ["Is", "garageXunPartScoreFields"], ["bn", "garageGradeKeys"],
    ["kn", "garageCardPageSize"], ["wt", "garageTuneSlotNodes"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageRemainingCatalogOverrides,
    [...catalog.keys()]);
  const ast = parse(generated, { sourceType: "module" });
  const declarations = new Map(ast.program.body.flatMap(node =>
    node.type === "FunctionDeclaration" ?
      [[node.id!.name, generated.slice(node.start!, node.end!)] as const] : []));
  for (const [name, implementation] of functions)
    assert.ok((declarations.get(name) ?? "").includes(`${implementation}(`), name);
  const variables = new Map(ast.program.body.flatMap(node =>
    node.type === "VariableDeclaration" ? node.declarations.flatMap(item =>
      item.id.type === "Identifier" ?
        [[item.id.name, generated.slice(node.start!, node.end!)] as const] : []) : []));
  for (const [name, implementation] of catalog)
    assert.match(variables.get(name) ?? "", new RegExp(`\\b${implementation}\\b`), name);
});
