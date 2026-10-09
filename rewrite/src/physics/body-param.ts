import type { VehicleSpec } from "./catalog";
import type { SpeedVersion } from "./catalog";
import { speedBaseline } from "./speed-baseline";

export interface BodyParamDocument {
  body: { attributes: Array<{ name: string; value: string }> };
}

/** A plain attribute dictionary is convenient for editing and tests. */
export type BodyParamInput = BodyParamDocument | Record<string, string>;

function attributes(input: BodyParamInput): Record<string, string> {
  if ("body" in input && typeof input.body === "object" && input.body !== null) {
    const result: Record<string, string> = {};
    for (const attribute of input.body.attributes) {
      if (!(attribute.name in result)) result[attribute.name] = attribute.value;
    }
    return result;
  }
  return input as Record<string, string>;
}

function startAcceleration(factor: number, forwardAccel: number): number {
  if (factor === 0) return forwardAccel;
  const tuned = new Map([
    [1.65, -158.679], [1.7, -171.212], [1.8, -191.644],
    [1.85, -204.276], [1.9, -211.547], [2.1, -240.324],
  ]);
  return Math.fround(forwardAccel * factor + (tuned.get(factor) ?? -58.8 * factor * factor));
}

/** Combine a BodyParam resource with a SpeedType baseline (`pS`). */
export function createBodyParamSpec(input: BodyParamInput, speed: number,
  version: SpeedVersion = "国服"): VehicleSpec {
  const body = attributes(input);
  const baseline = speedBaseline(version, speed);
  const number = (name: string, fallback: number): number => {
    const raw = body[name];
    if (raw === undefined || !raw.trim()) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`BodyParam ${name}=${raw} is not finite`);
    return value;
  };
  const boolean = (name: string, fallback: number): number => {
    const raw = body[name];
    return raw === "true" ? 1 : raw === "false" ? 0 : fallback;
  };
  const f32 = Math.fround;
  const forwardAccel = f32(baseline.forwardAccel + number("ForwardAccelForce", 0));
  const driftGauge = baseline.driftMaxGauge === 1 ? 0 : number("DriftMaxGauge", 0);

  return {
    draftMulAccelFactor: f32(number("draftMulAccelFactor", 1)),
    draftTick: number("draftTick", 0),
    driftBoostMulAccelFactor: f32(number("driftBoostMulAccelFactor", 1)),
    driftBoostTick: number("driftBoostTick", 0),
    chargeBoostBySpeed: f32(number("chargeBoostBySpeed", 0)),
    speedSlotCapacity: number("SpeedSlotCapacity", 2),
    itemSlotCapacity: number("ItemSlotCapacity", 2),
    specialSlotCapacity: number("SpecialSlotCapacity", 1),
    useTransformBooster: boolean("UseTransformBooster", 0),
    motorcycleType: boolean("motorcycleType", 0),
    effectSetupSelectorByte: boolean("BikeRearWheel", 1),
    mass: f32(baseline.mass + number("Mass", 0)),
    airFriction: f32(baseline.airFriction + number("AirFriction", 0)),
    dragFactor: f32(baseline.dragFactor + number("DragFactor", 0)),
    forwardAccel,
    backwardAccel: f32(baseline.backwardAccel + number("BackwardAccelForce", 0)),
    gripBrake: f32(baseline.gripBrake + number("GripBrakeForce", 0)),
    slipBrake: f32(baseline.slipBrake + number("SlipBrakeForce", 0)),
    maxSteerDeg: f32(baseline.maxSteerDeg + number("MaxSteerAngle", 0)),
    steerConstraint: f32(baseline.steerConstraint + number("SteerConstraint", 0)),
    frontGripFactor: f32(baseline.frontGripFactor + number("FrontGripFactor", 0)),
    rearGripFactor: f32(baseline.rearGripFactor + number("RearGripFactor", 0)),
    driftTrigFactor: f32(baseline.driftTrigFactor + number("DriftTriggerFactor", 0)),
    driftTrigTime: f32(baseline.driftTrigTime + number("DriftTriggerTime", 0)),
    driftSlipFactor: f32(baseline.driftSlipFactor + number("DriftSlipFactor", 0)),
    driftEscapeForce: f32(baseline.driftEscapeForce + number("DriftEscapeForce", 0)),
    cornerDrawFactor: f32(baseline.cornerDrawFactor + number("CornerDrawFactor", 0)),
    driftLeanFactor: f32(0.07 + number("DriftLeanFactor", 0)),
    steerLeanFactor: f32(0.01 + number("SteerLeanFactor", 0)),
    driftMaxGauge: f32(baseline.driftMaxGauge + driftGauge),
    normalBoosterTime: f32(baseline.normalBoosterTime === 2_000_000
      ? 2_000_000 : 3000 + number("NormalBoosterTime", 0)),
    itemBoosterTime: f32(number("ItemBoosterTime", 3000)),
    teamBoosterTime: f32(baseline.teamBoosterTime === 2_000_000
      ? 2_000_000 : 4500 + number("TeamBoosterTime", 0)),
    animalBoosterTime: f32(number("AnimalBoosterTime", 4000)),
    superBoosterTime: f32(number("SuperBoosterTime", 3500)),
    transAccelFactor: f32(baseline.transAccelFactor + number("TransAccelFactor", 1.5)),
    boostAccelFactor: f32(baseline.boostAccelFactor + number("BoostAccelFactor", 1.5)),
    startBoosterTimeItem: f32(number("StartBoosterTimeItem", 1000)),
    startBoosterTimeSpeed: f32(number("StartBoosterTimeSpeed", 1000)),
    startForwardAccelItem: startAcceleration(number("StartForwardAccelFactorItem", 0), forwardAccel),
    startForwardAccelSpeed: startAcceleration(number("StartForwardAccelFactorSpeed", 0), forwardAccel),
    driftGaguePreservePercent: f32(number("DriftGaguePreservePercent", 0)),
    useExtendedAfterBooster: boolean("UseExtendedAfterBooster", 0),
    // Kart XML spells the item booster factor BoosterAccelFactorItem; the release
    // parser only read BoostAccelFactorOnlyItem, which no BodyParam file contains.
    boostAccelFactorOnlyItem: f32(number("BoostAccelFactorOnlyItem",
      number("BoosterAccelFactorItem", 1.5))),
    antiCollideBalance: f32(number("antiCollideBalance", 1)),
    dualBoosterSetAuto: boolean("dualBoosterSetAuto", 0),
    dualBoosterTickMin: number("dualBoosterTickMin", 40),
    dualBoosterTickMax: number("dualBoosterTickMax", 60),
    dualMulAccelFactor: f32(number("dualMulAccelFactor", 1.1)),
    dualTransLowSpeed: f32(number("dualTransLowSpeed", 100)),
    partsLocks: [
      boolean("PartsEngineLock", 0), boolean("PartsWheelLock", 0),
      boolean("PartsSteeringLock", 0), boolean("PartsBoosterLock", 0),
      boolean("PartsCoatingLock", 0), boolean("PartsTailLampLock", 0),
    ],
    chargeInstAccelGaugeByBoost: f32(number("chargeInstAccelGaugeByBoost", 0.02)),
    chargeInstAccelGaugeByGrip: f32(number("chargeInstAccelGaugeByGrip", 0.02)),
    chargeInstAccelGaugeByWall: f32(number("chargeInstAccelGaugeByWall", 0.2)),
    instAccelFactor: f32(number("instAccelFactor", 1.25)),
    instAccelGaugeCooldownTime: number("instAccelGaugeCooldownTime", 0) * 1000,
    instAccelGaugeLength: f32(number("instAccelGaugeLength", 0) * 1000),
    instAccelGaugeMinUsable: f32(number("instAccelGaugeMinUsable", 0) *
      number("instAccelGaugeLength", 0) * 1000),
    instAccelGaugeMinVelBound: f32(number("instAccelGaugeMinVelBound", 200)),
    instAccelGaugeMinVelLoss: f32(number("instAccelGaugeMinVelLoss", 50)),
    useExtendedAfterBoosterMore: boolean("useExtendedAfterBoosterMore", 0),
    wallCollGaugeCooldownTime: number("wallCollGaugeCooldownTime", 0) * 1000,
    wallCollGaugeMaxVelLoss: f32(number("wallCollGaugeMaxVelLoss", 200)),
    wallCollGaugeMinVelBound: f32(number("wallCollGaugeMinVelBound", 200)),
    wallCollGaugeMinVelLoss: f32(number("wallCollGaugeMinVelLoss", 50)),
    footprintExtent0: 0,
    footprintExtent1: 0,
    defaultExceedType: number("defaultExceedType", 0),
    defaultEngineType: number("defaultEngineType", 0),
    defaultHandleType: number("defaultHandleType", 0),
    defaultWheelType: number("defaultWheelType", 0),
    defaultBoosterType: number("defaultBoosterType", 0),
    chargeInstAccelGaugeByWallAdded: f32(number("chargeInstAccelGaugeByWallAdded", 0)),
    chargeInstAccelGaugeByBoostAdded: f32(number("chargeInstAccelGaugeByBoostAdded", 0)),
    chargerSystemBoosterUseCount: number("chargerSystemboosterUseCount", 0),
    chargerSystemUseTime: f32(number("chargerSystemUseTime", 0)),
    vehicleFunctionChargerBranchValue: number("chargerSystemboosterUseCount", 0),
    vehicleFunctionWallCollisionGaugeValue: f32(number("wallCollGaugeMaxVelLoss", 0)),
    chargeBoostBySpeedAdded: f32(number("chargeBoostBySpeedAdded", 0)),
    driftGaugeFactor: f32(number("driftGaugeFactor", 0)),
    chargeAntiCollideBalance: f32(number("chargeAntiCollideBalance", 1)),
    startItemTableId: 0,
    startItemId: 0,
    startItemUid: 0,
    partsBoosterEffectLock: 0,
  };
}
