import type { FavoriteItem, LocalProfile } from "../ui/local-profile";
import type { MyRoomAdminKart } from "../ui/my-room-admin";
import type { ItemInventoryCatalog } from "../ui/item-inventory";
import { C7, ds } from "../generated/ui.js";
import { loadMyRoomCatalog } from "../ui/my-room-catalog";
import type { MyRoomSceneLibrary, MyRoomSceneSubject } from "../ui/my-room-scene";
import { MyRoomView } from "../ui/my-room-view";
import { loadLocalRiderNickname } from "../multiplayer/account-local-state";
import type { ReadyFlowController } from "./ready-flow";
import { selectReadyGarage, selectionKeep, type ReadyGarageController } from "./ready-garage";
import { garageViewCatalog } from "../account/garage-ownership";
import { activeBrowserSession } from "../account/account-runtime";
import { currentMessenger } from "../messenger/messenger-runtime";
import { MyRoomApi } from "../myroom/myroom-api";
import { MyRoomConnection, myRoomSocketUrl, type RoomAppearance } from "../myroom/myroom-connection";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import type { MyRoomSocial } from "../ui/my-room-view";

/** The release GarageDialog ("我的物品") opened from the room menu. */
interface HouseGarageView { show(): void; dispose(): void }

type GarageChoice = Parameters<typeof selectReadyGarage>[3];

export interface ReadyHouseController extends ReadyFlowController {
  activeHouse?: MyRoomView;
  activeHouseGarage?: HouseGarageView;
  inventoryOpening?: boolean;
  houseTaskbarRelease?: () => void;
  host: ReadyFlowController["host"] & {
    setProfile(profile: LocalProfile): void;
    saveProfile(): void;
  };
}

export type ReadyHouseLibrary = MyRoomSceneLibrary & {
  timeAttackGarageCatalog(): Promise<ItemInventoryCatalog>;
};

/** Match the displayed models to the exact Ready selection, including system karts. */
export function currentRoomSubject(controller: ReadyHouseController,
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

/**
 * Another rider's look (a room member or owner) as scene models from the
 * full garage catalog, sharing Ready's toon environment; undefined when its
 * kart or character is not in this client's catalog.
 */
export function appearanceSubject(controller: ReadyHouseController, catalog: ItemInventoryCatalog,
  appearance: RoomAppearance): MyRoomSceneSubject | undefined {
  const environment = controller.readyToonEnvironment;
  const binding = controller.host.toonStageBinding as
    Partial<MyRoomSceneSubject["stageBinding"]> | undefined;
  if (!environment || typeof binding?.beginFrame !== "function" ||
      typeof binding.coatingTextures !== "function") return undefined;
  const equipment = appearance.equipment;
  const kartId = equipment.itemIds[3] ?? 0;
  const systemKart = typeof equipment.systemKart === "string" ? equipment.systemKart : undefined;
  const kart = catalog.karts.find(item => item.itemId === kartId &&
    (item.itemId !== 0 || item.systemKey === systemKart));
  const character = catalog.characters.find(item => item.itemId === equipment.itemIds[1]);
  if (!kart || !character) return undefined;
  return { kart, character, profile: appearance as unknown as LocalProfile,
    environment, stageBinding: binding as MyRoomSceneSubject["stageBinding"] };
}

/** The live room services while an account is signed in. */
function roomSocial(controller: ReadyHouseController, library: ReadyHouseLibrary,
  catalog: ItemInventoryCatalog): MyRoomSocial | undefined {
  const session = activeBrowserSession();
  if (!session) return undefined;
  return {
    api: new MyRoomApi(session),
    connection: new MyRoomConnection({ url: myRoomSocketUrl(session.backendOrigin),
      token: () => session.isClosed || session.expired ? undefined : session.sessionToken }),
    resolveAppearance: appearance => appearanceSubject(controller, catalog, appearance),
    friends: () => currentMessenger()?.store.state?.friends.map(friend => friend.nickname) ?? [],
    notice: (title, message) => openMessengerMessage(library as never, controller.host.root, title, message),
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
}

export function closeReadyHouse(controller: ReadyHouseController): void {
  controller.houseTaskbarRelease?.();
  controller.houseTaskbarRelease = undefined;
  controller.activeHouseGarage?.dispose();
  controller.activeHouseGarage = undefined;
  controller.activeHouse?.dispose();
  controller.activeHouse = undefined;
  if (controller.host.shell.modal === "house") controller.host.shell.closeModal("house");
  if (!controller.disposed && controller.host.shell.current === "Ready") {
    controller.activeTimeAttackReady?.unfreeze();
    controller.activeTaskbar?.setVisible(true);
  }
}

/** "我的物品" in the room opens the same release GarageDialog as Ready. */
async function openHouseInventory(controller: ReadyHouseController,
  library: ReadyHouseLibrary): Promise<void> {
  if (controller.inventoryOpening || controller.activeHouseGarage || !controller.activeHouse) return;
  const house = controller.activeHouse;
  const host = controller.host;
  const selection = host.getSelection();
  const environment = controller.readyToonEnvironment;
  if (!selection?.vehiclePath || selection.vehicleItemId === undefined ||
      !selection.characterPath || !selection.characterItemId || !environment)
    throw new Error("我的物品缺少资源库或当前装备身份。");
  controller.inventoryOpening = true;
  try {
    // 我的物品 lists what the account owns, with rentals' remaining time.
    const catalog = garageViewCatalog(await library.timeAttackGarageCatalog(),
      selectionKeep(selection));
    if (controller.disposed || host.shell.modal !== "house" ||
        controller.activeHouse !== house) return;
    const garageController = controller as unknown as ReadyGarageController;
    let view!: HouseGarageView;
    const close = (): void => {
      view.dispose();
      if (controller.activeHouseGarage === view) controller.activeHouseGarage = undefined;
      controller.activeHouse?.inventoryClosed();
    };
    view = await C7.load({
      library, root: host.root, stageBinding: host.toonStageBinding,
      environment, catalog, profile: host.getProfile(),
      selectedKartItemId: selection.vehicleItemId,
      // System karts (the starter practice kart) all have item id 0.
      selectedKartSystemKey: selection.vehicleSystemKey,
      selectedKartPath: selection.vehiclePath,
      selectedCharacterItemId: selection.characterItemId,
      onConfirm: (choice: GarageChoice) => {
        close();
        void equipFromHouseGarage(controller, choice);
      },
      onCancel: close,
      onFavoriteChange: (items: unknown) => garageController.changeFavoriteItems(items),
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
      onInteraction: () => { host.getAudioContext()?.resume(); },
      // Release window notices (favourite/lock results), shared with Ready.
      onNotice: (message: unknown, kind: unknown, details: unknown) => {
        const owner = controller as unknown as { activeWindowNotice?: {
          show(message: unknown, kind: unknown, details: unknown): void } };
        owner.activeWindowNotice ??= new ds(host.root);
        owner.activeWindowNotice!.show(message, kind, details);
      },
    }) as HouseGarageView;
    if (controller.disposed || controller.activeHouse !== house) {
      view.dispose();
      return;
    }
    controller.activeHouseGarage = view;
    view.show();
  } finally {
    controller.inventoryOpening = false;
  }
}

/**
 * Ready recreates its model stage when equipment changes, so leave the room,
 * commit through Ready's garage path, then return so the parked kart and rider
 * reflect the new choice.
 */
async function equipFromHouseGarage(controller: ReadyHouseController,
  choice: GarageChoice): Promise<void> {
  const selection = controller.host.getSelection();
  if (!selection) return;
  const options = controller.host.getReadyOptions();
  closeReadyHouse(controller);
  try {
    await selectReadyGarage(controller as unknown as ReadyGarageController,
      selection, options, choice);
    if (!controller.disposed && controller.host.shell.current === "Ready" &&
        controller.activeTimeAttackReady) await openReadyHouse(controller);
  } catch (error) {
    controller.host.hud.showDebugText(
      `装备道具失败：${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

/** Starred karts (favoriteItems category 3) that resolve to a local kart model. */
function starredRoomKarts(profile: LocalProfile,
  catalog: ItemInventoryCatalog): MyRoomAdminKart[] {
  return profile.favoriteItems.filter(item => item.category === 3).flatMap(item => {
    const kart = roomKart(item, catalog);
    return kart ? [{ item, title: kart.title }] : [];
  });
}

function roomKart(item: FavoriteItem, catalog: ItemInventoryCatalog) {
  return catalog.karts.find(kart => kart.itemId === item.itemId &&
    (item.itemId !== 0 || kart.systemKey === item.systemKart));
}

export function localRiderName(): string {
  try {
    return loadLocalRiderNickname(() => localStorage) || "车手";
  } catch {
    return "车手";
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
      ownerName: localRiderName(),
      // Representative karts are chosen from owned karts; parked ones still render.
      starredKarts: starredRoomKarts(controller.host.getProfile() as LocalProfile,
        garageViewCatalog(catalog, selectionKeep(controller.host.getSelection()))),
      resolveKart: item => roomKart(item, catalog),
      onProfileChange: profile => saveReadyHouseProfile(controller, profile),
      onOpenInventory: () => openHouseInventory(controller, library),
      onClose: () => closeReadyHouse(controller),
      social: roomSocial(controller, library, catalog),
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
          // The shop and 好友聊天系统 open over the room.
          if (button.dataset.taskbarButton === "상점" ||
            button.dataset.taskbarButton === "messengerButton") return;
          if (button.getAttribute("aria-label") === "小屋") {
            event.stopImmediatePropagation();
            // Visiting: 小屋 goes back to the player's own room.
            if (view.visiting) {
              view.goHome();
              return;
            }
          }
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
