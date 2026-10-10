import assert from "node:assert/strict";
import test from "node:test";
import { SINGLE_CATEGORIES, SINGLE_LABELS, coverCrop, mainMenuColor,
  readMainMenuStrings, type MainMenuNode } from "./main-menu-view";

const node = (name: string, attributes: Record<string, string>,
  children: MainMenuNode[] = []): MainMenuNode => ({
  name, children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
});

test("主菜单背景按覆盖方式居中裁切", () => {
  assert.deepEqual(coverCrop({ width: 1600, height: 900 }, { width: 800, height: 900 }),
    { x: 400, y: 0, width: 800, height: 900 });
  assert.deepEqual(coverCrop({ width: 1000, height: 1000 }, { width: 1000, height: 500 }),
    { x: 0, y: 250, width: 1000, height: 500 });
});

test("主菜单颜色解析 ARGB 与命名颜色", () => {
  assert.equal(mainMenuColor("255 134 141 146"), "rgba(134,141,146,1)");
  assert.equal(mainMenuColor("white"), "white");
  assert.equal(mainMenuColor(undefined, "black"), "black");
});

test("主菜单字符串取国服文本并保留缺省键", () => {
  const bag = node("StringBag", {}, [
    node("k", { n: "singlePlay" }, [node("m", { c: "kr", v: "싱글" }), node("m", { c: "cn", v: "单人游戏" })]),
    node("k", { n: "krOnly" }, [node("m", { c: "kr", v: "x" })]),
  ]);
  const strings = readMainMenuStrings(bag);
  assert.equal(strings.get("singlePlay"), "单人游戏");
  assert.equal(strings.has("krOnly"), false);
  assert.equal(strings.get("event"), "活动");
});

test("单人游戏分类与卡片都有中文名称", () => {
  for (const category of SINGLE_CATEGORIES) assert.ok(SINGLE_LABELS[category]);
  assert.equal(SINGLE_LABELS.timeAttack_train, "练习计时赛");
});
