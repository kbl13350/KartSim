import assert from "node:assert/strict";
import test from "node:test";

import { CHANGER_CATEGORY, garageStuffItems, parseStuffInfo, STUFF_CATEGORIES, stuffKey } from "./stuff-items";

interface XmlNode { name: string; attributes: Array<{ name: string; value: string }>; children: XmlNode[] }
const node = (name: string, attributes: Record<string, string> = {}, children: XmlNode[] = []): XmlNode => ({
  name, children, attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
});

const DAY = 86_400_000;

// 我的物品 lists the item changer cards (ITEM_MODE.md C.6): the counted
// 道具换位卡 / 道具变更卡 with their counts, the timed 使用券 with what is
// left of them.
test("changer cards and vouchers are listed with their names, counts and time left", () => {
  assert.ok(STUFF_CATEGORIES.has(CHANGER_CATEGORY));
  const items = node("itemList", {}, [
    node("item", { itemCatId: "7", itemId: "1", itemName: "道具换位卡" }),
    node("item", { itemCatId: "7", itemId: "2", itemName: "道具变更卡" }),
    node("item", { itemCatId: "7", itemId: "3", itemName: "道具变更卡使用券" }),
    node("item", { itemCatId: "7", itemId: "4", itemName: "道具换位卡使用券" }),
  ]);
  const table = node("itemtable", {}, [node("slotChanger", { id: "1", name: "slotChanger" })]);
  const info = parseStuffInfo(items, table);
  assert.deepEqual(info.get(stuffKey(7, 2)), { name: "道具变更卡" });
  const now = 1_000 * DAY;
  const listed = garageStuffItems([
    { category: 7, itemId: 4, quantity: 1, expiresAt: now + 7 * DAY + 1, source: "shop" },
    { category: 7, itemId: 3, quantity: 1, expiresAt: now - 1, source: "shop" }, // expired
    { category: 7, itemId: 2, quantity: 0, expiresAt: null, source: "lottery" }, // used up
    { category: 7, itemId: 1, quantity: 480, expiresAt: null, source: "lottery" },
  ], info, now);
  assert.deepEqual(listed.map(item => [item.itemId, item.title, item.quantity, item.ownershipLabel]),
    [[1, "道具换位卡", 480, undefined], [4, "道具换位卡使用券", 1, "剩余 7 天"]]);
  assert.equal(listed[0]!.icon, undefined); // stuff/card/*.1s are models, not icons
});
