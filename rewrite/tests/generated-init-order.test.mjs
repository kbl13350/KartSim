import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { parse } from "@babel/parser";

const generatedDir = fileURLToPath(new URL("../src/generated/", import.meta.url));

function rootIdentifier(expression) {
  if (expression.type === "Identifier") return expression.name;
  if (expression.type === "MemberExpression") return rootIdentifier(expression.object);
  return undefined;
}

test("generated dependency objects do not eagerly read later lexical declarations", () => {
  for (const filename of readdirSync(generatedDir).filter(name => name.endsWith(".js"))) {
    const source = readFileSync(path.join(generatedDir, filename), "utf8");
    const statements = parse(source, { sourceType: "module" }).program.body;
    const lexicalDeclarations = new Map();
    for (const statement of statements) {
      if (statement.type === "VariableDeclaration" && statement.kind !== "var") {
        for (const declaration of statement.declarations)
          if (declaration.id.type === "Identifier")
            lexicalDeclarations.set(declaration.id.name, declaration.start);
      } else if (statement.type === "ClassDeclaration" && statement.id) {
        lexicalDeclarations.set(statement.id.name, statement.start);
      }
    }
    for (const statement of statements) {
      if (statement.type !== "VariableDeclaration") continue;
      for (const declaration of statement.declarations) {
        if (declaration.id.type !== "Identifier" ||
            !declaration.id.name.endsWith("Dependencies") ||
            declaration.init?.type !== "ObjectExpression") continue;
        for (const property of declaration.init.properties) {
          // Getter bodies and arrow callbacks run after initialization.
          if (property.type !== "ObjectProperty") continue;
          const referenced = rootIdentifier(property.value);
          if (referenced === undefined) continue;
          const declarationAt = lexicalDeclarations.get(referenced);
          assert.ok(declarationAt === undefined || declarationAt < statement.start,
            `${filename}: ${declaration.id.name}.${property.key.name ?? property.key.value} ` +
            `reads ${referenced} before its declaration`);
        }
      }
    }
  }
});
