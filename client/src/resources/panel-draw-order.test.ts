import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { PanelDrawCache, type PanelGeometry, type PanelLayoutOps,
  type PanelTreeNode } from "./panel-draw-order";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

interface Node { name: string; visible: boolean; label?: string; }
interface Geometry extends PanelGeometry { left: number; top: number; }

const ops: PanelLayoutOps<Node> = {
  measure: (geometry, parent) => {
    const source = geometry as Geometry;
    return { left: source.left, top: source.top,
      right: source.left + source.width,
      bottom: source.top + source.height };
  },
  kind: name => name === "Panel" ? "panel"
    : name === "CharPanel" ? "char-panel" : undefined,
  visible: node => node.visible,
};

async function releaseCache() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("class O5 {");
  const last = source.indexOf("\nfunction ZB(", first);
  assert.ok(first >= 0 && last > first);
  return new Function("l5", "XB", "ZB", `${source.slice(first, last)}\nreturn O5;`)(
    ops.measure, ops.kind, ops.visible) as new () => PanelDrawCache<Node>;
}

function tree(): PanelTreeNode<Node> {
  const entry = (name: string, left: number, top: number,
    width: number, height: number, children: PanelTreeNode<Node>[] = [],
    visible = true, label?: string): PanelTreeNode<Node> => ({
      node: { name, visible, label },
      geometry: { left, top, width, height } as Geometry,
      children,
    });
  return entry("Root", 0, 0, 300, 200, [
    entry("Panel", 10, 12, 120, 60, [
      entry("CharPanel", 3, 5, 40, 20, [], true, "Ready"),
      entry("Ignored", 2, 2, 10, 10, [
        entry("Panel", 1, 1, 5, 5),
      ]),
    ]),
    entry("Panel", 150, 20, 60, 40, [
      entry("CharPanel", 1, 1, 20, 20),
    ], false),
  ]);
}

function snapshot(commands: ReturnType<PanelDrawCache<Node>["drawOrder"]>) {
  return commands.map(command => ({ kind: command.kind,
    node: command.node.name, rect: command.worldRect,
    text: command.text }));
}

test("P3528 绘制缓存布局、可见性、文本和纹理缓存与发行版一致", async () => {
  const Original = await releaseCache();
  const old = new Original();
  const current = new PanelDrawCache(ops);
  const layout = tree();
  const options = { text: (node: Node) => node.label,
    visibility: (node: Node) => node.name === "Ignored" ? true : undefined };
  const oldOrder = old.drawOrder(layout, 640, 480, options);
  const currentOrder = current.drawOrder(layout, 640, 480, options);
  assert.deepEqual(snapshot(currentOrder), snapshot(oldOrder));
  assert.equal(currentOrder, current.drawOrder(layout, 640, 480, options));
  assert.equal(oldOrder, old.drawOrder(layout, 640, 480, options));
  assert.deepEqual(snapshot(current.draw), snapshot(old.draw));

  const oldCommand = oldOrder[0]!;
  const currentCommand = currentOrder[0]!;
  const texture = {};
  old.storePayload(oldCommand, "payload", texture);
  current.storePayload(currentCommand, "payload", texture);
  assert.equal(current.payloadFor(currentCommand, texture),
    old.payloadFor(oldCommand, texture));
  assert.equal(current.payloadFor(currentCommand, {}),
    old.payloadFor(oldCommand, {}));
  const oldPools = old.glyphPools(oldOrder[1]!.node);
  const currentPools = current.glyphPools(currentOrder[1]!.node);
  assert.deepEqual(currentPools, oldPools);
  assert.equal(current.glyphPools(currentOrder[1]!.node), currentPools);
  assert.equal(old.glyphPools(oldOrder[1]!.node), oldPools);

  layout.children[0]!.node.visible = false;
  assert.deepEqual(snapshot(current.drawOrder(layout, 640, 480)),
    snapshot(old.drawOrder(layout, 640, 480)));
  assert.deepEqual(snapshot(current.drawOrder(layout, 800, 600,
    { visibility: () => true })),
  snapshot(old.drawOrder(layout, 800, 600, { visibility: () => true })));
});
