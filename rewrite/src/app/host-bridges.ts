/** The application shell's adapters for the Ready coordinator and frame presenter. */

type Value = unknown;

interface ReadySelection {
  trackId?: string;
}

export interface ReadyBridgeApplication {
  root: Value;
  shell: { beginRaceStart(): void; endRaceStart(): void };
  toonStageBinding: Value;
  hud: {
    beginPerformanceRace(): void;
    finishPerformanceRace(): void;
    showDebugText(message: string, kind?: string): void;
  };
  renderer: { info: { programs?: Value[] } };
  input: { setKeyMap(map: Value): void };
  touchControls: { setKeyMap(map: Value): void };
  autoForward: Value;
  rhoLibrary: Value;
  userProfile: Value;
  audio: {
    context?: Value;
    bgm?: Value;
    interfaceAudio?: { playSlotChanger(): void };
  };
  gameOptions: {
    inGameFlyingPetVisible: Value;
    raceAnonymous: Value;
    raceTimeGap: Value;
    classicHud: Value;
  };
  session: { selection?: ReadySelection; vehicleTitle: string };
  timeAttackReadyOptions: Value;
  presenter: {
    clientFramerate: number;
    publishMultiplayer(race: Value): void;
    releaseMultiplayer(race: Value): void;
  };
  replayLibrary: { record(key: Value): Value };
  raceStartProgramCount: number;
  createRaceBuilderHost(): Value;
  releaseRaceForReady(): Value;
  startRace(selection: Value): Value;
  enterTimeAttackReady(selection?: Value): Value;
  selectReadyGarage(selection: Value, options: Value, choice: Value): Value;
  previewSettings(options: Value): Value;
  confirmSettings(options: Value, speed: Value, version: Value): Value;
  closeSettings(): Value;
  saveGameOptions(): Value;
}

export interface ReadyBridgeDependencies {
  makeMultiplayerRaceLoader(configuration: Value): Value;
  applyAudioOptions(context: Value, options: Value): void;
  recordKey(selection: ReadySelection, speed: Value): Value;
  saveProfile(profile: Value): void;
}

export interface ReadyCoordinatorOwner<T> {
  readyCoordinator?: T;
  createReadyHost(): Value;
}

export function getOrCreateReadyCoordinator<T>(
  application: ReadyCoordinatorOwner<T>,
  createCoordinator: (host: Value) => T,
): T {
  return application.readyCoordinator ??=
    createCoordinator(application.createReadyHost());
}

export interface PresenterOwner<T> {
  racePresenter?: T;
  presenterInitialPreviousRenderTime: number;
  createPresenterHost(): Value;
}

export function getOrCreatePresenter<T>(
  application: PresenterOwner<T>,
  createPresenter: (host: Value, previousRenderTime: number) => T,
): T {
  return application.racePresenter ??= createPresenter(
    application.createPresenterHost(),
    application.presenterInitialPreviousRenderTime,
  );
}

/** Preserve live getters so a Ready window always sees the current application state. */
export function createReadyHost(
  application: ReadyBridgeApplication,
  dependencies: ReadyBridgeDependencies,
) {
  return {
    multiplayerRaceLoader: dependencies.makeMultiplayerRaceLoader({
      clientFramerate: application.presenter.clientFramerate,
      renderer: application.renderer,
      input: application.input,
      autoForward: application.autoForward,
      touchControls: application.touchControls,
      assets: () => application.createRaceBuilderHost(),
      profile: () => application.userProfile,
      audio: () => application.audio.context,
      flyingPetVisible: () => application.gameOptions.inGameFlyingPetVisible,
      raceAnonymous: () => application.gameOptions.raceAnonymous,
      raceTimeGap: () => application.gameOptions.raceTimeGap,
      classicHud: () => application.gameOptions.classicHud,
      bgm: () => application.audio.bgm,
      playSlotChanger: () => application.audio.interfaceAudio?.playSlotChanger(),
      publish: (race: Value) => {
        application.raceStartProgramCount = application.renderer.info.programs?.length ?? 0;
        application.hud.beginPerformanceRace();
        application.presenter.publishMultiplayer(race);
      },
      release: (race: Value) => {
        application.hud.finishPerformanceRace();
        application.presenter.releaseMultiplayer(race);
      },
      status: (message: string, isError: boolean) => {
        if (isError) application.hud.showDebugText(message, "error");
      },
    }),
    get root() { return application.root; },
    get shell() { return application.shell; },
    get toonStageBinding() { return application.toonStageBinding; },
    get hud() { return application.hud; },
    getLibrary: () => application.rhoLibrary,
    getProfile: () => application.userProfile,
    setProfile: (profile: Value) => { application.userProfile = profile; },
    getGameOptions: () => application.gameOptions,
    setGameOptions: (options: ReadyBridgeApplication["gameOptions"]) => {
      application.gameOptions = options;
    },
    applyInputKeyMap: (options: { keyMap: Value }) => {
      application.input.setKeyMap(options.keyMap);
      application.touchControls.setKeyMap(options.keyMap);
    },
    applyAudioOptions: (options: Value) => {
      if (application.audio.context) {
        dependencies.applyAudioOptions(application.audio.context, options);
      }
    },
    getSelection: () => application.session.selection,
    setSelection: (selection: ReadySelection) => { application.session.selection = selection; },
    getVehicleTitle: () => application.session.vehicleTitle,
    setVehicleTitle: (title: string) => { application.session.vehicleTitle = title; },
    getReadyOptions: () => application.timeAttackReadyOptions,
    setReadyOptions: (options: Value) => { application.timeAttackReadyOptions = options; },
    getBgm: () => application.audio.bgm,
    getAudioContext: () => application.audio.context,
    getInterfaceAudio: () => application.audio.interfaceAudio,
    getRecordFor: (speed: Value) => {
      const selection = application.session.selection;
      if (selection?.trackId) {
        return application.replayLibrary.record(dependencies.recordKey(selection, speed));
      }
      return undefined;
    },
    saveProfile: () => dependencies.saveProfile(application.userProfile),
    releaseRaceForReady: () => application.releaseRaceForReady(),
    startRace: (selection: Value) => application.startRace(selection),
    enterRaceStart: () => application.shell.beginRaceStart(),
    endRaceStart: () => application.shell.endRaceStart(),
    enterTimeAttackReady: (selection?: Value) => application.enterTimeAttackReady(selection),
    selectReadyGarage: (selection: Value, options: Value, choice: Value) =>
      application.selectReadyGarage(selection, options, choice),
    previewSettings: (options: Value) => application.previewSettings(options),
    confirmSettings: (options: Value, speed: Value, version: Value) =>
      application.confirmSettings(options, speed, version),
    closeSettings: () => application.closeSettings(),
    saveGameOptions: () => application.saveGameOptions(),
  };
}

export interface PresenterBridgeApplication {
  presenter: {
    clientFramerate: number;
    frameTimeSeconds: number;
    presentationClockMs: number;
    previousRenderTime: number;
    maxRafDelayMs: number;
  };
  assets?: { opfs?: { version?: Value } };
  renderer: Value;
  scene: Value;
  camera: Value;
  hud: Value;
  input: Value;
  touchControls: Value;
  kartView: Value;
  lightFactor: Value;
  autoForward: Value;
  nitroSeamless: Value;
  drivingInput: Value;
  toonStageBinding: Value;
  tachometerGaugePreserve: Value;
  workProfiler: Value;
  gameOptions: Value;
  shell: Value;
  session: Value;
  audio: Value;
  ready: Value;
  cameras: { drive: Value; surround: Value };
  warpNext: Value;
  cameraShake: Value;
  cameraWave: Value;
  paused: boolean;
  engineRenderStats: Value;
  drawingBufferSize: Value;
  ghostRecorder: Value;
  records: { currentEquipment(): Value };
  currentPlayerSlot: Value;
  raceStartProgramCount: number;
  physics: Value;
  track: Value;
  devToolsObjectsOverlayHandle?: { update(track: Value, camera: Value, a: Value, b: Value): void };
  drainDrivingInput(a: Value, b: Value): Value;
  getDrivingSnapshot(): Value;
  updateKartBoosterState(a: Value, b: Value, c: Value): Value;
  haltRuntime(a: Value, b: Value): Value;
  updateHud(): Value;
  handleTimeAttackActions(a: Value, b: Value): Value;
  handleTimeAttackActionAudio(a: Value, b: Value): Value;
  updateTimeAttackRoute(a: Value, b: Value, c: Value): Value;
  updateActiveRaceCamera(a: Value): Value;
  advanceResetCompletion(a: Value): Value;
  applyWarpNextActions(a: Value): Value;
  promoteTimeAttackRecord(a: Value, b: Value): Value;
  returnToReady(): Value;
}

/** Bind the frame presenter to the current renderer, race, input and HUD. */
export function createPresenterHost(application: PresenterBridgeApplication) {
  return {
    get clientFramerate() { return application.presenter.clientFramerate; },
    get resourceVersion() { return application.assets?.opfs?.version; },
    get renderer() { return application.renderer; },
    get scene() { return application.scene; },
    get camera() { return application.camera; },
    get hud() { return application.hud; },
    get input() { return application.input; },
    get touchControls() { return application.touchControls; },
    get kartView() { return application.kartView; },
    get lightFactor() { return application.lightFactor; },
    get autoForward() { return application.autoForward; },
    get nitroSeamless() { return application.nitroSeamless; },
    get drivingInput() { return application.drivingInput; },
    get toonStageBinding() { return application.toonStageBinding; },
    get tachometerGaugePreserve() { return application.tachometerGaugePreserve; },
    get workProfiler() { return application.workProfiler; },
    get gameOptions() { return application.gameOptions; },
    get shell() { return application.shell; },
    get session() { return application.session; },
    get audio() { return application.audio; },
    get ready() { return application.ready; },
    get driveCameraman() { return application.cameras.drive; },
    get surroundCameraman() { return application.cameras.surround; },
    get warpNext() { return application.warpNext; },
    get cameraShake() { return application.cameraShake; },
    get cameraWave() { return application.cameraWave; },
    get paused() { return application.paused; },
    get frameTimeSeconds() { return application.presenter.frameTimeSeconds; },
    get presentationClockMs() { return application.presenter.presentationClockMs; },
    set presentationClockMs(value: number) { application.presenter.presentationClockMs = value; },
    get engineRenderStats() { return application.engineRenderStats; },
    get drawingBufferSize() { return application.drawingBufferSize; },
    get ghostRecorder() { return application.ghostRecorder; },
    set ghostRecorder(value: Value) { application.ghostRecorder = value; },
    currentGhostEquipment: () => application.records.currentEquipment(),
    get currentPlayerSlot() { return application.currentPlayerSlot; },
    set currentPlayerSlot(value: Value) { application.currentPlayerSlot = value; },
    get raceStartProgramCount() { return application.raceStartProgramCount; },
    set raceStartProgramCount(value: number) { application.raceStartProgramCount = value; },
    getPhysics: () => application.physics,
    getTrack: () => application.track,
    drainDrivingInput: (a: Value, b: Value) => application.drainDrivingInput(a, b),
    getDrivingSnapshot: () => application.getDrivingSnapshot(),
    updateKartBoosterState: (a: Value, b: Value, c: Value) =>
      application.updateKartBoosterState(a, b, c),
    haltRuntime: (a: Value, b: Value) => application.haltRuntime(a, b),
    updateHud: () => application.updateHud(),
    setPaused: (paused: boolean) => { application.paused = paused; },
    get previousRenderTime() { return application.presenter.previousRenderTime; },
    set previousRenderTime(value: number) { application.presenter.previousRenderTime = value; },
    get maxRafDelayMs() { return application.presenter.maxRafDelayMs; },
    set maxRafDelayMs(value: number) { application.presenter.maxRafDelayMs = value; },
    handleTimeAttackActions: (a: Value, b: Value) => application.handleTimeAttackActions(a, b),
    handleTimeAttackActionAudio: (a: Value, b: Value) =>
      application.handleTimeAttackActionAudio(a, b),
    updateTimeAttackRoute: (a: Value, b: Value, c: Value) =>
      application.updateTimeAttackRoute(a, b, c),
    updateActiveRaceCamera: (a: Value) => application.updateActiveRaceCamera(a),
    updateDevToolsTrackObjects: (track: Value, a: Value, b: Value) =>
      application.devToolsObjectsOverlayHandle?.update(track, application.camera, a, b),
    advanceResetCompletion: (a: Value) => application.advanceResetCompletion(a),
    applyWarpNextActions: (a: Value) => application.applyWarpNextActions(a),
    promoteTimeAttackRecord: (a: Value, b: Value) => application.promoteTimeAttackRecord(a, b),
    returnToReady: () => application.returnToReady(),
  };
}
