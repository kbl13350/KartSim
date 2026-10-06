import type { TimeAttackAction } from "./lifecycle";

interface Resettable {
  reset(): void;
}

interface RaceTrack {
  data: {
    trackId: string;
    weather?: { rainEnabled?: boolean; rainOnStart?: boolean; snowEnabled?: boolean };
  };
  resetRender(atMs: number, camera: unknown, firstAxis: unknown, secondAxis: unknown): void;
}

interface GhostRecorder {
  addParticipant(participant: {
    sample(atMs: number): unknown;
    equipment: unknown;
    startSlot: number;
  }): void;
}

export interface RaceResetStage {
  lowSpeedResetStartedAtMs: number;
  ui?: {
    result?: { hide(): void };
    gameplayUi?: Resettable;
    action2D?: Resettable;
    trackInfoCard?: { setBgmName(name: string): void; setVisible(visible: boolean): void };
  };
  host: {
    presentationClockMs: number;
    previousRenderTime: number;
    currentPlayerSlot: number;
    touchControls: { releaseAll(): void };
    shell: { clearHalt(): void };
    setPaused(paused: boolean): void;
    input: { cancelAll(): void; setEnabled(enabled: boolean): void };
    drivingInput: { cancel(): void };
    autoForward: { cancel(): void };
    tachometerGaugePreserve: Resettable;
    audio: {
      kartAudio?: { resetRace(): void };
      countdownAudio?: Resettable;
      bgm?: { restart(): void; currentRaceName?: string };
    };
    session: {
      speedResetState: unknown;
      pendingCharacterFinishMotion: number;
      pause?: { setVisible(visible: boolean): void };
      physics?: { hardCancelControls(): void };
      coordinator?: { dispose(): void } | unknown;
      kartDriftEffects?: Resettable;
      kartMotionBlur?: Resettable;
      zetAirEffect?: Resettable;
      shockWaveEffect?: Resettable;
      exhaustEffect?: Resettable;
      crashEffect?: Resettable;
      chargerEffect?: Resettable;
      flyingPet?: Resettable;
      characterRender?: Resettable;
      linkedCharacterRender?: Resettable;
      linkedCharacterPresentation?: { resetForRacePresentation(): void };
      driveCameraState?: unknown;
      surroundCameraState?: unknown;
      cameraMode: string;
      warpCameraFrozen: boolean;
      track?: RaceTrack;
      rain?: { reset(enabled: boolean | undefined): void };
      snow?: Resettable;
      ghosts: Array<{ startSlot: number }>;
      admission?: unknown;
      lifecycle: { startAtMs: number; reset(): TimeAttackAction[] };
    };
    kartView: { resetAnimation(): void; root: { visible: boolean } };
    driveCameraman: { reset(): void };
    surroundCameraman: { reset(): void };
    warpNext: Resettable;
    cameraShake: { leave(force: boolean): void };
    cameraWave: { leave(): void };
    toonStageBinding: { setLightFactor(factor: number): void };
    camera: unknown;
    ghostRecorder?: GhostRecorder;
    currentGhostEquipment(): unknown;
    getPhysics(): { setRaceMotionLocked(locked: boolean): void };
    handleTimeAttackActions(actions: TimeAttackAction[], nowMs: number): void;
    hud: { setPaused(paused: boolean): void };
  };
  placeAtStart(): void;
  createCoordinator(admission: unknown, track: RaceTrack, physics: unknown): unknown;
  captureGhostRuntime(atMs: number): unknown;
}

export interface RaceResetDependencies {
  newSpeedResetState(): unknown;
  worldAxis: unknown;
  depthAxis: unknown;
  selectPlayerSlot(slots: number[]): number;
  recordingKey(trackId: string): string;
  createRecorder(key: string): GhostRecorder;
  ghostRelativeTime(atMs: number, startAtMs: number): number;
  nowMs(): number;
}

/**
 * Restore every race owner to its pre-countdown state. The ordering matters:
 * controls and old coordinator are released before new owners are created.
 */
export function restartTimeAttackRace(
  stage: RaceResetStage,
  dependencies: RaceResetDependencies,
): void {
  const { host } = stage;
  stage.lowSpeedResetStartedAtMs = 0;
  host.session.pendingCharacterFinishMotion = 0;
  host.touchControls.releaseAll();
  host.presentationClockMs = 0;
  host.shell.clearHalt();
  host.session.speedResetState = dependencies.newSpeedResetState();
  host.setPaused(false);
  host.session.pause?.setVisible(false);
  host.input.cancelAll();
  host.drivingInput.cancel();
  host.autoForward.cancel();
  host.session.physics?.hardCancelControls();
  (host.session.coordinator as { dispose(): void } | undefined)?.dispose();
  host.session.coordinator = undefined;
  stage.ui?.result?.hide();
  stage.ui?.gameplayUi?.reset();
  stage.ui?.action2D?.reset();
  host.tachometerGaugePreserve.reset();
  host.audio.kartAudio?.resetRace();
  host.audio.countdownAudio?.reset();
  host.session.kartDriftEffects?.reset();
  host.session.kartMotionBlur?.reset();
  host.session.zetAirEffect?.reset();
  host.session.shockWaveEffect?.reset();
  host.session.exhaustEffect?.reset();
  host.session.crashEffect?.reset();
  host.session.chargerEffect?.reset();
  host.kartView.resetAnimation();
  host.session.flyingPet?.reset();
  host.session.characterRender?.reset();
  host.session.linkedCharacterRender?.reset();
  host.session.linkedCharacterPresentation?.resetForRacePresentation();
  host.driveCameraman.reset();
  host.surroundCameraman.reset();
  host.session.driveCameraState = undefined;
  host.session.surroundCameraState = undefined;
  host.session.cameraMode = "ready";
  host.session.warpCameraFrozen = false;
  host.warpNext.reset();

  const weather = host.session.track?.data.weather;
  if (weather?.rainEnabled) host.session.rain?.reset(weather.rainOnStart);
  if (weather?.snowEnabled) host.session.snow?.reset();
  host.cameraShake.leave(true);
  host.cameraWave.leave();
  host.toonStageBinding.setLightFactor(1);
  host.kartView.root.visible = true;
  host.session.track?.resetRender(0, host.camera, dependencies.worldAxis, dependencies.depthAxis);
  host.currentPlayerSlot = dependencies.selectPlayerSlot(
    host.session.ghosts.map(ghost => ghost.startSlot),
  );
  stage.placeAtStart();

  const { admission, track, physics } = host.session;
  if (!admission || !track || !physics || !host.audio.kartAudio) {
    throw new Error("TimeAttack restart 缺少 P3528 runtime owners。 ");
  }
  const recorder = dependencies.createRecorder(dependencies.recordingKey(track.data.trackId));
  const equipment = host.currentGhostEquipment();
  if (equipment) {
    recorder.addParticipant({
      sample: atMs => stage.captureGhostRuntime(
        dependencies.ghostRelativeTime(atMs, host.session.lifecycle.startAtMs),
      ),
      equipment,
      startSlot: host.currentPlayerSlot,
    });
  }
  host.ghostRecorder = recorder;
  host.session.coordinator = stage.createCoordinator(admission, track, physics);
  host.getPhysics().setRaceMotionLocked(true);
  host.audio.bgm?.restart();
  stage.ui?.trackInfoCard?.setBgmName(host.audio.bgm?.currentRaceName ?? "");
  stage.ui?.trackInfoCard?.setVisible(true);
  const now = dependencies.nowMs();
  host.previousRenderTime = now / 1000;
  host.handleTimeAttackActions(host.session.lifecycle.reset(), now);
  host.hud.setPaused(false);
}
