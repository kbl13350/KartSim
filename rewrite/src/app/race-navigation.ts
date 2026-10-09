import { storyRaceOf, storyRaceOutcome } from "../story/story-race";
import type { ReadySelection } from "../timeattack/ready-flow";

interface Disposable {
  dispose(): void;
}

/** The services the race builder receives from the application shell. */
export interface RaceBuilderContext {
  session: unknown;
  audio: unknown;
  cameras: unknown;
  scene: unknown;
  toonStageBinding: unknown;
  tachometerGaugePreserve: unknown;
  hud: unknown;
  input: unknown;
  shell: unknown;
  ready: unknown;
  presenter: unknown;
  library: unknown;
  getRaceBuilder(): unknown;
  getReadyOptions(): unknown;
  getLocalNickname(): unknown;
  replaceTrack(track: unknown): void;
  applyRaceOptions(options: unknown): void;
  setPaused(paused: boolean): void;
}

export interface RaceApplication {
  root: HTMLElement;
  session: unknown;
  audio: {
    context?: { resume(): Promise<unknown> };
  };
  cameras: unknown;
  scene: unknown;
  toonStageBinding: {
    prepareCoatingStage(): Disposable;
  };
  tachometerGaugePreserve: unknown;
  hud: {
    showDebugText(message: string, kind: string): void;
  };
  input: unknown;
  shell: {
    started: boolean;
  };
  ready: unknown;
  presenter: {
    afterNextFrame<T>(callback: () => T): Promise<T>;
  };
  replayLibrary: unknown;
  raceBuilder: unknown;
  timeAttackReadyOptions: unknown;
  localNickname: unknown;
  paused: boolean;
  racePageTransition: boolean;
  replaceTrack(track: unknown): void;
  applyRaceOptions(options: unknown): void;
  enterTimeAttackReady(): Promise<unknown>;
}

export type RaceBuilder = (
  context: RaceBuilderContext,
  selection: ReadySelection,
  coatingStage: Disposable,
) => Promise<unknown>;

/** Prepare the temporary coating stage and always release it after race load. */
export function startSinglePlayerRace(
  application: RaceApplication,
  selection: ReadySelection,
  buildRace: RaceBuilder,
): Promise<unknown> {
  const coatingStage = application.toonStageBinding.prepareCoatingStage();
  return buildRace({
    session: application.session,
    audio: application.audio,
    cameras: application.cameras,
    scene: application.scene,
    toonStageBinding: application.toonStageBinding,
    tachometerGaugePreserve: application.tachometerGaugePreserve,
    hud: application.hud,
    input: application.input,
    shell: application.shell,
    ready: application.ready,
    presenter: application.presenter,
    library: application.replayLibrary,
    getRaceBuilder: () => application.raceBuilder,
    getReadyOptions: () => application.timeAttackReadyOptions,
    getLocalNickname: () => application.localNickname,
    replaceTrack: track => application.replaceTrack(track),
    applyRaceOptions: options => application.applyRaceOptions(options),
    setPaused: paused => { application.paused = paused; },
  }, selection, coatingStage).finally(() => coatingStage.dispose());
}

/** Move from a running race back to Ready behind the same page curtain. */
export async function returnToReady(
  application: RaceApplication,
  createCurtain: (root: HTMLElement) => () => void,
): Promise<void> {
  if (application.racePageTransition) return;
  application.racePageTransition = true;
  let closeCurtain: (() => void) | undefined;
  try {
    if (application.shell.started) {
      closeCurtain = await application.presenter.afterNextFrame(
        () => createCurtain(application.root),
      );
    }
    await application.audio.context?.resume();
    // A story race goes back to story mode with its outcome; Ready is rebuilt
    // underneath with the player's own kart and rider.
    const session = application.session as { selection?: unknown } | undefined;
    const story = storyRaceOf(session?.selection);
    const outcome = story ? storyRaceOutcome(session) : undefined;
    story?.restore();
    await application.enterTimeAttackReady();
    if (story && outcome) story.onReturn(outcome);
  } catch (error) {
    application.hud.showDebugText(
      `Ready stage fail-closed：${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  } finally {
    closeCurtain?.();
    application.racePageTransition = false;
  }
}
