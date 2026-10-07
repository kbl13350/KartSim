import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PanelDrawCache, type PanelCommand } from "./panel-draw-order";
import { materializePanelDrawOrder, type PanelMaterializeOps,
  type PanelQuad } from "./panel-materializer";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface Node { name: string; attributes: Record<string, string>; }
const texture = { width: 64, height: 32 };
const textures = new Map<string, unknown>([["ui/panel.png", texture]]);

function glyph(character: string, index: number): PanelQuad {
  return { character, left: index * 2, top: 0, right: index * 2 + 2,
    bottom: 3, u0: 0, v0: 0, u1: 1, v1: 1 };
}

const ops: PanelMaterializeOps<Node> = {
  attribute: (node, name) => node.attributes[name],
  inset: rect => ({ left: Math.fround(rect.left - 0.5),
    top: Math.fround(rect.top - 0.5),
    right: Math.fround(rect.right - 0.5),
    bottom: Math.fround(rect.bottom - 0.5) }),
  uv: () => ({ left: 0, top: 0, right: 1, bottom: 1 }),
  font: () => ({}),
  rasterize: (_font, value) => [...value].map(glyph),
  rasterizeInto: (_font, value, output) => {
    output.length = 0;
    output.push(...[...value].map(glyph));
  },
  offsetInto: (local, world, x, y) => {
    world.length = 0;
    world.push(...local.map(item => ({ ...item,
      left: Math.fround(item.left + x), top: Math.fround(item.top + y),
      right: Math.fround(item.right + x),
      bottom: Math.fround(item.bottom + y) })));
  },
  copyInto: (world, output) => {
    output.length = 0;
    output.push(...world.map(item => ({ ...item })));
  },
};

async function releaseMaterializer() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("function dt(");
  const last = source.indexOf("\nfunction lX(", first);
  assert.ok(first >= 0 && last > first);
  return new Function("T", "YB", "dX", "ga", "$B", "lX", "uX", "pa",
    `${source.slice(first, last)}\nreturn dt;`)(ops.attribute, ops.inset,
    ops.uv, ops.font, ops.rasterizeInto, ops.offsetInto, ops.copyInto,
    ops.rasterize) as (commands: PanelCommand<Node>[],
      textures: Map<string, unknown>, cache?: PanelDrawCache<Node>) => unknown[];
}

function command(kind: string, name: string, attributes: Record<string, string>,
  text?: string): PanelCommand<Node> {
  return { kind, node: { name, attributes },
    worldRect: { left: 10.25, top: 20.75, right: 40.5, bottom: 50.5 }, text };
}

function cache() {
  return new PanelDrawCache<Node>({ measure: () => ({ left: 0, top: 0,
    right: 0, bottom: 0 }), kind: () => undefined, visible: () => true });
}

test("P3528 实心、贴图和字符面板的渲染载荷与发行版一致", async () => {
  const original = await releaseMaterializer();
  const commands = [
    command("graduation", "Other", {}),
    command("panel", "Solid", { alphaBlend: "true", color: "150 0 0 0" }),
    command("panel", "Textured", { alphaBlend: "true", texture: "ui/panel.png" }),
    command("char-panel", "Label", {
      alphaBlend: "true", texture: "ui/panel.png" }, "AB"),
  ];
  const oldCache = cache(), currentCache = cache();
  const old = original(commands, textures, oldCache);
  const current = materializePanelDrawOrder(commands, textures, currentCache, ops);
  assert.deepEqual(current, old);
  assert.equal(current, currentCache.baseOutput());
  assert.equal(old, oldCache.baseOutput());

  const oldPayloads = [...old];
  const currentPayloads = [...current];
  commands[3]!.text = "CAB";
  assert.deepEqual(materializePanelDrawOrder(commands, textures, currentCache, ops),
    original(commands, textures, oldCache));
  for (let index = 0; index < commands.length; index++) {
    assert.equal(currentCache.baseOutput()[index], currentPayloads[index]);
    assert.equal(oldCache.baseOutput()[index], oldPayloads[index]);
  }
  assert.deepEqual(materializePanelDrawOrder(commands, textures, undefined, ops),
    original(commands, textures));
});

test("P3528 alpha、贴图和缺失文字错误与发行版一致", async () => {
  const original = await releaseMaterializer();
  const invalid = [
    command("panel", "Blend", { texture: "ui/panel.png" }),
    command("panel", "Test", { alphaBlend: "true", alphaTest: "true",
      texture: "ui/panel.png" }),
    command("panel", "Solid", { alphaBlend: "true", color: "0 0 0 0" }),
    command("panel", "Missing", { alphaBlend: "true",
      texture: "ui/missing.png" }),
    command("char-panel", "Empty", { alphaBlend: "true",
      texture: "ui/panel.png" }),
  ];
  const capture = (run: () => unknown) => {
    try { run(); return "success"; }
    catch (error) { return String(error); }
  };
  for (const entry of invalid)
    assert.equal(capture(() => materializePanelDrawOrder([entry], textures,
      undefined, ops)), capture(() => original([entry], textures)));
});
