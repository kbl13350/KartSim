import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { CharacterColorTable, loadCharacterColorTable,
  type ColorTableArchive } from "./character-color-table";
import { parseResourceXml } from "./xml-utf16-parser";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseCode() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("class nw {");
  const last = source.indexOf("\nconst H2 =", first);
  assert.ok(first >= 0 && last > first);
  return new Function("x1", "j0", `${source.slice(first, last)}\nreturn { Table:nw, load:Dj };`)(
    parseResourceXml,
    (node: { attributes: Array<{ name: string; value: string }> }, name: string) =>
      node.attributes.find(attribute => attribute.name === name)?.value) as {
      Table: typeof CharacterColorTable;
      load: (archive: ColorTableArchive) => Promise<CharacterColorTable>;
    };
}

function xml(body: string): Uint8Array {
  return Uint8Array.from([255, 254, ...Buffer.from(
    `<?xml version="1.0" encoding="UTF-16"?><itemtable>${body}</itemtable>`,
    "utf16le")]);
}

const sample = xml(`
  <character name="Alice" orgColorId="2"/>
  <character name="Bob" orgColorId="3"/>
  <color id="1" base="255 10 20 30" high="255 40 50 60"/>
  <dye id="2" base="128 3 4 5" high="255 6 7 8" rank="255 1 2 3"/>
  <dye id="3" base="0 1 2 3" high="255 90 100 110"/>
  <uniform name="Steel"/>
`);

function snapshot(table: CharacterColorTable) {
  const capture = (run: () => unknown) => {
    try { return run(); } catch (error) { return String(error); }
  };
  return {
    ids: [...table.characterColorIds], colors: [...table.colors],
    riderColors: [...table.riderColors], uniformNames: [...table.uniformNames],
    dyeRankColors: [...table.dyeRankColors],
    lookups: [capture(() => table.resolve("CHARACTER_ALICE.rho")),
      capture(() => table.resolve("bob")),
      capture(() => table.resolve("missing")),
      capture(() => table.resolveColor(1)),
      capture(() => table.resolveColor(2, 1)),
      capture(() => table.resolveColor(99)),
      capture(() => table.resolveDyeRankColor(2)),
      capture(() => table.resolveDyeRankColor(3))],
  };
}

test("角色、染色和等级颜色解析与发行版一致", async () => {
  const { Table } = await releaseCode();
  assert.deepEqual(snapshot(CharacterColorTable.parse(sample)),
    snapshot(Table.parse(sample)));
});

test("颜色表 exact source 加载和异常与发行版一致", async () => {
  const { load } = await releaseCode();
  const archive: ColorTableArchive = { exactCanonicalCandidates: () =>
    [{ bytes: async () => sample }] };
  assert.deepEqual(snapshot(await loadCharacterColorTable(archive)),
    snapshot(await load(archive)));
  const capture = async (run: () => Promise<unknown>) =>
    run().then(() => "success", error => String(error));
  const missing: ColorTableArchive = { exactCanonicalCandidates: () => [] };
  assert.equal(await capture(() => loadCharacterColorTable(missing)),
    await capture(() => load(missing)));
});

test("颜色表冲突、缺失和非法颜色值错误与发行版一致", async () => {
  const { Table } = await releaseCode();
  const bodies = [
    `<character name="A" orgColorId="1"/><character name="a" orgColorId="2"/>`,
    `<color id="1" base="255 0 0 0" high="255 0 0 0"/>
      <color id="1" base="255 0 0 0" high="255 0 0 0"/>`,
    `<color id="1" base="256 0 0 0" high="255 0 0 0"/>`,
    `<dye id="bad" base="255 0 0 0" high="255 0 0 0"/>`,
    `<uniform/>`,
  ];
  const capture = (run: () => unknown) => {
    try { run(); return "success"; }
    catch (error) { return String(error); }
  };
  for (const body of bodies) {
    const bytes = xml(body);
    assert.equal(capture(() => CharacterColorTable.parse(bytes)),
      capture(() => Table.parse(bytes)));
  }
});
