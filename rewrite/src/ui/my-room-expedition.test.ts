import assert from "node:assert/strict";
import test from "node:test";

import { garageStuffItems, parseStuffInfo, stuffKey } from "../account/stuff-items";
import { boxErrorText, boxRewardText } from "./box-dialogs";
import { autoFillCrew, expeditionDuration } from "./my-room-expedition";

interface XmlNode { name: string; attributes: Array<{ name: string; value: string }>; children: XmlNode[] }
const node = (name: string, attributes: Record<string, string>, children: XmlNode[] = []): XmlNode =>
  ({ name, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })), children });

test("expedition times read like the release strings", () => {
  const strings = { day: "天", hour: "小时", minute: "分", lessThan1Minute: "不到1分钟" };
  assert.equal(expeditionDuration(30_000, strings), "不到1分钟");
  assert.equal(expeditionDuration(20 * 60_000, strings), "20分");
  assert.equal(expeditionDuration((5 * 60 + 20) * 60_000, strings), "5小时20分");
  assert.equal(expeditionDuration((29 * 60 + 30) * 60_000, strings), "1天5小时");
  assert.equal(expeditionDuration(2 * 24 * 3_600_000, strings), "2天");
});

test("auto fill sends matching members first and skips busy ones", () => {
  const crew = {
    characters: [{ itemId: 1, specific: 3 }, { itemId: 2, specific: 0 }, { itemId: 3, specific: 0 }],
    karts: [{ itemId: 5, specific: 1, level: 5, parts: 0 }, { itemId: 6, specific: 0, level: 0, parts: 0 },
      { itemId: 0, kartKey: "practice", specific: 0, level: 0, parts: 0 }],
    friends: [],
  };
  const members = autoFillCrew({ specific: 0 }, crew, { characters: new Set([3]), karts: new Set() });
  assert.deepEqual(members.map(member => [member.character, member.kart?.itemId]),
    [[2, 6], [1, 0], [undefined, undefined]]);
});

test("stuff items take item.kml names and itemTable icons", () => {
  const items = node("itemList", {}, [
    node("item", { itemCatId: "24", itemId: "1228", itemName: "探险队补给箱" }),
    node("item", { itemCatId: "34", itemId: "879", itemName: "探险币" }),
    node("item", { itemCatId: "1", itemId: "1", itemName: "宝宝" }),
  ]);
  const table = node("itemtable", {}, [
    node("lottery", { id: "1228", name: "탐험대배낭상자" }),
    node("material", { id: "879", name: "레이싱포인트코인" }),
  ]);
  const info = parseStuffInfo(items, table);
  assert.deepEqual(info.get(stuffKey(24, 1228)), { name: "探险队补给箱", icon: "stuff/lottery/탐험대배낭상자.png" });
  assert.equal(info.get(stuffKey(34, 879))?.icon, "stuff/material/레이싱포인트코인.png");
  assert.equal(info.has(stuffKey(1, 1)), false);
  const listed = garageStuffItems([
    { category: 34, itemId: 879, quantity: 9, expiresAt: null, source: "expedition" },
    { category: 24, itemId: 1228, quantity: 0, expiresAt: null, source: "expedition" },
    { category: 24, itemId: 1007, quantity: 2, expiresAt: null, source: "lottery" },
    { category: 1, itemId: 1, quantity: 1, expiresAt: null, source: "starter" },
  ], info, 0);
  assert.deepEqual(listed.map(item => [item.category, item.itemId, item.quantity, item.title]),
    [[24, 1007, 2, "24-1007"], [34, 879, 9, "探险币"]]);
});

test("box results and refusals read like the release dialog", () => {
  assert.equal(boxRewardText({ category: 8, itemId: 247, count: 1, days: 7, name: "睡眠眼罩护目镜" }),
    "睡眠眼罩护目镜（7天）");
  assert.equal(boxRewardText({ category: 9, itemId: 1447, count: 50, days: 0, name: "气球" }), "气球 ×50");
  assert.equal(boxErrorText("LOTTERY_NOT_IN_PERIOD", "红宝石盒"), "不在使用期之内");
  assert.equal(boxErrorText("ITEM_NOT_ENOUGH", "红宝石盒"), "红宝石盒的数量不足，无法使用");
  assert.equal(boxErrorText(undefined, "红宝石盒"), "发生了未知错误");
});
