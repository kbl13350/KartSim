import { activeBrowserSession } from "../account/account-runtime";
import { ClubApi } from "../club/club-api";
import { ClubScreen, type ClubLibrary } from "../club/club-screen";
import type { ReadyFlowController } from "./ready-flow";

/**
 * 俱乐部 from the taskbar: the release club pages (我的俱乐部, 俱乐部目录,
 * 创建俱乐部, 俱乐部基地) over whatever page is showing. A race or leaving
 * Ready closes them.
 */
export interface ReadyClubController extends ReadyFlowController {
  activeClub?: ClubScreen;
  clubOpening?: boolean;
}

export async function openReadyClub(controller: ReadyClubController): Promise<void> {
  if (controller.activeClub || controller.clubOpening || controller.disposed) return;
  const host = controller.host;
  const session = activeBrowserSession();
  const library = host.getLibrary() as Partial<ClubLibrary> | undefined;
  if (!session || typeof library?.canonicalCandidates !== "function") {
    host.hud.showDebugText("俱乐部：请先登录。", "error");
    return;
  }
  controller.clubOpening = true;
  try {
    const screen = await ClubScreen.open({
      library: library as ClubLibrary, root: host.root, api: new ClubApi(session),
      level: () => session.summary()?.progress.level ?? 1,
      nickname: () => session.summary()?.account.nickname,
      onClose: () => closeReadyClub(controller),
      onActivate: () => host.getInterfaceAudio()?.playClick(),
    });
    if (controller.disposed) screen.dispose();
    else controller.activeClub = screen;
  } catch (error) {
    host.hud.showDebugText(`俱乐部：${error instanceof Error ? error.message : String(error)}`, "error");
  } finally {
    controller.clubOpening = false;
  }
}

export function closeReadyClub(controller: { activeClub?: ClubScreen }): void {
  controller.activeClub?.dispose();
  controller.activeClub = undefined;
}
