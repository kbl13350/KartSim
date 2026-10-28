import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate } from "node:timers/promises";
import { getFormulaGroup } from "../formula/formula-data";
import type { FormulaRoundResult } from "../formula/formula-engine";
import { formulaResultTime, type FormulaResultsOptions, type FormulaSetupOptions } from "../formula/formula-ui";
import { storyRaceOf } from "../story/story-race";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import type { ReadyHomeController } from "./ready-home";
import { FORMULA_TRACKS, formulaGhostSources, openReadyFormula, type FormulaFlowDependencies } from "./ready-formula";

function fixture() {
  const original: ReadySelection = { trackId: "village_R01", mapPath: "old/track.1s",
    vehicleItemId: 1, characterItemId: 1, vehiclePath: "kart", characterPath: "character" };
  const originalOptions: ReadyOptions = { speed: 2, settingSpeed: 2, showGhost: false, booster: 1, version: "国服" };
  let selection = original;
  let options = originalOptions;
  let fail = false;
  const starts: ReadySelection[] = [];
  const setups: FormulaSetupOptions[] = [];
  const results: FormulaResultsOptions[] = [];
  const reports: unknown[] = [];
  const shell = { started: false, current: "Ready" };
  const handle = () => ({ element: {} as HTMLElement, dispose() {} });
  const library = { canonicalCandidates: () => [],
    timeAttackTrackCatalog: async () => FORMULA_TRACKS.map(id => ({ id, path: `track_${id}/track.1s` })) };
  const controller = {
    disposed: false, activeHome: {},
    host: { root: {} as HTMLElement, shell, getSelection: () => selection,
      setSelection: (value: ReadySelection) => { selection = value; },
      getReadyOptions: () => options, setReadyOptions: (value: ReadyOptions) => { options = value; },
      getLibrary: () => library },
    startRaceFromReady: async (value: ReadySelection, settings: ReadyOptions) => {
      starts.push(value); selection = value; options = settings;
      shell.started = !fail; shell.current = fail ? "Ready" : "Game";
    },
  } as unknown as ReadyHomeController;
  const dependencies: FormulaFlowDependencies = {
    openSetup: async value => { setups.push(value); return handle(); },
    openResults: async value => { results.push(value); return handle(); },
    openHome: async () => {}, report: (_controller, error) => { reports.push(error); },
  };
  const returned = async (result?: FormulaRoundResult, twice = false) => {
    const story = storyRaceOf(starts.at(-1))!;
    assert.ok(story.formula);
    story.formula.result = result;
    shell.started = false; shell.current = "Ready";
    story.restore();
    story.onReturn({ finished: !!result, elapsedMs: result?.elapsedMs ?? 0 });
    if (twice) story.onReturn({ finished: true, elapsedMs: result?.elapsedMs ?? 0 });
    await setImmediate();
  };
  return { controller, dependencies, starts, setups, results, reports, original, originalOptions,
    get selection() { return selection; }, get options() { return options; },
    set fail(value: boolean) { fail = value; }, returned };
}

function roundResult(round: number): FormulaRoundResult {
  return { round, playerRank: 1, hits: 3, elapsedMs: 180_000,
    standings: Array.from({ length: 20 }, (_unused, id) => ({ id, name: id === 0 ? "我" : `NPC ${id}`,
      rank: id + 1, distance: 1000 - id, finishedMs: id === 19 ? undefined : 100_000 + id * 1000,
      dnf: id === 19, points: id === 19 ? 0 : 20 - id })) };
}

test("极速方程依次启动原三条 PIT 赛道，保留20人累计积分并恢复原玩家设置", async () => {
  const f = fixture();
  await openReadyFormula(f.controller, f.dependencies);
  await openReadyFormula(f.controller, f.dependencies);
  assert.equal(f.setups.length, 1, "double entry cannot open two championships");
  assert.equal(f.setups[0]!.tracks?.length, 3);
  f.setups[0]!.onStart("hard");
  f.setups[0]!.onStart("easy");
  await setImmediate();
  for (let round = 1; round <= 3; round++) {
    assert.equal(f.starts.length, round);
    const selection = f.starts.at(-1)!;
    const story = storyRaceOf(selection)!;
    assert.equal(selection.trackId, FORMULA_TRACKS[round - 1]);
    assert.equal(story.formula?.difficulty, "hard");
    assert.equal(story.formula?.round, round);
    assert.equal(story.formula?.groupId, round === 3 ? 2 : 1);
    assert.equal(story.ghosts[1]!.equipment.playerName, round === 3 ? "MR. SUN" : "塞里吾斯");
    assert.equal(story.ghosts.length, 19);
    assert.equal(story.laps, undefined, "track metadata decides laps");
    await f.returned(roundResult(round), true);
    assert.equal(f.results.length, round, "duplicate return cannot settle twice");
    assert.equal(f.selection, f.original);
    assert.equal(f.options, f.originalOptions);
    const result = f.results.at(-1)!;
    assert.equal(result.rows.length, 20);
    assert.equal(result.totals.length, 20);
    assert.equal(result.totals.find(row => row.isPlayer)?.totalPoints, 20 * round);
    assert.equal(result.rows.find(row => row.id === "19")?.dnf, true);
    assert.equal(result.final, round === 3);
    if (round < 3) { result.onNext(); result.onNext(); await setImmediate(); }
  }
  assert.equal(f.reports.length, 0);
  f.results.at(-1)!.onNext();
  await setImmediate();
  assert.equal(f.setups.length, 2, "restart returns to difficulty selection");
  f.setups.at(-1)!.onStart("easy");
  await setImmediate();
  assert.equal(storyRaceOf(f.starts.at(-1))?.formula?.round, 1);
  await f.returned(roundResult(1));
  assert.equal(f.results.at(-1)!.totals.find(row => row.isPlayer)?.points, 20, "restart has no previous points");
});

test("退出未结算的方程式比赛会取消赛事，后续入口开启新的第一回合", async () => {
  const f = fixture();
  await openReadyFormula(f.controller, f.dependencies);
  f.setups[0]!.onStart("normal");
  await setImmediate();
  const staleStory = storyRaceOf(f.starts[0])!;
  await f.returned();
  assert.equal(f.results.length, 0);
  assert.equal(f.selection, f.original);
  await openReadyFormula(f.controller, f.dependencies);
  assert.equal(f.setups.length, 2);
  staleStory.formula!.result = roundResult(1);
  staleStory.onReturn({ finished: true, elapsedMs: 100_000 });
  await setImmediate();
  assert.equal(f.results.length, 0, "old callbacks cannot affect the new championship");
});

test("载入失败恢复车辆与选项，下一回合失败仍保留累计分供重试", async () => {
  const f = fixture();
  f.fail = true;
  await openReadyFormula(f.controller, f.dependencies);
  f.setups[0]!.onStart("easy");
  await setImmediate();
  assert.equal(f.selection, f.original);
  assert.equal(f.options, f.originalOptions);
  assert.equal(f.setups.length, 2);
  assert.equal(f.reports.length, 1);
  f.fail = false;
  f.setups.at(-1)!.onStart("easy");
  await setImmediate();
  await f.returned(roundResult(1));
  f.fail = true;
  f.results.at(-1)!.onNext();
  await setImmediate();
  assert.equal(f.results.at(-1)!.round, 1);
  assert.equal(f.results.at(-1)!.totals.find(row => row.isPlayer)?.points, 20);
  assert.equal(f.selection, f.original);
  f.fail = false;
  f.results.at(-1)!.onNext();
  await setImmediate();
  assert.equal(storyRaceOf(f.starts.at(-1))?.formula?.round, 2);
});

test("NPC ghost载入保留原车手装备、姓名、19个独立起跑槽和boost特效状态", () => {
  for (const groupId of [1, 2] as const) {
    const riders = getFormulaGroup(groupId).riders;
    const ghosts = formulaGhostSources(groupId);
    assert.equal(ghosts.length, 19);
    ghosts.forEach((ghost, index) => {
      const rider = riders[index]!;
      assert.equal(ghost.solid, true);
      assert.equal(ghost.hideCharacter, rider.characterId === undefined);
      assert.equal(ghost.equipment.startSlot, index + 1);
      assert.equal(ghost.equipment.playerName, rider.name);
      assert.equal(ghost.equipment.kart, rider.kartId);
      assert.equal(ghost.equipment.kartPaint, rider.colorId);
      assert.equal(ghost.equipment.characterColor, rider.dyeId);
      if (rider.characterId) assert.equal(ghost.equipment.character, rider.characterId);
      assert.deepEqual(ghost.record, { stamps: [{ status: 0 }, { status: 3 }] });
    });
  }
});

test("DNF在结果表中明确显示，毫秒不会四舍五入改变完赛顺序", () => {
  assert.equal(formulaResultTime({ dnf: true, elapsedMs: 90_001 }), "DNF");
  assert.equal(formulaResultTime({ elapsedMs: 59_999.9 }), "0:59.999");
  assert.equal(formulaResultTime({ elapsedMs: 60_001 }), "1:00.001");
  assert.equal(formulaResultTime({ elapsedMs: NaN }), "—");
  assert.equal(formulaResultTime({}), "—");
});
