import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";

test("the runtime race builder uploads map and sky geometry before publishing the race", () => {
  const generated = readFileSync(new URL("../src/generated/timeattack.js", import.meta.url), "utf8");
  const builder = parse(generated, { sourceType: "module" }).program.body
    .find(node => node.type === "ClassDeclaration" && node.id.name === "if0");
  assert.ok(builder);
  assert.match(generated.slice(builder.start, builder.end),
    /buildSoloRaceAssets\(this, selection, options, coatingStage/);
  const readable = readFileSync(new URL("../src/timeattack/race-asset-builder.ts", import.meta.url), "utf8");
  for (const scene of ["map.scene", "map.skydome.object"])
    assert.ok(readable.includes(`ops.prepareScene(host.renderer, ${scene}, host.scene, true)`));
});
