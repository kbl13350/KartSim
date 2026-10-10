import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage upgrade sessions and result dialog use readable classes", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  const sessions = new Map([
    ["qa", "GarageSkillSelectionState"],
    ["Qa", "GarageUpgradePreparationState"],
    ["Da", "GarageSkillSelectionDialog"],
    ["Tn", "GarageExceedTypeDialog"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageUpgradeSessionClassOverrides, [...sessions.keys()]);
  for (const [name, base] of sessions) {
    const cls = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === name);
    assert.ok(cls);
    assert.match(generated.slice(cls.start!, cls.end!), new RegExp(`extends ${base}`));
  }
  const result = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "Ra");
  assert.ok(result && result.type === "ClassDeclaration");
  const delegates = new Map([
    ["constructor", "initializeGarageUpgradeResult"],
    ["capturePreview", "captureGarageUpgradePreview"],
    ["render", "renderGarageUpgradeResult"],
    ["close", "closeGarageUpgradeResult"],
    ["dispose", "disposeGarageUpgradeResult"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageUpgradeResultOverrides, [...delegates.keys()]);
  for (const [name, delegate] of delegates) {
    const method = result.body.body.find(node => node.type === "ClassMethod" &&
      node.key.type === "Identifier" && node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!), new RegExp(`${delegate}\\(`));
  }
  const preparation = ast.program.body.find(node =>
    node.type === "ClassDeclaration" && node.id?.name === "Ja");
  assert.ok(preparation && preparation.type === "ClassDeclaration");
  const preparationDelegates = new Map([
    ["constructor", "initializeGaragePreparation"],
    ["selected", "selectedPreparationVehicle"],
    ["previewRect", "preparationPreviewRect"],
    ["previewCard", "preparationPreviewCard"],
    ["cards", "preparationCards"],
    ["place", "placePreparationControl"],
    ["label", "addPreparationLabel"],
    ["comparisonValue", "addPreparationComparisonValue"],
    ["button", "createPreparationButton"],
    ["decoratePageArrow", "decoratePreparationPageArrow"],
    ["cancelButton", "addPreparationCancelButton"],
    ["load", "loadGaragePreparation"],
    ["refresh", "refreshGaragePreparation"],
    ["resizeCanvases", "resizePreparationCanvases"],
    ["close", "closeGaragePreparation"],
    ["dispose", "disposeGaragePreparation"],
    ["clearPageFrameResources", "clearPreparationPageFrames"],
    ["draw", "drawGaragePreparation"],
  ]);
  assert.deepEqual(manifest.handwrittenGaragePreparationDialogOverrides,
    [...preparationDelegates.keys()]);
  assert.deepEqual(manifest.handwrittenGaragePreparationHelperOverrides,
    ["Za", "ss", "Ya", "en"]);
  for (const [name, delegate] of preparationDelegates) {
    const method = preparation.body.body.find(node =>
      node.type === "ClassMethod" && node.key.type === "Identifier" &&
      node.key.name === name);
    assert.ok(method, name);
    assert.match(generated.slice(method.start!, method.end!),
      new RegExp(delegate + "\\("));
  }
});
