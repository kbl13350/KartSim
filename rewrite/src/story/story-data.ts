/**
 * Release story mode (故事模式) data, zeta_cn_scenario.rho:
 * scenario.bml lists the chapters, each chapter folder holds
 * scenarioSteps.bml (the steps), scenarioSelect.bml (its map), one
 * <readyStage>/drive.bml per step (the race) and scene/<visualScene>.bml
 * (the dialogue played before the race).
 */

export interface StoryNode {
  name: string;
  attributes: Array<{ name: string; value: string }>;
  children: StoryNode[];
}

export interface StoryChapter {
  id: number;
  name: string;
  title: string;
  subTitle?: string;
  desc: string;
  /** 第一章…第四章, the main storyline. */
  regular: boolean;
  /** Chapter that has to be cleared first. */
  preClearChapterId?: number;
  /** showNewIcon: the release blinks NEW on the chapter card. */
  showNew: boolean;
}

export interface StoryStep {
  id: number;
  title: string;
  synopsis: string;
  howToClear: string;
  missionText: string;
  visualScene?: string;
  readyStage: string;
  /** preConditionId, "10|11" listing alternatives; empty when the step opens at once. */
  preConditionIds: number[];
  /** otherWayLockId: steps on the other branch of a fork. */
  otherWayLockIds: number[];
  /** isFinalStep: clearing it clears the chapter (forks skip the other branch). */
  isFinalStep: boolean;
  /** 30 drive, 31 knockout, 32 checkPoint, 34/35 aiKart, 36 item, 37 hold; 1/3/15 multiplayer goals. */
  type: number;
  /** "multi": a goal met in multiplayer races, with no race of its own here. */
  mode: "single" | "multi";
  /** Ending dialogue played after the step is cleared. */
  extraScene?: string;
  prize?: string;
  /** Step badge, stage_common scenario/step_<id>@zz ("01", "03A"…). */
  stepTitleId?: string;
}

/**
 * Race kinds: the element names of drive.bml, plus "CheckPoint"
 * (checkPoint.bml), "KnockOut" (knockout.bml) and "AiKart" (aiKart.bml).
 * Phase one runs TimeAttack and Shadow.
 */
export type StoryMissionKind = "TimeAttack" | "Shadow" | "Tracing" | "Escape" |
  "Delivery" | "ItemAttack" | "ItemAttackCheckPoint" | "CheckPoint" | "KnockOut" | "AiKart";

export interface StoryRival {
  kartId?: number;
  characterId?: number;
  name?: string;
  /** Ghost recording in the step folder, without ".ksv". */
  ksv: string;
}

export interface StoryMission {
  kind: StoryMissionKind | string;
  fixedKartId?: number;
  fixedCharId?: number;
  track: string;
  laps: number;
  /** Milliseconds; 0 or absent means no limit. */
  timeLimitMs: number;
  /** BaseParam gameSpeed in 国服 terms: 0 普通S1, 1 快速S2, 2 高速S3, 7 标准. */
  speed: number;
  rival?: StoryRival;
  /**
   * Tracing (追击) and Escape (逃脱): the rival's head start in ms of its
   * recording (negative: it sets off after the player) and the gap in metres
   * the mission allows.
   */
  chase?: { startOffsetMs: number; distanceM: number };
}

export const PLAYABLE_STORY_MISSIONS: ReadonlySet<string> = new Set(["TimeAttack", "Shadow"]);

export type StorySceneCommand =
  | { type: "background"; texture: string }
  | { type: "bgm"; theme?: string; file?: string }
  | { type: "char"; id: string; remove: boolean; x?: number; flip?: boolean; emotion?: string }
  | { type: "message"; name: string; text: string }
  | { type: "enter" }
  | { type: "shake"; timeMs: number }
  | { type: "sound"; file: string };

const attribute = (node: StoryNode, name: string): string | undefined =>
  node.attributes.find(entry => entry.name === name)?.value;

const integer = (value: string | undefined): number | undefined => {
  if (value === undefined || value.trim() === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
};

/** "10|11" or "09" → [10, 11] / [9]; "0" means no step. */
export function storyIdList(value: string | undefined): number[] {
  return (value ?? "").split("|").map(entry => entry.trim()).filter(Boolean)
    .map(Number).filter(id => Number.isInteger(id) && id > 0);
}

/** The release joins lines with "|". */
export function storyText(value: string | undefined): string {
  return (value ?? "").split("|").map(line => line.trim()).filter(Boolean).join("\n");
}

export function readStoryChapters(list: StoryNode): StoryChapter[] {
  const chapters: StoryChapter[] = [];
  for (const node of list.children) {
    if (node.name !== "Chapter" || attribute(node, "active") === "false") continue;
    const id = integer(attribute(node, "id"));
    const name = attribute(node, "name");
    if (id === undefined || !name) continue;
    chapters.push({
      id, name,
      title: attribute(node, "title") ?? name,
      subTitle: attribute(node, "subTitle"),
      desc: storyText(attribute(node, "desc")?.replace(/\n/g, "|")),
      regular: attribute(node, "regularChapter") === "true",
      preClearChapterId: integer(attribute(node, "preClearChapterId")),
      showNew: attribute(node, "showNewIcon") === "true",
    });
  }
  // Main storyline first, in chapter order; the rest newest first as released.
  const regular = chapters.filter(chapter => chapter.regular)
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true }));
  return [...regular, ...chapters.filter(chapter => !chapter.regular)];
}

export function readStorySteps(list: StoryNode): StoryStep[] {
  const steps: StoryStep[] = [];
  for (const node of list.children) {
    if (node.name !== "Step") continue;
    const id = integer(attribute(node, "id"));
    const readyStage = attribute(node, "readyStage");
    if (id === undefined || !readyStage) continue;
    const level = node.children.find(child => child.name === "Level");
    steps.push({
      id, readyStage,
      title: attribute(node, "title") ?? `${id}`,
      synopsis: storyText(attribute(node, "synopsis")),
      howToClear: storyText(attribute(node, "howToClear")),
      missionText: attribute(node, "missionText") ?? "",
      visualScene: attribute(node, "visualScene"),
      preConditionIds: storyIdList(attribute(node, "preConditionId")),
      otherWayLockIds: storyIdList(attribute(node, "otherWayLockId")),
      isFinalStep: attribute(node, "isFinalStep") === "true",
      type: integer(attribute(node, "type")) ?? 30,
      mode: attribute(node, "mode") === "multi" ? "multi" : "single",
      extraScene: attribute(node, "extraScene"),
      prize: level ? attribute(level, "prize") : undefined,
      stepTitleId: attribute(node, "stepTitleId"),
    });
  }
  return steps.sort((a, b) => a.id - b.id);
}

/**
 * The first race element and its level 0 content. checkPoint.bml and
 * knockout.bml keep the track and laps on the race element itself.
 */
export function readStoryMission(drive: StoryNode, kind?: StoryMissionKind): StoryMission {
  const race = drive.children.find(child => child.name !== "BaseParam");
  if (!race) throw new Error("故事关卡缺少比赛定义。");
  const content = race.children.find(child => child.name === "LevelContent" &&
    attribute(child, "level") === "0") ??
    race.children.find(child => child.name === "LevelContent");
  const track = (content && attribute(content, "track")) ?? attribute(race, "track");
  if (!track) throw new Error("故事关卡缺少赛道。");
  // Content first, then the race element, as the release files vary.
  const value = (key: string): string | undefined =>
    (content && attribute(content, key)) ?? attribute(race, key);
  const ksv = content && attribute(content, "ksv");
  const base = drive.children.find(child => child.name === "BaseParam");
  return {
    kind: kind ?? race.name,
    fixedKartId: attribute(race, "isFixedKart") === "true"
      ? integer(attribute(race, "fixedKartId")) : undefined,
    fixedCharId: attribute(race, "isFixedChar") === "true"
      ? integer(attribute(race, "fixedCharId")) : undefined,
    track,
    laps: integer(value("laps")) ?? 3,
    timeLimitMs: integer(value("timeLimit")) ?? 0,
    speed: integer(base && attribute(base, "gameSpeed")) ?? 0,
    chase: race.name === "Tracing" || race.name === "Escape" ? {
      startOffsetMs: integer(value("startOffset")) ?? 0,
      distanceM: integer(value("distance")) ?? 20,
    } : undefined,
    rival: ksv ? {
      ksv,
      kartId: integer(value("kartId")),
      characterId: integer(value("characterId")),
      name: value("characterName"),
    } : undefined,
  };
}

export function readStoryScene(scene: StoryNode): StorySceneCommand[] {
  const commands: StorySceneCommand[] = [];
  for (const node of scene.children) {
    switch (node.name) {
      case "BackGround": {
        const texture = attribute(node, "texture");
        if (texture) commands.push({ type: "background", texture });
        break;
      }
      case "Bgm":
        commands.push({ type: "bgm", theme: attribute(node, "theme"), file: attribute(node, "file") });
        break;
      case "Char": {
        const id = attribute(node, "id");
        if (!id) break;
        const x = Number(attribute(node, "pos")?.trim().split(/\s+/)[0]);
        commands.push({ type: "char", id, remove: attribute(node, "remove") === "true",
          x: Number.isFinite(x) ? x : undefined,
          flip: attribute(node, "flip") === undefined ? undefined : attribute(node, "flip") === "true",
          emotion: attribute(node, "emotion") });
        break;
      }
      case "Msg":
        commands.push({ type: "message", name: attribute(node, "name") ?? "",
          text: storyText(attribute(node, "string")) });
        break;
      case "Enter":
        commands.push({ type: "enter" });
        break;
      case "Shake":
        commands.push({ type: "shake", timeMs: integer(attribute(node, "time")) ?? 500 });
        break;
      case "fxSound": {
        const file = attribute(node, "file");
        if (file) commands.push({ type: "sound", file });
        break;
      }
    }
  }
  return commands;
}

/** emotion.bml: character id → emotion → sprite texture names. */
export function readStoryEmotions(root: StoryNode): Map<string, Map<string, string[]>> {
  const characters = new Map<string, Map<string, string[]>>();
  for (const character of root.children) {
    const emotions = new Map<string, string[]>();
    for (const emotion of character.children) {
      const textures = [attribute(emotion, "texture"), attribute(emotion, "texture2")]
        .filter((texture): texture is string => !!texture);
      if (textures.length) emotions.set(emotion.name, textures);
    }
    characters.set(character.name, emotions);
  }
  return characters;
}

/** One dialogue page: everything up to the next <Enter/>. */
export interface StoryScenePage {
  background?: string;
  characters: Array<{ id: string; x: number; flip: boolean; emotion: string }>;
  speaker: string;
  text: string;
  shakeMs?: number;
  sound?: string;
}

/** Fold the command list into pages the player clicks through. */
export function storyScenePages(commands: readonly StorySceneCommand[]): StoryScenePage[] {
  const pages: StoryScenePage[] = [];
  let background: string | undefined;
  const characters = new Map<string, { id: string; x: number; flip: boolean; emotion: string }>();
  let speaker = "";
  let text = "";
  let shakeMs: number | undefined;
  let sound: string | undefined;
  let pending = false;
  const flush = (): void => {
    if (!pending) return;
    pages.push({ background, characters: [...characters.values()].map(entry => ({ ...entry })),
      speaker, text, shakeMs, sound });
    shakeMs = undefined;
    sound = undefined;
    pending = false;
  };
  for (const command of commands) {
    switch (command.type) {
      case "background": background = command.texture; break;
      case "char":
        if (command.remove) characters.delete(command.id);
        else {
          const previous = characters.get(command.id);
          characters.set(command.id, {
            id: command.id,
            x: command.x ?? previous?.x ?? 7.5,
            flip: command.flip ?? previous?.flip ?? false,
            emotion: command.emotion ?? previous?.emotion ?? "normal",
          });
        }
        break;
      case "message": speaker = command.name; text = command.text; pending = true; break;
      case "shake": shakeMs = command.timeMs; break;
      case "sound": sound = command.file; break;
      case "enter": flush(); break;
    }
  }
  flush();
  return pages;
}
