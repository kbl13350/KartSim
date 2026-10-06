import type { GarageCatalogEntry, EquipmentCatalogEntry } from "../resources/garage-catalog";
import {
  FAVORITE_ITEM_LIMIT, ITEM_CATEGORY, canFavoriteItem,
  favoriteItemKey, makeFavoriteItem, type LocalProfile,
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
}

export type ItemInventoryGroup = "all" | "favorite" | "kartBody" |
  "character" | "equip" | "deco";

const EQUIPMENT_KINDS = new Set(["headBand", "balloon", "goggle", "handGearL"]);
const DECORATION_KINDS = new Set(["aura", "color", "dye", "skidMark", "plate"]);

export const ITEM_INVENTORY_GROUPS: ReadonlyArray<{ key: ItemInventoryGroup; label: string }> = [
  { key: "all", label: "全部" },
  { key: "favorite", label: "收藏" },
  { key: "kartBody", label: "卡丁车" },
  { key: "character", label: "角色" },
  { key: "equip", label: "装备" },
  { key: "deco", label: "装饰" },
];

export function itemInventoryGroup(item: ItemInventoryItem): Exclude<ItemInventoryGroup,
  "all" | "favorite"> {
  if (item.kind === "kart") return "kartBody";
  if (item.kind === "character" || item.kind === "flyingPet") return "character";
  if (EQUIPMENT_KINDS.has(item.kind)) return "equip";
  return "deco";
}

/** The local garage catalog is the available item set; it does not imply server ownership. */
export function itemInventoryEntries(catalog: ItemInventoryCatalog): ItemInventoryItem[] {
  const entries: ItemInventoryItem[] = [
    ...catalog.karts.map(item => ({ ...item, category: ITEM_CATEGORY.kart })),
    ...catalog.characters.map(item => ({ ...item, category: ITEM_CATEGORY.character })),
    ...catalog.equipment.filter(item => item.kind === "flyingPet" ||
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
  "category" | "itemId" | "systemKey">): string {
  return `${item.category}:${item.itemId}:${item.systemKey ?? ""}`;
}

function favoriteIdentity(item: ItemInventoryItem): {
  category: number; itemId: number; systemKart?: string;
} {
  return { category: item.category, itemId: item.itemId,
    ...(item.kind === "kart" && item.itemId === 0 && item.systemKey
      ? { systemKart: item.systemKey } : {}) };
}

function favoriteKey(item: ItemInventoryItem): string | undefined {
  const identity = favoriteIdentity(item);
  return identity && canFavoriteItem(identity)
    ? favoriteItemKey(makeFavoriteItem(identity))
    : undefined;
}

export function itemInventoryIsFavorite(item: ItemInventoryItem, profile: LocalProfile): boolean {
  const key = favoriteKey(item);
  return key !== undefined && profile.favoriteItems.some(entry => favoriteItemKey(entry) === key);
}

export function itemInventoryIsEquipped(item: ItemInventoryItem, profile: LocalProfile): boolean {
  const equipment = profile.equipment;
  if (equipment.itemIds[item.category] !== item.itemId) return false;
  return item.itemId !== 0 || (item.kind === "kart" && equipment.systemKart === item.systemKey);
}

/** The original garage toggles accessories off; paint and dye are replacement-only. */
export function itemInventoryCanUnequip(item: ItemInventoryItem): boolean {
  return item.kind !== "kart" && item.kind !== "character" &&
    item.kind !== "color" && item.kind !== "dye";
}

export function toggleItemInventoryFavorite(profile: LocalProfile,
  item: ItemInventoryItem): LocalProfile {
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
  return { ...profile, favoriteItems: [...previous,
    makeFavoriteItem(identity)] };
}

export function filterItemInventory(items: ItemInventoryItem[], profile: LocalProfile,
  group: ItemInventoryGroup, query: string, kind = "all"): ItemInventoryItem[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(item =>
    (group === "all" || (group === "favorite" ? itemInventoryIsFavorite(item, profile) :
      itemInventoryGroup(item) === group)) &&
    (kind === "all" || item.kind === kind) &&
    terms.every(term => `${item.title} ${item.itemId} ${item.internalId}`
      .toLocaleLowerCase().includes(term)));
}
