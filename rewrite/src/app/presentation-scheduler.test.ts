import assert from "node:assert/strict";
import test from "node:test";
import { advancePresentationFrame, renderPresentationFrame, type FramePresenter } from "./frame-loop";
import {
  PresentationScheduler, createBrowserPresentationScheduler,
  disposePresentationLoop, isPresentationUnlocked,
  schedulePresentationFrame, startPresentationLoop,
  type PresentationLoopPresenter,
} from "./presentation-scheduler";

function harness() {
  let nowMs = 100;
  let visible = true;
  let nextId = 0;
  let disposals = 0;
  const frames = new Map<number, (atMs: number) => void>();
  const tasks = new Map<number, { callback: () => void; delayMs: number }>();
  const scheduler = new PresentationScheduler({
    nowMs: () => nowMs,
    isVisible: () => visible,
    requestFrame(callback) { const id = ++nextId; frames.set(id, callback); return id; },
    cancelFrame(id) { frames.delete(id); },
    requestTask(callback, delayMs) { const id = ++nextId; tasks.set(id, { callback, delayMs }); return id; },
    cancelTask(id) { tasks.delete(id); },
    disposeTasks() { disposals++; },
  });
  return {
    scheduler, frames, tasks,
    get disposals() { return disposals; },
    get now() { return nowMs; },
    setVisible(value: boolean) { visible = value; },
    setNow(value: number) { nowMs = value; },
    runTask() {
      const [id, task] = [...tasks][0]!;
      tasks.delete(id);
      nowMs += task.delayMs;
      task.callback();
    },
    runFrame() {
      const [id, callback] = [...frames][0]!;
      frames.delete(id);
      nowMs += 16;
      callback(nowMs);
    },
  };
}

function presenter(): PresentationLoopPresenter {
  return {
    animationFrame: 0,
    frame: () => undefined,
    host: { paused: false, shell: { started: true }, session: { lifecycle: {} } },
    stages: { currentName: "TimeAttackStage" },
  };
}

test("default race scheduling unlocks solo and multiplayer, retaining RAF for other states", () => {
  const target = presenter();
  assert.equal(isPresentationUnlocked(target), true);
  target.host!.gameOptions = { verticalSync: false };
  assert.equal(isPresentationUnlocked(target), true);
  target.host!.gameOptions.verticalSync = true;
  assert.equal(isPresentationUnlocked(target), false);
  target.host!.gameOptions.verticalSync = false;
  target.host!.paused = true;
  assert.equal(isPresentationUnlocked(target), false);
  target.host!.paused = false;
  target.host!.shell.halted = true;
  assert.equal(isPresentationUnlocked(target), false);
  target.host!.shell.halted = false;
  assert.equal(isPresentationUnlocked(target, () => true), false);
  target.host!.shell.started = false;
  assert.equal(isPresentationUnlocked(target), false);
  target.host!.shell.started = true;
  target.stages!.currentName = "TimeAttackReadyStage";
  assert.equal(isPresentationUnlocked(target), false);
  target.stages!.currentName = "MultiplayerDrivingStage";
  target.multiplayerStage = { touchDrivingAvailable: true };
  assert.equal(isPresentationUnlocked(target, () => true), true);
  target.multiplayerStage.touchDrivingAvailable = false;
  assert.equal(isPresentationUnlocked(target), false);
});

test("unlocked frames yield asynchronously and pace duplicate milliseconds", () => {
  const env = harness();
  const times: number[] = [];
  const presents: boolean[] = [];
  const callback = (atMs: number) => {
    times.push(atMs);
    presents.push(env.scheduler.lastFramePresents);
    if (times.length < 4) env.scheduler.request(callback, true);
  };
  const id = env.scheduler.request(callback, true);
  assert.equal(env.scheduler.request(callback, true), id);
  assert.equal(env.tasks.size, 1);
  assert.equal(env.frames.size, 1);
  assert.deepEqual(times, []);
  env.runTask();
  assert.equal([...env.tasks.values()][0]!.delayMs, 1);
  env.runTask();
  env.runTask();
  assert.equal(env.frames.size, 1);
  env.runFrame();
  assert.deepEqual(times, [100, 101, 102, 118]);
  assert.deepEqual(presents, [false, false, false, true]);
  assert.equal(env.scheduler.lastFrameUnlocked, true);
  assert.equal(env.tasks.size + env.frames.size, 0);
});

test("a display refresh delivers the pending unlocked frame and replaces its task", () => {
  const env = harness();
  let calls = 0;
  const callback = () => {
    calls++;
    env.scheduler.request(callback, true);
  };
  env.scheduler.request(callback, true);
  const staleTask = [...env.tasks.values()][0]!.callback;
  env.runFrame();
  assert.equal(calls, 1);
  assert.equal(env.scheduler.lastFramePresents, true);
  staleTask();
  assert.equal(calls, 1);
  assert.equal(env.tasks.size, 1);
  assert.equal(env.frames.size, 1);
  assert.equal([...env.tasks.values()][0]!.delayMs, 1);
});

test("hidden pages use RAF, including a task posted before visibility changes", () => {
  const env = harness();
  const times: number[] = [];
  env.scheduler.request(atMs => times.push(atMs), true);
  env.setVisible(false);
  env.runTask();
  assert.deepEqual(times, []);
  assert.equal(env.tasks.size, 0);
  assert.equal(env.frames.size, 1);
  env.runFrame();
  assert.deepEqual(times, [116]);
  assert.equal(env.scheduler.lastFrameUnlocked, false);
  env.scheduler.request(() => undefined, true);
  assert.equal(env.frames.size, 1);
  assert.equal(env.tasks.size, 0);
});

test("cancelling either backend invalidates stale callbacks and disposal cannot revive the loop", () => {
  for (const unlocked of [false, true]) {
    const env = harness();
    let calls = 0;
    env.scheduler.request(() => calls++, unlocked);
    const staleTask = [...env.tasks.values()][0]?.callback;
    const staleFrame = [...env.frames.values()][0];
    env.scheduler.cancel();
    if (unlocked) staleTask!();
    else staleFrame!(100);
    assert.equal(calls, 0);
    assert.equal(env.tasks.size + env.frames.size, 0);
    env.scheduler.request(() => {
      calls++;
      env.scheduler.dispose();
      assert.equal(env.scheduler.request(() => calls++, true), 0);
    }, unlocked);
    if (unlocked) env.runTask();
    else env.runFrame();
    env.scheduler.dispose();
    assert.equal(calls, 1);
    assert.equal(env.disposals, 1);
    assert.equal(env.tasks.size + env.frames.size, 0);
  }
});

test("start is idempotent and each next frame applies changed race/VSync state", () => {
  const env = harness();
  const target = presenter();
  const dependencies = {
    requestFrame: () => { throw new Error("unexpected legacy RAF"); },
    createScheduler: () => env.scheduler,
  };
  target.frame = () => schedulePresentationFrame(target, dependencies);
  startPresentationLoop(target, dependencies);
  startPresentationLoop(target, dependencies);
  assert.equal(env.tasks.size, 1);
  target.host!.paused = true;
  env.runTask();
  assert.equal(env.frames.size, 1);
  target.host!.paused = false;
  env.runFrame();
  assert.equal(env.tasks.size, 1);
  target.host!.gameOptions = { verticalSync: true };
  env.runTask();
  assert.equal(env.frames.size, 1);
  const rejected: unknown[] = [];
  const disposable = Object.assign(target, { nextFrameCallbacks: [{ reject: (error: unknown) => rejected.push(error) }] });
  disposePresentationLoop(disposable);
  startPresentationLoop(target, dependencies);
  assert.equal(env.frames.size + env.tasks.size, 0);
  assert.equal(target.animationFrame, 0);
  assert.equal(rejected.length, 1);
});

test("dispose before start avoids browser resources and prevents later starts", () => {
  const target = Object.assign(presenter(), { nextFrameCallbacks: [] });
  disposePresentationLoop(target);
  startPresentationLoop(target, {
    requestFrame: () => { throw new Error("disposed RAF"); },
    createScheduler: () => { throw new Error("disposed scheduler"); },
  });
  assert.equal(target.presentationScheduler, undefined);
});

test("duplicate milliseconds skip task frames, redraw on display refresh, and disposed callbacks do no work", () => {
  const env = harness();
  const frames: boolean[] = [];
  const target = Object.assign(presenter(), {
    presentationScheduler: env.scheduler,
    maxRafDelayMs: 0, lastUpdateMs: 100, redrawOnly: false,
    updateAndRender() {},
  });
  target.updateAndRender = () => { frames.push(target.redrawOnly); };
  const dependencies = { nowMs: () => 100.1, requestFrame: () => { throw new Error("legacy RAF"); } };
  target.frame = atMs => advancePresentationFrame(target, atMs, dependencies);
  env.scheduler.request(target.frame, true);
  env.runTask();
  assert.deepEqual(frames, []);
  assert.equal(env.tasks.size, 1);
  env.runFrame();
  assert.deepEqual(frames, [true]);
  assert.equal(target.lastUpdateMs, 100);
  env.scheduler.dispose();
  advancePresentationFrame(target, 101, { ...dependencies, nowMs: () => { throw new Error("disposed clock"); } });
  assert.equal(env.tasks.size + env.frames.size, 0);
});

function framePresenter(scheduler: PresentationScheduler) {
  const calls = { update: 0, render: 0, resets: 0, performanceFrames: [] as number[] };
  const target: FramePresenter = {
    ...presenter(),
    multiplayerStage: undefined,
    presentationScheduler: scheduler,
    previousRenderTime: 0.1, frameTimeSeconds: 0, fps: 60,
    nextFrameCallbacks: [],
    stages: {
      currentName: "TimeAttackStage", enter() {},
      update() { calls.update++; }, render() { calls.render++; },
    },
    host: {
      renderer: {
        info: { reset() { calls.resets++; }, render: { calls: 1, triangles: 2, lines: 0, points: 0, frame: 1 } },
      },
      touchControls: { setRaceState() {} }, input: { isEnabled: true },
      shell: { started: true }, session: { lifecycle: {} }, paused: false,
      ready: { updateWindowNotice() {} },
      hud: { updateEngine() {}, recordPerformanceFrame(frameMs) { calls.performanceFrames.push(frameMs); } },
      engineRenderStats: { calls: 0, triangles: 0, lines: 0, points: 0, frame: 0 },
      haltRuntime(error) { throw error; },
    },
  };
  return { target, calls };
}

test("unlocked task frames only advance; display refreshes advance, draw and settle callbacks", () => {
  const env = harness();
  const { target, calls } = framePresenter(env.scheduler);
  const dependencies = {
    nowMs: () => env.now, isRaceFinished: () => false,
    requestFrame: () => { throw new Error("legacy RAF"); },
  };
  target.frame = atMs => renderPresentationFrame(target, atMs, dependencies);
  let settled = 0;
  target.nextFrameCallbacks.push({ run: () => settled++, reject() {} });
  startPresentationLoop(target, dependencies);
  env.runTask();
  env.runTask();
  assert.deepEqual([calls.update, calls.render, calls.resets, settled], [2, 0, 0, 0]);
  assert.deepEqual(calls.performanceFrames, []);
  env.runFrame();
  assert.deepEqual([calls.update, calls.render, calls.resets, settled], [3, 1, 1, 1]);
  env.runFrame();
  assert.deepEqual([calls.update, calls.render], [4, 2]);
  // Presented frame time spans every simulated millisecond since the previous draw.
  assert.deepEqual(calls.performanceFrames.map(Math.round), [17, 16]);
  assert.equal(env.tasks.size, 1);
  assert.equal(env.frames.size, 1);
});

test("disposal inside a presented frame prevents rescheduling", () => {
  for (const unlocked of [false, true]) {
    const env = harness();
    const { target, calls } = framePresenter(env.scheduler);
    target.nextFrameCallbacks.push({ run: () => disposePresentationLoop(target), reject() {} });
    env.scheduler.request(atMs => renderPresentationFrame(target, atMs, {
      nowMs: () => 100.5, isRaceFinished: () => false,
      requestFrame: () => { throw new Error("disposed fallback RAF"); },
    }), unlocked);
    env.runFrame();
    assert.deepEqual([calls.update, calls.render], [1, 1]);
    assert.equal(target.animationFrame, 0);
    assert.equal(env.frames.size + env.tasks.size, 0);
  }
});

test("browser backend dispatches through real asynchronous tasks and cancels pending work", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousFrame = Object.getOwnPropertyDescriptor(globalThis, "requestAnimationFrame");
  const previousCancel = Object.getOwnPropertyDescriptor(globalThis, "cancelAnimationFrame");
  const displayFrames = new Set<number>();
  let nextDisplayFrame = 0;
  Object.defineProperty(globalThis, "document", { configurable: true, value: { visibilityState: "visible" } });
  Object.defineProperty(globalThis, "requestAnimationFrame", { configurable: true,
    value: () => { const id = ++nextDisplayFrame; displayFrames.add(id); return id; } });
  Object.defineProperty(globalThis, "cancelAnimationFrame", { configurable: true,
    value: (id: number) => displayFrames.delete(id) });
  const scheduler = createBrowserPresentationScheduler();
  try {
    let returned = false;
    const first = new Promise<void>(resolve => scheduler.request(() => {
      assert.equal(returned, true);
      resolve();
    }, true));
    returned = true;
    await first;
    let cancelledRan = false;
    scheduler.request(() => { cancelledRan = true; }, true);
    scheduler.dispose();
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(cancelledRan, false);
    assert.equal(displayFrames.size, 0);
  } finally {
    scheduler.dispose();
    for (const [name, descriptor] of [["document", previous], ["requestAnimationFrame", previousFrame],
      ["cancelAnimationFrame", previousCancel]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
