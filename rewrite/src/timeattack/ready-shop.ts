/**
 * Opening the shop (server-go/ECONOMY.md 7.6) from the taskbar 상점 button and
 * the lobby top bar "+" buttons. The shop itself is src/shop/shop-view.ts; this
 * keeps one shop at a time, refreshes the account after purchases and reopens
 * the full-screen garage so new items appear there. Item pictures and the
 * stage's 3D rider come from shop-preview.ts (one garage renderer); they live
 * as long as the shop.
 *
 * Like the original MqShopStage, the shop leaves the taskbar (tray) visible
 * under it when the page shows one: going elsewhere from the taskbar closes
 * the shop first (상점 itself does nothing while it is open; 车库 returns to
 * the garage, reopened like on the shop's own close when something was
 * bought). The shop keeps its own elements out of that strip (shop-view.ts).
 *
 * Over the home lobby the shop keeps the live 3D lobby and its top bar in
 * view (the lobby's own panels, rider and kart step aside while it is open);
 * elsewhere it shows the lobby's last frame and draws the same top bar.
 */
import { activeBrowserSession } from "../account/account-runtime";
import type { InventoryItem } from "../account/account-session";
import type { ShopBackdrop, ShopOpenOptions, ShopPreviewRenderer, ShopTab } from "../shop/shop-view";
import { lobbyHomeBackdrop, lobbyShopBackdrop } from "../ui/lobby-home-backdrop";
import { mountLobbyTopBar } from "../ui/lobby-top-bar";
import type { TopBarArtLibrary } from "../ui/lobby-top-bar-assets";
import { MAIN_MENU_FONT_FAMILY } from "../ui/main-menu-view";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import { createShopPreview, type ShopRiderSelection } from "./shop-preview";

export interface ReadyShopController {
  host: {
    root: HTMLElement;
    hud: { showDebugText(message: string, kind: string): void };
    shell: { current: string; modal?: string; closeModal(name: string): void };
    getLibrary(): unknown;
    getSelection(): ReadySelection | undefined;
    getReadyOptions(): ReadyOptions;
    /** The local profile: equipment, garage parts and plate letters for the 3D rider. */
    getProfile?(): unknown;
  };
  disposed: boolean;
  activeShop?: { close(): void };
  shopOpening?: boolean;
  /** closeReadyShop ran while the shop was loading: close it as soon as it opens. */
  shopCancelled?: boolean;
  activeGarage?: unknown;
  activeTimeAttackReady?: unknown;
  /** The lobby home (ready-home.ts HomeScreen): its page and the lobby the shop opens over. */
  activeHome?: { showNotice(message: string): void; readonly page?: string; readonly lobby?: ShopLobby };
  /** The bottom taskbar (src/ui/taskbar.ts), when the page has one. */
  activeTaskbar?: unknown;
  enterTimeAttackReady(): Promise<unknown>;
  openGarageX(selection: ReadySelection, options: ReadyOptions): void;
}

export type ShopOpener = (options: ShopOpenOptions) => Promise<{ close(): void }>;

/** The lobby home view (ui/lobby-home-view.ts) as the shop sees it. */
export interface ShopLobby {
  readonly hidden: boolean;
  /** Keeps the 3D lobby and top bar, puts the rest aside; returns the restore. */
  enterShop(): () => void;
}

/** Item pictures and the rider for one open shop; dispose() when it closes. */
export type ShopPreviewFactory = (library: unknown, rider?: ShopRiderSelection) =>
  ShopPreviewRenderer & { dispose(): void };

/**
 * The taskbar's height on the shop's 1080-high screen: src/ui/taskbar.ts
 * logicalHeight, 66 of the release's 900 stage rows (7.333%).
 */
export const SHOP_TASKBAR_HEIGHT = Math.round(66 / 900 * 1080);

/**
 * Loaded on first use: the shop and its 3D previews (shop-preview-garage.ts,
 * imported by shop-preview.ts when a picture is first needed) stay out of the
 * startup bundle.
 */
const loadShop: ShopOpener = async options =>
  (await import("../shop/shop-view")).openShop(options);

function report(controller: ReadyShopController, message: string): void {
  controller.activeHome?.showNotice(message);
  controller.host.hud.showDebugText(message, "error");
}

/** GarageX hides Ready while it is shown; the classic dialog keeps Ready behind it. */
function garageXOpen(controller: ReadyShopController): boolean {
  return !!controller.activeGarage && !controller.activeTimeAttackReady &&
    controller.host.shell.modal === "garage";
}

/** GarageX lists the inventory it opened with; reopen it so purchases appear. */
async function reopenGarageX(controller: ReadyShopController): Promise<void> {
  const shell = controller.host.shell;
  if (shell.modal === "garage") shell.closeModal("garage");
  await controller.enterTimeAttackReady();
  if (controller.disposed) return;
  const selection = controller.host.getSelection();
  if (selection) controller.openGarageX(selection, controller.host.getReadyOptions());
}

/** The Ready kart and character with the profile's equipment, for the stage's rider. */
export function shopRider(controller: ReadyShopController): ShopRiderSelection | undefined {
  const selection = controller.host.getSelection();
  if (!selection || selection.vehicleItemId === undefined || selection.characterItemId === undefined)
    return undefined;
  let profile: { equipment?: unknown; garage?: unknown; initial?: unknown } | undefined;
  try {
    profile = controller.host.getProfile?.() as typeof profile;
  } catch {
    profile = undefined;
  }
  return {
    vehicleItemId: selection.vehicleItemId,
    ...(selection.vehiclePath ? { vehiclePath: selection.vehiclePath } : {}),
    ...(selection.vehicleSystemKey ? { vehicleSystemKey: selection.vehicleSystemKey } : {}),
    characterItemId: selection.characterItemId,
    ...(selection.characterPath ? { characterPath: selection.characterPath } : {}),
    ...(profile?.equipment !== undefined ? { equipment: profile.equipment } : {}),
    ...(profile?.garage !== undefined ? { garage: profile.garage } : {}),
    ...(profile?.initial !== undefined ? { initial: profile.initial } : {}),
  };
}

/** The visible taskbar element, if the page shows one. */
function visibleTaskbar(controller: ReadyShopController): HTMLElement | undefined {
  const element = (controller.activeTaskbar as { element?: unknown } | undefined)?.element as
    HTMLElement | undefined;
  if (!element || typeof element.contains !== "function" || element.hidden || !element.isConnected)
    return undefined;
  return element;
}

/** The taskbar's height in shop screen pixels (of 1080; 79 unless its rendered size says otherwise). */
function taskbarHeight(controller: ReadyShopController, taskbar: HTMLElement): number {
  try {
    const bar = taskbar.getBoundingClientRect().height;
    const root = controller.host.root.getBoundingClientRect().height;
    const height = Math.round(bar / root * 1080);
    if (Number.isFinite(height) && height > 0 && height < 360) return height;
  } catch { /* The release size. */ }
  return SHOP_TASKBAR_HEIGHT;
}

/** The lobby home on screen (its home page shown), which the shop opens over. */
function visibleLobby(controller: ReadyShopController): ShopLobby | undefined {
  const home = controller.activeHome;
  const lobby = home?.lobby;
  if (!lobby || typeof lobby.enterShop !== "function" || lobby.hidden) return undefined;
  if (home.page !== undefined && home.page !== "home") return undefined;
  // GarageX or the classic garage drawn over home.
  if (garageXOpen(controller)) return undefined;
  return lobby;
}

/** The taskbar button that goes back to the garage (src/ui/taskbar.ts onGarage). */
const GARAGE_BUTTON = "파츠";

/**
 * Follow the taskbar while the shop is open or loading. Runs before the
 * taskbar's own (and the home/house page's) handlers: 상점 does nothing,
 * any other enabled button is handed to onLeave and then does its own work.
 */
function followTaskbar(taskbar: HTMLElement, onLeave: (button: string) => void): () => void {
  const document = taskbar.ownerDocument;
  const onNavigation = (event: MouseEvent): void => {
    const target = event.target as Element | null;
    const button = typeof target?.closest === "function" ? target.closest("button") : null;
    if (!button || !taskbar.contains(button) || (button as HTMLButtonElement).disabled) return;
    const name = (button as HTMLElement).dataset.taskbarButton ?? "";
    // 상점 while the shop is open: nothing to do.
    if (name === "상점") {
      event.stopImmediatePropagation();
      return;
    }
    onLeave(name);
  };
  document.addEventListener("click", onNavigation, true);
  return () => document.removeEventListener("click", onNavigation, true);
}

function isTopBarLibrary(library: unknown): library is TopBarArtLibrary {
  return typeof (library as Partial<TopBarArtLibrary> | undefined)?.canonicalCandidates === "function";
}

/** Open the shop over the current page; one at a time. */
export async function openReadyShop(controller: ReadyShopController, initialTab?: ShopTab,
  open: ShopOpener = loadShop, createPreview: ShopPreviewFactory = createShopPreview): Promise<void> {
  if (controller.disposed || controller.activeShop || controller.shopOpening) return;
  const session = activeBrowserSession();
  if (!session) {
    report(controller, "商店需要登录账号。");
    return;
  }
  const library = controller.host.getLibrary();
  if (!library) return;
  controller.shopOpening = true;
  controller.shopCancelled = false;
  let purchased = false;
  let closed = false;
  const garageX = garageXOpen(controller);
  let preview: ReturnType<ShopPreviewFactory> | undefined;
  let handle: { close(): void } | undefined;
  let releaseTaskbar: (() => void) | undefined;
  let restoreLobby: (() => void) | undefined;
  const disposePreview = () => {
    const current = preview;
    preview = undefined;
    try { current?.dispose(); } catch { /* Pictures are optional. */ }
    const restore = restoreLobby;
    restoreLobby = undefined;
    try { restore?.(); } catch { /* The lobby view may be gone. */ }
  };
  const stopFollowingTaskbar = () => {
    releaseTaskbar?.();
    releaseTaskbar = undefined;
  };
  /**
   * The shop went away by the player's hand (Esc, its close button, the
   * taskbar) or the session. GarageX is reopened after a purchase so the new
   * items are listed, unless the taskbar leads elsewhere (only 车库 leads
   * back to the garage).
   */
  const finished = (reopen = true) => {
    if (closed) return;
    closed = true;
    stopFollowingTaskbar();
    disposePreview();
    controller.activeShop = undefined;
    if (reopen && purchased && garageX && garageXOpen(controller) && !controller.disposed) {
      void reopenGarageX(controller).catch(error =>
        report(controller, `车库刷新失败：${error instanceof Error ? error.message : String(error)}`));
    }
  };
  try {
    const rider = shopRider(controller);
    try { preview = createPreview(library, rider); } catch { preview = undefined; }
    const taskbar = visibleTaskbar(controller);
    if (taskbar) {
      // Followed from the start: a button pressed while the shop still loads
      // closes it as soon as it opens, so it never covers where the player went.
      releaseTaskbar = followTaskbar(taskbar, button => {
        if (!handle) {
          controller.shopCancelled = true;
          return;
        }
        handle.close();
        finished(button === GARAGE_BUTTON);
      });
    }
    // Over the home lobby its live scene and top bar stay; elsewhere its last
    // frame (without its rider: the stage draws one) and the same top bar.
    const lobby = visibleLobby(controller);
    let backdrop: ShopBackdrop | undefined;
    if (lobby) {
      try { restoreLobby = lobby.enterShop(); } catch { restoreLobby = undefined; }
    } else {
      try { backdrop = lobbyShopBackdrop() ?? lobbyHomeBackdrop(); } catch { backdrop = undefined; }
    }
    const topBar: ShopOpenOptions["topBar"] = (host, actions) => mountLobbyTopBar(host, {
      session, fontFamily: MAIN_MENU_FONT_FAMILY,
      ...(isTopBarLibrary(library) ? { library } : {}),
      // The "+" buttons in the shop: charging is not open yet.
      onCharge: () => actions.notice("商城充值暂未开放"),
    });
    const opened = await open({
      root: controller.host.root, library, session,
      ...(initialTab ? { initialTab } : {}),
      ...(preview ? { preview } : {}),
      ...(taskbar ? { taskbarHeight: taskbarHeight(controller, taskbar) } : {}),
      ...(lobby ? { overLobby: true } : { topBar, ...(backdrop ? { backdrop } : {}) }),
      onPurchased: (item: InventoryItem) => {
        purchased = true;
        session.applyInventoryItem(item);
        void session.refresh().catch(() => undefined);
      },
      onClose: () => finished(),
    });
    if (closed) return;
    if (controller.disposed || controller.shopCancelled) {
      closed = true;
      opened.close();
      stopFollowingTaskbar();
      disposePreview();
      return;
    }
    handle = opened;
    controller.activeShop = {
      close: () => {
        opened.close();
        if (!closed) {
          closed = true;
          stopFollowingTaskbar();
          controller.activeShop = undefined;
        }
        disposePreview();
      },
    };
  } catch (error) {
    closed = true;
    stopFollowingTaskbar();
    disposePreview();
    report(controller, `商店：${error instanceof Error ? error.message : String(error)}`);
  } finally {
    controller.shopOpening = false;
    controller.shopCancelled = false;
  }
}

/** Close an open shop, or one still loading (Ready controller disposal, race start). */
export function closeReadyShop(controller: Pick<ReadyShopController, "activeShop"> &
  Partial<Pick<ReadyShopController, "shopOpening" | "shopCancelled">>): void {
  if (controller.shopOpening) controller.shopCancelled = true;
  const shop = controller.activeShop;
  controller.activeShop = undefined;
  shop?.close();
}
