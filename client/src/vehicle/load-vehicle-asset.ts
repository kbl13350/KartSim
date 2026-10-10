/** Result of assembling one race kart and every object it owns. */
export interface LoadedVehicleAsset {
  kartItem: any;
  imported: any;
  visual: any;
  physicsParams: any;
  collisionShape: any;
  audio: any;
  effects: any;
  trails: any;
  driftEffects: any;
  motionBlur: any;
  zetAirEffect: any;
  shockWaveEffect: any;
  exhaustEffect: any;
  crashEffect: any;
  chargerEffect: any;
  lampFlares: any;
  simpleShadow: any;
  decoration: any;
  accessories: { kind: string; render: any }[];
  coating: any;
  particleModification: any;
  tachometerSelection: any;
  classicHud: boolean;
  tachometerRenderer: any;
}

export interface VehicleAssetOwner {
  assetHost: {
    getLibrary(): any;
    userProfile: { equipment: { itemIds: Record<number, number> } };
    targetRandom: any;
    shadow: boolean;
  };
  loadVehicleRuntime(...args: any[]): Promise<any>;
}

export interface VehicleAssetOps {
  resolveKartIdentity(karts: any, itemId: number, path: string, hint: any): any;
  tachometerSelection(type: any, name: any, grade: number): any;
  useClassicHud(forceNew: boolean, grade: number, selection: any, version: string): boolean;
  resourceVersion(key: string): string;
  loadClassicTachometer(): Promise<any>;
  loadTachometerConfig(library: any, selection: any): Promise<any>;
  makeTacho1(config: any): any;
  makeMqTacho(config: any): any;
  loadNineTacho(config: any, library: any, time: number, options: any): Promise<any>;
  loadV1Tacho(config: any, library: any, time: number, options: any): Promise<any>;
  loadXGenTacho(config: any, library: any, time: number, options: any): Promise<any>;
  loadAudio(...args: any[]): Promise<any>;
  loadEffects(...args: any[]): Promise<any>;
  loadTrails(...args: any[]): Promise<any>;
  makeDriftSetup(...args: any[]): any;
  loadDriftEffects(...args: any[]): Promise<any>;
  loadMotionBlur(...args: any[]): Promise<any>;
  loadZetAir(...args: any[]): Promise<any>;
  loadShockWave(...args: any[]): Promise<any>;
  loadExhaust(...args: any[]): Promise<any>;
  loadCrash(...args: any[]): Promise<any>;
  loadCharger(...args: any[]): Promise<any>;
  loadLampFlares(...args: any[]): Promise<any>;
  kartModelRoot(model: any): any;
  loadShadow(...args: any[]): Promise<any>;
  paintColor(library: any, itemId: number | undefined): Promise<{ primary: number }>;
  loadDecoration(...args: any[]): Promise<any>;
  loadAccessory(...args: any[]): Promise<any>;
  physicsParams(...args: any[]): any;
  rootExtent(...args: any[]): any;
  collisionShape(...args: any[]): any;
  disposeObject(object: any): void;
}

/** Selects a tachometer renderer from the garage visual metadata. */
async function loadTachometer(library: any, visual: any, grade: number,
  environment: any, stageBinding: any, suppressClassic: boolean,
  forceNew: boolean, ops: VehicleAssetOps): Promise<{
    selection: any; classicHud: boolean; renderer: any;
  }> {
  const selection = ops.tachometerSelection(
    visual.tachometerType, visual.tachometerName, grade);
  const classicHud = !suppressClassic && ops.useClassicHud(
    forceNew, grade, selection, ops.resourceVersion("p3553"));
  if (classicHud) return {
    selection, classicHud, renderer: await ops.loadClassicTachometer(),
  };
  const config = await ops.loadTachometerConfig(library, selection);
  if (config.type === "Tacho1")
    return { selection, classicHud, renderer: ops.makeTacho1(config) };
  if (config.type === "MqTacho")
    return { selection, classicHud, renderer: ops.makeMqTacho(config) };
  const options = {
    environment, stageBinding, advanceEnvironment: false,
    convertClientCoordinates: false,
  };
  const time = Math.trunc(performance.now()) >>> 0;
  if (config.type === "NineTacho") return {
    selection, classicHud,
    renderer: await ops.loadNineTacho(config, library, time, options),
  };
  if (config.type === "V1GenTacho" || config.type === "XunGenTacho") return {
    selection, classicHud,
    renderer: await ops.loadV1Tacho(config, library, time, options),
  };
  if (config.type === "XGenTacho") return {
    selection, classicHud,
    renderer: await ops.loadXGenTacho(config, library, time, options),
  };
  throw new Error(`${config.type} 的 P3528 Tachometer production owner 尚未闭合。`);
}

/** Assembles renderers, physics, audio, effects and equipped accessories. */
export async function loadVehicleAsset(
  owner: VehicleAssetOwner,
  path: string,
  itemId: number,
  catalogHint: any,
  body: any,
  kartName: string,
  environment: any,
  stageBinding: any,
  audioContext: AudioContext | undefined,
  coatingTexture: any,
  decorationOption: any,
  convertClientCoordinates: boolean | undefined,
  suppressClassic = false,
  forceNew = false,
  ops: VehicleAssetOps,
): Promise<LoadedVehicleAsset> {
  const library = owner.assetHost.getLibrary();
  if (!library) throw new Error("车辆资源库尚未建立。");
  const kart = ops.resolveKartIdentity(
    (await library.timeAttackGarageCatalog()).karts, itemId, path, catalogHint);
  if (!kart) throw new Error(`${path} 缺少精确 Garage 车辆身份。`);
  const required = ["engineGrade", "textureKey", "fixedPlateId",
    "linkCharacterId", "alwaysLinkCharacter", "hideChar", "characterAniType"];
  if (required.some(key => kart[key] === undefined))
    throw new Error(`${path} 的 ItemKart ${itemId} metadata 不完整。`);

  const kartItem = { ...kart };
  const runtime = await owner.loadVehicleRuntime(path, kartItem.textureKey,
    kartItem.fixedPlateId, library, environment, stageBinding,
    owner.assetHost.userProfile, kartItem.itemId, kartItem.engineGrade,
    coatingTexture, kartItem.systemKey, convertClientCoordinates, false);
  const coating = runtime.coating;
  const particleModification = runtime.particleModification;
  const accessories: { kind: string; render: any }[] = [];
  let audio: any, effects: any, trails: any, driftEffects: any;
  let motionBlur: any, zetAirEffect: any, shockWaveEffect: any;
  let exhaustEffect: any, crashEffect: any, chargerEffect: any;
  let lampFlares: any, simpleShadow: any, decoration: any;
  let tachometerRenderer: any;

  try {
    const tachometer = await loadTachometer(library, runtime.visual,
      kartItem.engineGrade, environment, stageBinding, suppressClassic,
      forceNew, ops);
    tachometerRenderer = tachometer.renderer;
    audio = await ops.loadAudio(library, runtime.visual.engineSound,
      kartItem.engineGrade, body.chargeBoostBySpeed, audioContext, kartName);
    if (!runtime.imported.renderScene)
      throw new Error("车辆缺少 KartRenderScene effect attachment owner。");
    const scene = runtime.imported.renderScene;
    effects = await ops.loadEffects(library, {
      ...runtime.visual, defaultExceedType: body.defaultExceedType,
    }, kartItem.engineGrade, scene, environment, stageBinding,
    undefined, undefined, decorationOption);
    trails = await ops.loadTrails(library, runtime.visual, scene);
    const profileItems = owner.assetHost.userProfile.equipment.itemIds;
    const driftDecorationId = profileItems[27];
    const driftDecoration = driftDecorationId === 0 ? undefined
      : (await library.timeAttackDecorationItem(27, driftDecorationId)).internalId;
    driftEffects = await ops.loadDriftEffects(library, owner.assetHost.targetRandom,
      ops.makeDriftSetup(runtime.imported.model, scene,
        body.motorcycleType !== 0, body.effectSetupSelectorByte),
      driftDecoration);
    motionBlur = await ops.loadMotionBlur(
      library, runtime.visual, body.normalBoosterTime);
    zetAirEffect = await ops.loadZetAir(library, owner.assetHost.targetRandom);
    shockWaveEffect = await ops.loadShockWave(library, environment, stageBinding);
    exhaustEffect = await ops.loadExhaust(library, owner.assetHost.targetRandom,
      scene, runtime.visual.attachments);
    crashEffect = await ops.loadCrash(
      library, owner.assetHost.targetRandom, environment, stageBinding);
    chargerEffect = await ops.loadCharger(library, scene, environment, stageBinding);
    lampFlares = await ops.loadLampFlares(
      library, runtime.visual, scene, suppressClassic);

    const root = ops.kartModelRoot(runtime.imported.model);
    const shadowTransform = runtime.imported.scene.bySource.get(root);
    if (!shadowTransform)
      throw new Error("车辆 ReKart root 缺少 simple shadow world transform owner。");
    const shadowResource = runtime.resources.find(["shadow.png"]);
    if (owner.assetHost.shadow && !shadowResource)
      throw new Error(`${path} 缺少 shadow.png。`);
    simpleShadow = await ops.loadShadow(shadowResource, root.simpleShadow,
      shadowTransform, owner.assetHost.shadow);

    const decorationId = profileItems[9];
    if (decorationId !== 0) {
      const item = await library.timeAttackDecorationItem(9, decorationId);
      const paintId = profileItems[2];
      const wireColor = paintId === 0 ? undefined
        : (await ops.paintColor(library, paintId)).primary;
      decoration = await ops.loadDecoration(library, item.internalId,
        environment, stageBinding, { ...item, wireColor });
    }
    for (const [kind, slot] of [
      ["goggle", 8], ["headBand", 11], ["handGearL", 16], ["aura", 26],
    ] as const) {
      const equippedId = profileItems[slot];
      if (equippedId === 0) continue;
      const item = await library.timeAttackDecorationItem(slot, equippedId);
      accessories.push({ kind,
        render: await ops.loadAccessory(library, kind, item.internalId,
          environment, stageBinding, { convertClientCoordinates: false }),
      });
    }
    return {
      kartItem, imported: runtime.imported, visual: runtime.visual,
      physicsParams: ops.physicsParams(body, runtime.visual, kartItem.engineGrade),
      collisionShape: ops.collisionShape(
        ops.rootExtent(root.rootBounds, body.footprintExtent0,
          body.footprintExtent1),
        { scaleX: 1, scaleY: 1, height: 1 }),
      audio, effects, trails, driftEffects, motionBlur, zetAirEffect,
      shockWaveEffect, exhaustEffect, crashEffect, chargerEffect, lampFlares,
      simpleShadow, decoration, accessories, coating, particleModification,
      tachometerSelection: tachometer.selection,
      classicHud: tachometer.classicHud, tachometerRenderer,
    };
  } catch (error) {
    void audio?.dispose(false);
    effects?.dispose();
    trails?.dispose();
    driftEffects?.dispose();
    motionBlur?.dispose();
    zetAirEffect?.dispose();
    shockWaveEffect?.dispose();
    exhaustEffect?.dispose();
    crashEffect?.dispose();
    chargerEffect?.dispose();
    lampFlares?.dispose();
    simpleShadow?.dispose();
    decoration?.dispose();
    coating?.dispose();
    particleModification?.dispose();
    for (const accessory of accessories) accessory.render.dispose();
    tachometerRenderer?.dispose();
    runtime.imported.renderScene?.dispose();
    ops.disposeObject(runtime.imported.object);
    throw error;
  }
}
