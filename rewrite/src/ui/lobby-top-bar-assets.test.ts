import assert from "node:assert/strict";
import test from "node:test";

import { levelGlove, parseLevelTable } from "./lobby-top-bar-assets";

// The opening rows of etc_/level/leveltable@cn.xml.
const table = `<?xml version='1.0' encoding='UTF-16'?>
<Levels
\trpLimit='75000000'
>
\t<Level nextRp='1' tryLevel='1' glove='노랑5' name='黄色手套5' /> <!-- 레벨 0 -->
\t<Level nextRp='70' tryLevel='1' glove='노랑5' name='黄色手套5' />
\t<Level nextRp='148' tryLevel='1' glove='노랑4' name='黄色手套4' />
\t<Level nextRp='902' tryLevel='2' glove="초록5" name="绿色手套5" />
</Levels>`;

test("等级表按行给出每级的手套图标与名称", () => {
  const rows = parseLevelTable(table);
  assert.deepEqual(rows.map(row => row.glove), ["노랑5", "노랑5", "노랑4", "초록5"]);
  assert.deepEqual(levelGlove(rows, 1), { glove: "노랑5", name: "黄色手套5" });
  assert.equal(levelGlove(rows, 2)?.name, "黄色手套4");
  assert.equal(levelGlove(rows, 3)?.glove, "초록5");
  // Past the table keeps its last glove; below zero uses level 0.
  assert.equal(levelGlove(rows, 99)?.glove, "초록5");
  assert.equal(levelGlove(rows, -1)?.glove, "노랑5");
  assert.equal(levelGlove([], 1), undefined);
});
