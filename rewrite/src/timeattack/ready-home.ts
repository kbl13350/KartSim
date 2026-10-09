import { activeBrowserSession } from "../account/account-runtime";
import { logoutAccount } from "../app/account-startup";
import { openAccountPanel, type AccountPanelDocument, type AccountPanelHandle } from "../ui/account-panel";
import { HomeScreen } from "../ui/home-screen";
import { LobbyHomeView, type QuickEntry } from "../ui/lobby-home-view";
import { followAccountTopBar, lobbyAccountInfo } from "../ui/lobby-top-bar";
import { loadLobbyTopBarArt, type TopBarArtLibrary } from "../ui/lobby-top-bar-assets";
import { MAIN_MENU_FONT_FAMILY, MainMenuView, loadMainMenuAssets, type MainMenuAssets,
  type MainMenuLibrary, type MainMenuPage } from "../ui/main-menu-view";
import type { LocalProfile } from "../ui/local-profile";
import { loadMyRoomCatalog } from "../ui/my-room-catalog";
import type { ReadyFlowController } from "./ready-flow";
import { currentRoomSubject, localRiderName, type ReadyHouseController,
  type ReadyHouseLibrary } from "./ready-house";
import { leaveStory, loadStoryMenu, openStoryChapter } from "./ready-story";
import type { ReadyShopController } from "./ready-shop";
import { openShopUnlessRacing } from "./ready-shop-guard";

/**
 * The lobby home and the release 单人游戏 page shown over Ready. Ready's own
 * window is the time attack page; it is uncovered only by 计时挑战赛,
 * 练习计时赛 or 竞争排位赛. Other destinations keep the menu up until they draw
 * themselves, so the time attack page never flashes between pages.
 */
export interface ReadyHomeController extends ReadyFlowController {
  activeHome?: HomeScreen;
  homeOpening?: boolean;
  /** Home opens once by itself when Ready first appears after startup. */
  homeShownAtStartup?: boolean;
  /** Home was asked for while Ready was being rebuilt. */
  homeRequested?: boolean;
  /** Page the next home view opens on. */
  homePage?: MainMenuPage;
  homeTaskbarRelease?: () => void;
  /** Stops the top bar following the account session. */
  homeAccountRelease?: () => void;
  accountPanel?: AccountPanelHandle;
  multiplayer?: unknown;
  activeHouse?: unknown;
  openMultiplayer(channel?: string, gameplay?: string): Promise<void>;
}

/** Before an account summary is read the top bar shows level 1. */
const LOBBY_LEVEL = 1;

/** The top bar fields of an account summary (ECONOMY.md 7.5); shared with the shop's top bar. */
export { lobbyAccountInfo };

/** Keep the top bar in step with the session: purchases, races and level ups. */
function followAccount(controller: ReadyHomeController, view: HomeScreen,
  library: TopBarArtLibrary): void {
  const session = activeBrowserSession();
  if (!session) return;
  controller.homeAccountRelease = followAccountTopBar(session, library, account => {
    if (controller.activeHome === view) view.lobby.setAccount(account);
  });
}

/** The account panel from the rider in the top bar. */
function openHomeAccountPanel(controller: ReadyHomeController): void {
  const session = activeBrowserSession();
  if (!session || controller.accountPanel) return;
  const host = controller.host;
  controller.accountPanel = openAccountPanel({
    document: host.root.ownerDocument as unknown as AccountPanelDocument,
    session,
    logoutBlocked: () => controller.multiplayer
      ? "正在多人游戏中，请先离开房间和比赛再退出登录。" : undefined,
    onLogout: () => logoutAccount(host.root),
    onClose: () => { controller.accountPanel = undefined; },
    onActivate: () => host.getInterfaceAudio()?.playClick(),
  });
}
/** Mode card art beside the two promotion boards. */
const BOARD_ART = ["/ui/multiplayer/ordinary-race.png", "/ui/multiplayer/giant-mode.png"] as const;

/** Longest wait for a destination page before home steps aside anyway. */
const COVER_TIMEOUT_MS = 15_000;
/** A click that started nothing within this time leaves home in place. */
const NAVIGATION_GRACE_MS = 400;

const assetCache = new WeakMap<object, Promise<MainMenuAssets>>();

function homeLibrary(controller: ReadyHomeController): MainMenuLibrary | undefined {
  const library = controller.host.getLibrary() as Partial<MainMenuLibrary> | undefined;
  // The release stage resources are looked up by canonical path; without that
  // lookup there is no home to draw and Ready stays as it is.
  return typeof library?.canonicalCandidates === "function"
    ? library as MainMenuLibrary : undefined;
}

function homeAssets(library: MainMenuLibrary): Promise<MainMenuAssets> {
  let pending = assetCache.get(library);
  if (!pending) {
    pending = loadMainMenuAssets(library);
    pending.catch(() => assetCache.delete(library));
    assetCache.set(library, pending);
  }
  return pending;
}

/** Start loading home art early so home can cover Ready the moment it shows. */
export function preloadReadyHome(controller: ReadyHomeController): void {
  const library = homeLibrary(controller);
  if (library) homeAssets(library).catch(() => undefined);
}

function lobbyVisible(controller: ReadyHomeController): boolean {
  const lobby = controller.host.root.querySelector<HTMLElement>(
    'div[aria-label="多人游戏大厅"]');
  return !!lobby && !lobby.hidden;
}

/** Another page now draws over the stage, so home may go. */
function homeCovered(controller: ReadyHomeController): boolean {
  const shell = controller.host.shell as { current?: string };
  // Pages that are drawn: the room and garage views exist only once shown.
  if (controller.activeHouse || controller.activeGarage) return true;
  return !!controller.multiplayer && (lobbyVisible(controller) ||
    (shell.current !== "Ready" && shell.current !== "MultiplayerLobby"));
}

function navigationPending(controller: ReadyHomeController): boolean {
  const shell = controller.host.shell as { modal?: unknown; isReadyStageOpening?: boolean };
  return !!controller.multiplayer || !!shell.modal || !!shell.isReadyStageOpening ||
    controller.readyModalBusy();
}

/** Keep home up until the destination page is drawn, then remove it. */
export function closeReadyHomeWhenCovered(controller: ReadyHomeController): void {
  const view = controller.activeHome;
  if (!view) return;
  const started = performance.now();
  const tick = (): void => {
    if (controller.activeHome !== view || controller.disposed) return;
    const elapsed = performance.now() - started;
    if (homeCovered(controller) || elapsed > COVER_TIMEOUT_MS) {
      closeReadyHome(controller);
      return;
    }
    // Nothing opened (a guarded or failed click): stay on home.
    if (elapsed > NAVIGATION_GRACE_MS && !navigationPending(controller)) return;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

export async function openReadyHome(controller: ReadyHomeController,
  page: MainMenuPage = controller.homePage ?? "home"): Promise<void> {
  controller.homePage = page;
  if (controller.activeHome) {
    // The request is met; a stale flag would reopen home over Ready later.
    controller.homeRequested = false;
    controller.activeHome.setPage(page);
    return;
  }
  if (controller.disposed || controller.homeOpening || controller.activeHouse) return;
  const library = homeLibrary(controller);
  if (!library) return;
  const host = controller.host;
  controller.homeOpening = true;
  try {
    const assets = await homeAssets(library);
    if (controller.disposed || controller.activeHome || controller.activeHouse) return;
    const single = new MainMenuView(host.root, assets, {
      keepFont: true,
      onTimeAttack: () => closeReadyHome(controller),
      onPractice: () => closeReadyHome(controller),
      onChannel: channel => {
        void controller.openMultiplayer(channel);
        closeReadyHomeWhenCovered(controller);
      },
      onHover: () => host.getInterfaceAudio()?.playHover(),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
      onCategory: category => {
        if (category !== "cat_scenario") return;
        // Progress may have changed since the list was read.
        void loadStoryMenu(controller).then(chapters => {
          if (controller.activeHome === view) view.setStoryChapters(chapters);
        }).catch(error => view.showNotice(
          `故事模式读取失败：${error instanceof Error ? error.message : String(error)}`));
      },
      onStoryChapter: name => { void openStoryChapter(controller, name); },
    });
    let lobby: LobbyHomeView;
    const account = activeBrowserSession();
    const summary = account?.summary();
    try {
      lobby = new LobbyHomeView(host.root, {
        riderName: summary?.account.nickname ?? localRiderName(),
        ...(summary ? lobbyAccountInfo(summary) : {}),
        ...(account ? {
          // The "+" buttons and the rider open the shop and the account panel.
          onCharge: () => openShopUnlessRacing(controller as unknown as ReadyShopController),
          onAccount: () => openHomeAccountPanel(controller),
        } : {}),
        banners: assets.banners,
        backdrop: assets.backdrop,
        boardArt: BOARD_ART,
        fontFamily: MAIN_MENU_FONT_FAMILY,
        onEntry: entry => openQuickEntry(controller, entry),
        onHover: () => host.getInterfaceAudio()?.playHover(),
        onActivate: () => host.getInterfaceAudio()?.playClick(),
      });
    } catch (error) {
      single.dispose();
      throw error;
    }
    const view = new HomeScreen(lobby, single, controller.homePage ?? "home");
    controller.activeHome = view;
    void attachLobbyScene(controller, view);
    // Release level glove and currency icons; the drawn ones stay if they are missing.
    void loadLobbyTopBarArt(library as unknown as TopBarArtLibrary,
      summary?.progress.level ?? LOBBY_LEVEL)
      .then(art => { if (controller.activeHome === view) view.lobby.setTopBarArt(art); })
      .catch(() => undefined);
    followAccount(controller, view, library as unknown as TopBarArtLibrary);
    controller.homeRequested = false;
    controller.activeTimeAttackReady?.freeze();
    const taskbar = controller.activeTaskbar as { element?: HTMLElement } | undefined;
    const element = taskbar?.element;
    if (element) {
      const onNavigation = (event: MouseEvent): void => {
        const button = event.target instanceof Element ? event.target.closest("button") : null;
        if (!button || !element.contains(button) || button.disabled) return;
        switch (button.dataset.taskbarButton) {
          case "gotoHome":
          case "singleplay":
            // Both are pages of this view; story windows belong to 单人游戏.
            event.stopImmediatePropagation();
            leaveStory(controller);
            controller.homePage = button.dataset.taskbarButton === "gotoHome" ? "home" : "single";
            view.setPage(controller.homePage);
            host.getInterfaceAudio()?.playClick();
            return;
          // Settings, the shop and 好友聊天系统 are dialogs over the menu.
          case "설정":
          case "상점":
          case "messengerButton": return;
          default:
            view.captureBackdrop();
            closeReadyHomeWhenCovered(controller);
        }
      };
      element.addEventListener("click", onNavigation, true);
      controller.homeTaskbarRelease = () =>
        element.removeEventListener("click", onNavigation, true);
    }
  } catch (error) {
    host.hud.showDebugText(
      `主菜单：${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    controller.homeOpening = false;
  }
}

/** 快速进入: a multiplayer room list, or the time attack page under home. */
function openQuickEntry(controller: ReadyHomeController, entry: QuickEntry): void {
  if (entry.kind === "timeAttack") {
    closeReadyHome(controller);
    return;
  }
  if (entry.kind !== "multiplayer" || !entry.channel) return;
  void controller.openMultiplayer(entry.channel, entry.gameplay ?? "ordinary");
  closeReadyHomeWhenCovered(controller);
}

/** The rider's My Room scene with the rider and kart Ready shows; home keeps its still backdrop on failure. */
async function attachLobbyScene(controller: ReadyHomeController, view: HomeScreen): Promise<void> {
  const library = controller.host.getLibrary() as Partial<ReadyHouseLibrary> | undefined;
  if (typeof library?.timeAttackGarageCatalog !== "function" || !Array.isArray(library.files))
    return;
  try {
    const [environments, catalog] = await Promise.all([
      loadMyRoomCatalog(library as ReadyHouseLibrary),
      library.timeAttackGarageCatalog(),
    ]);
    if (controller.activeHome !== view || controller.disposed) return;
    // The rider's own room, as My Room opens it.
    const profile = controller.host.getProfile() as Partial<LocalProfile> | undefined;
    const environment = environments.find(room =>
      room.id === profile?.myRoom?.environmentId) ?? environments.find(room => room.isDefault);
    if (!environment) return;
    view.lobby.attachScene(library as ReadyHouseLibrary, environment,
      currentRoomSubject(controller as unknown as ReadyHouseController, catalog));
  } catch (error) {
    controller.host.hud.showDebugText(
      `大厅场景：${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

async function refreshHomeScene(controller: ReadyHomeController, view: HomeScreen): Promise<void> {
  const library = controller.host.getLibrary() as Partial<ReadyHouseLibrary> | undefined;
  if (typeof library?.timeAttackGarageCatalog !== "function") return;
  try {
    const catalog = await library.timeAttackGarageCatalog();
    if (controller.activeHome !== view || controller.disposed) return;
    view.lobby.updateSceneSubject(
      currentRoomSubject(controller as unknown as ReadyHouseController, catalog));
  } catch {
    // The scene keeps the rider it already shows.
  }
}

export function closeReadyHome(controller: ReadyHomeController): void {
  const view = controller.activeHome;
  if (!view) return;
  controller.homeTaskbarRelease?.();
  controller.homeTaskbarRelease = undefined;
  controller.homeAccountRelease?.();
  controller.homeAccountRelease = undefined;
  controller.accountPanel?.close();
  controller.activeHome = undefined;
  leaveStory(controller);
  view.dispose();
  const shell = controller.host.shell as { current?: string; modal?: unknown };
  if (!controller.disposed && shell.current === "Ready" && !shell.modal &&
      !controller.multiplayer && !controller.activeHouse && !controller.activeGarage)
    controller.activeTimeAttackReady?.unfreeze();
}

/**
 * 首页 or 单人游戏 from the taskbar: cover the current page with home first, then leave
 * it, so Ready is rebuilt underneath without being seen.
 */
export async function goReadyHome(controller: ReadyHomeController,
  leave: () => Promise<void> | void, page: MainMenuPage = "home"): Promise<void> {
  controller.homeRequested = true;
  await openReadyHome(controller, page);
  await leave();
  if (controller.multiplayer && controller.activeHome) {
    // The lobby refused to leave (for example mid-race); show it again.
    closeReadyHome(controller);
  }
}

/** Called after Ready (re)builds its window: open home at startup, keep it covering. */
export function syncReadyHome(controller: ReadyHomeController): void {
  if (controller.activeHome) {
    controller.activeTimeAttackReady?.freeze();
    // Ready was rebuilt under home (onboarding, an expired rental): show the new rider.
    void refreshHomeScene(controller, controller.activeHome);
    return;
  }
  if (controller.homeShownAtStartup && !controller.homeRequested) return;
  controller.homeShownAtStartup = true;
  void openReadyHome(controller);
}
