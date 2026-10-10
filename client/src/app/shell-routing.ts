/** Application-level routing to Ready, presentation, driving, and records. */

type PresenterAction =
  | "frame" | "updateAndRender" | "renderGameplayUi" | "updateDriving"
  | "updateTimeAttackRoute" | "handleTimeAttackActions"
  | "handleTimeAttackActionAudio" | "releaseRaceForReady"
  | "applyWarpNextActions" | "initiateSpeedReset"
  | "advanceResetCompletion" | "replaceTrack" | "applyRaceOptions";

type ReadyAction =
  | "enterTimeAttackReady" | "openTrackSelect" | "selectReadyTrack"
  | "openGarage" | "selectReadyGarage" | "readyModalBusy"
  | "previewSettings" | "confirmSettings" | "saveGameOptions"
  | "closeSettings" | "releaseReadyToonEnvironment" | "handleReadyShortcut";

type DrivingAction =
  | "drainDrivingInput" | "setAutoForwardEnabled"
  | "setNitroSeamlessMode" | "getDrivingSnapshot";

export interface ShellRoutingHost {
  presenter: Record<PresenterAction, (...args: unknown[]) => unknown>;
  ready: Record<ReadyAction, (...args: unknown[]) => unknown>;
  drivingPipeline: Record<DrivingAction, (...args: unknown[]) => unknown>;
  records: {
    promote(...args: unknown[]): unknown;
    restore(): unknown;
  };
  hud: { update(physicsState: unknown, fps: unknown): void };
  cameras: {
    update(nowMs: unknown, camera: unknown, session: unknown,
      physics: unknown, track: unknown): void;
  };
  camera: unknown;
  session: unknown;
  physics: { state: unknown };
  track: unknown;
  fps: unknown;
  audio: { context?: unknown };
  gameOptions: unknown;
}

/** Keep the return behavior of each original shell method explicit. */
export const shellRouting = {
  frame(host: ShellRoutingHost, nowMs: unknown): void {
    host.presenter.frame(nowMs);
  },
  updateAndRender(host: ShellRoutingHost, nowMs: unknown): void {
    host.presenter.updateAndRender(nowMs);
  },
  renderGameplayUi(host: ShellRoutingHost, nowMs: unknown, frame: unknown): void {
    host.presenter.renderGameplayUi(nowMs, frame);
  },
  updateDriving(host: ShellRoutingHost, nowMs: unknown): void {
    host.presenter.updateDriving(nowMs);
  },
  updateTimeAttackRoute(host: ShellRoutingHost, nowMs: unknown,
    physics: unknown, track: unknown): void {
    host.presenter.updateTimeAttackRoute(nowMs, physics, track);
  },
  handleTimeAttackActions(host: ShellRoutingHost, actions: unknown, nowMs: unknown): void {
    host.presenter.handleTimeAttackActions(actions, nowMs);
  },
  handleTimeAttackActionAudio(host: ShellRoutingHost, action: unknown, nowMs: unknown): unknown {
    return host.presenter.handleTimeAttackActionAudio(action, nowMs);
  },
  releaseRaceForReady(host: ShellRoutingHost): void {
    host.presenter.releaseRaceForReady();
  },
  applyWarpNextActions(host: ShellRoutingHost, actions: unknown): void {
    host.presenter.applyWarpNextActions(actions);
  },
  initiateSpeedReset(host: ShellRoutingHost, allowCurrentSpeed: unknown): void {
    host.presenter.initiateSpeedReset(allowCurrentSpeed);
  },
  advanceResetCompletion(host: ShellRoutingHost, nowMs: unknown): void {
    host.presenter.advanceResetCompletion(nowMs);
  },
  replaceTrack(host: ShellRoutingHost, track: unknown): void {
    host.presenter.replaceTrack(track);
  },
  applyRaceOptions(host: ShellRoutingHost, options: unknown): void {
    host.presenter.applyRaceOptions(options);
  },

  promoteTimeAttackRecord(host: ShellRoutingHost, record: unknown, time: unknown): unknown {
    return host.records.promote(record, time);
  },
  restoreTimeAttackRecords(host: ShellRoutingHost): unknown {
    return host.records.restore();
  },

  enterTimeAttackReady(host: ShellRoutingHost, options: unknown): unknown {
    return host.ready.enterTimeAttackReady(options);
  },
  openTrackSelect(host: ShellRoutingHost, selection: unknown, options: unknown): unknown {
    return host.ready.openTrackSelect(selection, options);
  },
  selectReadyTrack(host: ShellRoutingHost, selection: unknown,
    options: unknown, track: unknown): void {
    host.ready.selectReadyTrack(selection, options, track);
  },
  openGarage(host: ShellRoutingHost, selection: unknown, options: unknown): unknown {
    return host.ready.openGarage(selection, options);
  },
  selectReadyGarage(host: ShellRoutingHost, selection: unknown,
    options: unknown, choice: unknown): unknown {
    return host.ready.selectReadyGarage(selection, options, choice);
  },
  readyModalBusy(host: ShellRoutingHost): unknown {
    return host.ready.readyModalBusy();
  },
  previewSettings(host: ShellRoutingHost, options: unknown): void {
    host.ready.previewSettings(options);
  },
  confirmSettings(host: ShellRoutingHost, options: unknown,
    speed: unknown, version: unknown): void {
    host.ready.confirmSettings(options, speed, version);
  },
  saveGameOptions(host: ShellRoutingHost): void {
    host.ready.saveGameOptions();
  },
  closeSettings(host: ShellRoutingHost): void {
    host.ready.closeSettings();
  },
  releaseReadyToonEnvironment(host: ShellRoutingHost): void {
    host.ready.releaseReadyToonEnvironment();
  },
  handleReadyShortcut(host: ShellRoutingHost, event: unknown): unknown {
    return host.ready.handleReadyShortcut(event);
  },

  drainDrivingInput(host: ShellRoutingHost, nowMs: unknown, state: unknown): void {
    host.drivingPipeline.drainDrivingInput(nowMs, state);
  },
  setAutoForwardEnabled(host: ShellRoutingHost, enabled: unknown): void {
    host.drivingPipeline.setAutoForwardEnabled(enabled);
  },
  setNitroSeamlessMode(host: ShellRoutingHost, enabled: unknown): void {
    host.drivingPipeline.setNitroSeamlessMode(enabled);
  },
  getDrivingSnapshot(host: ShellRoutingHost): unknown {
    return host.drivingPipeline.getDrivingSnapshot();
  },

  updateHud(host: ShellRoutingHost): void {
    host.hud.update(host.physics.state, host.fps);
  },
  updateActiveRaceCamera(host: ShellRoutingHost, nowMs: unknown): void {
    host.cameras.update(nowMs, host.camera, host.session, host.physics, host.track);
  },
  applySavedAudioOptions(host: ShellRoutingHost,
    applyAudioOptions: (context: unknown, options: unknown) => void): void {
    if (host.audio.context) applyAudioOptions(host.audio.context, host.gameOptions);
  },
};
