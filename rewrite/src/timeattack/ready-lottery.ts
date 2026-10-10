import { ensureFeatureResources } from "../ui/resource-panel";
/**
 * Opening the lottery screens (src/lottery: 寻宝 and the 精品道具场) from the
 * lobby 活动 buttons. One screen at a time; it covers the page (taskbar
 * included, like the release stages) until its close button or Esc. The
 * screens and their garage snapshots load on first use.
 */
import { activeBrowserSession } from "../account/account-runtime";
import { LotteryApi } from "../lottery/lottery-api";
import type { LotteryScreenOptions } from "../lottery/lottery-shell";
import { createItemPictures } from "./shop-preview";

export type LotteryScreen = "treasureHunt" | "gacha";

export interface ReadyLotteryController {
  host: {
    root: HTMLElement;
    hud: { showDebugText(message: string, kind: string): void };
    getLibrary(): unknown;
    getInterfaceAudio?(): { playHover(): void; playClick(): void } | undefined;
  };
  disposed: boolean;
  activeLottery?: { close(): void };
  lotteryOpening?: boolean;
  activeHome?: { showNotice(message: string): void };
}

type Opener = (options: LotteryScreenOptions, itemId?: number) => Promise<{ close(): void }>;

const openers: Record<LotteryScreen, () => Promise<Opener>> = {
  treasureHunt: async () => (await import("../lottery/treasure-hunt-view")).openTreasureHunt,
  gacha: async () => (await import("../lottery/gacha-view")).openGacha,
};

function report(controller: ReadyLotteryController, message: string): void {
  controller.activeHome?.showNotice(message);
  controller.host.hud.showDebugText(message, "error");
}

/** Opens a lottery screen (the 精品道具场 on itemId when given). */
export async function openReadyLottery(controller: ReadyLotteryController, screen: LotteryScreen,
  itemId?: number): Promise<void> {
  if (controller.disposed || controller.activeLottery || controller.lotteryOpening) return;
  const session = activeBrowserSession();
  if (!session) {
    report(controller, "抽奖活动需要登录账号。");
    return;
  }
  const library = controller.host.getLibrary();
  if (!library) return;
  controller.lotteryOpening = true;
  let pictures: ReturnType<typeof createItemPictures> | undefined;
  const release = () => {
    try { pictures?.dispose(); } catch { /* Pictures are optional. */ }
    pictures = undefined;
  };
  try {
    await ensureFeatureResources(controller.host.root, "lottery");
    if (controller.disposed) return;
    try { pictures = createItemPictures(library); } catch { pictures = undefined; }
    const open = await openers[screen]();
    const audio = () => controller.host.getInterfaceAudio?.();
    const handle = await open({
      root: controller.host.root, library, session, api: new LotteryApi(session),
      ...(pictures ? { pictures } : {}),
      onClose: () => {
        controller.activeLottery = undefined;
        release();
      },
      onHover: () => audio()?.playHover(),
      onActivate: () => audio()?.playClick(),
    }, itemId);
    if (controller.disposed) {
      handle.close();
      release();
      return;
    }
    controller.activeLottery = {
      close: () => {
        handle.close();
        controller.activeLottery = undefined;
        release();
      },
    };
  } catch (error) {
    release();
    report(controller, `${screen === "treasureHunt" ? "寻宝活动" : "精品道具场"}：${
      error instanceof Error ? error.message : String(error)}`);
  } finally {
    controller.lotteryOpening = false;
  }
}

/** Closes an open lottery screen (Ready disposal, a race starting). */
export function closeReadyLottery(controller: Pick<ReadyLotteryController, "activeLottery">): void {
  const screen = controller.activeLottery;
  controller.activeLottery = undefined;
  screen?.close();
}
