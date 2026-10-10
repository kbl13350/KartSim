import type { GarageCatalogEntry, EquipmentCatalogEntry } from "../resources/garage-catalog";
import {
  FAVORITE_ITEM_LIMIT, ITEM_CATEGORY, canFavoriteItem,
  favoriteItemKey, type LocalProfile,
} from "./local-profile";

export interface ItemInventoryCatalog {
  karts: GarageCatalogEntry[];
  characters: GarageCatalogEntry[];
  equipment: EquipmentCatalogEntry[];
}

export interface ItemInventoryItem {
  category: number;
  itemId: number;
  kind: string;
  title: string;
  internalId: string;
  path?: string;
  systemKey?: string;
  identityClass?: string;
  kartType?: number;
  serial?: number;
  quantity?: number;
  expiresAt?: number;
  locked?: boolean;
  pcCafe?: boolean;
}

export type ItemInventoryGroup = "all" | "favorite" | "locked" | "pcCafe" |
  "kartBody" | "lottery" | "character" | "equip" | "useful" | "deco";

const EQUIPMENT_KINDS = new Set([
  "headBand", "balloon", "goggle", "handGearL", "headPhone", "decal",
  "rpLucciBonus", "goItemSkinCard", "tachometer",
]);
const DECORATION_KINDS = new Set([
  "aura", "color", "dye", "skidMark", "plate", "uniform", "ridColor", "slotBg",
]);
const PROFILE_ONLY_KINDS = new Set([
  "pet", "uniform", "decal", "ridColor", "slotBg", "headPhone",
  "rpLucciBonus", "goItemSkinCard", "tachometer",
]);

export const ITEM_INVENTORY_GROUPS: ReadonlyArray<{ key: ItemInventoryGroup; label: string }> = [
  { key: "favorite", label: "★ 星标道具" },
  { key: "locked", label: "锁定" },
  { key: "pcCafe", label: "网吧" },
  { key: "kartBody", label: "赛车" },
  { key: "lottery", label: "抽奖" },
  { key: "character", label: "角色与宠物" },
  { key: "equip", label: "装备" },
  { key: "useful", label: "实用" },
  { key: "deco", label: "装饰" },
];

export interface ItemInventorySubcategory { key: string; label: string }

/** Source: dialog.rho/garageDialog/atMyRoom@cn.bml. */
const SUBCATEGORIES: Record<Exclude<ItemInventoryGroup, "all">,
  readonly ItemInventorySubcategory[]> = {
  favorite: [
    { key: "whole", label: "全部" }, { key: "kartBody", label: "赛车" },
    { key: "character", label: "角色" }, { key: "equip", label: "装备" },
    { key: "useful", label: "实用" }, { key: "deco", label: "装饰" },
  ],
  locked: [{ key: "whole", label: "全部" }, { key: "kartBody", label: "赛车" }],
  pcCafe: [
    { key: "whole", label: "全部" }, { key: "kartBody", label: "赛车" },
    { key: "character", label: "角色" }, { key: "pet", label: "宠物" },
  ],
  kartBody: [
    { key: "whole", label: "全部" }, { key: "itemKart", label: "道具车" },
    { key: "speedkart", label: "竞速车" }, { key: "kartGear", label: "齿轮" },
    { key: "strengthen", label: "强化" }, { key: "enhanceIngredient", label: "强化材料" },
  ],
  lottery: [{ key: "whole", label: "全部" }],
  character: [
    { key: "whole", label: "全部" }, { key: "character", label: "角色" },
    { key: "pet", label: "宠物" }, { key: "flyingPet", label: "飞行宠物" },
  ],
  equip: [
    { key: "whole", label: "全部" }, { key: "headband", label: "头饰" },
    { key: "balloon", label: "气球" }, { key: "goggle", label: "护目镜" },
    { key: "handGearL", label: "手部装备" }, { key: "rpLucciBonus", label: "加成" },
    { key: "decal", label: "贴花" },
  ],
  useful: [
    { key: "whole", label: "全部" }, { key: "fishingItem", label: "钓鱼" },
    { key: "specialKit", label: "特殊工具" }, { key: "slotChanger", label: "道具槽" },
    { key: "guild", label: "车队" }, { key: "lucciCard", label: "金币卡" },
    { key: "etc", label: "其他" },
  ],
  deco: [
    { key: "whole", label: "全部" }, { key: "aura", label: "光环" },
    { key: "paint", label: "喷漆" }, { key: "dye", label: "染色" },
    { key: "skidMark", label: "轮胎印" }, { key: "ridColor", label: "车手颜色" },
    { key: "plate", label: "车牌" }, { key: "uniform", label: "服装" },
    { key: "slotBG", label: "车手栏背景" },
  ],
};

export function itemInventorySubcategories(group: ItemInventoryGroup):
  readonly ItemInventorySubcategory[] {
  return group === "all" ? [{ key: "whole", label: "全部" }] : SUBCATEGORIES[group];
}

export function itemInventoryGroup(item: ItemInventoryItem): Exclude<ItemInventoryGroup,
  "all" | "favorite" | "locked" | "pcCafe"> {
  if ([3, 37, 38, 39, 48, 49, 53, 79].includes(item.category)) return "kartBody";
  if ([24, 56, 62].includes(item.category)) return "lottery";
  if ([1, 21, 52].includes(item.category)) return "character";
  if ([11, 9, 8, 16, 32, 20, 58, 61].includes(item.category)) return "equip";
  if ([26, 2, 70, 27, 31, 4, 18, 71].includes(item.category)) return "deco";
  return "useful";
}

/** The local resource catalog is the selectable inventory for this Web build. */
export function itemInventoryEntries(catalog: ItemInventoryCatalog): ItemInventoryItem[] {
  const entries: ItemInventoryItem[] = [
    ...catalog.karts.map(item => ({ ...item, category: ITEM_CATEGORY.kart })),
    ...catalog.characters.map(item => ({ ...item, category: ITEM_CATEGORY.character })),
    ...catalog.equipment.filter(item => item.kind === "flyingPet" || item.kind === "pet" ||
      EQUIPMENT_KINDS.has(item.kind) || DECORATION_KINDS.has(item.kind)),
  ];
  const seen = new Set<string>();
  return entries.filter(item => {
    // A zero-ID system kart needs its content identity. Other ambiguous entries cannot
    // be equipped or saved as a favorite by the existing profile format.
    if (!Number.isInteger(item.itemId) || item.itemId < 0 || item.itemId > 65535 ||
        (item.itemId === 0 && (item.kind !== "kart" || !item.systemKey))) return false;
    const key = itemInventoryKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function itemInventoryKey(item: Pick<ItemInventoryItem,
  "category" | "itemId" | "systemKey" | "serial">): string {
  return `${item.category}:${item.itemId}:${item.systemKey ?? ""}` +
    (item.serial === undefined ? "" : `:${item.serial}`);
}

function favoriteIdentity(item: ItemInventoryItem): {
  category: number; itemId: number; serial: number; systemKart?: string;
} {
  return { category: item.category, itemId: item.itemId, serial: item.serial ?? 0,
    ...(item.kind === "kart" && item.itemId === 0 && item.systemKey
      ? { systemKart: item.systemKey } : {}) };
}

function favoriteKey(item: ItemInventoryItem): string | undefined {
  const identity = favoriteIdentity(item);
  return identity && canFavoriteItem(identity)
    ? favoriteItemKey(identity)
    : undefined;
}

export function itemInventoryIsFavorite(item: ItemInventoryItem, profile: LocalProfile): boolean {
  const key = favoriteKey(item);
  return key !== undefined && profile.favoriteItems.some(entry => favoriteItemKey(entry) === key);
}

export function itemInventoryIsEquipped(item: ItemInventoryItem, profile: LocalProfile): boolean {
  const equipment = profile.equipment;
  if (equipment.itemIds[item.category] !== item.itemId) return false;
  if (item.itemId === 0) return item.kind === "kart" && equipment.systemKart === item.systemKey;
  return item.kind !== "kart" || item.serial === undefined ||
    equipment.kartSerial === item.serial;
}

/** The original garage toggles accessories off; paint and dye are replacement-only. */
export function itemInventoryCanUnequip(item: ItemInventoryItem): boolean {
  return item.kind !== "kart" && item.kind !== "character" &&
    item.kind !== "color" && item.kind !== "dye";
}

/** Local Ready can save these asset-backed equipment categories. */
export function itemInventoryCanEquip(item: ItemInventoryItem,
  now = Date.now()): boolean {
  return item.quantity !== 0 &&
    (item.expiresAt === undefined || item.expiresAt > now);
}

/** These original equipment slots persist, while this build has no scene renderer for them. */
export function itemInventoryProfileOnly(item: ItemInventoryItem): boolean {
  return PROFILE_ONLY_KINDS.has(item.kind);
}

export function itemInventoryCanFavorite(item: ItemInventoryItem): boolean {
  return item.locked !== true &&
    favoriteKey(item) !== undefined &&
    ["kartBody", "character", "equip", "useful", "deco"]
      .includes(itemInventoryGroup(item));
}

export function itemInventoryCanLock(item: ItemInventoryItem): boolean {
  return item.category === ITEM_CATEGORY.kart;
}

function lockKey(item: { category: number; itemId: number; serial?: number;
  systemKart?: string; systemKey?: string }): string {
  return item.category + ":" + item.itemId + ":" +
    (item.systemKart ?? item.systemKey ?? "") + ":" + (item.serial ?? 0);
}

/** Original locked tab contains vehicles only and permits at most 100 records. */
export function toggleItemInventoryLock(profile: LocalProfile,
  item: ItemInventoryItem): LocalProfile {
  if (!itemInventoryCanLock(item)) return profile;
  const key = lockKey(item);
  const previous = profile.lockedItems;
  if (previous.some(record => lockKey(record) === key)) {
    return { ...profile, lockedItems: previous.filter(record => lockKey(record) !== key) };
  }
  if (previous.length >= 100) throw new Error("最多可锁定 100 个道具。");
  const record = { category: item.category, itemId: item.itemId,
    serial: item.serial ?? 0,
    ...(item.itemId === 0 && item.systemKey ? { systemKart: item.systemKey } : {}) };
  return { ...profile, lockedItems: [...previous, record] };
}

export function toggleItemInventoryFavorite(profile: LocalProfile,
  item: ItemInventoryItem): LocalProfile {
  if (!itemInventoryCanFavorite(item)) return profile;
  const key = favoriteKey(item);
  if (!key) return profile;
  const previous = profile.favoriteItems;
  if (previous.some(entry => favoriteItemKey(entry) === key)) {
    return { ...profile, favoriteItems: previous.filter(entry => favoriteItemKey(entry) !== key) };
  }
  if (previous.length >= FAVORITE_ITEM_LIMIT) {
    throw new Error(`最多收藏 ${FAVORITE_ITEM_LIMIT} 件道具。`);
  }
  const identity = favoriteIdentity(item);
  return { ...profile, favoriteItems: [...previous, identity] };
}

function inSubcategory(item: ItemInventoryItem, group: ItemInventoryGroup,
  subcategory: string): boolean {
  if (subcategory === "all" || subcategory === "whole") return true;
  if (["favorite", "locked", "pcCafe"].includes(group)) {
    return subcategory === "pet"
      ? item.category === 21 || item.category === 52
      : itemInventoryGroup(item) === subcategory;
  }
  if (group === "kartBody") {
    if (subcategory === "itemKart") return item.category === 3 && item.kartType === 1;
    if (subcategory === "speedkart") return item.category === 3 && item.kartType === 2;
    if (subcategory === "kartGear") return item.category === 24;
    if (subcategory === "strengthen") return [37, 38, 39, 48, 49, 53].includes(item.category);
    if (subcategory === "enhanceIngredient") return item.category === 79;
  }
  const kindAliases: Record<string, string> = {
    headband: "headBand", paint: "color", slotBG: "slotBg",
  };
  if (subcategory === "pet") return item.category === 21;
  if (subcategory === "fishingItem") return [15, 59].includes(item.category);
  if (subcategory === "specialKit") return item.category === 30;
  if (subcategory === "slotChanger") return item.category === 7;
  if (subcategory === "guild") return item.category === 23;
  if (subcategory === "lucciCard") return item.category === 29;
  if (subcategory === "etc") return itemInventoryGroup(item) === "useful";
  return item.kind === (kindAliases[subcategory] ?? subcategory);
}

export function filterItemInventory(items: ItemInventoryItem[], profile: LocalProfile,
  group: ItemInventoryGroup, query: string, subcategory = "whole"): ItemInventoryItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item =>
    (group === "all" || (group === "favorite" ? itemInventoryIsFavorite(item, profile) :
      group === "locked" ? Boolean(item.locked) :
      group === "pcCafe" ? Boolean(item.pcCafe) :
      itemInventoryGroup(item) === group)) &&
    inSubcategory(item, group, subcategory) &&
    terms.every(term => `${item.title} ${item.itemId}`
      .toLocaleLowerCase().includes(term)));
}
