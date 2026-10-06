import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { gridExtent, gridLayout, gridLayoutConfig, gridPageSize, gridPositionCount, gridStepSize,
  type GridLayoutConfig } from "./grid-layout";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = source.indexOf("function Wa0(n, e) {");
const end = source.indexOf("function Hv(", start);
assert.ok(start > 0 && end > start);
const release = new Function(`${source.slice(start, end)}; return { Wa0, Wv, i4, $P, Ha0 };`)() as {
  Wa0: typeof gridPositionCount;
  Wv: typeof gridPageSize;
  i4: typeof gridStepSize;
  $P: typeof gridLayout;
  Ha0: typeof gridExtent;
};

const nodeAttribute = (node: { attributes: Array<{ name: string; value: string }> }, name: string) =>
  node.attributes.find(item => item.name === name)?.value;
const parseNumbers = (value: string, count: number, name: string) => {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== count) throw new Error(`${name}=${value} 必须包含 ${count} 个数。`);
  return parts.map(part => {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(part))
      throw new Error(`${name}=${value} 包含无效数字。`);
    const number = Number(part);
    if (!Number.isFinite(number)) throw new Error(`${name}=${value} 包含非有限值。`);
    return Math.fround(number);
  });
};
const sourceVlStart = source.indexOf("function vl(n) {");
const sourceVlEnd = source.indexOf("function Wa0(", sourceVlStart);
assert.ok(sourceVlStart > 0 && sourceVlEnd > sourceVlStart);
const releasedConfig = new Function("T", "j2", `
  ${source.slice(sourceVlStart, sourceVlEnd)}; return vl;
`)(nodeAttribute, parseNumbers) as typeof gridLayoutConfig;

test("grid BML configuration and malformed margins match release", () => {
  const makeNode = (attributes: Record<string, string>) => ({
    name: "Grid", text: "", children: [],
    attributes: Object.entries(attributes).map(([name, value]) => ({ name, value })),
  });
  for (const values of [
    {}, { alignSize: "4", maxLine: "3", linePaging: "true" },
    { clientMargin: "1.5 2 3 4", alignMargin: "-2 6e0" },
  ] as Array<Record<string, string>>) {
    const node = makeNode(values);
    assert.deepEqual(gridLayoutConfig(node), releasedConfig(node));
  }
  for (const values of [{ clientMargin: "1 2" }, { alignMargin: "1 nope" }] as Array<Record<string, string>>) {
    const node = makeNode(values);
    let expectedMessage = "";
    try { releasedConfig(node); } catch (error) { expectedMessage = (error as Error).message; }
    assert.ok(expectedMessage);
    assert.throws(() => gridLayoutConfig(node), { message: expectedMessage });
  }
});

test("grid pages, row paging, empty cells and partial extent match release", () => {
  const viewport = { x: 45, y: 28, width: 600, height: 350 };
  const cell = { x: 0, y: 0, width: 91, height: 72 };
  for (const columns of [1, 3, 5]) for (const rows of [1, 2, 4]) {
    for (const linePaging of [false, true]) {
      const config: GridLayoutConfig = {
        columns, maxRows: rows, linePaging, gapX: 7, gapY: 11,
        margin: { left: 5, top: 13, right: 17, bottom: 19 },
      };
      assert.equal(gridPageSize(config), release.Wv(config));
      assert.equal(gridStepSize(config), release.i4(config));
      for (const count of [0, 1, columns, columns * rows, columns * rows + 1, 29]) {
        assert.equal(gridPositionCount(config, count), release.Wa0(config, count));
        assert.deepEqual(gridExtent(config, viewport, cell, count),
          release.Ha0(config, viewport, cell, count));
        for (const position of [0, 1, 2]) {
          assert.deepEqual(gridLayout(config, viewport, cell, count, position),
            release.$P(config, viewport, cell, count, position));
        }
      }
    }
  }
});
