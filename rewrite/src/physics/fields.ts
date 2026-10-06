/** Exact 91-column schema captured from the v39.11 kartspec tables. */
export const KART_FIELDS = [
  "draftMulAccelFactor", "draftTick", "driftBoostMulAccelFactor", "driftBoostTick",
  "chargeBoostBySpeed", "speedSlotCapacity", "itemSlotCapacity", "specialSlotCapacity",
  "useTransformBooster", "motorcycleType", "effectSetupSelectorByte", "mass",
  "airFriction", "dragFactor", "forwardAccel", "backwardAccel",
  "gripBrake", "slipBrake", "maxSteerDeg", "steerConstraint",
  "frontGripFactor", "rearGripFactor", "driftTrigFactor", "driftTrigTime",
  "driftSlipFactor", "driftEscapeForce", "cornerDrawFactor", "driftLeanFactor",
  "steerLeanFactor", "driftMaxGauge", "normalBoosterTime", "itemBoosterTime",
  "teamBoosterTime", "animalBoosterTime", "superBoosterTime", "transAccelFactor",
  "boostAccelFactor", "startBoosterTimeItem", "startBoosterTimeSpeed", "startForwardAccelItem",
  "startForwardAccelSpeed", "driftGaguePreservePercent", "useExtendedAfterBooster",
  "boostAccelFactorOnlyItem", "antiCollideBalance", "dualBoosterSetAuto",
  "dualBoosterTickMin", "dualBoosterTickMax", "dualMulAccelFactor", "dualTransLowSpeed",
  "partsEngineLock", "partsWheelLock", "partsSteeringLock", "partsBoosterLock",
  "partsCoatingLock", "partsTailLampLock", "chargeInstAccelGaugeByBoost",
  "chargeInstAccelGaugeByGrip", "chargeInstAccelGaugeByWall", "instAccelFactor",
  "instAccelGaugeCooldownTime", "instAccelGaugeLength", "instAccelGaugeMinUsable",
  "instAccelGaugeMinVelBound", "instAccelGaugeMinVelLoss", "useExtendedAfterBoosterMore",
  "wallCollGaugeCooldownTime", "wallCollGaugeMaxVelLoss", "wallCollGaugeMinVelBound",
  "wallCollGaugeMinVelLoss", "footprintExtent0", "footprintExtent1",
  "defaultExceedType", "defaultEngineType", "defaultHandleType", "defaultWheelType",
  "defaultBoosterType", "chargeInstAccelGaugeByWallAdded",
  "chargeInstAccelGaugeByBoostAdded", "chargerSystemBoosterUseCount",
  "chargerSystemUseTime", "chargeBoostBySpeedAdded", "driftGaugeFactor",
  "chargeAntiCollideBalance", "startItemTableId", "startItemId", "startItemUid",
  "partsBoosterEffectLock",
] as const;

export type KartField = typeof KART_FIELDS[number];
export const CSV_COLUMNS = ["id", "speedType", "source", ...KART_FIELDS] as const;

export const PART_LOCK_FIELDS = [
  "partsEngineLock", "partsWheelLock", "partsSteeringLock",
  "partsBoosterLock", "partsCoatingLock", "partsTailLampLock",
] as const;

export type PartLockField = typeof PART_LOCK_FIELDS[number];

export const BYTE_FIELDS = new Set<KartField>([
  "speedSlotCapacity", "itemSlotCapacity", "specialSlotCapacity",
  "useTransformBooster", "motorcycleType", "effectSetupSelectorByte",
  ...PART_LOCK_FIELDS, "useExtendedAfterBooster", "dualBoosterSetAuto",
  "useExtendedAfterBoosterMore", "partsBoosterEffectLock",
]);

export const WORD_FIELDS = new Set<KartField>([
  "defaultEngineType", "defaultHandleType", "defaultWheelType", "defaultBoosterType",
]);

export const INTEGER_FIELDS = new Set<KartField>([
  "draftTick", "driftBoostTick", "dualBoosterTickMin", "dualBoosterTickMax",
  "instAccelGaugeCooldownTime", "wallCollGaugeCooldownTime", "defaultExceedType",
  "chargerSystemBoosterUseCount", "startItemTableId", "startItemId", "startItemUid",
]);
