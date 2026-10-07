const SCORE_FIELDS = [
  "TransAccelFactor", "DriftEscapeForce", "SteerConstraint",
  "NormalBoosterTime", "DriftMaxGauge",
] as const;

const WEIGHT_LENGTHS: Record<string, number[]> = {
  "x-v1": [4, 1, 3, 2, 1],
  "xun-body": [3, 1, 2, 2, 1],
  "xun-parts": [3, 1, 2, 2, 1],
};

const PART_CATEGORY_FIELDS = new Map([
  [72, "TransAccelFactor"], [73, "SteerConstraint"],
  [74, "DriftEscapeForce"], [75, "NormalBoosterTime"],
]);

const LEGACY_SPEC_FIELDS = {
  TransAccelFactor: "transAccelFactor",
  DriftEscapeForce: "driftEscapeForce",
  SteerConstraint: "steerConstraint",
  NormalBoosterTime: "normalBoosterTime",
  DriftMaxGauge: "driftMaxGauge",
} as const;

const SKILL_SCORE_FIELDS = [
  "TransAccelFactor", "DriftEscapeForce", "NormalBoosterTime", "DriftMaxGauge",
] as const;

export interface GarageScoreWeightRow {
  values: number[];
  fallback: number;
}

export interface GarageScoreWeightTable {
  kind: string;
  rows: Map<string, GarageScoreWeightRow>;
}

function finiteScore(value: number): number {
  const rounded = Math.fround(value);
  if (!Number.isFinite(rounded))
    throw new Error("车库评分包含非有限数值。");
  return rounded;
}

/** The release rounds through float32 before applying its asymmetric half step. */
export function roundGarageScore(value: number): number {
  const round = Math.fround;
  return round(Math.floor(round(value + (value < 0 ? -0.5 : 0.5))));
}

/** Project a raw body parameter onto the displayed score weight table. */
export function projectGarageScoreField(field: string, value: number | undefined,
  table: GarageScoreWeightTable): number {
  const row = table.rows.get(field);
  if (!row) throw new Error(`车库评分权重缺失：${field}。`);
  const fieldIndex = SCORE_FIELDS.indexOf(field as typeof SCORE_FIELDS[number]);
  if (row.values.length !== WEIGHT_LENGTHS[table.kind]?.[fieldIndex])
    throw new Error(`车库评分权重长度无效：${field}。`);
  const weights = row.values.map(finiteScore);
  const input = finiteScore(value ?? row.fallback);
  const round = Math.fround;
  let score: number;
  switch (field) {
    case "TransAccelFactor": {
      const scale = table.kind === "x-v1" && input <= round(1.85) ?
        weights[3]! : weights[2]!;
      score = roundGarageScore(round(round(round(input - weights[1]!) * scale) +
        weights[0]!));
      break;
    }
    case "DriftEscapeForce":
      score = round(input / weights[0]!);
      break;
    case "SteerConstraint":
      score = roundGarageScore(table.kind === "x-v1" ?
        round(round(round(input - weights[1]!) * weights[2]!) + weights[0]!) :
        round(round(input + weights[0]!) * weights[1]!));
      break;
    case "NormalBoosterTime":
      score = table.kind === "x-v1" ?
        round(round(input - weights[1]!) + weights[0]!) :
        round(round(input - round(-weights[0]!)) - round(-weights[1]!));
      break;
    case "DriftMaxGauge":
      score = round(input * weights[0]!);
      break;
    default:
      return finiteScore(undefined as unknown as number);
  }
  return finiteScore(score);
}

/** Clamp native score conversion to its 32-bit domain, then keep 16 bits. */
export function garageScoreInteger(value: number): number {
  if (!Number.isFinite(value) || value < -2_147_483_648 ||
      value >= 2_147_483_648)
    throw new Error("车库评分整数转换溢出。");
  return Math.trunc(value) & 65_535;
}

/** Body scores are interpreted as signed 16-bit values after native conversion. */
export function scoreGarageBody(input: Record<string, number>,
  table: GarageScoreWeightTable): Record<string, number> {
  if (table.kind === "xun-parts")
    throw new Error("车体评分不能使用部件权重。");
  return Object.fromEntries(SCORE_FIELDS.map(field => [field,
    (garageScoreInteger(projectGarageScoreField(field, input[field], table)) << 16) >> 16]));
}

/** Invert X/V1 part display values into raw body parameters. */
export function inverseGaragePartScore(field: string, value: number,
  table: GarageScoreWeightTable): number {
  if (table.kind !== "x-v1")
    throw new Error("X/V1 部件反向换算不能使用迅权重。");
  const row = table.rows.get(field);
  if (!row || row.values.length !==
      WEIGHT_LENGTHS[table.kind]?.[SCORE_FIELDS.indexOf(
        field as typeof SCORE_FIELDS[number])])
    throw new Error("部件评分权重无效。");
  const weights = row.values.map(finiteScore);
  const score = finiteScore(value);
  if (!Number.isInteger(score) || score < 0 || score > 65_535)
    throw new Error("部件评分必须为有效整数。");
  const round = Math.fround;
  const raw = round(field === "TransAccelFactor" || field === "SteerConstraint" ?
    round(round(score - weights[0]!) / weights[2]!) + weights[1]! :
    field === "DriftEscapeForce" ? score * weights[0]! :
      round(score - weights[0]!) + weights[1]!);
  return finiteScore(raw);
}

export interface GarageScoreGradeRange { min: number; max: number; unit: number }

/** A part value must occupy an authored slot in one of the four quality ranges. */
export function garageGradeContains(
  grid: Map<number, Map<string, GarageScoreGradeRange[]>>,
  engineGrade: number, field: string, value: number,
): boolean {
  return Number.isInteger(value) && !!grid.get(engineGrade)?.get(field)?.some(range =>
    value >= range.min && value <= range.max &&
    (value - range.min) % range.unit === 0);
}

export interface GarageXunScoredPart {
  field: string;
  category: number;
  score: number;
}

/** Add one compatible part and one skill bonus per XUN score axis. */
export function combineGarageXunScores(input: Record<string, number>,
  parts: GarageXunScoredPart[], bonus: Record<string, number> = {}):
  Record<string, number> {
  const scores = { ...input };
  for (const field of SCORE_FIELDS) {
    const matching = parts.filter(part => part.field === field);
    if (matching.length > 1 || matching.some(part =>
      PART_CATEGORY_FIELDS.get(part.category) !== field))
      throw new Error("迅部件评分槽位重复或不匹配。");
    const skill = field === "SteerConstraint" ? 0 : (bonus[field] ?? 0);
    const values = [input[field]!, matching[0]?.score ?? 0, skill];
    if (!values.every(Number.isSafeInteger))
      throw new Error("迅组合评分必须为有效整数。");
    scores[field] = garageScoreInteger(values.reduce((sum, value) => sum + value, 0));
  }
  return scores;
}

export interface GarageLegacyPart {
  family?: string;
  legacySpec?: Record<string, number>;
}

/** Apply old-style per-part float values before the body weight conversion. */
export function applyGarageLegacyParts(input: Record<string, number>,
  configuration: Record<string, GarageLegacyPart | undefined>,
  slots: readonly string[]): Record<string, number> {
  const adjusted = { ...input };
  for (const slot of slots) {
    const part = configuration[slot];
    if (part?.family !== "legacy") continue;
    for (const [field, parameter] of Object.entries(LEGACY_SPEC_FIELDS)) {
      const delta = part.legacySpec?.[parameter];
      if (delta !== undefined && Number.isFinite(delta) &&
          adjusted[field] !== undefined)
        adjusted[field] = Math.fround(adjusted[field] + delta);
    }
  }
  return adjusted;
}

export interface GarageXunSkillProgression {
  skills: Array<{ id: number; points: number }>;
}

/** Sum the selected skill levels; an absent table is only valid with no points spent. */
export function garageXunSkillBonus(
  table: Map<number, Record<string, number>[]> | undefined,
  progression: GarageXunSkillProgression | undefined,
  validate: (value: GarageXunSkillProgression) => void,
): Record<string, number> {
  const bonus: Record<string, number> = {
    TransAccelFactor: 0, DriftEscapeForce: 0,
    NormalBoosterTime: 0, DriftMaxGauge: 0,
  };
  if (!progression) return bonus;
  validate(progression);
  for (const skill of progression.skills) {
    if (skill.points === 0) continue;
    const value = table?.get(skill.id)?.[skill.points];
    if (!value) throw new Error("迅技能评分资源尚未加载。");
    for (const field of SKILL_SCORE_FIELDS)
      bonus[field]! += value[field]!;
  }
  return bonus;
}
