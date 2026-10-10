import type { StoryChapter, StoryStep } from "./story-data";

/**
 * Cleared story steps per chapter. The release kept these on its servers;
 * the Web build keeps them in this browser.
 */
export interface StoryProgress {
  cleared: Record<string, number[]>;
}

const STORAGE_KEY = "kartsim.story.v1";

export function emptyStoryProgress(): StoryProgress {
  return { cleared: {} };
}

export function parseStoryProgress(raw: string | null | undefined): StoryProgress {
  if (!raw) return emptyStoryProgress();
  try {
    const value = JSON.parse(raw) as { cleared?: unknown };
    const cleared: Record<string, number[]> = {};
    if (value && typeof value.cleared === "object" && value.cleared) {
      for (const [chapter, steps] of Object.entries(value.cleared as Record<string, unknown>)) {
        if (Array.isArray(steps))
          cleared[chapter] = [...new Set(steps.filter(step => Number.isInteger(step)))] as number[];
      }
    }
    return { cleared };
  } catch {
    return emptyStoryProgress();
  }
}

export function loadStoryProgress(storage: Pick<Storage, "getItem"> | undefined =
  globalThis.localStorage): StoryProgress {
  try {
    return parseStoryProgress(storage?.getItem(STORAGE_KEY));
  } catch {
    return emptyStoryProgress();
  }
}

export function saveStoryProgress(progress: StoryProgress,
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress));
    return !!storage;
  } catch {
    return false;
  }
}

export function isStepCleared(progress: StoryProgress, chapter: string, step: number): boolean {
  return progress.cleared[chapter]?.includes(step) ?? false;
}

export function clearStoryStep(progress: StoryProgress, chapter: string,
  step: number): StoryProgress {
  if (isStepCleared(progress, chapter, step)) return progress;
  return { cleared: { ...progress.cleared,
    [chapter]: [...(progress.cleared[chapter] ?? []), step].sort((a, b) => a - b) } };
}

/** A step opens once one of its precondition steps is cleared. */
export function isStepOpen(progress: StoryProgress, chapter: string,
  step: Pick<StoryStep, "preConditionIds">): boolean {
  return step.preConditionIds.length === 0 ||
    step.preConditionIds.some(id => isStepCleared(progress, chapter, id));
}

/** A fork step closes once the step on its other branch is cleared. */
export function isStepLockedByOtherWay(progress: StoryProgress, chapter: string,
  step: Pick<StoryStep, "id" | "otherWayLockIds">): boolean {
  return !isStepCleared(progress, chapter, step.id) &&
    step.otherWayLockIds.some(id => isStepCleared(progress, chapter, id));
}

/** Playable now: its precondition is met and its fork has not gone the other way. */
export function isStepAvailable(progress: StoryProgress, chapter: string,
  step: Pick<StoryStep, "id" | "preConditionIds" | "otherWayLockIds">): boolean {
  return isStepOpen(progress, chapter, step) && !isStepLockedByOtherWay(progress, chapter, step);
}

/** The chapter's ending steps: isFinalStep, else the steps nothing depends on. */
export function finalStorySteps<Step extends Pick<StoryStep, "id" | "isFinalStep" | "preConditionIds">>(
  steps: readonly Step[]): Step[] {
  const finals = steps.filter(step => step.isFinalStep);
  return finals.length ? finals
    : steps.filter(step => !steps.some(other => other.preConditionIds.includes(step.id)));
}

/** Cleared once any ending step is: a fork's other branch never has to be played. */
export function isChapterCleared(progress: StoryProgress, chapter: string,
  steps: readonly Pick<StoryStep, "id" | "isFinalStep" | "preConditionIds">[]): boolean {
  return steps.length > 0 &&
    finalStorySteps(steps).some(step => isStepCleared(progress, chapter, step.id));
}

/** Steps on the shortest run to an ending: what "已完成 n / total" counts. */
export function requiredStepCount(
  steps: readonly Pick<StoryStep, "id" | "isFinalStep" | "preConditionIds">[]): number {
  const byId = new Map(steps.map(step => [step.id, step]));
  const memo = new Map<number, number>();
  const depth = (step: typeof steps[number], seen: Set<number>): number => {
    const known = memo.get(step.id);
    if (known !== undefined) return known;
    if (seen.has(step.id)) return 1;
    seen.add(step.id);
    const before = step.preConditionIds.map(id => byId.get(id))
      .filter((entry): entry is typeof step => !!entry).map(entry => depth(entry, seen));
    const value = 1 + (before.length ? Math.min(...before) : 0);
    memo.set(step.id, value);
    return value;
  };
  const finals = finalStorySteps(steps);
  return finals.length ? Math.min(...finals.map(step => depth(step, new Set()))) : steps.length;
}

/**
 * Multiplayer goal steps have no race here; once open they count as done so
 * the story behind them can go on.
 */
export function clearOpenMultiplayerSteps(progress: StoryProgress, chapter: string,
  steps: readonly Pick<StoryStep, "id" | "mode" | "preConditionIds" | "otherWayLockIds">[]):
  StoryProgress {
  let next = progress;
  for (let changed = true; changed;) {
    changed = false;
    for (const step of steps) {
      if (step.mode !== "multi" || isStepCleared(next, chapter, step.id) ||
          !isStepAvailable(next, chapter, step)) continue;
      next = clearStoryStep(next, chapter, step.id);
      changed = true;
    }
  }
  return next;
}

/**
 * Chapters open in story order: a chapter needs the one it names cleared;
 * the main storyline also needs the previous main chapter.
 */
export function isChapterOpen(progress: StoryProgress, chapter: StoryChapter,
  chapters: readonly StoryChapter[],
  stepsByChapter: ReadonlyMap<string, readonly Pick<StoryStep, "id" | "isFinalStep" |
    "preConditionIds">[]>): boolean {
  const done = (name: string): boolean => {
    const steps = stepsByChapter.get(name);
    return !!steps && isChapterCleared(progress, name, steps);
  };
  if (chapter.preClearChapterId !== undefined) {
    const before = chapters.find(entry => entry.id === chapter.preClearChapterId);
    if (before && !done(before.name)) return false;
  }
  if (chapter.regular) {
    const regular = chapters.filter(entry => entry.regular);
    const index = regular.findIndex(entry => entry.name === chapter.name);
    if (index > 0 && !done(regular[index - 1]!.name)) return false;
  }
  return true;
}
