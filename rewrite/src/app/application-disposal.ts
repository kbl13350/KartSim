/** Release resources owned by the application, in the same order as the game shell. */
export interface AppDisposable {
  dispose(argument?: boolean): void;
}

export interface ApplicationDisposalHost {
  canvasDiagnostics: AppDisposable;
  devToolsHandle?: AppDisposable;
  devToolsOverlayHandle?: AppDisposable;
  devToolsObjectsOverlayHandle?: AppDisposable;
  shell: AppDisposable;
  assets: { invalidate(): void };
  presenter: AppDisposable & { disposeRaceInterface(): void };
  activeBlackBar?: AppDisposable;
  viewportResizeObserver: { disconnect(): void };
  onGlobalKeyDown: unknown;
  onViewportResize: unknown;
  touchControls: AppDisposable;
  input: AppDisposable;
  kartView: AppDisposable;
  ready: AppDisposable;
  session: {
    coordinator?: AppDisposable;
    flyingPet?: AppDisposable;
    vehicleRender?: AppDisposable;
    characterRender?: AppDisposable;
    linkedCharacterRender?: AppDisposable;
    kartEffects?: AppDisposable;
    ghosts: Array<{ view: AppDisposable }>;
    outlineBatch?: AppDisposable;
    balloonDecoration?: AppDisposable;
    characterDecorations: Array<{ render: AppDisposable }>;
    raceAura?: unknown;
    kartTrails?: AppDisposable;
    kartDriftEffects?: AppDisposable;
    kartMotionBlur?: AppDisposable;
    zetAirEffect?: AppDisposable;
    shockWaveEffect?: AppDisposable;
    exhaustEffect?: AppDisposable;
    crashEffect?: AppDisposable;
    chargerEffect?: AppDisposable;
    particleModification?: AppDisposable;
    particleModificationBanner?: AppDisposable;
    particleModificationBannerRequest?: unknown;
    trackEventEffects?: AppDisposable;
    trackEventAudio?: AppDisposable;
    trackDummyAudio?: AppDisposable;
    lampFlares?: AppDisposable;
    simpleShadow?: AppDisposable;
    tachometer?: AppDisposable;
    pause?: AppDisposable;
    rain?: AppDisposable;
    rainAudio?: AppDisposable;
    snow?: AppDisposable;
    toonEnvironment?: AppDisposable;
    track?: AppDisposable;
  };
  audio: {
    interfaceAudio?: AppDisposable;
    bgm?: AppDisposable;
    countdownAudio?: AppDisposable;
    kartAudio?: AppDisposable;
    context?: { state: string; close(): void };
  };
  toonStageBinding: {
    retain(environment: AppDisposable): void;
    dispose(): void;
  };
  hud: AppDisposable;
  renderer: AppDisposable & { domElement: { remove(): void } };
  releaseReadyToonEnvironment(): void;
}

export interface ApplicationDisposalDependencies {
  setToonLinesEnabled(enabled: boolean): void;
  removeWindowListener(type: string, callback: unknown): void;
}

/** Shut down rendering, race state, sound, and DOM hooks. */
export function disposeApplicationRuntime(
  host: ApplicationDisposalHost,
  dependencies: ApplicationDisposalDependencies,
): void {
  const session = host.session;
  const audio = host.audio;

  host.canvasDiagnostics.dispose();
  host.devToolsHandle?.dispose();
  host.devToolsHandle = undefined;
  host.devToolsOverlayHandle?.dispose();
  host.devToolsOverlayHandle = undefined;
  host.devToolsObjectsOverlayHandle?.dispose();
  host.devToolsObjectsOverlayHandle = undefined;
  host.shell.dispose();
  dependencies.setToonLinesEnabled(true);
  host.assets.invalidate();
  host.presenter.dispose();
  host.activeBlackBar?.dispose();
  host.activeBlackBar = undefined;
  host.viewportResizeObserver.disconnect();
  dependencies.removeWindowListener("keydown", host.onGlobalKeyDown);
  dependencies.removeWindowListener("resize", host.onViewportResize);
  host.touchControls.dispose();
  host.input.dispose();

  session.coordinator?.dispose();
  session.flyingPet?.dispose();
  session.flyingPet = undefined;
  session.vehicleRender?.dispose();
  session.characterRender?.dispose();
  session.linkedCharacterRender?.dispose();
  session.kartEffects?.dispose();
  for (const ghost of session.ghosts) ghost.view.dispose();
  session.ghosts = [];
  session.outlineBatch?.dispose();
  session.outlineBatch = undefined;
  session.balloonDecoration?.dispose();
  session.characterDecorations.forEach(({ render }) => render.dispose());
  session.raceAura = undefined;
  session.kartTrails?.dispose();
  session.kartDriftEffects?.dispose();
  session.kartMotionBlur?.dispose();
  session.zetAirEffect?.dispose();
  session.shockWaveEffect?.dispose();
  session.exhaustEffect?.dispose();
  session.crashEffect?.dispose();
  session.chargerEffect?.dispose();
  session.particleModification?.dispose();
  session.particleModification = undefined;
  session.particleModificationBanner?.dispose();
  session.particleModificationBanner = undefined;
  session.particleModificationBannerRequest = undefined;
  session.trackEventEffects?.dispose();
  session.trackEventAudio?.dispose();
  session.trackDummyAudio?.dispose();
  session.lampFlares?.dispose();
  host.kartView.dispose();
  session.simpleShadow?.dispose();
  session.tachometer?.dispose();
  host.presenter.disposeRaceInterface();
  host.ready.dispose();
  session.pause?.dispose();
  session.rain?.dispose();
  session.rainAudio?.dispose();
  session.snow?.dispose();

  audio.interfaceAudio?.dispose();
  audio.bgm?.dispose();
  audio.countdownAudio?.dispose();
  audio.kartAudio?.dispose(false);
  if (audio.context && audio.context.state !== "closed") audio.context.close();
  host.releaseReadyToonEnvironment();
  if (session.toonEnvironment) host.toonStageBinding.retain(session.toonEnvironment);
  session.toonEnvironment?.dispose();
  host.toonStageBinding.dispose();
  session.track?.dispose();
  host.hud.dispose();
  host.renderer.dispose();
  host.renderer.domElement.remove();
}
