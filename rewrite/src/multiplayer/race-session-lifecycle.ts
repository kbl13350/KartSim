/** Opens, presents, leaves, and disposes a multiplayer race session. */

interface RoomSnapshot { phase: string; members?: unknown[] }

export interface RaceSessionLifecycleHost {
  runtime: {
    local: {
      physics: { speedRaceMode?: { kind: string } };
    };
    bindClock(clock: unknown): void;
    updateRoom(room: RoomSnapshot): void;
    resultSnapshot(): unknown;
    scheduleStart(start: unknown): void;
    dispose(): void;
  };
  scene: {
    updateRoom(room: RoomSnapshot): void;
    update(renderer: unknown, nowMs: number, actions: unknown[]): void;
    render(renderer: unknown, nowMs: number): void;
    startAudio(): void;
    resultComplete: boolean;
    dispose(): void;
  };
  host: {
    renderer: { domElement: { focus(): void } };
    publish(session: RaceSessionLifecycleHost): void;
    release(session: RaceSessionLifecycleHost): void;
    input: { cancelAll(): void; setEnabled(enabled: boolean): void };
    autoForward: { cancel(): void; setRaceState(active: boolean,
      pendingStart: boolean): void };
    touchControls: { setAutoForwardActive(active: boolean): void };
    status(message: string, error?: boolean): void;
    closePresentation?(): void;
    returnToRoom?(): Promise<unknown>;
    leave(): Promise<unknown>;
  };
  chat?: {
    updateRoom(room: RoomSnapshot): void;
    show(): void;
    setAllowed(allowed: boolean): void;
    dispose(): void;
  };
  notice?: { visible: boolean; dispose(): void };
  controls: { cancel(): void };
  active: boolean;
  disposed: boolean;
  leaving: boolean;
  resultVisible: boolean;
  roomPhase?: string;
  now: number;
  showWaiting(): void;
  requestLeave(): void;
  dispose(): void;
  fail(error: unknown): void;
}

export function initializeRaceSession(host: RaceSessionLifecycleHost,
  runtime: RaceSessionLifecycleHost["runtime"],
  scene: RaceSessionLifecycleHost["scene"],
  appHost: RaceSessionLifecycleHost["host"],
  chat: RaceSessionLifecycleHost["chat"],
  notice: RaceSessionLifecycleHost["notice"]): void {
  host.runtime = runtime;
  host.scene = scene;
  host.host = appHost;
  host.chat = chat;
  host.notice = notice;
}

export function raceSessionDiagnosticsView(host: RaceSessionLifecycleHost): unknown {
  return host.scene;
}

export function raceSessionTouchDrivingAvailable(
  host: RaceSessionLifecycleHost): boolean {
  return host.active && !host.disposed && !host.resultVisible &&
    !host.notice?.visible;
}

export function raceSessionTouchDodgeEnabled(
  host: RaceSessionLifecycleHost): boolean {
  return !host.disposed &&
    host.runtime.local.physics.speedRaceMode?.kind === "lte";
}

export function bindRaceSessionClock(host: RaceSessionLifecycleHost,
  clock: unknown): void {
  host.runtime.bindClock(clock);
}

export function updateRaceSessionRoom(host: RaceSessionLifecycleHost,
  room: RoomSnapshot): void {
  host.roomPhase = room.phase;
  host.scene.updateRoom(room);
  host.runtime.updateRoom(room);
  host.chat?.updateRoom(room);
}

export function raceSessionPresentingResults(
  host: RaceSessionLifecycleHost): boolean {
  return host.resultVisible
    ? !host.scene.resultComplete
    : host.runtime.resultSnapshot() !== undefined;
}

export function showRaceSessionWaiting(host: RaceSessionLifecycleHost,
  nowMs: () => number): void {
  if (host.disposed) throw new Error("多人比赛已释放。");
  if (host.active) return;
  host.now = nowMs();
  host.scene.update(host.host.renderer, host.now, []);
  host.scene.render(host.host.renderer, host.now);
  host.host.publish(host);
  host.active = true;
  host.chat?.show();
  host.chat?.setAllowed(true);
  host.scene.startAudio();
  host.host.input.cancelAll();
  host.host.input.setEnabled(true);
  host.host.autoForward.cancel();
  host.host.renderer.domElement.focus();
  host.host.status("本机加载完成，等待其他玩家和统一起跑通知。");
}

export function scheduleRaceSessionStart(host: RaceSessionLifecycleHost,
  start: unknown): void {
  if (host.disposed) throw new Error("多人比赛已释放。");
  host.runtime.scheduleStart(start);
  host.showWaiting();
  host.host.status(host.runtime.local.physics.speedRaceMode?.kind === "lte"
    ? "LTE Web试玩：Z左躲闪、X右躲闪；自动补氮气及香蕉事件尚未接齐。"
    : "沿用设置中的驾驶按键，等待统一起跑。");
}

export function renderRaceSession(host: RaceSessionLifecycleHost): void {
  if (!host.active || host.disposed) return;
  try {
    host.scene.render(host.host.renderer, host.now);
  } catch (error) {
    host.fail(error);
  }
}

export function requestRaceSessionLeave(host: RaceSessionLifecycleHost): void {
  if (host.leaving || host.disposed) return;
  host.leaving = true;
  if (host.resultVisible && host.roomPhase === "open" &&
    host.host.closePresentation) {
    host.host.closePresentation();
    return;
  }
  const leave = host.resultVisible && host.host.returnToRoom
    ? () => host.host.returnToRoom!()
    : () => host.host.leave();
  void leave().catch(error => {
    host.leaving = false;
    host.host.status(`退出失败：${String(error)}`, true);
  });
}

export function failRaceSession(host: RaceSessionLifecycleHost,
  error: unknown): void {
  if (host.disposed) return;
  console.error("多人比赛已停止", error);
  host.host.status(`多人比赛已停止：${error instanceof Error
    ? error.message : String(error)}`, true);
  host.resultVisible = false;
  host.requestLeave();
  host.dispose();
}

export function exitRaceSession(host: RaceSessionLifecycleHost): void {
  host.dispose();
}

export function disposeRaceSession(host: RaceSessionLifecycleHost): void {
  if (host.disposed) return;
  host.disposed = true;
  if (host.active) {
    host.host.input.setEnabled(false);
    host.host.input.cancelAll();
  }
  host.controls.cancel();
  host.host.autoForward.setRaceState(false, false);
  host.host.touchControls.setAutoForwardActive(false);
  host.chat?.dispose();
  host.notice?.dispose();
  host.scene.dispose();
  host.runtime.dispose();
  if (host.active) host.host.release(host);
  host.active = false;
}
