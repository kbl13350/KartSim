import assert from "node:assert/strict";
import test from "node:test";
import { storyStepResult } from "./ready-story";
import { chapterHeaderShift, currentStoryStep, storyColor, storyMapPages, storyMissionImage,
  storyMissionText, storyPageOf, windowTextWidth, wrapStoryText } from "../ui/story-windows";

const mission = (kind: string, extra: object = {}) => ({ kind, track: "forest_I01", laps: 3,
  timeLimitMs: 0, speed: 0, ...extra });

test("故事关卡通关判定", () => {
  assert.deepEqual(storyStepResult(mission("TimeAttack"), { finished: false, elapsedMs: 0 }, 0),
    { cleared: false, message: "任务失败：没有完成比赛" });
  assert.equal(storyStepResult(mission("TimeAttack"), { finished: true, elapsedMs: 90_000 }, 0)
    .cleared, true);
  assert.equal(storyStepResult(mission("TimeAttack", { timeLimitMs: 26_000 }),
    { finished: true, elapsedMs: 26_500 }, 0).message, "任务失败：没有在规定时间内完成");
  const shadow = mission("Shadow", { rival: { ksv: "x", name: "黑妞" } });
  assert.equal(storyStepResult(shadow, { finished: true, elapsedMs: 113_000 }, 113_550).cleared, true);
  assert.equal(storyStepResult(shadow, { finished: true, elapsedMs: 113_550 }, 113_550).message,
    "任务失败：没有赢过黑妞");
});

test("任务文字与概要", () => {
  assert.equal(storyMissionText("赛道完成 %d回/%d回", false), "赛道完成 0回/1回");
  assert.equal(storyMissionText("对决胜利 %d回/%d回", true), "对决胜利 1回/1回");
  assert.equal(storyColor("255 42 55 80"), "rgba(42,55,80,1)");
  assert.equal(storyColor(undefined, "black"), "black");
});

test("地图上的车手停在第一个未通关的开放关卡", () => {
  const steps = [1, 2, 3].map(id => ({ id, title: "", synopsis: "", howToClear: "",
    missionText: "", readyStage: `1-${id}`, preConditionIds: id > 1 ? [id - 1] : [],
    otherWayLockIds: [], isFinalStep: id === 3, type: 30, mode: "single" as const }));
  const cleared = new Set([1]);
  const isCleared = (step: { id: number }) => cleared.has(step.id);
  const isOpen = (step: { preConditionIds: number[] }) =>
    step.preConditionIds.length === 0 || step.preConditionIds.some(id => cleared.has(id));
  assert.equal(currentStoryStep(steps, isCleared, isOpen)?.id, 2);
  cleared.add(2).add(3);
  assert.equal(currentStoryStep(steps, isCleared, isOpen)?.id, 3);
  // A fork's locked branch is never where the rider stands: the last cleared step is.
  cleared.delete(3);
  assert.equal(currentStoryStep(steps, isCleared, () => false)?.id, 2);
});

test("剧情文字按宽度换行", () => {
  const context = { measureText: (text: string) => ({ width: text.length * 10 }) } as never;
  assert.deepEqual(wrapStoryText(context, "一二三四五\n六", 30), ["一二三", "四五", "六"]);
});

test("任务类型对应原版任务图", () => {
  assert.equal(storyMissionImage({ kind: "TimeAttack", timeLimitMs: 0 }), "mq_타임어택@zz");
  assert.equal(storyMissionImage({ kind: "TimeAttack", timeLimitMs: 26_000 }), "mq_시간체크@zz");
  assert.equal(storyMissionImage({ kind: "Shadow", timeLimitMs: 0 }), "mq_섀도우@zz");
  assert.equal(storyMissionImage({ kind: "Escape", timeLimitMs: 0 }), "mq_추격@zz");
  assert.equal(storyMissionImage({ kind: "KnockOut", timeLimitMs: 0 }), "mq_넉다운@zz");
});

test("章节标签变长时标题向右让开", () => {
  const measure = () => 20;
  // 发行版 cn 布局：章节标签 x=32，分隔线 x=86，标题 x=102。
  assert.equal(chapterHeaderShift(32, 86, windowTextWidth("章节", 20, measure)), 0);
  assert.equal(chapterHeaderShift(32, 86, windowTextWidth("第一章", 20, measure)), 18);
});

test("宽地图分页：每个关卡都能完整出现在某一页", () => {
  const step = (x: number) => ({ x, y: 0, width: 66, height: 66 });
  // 1536 wide map, 764 wide window; a step at 758 straddles the first edge.
  const rects = [step(100), step(690), step(758), step(1400)];
  const pages = storyMapPages(1536, 764, rects);
  assert.deepEqual(pages, [0, 758, 772]);
  for (const rect of rects) {
    const page = pages[storyPageOf(pages, 764, rect)]!;
    assert.ok(rect.x >= page && rect.x + rect.width <= page + 764, `step at ${rect.x}`);
  }
  assert.deepEqual(storyMapPages(764, 764, rects), [0]);
});
