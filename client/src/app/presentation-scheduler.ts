export type PresentationCallback = (nowMs: number) => void;

export interface PresentationSchedulerEnvironment {
  nowMs(): number;
  isVisible(): boolean;
  requestFrame(callback: PresentationCallback): number;
  cancelFrame(id: number): void;
  requestTask(callback: () => void, delayMs: number): number;
  cancelTask(id: number): void;
  disposeTasks?(): void;
}

/**
 * Owns one cancellable presentation request, independently of the physics clock.
 * Unlocked requests are delivered by message tasks between display refreshes and
 * by the next display refresh, whichever comes first; only the latter presents.
 */
export class PresentationScheduler {
  private nextId = 0;
  private nextFrameToken = 0;
  private pending?: { id: number; callback: PresentationCallback; unlocked: boolean; task?: number };
  private displayFrame?: { token: number; handle: number };
  private lastTaskAtMs = -Infinity;
  disposed = false;
  lastFrameUnlocked = false;
  /** Whether the frame being delivered runs in a display refresh and should draw. */
  lastFramePresents = true;

  constructor(private readonly environment: PresentationSchedulerEnvironment) {}

  request(callback: PresentationCallback, unlocked: boolean): number {
    if (this.disposed) return 0;
    if (this.pending) return this.pending.id;
    const id = ++this.nextId;
    const pending = { id, callback, unlocked: unlocked && this.environment.isVisible() };
    this.pending = pending;
    if (pending.unlocked) this.postTask(pending);
    this.requestDisplayFrame();
    return id;
  }

  private postTask(pending: { id: number; task?: number }): void {
    // The simulation deliberately ignores duplicate integer milliseconds. Avoid
    // filling the task queue with frames that cannot advance that clock.
    const delayMs = Math.max(0, 1 - (this.environment.nowMs() - this.lastTaskAtMs));
    pending.task = this.environment.requestTask(() => this.deliverTask(pending.id), delayMs);
  }

  /** A pending refresh survives task deliveries, so each refresh presents once. */
  private requestDisplayFrame(): void {
    if (this.displayFrame) return;
    const token = ++this.nextFrameToken;
    const handle = this.environment.requestFrame(atMs => {
      if (this.displayFrame?.token !== token) return;
      this.displayFrame = undefined;
      this.deliverDisplayFrame(atMs);
    });
    this.displayFrame = { token, handle };
  }

  private deliverTask(id: number): void {
    const pending = this.pending;
    if (this.disposed || pending?.id !== id) return;
    pending.task = undefined;
    // A tab can become hidden after an asynchronous task has already been posted;
    // the display refresh that is still pending delivers the frame instead.
    if (!this.environment.isVisible()) {
      pending.unlocked = false;
      return;
    }
    this.pending = undefined;
    const nowMs = this.environment.nowMs();
    this.lastFrameUnlocked = true;
    this.lastFramePresents = false;
    this.lastTaskAtMs = nowMs;
    pending.callback(nowMs);
  }

  private deliverDisplayFrame(atMs: number): void {
    const pending = this.pending;
    if (this.disposed || !pending) return;
    if (pending.task !== undefined) this.environment.cancelTask(pending.task);
    this.pending = undefined;
    this.lastFrameUnlocked = pending.unlocked;
    this.lastFramePresents = true;
    if (pending.unlocked) this.lastTaskAtMs = this.environment.nowMs();
    pending.callback(atMs);
  }

  cancel(): void {
    const pending = this.pending;
    const displayFrame = this.displayFrame;
    this.pending = undefined;
    this.displayFrame = undefined;
    if (pending?.task !== undefined) this.environment.cancelTask(pending.task);
    if (displayFrame) this.environment.cancelFrame(displayFrame.handle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.environment.disposeTasks?.();
  }
}

/** Message tasks advance between display refreshes and yield to input and rendering. */
export function createBrowserPresentationScheduler(): PresentationScheduler {
  const channel = typeof MessageChannel === "undefined" ? undefined : new MessageChannel();
  const tasks = new Map<number, { callback: () => void; timer?: ReturnType<typeof setTimeout> }>();
  let nextTask = 0;
  const runTask = (id: number) => {
    const task = tasks.get(id);
    if (!task) return;
    tasks.delete(id);
    task.callback();
  };
  if (channel) channel.port1.onmessage = event => runTask(event.data as number);
  return new PresentationScheduler({
    nowMs: () => performance.now(),
    isVisible: () => document.visibilityState !== "hidden",
    requestFrame: callback => requestAnimationFrame(callback),
    cancelFrame: id => cancelAnimationFrame(id),
    requestTask(callback, delayMs) {
      const id = ++nextTask;
      const task: { callback: () => void; timer?: ReturnType<typeof setTimeout> } = { callback };
      tasks.set(id, task);
      const post = () => {
        if (!tasks.has(id)) return;
        if (channel) channel.port2.postMessage(id);
        else runTask(id);
      };
      // Even the timer path posts through the channel, avoiding nested timer
      // clamping on browsers that support MessageChannel.
      if (delayMs > 0 || !channel) task.timer = setTimeout(post, delayMs);
      else post();
      return id;
    },
    cancelTask(id) {
      const task = tasks.get(id);
      if (task?.timer !== undefined) clearTimeout(task.timer);
      tasks.delete(id);
    },
    disposeTasks() {
      for (const task of tasks.values()) {
        if (task.timer !== undefined) clearTimeout(task.timer);
      }
      tasks.clear();
      channel?.port1.close();
      channel?.port2.close();
    },
  });
}

export interface PresentationLoopPresenter {
  presentationScheduler?: PresentationScheduler;
  presentationDisposed?: boolean;
  animationFrame: number;
  frame: PresentationCallback;
  host?: {
    gameOptions?: { verticalSync?: boolean };
    paused: boolean;
    shell: { started: boolean; halted?: boolean };
    session: { lifecycle: unknown };
  };
  stages?: { currentName?: string };
  multiplayerStage?: { touchDrivingAvailable: boolean };
}

interface PresentationSchedulingDependencies {
  requestFrame(callback: PresentationCallback): number;
  isRaceFinished?(lifecycle: unknown): boolean;
  createScheduler?(): PresentationScheduler;
}

export function isPresentationUnlocked(
  presenter: PresentationLoopPresenter,
  isRaceFinished?: (lifecycle: unknown) => boolean,
): boolean {
  const host = presenter.host;
  if (!host || host.gameOptions?.verticalSync === true || host.paused || host.shell.halted) return false;
  if (presenter.stages?.currentName === "MultiplayerDrivingStage") {
    return presenter.multiplayerStage?.touchDrivingAvailable === true;
  }
  return presenter.stages?.currentName === "TimeAttackStage" && host.shell.started &&
    !isRaceFinished?.(host.session.lifecycle);
}

export function schedulePresentationFrame(
  presenter: PresentationLoopPresenter,
  dependencies: PresentationSchedulingDependencies,
): void {
  if (presenter.presentationDisposed) {
    presenter.animationFrame = 0;
    return;
  }
  presenter.animationFrame = presenter.presentationScheduler
    ? presenter.presentationScheduler.request(presenter.frame,
      isPresentationUnlocked(presenter, dependencies.isRaceFinished))
    : dependencies.requestFrame(presenter.frame);
}

export function startPresentationLoop(
  presenter: PresentationLoopPresenter,
  dependencies: PresentationSchedulingDependencies,
): void {
  if (presenter.presentationDisposed) return;
  presenter.presentationScheduler ??= dependencies.createScheduler?.() ?? createBrowserPresentationScheduler();
  schedulePresentationFrame(presenter, dependencies);
}

export function disposePresentationLoop(
  presenter: PresentationLoopPresenter & {
    nextFrameCallbacks: Array<{ reject(error: unknown): void }>;
  },
): void {
  // Keep an explicit guard even if disposal happens before the first start.
  presenter.presentationDisposed = true;
  presenter.presentationScheduler?.dispose();
  presenter.animationFrame = 0;
  for (const callback of presenter.nextFrameCallbacks.splice(0)) {
    callback.reject(new Error("页面已关闭。"));
  }
}
