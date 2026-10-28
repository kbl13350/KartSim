import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FORMULA_BOOSTER_DURATIONS, FORMULA_CHATS, FORMULA_DIFFICULTIES, FORMULA_GROUPS, FORMULA_MISSIONS,
  FORMULA_PIT_SURFACES, FORMULA_PROVENANCE, FORMULA_RANK_WEIGHTS, FORMULA_REWARD_TABLES,
  getFormulaChat, getFormulaGroup, getFormulaNpcTuning, isFormulaPitPosition,
  type FormulaRound,
} from './formula-data';

test('original CN Formula table preserves both complete 19-rider groups and every rank grade', () => {
  assert.deepEqual(FORMULA_GROUPS.map(group => group.id), [1, 2]);
  for (const group of FORMULA_GROUPS) {
    assert.equal(group.opened, true);
    assert.deepEqual(group.riders.map(rider => rider.id), Array.from({ length: 19 }, (_, i) => i + 1));
    assert.equal(group.levels.length, 4);
    assert.equal(group.boost.intervals.length, 9);
  }
  assert.equal(getFormulaGroup(1).riders[0]?.name, '尼欧');
  assert.equal(getFormulaGroup(1).riders[1]?.name, '塞里吾斯', 'use current CN roster, not the conflicting older string bag');
  assert.equal(getFormulaGroup(2).riders[2]?.kartId, 516);
  assert.deepEqual(FORMULA_DIFFICULTIES.map(level => level.name), ['极易', '容易', '普通', '困难']);
  assert.deepEqual(FORMULA_RANK_WEIGHTS.map(rank => rank.rankGrade),
    Array.from({ length: 10 }, (_, i) => [i * 2, i * 2 + 1]));
  assert.ok(FORMULA_RANK_WEIGHTS.every(row => row.riders.length === 19));
});

test('rank/difficulty/round adjustment keeps original parameters and interval endpoints', () => {
  assert.deepEqual(getFormulaNpcTuning(1, 1, 'normal', 1, 1),
    { speed: 52, accel: 28, boostGrade: 3, boostIntervalSeconds: [8, 12] });
  assert.equal(getFormulaNpcTuning(1, 1, 'hard', 1, 2).speed, 56);
  assert.equal(getFormulaNpcTuning(1, 1, 'hard', 1, 3).speed, 55);
  assert.equal(getFormulaNpcTuning(1, 1, 'veasy', 20, 1).speed, 45);
  assert.deepEqual(getFormulaNpcTuning(1, 19, 'normal', 1, 1).boostIntervalSeconds, [3, 4]);
  assert.deepEqual(getFormulaNpcTuning(2, 19, 'normal', 1, 1).boostIntervalSeconds, [3, 6]);
  for (const group of FORMULA_GROUPS) for (const npc of group.riders) for (const level of FORMULA_DIFFICULTIES) {
    for (let rank = 1; rank <= 20; rank++) for (const round of [1, 2, 3] as FormulaRound[]) {
      const tuning = getFormulaNpcTuning(group.id, npc.id, level.key, rank, round);
      assert.ok(Number.isFinite(tuning.speed) && tuning.speed > 0);
      assert.ok(Number.isFinite(tuning.accel) && tuning.accel > 0);
      assert.ok(tuning.boostIntervalSeconds[0] > 0);
      assert.ok(tuning.boostIntervalSeconds[1] >= tuning.boostIntervalSeconds[0]);
    }
  }
  for (const rank of [0, 21, 1.5, NaN, Infinity])
    assert.throws(() => getFormulaNpcTuning(1, 1, 'normal', rank, 1), /rank/);
  assert.throws(() => getFormulaNpcTuning(1, 20, 'normal', 1, 1), /NPC/);
  assert.throws(() => getFormulaNpcTuning(1, 1, 'normal', 1, 4 as FormulaRound), /round/);
});

test('PIT contact uses the original triangulated footprint and original track coordinates', () => {
  assert.deepEqual(FORMULA_PIT_SURFACES.map(pit => [pit.trackId, pit.triangles.length]),
    [['wkc_R01', 6], ['wkc_R03', 57], ['wkc_R04', 75]]);
  assert.deepEqual(FORMULA_PIT_SURFACES[0]!.triangles[0]!.a,
    { x: 947.9828491210938, y: 15.293336868286133, z: -931.2894287109375 });
  let tested = 0;
  for (const pit of FORMULA_PIT_SURFACES) for (const { a, b, c } of pit.triangles) {
    const area = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(area) < 1e-10) continue;
    const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3, z: (a.z + b.z + c.z) / 3 };
    assert.equal(isFormulaPitPosition(pit.trackId, center), true);
    assert.equal(isFormulaPitPosition(`track_${pit.trackId}/track.1s`, center), true);
    assert.equal(isFormulaPitPosition(pit.trackId, { ...center, y: center.y + 1000 }), false);
    tested++;
  }
  assert.ok(tested >= 130);
  assert.equal(isFormulaPitPosition('wkc_R01', { x: 0, y: 0, z: 0 }), false);
  assert.equal(isFormulaPitPosition('unknown', { x: 934, y: 15.3, z: -900 }), false);
  assert.equal(isFormulaPitPosition('wkc_R01', { x: NaN, y: 15.3, z: -900 }), false);
  assert.equal(isFormulaPitPosition('wkc_R01', { x: 934, y: 15.3, z: -900 }, -1), false);
});

test('original rewards and chat preserve source data and substitution stays literal', () => {
  assert.deepEqual(FORMULA_REWARD_TABLES.map(table => [table.grade, table.rewards.reduce((sum, reward) => sum + reward.prob, 0)]),
    [['normal', 100], ['rare', 95], ['pcCafe', 100]], 'the original rare weights total 95; never rewrite them to pretend they total 100');
  assert.equal(FORMULA_MISSIONS.find(mission => mission.type === 3)?.conditions.at(-1)?.condition, 30);
  assert.equal(FORMULA_CHATS.length, 2);
  assert.equal(getFormulaChat(1, 0, '$&车手', 0), '尼欧 : $&车手! 这次就用实力见证胜负吧！哈哈哈');
  assert.equal(getFormulaChat(1, 999, '玩家'), undefined);
  assert.deepEqual(FORMULA_BOOSTER_DURATIONS, { boostDurationMs: 2400, stunDurationMs: 2000 });
  assert.equal(FORMULA_PROVENANCE.sources.length, 8);
  assert.ok(FORMULA_PROVENANCE.sources.every(source => /^[0-9a-f]{64}$/.test(source.sha256)));
  assert.ok(FORMULA_PROVENANCE.notes.some(note => note.includes('not stored')));
});
