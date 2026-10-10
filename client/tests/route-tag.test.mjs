import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { routeSurfaceKind, routeTagFamily } from "../src/world/route-tag.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(source, { sourceType: "module" }).program.body;
function original(name) {
  const node = nodes.find(item => item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node, name);
  return new Function(`${source.slice(node.start, node.end)}\nreturn ${name};`)();
}
const originalSurface = original("Eg");
const originalFamily = original("Vo");

test("surface labels and route event families match the release", () => {
  for (const label of [
    "", "rail", "norain", "nosnow", "rail, norain", "warpnext",
    "shake1,2", "shake-1,2", "shake1,2 ", "wave1,2,3,4", "wave1,2,3,4 ",
    "zoomOut20.123", "zoomIn20.100", "zoom20.100", "zoom20.050",
    "lensflare", "flash", "petSuccess", "flyingPetDisable", "flyingPetEnable",
    "eventA", "shake", "wave", "fancyrail", "other", "Rail", "rail2",
  ]) assert.equal(routeSurfaceKind(label), originalSurface(label), label);
  for (const tag of [
    "rail:in:next", "warpnext:out:prev", "rain:in:prev", "rail",
    "rail:in:bad", "rail:out:next:extra", "x:in:next",
  ]) assert.equal(routeTagFamily(tag), originalFamily(tag), tag);
});
