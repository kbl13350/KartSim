/** The local driver's equipment, favorites and selected kart. */
export const LOCAL_PROFILE_KEY = "kartrider-web:p3528:user-profile-v2";
export const FAVORITE_ITEM_LIMIT = 100;
export const EQUIPMENT_CATEGORIES = [
  1, 2, 3, 4, 8, 9, 10, 11, 12, 16, 17, 18, 20, 21, 52, 26, 27, 30,
  31, 32, 36, 43, 45, 44, 46, 58, 59, 61, 70, 68, 69, 71, 76, 77, 78,
] as const;

export const ITEM_CATEGORY = {
  character: 1, color: 2, kart: 3, plate: 4, dye: 70, flyingPet: 52,
  goggle: 8, balloon: 9, headBand: 11, handGearL: 16, aura: 26, skidMark: 27,
} as const;

export interface FavoriteItem {
  category: number;
  itemId: number;
  serial: number;
  systemKart?: string;
}

export interface FavoriteTrack { themeId: number; trackId: number }

export interface Equipment {
  itemIds: Record<number, number>;
  kartSerial: number;
  valueAt3E: number;
  exceedType: number;
  systemKart?: string;
  systemKartVariant?: string;
  [key: string]: unknown;
}

export interface LocalProfile {
  equipment: Equipment;
  initial: string;
  favoriteTracks: FavoriteTrack[];
  favoriteItems: FavoriteItem[];
  garage?: unknown;
  [key: string]: unknown;
}

export interface ProfileDependencies {
  normalizeGarage(garage: unknown): unknown;
  validateGarage(garage: unknown): void;
  garageKart(garage: unknown, kartId: number, serial: number): { exceedType?: number };
  systemKarts: readonly { key: string }[];
  resolveVariant(key: string, variant: string): { resource: string } | undefined;
}

export function uniqueItemKey(index: number): string | undefined {
  return Number.isInteger(index) && index >= 1 && index <= 7 ? `unique${index}@zz` : undefined;
}

export function centerOffset(width: number, centered: boolean): number {
  return centered ? 0 : width / 2;
}

export function isUnsignedInteger(value: unknown, limit: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= limit;
}

export function hasSystemKartKey(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function favoriteItemIdentity(item: {
  kind?: keyof typeof ITEM_CATEGORY; itemId: number; category?: number;
  systemKey?: string;
}): { category: number | undefined; itemId: number; systemKart?: string } | undefined {
  if ("category" in item) return { category: item.category, itemId: item.itemId };
  const category = ITEM_CATEGORY[item.kind as keyof typeof ITEM_CATEGORY];
  if (item.kind === "kart" && item.itemId === 0) {
    const key = item.systemKey?.trim();
    return key ? { category, itemId: 0, systemKart: key } : undefined;
  }
  return { category, itemId: item.itemId };
}

export function canFavoriteItem(item: {
  category: unknown; itemId: unknown; systemKart?: unknown;
}): boolean {
  if (!isUnsignedInteger(item.category, 65535) || !isUnsignedInteger(item.itemId, 65535)) return false;
  return item.itemId !== 0
    ? item.systemKart === undefined
    : item.category === ITEM_CATEGORY.kart && hasSystemKartKey(item.systemKart);
}

export function makeFavoriteItem(item: {
  category: number; itemId: number; systemKart?: string;
}): FavoriteItem {
  if (!canFavoriteItem(item)) {
    throw new Error("P3528 星标道具身份无效：需要类别、物品 ID，以及零 ID 物品的系统内容键。");
  }
  return { category: item.category, itemId: item.itemId, serial: 0,
    ...(item.systemKart ? { systemKart: item.systemKart.trim() } : {}) };
}

export function favoriteItemKey(item: FavoriteItem): string {
  return `${item.category}:${item.itemId}:${item.serial}:${item.systemKart ?? ""}`;
}

export function favoriteItemKeys(items: FavoriteItem[]): Set<string> {
  return new Set(items.map(favoriteItemKey));
}

export function defaultLocalProfile(): LocalProfile {
  const itemIds = Object.fromEntries(EQUIPMENT_CATEGORIES.map(category => [category, 0])) as Record<number, number>;
  itemIds[1] = 2;
  itemIds[2] = 1;
  itemIds[3] = 387;
  itemIds[70] = 1;
  return {
    equipment: { itemIds, kartSerial: 0, valueAt3E: 0, exceedType: 0 },
    initial: "", favoriteTracks: [], favoriteItems: [],
  };
}

export function validateInteger(value: unknown, limit: number, label: string): void {
  if (!isUnsignedInteger(value, limit)) {
    throw new Error(`本地用户资料的${label}必须是 0..${limit} 的整数。`);
  }
}

export function validateNonzeroItemId(value: unknown): void {
  validateInteger(value, 65535, "角色或卡丁车 ID");
  if (value === 0) throw new Error("本地用户资料的角色或卡丁车 ID 不能为 0。");
}

export function validateFavoriteTracks(value: unknown): void {
  if (!Array.isArray(value) || value.length > 50) {
    throw new Error("本地用户资料的收藏地图必须是最多 50 项的列表。");
  }
  for (const track of value) {
    validateInteger(track?.themeId, 35, "收藏主题 ID");
    validateInteger(track?.trackId, 4294967295, "收藏地图 ID");
  }
}

export function validateFavoriteItems(value: unknown): void {
  if (!Array.isArray(value) || value.length > FAVORITE_ITEM_LIMIT) {
    throw new Error(`本地用户资料的星标道具必须是最多 ${FAVORITE_ITEM_LIMIT} 项的列表。`);
  }
  const seen = new Set<string>();
  for (const item of value) {
    validateInteger(item?.category, 65535, "星标道具类别");
    validateInteger(item?.itemId, 65535, "星标道具 ID");
    validateInteger(item?.serial, 65535, "星标道具实例编号");
    if (item.systemKart !== undefined &&
      (typeof item.systemKart !== "string" || !item.systemKart.trim() ||
       item.category !== ITEM_CATEGORY.kart || item.itemId !== 0)) {
      throw new Error("本地用户资料的星标系统车辆缺少有效的系统车辆身份。");
    }
    const key = favoriteItemKey(item);
    if (seen.has(key)) throw new Error("本地用户资料的星标道具不能重复登记同一物品。");
    seen.add(key);
  }
}

export function resolveSystemKartVariant(key: string, variant: unknown,
  deps: Pick<ProfileDependencies, "systemKarts" | "resolveVariant">): string | undefined {
  if (variant === undefined) return undefined;
  if (typeof variant !== "string" || !variant.trim()) {
    throw new Error(`系统车辆 ${key} 的外观 variant 无效。`);
  }
  const kart = deps.systemKarts.find(candidate => candidate.key === key);
  if (!kart) throw new Error(`系统车辆 ${key} 不支持外观 variant。`);
  const resolved = deps.resolveVariant(kart.key, variant);
  if (!resolved) throw new Error(`系统车辆 ${key} 的外观 variant ${variant} 无效。`);
  return resolved.resource;
}

export function parseLocalProfile(serialized: string, deps: ProfileDependencies): LocalProfile {
  // JSON.parse is the untrusted persistence boundary; validation below narrows it.
  const profile = { initial: "", favoriteTracks: [], favoriteItems: [],
    ...JSON.parse(serialized) } as LocalProfile;
  const equipment = profile?.equipment;
  if (!equipment) throw new Error("本地用户资料缺少装备结构。");
  for (const category of EQUIPMENT_CATEGORIES) {
    validateInteger(equipment.itemIds?.[category], 65535, `装备类别 ${category}`);
  }
  validateInteger(equipment.kartSerial, 65535, "车辆实例编号");
  validateInteger(equipment.valueAt3E, 255, "装备 +3E");
  validateInteger(equipment.exceedType, 65535, "Exceed 类型");
  if (equipment.systemKartVariant !== undefined) {
    if (equipment.itemIds[3] !== 0 || typeof equipment.systemKart !== "string" ||
        !equipment.systemKart) {
      throw new Error("本地用户资料的系统车辆外观缺少系统车辆身份。");
    }
    resolveSystemKartVariant(equipment.systemKart, equipment.systemKartVariant, deps);
  }
  if (typeof profile.initial !== "string") {
    throw new Error("本地用户资料的号牌文字必须是字符串。");
  }
  validateFavoriteTracks(profile.favoriteTracks);
  validateFavoriteItems(profile.favoriteItems);
  const garage = deps.normalizeGarage(profile.garage);
  deps.validateGarage(garage);
  return garage === profile.garage ? profile : { ...profile, garage };
}

export function loadLocalProfile(storage: Pick<Storage, "getItem">,
  deps: ProfileDependencies): LocalProfile | undefined {
  const serialized = storage.getItem(LOCAL_PROFILE_KEY);
  return serialized === null ? undefined : parseLocalProfile(serialized, deps);
}

export function saveLocalProfile(profile: LocalProfile,
  storage: Pick<Storage, "setItem">,
  deps: Pick<ProfileDependencies, "validateGarage">): void {
  deps.validateGarage(profile.garage);
  storage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
}

export function selectLocalKart(profile: LocalProfile | undefined,
  kartId: number, characterId: number, systemKart: string | undefined,
  variant: string | undefined, deps: ProfileDependencies): LocalProfile {
  validateInteger(kartId, 65535, "卡丁车 ID");
  validateNonzeroItemId(characterId);
  const current = profile ?? defaultLocalProfile();
  const equipment = current.equipment;
  const key = kartId === 0
    ? (systemKart ?? (equipment.itemIds[3] === 0 ? equipment.systemKart : undefined))
    : undefined;
  if (kartId === 0 && !key) {
    throw new Error("本地用户资料的系统卡丁车缺少内容身份键。");
  }
  const resolvedVariant = key
    ? resolveSystemKartVariant(key,
        variant ?? (equipment.systemKart === key ? equipment.systemKartVariant : undefined), deps)
    : undefined;
  const sameKart = equipment.itemIds[3] === kartId &&
    equipment.systemKart === key && equipment.systemKartVariant === resolvedVariant;
  const serial = sameKart ? equipment.kartSerial : 0;
  const exceedType = sameKart ? equipment.exceedType :
    (deps.garageKart(current.garage, kartId, serial).exceedType ?? 0);
  const { systemKart: _oldKey, systemKartVariant: _oldVariant, ...base } = equipment;
  return { ...current, equipment: {
    ...base, itemIds: { ...equipment.itemIds, 1: characterId, 3: kartId },
    ...(key ? { systemKart: key } : {}),
    ...(resolvedVariant ? { systemKartVariant: resolvedVariant } : {}),
    kartSerial: serial, exceedType,
  } };
}
