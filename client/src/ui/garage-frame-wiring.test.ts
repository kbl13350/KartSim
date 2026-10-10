import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage view delegates construction, actions and frame rendering", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const view = ast.program.body.find(node => node.type === "ClassDeclaration" && node.id?.name === "As");
  assert.ok(view && view.type === "ClassDeclaration");
  const groups = {
    handwrittenGarageViewConstructionOverrides: new Map([
      ["constructor", "initializeGarageView"],
    ]),
    handwrittenGarageViewActionsOverrides: new Map([
      ["serial", "garageSelectedKartSerial"],
      ["speedVersion", "garageSpeedVersion"],
      ["base", "garageBaseSpecification"],
      ["baseFor", "garageBaseForKart"],
      ["partLabel", "garagePartLabel"],
      ["rehitTestInventoryPreview", "rehitGarageInventoryPreview"],
      ["showFactoryTutorial", "showGarageFactoryTutorial"],
      ["onKey", "handleGarageEscapeKey"],
    ]),
    handwrittenGarageFrameCanvasOverrides: new Map([
      ["captureStrengtheningStage", "captureGarageStrengtheningStage"],
      ["captureStage", "captureGarageStage"],
      ["finishCanvasFrame", "finishGarageCanvasFrame"],
      ["paintTaskbar", "paintGarageTaskbar"],
      ["authoredPointerY", "garageAuthoredPointerY"],
      ["drawKartCatalogFrame", "drawGarageKartCatalogFrame"],
      ["drawKartLevelBadge", "drawGarageKartLevelBadge"],
    ]),
    handwrittenGarageStrengtheningOverlayOverrides: new Map([
      ["renderStrengtheningOverlay", "renderGarageStrengtheningOverlay"],
    ]),
    handwrittenGarageFrameRenderOverrides: new Map([
      ["frame", "renderGarageFrame"],
    ]),
    handwrittenGaragePreviewInputOverrides: new Map([
      ["createTransformPreviewButton", "createGarageTransformPreviewButton"],
      ["onDragStart", "startGaragePreviewDrag"],
      ["onDragMove", "moveGaragePreviewDrag"],
      ["onDragEnd", "endGaragePreviewDrag"],
    ]),
  };
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  for (const [field, delegates] of Object.entries(groups)) {
    assert.deepEqual(manifest[field], [...delegates.keys()]);
    for (const [name, delegate] of delegates) {
      const member = view.body.body.find(node =>
        (node.type === "ClassMethod" || node.type === "ClassProperty") &&
        node.key.type === "Identifier" && node.key.name === name);
      assert.ok(member, name);
      assert.match(generated.slice(member.start!, member.end!), new RegExp(`${delegate}\\(`));
    }
  }
});
