import { MissionResultAction, StoryAction2D } from "../story/mission-result-action";
import type { StoryRaceRequest } from "../story/story-race";

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
  const characterPath = selection.characterPath;
  ops.validateItemId(selection.vehicleItemId);
  const generation = host.generationValue();
  const classicHud = host.gameOptions.classicHud;
  const teamBooster = raceOptions.booster === 1;
  await host.preloadContainers(selection.mapPath, selection.vehiclePath,
    selection.characterPath, selection.vehicleSystemKey);

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
  const physicsSpec = flyingPetItem
    ? ops.applyFlyingPetSpec(spec, kart.engineGrade ?? 0, garageState, speed,
      (await ops.loadBodyParameter(library, kart.path,
        kart.systemKey)).parameter.value,
      await ops.loadFlyingPetAbility(library, flyingPetItem.internalId),
      (value: any) => ops.finalizeSpec(value, version, speed))
    : ops.finalizeSpec(tunedSpec, version, speed);
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
        if (host.audio.bgmTrackId !== map.metadata.id)
          await bgm.selectRace(host.getLibrary(), map.metadata);
      } else {
        bgm = await ops.loadRaceBgm(host.getLibrary(), map.metadata,
          host.targetRandom, audioContext);
      }
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
        undefined, false, classicHud);
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

    const physics = ops.createPhysics(vehicle.physicsParams,
      vehicle.collisionShape, raceOptions.booster !== 0,
      raceOptions.speed === 4);
    let track: any, rain: any, rainAudio: any, snow: any;
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
          if (!Number.isInteger(slot) || slot < 0 || slot > 8) {
            host.hud.showDebugText(
              `幽灵记录缺少有效起跑槽位（${String(slot)}）；旧记录请重新导入 .ksv，本局跳过该影子。`,
              "error");
            continue;
          }
          ghostSources.push({ equipment: participant.equipment,
            record: participant.record });
        }
      }

      if (map.lensFlarePoint)
        lensFlare = await ops.loadLensFlare(host.getLibrary(), map.lensFlarePoint);
      track = ops.createTrack(map.data, map.scene, map.renderScene,
        map.skydome, lensFlare);
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
        vehicle.kartItem.engineGrade);
      const minimap = await ops.loadMinimap(host.getLibrary(), map.path,
        map.metadata, map.minimap, map.environment, map.stageBinding,
        ghostSources.length);
      gameplayUi = ops.createGameplayUi(tachometer, minimap);
      if (vehicle.classicHud)
        await gameplayUi.loadClassicBoost(host.getLibrary(), teamBooster);
      action2D = ops.createAction2D(await ops.loadAction2D(host.getLibrary()));
      if (selection.story) {
        // The mission result animation is a bonus: race on without it if it cannot load.
        try {
          action2D = new StoryAction2D(action2D,
            await MissionResultAction.load(host.getLibrary(), audioContext));
        } catch (error) {
          host.hud.showDebugText(`任务结果动画未能载入：${
            error instanceof Error ? error.message : String(error)}`, "error");
        }
      }
      result = ops.createResult(await ops.loadResult(host.getLibrary()));
      if (ops.versionTag("p3553") === "p3553") {
        const trackDirectory = map.path.replaceAll("\\", "/").split("/").at(-2);
        if (!trackDirectory) throw new Error("赛道信息卡缺少赛道目录。");
        trackInfoCard = await ops.loadTrackInfoCard({
          library: host.getLibrary(), root: host.root,
          trackId: selection.trackId, trackDirectory,
          trackTitle: map.metadata.cnTitle ?? "",
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
        flyingPet?.mount(rider.scene.getDecorationOwner());
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
        ghosts.push({ view: ghostView,
          playback: ops.createGhostPlayback(source.record,
            () => host.ghostSamplingMode),
          startSlot: source.equipment.startSlot,
          name: source.equipment.playerName?.trim() || "Ghost" });
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
