import type { LocalProfile } from "../ui/local-profile";
import { ItemInventoryView } from "../ui/item-inventory-view";
import type { ItemInventoryCatalog, ItemInventoryItem } from "../ui/item-inventory";
import { loadMyRoomCatalog } from "../ui/my-room-catalog";
import type { MyRoomSceneLibrary, MyRoomSceneSubject } from "../ui/my-room-scene";
import { MyRoomView } from "../ui/my-room-view";
import type { ReadyFlowController } from "./ready-flow";
import type { ReadyGarageController } from "./ready-garage";
import { equipReadyInventoryItem } from "./ready-inventory";

export interface ReadyHouseController extends ReadyFlowController {
  activeHouse?: MyRoomView;
  activeItemInventory?: ItemInventoryView;
  inventoryOpening?: boolean;
  houseTaskbarRelease?: () => void;
  host: ReadyFlowController["host"] & {
    setProfile(profile: LocalProfile): void;
    saveProfile(): void;
  };
}

type ReadyHouseLibrary = MyRoomSceneLibrary & {
  timeAttackGarageCatalog(): Promise<ItemInventoryCatalog>;
};

/** Match the displayed models to the exact Ready selection, including system karts. */
function currentRoomSubject(controller: ReadyHouseController,
  catalog: ItemInventoryCatalog): MyRoomSceneSubject | undefined {
  const selection = controller.host.getSelection();
  const environment = controller.readyToonEnvironment;
  const binding = controller.host.toonStageBinding as
    Partial<MyRoomSceneSubject["stageBinding"]> | undefined;
  if (!selection?.vehiclePath || !selection.characterPath || !environment ||
      typeof binding?.beginFrame !== "function" ||
      typeof binding.coatingTextures !== "function") return undefined;
  const kart = catalog.karts.find(item => item.itemId === selection.vehicleItemId &&
    item.path.toLowerCase() === selection.vehiclePath!.toLowerCase() &&
    (item.itemId !== 0 || item.systemKey === selection.vehicleSystemKey));
  const character = catalog.characters.find(item =>
    item.itemId === selection.characterItemId &&
    item.path.toLowerCase() === selection.characterPath!.toLowerCase());
  if (!kart || !character) return undefined;
  return { kart, character, profile: controller.host.getProfile() as LocalProfile,
    environment, stageBinding: binding as MyRoomSceneSubject["stageBinding"] };
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
  controller.houseTaskbarRelease?.();
  controller.houseTaskbarRelease = undefined;
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
  library: ReadyHouseLibrary): Promise<void> {
  if (controller.inventoryOpening || controller.activeItemInventory || !controller.activeHouse) return;
  const house = controller.activeHouse;
  controller.inventoryOpening = true;
  try {
    const catalog = await library.timeAttackGarageCatalog();
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
    const profile = await equipReadyInventoryItem(controller as unknown as ReadyGarageController,
      selection, options, item, catalog, action);
    // Ready recreates its model stage when equipment changes. Return to the room so
    // the parked vehicle and rider immediately reflect the newly selected item.
    if (!controller.disposed && controller.host.shell.current === "Ready" &&
        controller.activeTimeAttackReady) await openReadyHouse(controller);
    return profile;
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
    ReadyHouseLibrary | undefined;
  if (!library) return;
  if (!controller.host.shell.openModal("house")) return;
  controller.activeTimeAttackReady.freeze();
  try {
    const [environments, catalog] = await Promise.all([
      loadMyRoomCatalog(library), library.timeAttackGarageCatalog(),
    ]);
    if (controller.disposed || controller.host.shell.modal !== "house") return;
    const view = new MyRoomView({
      root: controller.host.root,
      library,
      subject: currentRoomSubject(controller, catalog),
      environments,
      profile: controller.host.getProfile() as LocalProfile,
      onProfileChange: profile => saveReadyHouseProfile(controller, profile),
      onOpenInventory: () => openHouseInventory(controller, library),
      onClose: () => closeReadyHouse(controller),
    });
    controller.activeHouse = view;
    try {
      view.show();
      const taskbar = controller.activeTaskbar as { element?: HTMLElement } | undefined;
      if (taskbar?.element) {
        const element = taskbar.element;
        const onNavigation = (event: MouseEvent): void => {
          const button = event.target instanceof Element
            ? event.target.closest("button") : null;
          if (!button || !element.contains(button) || button.disabled) return;
          if (button.getAttribute("aria-label") === "小屋")
            event.stopImmediatePropagation();
          closeReadyHouse(controller);
        };
        element.addEventListener("click", onNavigation, true);
        controller.houseTaskbarRelease = () =>
          element.removeEventListener("click", onNavigation, true);
      }
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
