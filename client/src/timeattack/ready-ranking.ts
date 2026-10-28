import { trackDisplayTitle } from "../resources/track-names";
import { tr } from "../i18n/locale";
import { visibleTrackId } from "../resources/track-duplicates";
/**
 * 排位计时赛 (TIMEATTACK.md): the ranking window over the 单人游戏 page, the
 * ranked entry fee, the ranked run (a solo race carrying a RankedRaceRequest)
 * and the way back to the window with the settled rank.
 */
import { activeBrowserSession } from "../account/account-runtime";
import { newRequestId } from "../account/rewards";
import { b4 } from "../generated/formats.js";
import { _7, ny } from "../generated/ui.js";
import type { StoryRaceOutcome } from "../story/story-race";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import { RankingReadyWindow, type RankingSettings } from "../ui/ranking-ready-window";
import { openRankedReplay } from "./ready-replay";
import type { ReadyOptions, ReadySelection, ReadyTrack, TrackChoice } from "./ready-flow";
import { openReadyHome, type ReadyHomeController } from "./ready-home";
import { recordSpeedChannel, type RankedRaceRequest, type RankedSettlement } from "./ranked-race";
import { enterRankedTimeAttack, fetchTimeAttackRanking, formatRecordTime, timeAttackErrorMessage,
  type RankingRow } from "./timeattack-api";

const TITLE = "排位计时赛";

export interface RankingTrack { id: string; path: string; title: string }

export interface ReadyRankingController extends ReadyHomeController {
  rankingWindow?: RankingReadyWindow;
  rankingBusy?: boolean;
  rankingMessage?: AbortController;
  /** The track and settings the window shows; kept across a run. */
  rankingTrack?: RankingTrack;
  rankingSettings?: RankingSettings;
  rankingPreview?: { dispose(): void };
  rankingTrackSelect?: { dispose(): void };
}

interface RankingLibrary {
  trackMetadata(trackId: string): Promise<{ cnTitle?: string } | undefined>;
  timeAttackTrackCatalog(): Promise<ReadyTrack[]>;
  timeAttackGarageCatalog(): Promise<{ karts: unknown[]; characters: Array<{ itemId: number; path: string }> }>;
}

function library(controller: ReadyRankingController): RankingLibrary | undefined {
  return controller.host.getLibrary() as unknown as RankingLibrary | undefined;
}

export function closeRankingWindow(controller: ReadyRankingController): void {
  controller.rankingTrackSelect?.dispose();
  controller.rankingTrackSelect = undefined;
  controller.rankingWindow?.dispose();
  controller.rankingWindow = undefined;
  controller.rankingPreview?.dispose();
  controller.rankingPreview = undefined;
  controller.rankingMessage?.abort();
  controller.rankingMessage = undefined;
}

async function currentTrack(controller: ReadyRankingController, lib: RankingLibrary): Promise<RankingTrack | undefined> {
  if (controller.rankingTrack) return controller.rankingTrack;
  const selection = controller.host.getSelection();
  if (!selection?.trackId || !selection.mapPath) return undefined;
  const metadata = await lib.trackMetadata(selection.trackId).catch(() => undefined);
  return { id: selection.trackId, path: selection.mapPath, title: trackDisplayTitle(selection.trackId, metadata?.cnTitle ?? selection.trackId) };
}

function settingsOf(controller: ReadyRankingController): RankingSettings {
  if (controller.rankingSettings) return controller.rankingSettings;
  const options = controller.host.getReadyOptions() as { speed?: number; booster?: number; showGhost?: boolean;
    version?: string; settingSpeed?: number };
  return { speed: recordSpeedChannel({ speed: options.speed ?? 7, ...(options.version ? { version: options.version } : {}),
    ...(options.settingSpeed !== undefined ? { settingSpeed: options.settingSpeed } : {}) }),
  booster: options.booster ?? 0, showGhost: options.showGhost === true };
}

/** The Ready options a ranked run races with. */
function raceOptions(controller: ReadyRankingController, settings: RankingSettings): ReadyOptions {
  return { ...controller.host.getReadyOptions(), speed: settings.speed, settingSpeed: settings.speed, version: "国服",
    booster: settings.booster, showGhost: settings.showGhost };
}

function hasGhost(controller: ReadyRankingController, settings: RankingSettings): boolean {
  const record = controller.host.getRecordFor(raceOptions(controller, settings)) as { hasGhost?: boolean } | undefined;
  return record?.hasGhost === true;
}

/** Open (or reopen) the window on the 单人游戏 page. */
export async function openRankingWindow(controller: ReadyRankingController): Promise<void> {
  const lib = library(controller);
  if (!lib || controller.rankingBusy || controller.disposed) return;
  controller.rankingBusy = true;
  try {
    const track = await currentTrack(controller, lib);
    if (!track) throw new Error(tr("请先在计时赛选好赛道。"));
    controller.rankingTrack = track;
    const settings = settingsOf(controller);
    controller.rankingSettings = settings;
    closeRankingWindow(controller);
    const window = await RankingReadyWindow.open({
      library: lib as never, root: controller.host.root, trackId: track.id, trackTitle: track.title, trackPath: track.path,
      settings,
      hasGhost: value => hasGhost(controller, value),
      onSettings: value => { controller.rankingSettings = value; void loadRanking(controller); },
      onStart: () => { void startRankedRun(controller); },
      onItems: () => openItems(controller),
      onTrack: () => { void pickTrack(controller); },
      onReplay: row => { void watchReplay(controller, row); },
      onClose: () => closeRankingWindow(controller),
      onHover: () => controller.host.getInterfaceAudio()?.playHover(),
      onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
    });
    if (controller.disposed) { window.dispose(); return; }
    controller.rankingWindow = window;
    void loadRanking(controller);
    void loadPreview(controller, lib, window);
  } catch (error) {
    message(controller, tr("排位计时赛：{error}", { error: error instanceof Error ? error.message : String(error) }));
  } finally {
    controller.rankingBusy = false;
  }
}

async function loadRanking(controller: ReadyRankingController): Promise<void> {
  const window = controller.rankingWindow;
  const track = controller.rankingTrack;
  const settings = controller.rankingSettings;
  if (!window || !track || !settings) return;
  const session = activeBrowserSession();
  if (!session) { window.setRanking(undefined, tr("登录后可查看赛道排名。")); return; }
  window.setLoading();
  try {
    const ranking = await fetchTimeAttackRanking(session, track.id, settings.speed, settings.booster);
    if (controller.rankingWindow === window && controller.rankingSettings === settings) window.setRanking(ranking);
  } catch (error) {
    if (controller.rankingWindow === window) window.setRanking(undefined, timeAttackErrorMessage(error));
  }
}

/** The 3D rider in 캐릭터창: the player's kart and character on the Ready toon stage. */
async function loadPreview(controller: ReadyRankingController, lib: RankingLibrary, window: RankingReadyWindow): Promise<void> {
  try {
    const selection = controller.host.getSelection();
    if (!selection?.vehiclePath || selection.vehicleItemId === undefined || !selection.characterPath) return;
    const environment = await controller.acquireReadyToonEnvironment(lib as never);
    const catalog = await lib.timeAttackGarageCatalog();
    const kart = b4(catalog.karts, selection.vehicleItemId, selection.vehiclePath, selection.vehicleSystemKey);
    const character = catalog.characters.find(entry => entry.itemId === selection.characterItemId &&
      entry.path.toLowerCase() === selection.characterPath!.toLowerCase());
    if (!environment || !kart || !character || controller.rankingWindow !== window) return;
    const preview = await (ny as unknown as { load(...args: unknown[]): Promise<{ dispose(): void;
      render(context: CanvasRenderingContext2D, rect: unknown, time: number): void }> })
      .load(lib, kart, character, environment, controller.host.toonStageBinding, controller.host.getProfile());
    if (controller.rankingWindow !== window) { preview.dispose(); return; }
    controller.rankingPreview = preview;
    window.setPreview(preview);
  } catch (error) {
    controller.host.hud.showDebugText(`排位计时赛车手预览：${error instanceof Error ? error.message : String(error)}`, "error");
  }
}

function openItems(controller: ReadyRankingController): void {
  const selection = controller.host.getSelection();
  const settings = controller.rankingSettings ?? settingsOf(controller);
  closeRankingWindow(controller);
  if (selection) controller.openGarage(selection, raceOptions(controller, settings));
}

/** 选择赛道: the release track picker; a track (not a random pool) becomes the window's. */
async function pickTrack(controller: ReadyRankingController): Promise<void> {
  const lib = library(controller);
  const track = controller.rankingTrack;
  if (!lib || !track || controller.rankingTrackSelect) return;
  try {
    const tracks = await lib.timeAttackTrackCatalog();
    const view = await (_7 as unknown as { load(options: Record<string, unknown>): Promise<{ show(): void;
      dispose(): void }> }).load({
      library: lib, root: controller.host.root, tracks, selectedTrackId: visibleTrackId(track.id, tracks), randomGroups: [],
      randomTrackNames: new Map(), favoriteTrackIds: new Set(), getFavoriteCount: () => 0,
      onFavoriteChange: () => {},
      onConfirm: (choice: TrackChoice) => {
        controller.rankingTrackSelect?.dispose();
        controller.rankingTrackSelect = undefined;
        if (choice.kind !== "track") { message(controller, tr("排位计时赛不能选择随机赛道。")); return; }
        void lib.trackMetadata(choice.track.id).catch(() => undefined).then(metadata => {
          controller.rankingTrack = { id: choice.track.id, path: choice.track.path,
            title: trackDisplayTitle(choice.track.id, metadata?.cnTitle ?? choice.track.id) };
          return openRankingWindow(controller);
        });
      },
      onCancel: () => { controller.rankingTrackSelect?.dispose(); controller.rankingTrackSelect = undefined; },
      onInteraction: () => controller.host.getAudioContext()?.resume(),
      onError: (error: unknown) => message(controller, tr("选择赛道：{error}", { error: error instanceof Error ? error.message : String(error) })),
      onNotice: () => {},
    });
    controller.rankingTrackSelect = view;
    view.show();
  } catch (error) {
    message(controller, tr("选择赛道：{error}", { error: error instanceof Error ? error.message : String(error) }));
  }
}

async function startRankedRun(controller: ReadyRankingController): Promise<void> {
  const lib = library(controller);
  const track = controller.rankingTrack;
  const settings = controller.rankingSettings;
  const session = activeBrowserSession();
  const host = controller.host;
  if (!lib || !track || !settings || controller.rankingBusy) return;
  if (!session) { message(controller, tr("请先登录后再进行排位计时赛。")); return; }
  const previous = host.getSelection();
  if (!previous) return;
  const fee = 500;
  const agreed = await openMessengerMessage(lib as never, host.root, TITLE,
    tr("进行排位计时赛需要{fee}金币，确定要进行吗？", { fee: fee }), { yes: tr("确定"), no: tr("取消") }).catch(() => false);
  if (!agreed || controller.disposed) return;
  controller.rankingBusy = true;
  const requestId = newRequestId();
  try {
    await enterRankedTimeAttack(session, { requestId, trackId: track.id, speed: settings.speed, booster: settings.booster });
  } catch (error) {
    controller.rankingBusy = false;
    message(controller, tr("排位计时赛：{error}", { error: timeAttackErrorMessage(error) }));
    return;
  }
  controller.rankingBusy = false;
  const previousOptions = host.getReadyOptions();
  const ranked: RankedRaceRequest = {
    requestId, speed: settings.speed, booster: settings.booster,
    restore: () => {
      host.setSelection(previous);
      host.setReadyOptions(previousOptions);
      // Ready is rebuilt next; the 单人游戏 page covers it and the window reopens.
      controller.homeRequested = true;
      controller.homePage = "single";
    },
    onReturn: (outcome: StoryRaceOutcome, settlement?: RankedSettlement) => {
      void returnToRanking(controller, outcome, settlement);
    },
  };
  const selection: ReadySelection = { ...previous, mapPath: track.path, trackId: track.id, ranked };
  closeRankingWindow(controller);
  await controller.startRaceFromReady(selection, raceOptions(controller, settings));
  if (!controller.disposed && host.shell.current === "Ready") {
    host.setSelection(previous);
    host.setReadyOptions(previousOptions);
    message(controller, tr("比赛未能开始，入场费已扣除；请重试。"));
  }
}

/** Back on the 单人游戏 page after a ranked run, with the window and the result. */
async function returnToRanking(controller: ReadyRankingController, outcome: StoryRaceOutcome,
  settlement?: RankedSettlement): Promise<void> {
  await openReadyHome(controller, "single");
  for (let frame = 0; !controller.activeHome && controller.homeOpening && frame < 120; frame++)
    await new Promise(resolve => requestAnimationFrame(resolve));
  controller.activeHome?.setPage("single");
  controller.activeHome?.selectCategory("cat_timeAttack");
  await openRankingWindow(controller);
  if (!outcome.finished) message(controller, tr("没有完成比赛，本次排位成绩不计。"));
  else if (settlement) {
    message(controller, settlement.modeNewRecord
      ? tr("新的排位纪录 {time}！当前排名第 {rank} 名{suffix}", { time: formatRecordTime(outcome.elapsedMs), rank: settlement.rank, suffix: settlement.topTen ? tr("，录像已保存到赛道排名。") : "。" })
      : tr("用时 {time}，没有刷新排位纪录（{best}），当前排名第 {rank} 名。", { time: formatRecordTime(outcome.elapsedMs), best: formatRecordTime(settlement.modeBestMs), rank: settlement.rank }));
  } else {
    message(controller, tr("用时 {time}，成绩未能上传到赛道排名。", { time: formatRecordTime(outcome.elapsedMs) }));
  }
}

async function watchReplay(controller: ReadyRankingController, row: RankingRow): Promise<void> {
  const track = controller.rankingTrack;
  const settings = controller.rankingSettings;
  if (!track || !settings || controller.rankingBusy) return;
  controller.rankingBusy = true;
  try {
    await openRankedReplay(controller, { track, settings, row, resume: () => openRankingWindow(controller),
      close: () => closeRankingWindow(controller) });
  } catch (error) {
    message(controller, tr("观看录像：{error}", { error: error instanceof Error ? error.message : String(error) }));
  } finally {
    controller.rankingBusy = false;
  }
}

function message(controller: ReadyRankingController, text: string): void {
  const lib = controller.host.getLibrary();
  if (!lib || controller.disposed) return;
  controller.rankingMessage?.abort();
  const abort = new AbortController();
  controller.rankingMessage = abort;
  void openMessengerMessage(lib as never, controller.host.root, TITLE, text.replaceAll("\n", "|"), {}, abort.signal)
    .catch(() => controller.activeHome?.showNotice(text)).finally(() => {
      if (controller.rankingMessage === abort) controller.rankingMessage = undefined;
    });
}
