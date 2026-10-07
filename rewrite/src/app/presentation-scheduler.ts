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

/** Owns one cancellable presentation request, independently of the physics clock. */
export class PresentationScheduler {
  private nextId = 0;
  private pending?: { id: number; handle: number; unlocked: boolean };
  private lastTaskAtMs = -Infinity;
  disposed = false;
  lastFrameUnlocked = false;

  constructor(private readonly environment: PresentationSchedulerEnvironment) {}

  request(callback: PresentationCallback, unlocked: boolean): number {
    if (this.disposed) return 0;
    if (this.pending) return this.pending.id;
    const id = ++this.nextId;
    this.enqueue(id, callback, unlocked && this.environment.isVisible());
    return id;
  }

  private enqueue(id: number, callback: PresentationCallback, unlocked: boolean): void {
    const deliver = (atMs?: number) => {
      if (this.disposed || this.pending?.id !== id) return;
      this.pending = undefined;
      // A tab can become hidden after an asynchronous task has already been posted.
      if (unlocked && !this.environment.isVisible()) {
        this.enqueue(id, callback, false);
        return;
      }
      const nowMs = this.environment.nowMs();
      this.lastFrameUnlocked = unlocked;
      if (unlocked) this.lastTaskAtMs = nowMs;
      callback(atMs ?? nowMs);
    };
    // The simulation deliberately ignores duplicate integer milliseconds. Avoid
    // filling the task queue with frames that cannot advance that clock.
    const delayMs = Math.max(0, 1 - (this.environment.nowMs() - this.lastTaskAtMs));
    const handle = unlocked
      ? this.environment.requestTask(() => deliver(), delayMs)
      : this.environment.requestFrame(deliver);
    this.pending = { id, handle, unlocked };
  }

  cancel(): void {
    const pending = this.pending;
    this.pending = undefined;
    if (!pending) return;
    if (pending.unlocked) this.environment.cancelTask(pending.handle);
    else this.environment.cancelFrame(pending.handle);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancel();
    this.environment.disposeTasks?.();
  }
}

/** Message tasks yield to input and rendering without waiting for display refresh. */
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
