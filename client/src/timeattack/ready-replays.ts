import { findTrackChoice, visibleTrackId } from "../resources/track-duplicates";
import { translateItemName } from "../i18n/item-names";
import { trackDisplayTitle } from "../resources/track-names";
import { tr } from "../i18n/locale";
/**
 * 回放 (TIMEATTACK.md 4): the 回放 tab of the 单人游戏 page has three pages
 * of release replayCard rows. 我的回放 lists this browser's Ghost records
 * (the replay library's summaries with a Ghost; a card's 删除 removes the
 * record). 联赛回放 lists the admin-published replays. 其他回放 browses the
 * ranked top 10 of a track and setting for other riders' replays. Every
 * card plays through the OB viewer (replay-session.ts).
 */
import { activeBrowserSession } from "../account/account-runtime";
import type { ReplayLibraryBridge } from "../app/host-bridges";
import { makeGhostRecordKey, trackIdFromGhostKey } from "../game/ghost-records";
import { _7 } from "../generated/ui.js";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import type { ReplayBrowseHeader, ReplayMenuEntry, ReplayTab } from "../ui/main-menu-view";
import type { ReadyTrack, TrackChoice } from "./ready-flow";
import { openReadyHome, type ReadyHomeController } from "./ready-home";
import { recordSpeedChannel } from "./ranked-race";
import { startReplaySession } from "./replay-session";
import { fetchFeaturedReplayFile, fetchFeaturedReplays, fetchTimeAttackRanking, fetchTimeAttackReplay,
  formatRecordTime, timeAttackErrorMessage } from "./timeattack-api";

const TITLE = "我的回放";
/** Browser storage of when each local record was made (the summaries carry no date). */
const DATES_KEY = "kartsim:replay-dates";

export interface ReplayBrowseState {
  track: { id: string; path: string; title: string };
  speed: number;
  booster: number;
}

export interface ReadyReplayController extends ReadyHomeController {
  replayBusy?: boolean;
  /** The 回放 page shown last, restored after a viewer returns. */
  replayTab?: ReplayTab;
  /** 其他回放: the track and settings browsed. */
  replayBrowse?: ReplayBrowseState;
  replayTrackSelect?: { dispose(): void };
}

interface ReplayLibraryHost {
  trackMetadata(trackId: string): Promise<{ cnTitle?: string } | undefined>;
  timeAttackTrackCatalog(): Promise<ReadyTrack[]>;
}

/** A record summary as the replay library keeps it (record-service promote). */
export interface ReplaySummary {
  hasGhost?: boolean;
  elapsedMs?: number;
  kartName?: string;
  speed?: number;
  booster?: number;
}

function replayLibrary(controller: ReadyHomeController): ReplayLibraryBridge | undefined {
  return (controller.host as { replayLibrary?: ReplayLibraryBridge }).replayLibrary;
}

function resourceLibrary(controller: ReadyHomeController): ReplayLibraryHost | undefined {
  return controller.host.getLibrary() as unknown as ReplayLibraryHost | undefined;
}

function storage(): Storage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

function readDates(): Record<string, number> {
  try {
    const raw = storage()?.getItem(DATES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

/** A run was just promoted to a record: remember when. */
export function noteReplayRecorded(key: string, now = Date.now()): void {
  const dates = readDates();
  dates[key] = now;
  try { storage()?.setItem(DATES_KEY, JSON.stringify(dates)); } catch { /* storage unavailable */ }
}

export function forgetReplayDate(key: string): void {
  const dates = readDates();
  if (!(key in dates)) return;
  delete dates[key];
  try { storage()?.setItem(DATES_KEY, JSON.stringify(dates)); } catch { /* storage unavailable */ }
}

/** The key of a finished run's record (the library's recordKey over the Ready options). */
export function runRecordKey(trackId: string, options: { speed: number; booster: number; version?: string;
  settingSpeed?: number }): string {
  const version = options.version ?? "国服";
  const speed = version === "国服" && (options.settingSpeed ?? 7) === 7 ? options.speed : options.settingSpeed ?? options.speed;
  return makeGhostRecordKey(trackId, speed, options.booster, version);
}

/** "标准速度 / 个人赛", as the 排位计时赛 window words its settings. */
export function settingsLabel(speed: number, booster: number, retro = false): string {
  const speedText = retro ? tr("复古 S{speed}", { speed: speed }) : speed === 7 ? tr("标准速度") : speed === 4 ? tr("无限") : `S${speed}`;
  return `${speedText} / ${booster ? tr("组队赛") : tr("个人赛")}`;
}

export function replaySettingsLabel(summary: ReplaySummary, key: string): string {
  const parts = key.split("\0");
  return settingsLabel(summary.speed ?? Number(parts[1] ?? 7), summary.booster ?? Number(parts[2] ?? 0),
    parts[3] === "retro");
}

/** "2026-10-12 18:05" in Beijing time. */
export function replayDateText(ms: number | undefined): string {
  if (!ms) return "—";
  const date = new Date(ms + 8 * 60 * 60 * 1000);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())} ${
    two(date.getUTCHours())}:${two(date.getUTCMinutes())}`;
}

/** 我的回放 cards: records with a Ghost, newest first. */
export function replayEntries(records: Iterable<[string, ReplaySummary]>, riderName: string,
  trackTitle: (trackId: string) => string | undefined,
  recordedAt: (key: string) => number | undefined = key => readDates()[key]): ReplayMenuEntry[] {
  const entries: ReplayMenuEntry[] = [];
  for (const [key, summary] of records) {
    if (!summary?.hasGhost) continue;
    const trackId = trackIdFromGhostKey(key);
    const title = trackTitle(trackId) ?? trackId;
    const at = recordedAt(key);
    const parts = key.split("\0");
    entries.push({
      key, source: "local", trackId, trackTitle: title, riderName, kartName: translateItemName(summary.kartName ?? ""),
      elapsedMs: summary.elapsedMs ?? 0, recordedAt: at,
      title: `${title}　${formatRecordTime(summary.elapsedMs)}`,
      settings: replaySettingsLabel(summary, key), dateText: replayDateText(at), deletable: true,
      speed: summary.speed ?? Number(parts[1] ?? 7), booster: summary.booster ?? Number(parts[2] ?? 0),
    });
  }
  return entries.sort((a, b) => (b.recordedAt ?? 0) - (a.recordedAt ?? 0) || a.key.localeCompare(b.key));
}

/** 联赛回放 cards from the published list. */
export function featuredEntries(replays: Array<{ id: number; title: string; note: string; trackId: string;
  trackName: string; speed: number; booster: number; accountId: string; nickname: string; kartName: string;
  bestMs: number; createdAt: number }>): ReplayMenuEntry[] {
  return replays.map(replay => ({
    key: `featured:${replay.id}`, source: "featured", trackId: replay.trackId,
    trackTitle: trackDisplayTitle(replay.trackId, replay.trackName || replay.trackId), riderName: replay.nickname, kartName: translateItemName(replay.kartName),
    elapsedMs: replay.bestMs, recordedAt: replay.createdAt, title: replay.title,
    ...(replay.note ? { note: replay.note } : {}), settings: settingsLabel(replay.speed, replay.booster),
    dateText: replayDateText(replay.createdAt), deletable: false, speed: replay.speed, booster: replay.booster,
    accountId: replay.accountId, featuredId: replay.id,
  }));
}

/** 其他回放 cards: the ranked rows with a replay. */
export function rankedEntries(rows: Array<{ rank: number; accountId: string; nickname: string; kartName: string;
  bestMs: number; updatedAt: number; hasReplay: boolean; self: boolean }>, state: ReplayBrowseState): ReplayMenuEntry[] {
  return rows.filter(row => row.hasReplay).map(row => ({
    key: `ranked:${state.track.id}:${state.speed}:${state.booster}:${row.accountId}`, source: "ranked",
    trackId: state.track.id, trackTitle: state.track.title, riderName: row.nickname,
    ...(row.self ? { displayRiderName: tr("{name}（我）", { name: row.nickname }) } : {}),
    kartName: translateItemName(row.kartName), elapsedMs: row.bestMs, recordedAt: row.updatedAt,
    title: tr("第{rank}名　{name}　{time}", { rank: row.rank, name: row.nickname, time: formatRecordTime(row.bestMs) }),
    settings: settingsLabel(state.speed, state.booster), dateText: replayDateText(row.updatedAt), deletable: false,
    speed: state.speed, booster: state.booster, accountId: row.accountId,
  }));
}

/** The 我的回放 page's cards for this browser's records. */
export async function loadReplayMenu(controller: ReadyHomeController, riderName: string): Promise<ReplayMenuEntry[]> {
  const library = replayLibrary(controller);
  const lib = resourceLibrary(controller);
  if (!library) return [];
  // Record keys carry the track id in lower case; the catalog and metadata use its own.
  const tracks = lib ? await lib.timeAttackTrackCatalog().catch(() => [] as ReadyTrack[]) : [];
  const titles = new Map<string, string | undefined>();
  const records = [...library.records.entries()] as Array<[string, ReplaySummary]>;
  await Promise.all(records.filter(([, summary]) => summary?.hasGhost).map(async ([key]) => {
    const trackId = trackIdFromGhostKey(key);
    if (titles.has(trackId) || !lib) return;
    titles.set(trackId, undefined);
    const cased = findTrackChoice(tracks, trackId)?.id ?? trackId;
    titles.set(trackId, trackDisplayTitle(cased, (await lib.trackMetadata(cased).catch(() => undefined))?.cnTitle ?? cased));
  }));
  return replayEntries(records, riderName, trackId => titles.get(trackId));
}

/** The 联赛回放 page's cards. */
export async function loadFeaturedMenu(): Promise<ReplayMenuEntry[]> {
  const session = activeBrowserSession();
  if (!session) throw new Error(tr("请先登录后再查看联赛回放。"));
  return featuredEntries(await fetchFeaturedReplays(session));
}

/** 其他回放: the track and settings browsed; the Ready selection and options to begin with. */
export async function replayBrowseState(controller: ReadyReplayController): Promise<ReplayBrowseState | undefined> {
  if (controller.replayBrowse) return controller.replayBrowse;
  const lib = resourceLibrary(controller);
  const selection = controller.host.getSelection();
  if (!lib || !selection?.trackId || !selection.mapPath) return undefined;
  const options = controller.host.getReadyOptions() as { speed: number; booster: number; version?: string;
    settingSpeed?: number };
  const metadata = await lib.trackMetadata(selection.trackId).catch(() => undefined);
  const speed = recordSpeedChannel(options);
  controller.replayBrowse = { track: { id: selection.trackId, path: selection.mapPath, title: trackDisplayTitle(selection.trackId, metadata?.cnTitle ?? selection.trackId) },
    speed: speed === 4 ? 4 : 7, booster: options.booster ? 1 : 0 };
  return controller.replayBrowse;
}

export function replayBrowseHeader(state: ReplayBrowseState | undefined): ReplayBrowseHeader | undefined {
  return state ? { trackTitle: state.track.title, settings: settingsLabel(state.speed, state.booster) } : undefined;
}

/** The 其他回放 page's cards for the browsed track and settings. */
export async function loadOtherMenu(controller: ReadyReplayController): Promise<{ entries: ReplayMenuEntry[];
  header: ReplayBrowseHeader | undefined }> {
  const state = await replayBrowseState(controller);
  if (!state) return { entries: [], header: undefined };
  const session = activeBrowserSession();
  if (!session) throw new Error(tr("请先登录后再查看其他回放。"));
  const ranking = await fetchTimeAttackRanking(session, state.track.id, state.speed, state.booster);
  return { entries: rankedEntries(ranking.rows, state), header: replayBrowseHeader(state) };
}

/** 切换速度 / 切换模式 on the 其他回放 settings card. */
export async function toggleReplaySetting(controller: ReadyReplayController, kind: "speed" | "booster"): Promise<void> {
  const state = await replayBrowseState(controller);
  if (!state) return;
  controller.replayBrowse = kind === "speed" ? { ...state, speed: state.speed === 7 ? 4 : 7 }
    : { ...state, booster: state.booster ? 0 : 1 };
}

/** 选择赛道: the release track picker; resolves true when a track was chosen. */
export async function pickReplayTrack(controller: ReadyReplayController): Promise<boolean> {
  const lib = resourceLibrary(controller);
  const state = await replayBrowseState(controller);
  if (!lib || controller.replayTrackSelect) return false;
  const tracks = await lib.timeAttackTrackCatalog();
  return new Promise<boolean>(resolve => {
    const close = (): void => {
      controller.replayTrackSelect?.dispose();
      controller.replayTrackSelect = undefined;
    };
    void (_7 as unknown as { load(options: Record<string, unknown>): Promise<{ show(): void; dispose(): void }> }).load({
      library: lib, root: controller.host.root, tracks,
      selectedTrackId: state && visibleTrackId(state.track.id, tracks), randomGroups: [],
      randomTrackNames: new Map(), favoriteTrackIds: new Set(), getFavoriteCount: () => 0,
      onFavoriteChange: () => {},
      onConfirm: (choice: TrackChoice) => {
        close();
        if (choice.kind !== "track") { notice(controller, tr("其他回放不能选择随机赛道。")); resolve(false); return; }
        void lib.trackMetadata(choice.track.id).catch(() => undefined).then(metadata => {
          controller.replayBrowse = { ...(state ?? { speed: 7, booster: 0 }),
            track: { id: choice.track.id, path: choice.track.path, title: trackDisplayTitle(choice.track.id, metadata?.cnTitle ?? choice.track.id) } };
          resolve(true);
        });
      },
      onCancel: () => { close(); resolve(false); },
      onInteraction: () => controller.host.getAudioContext()?.resume(),
      onError: (error: unknown) => { notice(controller, tr("选择赛道：{error}", { error: error instanceof Error ? error.message : String(error) })); },
      onNotice: () => {},
    }).then(view => {
      if (controller.disposed) { view.dispose(); resolve(false); return; }
      controller.replayTrackSelect = view;
      view.show();
    }).catch(error => { notice(controller, tr("选择赛道：{error}", { error: error instanceof Error ? error.message : String(error) })); resolve(false); });
  });
}

function notice(controller: ReadyHomeController, text: string): void {
  controller.activeHome?.single.showNotice(text);
}

/** Back from the viewer: the 单人游戏 page on the 回放 tab's page the card came from. */
function returnToReplays(controller: ReadyReplayController, tab: ReplayTab): void {
  controller.replayTab = tab;
  void openReadyHome(controller, "single").then(() => {
    controller.activeHome?.selectCategory("cat_replay");
    if (tab !== "my") controller.activeHome?.showReplayTab(tab);
  });
}

/** Play a card in the OB viewer; the 回放 page reopens when it ends. */
export async function openReplayEntry(controller: ReadyReplayController, entry: ReplayMenuEntry): Promise<void> {
  if (entry.source === "local") return openLocalReplay(controller, entry);
  const lib = resourceLibrary(controller);
  if (!lib) throw new Error(tr("缺少资源库。"));
  if (controller.replayBusy) return;
  controller.replayBusy = true;
  try {
    const session = activeBrowserSession();
    if (!session) throw new Error(tr("请先登录后再观看录像。"));
    const tracks = await lib.timeAttackTrackCatalog();
    const track = findTrackChoice(tracks, entry.trackId);
    if (!track) throw new Error(tr("赛道 {track} 不在当前目录。", { track: entry.trackTitle }));
    let bytes: Uint8Array;
    try {
      bytes = entry.source === "featured"
        ? await fetchFeaturedReplayFile(session, entry.featuredId ?? 0)
        : await fetchTimeAttackReplay(session, track.id, entry.speed, entry.booster, entry.accountId ?? "");
    } catch (error) {
      throw new Error(timeAttackErrorMessage(error));
    }
    const tab: ReplayTab = entry.source === "featured" ? "league" : "other";
    await startReplaySession(controller, {
      trackId: track.id, trackPath: track.path, trackTitle: entry.trackTitle, ksv: bytes,
      riderName: entry.riderName, kartName: entry.kartName, recordMs: entry.elapsedMs,
      speed: entry.speed === 4 ? 4 : 7, booster: entry.booster,
      onReturn: () => returnToReplays(controller, tab),
    });
  } finally {
    controller.replayBusy = false;
  }
}

/** Play a local record in the OB viewer; the 回放 tab reopens when it ends. */
export async function openLocalReplay(controller: ReadyReplayController, entry: ReplayMenuEntry): Promise<void> {
  const library = replayLibrary(controller);
  const lib = resourceLibrary(controller);
  if (!library || !lib) throw new Error(tr("缺少资源库。"));
  if (controller.replayBusy) return;
  controller.replayBusy = true;
  try {
    const summary = library.records.get(entry.key) as ReplaySummary | undefined;
    const tracks = await lib.timeAttackTrackCatalog();
    const track = findTrackChoice(tracks, entry.trackId);
    if (!track) throw new Error(tr("赛道 {track} 不在当前目录。", { track: entry.trackTitle }));
    const stored = await library.store.get(entry.key).catch(() => undefined) as
      { participants?: Array<{ equipment?: { playerName?: unknown } }> } | undefined;
    const playerName = stored?.participants?.[0]?.equipment?.playerName;
    const { bytes } = await library.exportKsv(entry.key);
    const parts = entry.key.split("\0");
    const speed = summary?.speed ?? Number(parts[1] ?? 7);
    const booster = summary?.booster ?? Number(parts[2] ?? 0);
    await startReplaySession(controller, {
      trackId: track.id, trackPath: track.path, trackTitle: entry.trackTitle, ksv: bytes,
      riderName: typeof playerName === "string" && playerName ? playerName : entry.riderName,
      kartName: entry.kartName, recordMs: entry.elapsedMs, speed: speed === 4 ? 4 : 7, booster,
      onReturn: () => returnToReplays(controller, "my"),
    });
  } finally {
    controller.replayBusy = false;
  }
}

/** 删除 on a local card: confirm, then drop the record and its date. */
export async function deleteLocalReplay(controller: ReadyReplayController, entry: ReplayMenuEntry): Promise<boolean> {
  const library = replayLibrary(controller);
  const lib = controller.host.getLibrary();
  if (!library || !lib || controller.replayBusy || entry.source !== "local") return false;
  const agreed = await openMessengerMessage(lib as never, controller.host.root, TITLE,
    tr("要删除这条回放吗？|{track}　{time}", { track: entry.trackTitle, time: formatRecordTime(entry.elapsedMs) }), { yes: tr("删除"), no: tr("取消") })
    .catch(() => false);
  if (!agreed || controller.disposed) return false;
  await library.delete(entry.key);
  forgetReplayDate(entry.key);
  return true;
}
