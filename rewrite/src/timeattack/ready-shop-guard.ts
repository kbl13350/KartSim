/**
 * The taskbar 상점 button and the lobby top bar "+" buttons open the shop
 * (ready-shop.ts) only while no multiplayer race owns the screen: the shop is
 * not modal to a race, so it stays closed from loading until the room is open
 * again. A race that becomes visible closes an open shop
 * (ready-multiplayer.ts onRaceVisibility).
 */
import { showAccountToast, type OverlayDocument } from "../account/account-dialogs";
import { openReadyShop, type ReadyShopController } from "./ready-shop";

/** Room phases in which the race is loading, counting down or running. */
const RACE_PHASES: ReadonlySet<string> = new Set(["loading", "countdown", "racing"]);

export const SHOP_BLOCKED_DURING_RACE = "比赛即将开始或正在进行，暂时无法打开商店。";

interface LobbyRaceState {
  raceVisible?: boolean;
  state?: { room?: { phase?: unknown } };
}

/** The player's room is loading, counting down or racing (or the race view is up). */
export function multiplayerRaceActive(lobby: unknown): boolean {
  if (!lobby || typeof lobby !== "object") return false;
  const value = lobby as LobbyRaceState;
  const phase = value.state?.room?.phase;
  return value.raceVisible === true || (typeof phase === "string" && RACE_PHASES.has(phase));
}

export type GuardedShopController = ReadyShopController & { multiplayer?: unknown };

function notice(controller: GuardedShopController, message: string): void {
  controller.host.hud.showDebugText(message, "info");
  if (controller.activeHome) {
    controller.activeHome.showNotice(message);
    return;
  }
  const document = (controller.host.root as { ownerDocument?: unknown } | undefined)?.ownerDocument;
  if (document) showAccountToast(document as OverlayDocument, message, 2_500);
}

/** Open the shop unless a multiplayer race is starting or running. */
export function openShopUnlessRacing(controller: GuardedShopController,
  open: (controller: ReadyShopController) => Promise<void> = openReadyShop): void {
  if (multiplayerRaceActive(controller.multiplayer)) {
    notice(controller, SHOP_BLOCKED_DURING_RACE);
    return;
  }
  void open(controller);
}
