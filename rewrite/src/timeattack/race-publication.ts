/** Publish a built solo race into the application after its assets have loaded. */
export interface RaceDisposable {
  dispose(argument?: boolean): void;
}

export interface SceneResource extends RaceDisposable {
  object: unknown;
}

export interface GhostResource {
  view: RaceDisposable & { attachToScene(scene: unknown): void };
}

export interface CharacterDecoration {
  kind: string;
  render: RaceDisposable;
}

export interface SoloRaceResources {
  audioContext: { state: string; close(): void };
  loadedBgm?: RaceDisposable;
  loadedMap: {
    environment: RaceDisposable;
    metadata: { id: string };
    readyCamera: unknown;
    warpNextCamera: unknown;
    admission: unknown;
  };
  loadedVehicle: {
    imported: { renderScene: RaceDisposable };
    effects?: RaceDisposable;
    decoration?: RaceDisposable;
    accessories: CharacterDecoration[];
    trails: SceneResource;
    driftEffects: SceneResource;
    motionBlur?: RaceDisposable;
    zetAirEffect: SceneResource;
    shockWaveEffect: SceneResource;
    exhaustEffect: SceneResource;
    crashEffect: SceneResource;
    chargerEffect?: RaceDisposable;
    particleModification?: RaceDisposable;
    lampFlares?: RaceDisposable;
    simpleShadow: SceneResource;
    tachometerRenderer?: RaceDisposable;
    tachometerSelection: { folder: unknown };
    audio: RaceDisposable & { start(): void };
    kartItem: { itemId: number };
  };
  loadedCharacters: {
    ordinary?: { scene: RaceDisposable };
    linked?: { scene: RaceDisposable };
  };
  nextPhysics: unknown;
  nextTrack: unknown;
  nextRain?: SceneResource;
  nextRainAudio?: RaceDisposable;
  nextSnow?: SceneResource;
  nextGameplayUi: unknown;
  nextAction2D: unknown;
  nextResult: unknown;
  nextTrackInfoCard: unknown;
  nextPause?: RaceDisposable;
  nextCountdownAudio?: RaceDisposable;
  nextTrackEventEffects?: RaceDisposable;
  nextTrackEventAudio?: RaceDisposable;
  nextTrackDummyAudio?: RaceDisposable;
  nextLinkedCharacterPresentation: unknown;
  nextFlyingPet?: RaceDisposable;
  nextGhosts: GhostResource[];
  /** 驾照考试 item steps: the item race (license-item-race.ts). */
  nextLicenseItems?: SceneResource;
  rankColors: unknown;
  selectedVehicle: { title: string };
  particleModificationBanner?: RaceDisposable;
  particleModificationBannerRequest: unknown;
  outlineBatch?: RaceDisposable;
}

export interface SoloRaceSession {
  coordinator?: RaceDisposable;
  flyingPet?: RaceDisposable;
  vehicleRender?: RaceDisposable;
  characterRender?: RaceDisposable;
  linkedCharacterRender?: RaceDisposable;
  linkedCharacterPresentation?: unknown;
  outlineBatch?: RaceDisposable;
  kartEffects?: RaceDisposable;
  ghosts: GhostResource[];
  licenseItems?: SceneResource;
  balloonDecoration?: RaceDisposable;
  characterDecorations: CharacterDecoration[];
  raceAura?: RaceDisposable;
  kartTrails?: SceneResource;
  kartDriftEffects?: SceneResource;
  kartMotionBlur?: RaceDisposable;
  zetAirEffect?: SceneResource;
  shockWaveEffect?: SceneResource;
  exhaustEffect?: SceneResource;
  crashEffect?: SceneResource;
  chargerEffect?: RaceDisposable;
  particleModification?: RaceDisposable;
  particleModificationBanner?: RaceDisposable;
  particleModificationBannerRequest?: unknown;
  trackEventEffects?: RaceDisposable;
  trackEventAudio?: RaceDisposable;
  trackDummyAudio?: RaceDisposable;
  lampFlares?: RaceDisposable;
  simpleShadow?: SceneResource;
  tachometer?: RaceDisposable;
  pause?: RaceDisposable;
  rain?: SceneResource;
  rainAudio?: RaceDisposable;
  snow?: SceneResource;
  toonEnvironment?: RaceDisposable;
  trackMetadata?: SoloRaceResources["loadedMap"]["metadata"];
  readyCamera?: unknown;
  warpNextCamera?: unknown;
  admission?: unknown;
  rankColors?: unknown;
  localName?: unknown;
  physics?: unknown;
  selection?: object;
  vehicleTitle?: string;
  lifecycle?: unknown;
}

export interface SoloRacePublisher {
  session: SoloRaceSession;
  audio: {
    bgm?: RaceDisposable;
    bgmTrackId?: string;
    context?: { state: string; close(): void };
    countdownAudio?: RaceDisposable;
    kartAudio?: RaceDisposable & { start(): void };
  };
  cameras: { beginNewStage(): void };
  scene: { add(object: unknown): void };
  toonStageBinding: { retain(environment: RaceDisposable): void };
  tachometerGaugePreserve: { configure(folder: unknown): void };
  presenter: {
    disposeRaceInterface(): void;
    changeStage(name: string, configuration: unknown): void;
  };
  library: { record(key: unknown): { elapsedMs?: number } | undefined };
  ready: { releaseForRace(): void };
  shell: { enterRace(): void };
  input: { setEnabled(enabled: boolean): void };
  hud: { setPaused(paused: boolean): void };
  getRaceBuilder(): {
    build(selection: object, options: unknown, stage: RaceCoatingStage | undefined): Promise<SoloRaceResources>;
  };
  getReadyOptions(): unknown;
  getLocalNickname(): unknown;
  replaceTrack(track: unknown): void;
  applyRaceOptions(kartItemId: number): void;
  setPaused(paused: boolean): void;
}

export interface RaceCoatingStage {
  validate(): void;
  commit(): void;
}

export interface RacePublicationDependencies {
  createLifecycle(previousRecordMs: number | null): unknown;
  recordKey(selection: object, options: unknown): unknown;
  raceParam(options: unknown): unknown;
}

/** Preserve release order: build, release old owners, attach new owners, commit, start. */
export async function publishSoloRace(
  host: SoloRacePublisher,
  selection: object,
  coatingStage: RaceCoatingStage | undefined,
  dependencies: RacePublicationDependencies,
): Promise<void> {
  const resources = await host.getRaceBuilder().build(selection, host.getReadyOptions(), coatingStage);
  const {
    audioContext, loadedBgm, loadedMap, loadedVehicle, loadedCharacters,
    nextPhysics, nextTrack, nextRain, nextRainAudio, nextSnow,
    nextGameplayUi, nextAction2D, nextResult, nextTrackInfoCard,
    nextPause, nextCountdownAudio, nextTrackEventEffects,
    nextTrackEventAudio, nextTrackDummyAudio, nextLinkedCharacterPresentation,
    nextFlyingPet, nextGhosts, rankColors, selectedVehicle,
    particleModificationBanner, particleModificationBannerRequest, outlineBatch, nextLicenseItems,
  } = resources;
  const session = host.session;
  const audio = host.audio;

  // The loaded resources are ready. Release every previous race owner before
  // exposing the new one to the scene and presenter.
  session.coordinator?.dispose();
  session.flyingPet?.dispose();
  session.flyingPet = undefined;
  session.vehicleRender?.dispose();
  session.characterRender?.dispose();
  session.linkedCharacterRender?.dispose();
  session.outlineBatch?.dispose();
  session.outlineBatch = undefined;
  session.kartEffects?.dispose();
  for (const ghost of session.ghosts) ghost.view.dispose();
  session.ghosts = [];
  if (session.licenseItems) {
    session.licenseItems.dispose();
    session.licenseItems = undefined;
  }
  session.balloonDecoration?.dispose();
  session.characterDecorations.forEach(({ render }) => render.dispose());
  session.characterDecorations = [];
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
  session.particleModificationBanner?.dispose();
  session.particleModificationBanner = undefined;
  session.particleModificationBannerRequest = undefined;
  session.trackEventEffects?.dispose();
  session.trackEventAudio?.dispose();
  session.trackDummyAudio?.dispose();
  session.lampFlares?.dispose();
  session.simpleShadow?.dispose();
  session.tachometer?.dispose();
  host.presenter.disposeRaceInterface();
  session.pause?.dispose();
  session.rain?.dispose();
  session.rainAudio?.dispose();
  session.snow?.dispose();
  if (audio.bgm !== loadedBgm) audio.bgm?.dispose();
  audio.countdownAudio?.dispose();
  audio.kartAudio?.dispose(false);
  if (session.toonEnvironment) host.toonStageBinding.retain(session.toonEnvironment);
  session.toonEnvironment?.dispose();
  if (audio.context && audio.context !== audioContext && audio.context.state !== "closed") {
    audio.context.close();
  }

  host.cameras.beginNewStage();
  host.replaceTrack(nextTrack);
  session.toonEnvironment = loadedMap.environment;
  session.trackMetadata = loadedMap.metadata;
  session.vehicleRender = loadedVehicle.imported.renderScene;
  session.flyingPet = nextFlyingPet;
  session.characterRender = loadedCharacters.ordinary?.scene;
  session.linkedCharacterRender = loadedCharacters.linked?.scene;
  session.linkedCharacterPresentation = nextLinkedCharacterPresentation;
  session.readyCamera = loadedMap.readyCamera;
  session.warpNextCamera = loadedMap.warpNextCamera;
  session.kartEffects = loadedVehicle.effects;
  session.balloonDecoration = loadedVehicle.decoration;
  session.characterDecorations = loadedVehicle.accessories;
  session.raceAura = loadedVehicle.accessories.find(({ kind }) => kind === "aura")?.render;
  session.kartTrails = loadedVehicle.trails;
  session.kartDriftEffects = loadedVehicle.driftEffects;
  session.kartMotionBlur = loadedVehicle.motionBlur;
  session.zetAirEffect = loadedVehicle.zetAirEffect;
  session.shockWaveEffect = loadedVehicle.shockWaveEffect;
  session.exhaustEffect = loadedVehicle.exhaustEffect;
  session.crashEffect = loadedVehicle.crashEffect;
  session.chargerEffect = loadedVehicle.chargerEffect;
  session.particleModification = loadedVehicle.particleModification;
  session.particleModificationBanner = particleModificationBanner;
  session.particleModificationBannerRequest = particleModificationBannerRequest;
  session.trackEventEffects = nextTrackEventEffects;
  session.trackEventAudio = nextTrackEventAudio;
  session.trackDummyAudio = nextTrackDummyAudio;
  session.lampFlares = loadedVehicle.lampFlares;
  session.simpleShadow = loadedVehicle.simpleShadow;
  session.tachometer = loadedVehicle.tachometerRenderer;
  host.tachometerGaugePreserve.configure(loadedVehicle.tachometerSelection.folder);
  session.pause = nextPause;
  session.rain = nextRain;
  session.rainAudio = nextRainAudio;
  session.snow = nextSnow;
  audio.bgm = loadedBgm;
  audio.bgmTrackId = loadedMap.metadata.id;
  audio.context = audioContext;
  audio.countdownAudio = nextCountdownAudio;
  session.admission = loadedMap.admission;

  if (session.rain) host.scene.add(session.rain.object);
  if (session.snow) host.scene.add(session.snow.object);
  host.scene.add(session.kartTrails.object);
  host.scene.add(session.kartDriftEffects.object);
  host.scene.add(session.zetAirEffect.object);
  host.scene.add(session.shockWaveEffect.object);
  host.scene.add(session.exhaustEffect.object);
  host.scene.add(session.crashEffect.object);
  host.scene.add(session.simpleShadow.object);
  session.ghosts = [...nextGhosts];
  if (nextLicenseItems) {
    session.licenseItems = nextLicenseItems;
    host.scene.add(nextLicenseItems.object);
  }
  session.rankColors = rankColors;
  session.localName = host.getLocalNickname();
  session.outlineBatch = outlineBatch;
  for (const ghost of session.ghosts) ghost.view.attachToScene(host.scene);

  audio.kartAudio = loadedVehicle.audio;
  session.physics = nextPhysics;
  session.selection = { ...selection };
  session.vehicleTitle = selectedVehicle.title;
  const previousRecord = host.library.record(
    dependencies.recordKey(selection, host.getReadyOptions()),
  )?.elapsedMs ?? null;
  session.lifecycle = dependencies.createLifecycle(previousRecord);

  coatingStage?.validate();
  host.ready.releaseForRace();
  coatingStage?.commit();
  host.shell.enterRace();
  host.applyRaceOptions(loadedVehicle.kartItem.itemId);
  host.setPaused(false);
  host.input.setEnabled(false);
  host.hud.setPaused(false);
  audio.kartAudio.start();
  host.presenter.changeStage("TimeAttackStage", {
    param: dependencies.raceParam(host.getReadyOptions()),
    owners: {
      gameplayUi: nextGameplayUi,
      action2D: nextAction2D,
      result: nextResult,
      trackInfoCard: nextTrackInfoCard,
    },
  });
}
