import { s2 } from "../generated/formats.js";
import { U1 } from "../generated/library.js";
import { readStoryChapters, readStoryEmotions, readStoryMission, readStoryScene,
  readStorySteps, type StoryChapter, type StoryMission, type StoryMissionKind,
  type StoryNode, type StorySceneCommand, type StoryStep } from "./story-data";

/** A step's race file, by the kinds it holds; the first one present wins. */
const MISSION_FILES: Array<{ file: string; kind?: StoryMissionKind }> = [
  { file: "drive" }, { file: "checkPoint", kind: "CheckPoint" },
  { file: "knockout", kind: "KnockOut" }, { file: "aiKart", kind: "AiKart" },
];

interface ResourceFile { bytes(): Promise<Uint8Array> }
export interface StoryLibrary { canonicalCandidates(path: string): ResourceFile[] }

/** zeta_cn_scenario.rho, mounted the way zeta_cn_ppl.rho is ("zeta_/cn/ppl"). */
export const STORY_ROOT = "zeta_/cn/scenario";
export const SCENE_ROOT = "stage_/scene";

function file(library: StoryLibrary, roots: string[], name: string,
  extension: string): ResourceFile {
  return U1(library, roots, name, extension) as ResourceFile;
}

async function bml(library: StoryLibrary, roots: string[], name: string): Promise<StoryNode> {
  return s2(await file(library, roots, name, ".bml").bytes()) as StoryNode;
}

const chapterRoot = (chapter: string): string => `${STORY_ROOT}/${chapter}`;

/** Loaded lazily and cached per library: chapters, steps and missions. */
export class StoryResources {
  private chapters?: Promise<StoryChapter[]>;
  private readonly steps = new Map<string, Promise<StoryStep[]>>();
  private emotions?: Promise<Map<string, Map<string, string[]>>>;

  constructor(readonly library: StoryLibrary) {}

  loadChapters(): Promise<StoryChapter[]> {
    if (!this.chapters) {
      const pending = bml(this.library, [STORY_ROOT], "scenario").then(readStoryChapters);
      this.chapters = pending;
      // A failed read (for example before the pack has mounted) is retried next time.
      pending.catch(() => { if (this.chapters === pending) this.chapters = undefined; });
    }
    return this.chapters;
  }

  loadSteps(chapter: string): Promise<StoryStep[]> {
    let pending = this.steps.get(chapter);
    if (!pending) {
      pending = bml(this.library, [chapterRoot(chapter)], "scenarioSteps").then(readStorySteps);
      pending.catch(() => this.steps.delete(chapter));
      this.steps.set(chapter, pending);
    }
    return pending;
  }

  /** The chapter map: scenarioSelect.bml under the chapter folder. */
  loadMap(chapter: string): Promise<StoryNode> {
    return bml(this.library, [chapterRoot(chapter)], "scenarioSelect");
  }

  async loadMission(chapter: string, step: StoryStep): Promise<StoryMission> {
    const roots = [`${chapterRoot(chapter)}/${step.readyStage}`];
    for (const entry of MISSION_FILES) {
      if (!this.hasFile(roots, entry.file, ".bml")) continue;
      return readStoryMission(await bml(this.library, roots, entry.file), entry.kind);
    }
    throw new Error("这一关没有比赛数据。");
  }

  async loadScene(chapter: string, scene: string): Promise<StorySceneCommand[]> {
    return readStoryScene(await bml(this.library, [`${chapterRoot(chapter)}/scene`], scene));
  }

  loadEmotions(): Promise<Map<string, Map<string, string[]>>> {
    if (!this.emotions) {
      const pending = bml(this.library, [SCENE_ROOT], "emotion").then(readStoryEmotions);
      this.emotions = pending;
      pending.catch(() => { if (this.emotions === pending) this.emotions = undefined; });
    }
    return this.emotions;
  }

  /** The rival's ghost recording, kept beside drive.bml. */
  async loadGhost(chapter: string, step: StoryStep, ksv: string): Promise<Uint8Array> {
    return file(this.library, [`${chapterRoot(chapter)}/${step.readyStage}`, chapterRoot(chapter)],
      ksv, ".ksv").bytes();
  }

  hasFile(roots: string[], name: string, extension: string): boolean {
    try {
      file(this.library, roots, name, extension);
      return true;
    } catch {
      return false;
    }
  }
}
