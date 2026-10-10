/**
 * Server inventory applied to the garage (ECONOMY.md 4, 7.4): which catalog
 * items the account may equip, how long rentals have left, and the fallback
 * for equipment that is no longer owned.
 */
import type { InventoryItem } from "./account-session";

/** Categories sold by the shop and checked against the inventory (economy.Kinds). */
export const OWNED_CATEGORIES: ReadonlySet<number> = new Set([
  1, 2, 3, 4, 8, 9, 11, 12, 16, 18, 20, 21, 26, 27, 31, 32, 52, 58, 61, 70, 71,
]);

/** The new-rider kit (newRiderItem@cn and catalog.json `starter`). */
export const STARTER = {
  kart: { category: 3, itemId: 0, systemKey: "practiceKart" },
  characters: [2, 3],
  colors: [6, 4, 5, 7],
  defaultCharacter: 2,
  defaultPaint: 4,
  defaultDye: 4,
} as const;

export const CATEGORY = { character: 1, paint: 2, kart: 3, dye: 70 } as const;

export interface Ownership {
  owns(category: number, itemId: number, systemKey?: string, now?: number): boolean;
  inventory(): readonly InventoryItem[];
  serverNow?(): number;
}

export function ownershipNow(ownership: Ownership): number {
  return ownership.serverNow?.() ?? Date.now();
}

/** The account's chosen starter character, paint and dye, else the catalog defaults. */
export function starterChoice(ownership: Ownership):
  { character: number; paint: number; dye: number } {
  const items = ownership.inventory();
  const pick = (category: number, allowed: readonly number[], fallback: number) => {
    const starter = items.find(item => item.category === category && item.source === "starter" &&
      allowed.includes(item.itemId));
    const owned = allowed.find(id => ownership.owns(category, id));
    return starter?.itemId ?? owned ?? fallback;
  };
  return {
    character: pick(CATEGORY.character, STARTER.characters, STARTER.defaultCharacter),
    paint: pick(CATEGORY.paint, STARTER.colors, STARTER.defaultPaint),
    dye: pick(CATEGORY.dye, STARTER.colors, STARTER.defaultDye),
  };
}

export interface EquipmentLike {
  itemIds: Record<number, number>;
  kartSerial?: number;
  exceedType?: number;
  systemKart?: string;
  systemKartVariant?: string;
  [key: string]: unknown;
}

/** Equipped slots the inventory does not cover (category → equipped item ID). */
export function unownedSlots(equipment: EquipmentLike, ownership: Ownership,
  now = ownershipNow(ownership)): number[] {
  const slots: number[] = [];
  for (const [key, itemId] of Object.entries(equipment.itemIds)) {
    const category = Number(key);
    if (!OWNED_CATEGORIES.has(category)) continue;
    if (category === CATEGORY.kart) {
      const owned = itemId === 0
        ? ownership.owns(category, 0, equipment.systemKart, now)
        : ownership.owns(category, itemId, undefined, now);
      if (!owned) slots.push(category);
      continue;
    }
    if (itemId !== 0 && !ownership.owns(category, itemId, undefined, now)) slots.push(category);
  }
  return slots;
}

/**
 * Replace every unowned or expired item: kart → practice kart, character →
 * starter character, paint/dye → starter colors, other slots → 0. Returns the
 * same object when nothing changes.
 */
export function sanitizeEquipment<Equipment extends EquipmentLike>(equipment: Equipment,
  ownership: Ownership, now = ownershipNow(ownership)): Equipment {
  const slots = unownedSlots(equipment, ownership, now);
  if (!slots.length) return equipment;
  const starter = starterChoice(ownership);
  const itemIds = { ...equipment.itemIds };
  let next: Equipment = { ...equipment, itemIds };
  for (const slot of slots) {
    if (slot === CATEGORY.kart) {
      const { systemKartVariant: _variant, ...rest } = next;
      next = { ...rest, itemIds, systemKart: STARTER.kart.systemKey, kartSerial: 0,
        exceedType: 0 } as Equipment;
      itemIds[CATEGORY.kart] = STARTER.kart.itemId;
    } else if (slot === CATEGORY.character) itemIds[slot] = starter.character;
    else if (slot === CATEGORY.paint) itemIds[slot] = starter.paint;
    else if (slot === CATEGORY.dye) itemIds[slot] = starter.dye;
    else itemIds[slot] = 0;
  }
  return next;
}

export function sanitizeProfileEquipment<Profile extends { equipment: EquipmentLike }>(
  profile: Profile, ownership: Ownership, now = ownershipNow(ownership)): Profile {
  const equipment = sanitizeEquipment(profile.equipment, ownership, now);
  return equipment === profile.equipment ? profile : { ...profile, equipment };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** "剩余 3 天" style label for a rental; permanent items have none. */
export function remainingLabel(expiresAt: number | null, now: number): string | undefined {
  if (expiresAt === null) return undefined;
  const left = expiresAt - now;
  if (left <= 0) return "已过期";
  if (left >= DAY_MS) return `剩余 ${Math.floor(left / DAY_MS)} 天`;
  if (left >= HOUR_MS) return `剩余 ${Math.floor(left / HOUR_MS)} 小时`;
  return `剩余 ${Math.max(1, Math.ceil(left / 60_000))} 分钟`;
}

export interface CatalogKart {
  itemId: number;
  systemKey?: string;
  [key: string]: unknown;
}

export interface CatalogCharacter {
  itemId: number;
  [key: string]: unknown;
}

export interface CatalogEquipment {
  category: number;
  itemId: number;
  [key: string]: unknown;
}

export interface GarageCatalogShape<Kart extends CatalogKart = CatalogKart,
  Character extends CatalogCharacter = CatalogCharacter,
  Item extends CatalogEquipment = CatalogEquipment> {
  karts: Kart[];
  characters: Character[];
  equipment: Item[];
  [key: string]: unknown;
}

/** What the garage must keep listed even when the inventory lost it (fail-closed views). */
export interface GarageSelectionKeep {
  kartItemId?: number;
  kartSystemKey?: string;
  characterItemId?: number;
}

/**
 * Only owned, unexpired items, each annotated with `ownershipLabel` for
 * rentals. The current selection stays listed so the views can open; startup
 * sanitizing replaces it with an owned item before the next race.
 */
export function ownedGarageCatalog<Catalog extends GarageCatalogShape>(catalog: Catalog,
  ownership: Ownership, keep: GarageSelectionKeep = {},
  now = ownershipNow(ownership)): Catalog {
  const rows = ownership.inventory();
  const label = (category: number, itemId: number, systemKey?: string) => {
    const row = rows.find(item => item.category === category && item.itemId === itemId &&
      (itemId !== 0 || (item.systemKey ?? "") === (systemKey ?? "")) &&
      (item.expiresAt === null || item.expiresAt > now));
    return row ? remainingLabel(row.expiresAt, now) : undefined;
  };
  const annotate = <Entry extends object>(entry: Entry, text: string | undefined): Entry =>
    text ? { ...entry, ownershipLabel: text } : entry;
  const karts = catalog.karts.flatMap(kart => {
    const owned = ownership.owns(CATEGORY.kart, kart.itemId, kart.systemKey, now);
    const kept = kart.itemId === keep.kartItemId &&
      (kart.itemId !== 0 || (kart.systemKey ?? "") === (keep.kartSystemKey ?? ""));
    if (!owned && !kept) return [];
    return [annotate(kart, label(CATEGORY.kart, kart.itemId, kart.systemKey))];
  });
  const characters = catalog.characters.flatMap(character => {
    const owned = ownership.owns(CATEGORY.character, character.itemId, undefined, now);
    if (!owned && character.itemId !== keep.characterItemId) return [];
    return [annotate(character, label(CATEGORY.character, character.itemId))];
  });
  const equipment = catalog.equipment.flatMap(item => {
    if (!OWNED_CATEGORIES.has(item.category)) return [item];
    if (!ownership.owns(item.category, item.itemId, undefined, now)) return [];
    return [annotate(item, label(item.category, item.itemId))];
  });
  return { ...catalog, karts, characters, equipment };
}
