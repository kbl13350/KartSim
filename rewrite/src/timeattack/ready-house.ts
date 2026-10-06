import type { LocalProfile } from "../ui/local-profile";
import { ItemInventoryView } from "../ui/item-inventory-view";
import type { ItemInventoryCatalog, ItemInventoryItem } from "../ui/item-inventory";
import { loadMyRoomCatalog, type MyRoomResourceLibrary } from "../ui/my-room-catalog";
import { MyRoomView } from "../ui/my-room-view";
import type { ReadyFlowController } from "./ready-flow";
import type { ReadyGarageController } from "./ready-garage";
import { equipReadyInventoryItem } from "./ready-inventory";

export interface ReadyHouseController extends ReadyFlowController {
  activeHouse?: MyRoomView;
  activeItemInventory?: ItemInventoryView;
  inventoryOpening?: boolean;
  host: ReadyFlowController["host"] & {
    setProfile(profile: LocalProfile): void;
    saveProfile(): void;
  };
}

/** Keep the in-memory profile and its local/server mirror together. */
export function saveReadyHouseProfile(controller: ReadyHouseController,
  profile: LocalProfile): void {
  const prior = controller.host.getProfile() as LocalProfile;
  controller.host.setProfile(profile);
  try {
    controller.host.saveProfile();
  } catch (error) {
    controller.host.setProfile(prior);
    throw error;
  }
  if (prior.myRoom !== profile.myRoom) controller.activeHouse?.refresh(profile);
  controller.activeItemInventory?.refresh(profile);
}

export function closeReadyHouse(controller: ReadyHouseController): void {
  controller.activeItemInventory?.dispose();
  controller.activeItemInventory = undefined;
  controller.activeHouse?.dispose();
  controller.activeHouse = undefined;
  if (controller.host.shell.modal === "house") controller.host.shell.closeModal("house");
  if (!controller.disposed && controller.host.shell.current === "Ready") {
    controller.activeTimeAttackReady?.unfreeze();
    controller.activeTaskbar?.setVisible(true);
  }
}

async function openHouseInventory(controller: ReadyHouseController,
  library: MyRoomResourceLibrary & {
    timeAttackGarageCatalog(): Promise<unknown>;
  }): Promise<void> {
  if (controller.inventoryOpening || controller.activeItemInventory || !controller.activeHouse) return;
  const house = controller.activeHouse;
  controller.inventoryOpening = true;
  try {
    const catalog = await library.timeAttackGarageCatalog() as ItemInventoryCatalog;
    if (controller.disposed || controller.host.shell.modal !== "house" ||
        controller.activeHouse !== house) return;
    let view!: ItemInventoryView;
    view = new ItemInventoryView({
      root: controller.host.root,
      catalog,
      profile: controller.host.getProfile() as LocalProfile,
      onProfileChange: profile => saveReadyHouseProfile(controller, profile),
      onEquip: (item, action) => equipFromHouseInventory(controller, item, catalog, action),
      onClose: () => {
        if (controller.activeItemInventory === view) controller.activeItemInventory = undefined;
        controller.activeHouse?.inventoryClosed();
      },
    });
    controller.activeItemInventory = view;
    try {
      view.show();
    } catch (error) {
      view.dispose();
      if (controller.activeItemInventory === view) controller.activeItemInventory = undefined;
      throw error;
    }
  } finally {
    controller.inventoryOpening = false;
  }
}

async function equipFromHouseInventory(controller: ReadyHouseController,
  item: ItemInventoryItem, catalog: ItemInventoryCatalog,
  action: "equip" | "unequip" = "equip"): Promise<LocalProfile> {
  const selection = controller.host.getSelection();
  if (!selection) throw new Error("当前没有可更新的 Ready 装备。");
  const options = controller.host.getReadyOptions();
  closeReadyHouse(controller);
  try {
    // The generated ql0 controller owns the ReadyGarageController operations.
    return await equipReadyInventoryItem(controller as unknown as ReadyGarageController,
      selection, options, item, catalog, action);
  } catch (error) {
    controller.host.hud.showDebugText(
      `装备道具失败：${error instanceof Error ? error.message : String(error)}`, "error");
    throw error;
  }
}

/** Open the saved My Room from Ready, holding a distinct shell modal state. */
export async function openReadyHouse(controller: ReadyHouseController): Promise<void> {
  if (controller.disposed || controller.activeHouse || controller.readyModalBusy() ||
      !controller.activeTimeAttackReady) return;
  const library = controller.host.getLibrary() as
    (MyRoomResourceLibrary & { timeAttackGarageCatalog(): Promise<unknown> }) | undefined;
  if (!library) return;
  if (!controller.host.shell.openModal("house")) return;
  controller.activeTimeAttackReady.freeze();
  controller.activeTaskbar?.setVisible(false);
  try {
    const environments = await loadMyRoomCatalog(library);
    if (controller.disposed || controller.host.shell.modal !== "house") return;
    const view = new MyRoomView({
      root: controller.host.root,
      environments,
      profile: controller.host.getProfile() as LocalProfile,
      onProfileChange: profile => saveReadyHouseProfile(controller, profile),
      onOpenInventory: () => openHouseInventory(controller, library),
      onClose: () => closeReadyHouse(controller),
    });
    controller.activeHouse = view;
    try {
      view.show();
    } catch (error) {
      view.dispose();
      if (controller.activeHouse === view) controller.activeHouse = undefined;
      throw error;
    }
  } catch (error) {
    controller.host.hud.showDebugText(
      `我的小屋：${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    if (!controller.activeHouse && controller.host.shell.modal === "house")
      closeReadyHouse(controller);
  }
}
