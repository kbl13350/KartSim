/**
 * The garage views list only what the signed-in account owns (ECONOMY.md 7.4).
 * Race building, ghosts, other players, RP loans, story loans and the lobby
 * scene keep the full catalog; only the "what you have" views filter here.
 */
import { activeBrowserSession } from "./account-runtime";
import {
  ownedGarageCatalog, sanitizeEquipment, type EquipmentLike, type GarageCatalogShape,
  type GarageSelectionKeep,
} from "./ownership";

function catalogShape(value: unknown): value is GarageCatalogShape {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<GarageCatalogShape>;
  return Array.isArray(catalog.karts) && Array.isArray(catalog.characters) &&
    Array.isArray(catalog.equipment);
}

/** The catalog a garage view opens with: owned items only while an account is signed in. */
export function garageViewCatalog<Catalog>(catalog: Catalog,
  keep: GarageSelectionKeep = {}): Catalog {
  const session = activeBrowserSession();
  if (!session || !catalogShape(catalog)) return catalog;
  return ownedGarageCatalog(catalog, session, keep) as Catalog;
}

function equipmentShape(value: unknown): value is EquipmentLike {
  if (!value || typeof value !== "object") return false;
  const itemIds = (value as { itemIds?: unknown }).itemIds;
  return !!itemIds && typeof itemIds === "object" && !Array.isArray(itemIds);
}

/**
 * Equipment as a game node will accept it (ECONOMY.md 4.3, 6): unowned or
 * expired items replaced by the starter fallback before create/join/equipment
 * send it. Unchanged without a signed-in account.
 */
export function accountOwnedEquipment<Equipment>(equipment: Equipment): Equipment {
  const session = activeBrowserSession();
  if (!session || !equipmentShape(equipment)) return equipment;
  return sanitizeEquipment(equipment, session) as Equipment;
}
