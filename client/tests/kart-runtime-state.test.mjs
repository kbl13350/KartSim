import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "@babel/parser";
import { KartRuntimeState, NUMBER_SLOT_INDEX, FLAG_SLOT_INDEX } from "../src/vehicle/kart-runtime-state.ts";

const projectDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const release = readFileSync(path.join(projectDir, "../recovered/formatted/index.js"), "utf8");
const ast = parse(release, { sourceType: "module" });
const classNode = ast.program.body.find((node) =>
  node.type === "ClassDeclaration" && node.id.name === "J40");
const declarations = ast.program.body
  .filter((node) => node.type === "VariableDeclaration")
  .flatMap((node) => node.declarations);
const originalIndex = (name) => {
  const declaration = declarations.find((part) => part.id.name === name);
  assert.ok(declaration);
  return release.slice(declaration.init.start, declaration.init.end);
};
assert.ok(classNode);
const OriginalState = new Function("F2", `
  const J = ${originalIndex("J")};
  const Q0 = ${originalIndex("Q0")};
  ${release.slice(classNode.start, classNode.end)}
  return J40;
`)((x = 0, y = 0, z = 0) => ({ x, y, z }));

test("packed kart state has the release's exact property layout and behavior", () => {
  const original = new OriginalState();
  const rewritten = new KartRuntimeState();
  assert.deepEqual(Object.keys(rewritten), Object.keys(original));
  assert.deepEqual(
    Object.getOwnPropertyNames(KartRuntimeState.prototype),
    Object.getOwnPropertyNames(OriginalState.prototype),
  );
  assert.equal(Object.keys(NUMBER_SLOT_INDEX).length, 90);
  assert.equal(Object.keys(FLAG_SLOT_INDEX).length, 34);
  for (const [name, index] of Object.entries(NUMBER_SLOT_INDEX)) {
    const value = (index - 43.5) / 7;
    original[name] = value;
    rewritten[name] = value;
    assert.equal(rewritten[name], original[name], name);
  }
  for (const [name, index] of Object.entries(FLAG_SLOT_INDEX)) {
    const value = index % 2 === 0;
    original[name] = value;
    rewritten[name] = value;
    assert.equal(rewritten[name], original[name], name);
  }
  assert.deepEqual(rewritten.numbers, original.numbers);
  assert.deepEqual(rewritten.flags, original.flags);
});
