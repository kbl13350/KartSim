import { activeBrowserSession } from "../account/account-runtime";
import { getFormulaGroup, type FormulaDifficulty, type FormulaGroupId, type FormulaRound } from "../formula/formula-data";
import { FormulaChampionship, type FormulaRoundResult } from "../formula/formula-engine";
import type { FormulaRaceRequest } from "../formula/formula-race";
import { openFormulaResults, openFormulaSetup, type FormulaResultRow, type FormulaResultsOptions,
  type FormulaSetupOptions, type FormulaWindowHandle } from "../formula/formula-ui";
import { tr } from "../i18n/locale";
import { trackDisplayTitle } from "../resources/track-names";
import type { StoryGhostSource, StoryRaceRequest } from "../story/story-race";
import type { BmlLibrary } from "../ui/bml-kit";
import { tellPlayer } from "../ui/game-popups";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import { openReadyHome, type ReadyHomeController } from "./ready-home";
import { localRiderName } from "./ready-house";

/** All three original circuits contain actual PIT geometry. The order is a
 * restoration choice; lap counts come from the loaded track's own metadata. */
export const FORMULA_TRACKS = ["wkc_R01", "wkc_R03", "wkc_R04"] as const;

interface FormulaReadyLibrary extends BmlLibrary {
  timeAttackTrackCatalog(): Promise<Array<{ id: string; path: string }>>;
}

export interface FormulaFlowDependencies {
  openSetup(options: FormulaSetupOptions): Promise<FormulaWindowHandle>;
  openResults(options: FormulaResultsOptions): Promise<FormulaWindowHandle>;
  openHome(controller: ReadyHomeController): Promise<void>;
  report(controller: ReadyHomeController, error: unknown): void;
}

const defaultDependencies: FormulaFlowDependencies = {
  openSetup: openFormulaSetup,
  openResults: openFormulaResults,
  openHome: controller => openReadyHome(controller, "single"),
  report: (controller, error) => {
    const message = tr("极速方程：{error}", { error: error instanceof Error ? error.message : String(error) });
    if (controller.activeHome) controller.activeHome.single.showNotice(message);
    else tellPlayer(controller.host.hud, message);
  },
};

interface FormulaSession {
  library: FormulaReadyLibrary;
  dependencies: FormulaFlowDependencies;
  championship: FormulaChampionship;
  difficulty: FormulaDifficulty;
  groupId: FormulaGroupId;
  phase: "opening" | "setup" | "starting" | "race" | "returning" | "results" | "closed";
  window?: FormulaWindowHandle;
  request?: FormulaRaceRequest;
  lastResult?: FormulaRoundResult;
  previous?: ReadySelection;
  previousOptions?: ReadyOptions;
}

const sessions = new WeakMap<ReadyHomeController, FormulaSession>();

function current(controller: ReadyHomeController, session: FormulaSession): boolean {
  return !controller.disposed && session.phase !== "closed" && sessions.get(controller) === session;
}

function closeSession(controller: ReadyHomeController, session: FormulaSession): void {
  session.phase = "closed";
  session.window?.dispose();
  session.window = undefined;
  session.request = undefined;
  if (sessions.get(controller) === session) sessions.delete(controller);
}

/** Exact original names, karts, paints and dyes; NPCs without an explicit
 * character use a valid loader fallback but hide that external character:
 * the original npc_f1/f12/f13 kart models already include their own rider. */
export function formulaGhostSources(groupId: FormulaGroupId): StoryGhostSource[] {
  const group = getFormulaGroup(groupId);
  const fallbackCharacter = group.riders.find(rider => rider.characterId)?.characterId ?? 1;
  return group.riders.map((rider, index) => ({
    solid: true,
    hideCharacter: rider.characterId === undefined,
    equipment: { character: rider.characterId ?? fallbackCharacter, kart: rider.kartId,
      kartPaint: rider.colorId, characterColor: rider.dyeId, playerName: rider.name, startSlot: index + 1 },
    // These stamps only select booster effects. FormulaRuntime supplies the live playback.
    record: { stamps: [{ status: 0 }, { status: 3 }] },
  }));
}

/** Entered only from the single-player page. A second click reuses this session. */
export async function openReadyFormula(controller: ReadyHomeController,
  dependencies: FormulaFlowDependencies = defaultDependencies): Promise<void> {
  if (controller.disposed || controller.multiplayer || controller.host.shell.started || sessions.has(controller)) return;
  const library = controller.host.getLibrary() as unknown as FormulaReadyLibrary | undefined;
  if (!library || typeof library.canonicalCandidates !== "function") return;
  const session: FormulaSession = { library, dependencies, championship: new FormulaChampionship(),
    difficulty: "normal", groupId: 1, phase: "opening" };
  sessions.set(controller, session);
  try { await showSetup(controller, session); }
  catch (error) { closeSession(controller, session); if (!controller.disposed) dependencies.report(controller, error); }
}

async function showSetup(controller: ReadyHomeController, session: FormulaSession): Promise<void> {
  if (!current(controller, session)) return;
  session.window?.dispose();
  session.window = undefined;
  session.phase = "opening";
  const window = await session.dependencies.openSetup({ library: session.library, root: controller.host.root,
    difficulty: session.difficulty, tracks: FORMULA_TRACKS.map(id => trackDisplayTitle(id)),
    onClose: () => closeSession(controller, session),
    onStart: difficulty => {
      if (!current(controller, session) || session.phase !== "setup") return;
      session.difficulty = difficulty;
      session.previous = controller.host.getSelection();
      session.previousOptions = controller.host.getReadyOptions();
      session.window?.dispose(); session.window = undefined;
      void startRound(controller, session);
    },
  });
  if (!current(controller, session)) { window.dispose(); return; }
  session.window = window;
  session.phase = "setup";
}

function restore(controller: ReadyHomeController, session: FormulaSession): void {
  if (session.previous) controller.host.setSelection(session.previous);
  if (session.previousOptions) controller.host.setReadyOptions(session.previousOptions);
  controller.homeRequested = true;
  controller.homePage = "single";
}

async function startRound(controller: ReadyHomeController, session: FormulaSession): Promise<void> {
  if (!current(controller, session) || session.phase === "starting" || session.phase === "race") return;
  session.phase = "starting";
  session.window?.dispose(); session.window = undefined;
  const host = controller.host;
  try {
    if (!session.previous) throw new Error(tr("请先在计时赛选好车辆和人物。"));
    const round = session.championship.completedRounds + 1 as FormulaRound;
    if (round > 3) throw new Error(tr("三回合挑战已经结束。"));
    // Original cutscene 301/302 reveals 塞里吾斯 as MR.SUN and changes
    // the same NPC ids into their dark group for the final round.
    session.groupId = round === 3 ? 2 : 1;
    const trackId = FORMULA_TRACKS[round - 1]!;
    const catalog = await session.library.timeAttackTrackCatalog();
    const track = catalog.find(item => item.id.toLowerCase() === trackId.toLowerCase());
    if (!track) throw new Error(tr("赛道 {track} 不在本地资源中", { track: trackId }));
    if (!current(controller, session)) return;
    const request: FormulaRaceRequest = { difficulty: session.difficulty, groupId: session.groupId, round,
      trackId: track.id, playerName: activeBrowserSession()?.summary()?.account.nickname ?? localRiderName() };
    session.request = request;
    const story: StoryRaceRequest = {
      ghosts: formulaGhostSources(session.groupId), formula: request,
      restore: () => restore(controller, session),
      onReturn: () => {
        if (!current(controller, session) || session.request !== request) return;
        session.request = undefined;
        session.phase = "returning";
        void returnFromRound(controller, session, request).catch(error => {
          closeSession(controller, session);
          if (!controller.disposed) session.dependencies.report(controller, error);
        });
      },
    };
    const selection: ReadySelection = { ...session.previous, mapPath: track.path, trackId: track.id, story, ranked: undefined };
    await controller.startRaceFromReady(selection, { ...session.previousOptions, speed: 7, settingSpeed: 7,
      version: "国服", booster: 0, showGhost: true });
    if (!current(controller, session) || session.request !== request) return;
    // startRaceFromReady deliberately catches load failures; the shell is the
    // authoritative evidence that the requested race actually started.
    if (!host.shell.started || host.shell.current === "Ready") throw new Error(tr("比赛未能开始，请重试。"));
    session.phase = "race";
  } catch (error) {
    if (!current(controller, session)) return;
    session.request = undefined;
    restore(controller, session);
    try {
      await session.dependencies.openHome(controller);
      if (session.lastResult) await showResults(controller, session, session.lastResult);
      else await showSetup(controller, session);
    } catch {
      closeSession(controller, session);
    }
    session.dependencies.report(controller, error);
  }
}

async function returnFromRound(controller: ReadyHomeController, session: FormulaSession,
  request: FormulaRaceRequest): Promise<void> {
  await session.dependencies.openHome(controller);
  // Ready can already be loading home when onReturn fires.
  for (let frame = 0; !controller.activeHome && controller.homeOpening && frame < 120; frame++)
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if (!current(controller, session)) return;
  if (!request.result) { closeSession(controller, session); return; }
  session.championship.record(request.result);
  session.lastResult = request.result;
  await showResults(controller, session, request.result);
}

async function showResults(controller: ReadyHomeController, session: FormulaSession, result: FormulaRoundResult): Promise<void> {
  if (!current(controller, session)) return;
  session.phase = "returning";
  session.window?.dispose(); session.window = undefined;
  const totals = session.championship.standings;
  const totalById = new Map(totals.map(row => [row.id, row.points]));
  const rows: FormulaResultRow[] = result.standings.map(row => ({ id: String(row.id), name: row.name,
    rank: row.rank, points: row.points, totalPoints: totalById.get(row.id), elapsedMs: row.finishedMs,
    dnf: row.dnf, isPlayer: row.id === 0, crashes: row.id === 0 ? result.hits : undefined }));
  const window = await session.dependencies.openResults({ root: controller.host.root, library: session.library,
    round: result.round, rows, final: session.championship.complete,
    totals: totals.map(row => ({ id: String(row.id), name: rows.find(current => current.id === String(row.id))?.name ?? row.name, rank: row.rank,
      points: row.points, totalPoints: row.points, isPlayer: row.id === 0 })),
    onClose: () => closeSession(controller, session),
    onNext: () => {
      if (!current(controller, session) || session.phase !== "results") return;
      session.window?.dispose(); session.window = undefined;
      if (session.championship.complete) {
        session.championship.reset(); session.lastResult = undefined;
        void showSetup(controller, session).catch(error => {
          closeSession(controller, session); session.dependencies.report(controller, error);
        });
      } else void startRound(controller, session);
    },
  });
  if (!current(controller, session)) { window.dispose(); return; }
  session.window = window;
  session.phase = "results";
}
