/**
 * The AL tuning record built from a kart spec (`jt0` in the release).
 *
 * The release copied only the speed-race fields. Item races also need the
 * item slot capacity, the item, special (animal) and super booster times and
 * the item start-boost and booster factors, so they are appended after the
 * release fields. Speed and time-attack physics never read them.
 */

/** The spec columns read here; `VehicleSpec` from the physics catalog satisfies it. */
export interface PhysicsParameterSpec {
  mass: number;
  draftMulAccelFactor: number;
  draftTick: number;
  chargerSystemBoosterUseCount: number;
  chargerSystemUseTime: number;
  dualBoosterTickMin: number;
  dualBoosterTickMax: number;
  dualMulAccelFactor: number;
  dualTransLowSpeed: number;
  airFriction: number;
  dragFactor: number;
  forwardAccel: number;
  backwardAccel: number;
  gripBrake: number;
  slipBrake: number;
  maxSteerDeg: number;
  steerConstraint: number;
  frontGripFactor: number;
  rearGripFactor: number;
  driftTrigFactor: number;
  driftTrigTime: number;
  driftSlipFactor: number;
  driftEscapeForce: number;
  cornerDrawFactor: number;
  driftLeanFactor: number;
  steerLeanFactor: number;
  driftMaxGauge: number;
  driftGaguePreservePercent: number;
  wallCollGaugeCooldownTime: number;
  wallCollGaugeMaxVelLoss: number;
  chargeInstAccelGaugeByBoost: number;
  chargeInstAccelGaugeByGrip: number;
  chargeInstAccelGaugeByWall: number;
  chargeInstAccelGaugeByBoostAdded: number;
  chargeInstAccelGaugeByWallAdded: number;
  instAccelFactor: number;
  instAccelGaugeCooldownTime: number;
  instAccelGaugeLength: number;
  instAccelGaugeMinUsable: number;
  instAccelGaugeMinVelBound: number;
  instAccelGaugeMinVelLoss: number;
  wallCollGaugeMinVelBound: number;
  wallCollGaugeMinVelLoss: number;
  normalBoosterTime: number;
  teamBoosterTime: number;
  startBoosterTimeSpeed: number;
  startForwardAccelSpeed: number;
  transAccelFactor: number;
  boostAccelFactor: number;
  driftBoostMulAccelFactor: number;
  driftBoostTick: number;
  useTransformBooster: number;
  chargeBoostBySpeed: number;
  chargeBoostBySpeedAdded: number;
  driftGaugeFactor: number;
  motorcycleType: number;
  speedSlotCapacity: number;
  itemSlotCapacity: number;
  itemBoosterTime: number;
  startBoosterTimeItem: number;
  startForwardAccelItem: number;
  boostAccelFactorOnlyItem: number;
  useExtendedAfterBooster: number;
  useExtendedAfterBoosterMore: number;
  animalBoosterTime: number;
  superBoosterTime: number;
}

export interface PhysicsParameterVisual {
  autoChargeLowSpeed: number;
  driftGaugeReset: boolean;
  wheelPosition: number;
}

const f32 = Math.fround;

/** `jt0(spec, visual, engineGrade)`; the engine grade enables the charger (9) and dual booster (>6). */
export function vehiclePhysicsParameters(spec: PhysicsParameterSpec,
  visual: PhysicsParameterVisual, engineGrade: number) {
  const suspensionSpring = f32(f32(f32(spec.mass) * f32(58.80000305175781)) * 0.5);
  return {
    draftMulAccelFactor: spec.draftMulAccelFactor,
    draftTick: spec.draftTick,
    chargerEnabled: engineGrade === 9,
    chargerSystemBoosterUseCount: spec.chargerSystemBoosterUseCount,
    chargerSystemUseTime: spec.chargerSystemUseTime,
    dualBoosterEnabled: engineGrade > 6,
    dualBoosterTickMin: spec.dualBoosterTickMin,
    dualBoosterTickMax: spec.dualBoosterTickMax,
    dualMulAccelFactor: spec.dualMulAccelFactor,
    dualTransLowSpeed: spec.dualTransLowSpeed,
    mass: spec.mass,
    suspensionSpring,
    suspensionPositiveDamping: 0,
    suspensionNegativeDamping: f32(suspensionSpring * 0.20000000298023224),
    airFriction: spec.airFriction,
    dragFactor: spec.dragFactor,
    forwardAccel: spec.forwardAccel,
    backwardAccel: spec.backwardAccel,
    gripBrake: spec.gripBrake,
    slipBrake: spec.slipBrake,
    maxSteerDeg: spec.maxSteerDeg,
    steerConstraint: spec.steerConstraint,
    frontGripFactor: spec.frontGripFactor,
    rearGripFactor: spec.rearGripFactor,
    driftTrigFactor: spec.driftTrigFactor,
    driftTrigTime: spec.driftTrigTime,
    driftSlipFactor: spec.driftSlipFactor,
    driftEscapeForce: spec.driftEscapeForce,
    cornerDrawFactor: spec.cornerDrawFactor,
    driftLeanFactor: spec.driftLeanFactor,
    steerLeanFactor: spec.steerLeanFactor,
    driftMaxGauge: spec.driftMaxGauge,
    driftGaguePreservePercent: spec.driftGaguePreservePercent,
    wallCollGaugeCooldownTime: spec.wallCollGaugeCooldownTime,
    wallCollGaugeMaxVelLoss: spec.wallCollGaugeMaxVelLoss,
    chargeInstAccelGaugeByBoost: spec.chargeInstAccelGaugeByBoost,
    chargeInstAccelGaugeByGrip: spec.chargeInstAccelGaugeByGrip,
    chargeInstAccelGaugeByWall: spec.chargeInstAccelGaugeByWall,
    chargeInstAccelGaugeByBoostAdded: spec.chargeInstAccelGaugeByBoostAdded,
    chargeInstAccelGaugeByWallAdded: spec.chargeInstAccelGaugeByWallAdded,
    instAccelFactor: spec.instAccelFactor,
    instAccelGaugeCooldownTime: spec.instAccelGaugeCooldownTime,
    instAccelGaugeLength: spec.instAccelGaugeLength,
    instAccelGaugeMinUsable: spec.instAccelGaugeMinUsable,
    instAccelGaugeMinVelBound: spec.instAccelGaugeMinVelBound,
    instAccelGaugeMinVelLoss: spec.instAccelGaugeMinVelLoss,
    wallCollGaugeMinVelBound: spec.wallCollGaugeMinVelBound,
    wallCollGaugeMinVelLoss: spec.wallCollGaugeMinVelLoss,
    normalBoosterTime: spec.normalBoosterTime,
    teamBoosterTime: spec.teamBoosterTime,
    startBoosterTimeSpeed: spec.startBoosterTimeSpeed,
    startForwardAccelSpeed: spec.startForwardAccelSpeed,
    transAccelFactor: spec.transAccelFactor,
    boostAccelFactor: spec.boostAccelFactor,
    driftBoostMulAccelFactor: spec.driftBoostMulAccelFactor,
    driftBoostTick: spec.driftBoostTick,
    useTransformBooster: spec.useTransformBooster !== 0,
    chargeBoostBySpeed: spec.chargeBoostBySpeed,
    chargeBoostBySpeedAdded: spec.chargeBoostBySpeedAdded,
    driftGaugeFactor: spec.driftGaugeFactor,
    motorcycleType: spec.motorcycleType !== 0,
    speedSlotCapacity: spec.speedSlotCapacity,
    autoChargeLowSpeed: visual.autoChargeLowSpeed,
    driftGaugeReset: visual.driftGaugeReset,
    wheelPosition: visual.wheelPosition,
    // Item-race fields, absent from the release record.
    itemSlotCapacity: spec.itemSlotCapacity,
    itemBoosterTime: spec.itemBoosterTime,
    startBoosterTimeItem: spec.startBoosterTimeItem,
    startForwardAccelItem: spec.startForwardAccelItem,
    boostAccelFactorOnlyItem: spec.boostAccelFactorOnlyItem,
    useExtendedAfterBooster: spec.useExtendedAfterBooster !== 0,
    useExtendedAfterBoosterMore: spec.useExtendedAfterBoosterMore !== 0,
    // The special booster (31) and the super shield (18) boost times.
    animalBoosterTime: spec.animalBoosterTime,
    superBoosterTime: spec.superBoosterTime,
  };
}

export type VehiclePhysicsParameters = ReturnType<typeof vehiclePhysicsParameters>;
