/** Keyboard, pause, retry, failure, and viewport behavior of the game shell. */

export interface AppControlEvent {
  code: string;
  repeat: boolean;
  preventDefault(): void;
}

export interface ApplicationControlHost {
  root: { getBoundingClientRect(): { width: number; height: number } };
  shell: {
    current: string;
    halted: boolean;
    started: boolean;
    modal?: string;
    readyModalBusy?: boolean;
    halt(): void;
  };
  racePageTransition: boolean;
  paused: boolean;
  previousRenderTime: number;
  session: {
    selection?: object;
    cameraMode?: string;
    driveCameraState?: unknown;
    surroundCameraState?: unknown;
    lifecycle: {
      phase: unknown;
      togglePause(nowMs: number): unknown[];
      effectiveTime(nowMs: number): number;
    };
    pause?: { setVisible(visible: boolean): void };
    physics?: {
      hardCancelControls(): void;
      synchronizeClock(nowMs: number): void;
    };
  };
  audio: {
    kartAudio?: { setPaused(paused: boolean): void };
    context?: { resume(): Promise<unknown> };
  };
  hud: {
    showDebugText(message: string, kind: string): void;
    setPaused(paused: boolean): void;
  };
  input: { setEnabled(enabled: boolean): void };
  drivingInput: { cancel(): void };
  autoForward: { cancel(): void };
  presenter: { afterNextFrame<T>(callback: () => T): Promise<T> };
  gameOptions: Record<string, unknown>;
  activeBlackBar?: { setViewportHeight(height: number): void };
  renderer: { setDrawingBufferSize(width: number, height: number, scale: number): void };
  camera: { aspect: number; updateProjectionMatrix(): void };
  cameras: {
    drive: { apply(camera: unknown, state: unknown): void };
    surround: { apply(camera: unknown, state: unknown): void };
  };
  handleTimeAttackActions(actions: unknown[], nowMs: number): void;
  handleReadyShortcut(event: AppControlEvent): boolean;
  togglePause(): void;
  saveGameOptions(): void;
  applySavedAudioOptions(): void;
  startRace(selection: object): Promise<unknown>;
  releaseRaceForReady(): void;
  haltRuntime(error: unknown, nowMs: number): void;
  handleGlobalShortcut(event: AppControlEvent): boolean;
}

export function canReloadForUpdate(host: ApplicationControlHost): boolean {
  return host.shell.current === "Ready" && !host.shell.readyModalBusy &&
    !host.racePageTransition;
}

/** Freeze every input source and show the actual runtime failure. */
export function haltApplicationRuntime(host: ApplicationControlHost,
  error: unknown, nowMs: number): void {
  host.paused = true;
  host.shell.halt();
  host.audio.kartAudio?.setPaused(true);
  host.input.setEnabled(false);
  host.drivingInput.cancel();
  host.autoForward.cancel();
  host.session.physics?.hardCancelControls();
  host.session.physics?.synchronizeClock(nowMs);
  host.hud.setPaused(true);
  host.hud.showDebugText(
    `运行时 fail-closed：${error instanceof Error ? error.message : String(error)}`,
    "error",
  );
}

/** The race lifecycle owns the pause transition and its effective clock. */
export function toggleRacePause(host: ApplicationControlHost,
  nowMs: () => number, pausedPhase: unknown): void {
  if (host.shell.current === "MultiplayerRacing" || host.racePageTransition) return;
  if (host.shell.halted) {
    host.hud.showDebugText("运行时已 fail-closed；请重新开始或返回菜单。", "error");
    return;
  }
  const now = nowMs();
  const actions = host.session.lifecycle.togglePause(now);
  if (actions.length === 0) return;
  host.paused = host.session.lifecycle.phase === pausedPhase;
  host.session.pause?.setVisible(host.paused);
  host.audio.kartAudio?.setPaused(host.paused);
  host.handleTimeAttackActions(actions, now);
  host.session.physics?.synchronizeClock(host.session.lifecycle.effectiveTime(now));
  host.previousRenderTime = now / 1_000;
}

/** Retry the current selected track behind a one-frame curtain. */
export async function restartRaceFromPause(host: ApplicationControlHost,
  createCurtain: (root: ApplicationControlHost["root"]) => () => void,
  nowMs: () => number): Promise<void> {
  if (host.racePageTransition) return;
  host.racePageTransition = true;
  let closeCurtain: (() => void) | undefined;
  try {
    const selection = host.session.selection ? { ...host.session.selection } : undefined;
    if (!selection) throw new Error("TimeAttack Retry 缺少当前资源身份。");
    closeCurtain = await host.presenter.afterNextFrame(() => createCurtain(host.root));
    host.session.pause?.setVisible(false);
    await host.audio.context?.resume();
    host.releaseRaceForReady();
    await host.startRace(selection);
    await host.presenter.afterNextFrame(() => {});
  } catch (error) {
    host.haltRuntime(error, nowMs());
  } finally {
    closeCurtain?.();
    host.racePageTransition = false;
  }
}

/** Catch stage shortcuts before global audio toggles and Escape-to-pause. */
export function onApplicationKeyDown(host: ApplicationControlHost, event: AppControlEvent): void {
  if (host.racePageTransition) {
    event.preventDefault();
    return;
  }
  if (host.shell.current === "MultiplayerRacing") {
    if (event.code === "Escape") event.preventDefault();
    return;
  }
  if (!host.handleGlobalShortcut(event) && host.shell.started && event.code === "Escape") {
    event.preventDefault();
    host.togglePause();
  }
}

/** Toggle a configured game option from its keyboard binding. */
export function handleApplicationShortcut(host: ApplicationControlHost,
  event: AppControlEvent, bindings: Readonly<Record<string, string>>): boolean {
  if (host.shell.modal === "settings" || host.handleReadyShortcut(event)) return true;
  const setting = bindings[event.code];
  if (!setting) return event.repeat;
  event.preventDefault();
  host.gameOptions = { ...host.gameOptions, [setting]: !host.gameOptions[setting] };
  if (setting !== "enableRoadSound") host.saveGameOptions();
  host.applySavedAudioOptions();
  return true;
}

// Limit the main 3D pass to a Full HD pixel budget. High-DPI displays otherwise
// multiply every fragment's cost, even though the game uses a fixed camera size.
// Interface canvases keep their independent, native-resolution backing buffers.
const MAX_APPLICATION_RENDER_PIXELS = 1920 * 1080;

/** Resize the renderer and reapply the active camera's projection. */
export function configureApplicationBackbuffer(host: ApplicationControlHost,
  dimensions: { width: number; height: number },
  scaleForViewport: (width: number, height: number, pixelRatio: number,
    targetWidth: number, targetHeight: number) => number,
  pixelRatio: number): void {
  host.activeBlackBar?.setViewportHeight(host.root.getBoundingClientRect().height);
  const rect = host.root.getBoundingClientRect();
  const nativeScale = scaleForViewport(rect.width, rect.height, pixelRatio,
    dimensions.width, dimensions.height);
  const scale = Math.min(nativeScale,
    Math.sqrt(MAX_APPLICATION_RENDER_PIXELS / (dimensions.width * dimensions.height)));
  host.renderer.setDrawingBufferSize(dimensions.width, dimensions.height, scale);
  host.camera.aspect = dimensions.width / dimensions.height;
  if (host.session.cameraMode === "drive" && host.session.driveCameraState) {
    host.cameras.drive.apply(host.camera, host.session.driveCameraState);
  } else if (host.session.cameraMode === "surround" && host.session.surroundCameraState) {
    host.cameras.surround.apply(host.camera, host.session.surroundCameraState);
  } else {
    host.camera.updateProjectionMatrix();
  }
}
