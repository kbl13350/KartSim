import { findTrackChoice } from "../resources/track-duplicates";
import { tr } from "../i18n/locale";
/**
 * 赛道对决 races (TIMEATTACK.md): the practice window's 开始对决 starts a story
 * style race against the stage's NPC, whose original recording plays as the
 * rival ghost; back on Ready the data service settles the duel and the NPC's
 * line is shown.
 */
import { activeBrowserSession } from "../account/account-runtime";
import { newRequestId } from "../account/rewards";
import type { StoryMission } from "../story/story-data";
import type { StoryGhostSource, StoryRaceOutcome } from "../story/story-race";
import { openMessengerMessage } from "../ui/messenger-dialogs";
import type { DuelRaceRequest } from "../ui/ready-missions";
import type { ReadyFlowController, ReadyOptions, ReadySelection } from "./ready-flow";
import type { ReadyHomeController } from "./ready-home";
import { storyGhostSources } from "./ready-story";
import { formatRecordTime, settleDuelRace, timeAttackErrorMessage } from "./timeattack-api";

const TITLE = "赛道对决";
/** Each stage's NPC recording (timeAttackMission.xml mission ksv), in DataPack4. */
const DUEL_KSV_ROOT = "zeta_/cn/content/timeAttack/ksv";

interface CatalogEntry { itemId: number; path: string }
interface DuelLibrary {
  timeAttackGarageCatalog(): Promise<{ karts: CatalogEntry[]; characters: CatalogEntry[] }>;
  timeAttackTrackCatalog(): Promise<Array<{ id: string; path: string }>>;
  exactCanonicalCandidates(path: string): Array<{ bytes(): Promise<Uint8Array> }>;
}

/**
 * The stage NPC as the race's rival: its recording, dressed as the mission's
 * itemOn (kart, color, dye). The recording starts at the countdown like any
 * .ksv and keeps its start slot; a 难度设定 level above 无 runs it advantageMs
 * behind the clock, so the NPC sets off that much later.
 */
export async function duelNpcGhost(library: Pick<DuelLibrary, "exactCanonicalCandidates">, duel: DuelRaceRequest,
  trackId: string, catalog: { karts: CatalogEntry[]; characters: CatalogEntry[] }): Promise<StoryGhostSource> {
  const { npc, ksv } = duel.stage;
  const file = ksv ? library.exactCanonicalCandidates(`${DUEL_KSV_ROOT}/${ksv}.ksv`)[0] : undefined;
  if (!file) throw new Error(tr("缺少 {npc} 的对决录像 {replay}。", { npc: npc.name, replay: ksv || tr("（未配置）") }));
  const mission = { kind: "Shadow", track: trackId, laps: 0, timeLimitMs: 0, speed: duel.stage.speed,
    rival: { name: npc.name, kartId: npc.kartId, characterId: npc.characterId, ksv } } as StoryMission;
  const source = storyGhostSources(await file.bytes(), trackId, mission, catalog).sources[0];
  if (!source) throw new Error(tr("{npc} 的对决录像里没有车手。", { npc: npc.name }));
  source.equipment.kartPaint = npc.color || 0;
  source.equipment.characterColor = npc.dye || 0;
  const advantageMs = duel.stage.difficulties[duel.difficulty]?.advantageMs ?? 0;
  return { ...source, timeOffsetMs: 0 - advantageMs };
}

export interface ReadyDuelController extends ReadyFlowController {
  duelMessage?: AbortController;
}

/** Start the duel race; the window closes with Ready's rebuild when the race returns. */
export async function startDuelRace(controller: ReadyDuelController, selection: ReadySelection,
  options: ReadyOptions, duel: DuelRaceRequest): Promise<void> {
  const host = controller.host;
  const library = host.getLibrary() as unknown as DuelLibrary | undefined;
  if (!library) return;
  const previousOptions = host.getReadyOptions();
  const catalog = await library.timeAttackGarageCatalog();
  const advantageMs = duel.stage.difficulties[duel.difficulty]?.advantageMs ?? 0;
  const targetMs = duel.stage.targetMs + advantageMs;
  // The duel runs on the event's track, whatever track the window shows.
  const tracks = await library.timeAttackTrackCatalog();
  const track = findTrackChoice(tracks, duel.event.trackId);
  if (!track) throw new Error(tr("赛道 {track} 不在本地资源中", { track: duel.event.trackId }));
  const npc = await duelNpcGhost(library, duel, track.id, catalog);
  const previous = host.getSelection();
  const restore = (): void => {
    if (previous) host.setSelection(previous);
    host.setReadyOptions(previousOptions);
  };
  const raceSelection: ReadySelection = {
    ...selection,
    mapPath: track.path, trackId: track.id,
    story: {
      ghosts: [npc],
      restore,
      judge: (elapsedMs: number) => elapsedMs < targetMs,
      onReturn: (outcome: StoryRaceOutcome) => { void finishDuel(controller, duel, outcome); },
    },
  };
  const raceOptions: ReadyOptions = { ...options, speed: duel.stage.speed, settingSpeed: duel.stage.speed,
    version: "国服", booster: duel.stage.teamBooster ? 1 : 0, showGhost: true };
  await controller.startRaceFromReady(raceSelection, raceOptions);
  if (!controller.disposed && host.shell.current === "Ready") {
    host.setReadyOptions(previousOptions);
    message(controller, tr("比赛未能开始，请重试。"));
  }
}

async function finishDuel(controller: ReadyDuelController, duel: DuelRaceRequest,
  outcome: StoryRaceOutcome): Promise<void> {
  const session = activeBrowserSession();
  const npc = duel.stage.npc.name;
  if (!session) {
    message(controller, outcome.finished && outcome.cleared !== false ? tr("对决胜利！战胜了 {npc}。", { npc: npc }) : tr("对决失败，没有赢过 {npc}。", { npc: npc }));
    return;
  }
  try {
    const result = await settleDuelRace(session, { requestId: newRequestId(), key: duel.event.key, stage: duel.stage.stage,
      difficulty: duel.difficulty, elapsedMs: outcome.elapsedMs, finished: outcome.finished });
    const lines = result.won
      ? [tr("对决胜利！用时 {time}，战胜了 {npc}（{target}）。", { time: formatRecordTime(outcome.elapsedMs), npc: npc, target: formatRecordTime(result.targetMs) }),
        ...duel.stage.messages.win.map(line => tr(line)),
        ...(result.firstWin ? [tr("胜利奖励已放入奖励箱。")] : []),
        ...(result.bonus ? [tr("难度奖励已放入奖励箱。")] : [])]
      : [outcome.finished ? tr("对决失败，用时 {time}，没有赢过 {npc}（{target}）。", { time: formatRecordTime(outcome.elapsedMs), npc: npc, target: formatRecordTime(result.targetMs) }) : tr("对决失败，没有完成比赛。"),
      ...(result.difficulty > duel.difficulty && result.difficulty > 0
        ? [tr("已连续落败 {losses} 次：可在 难度设定 中让 {npc} 晚 {seconds}秒 出发。", { losses: result.losses, npc: npc, seconds: (duel.stage.difficulties[result.difficulty]?.advantageMs ?? 0) / 1000 }), ...duel.stage.messages.difficulty.map(line => tr(line))]
        : [])];
    message(controller, lines.join("\n"));
  } catch (error) {
    message(controller, tr("赛道对决结算失败：{error}", { error: timeAttackErrorMessage(error) }));
  }
}

function message(controller: ReadyDuelController, text: string): void {
  const library = controller.host.getLibrary();
  if (!library || controller.disposed) return;
  controller.duelMessage?.abort();
  const abort = new AbortController();
  controller.duelMessage = abort;
  const home = controller as unknown as ReadyHomeController;
  void openMessengerMessage(library as never, controller.host.root, tr(TITLE), text.replaceAll("\n", "|"), {}, abort.signal)
    .catch(() => home.activeHome?.showNotice(text)).finally(() => {
      if (controller.duelMessage === abort) controller.duelMessage = undefined;
    });
}
