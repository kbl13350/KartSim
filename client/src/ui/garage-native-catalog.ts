export const garagePartCategoryIds = {
  engine: 43, handle: 44, wheel: 45, booster: 46,
};

export const garagePartSlotsByCategory = new Map([
  [garagePartCategoryIds.engine, "engine"],
  [garagePartCategoryIds.handle, "handle"],
  [garagePartCategoryIds.wheel, "wheel"],
  [garagePartCategoryIds.booster, "booster"],
]);

export const garageTuneNodesByCategory = new Map([
  [garagePartCategoryIds.engine, "tuneEnginePatch"],
  [garagePartCategoryIds.handle, "tuneHandle"],
  [garagePartCategoryIds.wheel, "tuneWheel"],
  [garagePartCategoryIds.booster, "tuneSupportKit"],
]);

export const garageTuneCategoriesByNode = new Map([
  ["tuneEnginePatch", garagePartCategoryIds.engine],
  ["tuneHandle", garagePartCategoryIds.handle],
  ["tuneWheel", garagePartCategoryIds.wheel],
  ["tuneSupportKit", garagePartCategoryIds.booster],
]);

export const garageDrivingMode = "TimeAttack";

export const garageEnchantScoreFields = new Set([
  "dragFactor", "forwardAccel", "backwardAccel", "gripBrake",
  "slipBrake", "frontGripFactor", "rearGripFactor", "cornerDrawFactor",
  "driftSlipFactor", "driftEscapeForce", "driftMaxGauge",
  "normalBoosterTime", "itemBoosterTime", "teamBoosterTime",
  "animalBoosterTime", "startBoosterTimeItem", "startBoosterTimeSpeed",
  "startForwardAccelItem", "startForwardAccelSpeed", "transAccelFactor",
  "steerConstraint", "boostAccelFactor",
]);

export interface GarageVehicleFunction {
  icon: string;
  focusedIcon: string;
  nameKey: string;
  descriptionKey: string;
  visible(vehicle: Record<string, number | undefined>): boolean;
}

function vehicleFunction(icon: string, key: string,
  visible: GarageVehicleFunction["visible"]): GarageVehicleFunction {
  return {
    icon, focusedIcon: `${icon}_b`,
    nameKey: `kartBodyEffct_${key}`,
    descriptionKey: `kartBodyEffct_${key}Desc`, visible,
  };
}

/** Native vehicle function tooltips and their availability rules. */
export const garageVehicleFunctions = [
  vehicleFunction("tooltip_icon_드래프트발동", "draftMulAccelFactor",
    vehicle => vehicle.draftTick! > 0),
  vehicleFunction("tooltip_icon_듀얼부스터", "dualBoosterTickMax",
    vehicle => vehicle.dualTransLowSpeed! > 0),
  vehicleFunction("tooltip_icon_부스터자동충전", "chargeBoostBySpeed",
    vehicle => vehicle.chargeBoostBySpeed! > 0),
  vehicleFunction("tooltip_icon_벽충돌게이지증가", "wallCollGaugeMaxVelLoss",
    vehicle => vehicle.vehicleFunctionWallCollisionGaugeValue! > 0),
  vehicleFunction("tooltip_icon_차저시스템", "chargerSystemboosterUseCount",
    vehicle => vehicle.vehicleFunctionChargerBranchValue! > 0),
  vehicleFunction("tooltip_icon_차저시스템", "chargerSystemForItemType",
    vehicle => vehicle.vehicleFunctionChargerBranchValue === 0),
  vehicleFunction("tooltip_icon_스피드전슬롯개수3", "SpeedSlotCapacity",
    vehicle => vehicle.speedSlotCapacity === 3),
  vehicleFunction("tooltip_icon_아이템전슬롯개수3", "ItemSlotCapacity",
    vehicle => vehicle.itemSlotCapacity === 3),
  vehicleFunction("tooltip_icon_배틀팀필살기2개", "SpecialSlotCapacity",
    vehicle => vehicle.specialSlotCapacity === 2),
  vehicleFunction("tooltip_icon_탈출순간부스터", "UseExtendedAfterBooster",
    vehicle => vehicle.useExtendedAfterBoosterMore === 1),
];

export const garageFunctionTextures = garageVehicleFunctions.flatMap(effect =>
  [effect.icon, effect.focusedIcon]);

export const garageLayoutProfiles = {
  classic: {
    kind: "classic", backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "4_partsTab", equippedRoot: "equipedParts",
    performanceRoot: "textPerformList", slotSize: 44,
    cosmeticTabs: [],
  },
  v1: {
    kind: "v1", backgroundTexture: "garage_img_baseBG_1600",
    partsTab: "6_partsTab", equippedRoot: "equipedParts",
    performanceRoot: "textPerformList", slotSize: 44,
    cosmeticTabs: [
      { node: "partsCoating", label: "车膜" },
      { node: "partsTailLamp", label: "车灯" },
    ],
  },
  xun: {
    kind: "xun", backgroundTexture: "garage_img_baseBG_2_1600",
    partsTab: "7_partsTab", equippedRoot: "equipedParts_12",
    performanceRoot: "textPerformList_12", slotSize: 50,
    cosmeticTabs: [
      { node: "partsCoating12", label: "车膜" },
      { node: "partsTailLamp12", label: "车灯" },
      { node: "partsBoosterEffect12", label: "加速器特效" },
    ],
  },
};

export const garageSkillTextures = [
  "tuning_performslot_speed", "tuning_pointTextBg",
  "tuning_pointTextBg_none",
  ...Array.from({ length: 6 }, (_, index) => `tuning_progressbar_0${index}`),
  ...Array.from({ length: 9 }, (_, index) => `tuningBoard_icon_${index + 1}`),
  ...Array.from({ length: 5 }, (_, index) => `tuning_mark_${index + 1}`),
  ...Array.from({ length: 10 }, (_, index) => `icon_exceedM_${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) =>
    `tuning_exceedProgressbar_0${index + 1}`),
];

export const garageExceedTextures = Array.from({ length: 10 }, (_, index) =>
  `icon_exceedB_${index + 1}`);

export const garageSkillDirectory = "dialog2_/kart12SkillTuning/";

export const garageSkillPickerImages = [
  "tuning_selectperformPopupBg_s",
  "tuning_selectperform_slotBg_s",
  "tuning_selectperform_slotBg_c",
  "tuning_selectperform_slotBg_c_effect",
  ...Array.from({ length: 9 }, (_, index) => `tuning_icon_${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) =>
    `tuning_selectperform_mark${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) => `tuning_slotNum_0${index + 1}`),
  ...Array.from({ length: 3 }, (_, index) =>
    `tuning_selectperformPopup_tab_${index + 1}`),
  ...Array.from({ length: 4 }, (_, index) => `tuningPopup_x_${index + 1}`),
];

export const garageFactoryAbilityAttributes = {
  TransAccelFactor: "transAccelFactor",
  DriftEscapeForce: "driftEscapeForce",
  SteerConstraint: "steerConstraint",
  NormalBoosterTime: "normalBoosterTime",
  DriftMaxGauge: "driftMaxGauge",
};

export const zeroGarageFactoryAbility = () => ({
  TransAccelFactor: 0, DriftEscapeForce: 0, SteerConstraint: 0,
  NormalBoosterTime: 0, DriftMaxGauge: 0,
});

export const garageScoreFieldBySlot = {
  engine: "TransAccelFactor", handle: "SteerConstraint",
  wheel: "DriftEscapeForce", booster: "NormalBoosterTime",
};

export const garageScorePartCategories = {
  engine: 72, handle: 73, wheel: 74, booster: 75,
};

export const garageScoreXmlAttributes = {
  TransAccelFactor: "transAccelFactor",
  DriftEscapeForce: "driftEscapeForce",
  SteerConstraint: "steerConstraint",
  NormalBoosterTime: "normalBoosterTime",
  DriftMaxGauge: "driftMaxGauge",
};

export const garageScoreDisplayRows = [
  ["加速度", "TransAccelFactor", "transAccelFactor"],
  ["弯道", "SteerConstraint", "cornerDrawFactor"],
  ["漂移", "DriftEscapeForce", "driftEscapeForce"],
  ["加速时间", "NormalBoosterTime", "normalBoosterTime"],
  ["集气速度", "DriftMaxGauge", "boosterGauge"],
];
