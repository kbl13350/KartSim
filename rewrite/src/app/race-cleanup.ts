/** Resources owned by a race are released before the Ready stage is entered. */
interface Disposable {
  dispose(argument?: boolean): void;
}

interface TrackResource extends Disposable {
  group: { removeFromParent(): void };
}

interface RaceSession {
  track?: TrackResource;
  speedResetState: unknown;
  physics?: { hardCancelControls(): void };
  coordinator?: Disposable;
  ghosts: Array<{ view: Disposable }>;
  outlineBatch?: Disposable;
  vehicleRender?: Disposable;
  flyingPet?: Disposable;
  characterRender?: Disposable;
  pendingCharacterFinishMotion: number;
  linkedCharacterRender?: Disposable;
  linkedCharacterPresentation?: unknown;
  kartEffects?: Disposable;
  balloonDecoration?: Disposable;
  characterDecorations: Array<{ render: Disposable }>;
  raceAura?: unknown;
  kartTrails?: Disposable;
  kartDriftEffects?: Disposable;
  kartMotionBlur?: Disposable;
  zetAirEffect?: Disposable;
  shockWaveEffect?: Disposable;
  exhaustEffect?: Disposable;
  crashEffect?: Disposable;
  chargerEffect?: Disposable;
  particleModification?: Disposable;
  particleModificationBanner?: Disposable;
  particleModificationBannerRequest?: unknown;
  trackEventEffects?: Disposable;
  trackEventAudio?: Disposable;
  trackDummyAudio?: Disposable;
  lampFlares?: Disposable;
  simpleShadow?: Disposable;
  tachometer?: Disposable;
  pause?: Disposable;
  rain?: Disposable;
  rainAudio?: Disposable;
  snow?: Disposable;
  toonEnvironment?: Disposable;
  trackMetadata?: unknown;
  readyCamera?: unknown;
  warpNextCamera?: unknown;
  admission?: unknown;
}

export interface RaceCleanupPresenter {
  host: {
    session: RaceSession;
    hud: { finishPerformanceRace(): void; setPaused(paused: boolean): void };
    shell: { enterReady(): void; clearHalt(): void };
    input: { setEnabled(enabled: boolean): void };
    drivingInput: { cancel(): void };
    autoForward: { cancel(): void };
    audio: { countdownAudio?: Disposable; kartAudio?: Disposable };
    toonStageBinding: {
      retain(environment: Disposable): void;
      prepareCoatingStage(): { commit(): void };
      setLightFactor(factor: number): void;
    };
    kartView: { clearModel(): void };
    scene: { visible: boolean };
    ghostRecorder?: unknown;
    currentPlayerSlot: number;
    setPaused(paused: boolean): void;
  };
  previousRenderTime: number;
  disposeRaceInterface(): void;
  changeStage(name: string): unknown;
}

export interface RaceCleanupDependencies {
  setToonLinesEnabled(enabled: boolean): void;
  newSpeedResetState(): unknown;
  nowMs(): number;
}

/** Tear down the previous race in release order and show the Ready stage. */
export function releaseRaceForReady(
  presenter: RaceCleanupPresenter,
  dependencies: RaceCleanupDependencies,
): void {
  const host = presenter.host;
  const session = host.session;
  const hadTrack = !!session.track;
  dependencies.setToonLinesEnabled(true);
  host.hud.finishPerformanceRace();
  host.shell.enterReady();
  host.shell.clearHalt();
  host.setPaused(false);
  session.speedResetState = dependencies.newSpeedResetState();
  host.input.setEnabled(false);
  host.drivingInput.cancel();
  host.autoForward.cancel();
  session.physics?.hardCancelControls();
  session.coordinator?.dispose();
  session.coordinator = undefined;

  for (const ghost of session.ghosts) ghost.view.dispose();
  session.ghosts = [];
  session.outlineBatch?.dispose();
  session.outlineBatch = undefined;
  host.ghostRecorder = undefined;
  host.currentPlayerSlot = 0;
  session.vehicleRender?.dispose();
  session.vehicleRender = undefined;
  session.flyingPet?.dispose();
  session.flyingPet = undefined;
  session.characterRender?.dispose();
  session.characterRender = undefined;
  session.pendingCharacterFinishMotion = 0;
  session.linkedCharacterRender?.dispose();
  session.linkedCharacterRender = undefined;
  session.linkedCharacterPresentation = undefined;
  session.kartEffects?.dispose();
  session.kartEffects = undefined;
  session.balloonDecoration?.dispose();
  session.balloonDecoration = undefined;
  session.characterDecorations.forEach(({ render }) => render.dispose());
  session.characterDecorations = [];
  session.raceAura = undefined;
  session.kartTrails?.dispose();
  session.kartTrails = undefined;
  session.kartDriftEffects?.dispose();
  session.kartDriftEffects = undefined;
  session.kartMotionBlur?.dispose();
  session.kartMotionBlur = undefined;
  session.zetAirEffect?.dispose();
  session.zetAirEffect = undefined;
  session.shockWaveEffect?.dispose();
  session.shockWaveEffect = undefined;
  session.exhaustEffect?.dispose();
  session.exhaustEffect = undefined;
  session.crashEffect?.dispose();
  session.crashEffect = undefined;
  session.chargerEffect?.dispose();
  session.chargerEffect = undefined;
  session.particleModification?.dispose();
  session.particleModification = undefined;
  session.particleModificationBanner?.dispose();
  session.particleModificationBanner = undefined;
  session.particleModificationBannerRequest = undefined;
  session.trackEventEffects?.dispose();
  session.trackEventEffects = undefined;
  session.trackEventAudio?.dispose();
  session.trackEventAudio = undefined;
  session.trackDummyAudio?.dispose();
  session.trackDummyAudio = undefined;
  session.lampFlares?.dispose();
  session.lampFlares = undefined;
  session.simpleShadow?.dispose();
  session.simpleShadow = undefined;
  session.tachometer?.dispose();
  session.tachometer = undefined;
  presenter.disposeRaceInterface();
  session.pause?.dispose();
  session.pause = undefined;
  session.rain?.dispose();
  session.rain = undefined;
  session.rainAudio?.dispose();
  session.rainAudio = undefined;
  session.snow?.dispose();
  session.snow = undefined;
  host.audio.countdownAudio?.dispose();
  host.audio.countdownAudio = undefined;
  host.audio.kartAudio?.dispose(false);
  host.audio.kartAudio = undefined;
  if (session.toonEnvironment) host.toonStageBinding.retain(session.toonEnvironment);
  session.toonEnvironment?.dispose();
  session.toonEnvironment = undefined;
  session.track?.group.removeFromParent();
  session.track?.dispose();
  session.track = undefined;
  session.trackMetadata = undefined;
  host.kartView.clearModel();
  session.physics = undefined;
  session.admission = undefined;
  if (hadTrack) host.toonStageBinding.prepareCoatingStage().commit();
  host.toonStageBinding.setLightFactor(1);
  session.readyCamera = undefined;
  session.warpNextCamera = undefined;
  host.scene.visible = false;
  host.hud.setPaused(false);
  presenter.previousRenderTime = dependencies.nowMs() / 1000;
  presenter.changeStage("TimeAttackReadyStage");
}
