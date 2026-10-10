/** Live bridges from the application shell to the race builder and driving input. */

export interface RuntimeHostApplication {
  importer: unknown;
  targetRandom: unknown;
  toonStageBinding: unknown;
  renderer: unknown;
  scene: unknown;
  userProfile: unknown;
  gameOptions: { shadow: unknown; gamepadMap: unknown };
  hud: unknown;
  root: unknown;
  kartView: unknown;
  replayLibrary: { store: unknown; records: unknown };
  audio: unknown;
  ghostSamplingMode: unknown;
  rhoLibrary: unknown;
  assets: {
    generationValue: unknown;
    isCurrent(generation: unknown): boolean;
    require(asset: unknown): unknown;
    preloadContainers(...args: unknown[]): unknown;
  };
  session: {
    vehicleTitle: unknown;
    lifecycle: unknown;
    tachometer: unknown;
    lampFlares: unknown;
  };
  input: unknown;
  drivingInput: unknown;
  autoForward: unknown;
  nitroSeamless: unknown;
  gamepad: unknown;
  touchControls: { resumeAutoForwardForGamepad(): unknown };
  physics: unknown;
  raceBuilderInstance?: unknown;
  drivingPipelineInstance?: unknown;
  createRaceBuilderHost(): RaceBuilderHost;
  createDrivingPipelineHost(): DrivingPipelineHost;
  togglePause(): unknown;
  restartRaceFromPause(): unknown;
  returnToReady(): unknown;
  initiateSpeedReset(allowCurrentSpeed: unknown): unknown;
}

export interface RaceBuilderHost {
  readonly importer: unknown;
  readonly targetRandom: unknown;
  readonly toonStageBinding: unknown;
  readonly renderer: unknown;
  readonly scene: unknown;
  readonly userProfile: unknown;
  readonly shadow: unknown;
  readonly hud: unknown;
  readonly root: unknown;
  readonly kartView: unknown;
  readonly ghostStore: unknown;
  readonly timeAttackRecords: unknown;
  readonly gameOptions: RuntimeHostApplication["gameOptions"];
  readonly audio: unknown;
  readonly webTimeAttackAiDyeId: unknown;
  readonly ghostSamplingMode: unknown;
  getLibrary(): unknown;
  generationValue(): unknown;
  isGenerationCurrent(generation: unknown): boolean;
  requireAsset(asset: unknown): unknown;
  preloadContainers(first: unknown, second: unknown, third: unknown, fourth: unknown): unknown;
  setVehicleTitle(title: unknown): void;
  togglePause(): unknown;
  restartRaceFromPause(): unknown;
  returnToReady(): unknown;
  timeAttackRecordKey(selection: unknown, options: unknown): unknown;
}

export interface DrivingPipelineHost {
  readonly input: unknown;
  readonly drivingInput: unknown;
  readonly autoForward: unknown;
  readonly nitroSeamless: unknown;
  readonly gamepad: unknown;
  getGamepadPads(): unknown;
  getGamepadMap(): unknown;
  resumeGamepadAutoForward(): unknown;
  getPhysics(): unknown;
  getLifecycle(): unknown;
  getTachometer(): unknown;
  getLampFlares(): unknown;
  handleSpeedReset(allowCurrentSpeed: unknown): unknown;
}

/** Supply the builder with current resources, options, and shell commands. */
export function createRaceBuilderHost(
  app: RuntimeHostApplication,
  webTimeAttackAiDyeId: unknown,
  recordKey: (selection: unknown, options: unknown) => unknown,
): RaceBuilderHost {
  return {
    get importer() { return app.importer; },
    get targetRandom() { return app.targetRandom; },
    get toonStageBinding() { return app.toonStageBinding; },
    get renderer() { return app.renderer; },
    get scene() { return app.scene; },
    get userProfile() { return app.userProfile; },
    get shadow() { return app.gameOptions.shadow; },
    get hud() { return app.hud; },
    get root() { return app.root; },
    get kartView() { return app.kartView; },
    get ghostStore() { return app.replayLibrary.store; },
    get timeAttackRecords() { return app.replayLibrary.records; },
    get gameOptions() { return app.gameOptions; },
    get audio() { return app.audio; },
    get webTimeAttackAiDyeId() { return webTimeAttackAiDyeId; },
    get ghostSamplingMode() { return app.ghostSamplingMode; },
    getLibrary: () => app.rhoLibrary,
    generationValue: () => app.assets.generationValue,
    isGenerationCurrent: generation => app.assets.isCurrent(generation),
    requireAsset: asset => app.assets.require(asset),
    preloadContainers: (first, second, third, fourth) =>
      app.assets.preloadContainers(first, second, third, fourth),
    setVehicleTitle: title => { app.session.vehicleTitle = title; },
    togglePause: () => app.togglePause(),
    restartRaceFromPause: () => app.restartRaceFromPause(),
    returnToReady: () => app.returnToReady(),
    timeAttackRecordKey: (selection, options) => recordKey(selection, options),
  };
}

/** Supply the input pipeline with live controls and race state. */
export function createDrivingPipelineHost(
  app: RuntimeHostApplication,
  getGamepads: () => unknown,
): DrivingPipelineHost {
  return {
    get input() { return app.input; },
    get drivingInput() { return app.drivingInput; },
    get autoForward() { return app.autoForward; },
    get nitroSeamless() { return app.nitroSeamless; },
    get gamepad() { return app.gamepad; },
    getGamepadPads: () => getGamepads() ?? [],
    getGamepadMap: () => app.gameOptions.gamepadMap,
    resumeGamepadAutoForward: () => app.touchControls.resumeAutoForwardForGamepad(),
    getPhysics: () => app.physics,
    getLifecycle: () => app.session.lifecycle,
    getTachometer: () => app.session.tachometer,
    getLampFlares: () => app.session.lampFlares,
    handleSpeedReset: allowCurrentSpeed => app.initiateSpeedReset(allowCurrentSpeed),
  };
}

/** Keep builder construction lazy and cache the instance for the shell lifetime. */
export function getOrCreateRaceBuilder<Builder>(
  app: RuntimeHostApplication,
  createBuilder: (host: RaceBuilderHost) => Builder,
): Builder {
  return (app.raceBuilderInstance ??= createBuilder(app.createRaceBuilderHost())) as Builder;
}

/** The driving pipeline is also created on first use with live shell access. */
export function getOrCreateDrivingPipeline<Pipeline>(
  app: RuntimeHostApplication,
  createPipeline: (host: DrivingPipelineHost) => Pipeline,
): Pipeline {
  return (app.drivingPipelineInstance ??= createPipeline(app.createDrivingPipelineHost())) as Pipeline;
}
