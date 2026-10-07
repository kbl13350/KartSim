import { Cr, xw } from "../generated/formats.js";
import { E20, GI, p5 } from "../generated/library.js";
import { selectLocalKart, type LocalProfile } from "../ui/local-profile";
import {
  itemInventoryCanEquip, itemInventoryCanUnequip, itemInventoryEntries,
  itemInventoryIsEquipped, type ItemInventoryCatalog,
  type ItemInventoryItem,
} from "../ui/item-inventory";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import type { ReadyGarageController } from "./ready-garage";

/**
 * Apply an item chosen in My Items through the same Ready reload and profile-save
 * boundary as the classic garage. The caller closes My Room before invoking this.
 */
export async function equipReadyInventoryItem(
  controller: ReadyGarageController,
  selection: ReadySelection,
  options: ReadyOptions,
  item: ItemInventoryItem,
  catalog: ItemInventoryCatalog,
  action: "equip" | "unequip" = "equip",
): Promise<LocalProfile> {
  const host = controller.host;
  const available = itemInventoryEntries(catalog).find(candidate =>
    candidate.category === item.category && candidate.itemId === item.itemId &&
    candidate.systemKey === item.systemKey && candidate.kind === item.kind &&
    candidate.internalId === item.internalId && candidate.path === item.path);
  if (!available) throw new Error("这件道具不在当前本地目录中。");
  if (action === "equip" && !itemInventoryCanEquip(available))
    throw new Error("这件道具当前不能装备。");

  const previousProfile = host.getProfile() as LocalProfile;
  if (action === "unequip" &&
      (!itemInventoryCanUnequip(item) || !itemInventoryIsEquipped(item, previousProfile))) {
    throw new Error("这件道具当前不能卸下。");
  }
  const equipment = previousProfile.equipment;
  const nextSelection = { ...selection };
  let nextTitle = host.getVehicleTitle();
  const nextKartId = item.kind === "kart" ? item.itemId : equipment.itemIds[3]!;
  const nextCharacterId = item.kind === "character" ? item.itemId : equipment.itemIds[1]!;
  const nextSystemKey = item.kind === "kart" ? item.systemKey : equipment.systemKart;
  const sameKart = equipment.itemIds[3] === nextKartId &&
    equipment.systemKart === nextSystemKey;
  const nextProfile = item.kind === "kart" || item.kind === "character"
    ? selectLocalKart(previousProfile, nextKartId, nextCharacterId, nextSystemKey,
      undefined, { normalizeGarage: E20, validateGarage: GI, garageKart: p5,
        systemKarts: Cr, resolveVariant: xw })
    : { ...previousProfile, equipment: { ...equipment,
      itemIds: { ...equipment.itemIds,
        [item.category]: action === "unequip" ? 0 : item.itemId } } };

  if (item.kind === "kart") {
    if (!item.path) throw new Error("这辆卡丁车缺少模型路径。");
    nextSelection.vehiclePath = sameKart ? selection.vehiclePath : item.path;
    nextSelection.vehicleItemId = item.itemId;
    nextSelection.vehicleSystemKey = item.systemKey;
    if (!sameKart) nextTitle = item.title;
  } else if (item.kind === "character") {
    if (!item.path) throw new Error("角色缺少模型路径。");
    nextSelection.characterPath = item.path;
    nextSelection.characterItemId = item.itemId;
  }

  const previousSelection = host.getSelection();
  const previousOptions = host.getReadyOptions();
  const previousTitle = host.getVehicleTitle();
  host.setReadyOptions({ ...options });
  host.setSelection(nextSelection);
  host.setVehicleTitle(nextTitle);
  try {
    await host.enterTimeAttackReady(nextProfile);
  } catch (error) {
    if (previousSelection) host.setSelection(previousSelection);
    host.setReadyOptions(previousOptions);
    host.setVehicleTitle(previousTitle);
    throw error;
  }
  host.setProfile(nextProfile);
  try {
    host.saveProfile();
  } catch (error) {
    host.hud.showDebugText(
      `本次装备已应用，但未保存：${error instanceof Error ? error.message : String(error)}`,
      "error");
  }
  return nextProfile;
}
