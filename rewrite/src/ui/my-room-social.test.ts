import assert from "node:assert/strict";
import test from "node:test";

import { MyRoomError } from "../myroom/myroom-connection";
import { parseCareerTable, parseEmblemTable, xmlAttributes } from "../myroom/myroom-data";
import { careerCondition, careerDate, careerRows, careerTarget, careerTotals } from "./my-room-career";
import { DICTIONARY_GROUPS, dictionaryEntries, dictionaryProgress, dictionaryRewardLines, itemKey,
  type DictionaryItemInfo } from "./my-room-dictionary";
import { chooseMainEmblem, clearMainEmblem } from "./my-room-emblems";
import { enterErrorMessage } from "./my-room-view";

test("representative emblems follow the release slot rules", () => {
  assert.deepEqual(chooseMainEmblem([0, 0], 5), { main: [5, 0] });
  assert.deepEqual(chooseMainEmblem([5, 0], 6), { main: [5, 6] });
  assert.deepEqual(chooseMainEmblem([5, 6], 7), { refused: "notEmptySlot" });
  assert.deepEqual(chooseMainEmblem([5, 0], 5), { refused: "alreadyEmblem" });
  assert.deepEqual(clearMainEmblem([5, 6], 0), [6, 0]);
  assert.deepEqual(clearMainEmblem([5, 6], 1), [5, 0]);
});

const careerXml = `<!-- comment <careerItem id='99' mainType='1' subType='1'/> -->
<newCareerList>
  <careerItem id='1' mainType='1' subType='1' title='萌新驾到' careerType='1' clearValue='0'
    careerDesc='完成新手指南' helpString='欢迎' rewardPoint='5' texture='career_01_001' showCondition='false'/>
  <careerItem id='2' mainType='1' subType='1' title='第二' careerType='1' clearValue='10' careerDesc='d'
    helpString='h' rewardPoint='10' texture='t' preClearCareerId='1' rewardEmblemId='8196'/>
  <careerItem id='3' mainType='2' subType='4' title='复合' careerType='49' clearValue='1' careerDesc='d'
    helpString='h' rewardPoint='5' texture='t' isMulti='true' multiId='1, 2'/>
  <careerItem id='4' mainType='1' subType='3' title='隐藏' careerType='55' clearValue='1' careerDesc='d'
    helpString='h' rewardPoint='5' texture='t' isHidden='true'/>
  <careerItem id='4' mainType='1' subType='3' title='重复' careerType='55' clearValue='1'/>
  <careerItem id='5' mainType='1' subType='3' title='停用' careerType='1' clearValue='1' enable='false'/>
</newCareerList>`;

test("distance careers show km with one decimal", () => {
  const table = parseCareerTable(careerXml);
  const formats = { normal: "%s (%d/%d)", distance: "%s (%.1f/%.1f)" };
  const forest = { ...table.get(2)!, careerType: 46, clearValue: 5000, desc: "森林" };
  assert.equal(careerCondition(forest, 1234, formats), "森林 (123.4/500.0)");
  assert.equal(careerCondition(forest, 9000, formats), "森林 (500.0/500.0)");
  assert.equal(careerCondition({ ...forest, careerType: 50 }, 5, formats), "森林 (0.5/500.0)");
  assert.equal(careerCondition(table.get(2)!, 3, formats), "d (3/10)");
  assert.equal(careerCondition(table.get(1)!, 0, formats), "完成新手指南");
});

test("career and emblem tables parse like the server export", () => {
  const table = parseCareerTable(careerXml);
  assert.deepEqual([...table.keys()], [1, 2, 3, 4]);
  assert.equal(table.get(1)!.showCondition, false);
  assert.equal(table.get(2)!.rewardEmblemId, 8196);
  assert.deepEqual(table.get(3)!.multiIds, [1, 2]);
  assert.equal(careerTarget(table.get(3)!), 2);
  assert.equal(table.get(4)!.title, "隐藏");
  const emblems = parseEmblemTable(`<kartEmblem><emblem id='8196' name='棉花糖徽章' desc='a &amp; b' />
    <emblem id="8197" name="二" desc="" /></kartEmblem>`);
  assert.equal(emblems.get(8196)!.desc, "a & b");
  assert.equal(emblems.get(8197)!.name, "二");
  assert.equal(xmlAttributes(` a='1' b="x y"`).get("b"), "x y");
});

test("a tab lists unlocked careers, hides unreached hidden ones and filters by state", () => {
  const table = parseCareerTable(careerXml);
  const progress = [
    { id: 1, value: 0, state: "rewarded" as const, locked: false, untracked: false, completedAt: Date.UTC(2026, 9, 9) },
    { id: 2, value: 3, state: "playing" as const, locked: false, untracked: false },
    { id: 3, value: 1, state: "playing" as const, locked: false, untracked: false },
    { id: 4, value: 0, state: "playing" as const, locked: false, untracked: false },
  ];
  assert.deepEqual(careerRows(table, progress, 1, "all").map(row => row.info.id), [1, 2]);
  assert.deepEqual(careerRows(table, progress, 1, "rewarded").map(row => row.info.id), [1]);
  assert.deepEqual(careerRows(table, progress, 3, "all"), []);
  const locked = progress.map(item => item.id === 2 ? { ...item, locked: true } : item);
  assert.deepEqual(careerRows(table, locked, 1, "all").map(row => row.info.id), [1]);
  assert.deepEqual(careerTotals(table, progress), [{ done: 1, total: 3 }, { done: 0, total: 1 },
    { done: 0, total: 0 }, { done: 0, total: 0 }]);
  assert.match(careerDate(Date.UTC(2026, 9, 9, 12)), /^2026\. 10\. 0[89]$/);
  assert.equal(careerDate(undefined), "");
});

test("refused enters show the release notices", () => {
  assert.equal(enterErrorMessage(new MyRoomError("UNKNOWN_RIDER"), false), "不存在的车手");
  assert.equal(enterErrorMessage(new MyRoomError("ALREADY_HERE", "阿"), false), "已经在 阿的小屋里");
  assert.equal(enterErrorMessage(new MyRoomError("WRONG_PASSWORD"), false), "密码错误");
  assert.equal(enterErrorMessage(new MyRoomError("RANDOM_FAILED"), true), "随机进入失败");
  assert.equal(enterErrorMessage(new MyRoomError("CANNOT_ENTER"), false), "进入小屋失败");
  assert.equal(enterErrorMessage(new Error("network"), true), "随机进入失败");
});

test("dictionary sub tabs filter by kart type, engine grade and name", () => {
  const summary = {
    nickname: "Me", owner: true, total: 5, collected: 2, rewarded: 0, claimable: 2,
    reward: { category: 56, item: 1, count: 1 },
    kartGrades: new Map([[10, 13], [11, 12], [12, 13]]),
    categories: [{ category: 3, name: "kart", items: [12, 11, 10], collected: [10] },
      { category: 21, name: "pet", items: [5, 4], collected: [4] }],
  };
  const items = new Map<string, DictionaryItemInfo>([
    [itemKey(3, 10), { name: "迅·闪电", internalId: "a", kartType: 2 }],
    [itemKey(3, 11), { name: "棉花糖", internalId: "b", kartType: 1 }],
    [itemKey(3, 12), { name: "迅·火焰", internalId: "c", kartType: 2 }],
  ]);
  const [all, speed, item] = DICTIONARY_GROUPS[0]!.subs;
  assert.deepEqual(dictionaryEntries(summary, all!, items).map(entry => entry.itemId), [12, 11, 10]);
  assert.deepEqual(dictionaryEntries(summary, speed!, items).map(entry => entry.itemId), [12, 10]);
  assert.deepEqual(dictionaryEntries(summary, item!, items).map(entry => entry.itemId), [11]);
  assert.deepEqual(dictionaryEntries(summary, all!, items, { grade: 13 }).map(entry => entry.itemId), [12, 10]);
  assert.deepEqual(dictionaryEntries(summary, all!, items, { search: "闪电" }).map(entry => entry.itemId), [10]);
  assert.deepEqual(dictionaryProgress(dictionaryEntries(summary, speed!, items)),
    { collected: 1, total: 2, percent: 50 });
  // Items the catalog does not name keep their id; a missing category is empty.
  const pets = dictionaryEntries(summary, DICTIONARY_GROUPS[1]!.subs[1]!, items);
  assert.deepEqual(pets.map(entry => [entry.name, entry.collected]), [["5", false], ["4", true]]);
  assert.deepEqual(dictionaryEntries(summary, DICTIONARY_GROUPS[3]!.subs[0]!, items), []);
  assert.deepEqual(dictionaryProgress([]), { collected: 0, total: 0, percent: 0 });
  assert.equal(dictionaryProgress([{ category: 1, itemId: 1, collected: true, name: "", internalId: "" },
    { category: 1, itemId: 2, collected: false, name: "", internalId: "" },
    { category: 1, itemId: 3, collected: false, name: "", internalId: "" }]).percent, 33);
});

test("the dictionary reward text fills the release template", () => {
  assert.deepEqual(dictionaryRewardLines("图鉴中新添道具数量为 %d个，|可领取[%s] %d个奖励。|确认要领取奖励吗？", 3, "K币", 3),
    ["图鉴中新添道具数量为 3个，", "可领取[K币] 3个奖励。", "确认要领取奖励吗？"]);
});
