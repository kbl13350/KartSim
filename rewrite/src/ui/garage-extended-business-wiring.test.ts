import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage extended business and native catalog use readable modules", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageExtendedBusinessOverrides: string[];
    handwrittenGarageNativeCatalogOverrides: string[];
  };
  const functions = new Map([
    ["an", "loadGarageSkillScores"], ["rn", "loadGarageFactoryScores"],
    ["as", "applyGarageFactoryScores"], ["on", "normalizeGarageBodyScore"],
    ["dn", "garageScoreGrade"], ["wn", "garageScoreTrend"],
    ["zi", "garageAssetsForWidth"], ["Wt", "garageUpgradeAssetsForMode"],
    ["Ts", "garageDialogAssets"], ["Ha", "garageDialogAssets"],
    ["bt", "garageKartCardsRect"], ["Dt", "garagePartsGridRect"],
    ["Ss", "garagePartIconKey"], ["Pn", "isGarageMaxXunPart"],
    ["Ln", "garagePageOverlayNames"], ["he", "styleGarageActionButton"],
    ["xa", "garagePointerPresence"], ["La", "garageXunUpgradeRows"],
    ["Qe", "garagePair"], ["We", "garageArrowColor"],
    ["gt", "garageNumericTuple"], ["Aa", "garageUpgradeAnimationPhase"],
    ["Gi", "garageKartCardRect"], ["st", "garageInsetRect"],
    ["fa", "garageSecondInsetRect"], ["ma", "garageBetweenRects"],
    ["wa", "garageExtendRect"], ["ue", "garageLayoutForEngineGrade"],
    ["pe", "garageProgressionKind"], ["Xi", "previewGaragePart"],
    ["Ge", "garageText"], ["pt", "garageEngineName"],
    ["ft", "garageGradeName"], ["Et", "garagePartQuality"],
    ["Sn", "garagePartCardBackground"], ["In", "garageKartTypeTexture"],
    ["Nn", "garagePageBackground"],
    ["ds", "garageShowsVehicleInformation"],
    ["mt", "garageAllowsEquipment"], ["Rn", "garagePreviewHitTest"],
    ["ee", "garageRadarFinite"], ["ye", "garageRadarAttribute"],
    ["ha", "garageRadarBaseline"], ["ua", "garageExceedChoice"],
    ["is", "garageSkillScoreInteger"], ["xe", "garageFiniteScore"],
    ["re", "garageScoreNumber"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageExtendedBusinessOverrides,
    [...functions.keys()]);
  const catalog = new Map([
    ["Q", "garagePartCategoryIds"],
    ["Ii", "garageEnchantScoreFields"],
    ["Es", "garageVehicleFunctions"],
    ["Ki", "garageLayoutProfiles"],
    ["Vt", "garageSkillTextures"],
    ["Fa", "garageSkillDirectory"],
    ["tt", "garageFactoryAbilityAttributes"],
    ["pn", "garageScoreFieldBySlot"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageNativeCatalogOverrides,
    ["Q", "Ii", "ne", "Ki", "Vt", "Fa", "tt", "pn"]);
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
