import type { GarageScoreXmlNode } from "./garage-score-data";

export interface GarageScoreLibrary {
  exactCanonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

export interface GarageScoreApplicationDependencies {
  parseXml(bytes: Uint8Array): { root: GarageScoreXmlNode };
  attribute(node: GarageScoreXmlNode, name: string): string | undefined;
  parseNumber(value: string): number;
  fields: readonly string[];
  abilityFields: Record<string, string>;
  zeroAbilityScore(): Record<string, number>;
  validateFactory(factory: GarageFactoryDraft): void;
  parseSkills(tuning: GarageScoreXmlNode,
    enchant: GarageScoreXmlNode): unknown;
  parseFactory(enchant: GarageScoreXmlNode): unknown;
}

export interface GarageFactoryDraft {
  active: boolean;
  abilities: number[];
}

/** Load the two original Xun skill XML documents together. */
export async function loadGarageSkillScores(library: GarageScoreLibrary,
  dependencies: GarageScoreApplicationDependencies): Promise<unknown> {
  const roots = await Promise.all([
    "zeta_/cn/engine/kart12TuningData.xml",
    "zeta_/cn/enchant/enchant.xml",
  ].map(async path => {
    const candidates = library.exactCanonicalCandidates(path);
    if (candidates.length !== 1)
      throw new Error(`迅技能评分资源缺失或不唯一：${path}。`);
    return dependencies.parseXml(await candidates[0]!.bytes()).root;
  }));
  return dependencies.parseSkills(roots[0]!, roots[1]!);
}

/** Load the Factory ability score deltas from the native enchant table. */
export async function loadGarageFactoryScores(library: GarageScoreLibrary,
  dependencies: GarageScoreApplicationDependencies): Promise<unknown> {
  const path = "zeta_/cn/enchant/enchant.xml";
  const candidates = library.exactCanonicalCandidates(path);
  if (candidates.length !== 1)
    throw new Error(`改装评分资源缺失或不唯一：${path}。`);
  return dependencies.parseFactory(
    dependencies.parseXml(await candidates[0]!.bytes()).root);
}

/** Apply active Factory ability deltas to a Garage score snapshot. */
export function applyGarageFactoryScores(
  base: Record<string, number | undefined>,
  abilityScores: Map<number, Record<string, number>> | undefined,
  factory: GarageFactoryDraft | undefined,
  includeInactive: boolean,
  dependencies: GarageScoreApplicationDependencies,
): Record<string, number | undefined> {
  if (!factory || (dependencies.validateFactory(factory),
      !factory.active && !includeInactive)) return base;
  const total = dependencies.zeroAbilityScore();
  for (const id of factory.abilities) {
    if (id === 0) continue;
    const score = abilityScores?.get(id);
    if (!score) throw new Error("改装评分资源尚未加载。");
    for (const field of Object.keys(dependencies.abilityFields))
      total[field] = Math.fround(total[field]! + score[field]!);
  }
  const result = { ...base };
  for (const field of Object.keys(dependencies.abilityFields)) {
    if (result[field] === undefined) continue;
    result[field] = Math.fround(result[field]! + total[field]!);
    if (!Number.isFinite(result[field]))
      throw new Error("改装评分属性溢出。");
  }
  return result;
}

/** Normalize authored body stats and remove the native missing-value sentinel. */
export function normalizeGarageBodyScore(body: GarageScoreXmlNode,
  dependencies: GarageScoreApplicationDependencies):
  Record<string, number | undefined> {
  return Object.fromEntries(dependencies.fields.map(field => {
    const text = dependencies.attribute(body, field);
    const value = text === undefined ? undefined : dependencies.parseNumber(text);
    return [field, value === -100_000 ? undefined : value];
  }));
}

export interface GarageScoreGradeRange { min: number }

/** Find the native display quality of a score inside its part grade. */
export function garageScoreGrade(
  grid: Map<number, Map<string, GarageScoreGradeRange[]>>,
  engineGrade: number,
  field: string,
  score: number,
): number | undefined {
  const ranges = grid.get(engineGrade)?.get(field);
  if (!ranges || !Number.isInteger(score)) return undefined;
  for (let index = ranges.length - 1; index >= 0; index--)
    if (score >= ranges[index]!.min) return 4 - index;
  return 4;
}

/** Values and direction shown beside a prospective part upgrade. */
export function garageScoreTrend(before: number, after: number, base: number) {
  const difference = (value: number) =>
    `(${value - base >= 0 ? "+" : ""}${value - base})`;
  return {
    beforeValue: String(before), beforeDelta: difference(before),
    afterValue: String(after), afterDelta: difference(after),
    trend: after > before ? "increase" : "decrease",
  };
}
