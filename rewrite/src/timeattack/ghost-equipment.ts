/** Equipment projection between KSV players, Ghost records, and local profiles. */
export interface GhostEquipmentInput {
  character: number;
  kart: number;
  kartPaint?: number;
  paint?: number;
  characterColor?: number;
  plate?: number;
  goggle?: number;
  balloon?: number;
  equ2?: number;
  headband?: number;
  replay?: number;
  cane?: number;
  equ3?: number;
  apparel?: number;
  equ4?: number;
  plateText?: string;
  startSlot?: number;
  systemKey?: unknown;
}

export interface GhostRecordEquipment {
  character: number;
  kart: number;
  kartPaint?: number;
  characterColor?: number;
  plate?: number;
  goggle?: number;
  balloon?: number;
  headBand?: number;
  handGearL?: number;
  plateText?: string;
  systemKey?: unknown;
  [key: string]: unknown;
}

export function ghostEquipmentFromKsv(equipment: GhostEquipmentInput,
  playerName = ""): GhostRecordEquipment {
  const modern = "kartPaint" in equipment;
  return {
    character: equipment.character,
    kartPaint: modern ? equipment.kartPaint : equipment.paint,
    characterColor: modern ? equipment.characterColor : equipment.paint,
    kart: equipment.kart,
    plate: equipment.plate,
    goggle: equipment.goggle,
    balloon: equipment.balloon,
    superBoss: modern ? equipment.equ2 : undefined,
    headBand: equipment.headband,
    headphone: modern ? equipment.replay : undefined,
    handGearL: equipment.cane,
    handGearR: modern ? equipment.equ3 : undefined,
    uniform: modern ? equipment.apparel : undefined,
    decal: modern ? equipment.equ4 : undefined,
    plateText: equipment.plateText,
    playerName,
    startSlot: equipment.startSlot,
  };
}

export function ghostItemId(value: number | undefined): number {
  if (value === undefined) return 0;
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`影子录制的装备 item id ${value} 无效。`);
  return value;
}

export function ghostEquipmentProfile(equipment: GhostRecordEquipment,
  createDefaultProfile: () => any): any {
  if (equipment.character === 0 ||
      (equipment.kart === 0 && !equipment.systemKey)) {
    throw new Error("影子录制的装备缺少车辆或人物 item id。");
  }
  const profile = createDefaultProfile();
  return {
    ...profile,
    equipment: {
      ...profile.equipment,
      itemIds: {
        ...profile.equipment.itemIds,
        1: equipment.character,
        2: ghostItemId(equipment.kartPaint),
        3: equipment.kart,
        4: ghostItemId(equipment.plate),
        8: ghostItemId(equipment.goggle),
        9: ghostItemId(equipment.balloon),
        11: ghostItemId(equipment.headBand),
        16: ghostItemId(equipment.handGearL),
        70: ghostItemId(equipment.characterColor),
      },
    },
    initial: equipment.plateText,
  };
}
