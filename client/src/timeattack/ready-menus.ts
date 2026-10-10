import { activeBrowserSession } from "../account/account-runtime";
import { currentMessenger } from "../messenger/messenger-runtime";
import { GlobalChat } from "../menus/global-chat";
import { MenusApi, menuErrorMessage } from "../menus/menus-api";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import { Noticer } from "../menus/noticer";
import { RiderCardView } from "../menus/rider-card";
import { openFindRiderDialog } from "../ui/my-room-dialogs";
import { openReadyHouse, type ReadyHouseController } from "./ready-house";
import { QuestScreen } from "../menus/quest-screen";
import { RewardBoxScreen } from "../menus/reward-box-screen";
import type { BmlLibrary } from "../ui/bml-kit";
import type { ReadyFlowController } from "./ready-flow";

/**
 * The taskbar menus over whatever page is showing: 奖励箱, 任务 and
 * 查找车手's rider card are modal windows (one at a time); 迷你提示窗 and
 * the 聊天 window stay open beside the page. A race or leaving Ready
 * closes them.
 */
export interface ReadyMenusController extends ReadyFlowController {
  activeMenu?: { dispose(): void };
  menuOpening?: boolean;
  activeNoticer?: { noticer: Noticer; session: object };
  activeChat?: GlobalChat;
}

function context(controller: ReadyMenusController, title: string) {
  const host = controller.host;
  const session = activeBrowserSession();
  const library = host.getLibrary() as Partial<BmlLibrary> | undefined;
  if (!session || typeof library?.canonicalCandidates !== "function") {
    host.hud.showDebugText(`${title}：请先登录。`, "error");
    return undefined;
  }
  return { host, session, library: library as BmlLibrary, api: new MenusApi(session) };
}

/** Run an opener of a modal menu; the previous one closes first. */
async function openModal(controller: ReadyMenusController, title: string,
  open: (close: () => void) => Promise<{ dispose(): void }>): Promise<void> {
  if (controller.menuOpening || controller.disposed) return;
  closeReadyMenus(controller);
  controller.menuOpening = true;
  let menu: { dispose(): void } | undefined;
  const close = () => {
    if (controller.activeMenu === menu) controller.activeMenu = undefined;
    menu?.dispose();
  };
  try {
    menu = await open(close);
    if (controller.disposed) menu.dispose();
    else controller.activeMenu = menu;
  } catch (error) {
    controller.host.hud.showDebugText(`${title}：${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    controller.menuOpening = false;
  }
}

export function openReadyRewardBox(controller: ReadyMenusController): Promise<void> {
  const ready = context(controller, "奖励箱");
  if (!ready) return Promise.resolve();
  return openModal(controller, "奖励箱", close => RewardBoxScreen.open({
    library: ready.library, root: ready.host.root, api: ready.api, session: ready.session,
    now: () => ready.session.serverNow(),
    onClose: close,
    onActivate: () => ready.host.getInterfaceAudio()?.playClick(),
    onChanged: () => void controller.activeNoticer?.noticer.refresh(false),
  }));
}

export function openReadyQuests(controller: ReadyMenusController): Promise<void> {
  const ready = context(controller, "任务");
  if (!ready) return Promise.resolve();
  return openModal(controller, "任务", close => QuestScreen.open({
    library: ready.library, root: ready.host.root, api: ready.api, session: ready.session,
    now: () => ready.session.serverNow(),
    onClose: close,
    onActivate: () => ready.host.getInterfaceAudio()?.playClick(),
  }));
}

/**
 * findRiderButton: the 查找车手 dialog (a name, or a friend from the
 * list), then the rider's 车手信息 card.
 */
export async function openReadyFindRider(controller: ReadyMenusController): Promise<void> {
  const ready = context(controller, "查找车手");
  if (!ready || controller.menuOpening || controller.disposed) return;
  closeReadyMenus(controller);
  const messenger = currentMessenger();
  const friends = (messenger?.store.state?.friends ?? []).map(friend => friend.nickname)
    .sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  controller.menuOpening = true;
  let dialog: { close(): void } | undefined;
  let menu: { dispose(): void } | undefined;
  try {
    dialog = await openFindRiderDialog({
      library: ready.library, root: ready.host.root, friends,
      submit: (nickname, find) => {
        find.setBusy(true);
        void ready.api.rider(nickname.trim()).then(card => {
          find.close();
          void openModal(controller, "车手信息", close => RiderCardView.open({
            library: ready.library, root: ready.host.root, card,
            requestFriend: messenger && !card.self ? name => messenger.api.requestFriend(name) : undefined,
            visitRoom: name => {
              close();
              const house = (controller as unknown as ReadyHouseController).activeHouse as
                { visit?(nickname: string): void; goHome?(): void } | undefined;
              if (house) {
                if (card.self) house.goHome?.();
                else house.visit?.(name);
              } else void openReadyHouse(controller as unknown as ReadyHouseController, card.self ? undefined : name);
            },
            onClose: close,
            onActivate: () => ready.host.getInterfaceAudio()?.playClick(),
          }));
        }, error => {
          find.setBusy(false);
          void openMessengerMessage(ready.library as never, ready.host.root, "查找车手", menuErrorMessage(error), {})
            .catch(() => false);
        });
      },
      onClose: () => {
        if (controller.activeMenu === menu) controller.activeMenu = undefined;
      },
    });
  } catch (error) {
    ready.host.hud.showDebugText(`查找车手：${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    controller.menuOpening = false;
  }
  const opened = dialog;
  menu = { dispose: () => opened?.close() };
  if (opened && !controller.disposed && !controller.activeMenu) controller.activeMenu = menu;
}

/**
 * The 迷你提示窗 of the signed-in rider, made with the taskbar (it opens by
 * itself when reminders change); a new login replaces it.
 */
export function ensureReadyNoticer(controller: ReadyMenusController): Noticer | undefined {
  const session = activeBrowserSession();
  const current = controller.activeNoticer;
  if (current && current.session === session) return current.noticer;
  current?.noticer.dispose();
  controller.activeNoticer = undefined;
  if (!session || controller.disposed) return undefined;
  const library = controller.host.getLibrary() as Partial<BmlLibrary> | undefined;
  if (typeof library?.canonicalCandidates !== "function") return undefined;
  const noticer = new Noticer({
    library: library as BmlLibrary, root: controller.host.root, api: new MenusApi(session),
    onRewardBox: () => void openReadyRewardBox(controller),
    onQuests: () => void openReadyQuests(controller),
    onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
  });
  controller.activeNoticer = { noticer, session };
  return noticer;
}

export function toggleReadyNoticer(controller: ReadyMenusController): void {
  const noticer = ensureReadyNoticer(controller);
  if (!noticer) {
    controller.host.hud.showDebugText("迷你提示窗：请先登录。", "error");
    return;
  }
  void noticer.toggle();
}

/** toggle_gchat: the 聊天系统 window (made once; it follows the signed-in rider's messenger socket). */
export function toggleReadyChat(controller: ReadyMenusController): void {
  if (controller.disposed) return;
  const library = controller.host.getLibrary() as Partial<BmlLibrary> | undefined;
  if (typeof library?.canonicalCandidates !== "function") return;
  if (!activeBrowserSession()) {
    controller.host.hud.showDebugText("聊天：请先登录。", "error");
    return;
  }
  controller.activeChat ??= new GlobalChat({
    library: library as BmlLibrary, root: controller.host.root,
    connection: () => activeBrowserSession() ? currentMessenger()?.connection : undefined,
    nickname: () => activeBrowserSession()?.summary()?.account.nickname,
    onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
  });
  void controller.activeChat.toggle().catch(error => controller.host.hud.showDebugText(
    `聊天：${error instanceof Error ? error.message : String(error)}`, "error"));
}

/** The taskbar was hidden (a race) or shown again. */
export function suspendReadyMenus(controller: ReadyMenusController, suspended: boolean): void {
  controller.activeNoticer?.noticer.setSuspended(suspended);
  controller.activeChat?.setSuspended(suspended);
}

/** Closes the modal menu (a race starting); with `all`, the noticer too (Ready disposal). */
export function closeReadyMenus(controller: { activeMenu?: { dispose(): void };
  activeNoticer?: { noticer: Noticer }; activeChat?: GlobalChat }, all = false): void {
  const menu = controller.activeMenu;
  controller.activeMenu = undefined;
  menu?.dispose();
  if (all) {
    controller.activeNoticer?.noticer.dispose();
    controller.activeNoticer = undefined;
    controller.activeChat?.dispose();
    controller.activeChat = undefined;
  }
}
