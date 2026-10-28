import { trackDisplayTitle } from "../resources/track-names";
import { beginRaceLoad } from "../resources/resource-manager";
import { c5, y9 } from "../generated/formats.js";
import { he, Q9, S9, vI } from "../generated/library.js";
import { LicenseItemRace } from "../license/license-item-race";
import { loadHazardTraps, type HazardTraps } from "../item/hazard-traps";
import { uniqueOriginalCoinAsset } from "../vehicle/track-coin-source";
import { licenseSceneNames } from "../license/license-mission";
import { itemRaceVehicleSpec } from "../physics/item-race-tuning";
import { LicenseScenes } from "../license/license-scenes";
import { MissionTimerPanel } from "../license/mission-timer-panel";
import { MissionResultAction, StoryAction2D } from "../story/mission-result-action";
import { WrongWayWarning } from "../ui/wrong-way-warning";
import { kartAlignedPetOwner } from "../world/flying-pet-mount";
import { AutopilotPrank, isAutopilotKart, loadAutopilotPrompts } from "../ui/autopilot-prank";
import type { StoryRaceRequest } from "../story/story-race";
import { racePlaylistReady } from "./race-bgm-loading";
import { FormulaRuntime } from "../formula/formula-runtime";

/** The item presenter's model and sound ops (the multiplayer race's itemPresenterOps). */
const hazardTrapOps = {
  originalAsset: (archive: unknown, path: string) => uniqueOriginalCoinAsset(archive as never, path),
  decodeModel: (bytes: Uint8Array) => y9(bytes),
  decodeAudio: Q9,
  loadModel: (data: unknown, archive: unknown, path: string, identity: unknown, options: unknown) =>
    c5(data as never, archive as never, path, identity as never, options as never),
  routeAudio: S9,
  setGain: he,
} as never;

/**
 * Construct every owner needed by a solo race before the application publishes it.
 *
 * The dependency map is the boundary to the recovered rendering/physics runtime.
 * Keeping the orchestration here makes acquisition and failure cleanup editable.
 */
export interface SoloRaceSelection {
  /** Story mode: rival ghosts and lap count for this race. */
  story?: StoryRaceRequest;
  mapPath?: string;
  trackId?: string;
  vehiclePath?: string;
  vehicleItemId?: number;
  vehicleSystemKey?: unknown;
  characterPath?: string;
  characterItemId?: number;
}

/** A selection whose track, kart and character are resolved. */
type ResolvedSoloRaceSelection = SoloRaceSelection & Required<Pick<SoloRaceSelection,
  "mapPath" | "trackId" | "vehiclePath" | "vehicleItemId" | "characterPath" | "characterItemId">>;

export interface SoloRaceBuildOptions {
  booster: number;
  speed: number;
  version?: string;
  showGhost?: boolean;
}

export interface SoloRaceCoatingStage {
  textures(library: unknown): unknown;
}

/** The host and adapters still cross the recovered runtime boundary. */
export interface SoloRaceAssetBuilderAdapter {
  host: any;
  loadAssetMap(mapPath: string, trackId: string): Promise<any>;
  loadVehicleAsset(...args: any[]): Promise<any>;
  loadRaceCharacters(...args: any[]): Promise<any>;
  loadGhostKartAssets(...args: any[]): Promise<any>;
  loadGhostDecorations(...args: any[]): Promise<any>;
  rankColors(ghosts: unknown[]): Promise<any>;
}

export async function buildSoloRaceAssets(
  builder: SoloRaceAssetBuilderAdapter,
  selection: SoloRaceSelection,
  raceOptions: SoloRaceBuildOptions,
  coatingStage: SoloRaceCoatingStage | undefined,
  ops: Record<string, any>,
): Promise<any> {
  const host = builder.host;
  if (!selection.mapPath || !selection.trackId || !selection.vehiclePath ||
      selection.vehicleItemId === undefined || !selection.characterPath ||
      !selection.characterItemId) {
    throw new Error("请先选择一辆已解析车辆、一个人物和一张已解析赛道。");
  }
  ops.validateItemId(selection.vehicleItemId);
  // Nothing downloads whole first: what every race reads is fetched at once,
  // the track, kart and character by range as they load (resource-manager).
  const endRaceLoad = beginRaceLoad();
  try {
    return await buildLoadedSoloRace(builder, selection as ResolvedSoloRaceSelection, raceOptions,
      coatingStage, ops);
  } finally {
    endRaceLoad();
  }
}

/** The race assets of a validated selection. */
async function buildLoadedSoloRace(
  builder: SoloRaceAssetBuilderAdapter,
  selection: ResolvedSoloRaceSelection,
  raceOptions: SoloRaceBuildOptions,
  coatingStage: SoloRaceCoatingStage | undefined,
  ops: Record<string, any>,
): Promise<any> {
  const host = builder.host;
  const characterPath = selection.characterPath;
  const generation = host.generationValue();
  const classicHud = host.gameOptions.classicHud;
  // 冰河圣诞版 HUD only when the player ticked it in 设置.
  const xmasHud = host.gameOptions.xmasHud === true;
  const teamBooster = raceOptions.booster === 1;
  const catalog = await host.getLibrary()?.timeAttackGarageCatalog();
  const kart = catalog && ops.findKart(catalog.karts, selection.vehicleItemId,
    selection.vehiclePath, selection.vehicleSystemKey);
  if (!kart)
    throw new Error(`${selection.vehiclePath} 缺少精确 Garage 展示身份。`);
  if (!catalog?.characters.find((character: any) =>
    character.itemId === selection.characterItemId &&
    character.path.toLowerCase() === characterPath.toLowerCase())) {
    throw new Error(`${selection.characterPath} 缺少精确 Garage 人物身份。`);
  }
  const characterItem = await host.getLibrary()?.timeAttackCharacterItem(
    selection.characterItemId, selection.characterPath);
  if (!characterItem)
    throw new Error("人物 ItemCharacter identity 尚未载入。");

  const createParameters = await ops.loadParameterFactory();
  const speed = ops.speed(raceOptions);
  const version = raceOptions.version ?? ops.defaultVersion;
  const bodyParameter = kart.itemId === 0
    ? (await ops.loadBodyParameter(host.getLibrary(), kart.path,
      kart.systemKey)).parameter.value
    : undefined;
  const { spec } = createParameters(
    { itemId: kart.itemId, systemKey: kart.systemKey }, speed,
    bodyParameter, version);
  const activeSerial = selection.vehicleItemId ===
    host.userProfile.equipment.itemIds[3]
    ? host.userProfile.equipment.kartSerial : 0;
  const garageState = ops.garageState(host.userProfile.garage,
    selection.vehicleItemId, activeSerial);
  const tunedSpec = ops.tuneSpec(spec, kart.engineGrade ?? 0,
    garageState, speed);
  const library = host.getLibrary();
  const flyingPetItem = await ops.flyingPetItem(library,
    host.userProfile.equipment.itemIds[52]);
  const timeAttackSpec = flyingPetItem
    ? ops.applyFlyingPetSpec(spec, kart.engineGrade ?? 0, garageState, speed,
      (await ops.loadBodyParameter(library, kart.path,
        kart.systemKey)).parameter.value,
      await ops.loadFlyingPetAbility(library, flyingPetItem.internalId),
      (value: any) => ops.finalizeSpec(value, version, speed))
    : ops.finalizeSpec(tunedSpec, version, speed);
  // 驾照考试 item steps drive the item race kart (道具赛): its booster item, its
  // item slots (itemSlotCnt, else two) and no drift boosters.
  const licenseItemStep = selection.story?.license?.rule === "item"
    ? selection.story.license : undefined;
  const itemMode = licenseItemStep ? vI(2) : undefined;
  const physicsSpec = licenseItemStep
    ? { ...itemRaceVehicleSpec(timeAttackSpec, itemMode, bodyParameter,
      host.userProfile.equipment.itemIds[52]),
    itemSlotCapacity: licenseItemStep.setup.slotCount === 1 ? 1 : 2 }
    : timeAttackSpec;
  const particleRequest = ops.particleModification(garageState,
    kart.engineGrade, teamBooster ? "team" : "personal", speed);
  let particleBanner: any;
  if (particleRequest) {
    const resources = host.getLibrary();
    if (resources) {
      try { particleBanner = await ops.loadParticleBanner(resources, host.root); }
      catch { particleBanner = undefined; }
    }
  }

  try {
    host.setVehicleTitle(kart.title);
    const reuseAudio = !!(host.audio.bgm && host.audio.context &&
      host.audio.context.state !== "closed");
    const audioContext = reuseAudio ? host.audio.context : ops.createAudioContext();
    ops.configureAudio(audioContext, host.gameOptions);
    if (!reuseAudio) await audioContext.resume();
    const closeNewAudio = () => {
      if (!reuseAudio && audioContext.state !== "closed") audioContext.close();
    };
    let map: any;
    try {
      map = await builder.loadAssetMap(selection.mapPath, selection.trackId);
      if (selection.story?.laps) map.data.lapTarget = selection.story.laps;
      if (selection.story?.formula) map.metadata = { ...map.metadata, bgmTheme: 'f1' };
    } catch (error) {
      closeNewAudio();
      throw new Error(`赛道载入失败：${error instanceof Error ? error.message : String(error)}`);
    }
    const disposeMap = () => {
      map.renderScene?.dispose();
      map.skydome?.dispose();
      map.environment.dispose();
    };
    let bgm = reuseAudio ? host.audio.bgm : undefined;
    try {
      if (bgm) {
        if (host.audio.bgmTrackId !== map.metadata.id ||
            Boolean(host.audio.bgmFormula) !== Boolean(selection.story?.formula))
          await bgm.selectRace(host.getLibrary(), map.metadata);
      } else {
        bgm = await ops.loadRaceBgm(host.getLibrary(), map.metadata,
          host.targetRandom, audioContext);
      }
      // The race music loadRaceBgm (here or at startup) left decoding.
      await racePlaylistReady(bgm, host.getLibrary(), map.metadata);
      host.audio.bgmFormula = Boolean(selection.story?.formula);
    } catch (error) {
      disposeMap();
      closeNewAudio();
      throw new Error(`赛道 BGM 载入失败：${error instanceof Error ? error.message : String(error)}`);
    }
    const disposeNewBgm = () => { if (!reuseAudio) bgm.dispose(); };
    const boosterVisuals = ops.createBoosterVisuals();
    const outlineBatch = ops.createOutlineBatch();
    host.scene.add(outlineBatch.object);
    let vehicle: any;
    try {
      vehicle = await builder.loadVehicleAsset(selection.vehiclePath,
        selection.vehicleItemId, selection.vehicleSystemKey, physicsSpec,
        selection.trackId, map.environment, map.stageBinding, audioContext,
        coatingStage?.textures(host.getLibrary()), boosterVisuals,
        undefined, false, classicHud, xmasHud && map.data.xmas === true);
    } catch (error) {
      disposeNewBgm();
      outlineBatch.dispose();
      disposeMap();
      closeNewAudio();
      throw new Error(`车辆载入失败：${error instanceof Error ? error.message : String(error)}`);
    }
    const disposeVehicle = () => {
      vehicle.particleModification?.dispose();
      vehicle.imported.renderScene?.dispose();
      vehicle.effects.dispose();
      vehicle.trails.dispose();
      vehicle.driftEffects.dispose();
      vehicle.motionBlur?.dispose();
      vehicle.zetAirEffect.dispose();
      vehicle.shockWaveEffect.dispose();
      vehicle.exhaustEffect.dispose();
      vehicle.crashEffect.dispose();
      vehicle.chargerEffect.dispose();
      vehicle.roadDust?.dispose();
      vehicle.lampFlares.dispose();
      vehicle.simpleShadow.dispose();
      vehicle.tachometerRenderer.dispose();
    };
    let characters: any;
    try {
      characters = await builder.loadRaceCharacters(selection.characterPath,
        characterItem, vehicle.kartItem, vehicle.visual.reverse,
        vehicle.physicsParams.motorcycleType, map.environment,
        map.stageBinding);
    } catch (error) {
      disposeNewBgm();
      disposeMap();
      disposeVehicle();
      outlineBatch.dispose();
      vehicle.audio.dispose(false);
      ops.disposeImportedObject(vehicle.imported.object);
      closeNewAudio();
      throw new Error(`人物载入失败：${error instanceof Error ? error.message : String(error)}`);
    }

    const physics = itemMode
      ? ops.createPhysics(vehicle.physicsParams, vehicle.collisionShape, false,
        raceOptions.speed === 4, false, itemMode)
      : ops.createPhysics(vehicle.physicsParams,
        vehicle.collisionShape, raceOptions.booster !== 0,
        raceOptions.speed === 4);
    let track: any, rain: any, rainAudio: any, snow: any;
    let licenseItems: LicenseItemRace | undefined;
    let hazardTraps: HazardTraps | undefined;
    let wrongWay: WrongWayWarning | undefined;
    let autopilot: AutopilotPrank | undefined;
    let formula: FormulaRuntime | undefined;
    let gameplayUi: any, action2D: any, result: any, trackInfoCard: any;
    let pause: any, countdownAudio: any, eventEffects: any, eventAudio: any;
    let dummyAudio: any, linkedPresentation: any, flyingPet: any;
    let lensFlare: any;
    const ghostSources: any[] = [];
    const ghosts: any[] = [];
    let rankColors: any;
    try {
      const recordKey = host.timeAttackRecordKey(selection, raceOptions);
      // Story races bring their rival ghosts instead of the local record.
      const ghostRecord = selection.story
        ? { participants: selection.story.ghosts }
        : raceOptions.showGhost &&
          host.timeAttackRecords.get(recordKey)?.hasGhost === true
          ? await host.ghostStore.get(recordKey) : undefined;
      if (ghostRecord) {
        for (const participant of ghostRecord.participants) {
          const slot = participant.equipment.startSlot;
          if (!Number.isInteger(slot) || slot < 0 || slot > (selection.story?.formula ? 19 : 8)) {
            host.hud.showDebugText(
              `幽灵记录缺少有效起跑槽位（${String(slot)}）；旧记录请重新导入 .ksv，本局跳过该影子。`,
              "error");
            continue;
          }
          ghostSources.push({ equipment: participant.equipment,
            record: participant.record, timeOffsetMs: participant.timeOffsetMs,
            solid: participant.solid, hideCharacter: participant.hideCharacter });
        }
      }
      // OB 观看: the console's 退出 leaves like the pause menu's 菜单.
      if (selection.story?.observe) selection.story.observe.exit = () => { host.returnToReady(); };

      if (map.lensFlarePoint)
        lensFlare = await ops.loadLensFlare(host.getLibrary(), map.lensFlarePoint);
      track = ops.createTrack(map.data, map.scene, map.renderScene,
        map.skydome, lensFlare);
      if (selection.story?.formula)
        formula = new FormulaRuntime(selection.story.formula, host, track, physics);
      lensFlare = undefined;
      ops.applyTrackFog(host.scene, track);
      ops.prepareScene(host.renderer, map.scene, host.scene, true);
      if (map.skydome)
        ops.prepareScene(host.renderer, map.skydome.object, host.scene, true);
      if (map.data.weather?.rainEnabled) {
        rain = ops.createRain(host.targetRandom, map.data.weather.rainOnStart);
        rainAudio = await ops.loadRainAudio(host.getLibrary(), audioContext);
      }
      if (map.data.weather?.snowEnabled)
        snow = await ops.loadSnow(host.getLibrary(), host.targetRandom);
      const tachometer = await ops.loadTachometer(host.getLibrary(),
        vehicle.tachometerSelection, host.webTimeAttackAiDyeId,
        vehicle.kartItem.engineGrade, xmasHud && map.data.xmas === true);
      const minimap = await ops.loadMinimap(host.getLibrary(), map.path,
        map.metadata, map.minimap, map.environment, map.stageBinding,
        ghostSources.length);
      // Item races have no N2O gauge (ITEM_MODE.md §1).
      gameplayUi = ops.createGameplayUi(licenseItemStep
        ? { ...tachometer, boostVisible: false, teamBoostVisible: false } : tachometer, minimap);
      // 驾照考试 hideMiniMap / showTimeUI='FALSE' (riderSchool@cn.xml).
      const licenseSetup = selection.story?.license?.setup;
      if (licenseSetup?.hideMiniMap) gameplayUi.setMinimapVisible?.(false);
      if (licenseSetup?.showTimeUI === false) gameplayUi.setTimeInfoVisible?.(false);
      if (vehicle.classicHud && !licenseItemStep)
        await gameplayUi.loadClassicBoost(host.getLibrary(), teamBooster);
      if (licenseItemStep) {
        if (!map.licenseModel) throw new Error("驾照道具关卡缺少赛道原件。");
        licenseItems = await LicenseItemRace.load({
          library: host.getLibrary(), spec: licenseItemStep, trackId: selection.trackId,
          model: map.licenseModel, environment: map.environment, stageBinding: map.stageBinding,
          audioContext, physics, slots: gameplayUi.definition?.items,
          warn: message => host.hud.showDebugText(message, "error"),
        });
      }
      map.licenseModel = undefined;
      // The carriers' water mines catch the kart (not in a 驾照 item step, which is an item race).
      if (!licenseItemStep && map.hazardSceneryObjects) {
        hazardTraps = await loadHazardTraps(host.getLibrary(), map, audioContext, hazardTrapOps).catch(error => {
          host.hud.showDebugText(`赛道水雷未能载入：${error instanceof Error ? error.message : String(error)}`, "error");
          return undefined;
        });
      }
      // Story races also load retire@zz (未完成) for a failed mission.
      action2D = ops.createAction2D(await ops.loadAction2D(host.getLibrary(), Boolean(selection.story)));
      if (selection.story && !selection.story.formula) {
        // The mission result animation is a bonus: race on without it if it cannot load.
        try {
          // Loaded first: if it fails, nothing else of the overlay is left to release.
          const mission = await MissionResultAction.load(host.getLibrary(), audioContext);
          // 驾照考试 steps with a time limit count it down on the release mission timer.
          const timer = selection.story.timeLimitMs
            ? await MissionTimerPanel.load(host.getLibrary()).catch(error => {
              host.hud.showDebugText(`任务计时器未能载入：${
                error instanceof Error ? error.message : String(error)}`, "error");
              return undefined;
            }) : undefined;
          // 驾照考试 key prompts and the course's tutorial hints.
          const license = selection.story.license;
          const scenes = license ? await LicenseScenes.load(host.getLibrary(),
            licenseSceneNames(license, map.data.licenseEvents),
            warning => host.hud.showDebugText(warning, "error")) : undefined;
          action2D = new StoryAction2D(action2D, mission, timer, scenes);
        } catch (error) {
          host.hud.showDebugText(`任务结果动画未能载入：${
            error instanceof Error ? error.message : String(error)}`, "error");
        }
      }
      // 逆向提示 is a bonus too; an OB replay has no local kart to warn.
      if (!selection.story?.observe) {
        wrongWay = await WrongWayWarning.load(host.getLibrary(), audioContext).catch(error => {
          host.hud.showDebugText(`逆向提示未能载入：${
            error instanceof Error ? error.message : String(error)}`, "error");
          return undefined;
        });
      }
      result = ops.createResult(await ops.loadResult(host.getLibrary()));
      if (ops.versionTag("p3553") === "p3553") {
        const trackDirectory = map.path.replaceAll("\\", "/").split("/").at(-2);
        if (!trackDirectory) throw new Error("赛道信息卡缺少赛道目录。");
        trackInfoCard = await ops.loadTrackInfoCard({
          library: host.getLibrary(), root: host.root,
          trackId: selection.trackId, trackDirectory,
          trackTitle: trackDisplayTitle(selection.trackId, map.metadata.cnTitle ?? ""),
          difficulty: map.metadata.difficulty,
          game: { modeKey: "TimeAttack",
            modeSuffixKey: teamBooster ? "teamGame" : "indiGame", speed },
        });
        trackInfoCard?.setVisible(false);
      }

      pause = await ops.loadPause({
        library: host.getLibrary(), root: host.root,
        onInteraction: () => { host.audio.context?.resume(); },
        onHover: () => host.audio.interfaceAudio?.playHover(),
        onActivate: () => host.audio.interfaceAudio?.playClick(),
        onResume: () => host.togglePause(),
        onRetry: () => { host.restartRaceFromPause(); },
        onMenu: () => { host.returnToReady(); },
      });
      countdownAudio = await ops.loadCountdown(host.getLibrary(), audioContext);
      if (map.eventProjections.length > 0)
        eventEffects = await ops.loadEventEffects(host.getLibrary(),
          map.eventProjections, host.kartView.presentationRoot(),
          map.environment, map.stageBinding, audioContext);
      if (map.eventProjections.some((projection: any) =>
        projection.sound !== undefined)) {
        const sceneMatrices = map.renderScene?.clientWorldElements;
        if (!sceneMatrices)
          throw new Error("standalone event sound 缺少 track scene matrix owner。");
        eventAudio = await ops.loadEventAudio(host.getLibrary(),
          map.eventProjections, sceneMatrices, audioContext);
      }
      if (ops.versionTag("p3553") === "p3553" && map.dummySounds.length > 0)
        dummyAudio = await ops.loadDummyAudio(host.getLibrary(),
          map.dummySounds, audioContext);

      const serializedKartRoot = ops.serializedRoot(vehicle.imported.model);
      const kartPresentation = vehicle.imported.renderScene?.bySource.get(
        serializedKartRoot);
      if (!kartPresentation)
        throw new Error("ReKart serialized root presentation 缺失。");
      const rider = characters.linked ?? characters.ordinary;
      if (rider) {
        const serializedMount = serializedKartRoot.children[6]?.value;
        const renderMount = serializedMount && "children" in serializedMount
          ? vehicle.imported.renderScene?.bySource.get(serializedMount)
          : undefined;
        if (!renderMount) throw new Error("ReKart root child 6 mount 缺失。");
        renderMount.clear();
        renderMount.add(rider.scene.object);
        // 创世 9 自动版 leaves its kart at the start (not in 驾照考试 or story races).
        if (isAutopilotKart(vehicle.kartItem?.internalId ?? kart.internalId) && !selection.story) {
          autopilot = new AutopilotPrank(await loadAutopilotPrompts(library, message =>
            host.hud.showDebugText(message, "error")), renderMount);
        }
        if (characters.linked) {
          linkedPresentation = ops.createLinkedPresentation(
            kartPresentation, renderMount, characters.linked.scene.object,
            vehicle.kartItem.alwaysLinkCharacter === true);
          linkedPresentation.setMode(3);
        }
      }
      if (rider)
        rider.scene.object.scale.setScalar(vehicle.visual.onCharacterSize);
      if (flyingPetItem && rider) {
        const serializedMount = serializedKartRoot.children[6]?.value;
        if (!serializedMount || !("transform" in serializedMount))
          throw new Error("Flying pet rider mount is missing.");
        flyingPet = await ops.loadFlyingPet({
          library, item: flyingPetItem, environment: map.environment,
          binding: map.stageBinding,
          colors: await ops.loadPaintColor(library,
            host.userProfile.equipment.itemIds[2] || 1),
          role: "local", random: host.targetRandom,
          grandparentScale: serializedMount.transform.scale,
          audioContext,
          listen: (listener: any) => physics.addFlyingPetListener(listener),
        });
        const renderMount = vehicle.imported.renderScene?.bySource.get(serializedMount);
        if (!renderMount) throw new Error("Flying pet rider mount is missing.");
        flyingPet?.mount(kartAlignedPetOwner(rider.scene.getDecorationOwner(), renderMount));
      }
      for (const accessory of vehicle.accessories) {
        if (!rider)
          throw new Error(`ReCharacter 缺失，无法挂接 ${accessory.kind}。`);
        accessory.render.scene.reset(ops.now());
        const socketName = accessory.kind === "aura"
          ? undefined : ops.accessorySockets[accessory.kind];
        const socket = socketName
          ? rider.scene.getDecorationSocket(socketName[0], socketName[1])
          : rider.scene.getDecorationOwner();
        if (!socket)
          throw new Error(`ReCharacter ${accessory.kind} socket 缺失。`);
        socket.add(accessory.render.scene.object);
        if (accessory.kind === "aura")
          ops.attachAura(socket, kartPresentation, accessory.render.scene.object);
      }
      if (!host.isGenerationCurrent(generation))
        throw new Error("比赛资源构造期间资源库已变化。");
      host.kartView.setModel(vehicle.imported.object, vehicle.visual,
        vehicle.imported.animation, vehicle.imported.model,
        vehicle.imported.scene);
      if (vehicle.decoration) {
        vehicle.decoration.scene.reset(ops.now());
        const balloonMarker = host.kartView.getAttachment(16);
        if (!balloonMarker) throw new Error("ReKart balloon marker 缺失。");
        balloonMarker.add(vehicle.decoration.scene.object);
      }
      ops.prepareScene(host.renderer, host.kartView.root, host.scene, true);
      vehicle.effects.warmDetachedScenes(host.renderer, host.scene);

      for (const source of ghostSources) {
        const assets = await builder.loadGhostKartAssets(source,
          map.environment, map.stageBinding, ops.speed(raceOptions),
          version, outlineBatch);
        const ghostView = ops.createGhostView();
        // Read by setAssets / setDecorations (ghost-visual-assets.ts).
        if (source.solid) ghostView.solid = true;
        ghosts.push({ view: ghostView,
          playback: formula ? formula.playback(ghosts.length) : ops.createGhostPlayback(source.record,
            () => host.ghostSamplingMode),
          startSlot: source.equipment.startSlot,
          name: source.equipment.playerName?.trim() || "Ghost",
          ...(source.timeOffsetMs ? { timeOffsetMs: source.timeOffsetMs } : {}) });
        ghostView.setAssets(assets.imported, assets.character,
          assets.onCharacterSize, assets.linkedCharacter, assets.visual,
          assets.motorcycle, ops.versionTag("p3553"), assets.engineGrade);
        const renderScene = assets.imported.renderScene;
        if (!renderScene)
          throw new Error("影子车辆缺少 KartRenderScene effect attachment owner。");
        const effects = await ops.loadGhostEffects(host.getLibrary(),
          assets.visual, assets.engineGrade, renderScene, map.environment,
          map.stageBinding, undefined, ops.ghostEffectNames(source.record),
          boosterVisuals);
        ghostView.setEffects(effects);
        ghostView.setTrails(await ops.loadGhostTrails(host.getLibrary(),
          assets.visual, renderScene, "shadow-driving"),
          { kartId: source.equipment.kart, engineGrade: assets.engineGrade });
        const decorations = await builder.loadGhostDecorations(
          ops.ghostItemIds(source.equipment), host.getLibrary(),
          map.environment, map.stageBinding);
        ghostView.setDecorations(decorations.balloon, decorations.accessories);
        ops.prepareScene(host.renderer, ghostView.root, host.scene, true);
        effects.warmDetachedScenes(host.renderer, host.scene);
      }
      if (!track || !gameplayUi || !action2D || !result || !pause ||
          !countdownAudio)
        throw new Error("比赛资源构造未建立 normal runtime owners。");
      rankColors = await builder.rankColors(ghostSources);
      if (!host.isGenerationCurrent(generation))
        throw new Error("比赛资源构造期间资源库已变化。");
      gameplayUi.setLocalMarkerTint(rankColors[0]);
    } catch (error) {
      disposeNewBgm();
      licenseItems?.dispose();
      hazardTraps?.dispose();
      wrongWay?.dispose();
      autopilot?.dispose();
      formula?.dispose();
      flyingPet?.dispose();
      for (const ghost of ghosts) ghost.view.dispose();
      track?.dispose();
      rain?.dispose();
      rainAudio?.dispose();
      snow?.dispose();
      gameplayUi?.dispose();
      action2D?.dispose();
      result?.dispose();
      trackInfoCard?.dispose();
      pause?.dispose();
      countdownAudio?.dispose();
      eventEffects?.dispose();
      eventAudio?.dispose();
      dummyAudio?.dispose();
      lensFlare?.dispose();
      if (!track) {
        map.renderScene?.dispose();
        map.skydome?.dispose();
      }
      map.scene.removeFromParent();
      map.environment.dispose();
      disposeVehicle();
      vehicle.decoration?.dispose();
      vehicle.accessories.forEach(({ render }: any) => render.dispose());
      outlineBatch.dispose();
      characters.ordinary?.scene.dispose();
      characters.linked?.scene.dispose();
      vehicle.audio.dispose(false);
      ops.disposeImportedObject(vehicle.imported.object);
      closeNewAudio();
      throw error;
    }
    return {
      audioContext, reuseGlobalAudio: reuseAudio, loadedBgm: bgm,
      loadedMap: map, loadedVehicle: vehicle, loadedCharacters: characters,
      nextPhysics: physics, nextTrack: track, nextRain: rain,
      nextRainAudio: rainAudio, nextSnow: snow,
      nextGameplayUi: gameplayUi, nextAction2D: action2D,
      nextResult: result, nextTrackInfoCard: trackInfoCard,
      nextPause: pause, nextCountdownAudio: countdownAudio,
      nextTrackEventEffects: eventEffects, nextTrackEventAudio: eventAudio,
      nextTrackDummyAudio: dummyAudio,
      nextLinkedCharacterPresentation: linkedPresentation,
      nextFlyingPet: flyingPet, nextGhosts: ghosts, rankColors,
      nextLicenseItems: licenseItems,
      nextHazardTraps: hazardTraps,
      nextWrongWay: wrongWay,
      nextAutopilot: autopilot,
      nextFormula: formula,
      selectedVehicle: kart, generation,
      particleModificationBanner: particleBanner,
      particleModificationBannerRequest: particleRequest,
      outlineBatch,
    };
  } catch (error) {
    particleBanner?.dispose();
    throw error;
  }
}
