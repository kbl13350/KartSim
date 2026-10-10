import { ensureFeatureResources } from "../ui/resource-panel";
import { ksvCompression } from "../codecs/ksv-compression";
import { decodeKsvFile } from "../game/ghost/ksv-codec";
import { U1 } from "../generated/library.js";
import { PLAYABLE_STORY_MISSIONS, storyScenePages, type StoryChapter,
  type StoryMission, type StoryStep } from "../story/story-data";
import { clearOpenMultiplayerSteps, clearStoryStep, isChapterCleared, isChapterOpen,
  isStepAvailable, isStepCleared, loadStoryProgress, requiredStepCount, saveStoryProgress,
  type StoryProgress } from "../story/story-progress";
import type { StoryGhostSource, StoryRaceOutcome } from "../story/story-race";
import { STORY_ROOT, StoryResources, type StoryLibrary } from "../story/story-resources";
import type { StoryMenuChapter } from "../ui/main-menu-view";
import { decodeStoryTexture, openStoryMap, openStoryMessage, openStoryReady,
  openStoryScene, type StoryMapWindow } from "../ui/story-windows";
import { loadStoryTrackCard, type StoryTrackCardLibrary } from "../ui/story-track-card";
import { ghostEquipmentFromKsv } from "./ghost-equipment";
import type { ReadySelection } from "./ready-flow";
import { openReadyHome, type ReadyHomeController } from "./ready-home";
import type { ReadyOptions } from "../ui/ready-options";

/**
 * 故事模式 over the 单人游戏 page: chapter list → chapter map → step window →
 * dialogue → race → back to the map with the step cleared or not.
 * Phase one runs the time attack and rival ghost (Shadow) steps.
 */

interface CatalogEntry { itemId: number; path: string; systemKey?: string; title?: string }
interface StoryCatalog { karts: CatalogEntry[]; characters: CatalogEntry[] }
interface StoryReadyLibrary extends StoryLibrary {
  timeAttackGarageCatalog(): Promise<StoryCatalog>;
  timeAttackTrackCatalog(): Promise<Array<{ id: string; path: string }>>;
  timeAttackRandomTrackNames?(): Promise<Map<string, string>>;
}

interface StoryWindow { dispose(): void }

export interface ReadyStoryController extends ReadyHomeController {
  storyResources?: StoryResources;
  storyWindow?: StoryWindow;
  storyMap?: StoryMapWindow & { chapter: string };
  storyMessage?: StoryWindow;
  storyBusy?: boolean;
  /**
   * Bumped when story mode is left (map closed, home closed); a story open
   * still loading from before then drops its window.
   */
  storyGeneration?: number;
}

const KSV_Z_CEILINGS = [1500, 3000];

const generation = (controller: ReadyStoryController): number => controller.storyGeneration ?? 0;

/** Leave story mode: close its windows and cancel opens still loading. */
export function leaveStory(controller: ReadyStoryController): void {
  controller.storyGeneration = generation(controller) + 1;
  closeStory(controller);
}

/** Story windows only open while the 单人游戏 page they belong to is up. */
function stale(controller: ReadyStoryController, started: number): boolean {
  return controller.disposed || generation(controller) !== started || !controller.activeHome;
}

function storyLibrary(controller: ReadyStoryController): StoryReadyLibrary | undefined {
  const library = controller.host.getLibrary() as Partial<StoryReadyLibrary> | undefined;
  return typeof library?.canonicalCandidates === "function" ? library as StoryReadyLibrary
    : undefined;
}

function resources(controller: ReadyStoryController): StoryResources | undefined {
  const library = storyLibrary(controller);
  if (!library) return undefined;
  if (controller.storyResources?.library !== library)
    controller.storyResources = new StoryResources(library);
  return controller.storyResources;
}

/** The release message box (dialog2_customMessageBox) over story mode. */
function showStoryMessage(controller: ReadyStoryController, message: string): void {
  const library = storyLibrary(controller);
  if (!library || controller.disposed) return;
  controller.storyMessage?.dispose();
  controller.storyMessage = undefined;
  const close = (): void => {
    controller.storyMessage?.dispose();
    controller.storyMessage = undefined;
  };
  void openStoryMessage({ library, root: controller.host.root, title: "故事模式", message,
    onClose: close }).then(view => {
    if (controller.disposed) view.dispose();
    else controller.storyMessage = view;
  }).catch(error => controller.activeHome?.showNotice(
    `故事模式：${message}（${error instanceof Error ? error.message : String(error)}）`));
}

function report(controller: ReadyStoryController, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[story]", error);
  showStoryMessage(controller, message);
}

function closeStoryWindow(controller: ReadyStoryController): void {
  controller.storyWindow?.dispose();
  controller.storyWindow = undefined;
}

export function closeStory(controller: ReadyStoryController): void {
  closeStoryWindow(controller);
  controller.storyMap?.dispose();
  controller.storyMap = undefined;
  controller.storyMessage?.dispose();
  controller.storyMessage = undefined;
}

const cardTextures = new WeakMap<object, Map<string, Promise<Array<{
  image: CanvasImageSource; width: number; height: number }> | undefined>>>();

/** select/<chapter>.png, or the four button states select/<chapter>1…4.png. */
function chapterCard(library: StoryReadyLibrary, chapter: string) {
  let cache = cardTextures.get(library);
  if (!cache) cardTextures.set(library, cache = new Map());
  let pending = cache.get(chapter);
  if (!pending) {
    const roots = [`${STORY_ROOT}/select`];
    pending = Promise.resolve().then(async () => {
      try {
        return [await decodeStoryTexture(U1(library, roots, chapter) as never)];
      } catch {
        return Promise.all([1, 2, 3, 4].map(index =>
          decodeStoryTexture(U1(library, roots, `${chapter}${index}`) as never)));
      }
    }).catch(() => undefined);
    cache.set(chapter, pending);
  }
  return pending;
}

const subTextures = new WeakMap<object, Map<string, Promise<{
  image: CanvasImageSource; width: number; height: number } | undefined>>>();

/** select/sub/<chapter>.png, the picture on the release chapter board. */
function chapterPicture(library: StoryReadyLibrary, chapter: string) {
  let cache = subTextures.get(library);
  if (!cache) subTextures.set(library, cache = new Map());
  let pending = cache.get(chapter);
  if (!pending) {
    pending = Promise.resolve().then(() =>
      decodeStoryTexture(U1(library, [`${STORY_ROOT}/select/sub`], chapter) as never))
      .catch(() => undefined);
    cache.set(chapter, pending);
  }
  return pending;
}

/** Chapters with their cards, lock state and progress for the 故事模式 tab. */
export async function loadStoryMenu(controller: ReadyStoryController): Promise<StoryMenuChapter[]> {
  const story = resources(controller);
  if (!story) return [];
  const chapters = await story.loadChapters();
  const progress = loadStoryProgress();
  const stepsByChapter = new Map<string, StoryStep[]>();
  await Promise.all(chapters.map(async chapter => {
    try {
      stepsByChapter.set(chapter.name, await story.loadSteps(chapter.name));
    } catch {
      // A chapter without step data stays listed but cannot open.
    }
  }));
  return Promise.all(chapters.map(async chapter => {
    const steps = stepsByChapter.get(chapter.name);
    // A fork's other branch is never played: count the shortest run to an ending.
    const total = steps && requiredStepCount(steps);
    const done = progress.cleared[chapter.name]?.length ?? 0;
    const library = story.library as StoryReadyLibrary;
    return {
      name: chapter.name, title: chapter.title, subTitle: chapter.subTitle, desc: chapter.desc,
      card: await chapterCard(library, chapter.name),
      sub: await chapterPicture(library, chapter.name),
      showNew: chapter.showNew,
      open: !!steps && isChapterOpen(progress, chapter, chapters, stepsByChapter),
      cleared: !!steps && isChapterCleared(progress, chapter.name, steps),
      progress: total === undefined ? "暂无关卡数据" : `已完成 ${Math.min(done, total)} / ${total} 关`,
    };
  }));
}

async function chapterOf(story: StoryResources, name: string): Promise<StoryChapter> {
  const chapter = (await story.loadChapters()).find(entry => entry.name === name);
  if (!chapter) throw new Error(`找不到章节 ${name}`);
  return chapter;
}

/** Open a chapter's map over the 单人游戏 page. */
export async function openStoryChapter(controller: ReadyStoryController, name: string,
  options: { notice?: string } = {}): Promise<void> {
  const story = resources(controller);
  if (!story || controller.storyBusy || controller.disposed) return;
  controller.storyBusy = true;
  const started = generation(controller);
  try {
    await ensureFeatureResources(controller.host.root, "story").catch(() => undefined);
    const chapter = await chapterOf(story, name);
    const [steps, map] = await Promise.all([story.loadSteps(name), story.loadMap(name)]);
    if (stale(controller, started)) return;
    // Multiplayer goal steps have no race here; once reached they count as done.
    const opened = clearOpenMultiplayerSteps(loadStoryProgress(), name, steps);
    if (opened !== loadStoryProgress()) saveStoryProgress(opened);
    const progress = (): StoryProgress => loadStoryProgress();
    closeStory(controller);
    const window = await openStoryMap({
      library: story.library, root: controller.host.root, chapter, steps, map,
      chapterCleared: () => isChapterCleared(progress(), name, steps),
      isCleared: step => isStepCleared(progress(), name, step.id),
      isOpen: step => isStepAvailable(progress(), name, step),
      onStep: step => { void openStoryStep(controller, chapter, step); },
      onClose: () => leaveStory(controller),
      onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
    });
    if (stale(controller, started)) {
      window.dispose();
      return;
    }
    controller.storyMap = { ...window, chapter: name };
    if (options.notice) showStoryMessage(controller, options.notice);
  } catch (error) {
    report(controller, error);
  } finally {
    controller.storyBusy = false;
  }
}

async function trackTitle(library: StoryReadyLibrary, track: string): Promise<string> {
  try {
    const names = await library.timeAttackRandomTrackNames?.();
    return names?.get(track) ?? names?.get(track.toLowerCase()) ?? track;
  } catch {
    return track;
  }
}

async function openStoryStep(controller: ReadyStoryController, chapter: StoryChapter,
  step: StoryStep): Promise<void> {
  const story = resources(controller);
  if (!story || controller.storyBusy) return;
  controller.storyBusy = true;
  const started = generation(controller);
  try {
    const mission = await story.loadMission(chapter.name, step);
    const library = story.library as StoryReadyLibrary;
    const tracks = await library.timeAttackTrackCatalog();
    const track = tracks.find(entry => entry.id.toLowerCase() === mission.track.toLowerCase());
    // The release track card, as the time attack Ready view shows it.
    const cardLibrary = library as unknown as StoryTrackCardLibrary;
    const trackCard = track && typeof cardLibrary.trackMetadata === "function"
      ? await loadStoryTrackCard(cardLibrary, track).catch(error => {
        console.warn("[story] track card", error);
        return undefined;
      }) : undefined;
    if (stale(controller, started)) return;
    closeStoryWindow(controller);
    const window = await openStoryReady({
      library, root: controller.host.root, chapter, step, mission, trackCard,
      trackTitle: trackCard?.title ?? await trackTitle(library, mission.track),
      cleared: isStepCleared(loadStoryProgress(), chapter.name, step.id),
      unavailable: track ? undefined : `赛道 ${mission.track} 不在本地资源中`,
      onStart: () => { void playStoryStep(controller, chapter, step, mission); },
      onClose: () => {
        closeStoryWindow(controller);
        controller.storyMap?.focus();
      },
      onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
    });
    if (stale(controller, started)) {
      window.dispose();
      return;
    }
    controller.storyWindow = window;
    // 开始 stays in its release disabled state; say why in the release message box.
    if (!track) showStoryMessage(controller, `赛道 ${mission.track} 不在本地资源中。`);
    else if (!PLAYABLE_STORY_MISSIONS.has(mission.kind))
      showStoryMessage(controller, "这一关的玩法网页版暂未开放，敬请期待。");
  } catch (error) {
    report(controller, error);
  } finally {
    controller.storyBusy = false;
  }
}

/** The dialogue first, when the step has one, then the race. */
async function playStoryStep(controller: ReadyStoryController, chapter: StoryChapter,
  step: StoryStep, mission: StoryMission): Promise<void> {
  const story = resources(controller);
  if (!story || controller.storyBusy) return;
  controller.storyBusy = true;
  const started = generation(controller);
  try {
    closeStoryWindow(controller);
    let pages: ReturnType<typeof storyScenePages> = [];
    if (step.visualScene) {
      try {
        pages = storyScenePages(await story.loadScene(chapter.name, step.visualScene));
      } catch {
        pages = [];
      }
    }
    if (stale(controller, started)) return;
    if (pages.length) {
      const emotions = await story.loadEmotions().catch(() => new Map());
      if (stale(controller, started)) return;
      // SceneStage replaces the map in the release; keep it, hidden, for errors.
      controller.storyMap?.hide();
      const window = await openStoryScene({
        library: story.library, root: controller.host.root, chapter, pages, emotions,
        onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
        onDone: () => {
          closeStoryWindow(controller);
          void startStoryRace(controller, chapter, step, mission, started);
        },
      });
      if (stale(controller, started)) {
        window.dispose();
        controller.storyMap?.show();
        return;
      }
      controller.storyWindow = window;
    } else {
      void startStoryRace(controller, chapter, step, mission, started);
    }
  } catch (error) {
    report(controller, error);
  } finally {
    controller.storyBusy = false;
  }
}

/** Decode the rival's .ksv into ghost sources, dressed as the release rival. */
export function storyGhostSources(bytes: Uint8Array, track: string, mission: StoryMission,
  catalog: StoryCatalog): { sources: StoryGhostSource[]; timeMs: number } {
  const ceilings = track.toLowerCase() === "transformer_r02"
    ? [...KSV_Z_CEILINGS].reverse() : KSV_Z_CEILINGS;
  let recording: ReturnType<typeof decodeKsvFile> | undefined;
  let failure: unknown;
  for (const ceiling of ceilings) {
    try {
      recording = decodeKsvFile(bytes, ceiling, ksvCompression);
      break;
    } catch (error) {
      failure = error;
    }
  }
  if (!recording) throw failure instanceof Error ? failure : new Error("对手录像无法读取。");
  const raw = recording as unknown as {
    bestTimeMs?: number;
    players: Array<{ equipment: Record<string, unknown>; playerName?: string }>;
    records: unknown[];
  };
  const rival = mission.rival;
  const kart = rival?.kartId !== undefined &&
    catalog.karts.some(entry => entry.itemId === rival.kartId) ? rival.kartId : undefined;
  const character = rival?.characterId !== undefined &&
    catalog.characters.some(entry => entry.itemId === rival.characterId)
    ? rival.characterId : undefined;
  const sources = raw.players.slice(0, raw.records.length).map((player, index) => {
    const equipment = ghostEquipmentFromKsv(player.equipment as never,
      rival?.name ?? player.playerName ?? "") as unknown as StoryGhostSource["equipment"];
    if (index === 0) {
      if (kart !== undefined) equipment.kart = kart;
      if (character !== undefined) equipment.character = character;
    }
    // The player takes slot 0 of the time attack grid.
    if (!Number.isInteger(equipment.startSlot) || equipment.startSlot === 0)
      equipment.startSlot = index + 1;
    return { equipment, record: raw.records[index], timeBase: "countdown" };
  });
  return { sources, timeMs: raw.bestTimeMs ?? 0 };
}

/** Clear rule of a finished race. */
export function storyStepResult(mission: StoryMission, outcome: StoryRaceOutcome,
  rivalTimeMs: number): { cleared: boolean; message: string } {
  if (!outcome.finished) return { cleared: false, message: "任务失败：没有完成比赛" };
  if (mission.kind === "Shadow" && rivalTimeMs > 0 && outcome.elapsedMs >= rivalTimeMs)
    return { cleared: false, message: `任务失败：没有赢过${mission.rival?.name ?? "对手"}` };
  if (mission.timeLimitMs > 0 && outcome.elapsedMs > mission.timeLimitMs)
    return { cleared: false, message: "任务失败：没有在规定时间内完成" };
  return { cleared: true, message: "任务成功！" };
}

async function startStoryRace(controller: ReadyStoryController, chapter: StoryChapter,
  step: StoryStep, mission: StoryMission, started: number): Promise<void> {
  const story = resources(controller);
  if (!story || stale(controller, started)) return;
  if (!PLAYABLE_STORY_MISSIONS.has(mission.kind)) return;
  try {
    const library = story.library as StoryReadyLibrary;
    const host = controller.host;
    const previous = host.getSelection();
    if (!previous) throw new Error("请先在计时赛选好车辆和人物。");
    const previousOptions = host.getReadyOptions();
    const [catalog, tracks] = await Promise.all([library.timeAttackGarageCatalog(),
      library.timeAttackTrackCatalog()]);
    const track = tracks.find(entry => entry.id.toLowerCase() === mission.track.toLowerCase());
    if (!track) throw new Error(`赛道 ${mission.track} 不在本地资源中`);
    const kart = mission.fixedKartId === undefined ? undefined
      : catalog.karts.find(entry => entry.itemId === mission.fixedKartId);
    const character = mission.fixedCharId === undefined ? undefined
      : catalog.characters.find(entry => entry.itemId === mission.fixedCharId);
    let ghosts: StoryGhostSource[] = [];
    let rivalTimeMs = 0;
    if (mission.rival) {
      const decoded = storyGhostSources(
        await story.loadGhost(chapter.name, step, mission.rival.ksv), track.id, mission, catalog);
      ghosts = decoded.sources;
      rivalTimeMs = decoded.timeMs;
    }
    if (stale(controller, started)) return;
    const restore = (): void => {
      host.setSelection(previous);
      host.setReadyOptions(previousOptions);
      // Ready is rebuilt next; have the 单人游戏 page cover it straight away.
      controller.homeRequested = true;
      controller.homePage = "single";
    };
    const selection: ReadySelection = {
      ...previous,
      mapPath: track.path, trackId: track.id,
      ...(kart ? { vehiclePath: kart.path, vehicleItemId: kart.itemId,
        vehicleSystemKey: kart.systemKey } : {}),
      ...(character ? { characterPath: character.path, characterItemId: character.itemId } : {}),
      story: {
        ghosts, laps: mission.laps, restore,
        judge: (elapsedMs: number) =>
          storyStepResult(mission, { finished: true, elapsedMs }, rivalTimeMs).cleared,
        onReturn: (outcome: StoryRaceOutcome) => {
          const result = storyStepResult(mission, outcome, rivalTimeMs);
          if (result.cleared)
            saveStoryProgress(clearStoryStep(loadStoryProgress(), chapter.name, step.id));
          // The finish line already showed the release mission result.
          void returnToStory(controller, chapter.name, undefined,
            result.cleared ? step.extraScene : undefined);
        },
      },
    };
    // The step's own BaseParam gameSpeed (国服 0 S1, 1 S2, 2 S3, 7 标准).
    const options: ReadyOptions = { ...previousOptions, speed: mission.speed,
      settingSpeed: mission.speed, version: "国服", booster: 0, showGhost: true };
    closeStory(controller);
    await controller.startRaceFromReady(selection, options);
    // A start that never reached the race leaves the player's choices alone
    // and goes back to the map.
    if (!controller.disposed && host.shell.current === "Ready") {
      host.setSelection(previous);
      host.setReadyOptions(previousOptions);
      if (controller.activeHome)
        await openStoryChapter(controller, chapter.name, { notice: "比赛未能开始，请重试。" });
    }
  } catch (error) {
    report(controller, error);
  }
}

/** After the race: the 单人游戏 page on 故事模式, then the chapter map. */
async function returnToStory(controller: ReadyStoryController, chapter: string,
  notice: string | undefined, ending?: string): Promise<void> {
  // restore() already asked for home while Ready was rebuilt.
  await openReadyHome(controller, "single");
  // Home may still be opening from the Ready rebuild.
  for (let frame = 0; !controller.activeHome && controller.homeOpening && frame < 120; frame++)
    await new Promise(resolve => requestAnimationFrame(resolve));
  controller.activeHome?.setPage("single");
  controller.activeHome?.selectCategory("cat_scenario");
  await openStoryChapter(controller, chapter, { notice });
  if (ending) await playStoryEnding(controller, chapter, ending);
}

/** extraScene: the epilogue after a chapter's final step, over the map. */
async function playStoryEnding(controller: ReadyStoryController, name: string,
  scene: string): Promise<void> {
  const story = resources(controller);
  if (!story || !controller.storyMap) return;
  const started = generation(controller);
  try {
    const [chapter, commands, emotions] = await Promise.all([chapterOf(story, name),
      story.loadScene(name, scene), story.loadEmotions().catch(() => new Map())]);
    const pages = storyScenePages(commands);
    if (!pages.length || stale(controller, started)) return;
    controller.storyMap?.hide();
    const window = await openStoryScene({
      library: story.library, root: controller.host.root, chapter, pages, emotions,
      onActivate: () => controller.host.getInterfaceAudio()?.playClick(),
      onDone: () => {
        closeStoryWindow(controller);
        controller.storyMap?.show();
      },
    });
    if (stale(controller, started)) {
      window.dispose();
      return;
    }
    controller.storyWindow = window;
  } catch (error) {
    controller.storyMap?.show();
    report(controller, error);
  }
}
