import { schedulePresentationFrame, type PresentationLoopPresenter } from "./presentation-scheduler";

export interface PresentationFrame {
  nowMs: number;
  rawMs: number;
}

export interface FramePresenter extends PresentationLoopPresenter {
  host: {
    gameOptions?: { verticalSync?: boolean };
    workProfiler?: {
      begin(atMs: number): void;
      mark(name: string, atMs: number): void;
      end(atMs: number): void;
      summary(): unknown;
    };
    renderer: {
      info: {
        reset(): void;
        render: { calls: number; triangles: number; lines: number; points: number; frame: number };
      };
    };
    touchControls: {
      setRaceState(driving: boolean, paused: boolean, dodge: boolean): void;
    };
    input: { isEnabled: boolean };
    shell: { started: boolean; halted?: boolean };
    session: { lifecycle: unknown };
    paused: boolean;
    ready: { updateWindowNotice(nowMs: number): void };
    hud: {
      updateEngine(fps: number): void;
      recordPerformanceFrame(
        frameMs: number,
        renderMs: number,
        startedAtMs: number,
        summary: unknown,
      ): void;
    };
    engineRenderStats: {
      calls: number;
      triangles: number;
      lines: number;
      points: number;
      frame: number;
    };
    haltRuntime(error: unknown, nowMs: number): void;
  };
  multiplayerStage?: { touchDrivingAvailable: boolean; touchDodgeEnabled: boolean };
  previousRenderTime: number;
  /** Simulated time since the last presented frame; the FPS counts presented frames. */
  unpresentedSeconds?: number;
  /** Set for a display refresh in an already simulated millisecond: draw only. */
  redrawOnly?: boolean;
  frameTimeSeconds: number;
  fps: number;
  nextFrameCallbacks: Array<{ run(): void; reject(error: unknown): void }>;
  stages: {
    currentName?: string;
    enter(): void;
    update(frame: PresentationFrame): void;
    render(): void;
  };
  frame(nowMs: number): void;
  animationFrame: number;
}

export interface FrameLoopDependencies {
  nowMs(): number;
  isRaceFinished(lifecycle: unknown): boolean;
  requestFrame(callback: (nowMs: number) => void): number;
}

export interface AnimationFramePresenter extends PresentationLoopPresenter {
  maxRafDelayMs: number;
  lastUpdateMs: number;
  redrawOnly?: boolean;
  animationFrame: number;
  frame(nowMs: number): void;
  updateAndRender(nowMs: number): void;
}

/**
 * Skip a duplicate simulation millisecond while retaining the largest observed
 * delay. A display refresh in that millisecond still draws the current state.
 */
export function advancePresentationFrame(
  presenter: AnimationFramePresenter,
  scheduledAtMs: number | undefined,
  dependencies: Pick<FrameLoopDependencies, "nowMs" | "requestFrame"> &
    Partial<Pick<FrameLoopDependencies, "isRaceFinished">>,
): void {
  if (presenter.presentationDisposed || presenter.presentationScheduler?.disposed) return;
  const now = dependencies.nowMs();
  if (typeof scheduledAtMs === "number") {
    presenter.maxRafDelayMs = Math.max(
      presenter.maxRafDelayMs,
      Math.max(0, now - scheduledAtMs),
    );
  }
  if ((Math.trunc(now) >>> 0) === presenter.lastUpdateMs) {
    const scheduler = presenter.presentationScheduler;
    if (!scheduler?.lastFrameUnlocked || !scheduler.lastFramePresents) {
      schedulePresentationFrame(presenter, dependencies);
      return;
    }
    presenter.redrawOnly = true;
  } else {
    presenter.lastUpdateMs = Math.trunc(dependencies.nowMs()) >>> 0;
  }
  presenter.updateAndRender(now);
}

/**
 * Run one frame and schedule the next one. Frames between display refreshes only
 * advance the stages; a refresh advances, draws and settles queued callbacks.
 */
export function renderPresentationFrame(
  presenter: FramePresenter,
  startedAtMs: number,
  dependencies: FrameLoopDependencies,
): void {
  if (presenter.presentationDisposed || presenter.presentationScheduler?.disposed) return;
  const { host } = presenter;
  const presents = presenter.presentationScheduler?.lastFramePresents ?? true;
  const advances = presenter.redrawOnly !== true;
  presenter.redrawOnly = false;
  host.workProfiler?.begin(startedAtMs);
  const nowMs = Math.trunc(dependencies.nowMs()) >>> 0;
  if (presents) host.renderer.info.reset();
  let frameMs = 0;
  try {
    let elapsedSeconds = 0;
    if (advances) {
      const nowSeconds = nowMs / 1000;
      elapsedSeconds = Math.max(0, nowSeconds - presenter.previousRenderTime);
      presenter.previousRenderTime = nowSeconds;
      presenter.frameTimeSeconds = elapsedSeconds;
      host.touchControls.setRaceState(
        presenter.multiplayerStage
          ? host.input.isEnabled && presenter.multiplayerStage.touchDrivingAvailable
          : host.shell.started && host.input.isEnabled &&
            !dependencies.isRaceFinished(host.session.lifecycle),
        !presenter.multiplayerStage && host.paused,
        presenter.multiplayerStage?.touchDodgeEnabled ?? false,
      );
      host.ready.updateWindowNotice(nowMs);
    }
    const presentSeconds = (presenter.unpresentedSeconds ?? 0) + elapsedSeconds;
    presenter.unpresentedSeconds = presents ? 0 : presentSeconds;
    if (presents) {
      frameMs = presentSeconds * 1000;
      presenter.fps += (1 / Math.max(presentSeconds, 0.001) - presenter.fps) *
        (1 - Math.exp(-3 * presentSeconds));
    }
    if (advances) {
      host.workProfiler?.mark("prep", dependencies.nowMs());
      presenter.stages.enter();
      const frame = { nowMs, rawMs: nowMs };
      presenter.stages.update(frame);
    }
    if (presents) {
      presenter.stages.render();
      host.hud.updateEngine(presenter.fps);
      if (presenter.nextFrameCallbacks.length > 0) {
        for (const callback of presenter.nextFrameCallbacks.splice(0)) callback.run();
      }
    }
  } catch (error) {
    for (const callback of presenter.nextFrameCallbacks.splice(0)) callback.reject(error);
    host.haltRuntime(error, nowMs);
  } finally {
    host.workProfiler?.mark("tail", dependencies.nowMs());
    host.workProfiler?.end(dependencies.nowMs());
    if (presents) {
      const render = host.renderer.info.render;
      host.engineRenderStats.calls = render.calls;
      host.engineRenderStats.triangles = render.triangles;
      host.engineRenderStats.lines = render.lines;
      host.engineRenderStats.points = render.points;
      host.engineRenderStats.frame = render.frame;
      host.hud.recordPerformanceFrame(
        frameMs,
        dependencies.nowMs() - startedAtMs,
        startedAtMs,
        host.workProfiler?.summary(),
      );
    }
    schedulePresentationFrame(presenter, dependencies);
  }
}
