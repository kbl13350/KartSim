import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { CanvasContextDiagnostics } from "../src/ui/canvas-context-diagnostics.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = declarations.find(item => item.id?.name === name ||
    item.declarations?.some(part => part.id.name === name));
  assert.ok(node, name);
  return release.slice(node.start, node.end);
};
const Original = new Function(`${sourceOf("UE")}\n${sourceOf("qs0")}; return qs0;`)();

function run(Owner) {
  const calls = [];
  class Canvas {
    width = 1280;
    height = 720;
    constructor(layer) { this.layer = layer; }
    closest() { return this.layer ? { dataset: { uiLayer: this.layer } } : null; }
  }
  const previous = globalThis.HTMLCanvasElement;
  globalThis.HTMLCanvasElement = Canvas;
  try {
    const root = {
      addEventListener: (...args) => calls.push(["listen", args[0], args[2]]),
      removeEventListener: (...args) => calls.push(["remove", args[0], args[2]]),
    };
    const main = new Canvas("world");
    const owner = new Owner(root, main, () => "Racing",
      (message, lost) => calls.push(["report", message, lost]));
    for (const event of [
      { target: main, type: "webglcontextlost", statusMessage: "device reset" },
      { target: new Canvas("menus"), type: "contextrestored" },
      { target: new Canvas(), type: "contextlost" },
      { target: {}, type: "webglcontextlost" },
    ]) owner.onContext(event);
    owner.dispose();
    return calls;
  } finally {
    globalThis.HTMLCanvasElement = previous;
  }
}

test("canvas loss and restore diagnostics match release", () => {
  assert.deepEqual(run(CanvasContextDiagnostics), run(Original));
});
