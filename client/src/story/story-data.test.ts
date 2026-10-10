import assert from "node:assert/strict";
import test from "node:test";
import { readStoryChapters, readStoryEmotions, readStoryMission, readStoryScene,
  readStorySteps, storyScenePages, storyText, type StoryNode } from "./story-data";
import { clearOpenMultiplayerSteps, clearStoryStep, emptyStoryProgress, isChapterCleared,
  isChapterOpen, isStepAvailable, isStepCleared, isStepOpen, parseStoryProgress,
  requiredStepCount } from "./story-progress";
import { storyRaceOf, storyRaceOutcome } from "./story-race";

const node = (name: string, attributes: Record<string, string> = {},
  children: StoryNode[] = []): StoryNode => ({
  name, children,
  attributes: Object.entries(attributes).map(([key, value]) => ({ name: key, value })),
});

test("故事文本用 | 分行", () => {
  assert.equal(storyText("第一行。| 第二行 |"), "第一行。\n第二行");
  assert.equal(storyText(undefined), "");
});

test("章节列表：主线章节按章序排在前面，跳过未开放章节", () => {
  const chapters = readStoryChapters(node("ScenarioList", {}, [
    node("Restriction", { preset: "pcCafeLogin" }),
    node("Chapter", { id: "60", name: "chapter_tomb", title: "南瓜", desc: "甲\n乙" }),
    node("Chapter", { id: "38", name: "chapter2", regularChapter: "true", title: "第二", subTitle: "第二章", desc: "" }),
    node("Chapter", { id: "37", name: "chapter1", regularChapter: "true", title: "第一", desc: "" }),
    node("Chapter", { id: "3", name: "old", active: "false", title: "旧" }),
    node("Chapter", { id: "52", name: "chapter_olympos2", title: "危机", preClearChapterId: "51" }),
  ]));
  assert.deepEqual(chapters.map(chapter => chapter.name),
    ["chapter1", "chapter2", "chapter_tomb", "chapter_olympos2"]);
  assert.equal(chapters[2]!.desc, "甲\n乙");
  assert.equal(chapters[1]!.subTitle, "第二章");
  assert.equal(chapters[3]!.preClearChapterId, 51);
});

test("关卡列表读取标题、前置关卡和奖励", () => {
  const steps = readStorySteps(node("StepList", {}, [
    node("Step", { id: "2", title: "对决", preConditionId: "1", readyStage: "1-2",
      synopsis: "A|B", howToClear: "赢", missionText: "对决胜利 %d回/%d回", visualScene: "scene2" },
    [node("Level", { difficult: "0", prize: "气球(30个)" })]),
    node("Step", { id: "1", title: "初来乍到", readyStage: "1-1" }),
    node("Step", { id: "12", title: "汇合", readyStage: "1-12", preConditionId: "10|11" }),
    node("Step", { id: "10", title: "岔路", readyStage: "1-10", preConditionId: "09",
      otherWayLockId: "11" }),
  ]));
  assert.deepEqual(steps.map(step => step.id), [1, 2, 10, 12]);
  assert.deepEqual(steps[1]!.preConditionIds, [1]);
  assert.deepEqual(steps[0]!.preConditionIds, []);
  assert.deepEqual(steps[2]!.preConditionIds, [9]);
  assert.deepEqual(steps[2]!.otherWayLockIds, [11]);
  assert.deepEqual(steps[3]!.preConditionIds, [10, 11]);
  assert.equal(steps[1]!.synopsis, "A\nB");
  assert.equal(steps[1]!.prize, "气球(30个)");
  assert.equal(steps[0]!.visualScene, undefined);
});

test("比赛定义：计时与影子对决", () => {
  const timeAttack = readStoryMission(node("Root", {}, [
    node("BaseParam", { levelSpec: "1" }),
    node("TimeAttack", { isFixedKart: "true", fixedKartId: "849", isFixedChar: "true", fixedCharId: "2" }, [
      node("LevelContent", { level: "1", track: "x", laps: "2" }),
      node("LevelContent", { level: "0", track: "village_I03", laps: "3", timeLimit: "0" }),
    ]),
  ]));
  assert.deepEqual(timeAttack, { kind: "TimeAttack", fixedKartId: 849, fixedCharId: 2,
    track: "village_I03", laps: 3, timeLimitMs: 0, speed: 0, rival: undefined, chase: undefined });

  const shadow = readStoryMission(node("Root", {}, [
    node("BaseParam"),
    node("Shadow", { isFixedKart: "false", fixedKartId: "849", kartId: "849", characterId: "3",
      characterName: "黑妞" }, [
      node("LevelContent", { level: "0", ksv: "forest_I01_0", track: "forest_I01", laps: "3" }),
    ]),
  ]));
  assert.equal(shadow.fixedKartId, undefined);
  assert.equal(shadow.speed, 0);
  assert.deepEqual(shadow.rival, { ksv: "forest_I01_0", kartId: 849, characterId: 3, name: "黑妞" });
  assert.throws(() => readStoryMission(node("Root", {}, [node("BaseParam")])), /比赛定义/);

  // checkPoint.bml / knockout.bml keep the track on the race element.
  const checkPoint = readStoryMission(node("Root", {}, [
    node("BaseParam", { gameSpeed: "7" }),
    node("TimeAttack", { track: "village_S01", laps: "1", isFixedKart: "true", fixedKartId: "888" }, [
      node("LevelContent", { level: "0", timeLimit: "15000", timeValue: "13000;14000" }),
    ]),
  ]), "CheckPoint");
  assert.deepEqual(checkPoint, { kind: "CheckPoint", fixedKartId: 888, fixedCharId: undefined,
    track: "village_S01", laps: 1, timeLimitMs: 15_000, speed: 7, rival: undefined,
    chase: undefined });

  const tracing = readStoryMission(node("Root", {}, [
    node("BaseParam", { gameSpeed: "0" }),
    node("Tracing", { kartId: "875", characterId: "5", characterName: "胖墩" }, [
      node("LevelContent", { level: "0", track: "ice_I02", laps: "3", ksv: "ice_I02_0",
        distance: "20", startOffset: "1000" }),
    ]),
  ]));
  assert.deepEqual(tracing.chase, { startOffsetMs: 1000, distanceM: 20 });
  assert.equal(tracing.rival?.name, "胖墩");

  // Castle_Episode3 keeps the rival on LevelContent.
  const castle = readStoryMission(node("Root", {}, [
    node("BaseParam", { levelSpec: "1" }),
    node("Shadow", {}, [node("LevelContent", { level: "0", ksv: "step10", track: "x", laps: "2",
      kartId: "273", characterId: "4", characterName: "路易" })]),
  ]));
  assert.deepEqual(castle.rival, { ksv: "step10", kartId: 273, characterId: 4, name: "路易" });
});

test("剧情脚本按 <Enter/> 分页并保留人物状态", () => {
  const commands = readStoryScene(node("Scene", {}, [
    node("BackGround", { texture: "vill5" }),
    node("Char", { id: "dao", pos: "7.5 0", emotion: "stop1" }),
    node("Msg", { name: "皮蛋", string: "你好！|我叫皮蛋！" }),
    node("Enter"),
    node("Char", { id: "dizini", pos: "11 0", flip: "true", emotion: "stop3" }),
    node("Char", { id: "dao", emotion: "stop2" }),
    node("Shake", { time: "700" }),
    node("Msg", { name: "黑妞", string: "哼" }),
    node("Enter"),
    node("Char", { id: "dao", remove: "true" }),
    node("Msg", { name: "黑妞", string: "走吧" }),
    node("Enter"),
  ]));
  const pages = storyScenePages(commands);
  assert.equal(pages.length, 3);
  assert.deepEqual(pages[0], { background: "vill5", speaker: "皮蛋", text: "你好！\n我叫皮蛋！",
    shakeMs: undefined, sound: undefined,
    characters: [{ id: "dao", x: 7.5, flip: false, emotion: "stop1" }] });
  assert.deepEqual(pages[1]!.characters, [
    { id: "dao", x: 7.5, flip: false, emotion: "stop2" },
    { id: "dizini", x: 11, flip: true, emotion: "stop3" },
  ]);
  assert.equal(pages[1]!.shakeMs, 700);
  assert.deepEqual(pages[2]!.characters.map(character => character.id), ["dizini"]);
});

test("人物表情表", () => {
  const emotions = readStoryEmotions(node("emotion", {}, [
    node("dao", {}, [node("normal", { texture: "다오_01" }),
      node("ani1", { texture: "다오_01", texture2: "다오_02" })]),
  ]));
  assert.deepEqual(emotions.get("dao")?.get("ani1"), ["다오_01", "다오_02"]);
});

test("通关进度：前置关卡与章节解锁", () => {
  let progress = emptyStoryProgress();
  const step2 = { id: 2, preConditionIds: [1], otherWayLockIds: [] };
  assert.equal(isStepOpen(progress, "chapter1", step2), false);
  progress = clearStoryStep(progress, "chapter1", 1);
  assert.equal(clearStoryStep(progress, "chapter1", 1), progress);
  assert.equal(isStepCleared(progress, "chapter1", 1), true);
  assert.equal(isStepOpen(progress, "chapter1", step2), true);

  const chapters = [
    { id: 37, name: "chapter1", title: "", desc: "", regular: true, showNew: false },
    { id: 38, name: "chapter2", title: "", desc: "", regular: true, showNew: false },
    { id: 52, name: "olympos2", title: "", desc: "", regular: false, preClearChapterId: 51,
      showNew: false },
    { id: 51, name: "olympos", title: "", desc: "", regular: false, showNew: false },
  ];
  const line = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: index + 1, isFinalStep: index === count - 1,
    preConditionIds: index ? [index] : [] }));
  const steps = new Map([["chapter1", line(2)], ["chapter2", line(1)], ["olympos", line(1)],
    ["olympos2", line(1)]]);
  assert.equal(isChapterOpen(progress, chapters[0]!, chapters, steps), true);
  assert.equal(isChapterOpen(progress, chapters[1]!, chapters, steps), false);
  assert.equal(isChapterOpen(progress, chapters[2]!, chapters, steps), false);
  progress = clearStoryStep(clearStoryStep(progress, "chapter1", 2), "olympos", 1);
  assert.equal(isChapterOpen(progress, chapters[1]!, chapters, steps), true);
  assert.equal(isChapterOpen(progress, chapters[2]!, chapters, steps), true);
});

test("分支关卡：任一前置通关即开放，另一条路通关后关闭", () => {
  let progress = clearStoryStep(emptyStoryProgress(), "c", 9);
  const left = { id: 10, preConditionIds: [9], otherWayLockIds: [11] };
  const right = { id: 11, preConditionIds: [9], otherWayLockIds: [10] };
  const merge = { id: 12, preConditionIds: [10, 11], otherWayLockIds: [] };
  assert.equal(isStepAvailable(progress, "c", left), true);
  assert.equal(isStepAvailable(progress, "c", right), true);
  assert.equal(isStepAvailable(progress, "c", merge), false);
  progress = clearStoryStep(progress, "c", 11);
  assert.equal(isStepAvailable(progress, "c", left), false);
  assert.equal(isStepAvailable(progress, "c", right), true);
  assert.equal(isStepAvailable(progress, "c", merge), true);
});

test("\"0\" 前置表示直接开放", () => {
  const steps = readStorySteps(node("StepList", {}, [
    node("Step", { id: "1", readyStage: "1-1", preConditionId: "0" }),
  ]));
  assert.deepEqual(steps[0]!.preConditionIds, []);
  assert.equal(isStepOpen(emptyStoryProgress(), "c", steps[0]!), true);
});

test("章节通关看最终关；岔路只需走一条", () => {
  // 9 → (10 | 11) → 12 (final); 10 and 11 lock each other.
  const steps = [
    { id: 9, isFinalStep: false, preConditionIds: [] },
    { id: 10, isFinalStep: false, preConditionIds: [9] },
    { id: 11, isFinalStep: false, preConditionIds: [9] },
    { id: 12, isFinalStep: true, preConditionIds: [10, 11] },
  ];
  assert.equal(requiredStepCount(steps), 3);
  let progress = clearStoryStep(clearStoryStep(emptyStoryProgress(), "c", 9), "c", 11);
  assert.equal(isChapterCleared(progress, "c", steps), false);
  progress = clearStoryStep(progress, "c", 12);
  assert.equal(isChapterCleared(progress, "c", steps), true);
  // Without isFinalStep, the steps nothing depends on end the chapter.
  assert.equal(isChapterCleared(progress, "c",
    steps.map(step => ({ ...step, isFinalStep: false }))), true);
});

test("多人任务关开放后自动视为完成", () => {
  const steps = [
    { id: 1, mode: "single" as const, preConditionIds: [], otherWayLockIds: [] },
    { id: 2, mode: "multi" as const, preConditionIds: [1], otherWayLockIds: [] },
    { id: 3, mode: "multi" as const, preConditionIds: [2], otherWayLockIds: [] },
    { id: 4, mode: "single" as const, preConditionIds: [3], otherWayLockIds: [] },
  ];
  const empty = emptyStoryProgress();
  assert.equal(clearOpenMultiplayerSteps(empty, "c", steps), empty);
  const done = clearOpenMultiplayerSteps(clearStoryStep(empty, "c", 1), "c", steps);
  assert.deepEqual(done.cleared.c, [1, 2, 3]);
});

test("进度存档容错", () => {
  assert.deepEqual(parseStoryProgress("{bad"), { cleared: {} });
  assert.deepEqual(parseStoryProgress(JSON.stringify({ cleared: { a: [1, 1, "x", 2.5, 3] } })),
    { cleared: { a: [1, 3] } });
});

test("故事比赛请求与结果", () => {
  assert.equal(storyRaceOf({ trackId: "x" }), undefined);
  const story = { ghosts: [], restore() {}, onReturn() {} };
  assert.equal(storyRaceOf({ story }), story);
  assert.deepEqual(storyRaceOutcome({ lifecycle: { finishElapsedMs: 0 } }),
    { finished: false, elapsedMs: 0 });
  assert.deepEqual(storyRaceOutcome({ lifecycle: { finishElapsedMs: 95_000 } }),
    { finished: true, elapsedMs: 95_000 });
});
