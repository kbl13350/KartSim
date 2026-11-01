import { tr } from "../i18n/locale";
import { findTrackChoice } from "../resources/track-duplicates";
import { registerTrackMetadata } from "../resources/track-overrides";
import type { StoryRaceRequest } from "../story/story-race";
import type { TrainingLesson } from "../training/training-catalog";
import { tellPlayer } from "../ui/game-popups";
import type { ReadyOptions, ReadySelection } from "./ready-flow";
import type { ReadyHomeController } from "./ready-home";

interface TrainingLibrary {
  mapAssets(): Array<{ virtualPath: string }>;
  timeAttackTrackCatalog(): Promise<Array<{ id: string; path: string }>>;
  timeAttackGarageCatalog(): Promise<{
    karts: Array<{ itemId: number; path: string; systemKey?: string }>;
  }>;
}

export interface TrainingPracticeDependencies {
  openHome(controller: ReadyHomeController, lesson: TrainingLesson): Promise<void>;
  report(controller: ReadyHomeController, error: unknown): void;
}

const dependencies: TrainingPracticeDependencies = {
  openHome: async (controller, lesson) => {
    const { openReadyHome } = await import("./ready-home");
    await openReadyHome(controller, "single");
    // The Ready rebuild may have started loading home before onReturn runs.
    for (let frame = 0; !controller.activeHome && controller.homeOpening && frame < 120; frame++)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (!controller.disposed) {
      controller.activeHome?.single.selectCategory("cat_trainingCenter");
      controller.activeHome?.single.selectTraining(lesson.level);
    }
  },
  report: (controller, error) => {
    const message = tr("车手学院：{error}", { error: error instanceof Error ? error.message : String(error) });
    if (controller.activeHome) controller.activeHome.showNotice(message);
    else tellPlayer(controller.host.hud, message);
  },
};

interface PracticeSession {
  phase: "loading" | "race" | "returning" | "closed";
  previous: ReadySelection;
  options: ReadyOptions;
}

const sessions = new WeakMap<ReadyHomeController, PracticeSession>();

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
};

/** The training courses are packaged maps, but most have no public track row. */
async function course(library: TrainingLibrary, lesson: TrainingLesson): Promise<{ id: string; path: string }> {
  const tracks = await library.timeAttackTrackCatalog();
  const track = findTrackChoice(tracks, lesson.track);
  if (track) return track;
  const wanted = `track_/${lesson.track}/track.1s`.toLowerCase();
  const model = library.mapAssets().find(file => file.virtualPath.toLowerCase() === wanted);
  if (!model) throw new Error(tr("赛道 {track} 不在本地资源中", { track: lesson.track }));
  registerTrackMetadata({ id: lesson.track, gameType: "speed", difficulty: 1,
    laps: positiveInteger(lesson.parameters.lap, 1), cnTitle: lesson.title,
    speedPool: false, theme: lesson.track.split("_")[0] });
  return { id: lesson.track, path: model.virtualPath };
}

/**
 * Drive the lesson's original course without publishing a time attack record.
 * The teaching pages explain the technique; this is unscored practice and
 * deliberately supplies no invented training mission judge or rewards.
 */
export async function openTrainingPractice(controller: ReadyHomeController, lesson: TrainingLesson,
  flow: TrainingPracticeDependencies = dependencies): Promise<boolean> {
  if (controller.disposed || controller.multiplayer || controller.host.shell.started || sessions.has(controller)) return false;
  const host = controller.host;
  const previous = host.getSelection();
  if (!previous) {
    flow.report(controller, new Error(tr("请先在计时赛选好车辆和人物。")));
    return false;
  }
  const library = host.getLibrary() as unknown as TrainingLibrary | undefined;
  if (!library || typeof library.mapAssets !== "function") return false;
  const session: PracticeSession = { phase: "loading", previous, options: host.getReadyOptions() };
  sessions.set(controller, session);
  const current = (): boolean => !controller.disposed && sessions.get(controller) === session && session.phase !== "closed";
  const close = (): void => {
    session.phase = "closed";
    if (sessions.get(controller) === session) sessions.delete(controller);
  };
  const restore = (): void => {
    if (!current()) return;
    host.setSelection(session.previous);
    host.setReadyOptions(session.options);
    controller.homeRequested = true;
    controller.homePage = "single";
  };
  try {
    const [track, catalog] = await Promise.all([course(library, lesson), library.timeAttackGarageCatalog()]);
    if (!current()) { close(); return false; }
    // A positive id names the lesson's fixed kart. Zero keeps the player's kart.
    const kart = lesson.kartId > 0 ? catalog.karts.find(entry => entry.itemId === lesson.kartId) : undefined;
    if (lesson.kartId > 0 && !kart) throw new Error(tr("缺少课程指定车辆：{id}", { id: lesson.kartId }));
    const story: StoryRaceRequest = {
      ghosts: [], laps: positiveInteger(lesson.parameters.lap, 1), restore,
      onReturn: () => {
        if (!current() || session.phase === "returning") return;
        session.phase = "returning";
        void flow.openHome(controller, lesson).catch(error => {
          if (!controller.disposed) flow.report(controller, error);
        }).finally(close);
      },
    };
    const selection: ReadySelection = { ...previous, mapPath: track.path, trackId: track.id, ranked: undefined, story,
      ...(kart ? { vehiclePath: kart.path, vehicleItemId: kart.itemId, vehicleSystemKey: kart.systemKey } : {}) };
    const options: ReadyOptions = { ...session.options, booster: 0, showGhost: false };
    await controller.startRaceFromReady(selection, options);
    if (!current()) return false;
    // The shared starter catches load errors; shell state proves publication.
    if (!host.shell.started || host.shell.current === "Ready") throw new Error(tr("练习未能开始，请重试。"));
    session.phase = "race";
    return true;
  } catch (error) {
    if (current()) {
      restore();
      try { await flow.openHome(controller, lesson); } catch { /* Report the original launch error. */ }
      if (!controller.disposed) flow.report(controller, error);
    }
    close();
    return false;
  }
}
