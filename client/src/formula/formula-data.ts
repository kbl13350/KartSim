/** Original p3553 极速方程 tables. Rebuild with tools/export-formula-data.mjs. */
import originalData from './formula-original-data.json';

export type FormulaDifficulty = 'veasy' | 'easy' | 'normal' | 'hard';
export type FormulaGroupId = 1 | 2;
export type FormulaRound = 1 | 2 | 3;
export interface FormulaNpc {
  readonly id: number;
  readonly name: string;
  readonly characterId?: number;
  readonly kartId: number;
  readonly colorId: number;
  readonly dyeId: number;
  readonly speedWeight: number;
  readonly accelWeight: number;
}
export interface FormulaGroup {
  readonly id: FormulaGroupId;
  readonly name: string;
  readonly opened: boolean;
  readonly riders: readonly FormulaNpc[];
  readonly boost: {
    readonly chase: number;
    readonly yield: number;
    readonly intervals: readonly ({ readonly grade: number } & Readonly<Record<FormulaDifficulty, readonly [number, number]>>)[];
  };
  readonly levels: readonly {
    readonly id: number; readonly speed: number; readonly accel: number;
    readonly step1Spd: number; readonly step2Spd: number; readonly step3Spd: number;
  }[];
}
export interface FormulaPoint { readonly x: number; readonly y: number; readonly z: number }
export interface FormulaPitTriangle {
  readonly mesh: string;
  readonly a: FormulaPoint; readonly b: FormulaPoint; readonly c: FormulaPoint;
}
export interface FormulaNpcTuning {
  /** Original abstract speed and acceleration weights. Their physical units are unproven. */
  readonly speed: number;
  readonly accel: number;
  readonly boostGrade: number;
  readonly boostIntervalSeconds: readonly [number, number];
}

export const FORMULA_ROUND_COUNT = 3;
export const FORMULA_NPC_COUNT = 19;
export const FORMULA_FIELD_SIZE = 20;
export const FORMULA_DIFFICULTIES: readonly { readonly id: number; readonly key: FormulaDifficulty; readonly name: string }[] = [
  { id: 1, key: 'veasy', name: originalData.strings.level_1 },
  { id: 2, key: 'easy', name: originalData.strings.level_2 },
  { id: 3, key: 'normal', name: originalData.strings.level_3 },
  { id: 4, key: 'hard', name: originalData.strings.level_4 },
];
// Group labels are descriptive UI labels; original XML identifies these by id only.
export const FORMULA_GROUPS: readonly FormulaGroup[] = originalData.groups.map(group => ({
  ...group, name: group.id === 1 ? '传奇车手' : '黑暗车手',
})) as unknown as readonly FormulaGroup[];
export const FORMULA_RANK_WEIGHTS = originalData.rankWeights;
export const FORMULA_REWARD_TABLES = originalData.rewardTables;
export const FORMULA_MISSIONS = originalData.missions;
export const FORMULA_CHATS = originalData.chats;
export const FORMULA_CUTSCENES = originalData.cutscenes;
export const FORMULA_STRINGS = originalData.strings;
export const FORMULA_BOOSTER_DURATIONS = originalData.boosterDurations;
export const FORMULA_PROVENANCE = originalData.provenance;
export const FORMULA_PIT_SURFACES: readonly { readonly trackId: string; readonly triangles: readonly FormulaPitTriangle[] }[] = originalData.pitSurfaces;

export function getFormulaGroup(id: FormulaGroupId): FormulaGroup {
  const group = FORMULA_GROUPS.find(group => group.id === id);
  if (!group) throw new RangeError(`Unknown Formula NPC group: ${id}`);
  return group;
}

/** Public ranks/rounds are one-based; resource rankGrade endpoints are zero-based. */
export function getFormulaNpcTuning(
  groupId: FormulaGroupId, npcId: number, difficulty: FormulaDifficulty,
  playerRank: number, round: FormulaRound,
): FormulaNpcTuning {
  if (!Number.isInteger(playerRank) || playerRank < 1 || playerRank > FORMULA_FIELD_SIZE)
    throw new RangeError('Formula player rank must be between 1 and 20');
  if (!Number.isInteger(round) || round < 1 || round > FORMULA_ROUND_COUNT)
    throw new RangeError('Formula round must be between 1 and 3');
  const group = getFormulaGroup(groupId);
  const rider = group.riders.find(rider => rider.id === npcId);
  if (!rider) throw new RangeError(`Unknown Formula NPC: ${npcId}`);
  const levelId = FORMULA_DIFFICULTIES.find(level => level.key === difficulty)?.id;
  const level = group.levels.find(level => level.id === levelId);
  if (!level) throw new RangeError(`Unknown Formula difficulty: ${difficulty}`);
  const rank = FORMULA_RANK_WEIGHTS.find(row => playerRank - 1 >= row.rankGrade[0]! && playerRank - 1 <= row.rankGrade[1]!)!;
  const base = rank.riders.find(row => row.id === npcId)!;
  const interval = group.boost.intervals.find(row => row.grade === base.bstGrade)!;
  // Addition follows the source's "Weight" and "step*Spd" names. Runtime unit
  // conversion and dynamic chase/yield selection remain reconstruction choices.
  const roundSpeed = round === 1 ? level.step1Spd : round === 2 ? level.step2Spd : level.step3Spd;
  return {
    speed: base.speed + rider.speedWeight + level.speed + roundSpeed,
    accel: base.accel + rider.accelWeight + level.accel,
    boostGrade: base.bstGrade,
    boostIntervalSeconds: interval[difficulty],
  };
}

/** Exact original PIT footprint, with a small vertical contact tolerance. */
export function isFormulaPitPosition(trackId: string, position: FormulaPoint, heightTolerance = 2): boolean {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z) ||
      !Number.isFinite(heightTolerance) || heightTolerance < 0) return false;
  const normalized = trackId.replace(/^track_/i, '').replace(/\/track\.1s$/i, '').toLowerCase();
  const pit = FORMULA_PIT_SURFACES.find(pit => pit.trackId.toLowerCase() === normalized);
  if (!pit) return false;
  for (const { a, b, c } of pit.triangles) {
    const denominator = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(denominator) < 1e-10) continue;
    const u = ((b.z - c.z) * (position.x - c.x) + (c.x - b.x) * (position.z - c.z)) / denominator;
    const v = ((c.z - a.z) * (position.x - c.x) + (a.x - c.x) * (position.z - c.z)) / denominator;
    const w = 1 - u - v;
    if (u < -1e-8 || v < -1e-8 || w < -1e-8) continue;
    if (Math.abs(position.y - (u * a.y + v * b.y + w * c.y)) <= heightTolerance) return true;
  }
  return false;
}

/** Chinese original drive/end/crash/overtake lines; only replaces the player token. */
export function getFormulaChat(groupId: FormulaGroupId, type: number, playerName: string, index = 0): string | undefined {
  const lines = FORMULA_CHATS.find(group => group.groupId === groupId)?.scripts.filter(line => line.type === type) ?? [];
  if (!lines.length) return undefined;
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) % lines.length : 0;
  return lines[safeIndex]!.message.replaceAll('[UserRID]', () => playerName);
}
