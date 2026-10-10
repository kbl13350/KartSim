import type { VehicleSpec } from "./catalog";

/** Launcher_V2 default exceed presets used by the p3553 rows. */
const PRESET_1 = {
  chargeInstAccelGaugeByBoost: Math.fround(0.016),
  chargeInstAccelGaugeByGrip: Math.fround(0.06),
  chargeInstAccelGaugeByWall: Math.fround(0.15),
  instAccelFactor: Math.fround(1.3),
  instAccelGaugeCooldownTime: 3000,
  instAccelGaugeLength: 1000,
  instAccelGaugeMinUsable: 300,
  instAccelGaugeMinVelBound: 0,
  instAccelGaugeMinVelLoss: 50,
  useExtendedAfterBoosterMore: 1,
  wallCollGaugeCooldownTime: 3000,
  wallCollGaugeMaxVelLoss: 200,
  wallCollGaugeMinVelBound: 160,
  wallCollGaugeMinVelLoss: 50,
  chargeInstAccelGaugeByWallAdded: 0,
  chargeInstAccelGaugeByBoostAdded: 0,
  chargerSystemBoosterUseCount: 0,
  chargerSystemUseTime: 0,
  chargeBoostBySpeedAdded: 0,
  driftGaugeFactor: 0,
  chargeAntiCollideBalance: 0,
};

const PRESET_2 = {
  chargeInstAccelGaugeByBoost: Math.fround(0.02),
  chargeInstAccelGaugeByGrip: Math.fround(0.07),
  chargeInstAccelGaugeByWall: Math.fround(0.15),
  instAccelFactor: Math.fround(1.29),
  instAccelGaugeCooldownTime: 3000,
  instAccelGaugeLength: 1040,
  instAccelGaugeMinUsable: 208,
  instAccelGaugeMinVelBound: 0,
  instAccelGaugeMinVelLoss: 50,
  useExtendedAfterBoosterMore: 0,
  wallCollGaugeCooldownTime: 3000,
  wallCollGaugeMaxVelLoss: 200,
  wallCollGaugeMinVelBound: 200,
  wallCollGaugeMinVelLoss: 50,
  chargeInstAccelGaugeByWallAdded: Math.fround(0.09),
  chargeInstAccelGaugeByBoostAdded: Math.fround(0.03),
  chargerSystemBoosterUseCount: 4,
  chargerSystemUseTime: 3000,
  chargeBoostBySpeedAdded: 350,
  driftGaugeFactor: 2,
  chargeAntiCollideBalance: Math.fround(0.8),
};

const PRESET_3 = {
  ...PRESET_2,
  instAccelFactor: Math.fround(1.19),
  instAccelGaugeLength: 2000,
  instAccelGaugeMinUsable: 400,
  chargerSystemBoosterUseCount: 5,
  chargerSystemUseTime: 3750,
};

const PRESET_6 = {
  ...PRESET_2,
  chargeInstAccelGaugeByBoost: Math.fround(0.017),
  instAccelFactor: Math.fround(1.16),
  instAccelGaugeLength: 3000,
  instAccelGaugeMinUsable: 600,
  chargeInstAccelGaugeByBoostAdded: Math.fround(0.02),
  chargerSystemBoosterUseCount: 6,
  chargerSystemUseTime: 4500,
};

const PRESETS: Record<number, Record<string, number>> = {
  1: PRESET_1, 2: PRESET_2, 3: PRESET_3, 6: PRESET_6,
};

const PART_GRADES = [0, 2, 4, 7, 10, 13, 17, 21, 25, 30];

function gradeCode(level: number): number {
  if (!Number.isInteger(level) || level < 1 || level > 30) {
    throw new Error("Default Xun part level must be 1..30");
  }
  return 201 + Math.trunc((level - 1) / 10) * 23 + PART_GRADES[(level - 1) % 10]!;
}

/** Apply `EI` after reading a local-p3553+launcher-v2 row. */
export function applyDefaultExceed(spec: VehicleSpec): VehicleSpec {
  if (spec.defaultExceedType <= 0) return spec;
  const preset = PRESETS[spec.defaultExceedType];
  if (!preset) throw new Error(`Unmapped default exceed type ${spec.defaultExceedType}`);
  const result = { ...spec, ...preset } as VehicleSpec;
  const parts = [
    ["defaultEngineType", "transAccelFactor", (grade: number) => (grade - 800) / 25_000 + 0.4765],
    ["defaultHandleType", "steerConstraint", (grade: number) => (grade - 800) / 250 + 2.7],
    ["defaultWheelType", "driftEscapeForce", (grade: number) => grade * 2],
    ["defaultBoosterType", "normalBoosterTime", (grade: number) => grade - 260],
  ] as const;
  for (const [levelField, targetField, formula] of parts) {
    const delta = Math.fround(formula(gradeCode(spec[levelField])));
    result[targetField] = Math.fround(spec[targetField] + delta);
  }
  return result;
}
