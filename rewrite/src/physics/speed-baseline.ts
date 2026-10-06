import type { SpeedVersion } from "./catalog";

/** Fields read by BodyParam combination in the captured SpeedType.cs table. */
export interface SpeedBaseline {
  addSteerConstraint: number; addDriftEscapeForce: number;
  addTransAccelFactor: number;
  mass: number; airFriction: number; dragFactor: number;
  forwardAccel: number; backwardAccel: number; gripBrake: number; slipBrake: number;
  maxSteerDeg: number; steerConstraint: number; frontGripFactor: number; rearGripFactor: number;
  driftTrigFactor: number; driftTrigTime: number; driftSlipFactor: number;
  driftEscapeForce: number; cornerDrawFactor: number; driftMaxGauge: number;
  steerLeanFactor: number;
  transAccelFactor: number; boostAccelFactor: number;
  normalBoosterTime: number; teamBoosterTime: number;
}

const CN_STANDARD: SpeedBaseline = {
  addSteerConstraint: 1.95, addDriftEscapeForce: 400,
  addTransAccelFactor: 0.2005,
  mass: 100, airFriction: 3, dragFactor: 0.75,
  forwardAccel: 2150, backwardAccel: 1725, gripBrake: 2070, slipBrake: 1415,
  maxSteerDeg: 10, steerConstraint: 22.25, frontGripFactor: 5, rearGripFactor: 5,
  driftTrigFactor: 0.2, driftTrigTime: 0.2, driftSlipFactor: 0.2,
  driftEscapeForce: 2600, cornerDrawFactor: 0.18, steerLeanFactor: 0,
  driftMaxGauge: 4300,
  transAccelFactor: -0.0045, boostAccelFactor: -0.006,
  normalBoosterTime: 0, teamBoosterTime: 0,
};

const CN: Record<number, SpeedBaseline> = {
  0: { ...CN_STANDARD, addSteerConstraint: 1.7, addDriftEscapeForce: 150,
    addTransAccelFactor: 0.199, dragFactor: 0.735, forwardAccel: 1950, backwardAccel: 1500,
    gripBrake: 1800, slipBrake: 1250, steerConstraint: 22, driftEscapeForce: 2350,
    cornerDrawFactor: 0.15, driftMaxGauge: 3970, transAccelFactor: -0.006,
    boostAccelFactor: 0 },
  1: { ...CN_STANDARD, addSteerConstraint: 2.2, addDriftEscapeForce: 1100,
    addTransAccelFactor: 0.202, dragFactor: 0.7621, forwardAccel: 2350, backwardAccel: 1950,
    gripBrake: 2340, slipBrake: 1580, steerConstraint: 22.5, driftEscapeForce: 3300,
    driftMaxGauge: 4880, transAccelFactor: -0.003, boostAccelFactor: 0 },
  2: { ...CN_STANDARD, addSteerConstraint: 2.7, addDriftEscapeForce: 1500,
    addTransAccelFactor: 0.2, dragFactor: 0.79, forwardAccel: 2900, backwardAccel: 2175,
    gripBrake: 2610, slipBrake: 1740, steerConstraint: 23, driftEscapeForce: 3700,
    cornerDrawFactor: 0.16, driftMaxGauge: 6000, transAccelFactor: -0.005,
    boostAccelFactor: 0 },
  3: { ...CN_STANDARD, addSteerConstraint: -0.3, addDriftEscapeForce: -350,
    addTransAccelFactor: -0.015, dragFactor: 0.7, forwardAccel: 1620, backwardAccel: 1500,
    gripBrake: 1500, slipBrake: 1200, steerConstraint: 20, driftEscapeForce: 1850,
    cornerDrawFactor: 0.13, driftMaxGauge: 5050, transAccelFactor: -0.22,
    boostAccelFactor: 0 },
  4: { ...CN_STANDARD, driftMaxGauge: 1 },
  5: { ...CN_STANDARD, addSteerConstraint: 2.7, addDriftEscapeForce: 1500,
    addTransAccelFactor: 0.2, airFriction: 2.7, dragFactor: 0.15, forwardAccel: 1700,
    backwardAccel: 300, gripBrake: 2000, slipBrake: 1300, maxSteerDeg: 12.5,
    steerConstraint: 25.5, frontGripFactor: 10, rearGripFactor: 10,
    driftEscapeForce: 2350, cornerDrawFactor: 0.1, steerLeanFactor: 0.0015,
    driftMaxGauge: 3970,
    transAccelFactor: -0.5, boostAccelFactor: 0 },
  6: { ...CN_STANDARD, addSteerConstraint: 1.7, addDriftEscapeForce: 150,
    addTransAccelFactor: 0.199, dragFactor: 0.735, forwardAccel: 1950, backwardAccel: 1500,
    gripBrake: 1800, slipBrake: 1250, steerConstraint: 22, driftEscapeForce: 2300,
    cornerDrawFactor: 0.15, driftMaxGauge: 1, transAccelFactor: 0.4,
    boostAccelFactor: 0, normalBoosterTime: 2_000_000, teamBoosterTime: 2_000_000 },
  7: CN_STANDARD,
  8: { ...CN_STANDARD, dragFactor: 0.74 },
};

const RETRO_STANDARD: SpeedBaseline = {
  addSteerConstraint: 0, addDriftEscapeForce: 0, addTransAccelFactor: 0,
  mass: 100, airFriction: 3, dragFactor: 0.74,
  forwardAccel: 2000, backwardAccel: 1500, gripBrake: 1800, slipBrake: 1200,
  maxSteerDeg: 10, steerConstraint: 22, frontGripFactor: 5, rearGripFactor: 5,
  driftTrigFactor: 0.2, driftTrigTime: 0.2, driftSlipFactor: 0.2,
  driftEscapeForce: 2500, cornerDrawFactor: 0.2, steerLeanFactor: 0,
  driftMaxGauge: 4000,
  transAccelFactor: 0, boostAccelFactor: 0,
  normalBoosterTime: 0, teamBoosterTime: 0,
};

const RETRO_CN: Record<number, SpeedBaseline> = {
  0: RETRO_STANDARD,
  1: RETRO_STANDARD,
  2: { ...RETRO_STANDARD, dragFactor: 0.763, forwardAccel: 2400,
    backwardAccel: 1950, gripBrake: 2340, slipBrake: 1560,
    steerConstraint: 22.8, driftEscapeForce: 3300, driftMaxGauge: 5000 },
  3: { ...RETRO_STANDARD, dragFactor: 0.743, forwardAccel: 2500,
    backwardAccel: 2100, gripBrake: 2400, slipBrake: 1610,
    steerConstraint: 22.82, driftEscapeForce: 3400, driftMaxGauge: 5100 },
  4: { ...RETRO_STANDARD, dragFactor: 0.772, forwardAccel: 2700,
    backwardAccel: 2137, gripBrake: 2510, slipBrake: 1680,
    steerConstraint: 23, driftEscapeForce: 3550, driftMaxGauge: 5550 },
  5: { ...RETRO_STANDARD, dragFactor: 0.81, forwardAccel: 3800,
    backwardAccel: 2850, gripBrake: 3420, slipBrake: 2280,
    steerConstraint: 23.4, driftEscapeForce: 4700, driftMaxGauge: 8000 },
};

const RETRO_KR_OVERRIDES: Record<number, Partial<SpeedBaseline>> = {
  3: { dragFactor: 0.801, forwardAccel: 2900, backwardAccel: 2175,
    gripBrake: 2610, slipBrake: 1740, steerConstraint: 23,
    driftEscapeForce: 3700, cornerDrawFactor: 0.2, driftMaxGauge: 6000 },
  4: { dragFactor: 0.794, forwardAccel: 2900, backwardAccel: 2175,
    gripBrake: 2610, slipBrake: 1740, steerConstraint: 23,
    driftEscapeForce: 3700, cornerDrawFactor: 0.2, driftMaxGauge: 6000 },
};

/** Recreates `r7` for BodyParam merging, including the Korean retro f32 offsets. */
export function speedBaseline(version: SpeedVersion, speed: number): SpeedBaseline {
  if (version === "国服") {
    const fields = CN[speed];
    if (fields) return fields;
  } else if (version === "国服复古" || version === "韩服复古") {
    const fields = RETRO_CN[speed];
    if (fields) {
      if (version === "国服复古") return fields;
      const base = { ...fields, ...RETRO_KR_OVERRIDES[speed] };
      const add = (value: number, amount: number) => Math.fround(Math.fround(value) + Math.fround(amount));
      return {
        ...base,
        dragFactor: add(base.dragFactor, -0.005),
        forwardAccel: add(base.forwardAccel, -5),
        steerConstraint: add(base.steerConstraint, 0.05),
        driftEscapeForce: add(base.driftEscapeForce, 150),
        cornerDrawFactor: add(base.cornerDrawFactor, 0.005),
        transAccelFactor: add(base.transAccelFactor, 0.18),
      };
    }
  }
  throw new Error(`SpeedType table has no version ${version}, speed ${speed}`);
}

export interface SpeedTypeEntry {
  version: SpeedVersion;
  speedType: number;
  displayName: string;
  fields: SpeedBaseline;
  driftMaxGaugeFromSpeedTypeOnly: boolean;
  source: { file: "KartRider.Data/ExcData/SpeedType.cs"; lines: [number, number] };
}

const DISPLAY_NAMES: Record<SpeedVersion, Record<number, string>> = {
  国服: { 0: "普通S1", 1: "快速S2", 2: "高速S3", 3: "慢速S0", 6: "真无限", 7: "标准" },
  国服复古: { 0: "新手", 1: "初级", 2: "L3", 3: "L2", 4: "L1", 5: "Pro" },
  韩服复古: { 0: "新手", 1: "初级", 2: "L3", 3: "L2", 4: "L1", 5: "Pro" },
};

const CN_SOURCE_LINES: Record<number, [number, number]> = {
  0: [81, 108], 1: [109, 136], 2: [137, 164], 3: [53, 80],
  4: [165, 170], 5: [171, 199], 6: [200, 227], 7: [228, 232],
  8: [233, 260],
};
const RETRO_CN_SOURCE_LINES: Record<number, [number, number]> = {
  0: [268, 272], 1: [268, 272], 2: [273, 277],
  3: [278, 305], 4: [306, 333], 5: [334, 338],
};
const RETRO_KR_SOURCE_LINES: Record<number, [number, number]> = {
  0: [346, 350], 1: [346, 350], 2: [351, 355],
  3: [356, 383], 4: [384, 411], 5: [412, 416],
};

/** Complete `r7` result, including the metadata used by the driving runtime. */
export function speedTypeEntry(version: SpeedVersion, speed: number): SpeedTypeEntry {
  let fields: SpeedBaseline;
  try {
    fields = speedBaseline(version, speed);
  } catch {
    throw new Error(`SpeedType 表未收录版本 ${version} 速度 ${speed}。`);
  }
  const lines = (version === "国服" ? CN_SOURCE_LINES
    : version === "国服复古" ? RETRO_CN_SOURCE_LINES : RETRO_KR_SOURCE_LINES)[speed];
  return {
    version, speedType: speed, displayName: DISPLAY_NAMES[version][speed] ?? "",
    fields, driftMaxGaugeFromSpeedTypeOnly: fields.driftMaxGauge === 1,
    source: { file: "KartRider.Data/ExcData/SpeedType.cs", lines: lines! },
  };
}
