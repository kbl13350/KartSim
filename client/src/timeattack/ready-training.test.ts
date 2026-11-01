import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { trackMetadataOverride } from "../resources/track-overrides";
import { storyRaceOf } from "../story/story-race";
import type { TrainingLesson } from "../training/training-catalog";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import type { ReadyHomeController } from "./ready-home";
import { openTrainingPractice, type TrainingPracticeDependencies } from "./ready-training";

const lesson = (changes: Partial<TrainingLesson> = {}): TrainingLesson => ({
  id: "31", level: 3, step: 1, title: "驾驶技巧", icon: "missionIcon", track: "village_training_test",
  kartId: 1518, type: 0, parameters: { lap: "2" }, subjects: [], missions: [], rewardStockId: 0, ...changes,
});

function fixture() {
  const original: ReadySelection = { trackId: "village_R01", mapPath: "old/track.1s", vehicleItemId: 1,
    vehiclePath: "kart_/old/model.1s", characterItemId: 2, characterPath: "character_/dao/model.1s", ranked: {} };
  const originalOptions: ReadyOptions = { speed: 4, settingSpeed: 4, version: "国服", showGhost: true, booster: 1 };
  let selected = original, options = originalOptions, fail = false;
  let tracks: Array<{ id: string; path: string }> = [];
  let maps = [{ virtualPath: "track_/village_training_test/track.1s" }];
  const starts: ReadySelection[] = [], returned: TrainingLesson[] = [], reports: unknown[] = [];
  const shell = { started: false, current: "Ready" };
  const library = { mapAssets: () => maps, timeAttackTrackCatalog: async () => tracks,
    timeAttackGarageCatalog: async () => ({ karts: [{ itemId: 1518, path: "kart_/cottonXUN/model.1s" }] }) };
  const controller = { disposed: false,
    host: { shell, getLibrary: () => library, getSelection: () => selected,
      getReadyOptions: () => options, setSelection: (value: ReadySelection) => { selected = value; },
      setReadyOptions: (value: ReadyOptions) => { options = value; } },
    startRaceFromReady: async (selection: ReadySelection, settings: ReadyOptions) => {
      starts.push(selection); selected = selection; options = settings;
      shell.started = !fail; shell.current = fail ? "Ready" : "Game";
    },
  } as unknown as ReadyHomeController;
  const flow: TrainingPracticeDependencies = { openHome: async (_controller, value) => { returned.push(value); },
    report: (_controller, error) => { reports.push(error); } };
  return { controller, library, shell, flow, starts, returned, reports, original, originalOptions,
    get selected() { return selected; }, get options() { return options; },
    set maps(value: typeof maps) { maps = value; }, set tracks(value: typeof tracks) { tracks = value; },
    set fail(value: boolean) { fail = value; } };
}

test("学院练习使用原生课程和指定车辆，不携带排位、技巧判定或计时赛录像", async () => {
  const f = fixture(), selectedLesson = lesson();
  assert.equal(await openTrainingPractice(f.controller, selectedLesson, f.flow), true);
  assert.equal(f.starts.length, 1);
  assert.equal(f.selected.mapPath, "track_/village_training_test/track.1s");
  assert.equal(f.selected.vehicleItemId, 1518);
  assert.equal(f.selected.vehiclePath, "kart_/cottonXUN/model.1s");
  assert.equal(f.selected.characterItemId, 2);
  assert.equal(f.selected.ranked, undefined);
  assert.deepEqual(f.options, { ...f.originalOptions, booster: 0, showGhost: false });
  const story = storyRaceOf(f.selected)!;
  assert.deepEqual(story.ghosts, []);
  assert.equal(story.laps, 2);
  assert.equal(story.judge, undefined);
  assert.equal(story.license, undefined);
  assert.equal(trackMetadataOverride(selectedLesson.track)?.laps, 2);
  story.restore();
  story.onReturn({ finished: false, elapsedMs: 0 });
  story.onReturn({ finished: false, elapsedMs: 0 });
  await setImmediate();
  assert.equal(f.selected, f.original);
  assert.equal(f.options, f.originalOptions);
  assert.equal(f.controller.homeRequested, true);
  assert.equal(f.controller.homePage, "single");
  assert.deepEqual(f.returned, [selectedLesson]);
});

test("课程车辆为0时保留原车，已有赛道目录按原路径进入", async () => {
  const f = fixture();
  f.tracks = [{ id: "village_training_test", path: "track_/aliased_training/track.1s" }];
  f.maps = [];
  assert.equal(await openTrainingPractice(f.controller, lesson({ kartId: 0, parameters: {} }), f.flow), true);
  assert.equal(f.selected.vehiclePath, f.original.vehiclePath);
  assert.equal(f.selected.vehicleItemId, f.original.vehicleItemId);
  assert.equal(f.selected.mapPath, "track_/aliased_training/track.1s");
  assert.equal(storyRaceOf(f.selected)?.laps, 1);
});

test("共享开赛器吞掉载入失败后仍恢复原选择，下一次可以重试", async () => {
  const f = fixture();
  f.fail = true;
  assert.equal(await openTrainingPractice(f.controller, lesson(), f.flow), false);
  assert.equal(f.selected, f.original);
  assert.equal(f.options, f.originalOptions);
  assert.equal(f.reports.length, 1);
  assert.equal(f.returned.length, 1);
  f.fail = false;
  assert.equal(await openTrainingPractice(f.controller, lesson(), f.flow), true);
  assert.equal(f.starts.length, 2);
});

test("缺少原生赛道或指定车辆时不启动其他课程", async () => {
  for (const missing of ["track", "kart"]) {
    const f = fixture();
    if (missing === "track") f.maps = [];
    assert.equal(await openTrainingPractice(f.controller, lesson(missing === "kart" ? { kartId: 9999 } : {}), f.flow), false);
    assert.equal(f.starts.length, 0);
    assert.equal(f.selected, f.original);
    assert.equal(f.options, f.originalOptions);
    assert.equal(f.reports.length, 1);
  }
});

test("课程资源载入期间重复点击只开一场，已离开的控制器不再开赛", async () => {
  const f = fixture();
  let release!: (value: Array<{ id: string; path: string }>) => void;
  f.library.timeAttackTrackCatalog = () => new Promise(resolve => { release = resolve; });
  const first = openTrainingPractice(f.controller, lesson(), f.flow);
  assert.equal(await openTrainingPractice(f.controller, lesson(), f.flow), false);
  f.controller.disposed = true;
  release([]);
  assert.equal(await first, false);
  assert.equal(f.starts.length, 0);
  assert.equal(f.reports.length, 0);
});
