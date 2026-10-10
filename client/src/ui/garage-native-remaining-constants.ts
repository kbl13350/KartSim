export const garageDefaultWidth = 1600;

export const garageStageSizes = [
  { width: 1400, height: 1050 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
];

export const garageStageDirectory = "stage_/garageX/";
export const garageLampTexture = "mqParts12Card:unique5_x";

export const garageFontPath = "gui_/font/SourceHanSansCN-Bold.otf";
export const garageFontResource = "gui_font.rho";
export const garageFontFamily = "P3528 Source Han Sans CN Garage";

export const garageDefaultPartFields = {
  engine: "defaultEngineType", handle: "defaultHandleType",
  wheel: "defaultWheelType", booster: "defaultBoosterType",
};

export const garageNativeRarityValues = new Map([
  ["Unique", 4], ["Legend", 3], ["Rare", 5],
  ["Normal", 2], ["Special", 1], ["Ultimate", 6], ["Epic", 7],
]);

export const garageRadarAttributes = {
  DragFactor: "dragFactor", ForwardAccelForce: "forwardAccel",
  TransAccelFactor: "transAccelFactor",
  TeamBoosterTime: "teamBoosterTime",
  NormalBoosterTime: "normalBoosterTime",
  StartBoosterTimeSpeed: "startBoosterTimeSpeed",
  DriftMaxGauge: "driftMaxGauge",
  DriftEscapeForce: "driftEscapeForce",
  CornerDrawFactor: "cornerDrawFactor",
};

export const garageRadarDescriptionKeys = [
  "DescEngineGrade", "DescBalance", "DescStability",
  "DescEnchantCap", "DescCornering",
];

export const garageRadarCaptions = [
  "集气速度", "加速时间", "加速最高速度", "竞速",
  "弯道", "稳定性", "平衡", "强化力量",
];

export const garageRadarSkillFields = new Set([
  "DriftEscapeForce", "TransAccelFactor",
  "NormalBoosterTime", "DriftMaxGauge",
]);

export const garageExceedChoices = [2, 3, 4];
export const garageSidePanelInset = 15;
export const garageSidePanelInnerInset = garageSidePanelInset - 2;
export const garageResetPrompt = "立即重置当前车辆的粒子改记录？";

export const garageClassicUpgradeDirectory = "dialog/kartLevelUp/";
export const garageXunUpgradeDirectory = "dialog2_/kart12TuningLevelUp/";
export const garageXunUpgradeStages = [
  "preEffect", "successEffect", "successResult",
];
export const garageXunUpgradeStageLabels = [
  "强化开始", "强化成功", "强化结果",
];
export const garageSkillPanelPath =
  "/backGround/engine12Data/tuningPanel/skillTuning";

export const garagePreparationDirectory =
  "dialog2_/kart12TuningLevelUp/";
export const garagePreparationCardDirectory = "gui_/windowTemplate/";
export const garagePreparationImages = [
  "tuning_upgradePopupBg", "tuning_arrow_g", "tuning_arrow_g_s",
  "icon_ethisChipset", "icon_lucci",
  ...[1, 2, 3, 4].map(index => `tuninglevel_btnStart_${index}`),
];

export const garageSkillDialogRect = {
  x: 186, y: 526, width: 519, height: 210,
};

export const garageXunSkillAttributes = {
  TransAccelFactor: "transAccelFactor",
  DriftEscapeForce: "driftEscapeForce",
  NormalBoosterTime: "normalBoosterTime",
  DriftMaxGauge: "driftMaxGauge",
};

export const zeroGarageXunSkillScore = () => ({
  TransAccelFactor: 0, DriftEscapeForce: 0,
  NormalBoosterTime: 0, DriftMaxGauge: 0,
});

export const garageScoreFields = [
  "TransAccelFactor", "DriftEscapeForce", "SteerConstraint",
  "NormalBoosterTime", "DriftMaxGauge",
];

export const garageScoreWeightLengths = {
  "x-v1": [4, 1, 3, 2, 1],
  "xun-body": [3, 1, 2, 2, 1],
  "xun-parts": [3, 1, 2, 2, 1],
};

export const garageXunPartScoreFields = new Map([
  [72, "TransAccelFactor"], [73, "SteerConstraint"],
  [74, "DriftEscapeForce"], [75, "NormalBoosterTime"],
]);

export const garageGradeKeys = [
  "", "loGradeUnique", "loGradeLegend", "loGradeRare", "loGradeAverage",
];

export const garagePartSlotKeys = {
  engine: "partsEngine12", handle: "partsHandle12",
  wheel: "partsWheel12", booster: "partsBooster12",
};

export const garageGradeFallbacks = ["", "终极", "稀有", "高级", "普通"];
export const garageCardPageSize = 9;
export const garageRemovePartRect = {
  x: 70, y: 590, width: 100, height: 32,
};

export const garageTuneSlotNodes = {
  engine: "tuneEnginePatch", handle: "tuneHandle",
  wheel: "tuneWheel", booster: "tuneSupportKit",
};
