/** Require a finite radar value after the native float conversion. */
export function garageRadarFinite(value: number,
  convert: (value: number) => number): number {
  const result = convert(value);
  if (!Number.isFinite(result))
    throw new Error("车辆雷达参数不是有效有限数值。");
  return result;
}

/** Read one required native radar attribute, with an optional default. */
export function garageRadarAttribute<Node>(node: Node,
  name: string, fallback: number | undefined,
  attribute: (node: Node, name: string) => string | undefined,
  convert: (value: number) => number): number {
  const text = attribute(node, name);
  if (text === undefined && fallback !== undefined) return fallback;
  if (text === undefined || !text.trim())
    throw new Error(`车辆雷达缺少 ${name}。`);
  return garageRadarFinite(Number(text), convert);
}

/** Require a finite native Garage score. */
export function garageFiniteScore(value: number,
  convert: (value: number) => number): number {
  const result = convert(value);
  if (!Number.isFinite(result))
    throw new Error("车库评分包含非有限数值。");
  return result;
}

export function garageScoreNumber(text: string,
  convert: (value: number) => number): number {
  if (!text.trim()) throw new Error("车库评分数值为空。");
  return garageFiniteScore(Number(text), convert);
}

export function garageSkillScoreInteger(text: string | undefined): number {
  if (text === undefined || !text.trim() ||
      !Number.isSafeInteger(Number(text)))
    throw new Error("迅技能评分数值无效。");
  return Number(text);
}

export interface GarageRadarBaselineDependencies<Configuration, Result> {
  normalize(configuration: Configuration, stage: unknown,
    version: number): unknown;
  calculate(configuration: unknown, weights: unknown): Result;
}

/** Overlay the native baseline score onto explicit vehicle radar fields. */
export function garageRadarBaseline<Configuration extends Record<string, unknown>,
  Result extends Record<string, unknown>>(
  values: Record<string, unknown>, defaults: Configuration,
  weights: unknown, stage: unknown,
  dependencies: GarageRadarBaselineDependencies<Configuration, Result>,
): Record<string, unknown> {
  const normalized = dependencies.normalize({ ...defaults, ...values,
    defaultExceedType: 0 } as Configuration, stage, 7);
  const baseline = dependencies.calculate(normalized, weights);
  return { ...values, ...baseline };
}

/** Resolve the native random exceed type choice. */
export function garageExceedChoice<T>(value: T | "random",
  choices: readonly T[], random: () => number = Math.random): T | undefined {
  if (value !== "random") return value;
  const index = Math.min(choices.length - 1,
    Math.max(0, Math.floor(random() * choices.length)));
  return choices[index];
}
