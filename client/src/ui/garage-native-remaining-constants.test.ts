import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import * as catalog from "./garage-native-remaining-constants";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const names = new Set(["Ai", "Ve", "Ot", "ji", "Ji", "H", "Ye", "It",
  "ba", "Jt", "es", "Oa", "ts", "Xa", "Ct", "Se", "Is", "bn",
  "kn", "wt"]);
const declarations = parse(release, { sourceType: "module" }).program.body
  .filter(node => node.type === "VariableDeclaration" &&
    node.declarations[0]?.id.type === "Identifier" &&
    names.has(node.declarations[0].id.name));
assert.equal(declarations.length, names.size);
const originalSource = declarations.map(node => release.slice(node.start!, node.end!))
  .join("\n");
const original = new Function(`${originalSource}\nreturn {
  Ai,Mi,Ve,Ze,Di,Oi,zt,ji,Ji,et,aa,na,ra,Ye,It,pa,ba,Jt,es,_a,Ia,
  Oa,ts,dt,Va,Xa,Ct,Pt,Se,Lt,Is,bn,xn,Cn,kn,_n,wt
};`)() as Record<string, unknown>;

test("remaining native Garage tables, paths and layout constants match release", () => {
  const expected: Record<string, unknown> = {
    Ai: catalog.garageDefaultWidth,
    Mi: catalog.garageStageSizes,
    Ve: catalog.garageStageDirectory,
    Ze: catalog.garageLampTexture,
    Di: catalog.garageFontPath,
    Oi: catalog.garageFontResource,
    zt: catalog.garageFontFamily,
    ji: catalog.garageDefaultPartFields,
    Ji: catalog.garageNativeRarityValues,
    et: catalog.garageRadarAttributes,
    aa: catalog.garageRadarDescriptionKeys,
    na: catalog.garageRadarCaptions,
    ra: catalog.garageRadarSkillFields,
    Ye: catalog.garageExceedChoices,
    It: catalog.garageSidePanelInset,
    pa: catalog.garageSidePanelInnerInset,
    ba: catalog.garageResetPrompt,
    Jt: catalog.garageClassicUpgradeDirectory,
    es: catalog.garageXunUpgradeDirectory,
    _a: catalog.garageXunUpgradeStages,
    Ia: catalog.garageXunUpgradeStageLabels,
    Oa: catalog.garageSkillPanelPath,
    ts: catalog.garagePreparationDirectory,
    dt: catalog.garagePreparationCardDirectory,
    Va: catalog.garagePreparationImages,
    Xa: catalog.garageSkillDialogRect,
    Ct: catalog.garageXunSkillAttributes,
    Pt: catalog.zeroGarageXunSkillScore(),
    Se: catalog.garageScoreFields,
    Lt: catalog.garageScoreWeightLengths,
    Is: catalog.garageXunPartScoreFields,
    bn: catalog.garageGradeKeys,
    xn: catalog.garagePartSlotKeys,
    Cn: catalog.garageGradeFallbacks,
    kn: catalog.garageCardPageSize,
    _n: catalog.garageRemovePartRect,
    wt: catalog.garageTuneSlotNodes,
  };
  for (const [name, actual] of Object.entries(expected)) {
    const reference = name === "Pt" ?
      (original.Pt as () => unknown)() : original[name];
    assert.deepEqual(actual instanceof Map ? [...actual] :
      actual instanceof Set ? [...actual] : actual,
      reference instanceof Map ? [...reference] :
        reference instanceof Set ? [...reference] : reference, name);
  }
});
