import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage tutorial and upgrade scenes delegate to readable modules", () => {
  const generated = readFileSync(new URL(
    "../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL(
    "../generated/manifest.json", import.meta.url), "utf8")) as {
    handwrittenGarageUpgradeFlowLoaderOverrides: string[];
  };
  const expected = new Map([
    ["Ea", "showGarageUpgradeTutorial"],
    ["Ma", "loadGarageXunUpgradePanels"],
    ["ka", "loadGarageClassicUpgradeResult"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageUpgradeFlowLoaderOverrides,
    [...expected.keys()]);
  const functions = new Map(parse(generated, { sourceType: "module" }).program.body
    .filter(node => node.type === "FunctionDeclaration")
    .map(node => [node.id!.name, generated.slice(node.start!, node.end!)]));
  for (const [name, implementation] of expected) {
    assert.match(generated, new RegExp(`import \\{ ${implementation} \\}`), name);
    assert.match(functions.get(name) ?? "", new RegExp(`return ${implementation}\\(`), name);
  }
});
