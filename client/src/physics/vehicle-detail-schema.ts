import { BYTE_FIELDS, INTEGER_FIELDS, KART_FIELDS, WORD_FIELDS } from './fields';

export interface VehicleDetailField {
  key: string;
  label: string;
  group: string;
  type: 'number' | 'boolean' | 'string';
  integer?: boolean;
  min?: number;
  max?: number;
  unit?: string;
}

const groups: Array<[string, Record<string, string>]> = [
  ['车身与操控', {
    mass: '车身质量', airFriction: '空气摩擦', dragFactor: '空气阻力系数',
    forwardAccel: '前进加速力', backwardAccel: '倒车加速力', gripBrake: '抓地刹车力', slipBrake: '滑行刹车力',
    maxSteerDeg: '最大转向角', steerConstraint: '转向约束', frontGripFactor: '前轮抓地系数', rearGripFactor: '后轮抓地系数',
    cornerDrawFactor: '弯道牵引系数', steerLeanFactor: '转向倾斜系数', antiCollideBalance: '碰撞平衡',
    footprintExtent0: '碰撞范围 X', footprintExtent1: '碰撞范围 Y', motorcycleType: '摩托车类型',
    effectSetupSelectorByte: '特效选择值',
  }],
  ['漂移与集气', {
    driftTrigFactor: '漂移触发系数', driftTrigTime: '漂移触发时间', driftSlipFactor: '漂移滑动系数',
    driftEscapeForce: '漂移脱离力', driftLeanFactor: '漂移倾斜系数', driftMaxGauge: '漂移集气上限',
    driftGaguePreservePercent: '漂移集气保留比例', driftGaugeFactor: '漂移集气系数',
    driftBoostMulAccelFactor: '漂移加速倍率', driftBoostTick: '漂移加速时长',
    chargeBoostBySpeed: '随速度集气', chargeBoostBySpeedAdded: '随速度额外集气',
    draftMulAccelFactor: '尾流加速倍率', draftTick: '尾流持续时长',
  }],
  ['氮气与起步', {
    normalBoosterTime: '普通氮气时长', itemBoosterTime: '道具氮气时长', teamBoosterTime: '组队氮气时长',
    animalBoosterTime: '动物氮气时长', superBoosterTime: '超级氮气时长', transAccelFactor: '变形加速系数',
    boostAccelFactor: '氮气加速系数', boostAccelFactorOnlyItem: '道具氮气加速系数', useTransformBooster: '变形氮气开关',
    startBoosterTimeItem: '道具赛起步氮气时长', startBoosterTimeSpeed: '竞速赛起步氮气时长',
    startForwardAccelItem: '道具赛起步加速力', startForwardAccelSpeed: '竞速赛起步加速力',
    useExtendedAfterBooster: '延长小喷', useExtendedAfterBoosterMore: '额外延长小喷',
    dualBoosterSetAuto: '自动双重氮气', dualBoosterTickMin: '双重氮气最小时长', dualBoosterTickMax: '双重氮气最大时长',
    dualMulAccelFactor: '双重氮气加速倍率', dualTransLowSpeed: '双重氮气最低速度',
  }],
  ['瞬间加速与充能', {
    chargeInstAccelGaugeByBoost: '氮气瞬间充能', chargeInstAccelGaugeByGrip: '抓地瞬间充能',
    chargeInstAccelGaugeByWall: '撞墙瞬间充能', instAccelFactor: '瞬间加速系数',
    instAccelGaugeCooldownTime: '瞬间加速冷却', instAccelGaugeLength: '瞬间加速槽长度',
    instAccelGaugeMinUsable: '瞬间加速最低能量', instAccelGaugeMinVelBound: '瞬间加速最低速度',
    instAccelGaugeMinVelLoss: '瞬间加速最低速度损失', wallCollGaugeCooldownTime: '撞墙充能冷却',
    wallCollGaugeMaxVelLoss: '撞墙最大速度损失', wallCollGaugeMinVelBound: '撞墙充能最低速度',
    wallCollGaugeMinVelLoss: '撞墙最低速度损失', chargeInstAccelGaugeByWallAdded: '撞墙额外充能',
    chargeInstAccelGaugeByBoostAdded: '氮气额外充能', chargerSystemBoosterUseCount: '充能氮气使用次数',
    chargerSystemUseTime: '充能系统时长', chargeAntiCollideBalance: '充能碰撞平衡',
    vehicleFunctionChargerBranchValue: '充能功能分支值', vehicleFunctionWallCollisionGaugeValue: '碰撞集气功能值',
  }],
  ['槽位、零件与初始道具', {
    speedSlotCapacity: '竞速槽位数', itemSlotCapacity: '道具槽位数', specialSlotCapacity: '特殊槽位数',
    partsEngineLock: '引擎零件锁定', partsWheelLock: '车轮零件锁定', partsSteeringLock: '方向盘零件锁定',
    partsBoosterLock: '氮气零件锁定', partsCoatingLock: '涂装零件锁定', partsTailLampLock: '尾灯零件锁定',
    partsBoosterEffectLock: '氮气特效零件锁定', defaultExceedType: '默认超越类型',
    defaultEngineType: '默认引擎类型', defaultHandleType: '默认方向盘类型', defaultWheelType: '默认车轮类型',
    defaultBoosterType: '默认氮气类型', startItemTableId: '起始道具表 ID', startItemId: '起始道具 ID', startItemUid: '起始道具 UID',
  }],
];

const keys = [...KART_FIELDS, 'vehicleFunctionChargerBranchValue', 'vehicleFunctionWallCollisionGaugeValue'];
export const VEHICLE_PHYSICS_FIELDS: VehicleDetailField[] = keys.map(key => {
  const entry = groups.find(([, labels]) => key in labels);
  if (!entry) throw new Error(`Missing vehicle field label: ${key}`);
  const byte = BYTE_FIELDS.has(key as never), word = WORD_FIELDS.has(key as never);
  const integer = byte || word || INTEGER_FIELDS.has(key as never) || key === 'vehicleFunctionChargerBranchValue';
  return { key, label: entry[1][key]!, group: entry[0], type: 'number', integer,
    min: key === 'mass' ? 0.001 : byte || word ? 0 : integer ? -2147483648 : -3.4028234663852886e38,
    max: byte ? 255 : word ? 65535 : integer ? 2147483647 : 3.4028234663852886e38,
    ...(/BoosterTime|CooldownTime|instAccelGaugeLength|instAccelGaugeMinUsable/.test(key) ? { unit: 'ms' } : {}),
  };
});

export const VEHICLE_METADATA_FIELDS: VehicleDetailField[] = [
  { key: 'title', label: '车辆名称', group: '基本信息', type: 'string', min: 1, max: 120 },
  ...Object.entries({ kartType: '车辆类型（1 道具 / 2 竞速）', engineGrade: '引擎世代',
    defaultOpenSocket: '默认开放插槽', uniqueLevel: '独特等级', vehicleRarityLevel: '稀有度', orgColorId: '原始颜色 ID',
    fixedPlateId: '固定车牌 ID', linkCharacterId: '关联角色 ID', characterAniType: '角色动画类型' })
    .map(([key, label]): VehicleDetailField => ({ key, label, group: '基本信息', type: 'number', integer: true,
      min: key === 'kartType' ? 1 : 0, max: key === 'kartType' ? 2 : key === 'engineGrade' ? 13 : 65535 })),
  ...Object.entries({ enchant: '允许改装', alwaysLinkCharacter: '始终关联角色', hideChar: '隐藏驾驶员' })
    .map(([key, label]): VehicleDetailField => ({ key, label, group: '基本信息', type: 'boolean' })),
];
