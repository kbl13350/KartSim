export interface GarageScoredPart {
  category: number;
  itemId: number;
  [key: string]: unknown;
}

export interface GarageConfigurationPart {
  family: string;
  slot: string;
  value: number;
  itemId: number;
}

export interface GarageScoreSource {
  table: { kind: string };
  input: Record<string, number>;
  parts: GarageScoredPart[];
  skills?: unknown;
  grid?: Map<number, unknown>;
  factory?: unknown;
}

export interface GarageScoringDependencies {
  partFamily(vehicle: unknown, engineGrade: unknown): string | undefined;
  scoreFamily(vehicle: unknown, engineGrade: unknown): string | undefined;
  validateFactory(factory: unknown): void;
  validatePart(part: GarageConfigurationPart): void;
  slotLocked(vehicle: unknown, slot: string): boolean;
  slots: readonly string[];
  scorePartCategories: Record<string, number>;
  scorePartFields: Record<string, string>;
  resolvePart(vehicle: unknown, configuration: Record<string, unknown>,
    slot: string, parts: unknown, engineGrade: unknown):
    { itemId: number } | undefined;
  skillBonus(skills: unknown, progression: unknown): Record<string, number>;
  combineXun(input: Record<string, number>, parts: GarageScoredPart[],
    bonus: Record<string, number>): Record<string, number>;
  scoreBody(input: Record<string, number>, table: GarageScoreSource["table"]):
    Record<string, number>;
  addLegacyParts(input: Record<string, number>,
    configuration: Record<string, unknown>): Record<string, number>;
  applyFactory(input: Record<string, number>, source: unknown,
    selected: unknown): Record<string, number>;
  fallbackGrade(grade: unknown): number;
  gradeContains(grid: Map<number, unknown>, grade: unknown, field: string,
    value: number): boolean;
  inversePartScore(field: string, value: number,
    table: GarageScoreSource["table"]): number;
}

/** Combine body, part, skill, and factory scores according to vehicle generation. */
export function calculateGarageVehicleScores(
  source: GarageScoreSource,
  vehicle: unknown,
  engineGrade: unknown,
  configuration: Record<string, unknown>,
  availableParts: unknown,
  ignoredSlot: string | undefined,
  dependencies: GarageScoringDependencies,
): Record<string, number> {
  const partFamily = dependencies.partFamily(vehicle, engineGrade);
  const scoreFamily = dependencies.scoreFamily(vehicle, engineGrade);
  if (!scoreFamily || (source.table.kind === "xun-body") !==
      (scoreFamily === "xun"))
    throw new Error("评分资源与车辆代际不匹配。");

  if (configuration.factory)
    dependencies.validateFactory(configuration.factory);
  if (partFamily) {
    for (const slot of dependencies.slots) {
      const part = configuration[slot] as GarageConfigurationPart | undefined;
      if (!part) continue;
      dependencies.validatePart(part);
      const isLegacyReplacement = partFamily === "legacy" && part.family !== "legacy";
      if (!isLegacyReplacement &&
          (part.family !== partFamily || part.slot !== slot ||
            dependencies.slotLocked(vehicle, slot)))
        throw new Error("评分部件与车辆不兼容。");
    }
  }

  if (partFamily === "xun") {
    const scoredParts = dependencies.slots.flatMap(slot => {
      if (slot === ignoredSlot) return [];
      const equipped = dependencies.resolvePart(vehicle, configuration, slot,
        availableParts, engineGrade);
      if (!equipped) return [];
      const scored = source.parts.find(part =>
        part.category === dependencies.scorePartCategories[slot] &&
        part.itemId === equipped.itemId);
      if (!scored) throw new Error("迅部件缺少原版评分数据。");
      return [scored];
    });
    const progression = configuration.progression as
      { kind?: string } | undefined;
    const bonus = dependencies.skillBonus(source.skills,
      progression?.kind === "xun" ? progression : undefined);
    return dependencies.combineXun(
      dependencies.scoreBody(source.input, source.table), scoredParts, bonus);
  }

  if (partFamily === "legacy")
    return dependencies.scoreBody(dependencies.applyFactory(
      dependencies.addLegacyParts(source.input, configuration),
      source.factory, configuration.factory), source.table);

  const adjusted = { ...source.input };
  for (const slot of dependencies.slots) {
    const part = configuration[slot] as GarageConfigurationPart | undefined;
    if (!part || !partFamily) continue;
    const field = dependencies.scorePartFields[slot]!;
    if (!source.grid) throw new Error("部件评分档位资源缺失。");
    const grade = source.grid.has(engineGrade as number) ? engineGrade :
      dependencies.fallbackGrade(engineGrade);
    if (!dependencies.gradeContains(source.grid, grade, field, part.value))
      throw new Error("部件评分不在原版允许档位中。");
    if (adjusted[field] !== undefined)
      adjusted[field] = dependencies.inversePartScore(field, part.value,
        source.table);
  }
  const scores = dependencies.scoreBody(dependencies.applyFactory(adjusted,
    source.factory, configuration.factory), source.table);
  return Object.fromEntries(Object.entries(scores).map(([field, value]) =>
    [field, value & 0xffff]));
}
