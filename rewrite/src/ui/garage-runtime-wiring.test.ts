import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("generated Garage chunk delegates model, scroll and point effect classes", () => {
  const generated = readFileSync(new URL("../generated/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
  const ast = parse(generated, { sourceType: "module" });
  const manifest = JSON.parse(readFileSync(new URL("../generated/manifest.json", import.meta.url), "utf8"));
  const classes = new Map([
    ["Qi", "GarageModelCache"],
    ["vn", "GarageInventoryScroll"],
    ["Ka", "GaragePointEffects"],
  ]);
  assert.deepEqual(manifest.handwrittenGarageRuntimeClassOverrides, [...classes.keys()]);
  for (const [name, delegate] of classes) {
    const declaration = ast.program.body.find(node =>
      node.type === "ClassDeclaration" && node.id?.name === name ||
      node.type === "VariableDeclaration" &&
      node.declarations.some(part => part.id.type === "Identifier" && part.id.name === name));
    assert.ok(declaration, name);
    assert.match(generated.slice(declaration.start!, declaration.end!), new RegExp(delegate));
  }
  const helpers = new Map([
    ["za", "garageSkillEffectRect"],
    ["Ua", "compareGarageSkillEffects"],
  ]);
  assert.deepEqual(manifest.handwrittenGaragePointEffectHelperOverrides, [...helpers.keys()]);
  for (const [name, delegate] of helpers) {
    const declaration = ast.program.body.find(node =>
      node.type === "FunctionDeclaration" && node.id?.name === name);
    assert.ok(declaration, name);
    assert.match(generated.slice(declaration.start!, declaration.end!), new RegExp(`${delegate}\\(`));
  }
});
