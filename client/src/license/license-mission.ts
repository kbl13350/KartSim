/**
 * The 驾照考试 mission inside a race, next to the mission timer
 * (license-race.ts): what the step asks besides reaching the goal, the
 * course's tutorial hints, and ending the race when the mission is done.
 *
 * - 行驶练习 (mission 0, village_C005): the release RiderSchoolSpeedStage
 *   key drill. The briefing (stage_riderSchoolReady stage_stringBag 38-45)
 *   and the tip (challengeTip riderSchoolScene 3-24) name four prompts,
 *   向前 / 向后 / 右转 / 左转 (stage_common action 앞으로1, 뒤로1, 오른쪽1,
 *   왼쪽1), each answered with ok (成功); doing all four clears the step.
 *   What answers a prompt is not in the data [还原: holding the keys with
 *   the kart moving that way for DRILL_HOLD_MS].
 * - Tutorial points: a course's <eventList> names the hint scene of each
 *   event:* point (turnLeft → 좌회전, driftLeft → 좌드립, booster → 아이템…);
 *   entering the point plays it.
 * - Item missions (rule item): the item race (license-item-race.ts) owns the
 *   objective; it fires the scripted attacks of the event:* points, asks for
 *   the hints its stage plays on events (sheild as a water fly comes,
 *   shakeHit when the kart is trapped) and ends 导弹练习 when its board is down.
 */
import type { LicenseRule, LicenseStepSetup } from "./license-api";
import type { LicenseScenes } from "./license-scenes";
import { storyRaceOf } from "../story/story-race";
import { licenseItemsOf } from "./license-item-race";

/** What the license race carries in the race selection (story.license). */
export interface LicenseMissionSpec {
  step: number;
  /** The release mission id (0 行驶练习, 20 time trial, 21 duel, others item missions). */
  mission: number;
  /** The step's clear rule; "item" races with items (license-item-race.ts). */
  rule?: LicenseRule;
  setup: LicenseStepSetup;
  /**
   * Set by the race: the step's own objective (besides the goal and the time)
   * is met, and why not when it is not (an item mission's targets).
   */
  progress: { objective: boolean; failure?: string };
}

/** One frame of what the drill reads. `steer` > 0 is left (DrivingInputAccumulator rawSteer). */
export interface DrillInput {
  forward: boolean;
  reverse: boolean;
  steer: number;
  /** Local forward speed (route units per second; negative backwards). */
  speed: number;
}

/** Held this long (with the kart moving the asked way) a prompt is answered [还原]. */
export const DRILL_HOLD_MS = 800;
/** Faster than this the kart counts as moving [还原]. */
const MOVING = 1.5;

export const DRILL_PROMPTS: ReadonlyArray<{ scene: string; text: string; answered(input: DrillInput): boolean }> = [
  { scene: "앞으로1@zz", text: "向前", answered: input => input.forward && !input.reverse && input.speed > MOVING },
  { scene: "뒤로1@zz", text: "向后", answered: input => input.reverse && !input.forward && input.speed < -MOVING },
  { scene: "오른쪽1@zz", text: "右转", answered: input => input.forward && input.steer < 0 && input.speed > MOVING },
  { scene: "왼쪽1@zz", text: "左转", answered: input => input.forward && input.steer > 0 && input.speed > MOVING },
];
export const DRILL_OK_SCENE = "ok@zz";
/** The ok (成功) beat between prompts when its scene is missing. */
const OK_FALLBACK_MS = 1_000;

export type DrillEvent =
  | { kind: "prompt"; index: number }
  | { kind: "ok"; index: number }
  | { kind: "done" };

/** The four-prompt key drill as a clock-driven state machine. */
export class KeyDrill {
  index = 0;
  private heldMs = 0;
  private lastMs?: number;
  /** While the ok beat of the prompt just answered plays: until when. */
  private okUntil?: number;
  done = false;

  constructor(private readonly okMs: number = OK_FALLBACK_MS) {}

  /** Advances to `nowMs`; returns what to show when it changes. */
  update(input: DrillInput, nowMs: number): DrillEvent | undefined {
    const dt = this.lastMs === undefined ? 0 : Math.max(0, Math.min(250, nowMs - this.lastMs));
    this.lastMs = nowMs;
    if (this.done) return undefined;
    if (this.okUntil !== undefined) {
      if (nowMs < this.okUntil) return undefined;
      this.okUntil = undefined;
      if (this.index >= DRILL_PROMPTS.length) {
        this.done = true;
        return { kind: "done" };
      }
      return { kind: "prompt", index: this.index };
    }
    if (DRILL_PROMPTS[this.index]!.answered(input)) this.heldMs += dt;
    if (this.heldMs < DRILL_HOLD_MS) return undefined;
    const answered = this.index;
    this.index += 1;
    this.heldMs = 0;
    this.okUntil = nowMs + this.okMs;
    return { kind: "ok", index: answered };
  }
}

interface MissionLifecycle {
  phase: number;
  startAtMs: number;
  finishAtMs: number;
  effectiveTime(rawNowMs: number): number;
  forceFinish?(rawNowMs: number, result: { failed: boolean }): unknown[];
}

export interface LicenseMissionStage {
  host: {
    paused: boolean;
    session: { selection?: unknown; lifecycle: MissionLifecycle };
    drivingInput?: { snapshot(): { forward: number; reverse: number; rawSteer: number } };
    getPhysics(): { runtime?: { localForwardSpeed?: number } };
    getTrack(): { data?: { licenseEvents?: ReadonlyMap<string, string> } };
    handleTimeAttackActions?(actions: unknown[], rawNowMs: number): void;
  };
  ui?: { action2D?: { licenseScenes?: LicenseScenes } };
}

/** The license spec of a race selection, if it is a 驾照考试 race. */
export function licenseMissionOf(selection: unknown): LicenseMissionSpec | undefined {
  const story = storyRaceOf(selection) as { license?: LicenseMissionSpec } | undefined;
  return story?.license;
}

/** The hint and prompt scenes a step plays, for the race to preload. */
export function licenseSceneNames(spec: LicenseMissionSpec,
  events: ReadonlyMap<string, string> | undefined): string[] {
  const names = new Set<string>(events?.values() ?? []);
  if (spec.mission === 0) {
    for (const prompt of DRILL_PROMPTS) names.add(prompt.scene);
    names.add(DRILL_OK_SCENE);
  }
  if (spec.setup.startTutoScene) names.add(spec.setup.startTutoScene);
  return [...names];
}

class LicenseMissionRun {
  readonly drill?: KeyDrill;
  private started = false;

  constructor(readonly spec: LicenseMissionSpec, scenes: LicenseScenes | undefined) {
    // An item mission's objective belongs to its item race.
    if (spec.rule !== "item") spec.progress.objective = false;
    if (spec.mission === 0) {
      const okMs = scenes?.duration(DRILL_OK_SCENE) || OK_FALLBACK_MS;
      this.drill = new KeyDrill(okMs);
    }
  }

  update(stage: LicenseMissionStage, rawNowMs: number): void {
    const { host } = stage;
    const lifecycle = host.session.lifecycle;
    const scenes = stage.ui?.action2D?.licenseScenes;
    const nowMs = lifecycle.effectiveTime(rawNowMs);
    // The race is over (goal, time out, or the mission's own end).
    if (lifecycle.finishAtMs !== 0) {
      if (scenes?.playing && scenes.playing !== DRILL_OK_SCENE) scenes.stop();
      return;
    }
    if (lifecycle.phase !== 2 || lifecycle.startAtMs === 0 || host.paused) return;
    if (!this.started) {
      this.started = true;
      if (this.drill) scenes?.play(DRILL_PROMPTS[0]!.scene, nowMs, true);
      else if (this.spec.setup.startTutoScene) scenes?.play(this.spec.setup.startTutoScene, nowMs);
    }
    const items = licenseItemsOf(host.session);
    if (items) {
      const events = host.getTrack().data?.licenseEvents;
      for (const name of items.consumeHints()) {
        const scene = events?.get(name);
        if (scene) scenes?.play(scene, nowMs);
      }
      if (items.consumeClear()) this.clear(stage, rawNowMs);
      return;
    }
    if (!this.drill) return;
    const input = host.drivingInput?.snapshot();
    const event = this.drill.update({
      forward: (input?.forward ?? 0) > 0, reverse: (input?.reverse ?? 0) > 0,
      steer: input?.rawSteer ?? 0, speed: host.getPhysics().runtime?.localForwardSpeed ?? 0,
    }, nowMs);
    if (!event) return;
    if (event.kind === "ok") scenes?.play(DRILL_OK_SCENE, nowMs);
    else if (event.kind === "prompt") scenes?.play(DRILL_PROMPTS[event.index]!.scene, nowMs, true);
    else {
      // 行驶练习 is done: the step clears here, wherever the kart is.
      this.spec.progress.objective = true;
      this.clear(stage, rawNowMs);
    }
  }

  /**
   * The step is done before the goal: the race ends cleared, unless its time
   * ran out first (the timer is checked after the mission in a frame).
   */
  private clear(stage: LicenseMissionStage, rawNowMs: number): void {
    const { host } = stage;
    const lifecycle = host.session.lifecycle;
    const limitMs = storyRaceOf(host.session.selection)?.timeLimitMs ?? 0;
    const late = limitMs > 0 && lifecycle.effectiveTime(rawNowMs) - lifecycle.startAtMs > limitMs;
    const actions = lifecycle.forceFinish?.(rawNowMs, { failed: late }) ?? [];
    if (actions.length) host.handleTimeAttackActions?.(actions, rawNowMs);
  }

  routeTag(stage: LicenseMissionStage, tag: string, rawNowMs: number): void {
    const match = /^event:(\w+):in:next$/.exec(tag);
    if (!match) return;
    licenseItemsOf(stage.host.session)?.routeTag(tag);
    const scene = stage.host.getTrack().data?.licenseEvents?.get(match[1]!);
    const scenes = stage.ui?.action2D?.licenseScenes;
    // A drill prompt is not interrupted by a hint.
    if (!scene || !scenes || this.drill) return;
    scenes.play(scene, stage.host.session.lifecycle.effectiveTime(rawNowMs));
  }
}

const runs = new WeakMap<object, LicenseMissionRun>();

function runOf(stage: LicenseMissionStage): LicenseMissionRun | undefined {
  const spec = licenseMissionOf(stage.host.session.selection);
  if (!spec) return undefined;
  const lifecycle = stage.host.session.lifecycle;
  let run = runs.get(lifecycle);
  if (!run || run.spec !== spec) {
    run = new LicenseMissionRun(spec, stage.ui?.action2D?.licenseScenes);
    runs.set(lifecycle, run);
  }
  return run;
}

/** Per frame, after driving: the step's own mission. No-op outside 驾照考试. */
export function updateLicenseMission(stage: LicenseMissionStage, rawNowMs: number): void {
  runOf(stage)?.update(stage, rawNowMs);
}

/** A route tag of a license course (event:* points are only admitted there). */
export function licenseRouteTag(stage: LicenseMissionStage, tag: string, rawNowMs: number): void {
  runOf(stage)?.routeTag(stage, tag, rawNowMs);
}
