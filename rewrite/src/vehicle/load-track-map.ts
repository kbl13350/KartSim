import { itemGameObjectKind } from "./track-object-admission";
import { trackMetadataOverride } from "../resources/track-overrides";

export interface TrackMapOwner {
  assetHost: {
    generationValue(): unknown;
    requireAsset(path: string): any;
    getLibrary(): any;
    isGenerationCurrent(value: unknown): boolean;
    toonStageBinding: any;
  };
}

export interface TrackMapOps {
  decodeModel(bytes: Uint8Array): any;
  assetProvenance(asset: any): any;
  loadLteCoins(library: any, model: any): Promise<any>;
  loadWeather(library: any, path: string): Promise<any>;
  loadWarp(library: any, path: string): Promise<any>;
  validateCourse(model: any, provenance: any, mode: string, options: any): any;
  lensFlareAnchor(model: any): any;
  dummySounds(model: any): any[];
  extractRoad(model: any, mode: string, options: any): any;
  mapMovingObjects(model: any, course: any): any[];
  additionalMatrixRoots(model: any, course: any): any[];
  admitMovingObject(object: any): any;
  parseEventProjection(object: any): any;
  makeEventRuntime(projection: any): any;
  hasDeferredRoad(descriptor: any): boolean;
  isDeferredRoadMaterial(descriptor: any, mesh: any): boolean;
  unsupportedRoad(descriptor: any, mesh: any): boolean;
  hasRail(descriptor: any): boolean;
  loadRailConfig(library: any): Promise<any>;
  loadRailCapture(library: any, path: string): Promise<any>;
  resourceVersion(key: string): string;
  isLteTrack(trackId: string): boolean;
  loadAdmission(model: any, course: any): any;
  loadMultiplayerAdmission(model: any, course: any): any;
  makeReadyCamera(model: any): any;
  loadAdvertisements(library: any, metadata: any): Promise<any>;
  textureCandidates(root: any): { candidates: any[] };
  textureStatus(library: any, path: string, metadata: any,
    texture: any, advertisements: any): { status: string };
  loadEnvironment(library: any): Promise<any>;
  loadScene(model: any, library: any, path: string,
    metadata: any, options: any): Promise<any>;
  warpNextCamera(model: any, scene: any): any;
  configureSkydome(object: any): void;
  /** Item races: catalog, cube and hazard sources of the loaded track. */
  loadItemGame?(library: any, model: any, trackId: string): Promise<{
    catalog: unknown; cubes: unknown; hazards: unknown;
  }>;
}

/**
 * Nested roots of the item-game movables. Hazards render through the track
 * scene; moving-cube anchors are matrix-only roots whose world matrices the
 * cube field follows. Their pose overrides already come from the admitted
 * movables.
 */
export function itemGameRoots(movingObjects: any[]): { roots: any[]; matrixOnly: any[] } {
  const roots: any[] = [];
  const matrixOnly: any[] = [];
  for (const entry of movingObjects) {
    const kind = itemGameObjectKind(entry);
    if (kind !== "hazard" && kind !== "moving-cube") continue;
    if (!entry.object || typeof entry.object !== "object" || entry.object.kind !== "node")
      throw new Error(`ToMovableObject ${entry.name} 缺少道具赛嵌套场景。`);
    roots.push(entry.object);
    if (kind === "moving-cube") matrixOnly.push(entry.object);
  }
  return { roots, matrixOnly };
}

/** Builds all physical, animated and visual ownership for a track asset. */
export async function loadTrackMap(
  owner: TrackMapOwner,
  path: string,
  trackId: string,
  mode: string,
  admit: (model: any, course: any) => any,
  lte = false,
  ops: TrackMapOps,
  itemGame = false,
): Promise<any> {
  if (itemGame && (mode !== "speed-individual" || lte))
    throw new Error("道具赛地图只走 speed-individual 准入。");
  const generation = owner.assetHost.generationValue();
  const asset = owner.assetHost.requireAsset(path);
  if (asset.extension !== "1s" ||
    !/^(?:track|track_rvs|track_xmas|track_xmas_rvs)\.1s$/i.test(asset.name))
    throw new Error("玩家地图必须来自原始 track.1s 资源。");

  const model = ops.decodeModel(await asset.bytes());
  const library = owner.assetHost.getLibrary();
  const lteCoinSource = lte && library
    ? await ops.loadLteCoins(library, model) : undefined;
  if (lte && !lteCoinSource) throw Error("LTE 专属图缺少金币原件。");
  if (itemGame && (!library || !ops.loadItemGame))
    throw new Error("道具赛地图缺少道具资源库。");
  const itemSources = itemGame
    ? await ops.loadItemGame!(library, model, trackId) : undefined;
  const [weather, warp] = await Promise.all([
    library ? ops.loadWeather(library, path) : undefined,
    library ? ops.loadWarp(library, path) : undefined,
  ]);
  if (!weather) throw new Error(`${path} 缺少权威 weather config。`);

  const course = ops.validateCourse(model, ops.assetProvenance(asset), mode, {
    weather, warp,
    p3553CourseSound: mode === "speed-individual" ||
      ops.resourceVersion("p3553") === "p3553",
    lteCoins: lteCoinSource !== undefined,
    ...(itemGame ? { itemGame: true } : {}),
    // 驾照考试 courses hand their tutorial route tags to the license race.
    ...(mode === "time-attack" && trackMetadataOverride(trackId) ? { riderSchool: true } : {}),
  });
  const lensFlarePoint = ops.lensFlareAnchor(model);
  const dummySounds = mode === "speed-individual" ||
    ops.resourceVersion("p3553") === "p3553"
    ? ops.dummySounds(model) : [];
  const road = ops.extractRoad(model, mode, {
    forceReverse: /_rvs$/i.test(trackId),
  });
  if (model.root.kind !== "track")
    throw new Error(`${path} 缺少 TrackContainer。`);
  const minimaps = model.root.trackObjects.filter(
    (object: any) => object.kind === "ToMinimap");
  if (minimaps.length !== 1)
    throw new Error(`${path} 的 ToMinimap 数量必须为 1，实际 ${minimaps.length}。`);

  const movingObjects = ops.mapMovingObjects(model, course);
  const matrixRoots = ops.additionalMatrixRoots(model, course);
  const rootPoseOverrides = new Map(movingObjects.map(
    (entry: any) => [entry.object, entry.transform]));
  const itemRoots = itemGame ? itemGameRoots(movingObjects)
    : { roots: [], matrixOnly: [] };
  const admittedObjects = movingObjects.flatMap((entry: any) => {
    const result = ops.admitMovingObject(entry);
    return result.status === "admit" ? [result] : [];
  });
  const obstacleAnimators = admittedObjects.map((entry: any) => entry.animator);
  const eventProjections = movingObjects.flatMap((entry: any) => {
    const result = ops.parseEventProjection(entry);
    return result.status === "parsed" ? [result] : [];
  });
  const eventRuntimes = eventProjections.map(ops.makeEventRuntime);
  const admission = admit(model, course);
  const collisionTriangles = road.collisionTriangles;
  const deferredRoadTriangles = road.deferredRoadTriangles;
  const roadIssues = road.roadIssues;
  const movingRoadTriangles = deferredRoadTriangles.filter((entry: any) =>
    ops.hasDeferredRoad(entry.roadDescriptor) &&
    !ops.isDeferredRoadMaterial(entry.roadDescriptor, entry.origin.mesh));
  const staticDeferredRoadTriangles = deferredRoadTriangles.filter((entry: any) =>
    !ops.hasDeferredRoad(entry.roadDescriptor) ||
    !!ops.isDeferredRoadMaterial(entry.roadDescriptor, entry.origin.mesh));
  const unresolvedRoads = roadIssues.filter((entry: any) =>
    !!ops.unsupportedRoad(entry.descriptor, entry.mesh));
  if (unresolvedRoads.length > 0) {
    const first = unresolvedRoads[0];
    throw new Error(`${trackId} 含尚未接入已证 consumer 的 road descriptor：${first.mesh.node.name || first.mesh.node.className} (${first.reason})。`);
  }
  const hasRail = collisionTriangles.some((entry: any) =>
    !!ops.hasRail(entry.roadDescriptor));
  if (mode === "speed-individual" && course.records.some((record: any) =>
    record.occurrence.kind === "route-surface" && ![
      "route-event-empty", "route-event-noop", "route-event-lensflare",
      "route-event-rain", "route-event-snow", "route-event-rail",
      "route-event-rail-rain", "route-event-shake", "route-event-wave",
      "route-event-flash", "route-event-warpnext", "route-event-zoom",
    ].includes(record.reason)))
    throw new Error(`${trackId} 含首轮多人实跑尚未接入的天气/特殊路段。`);
  const [railConfig, railCaptureDistance] = hasRail && library
    ? await Promise.all([
      ops.loadRailConfig(library), ops.loadRailCapture(library, path),
    ]) : [undefined, undefined];
  if (hasRail && !railConfig)
    throw new Error(`${trackId} 包含 rail descriptor，但导入资源缺少权威 rail.bml。`);

  const metadata = lte
    ? { id: trackId, cnTitle: trackId, laps: 1 }
    : await owner.assetHost.getLibrary()?.trackMetadata(trackId) ??
      (mode === "time-attack" ? trackMetadataOverride(trackId) : undefined);
  if (!metadata)
    throw new Error(`${trackId} 缺少权威 track@zz.bml metadata。`);
  const gameType = metadata.gameType ?? "speed";
  if (mode === "time-attack" && gameType !== "speed" && gameType !== "item")
    throw new Error(`${trackId} 的 gameType=${gameType} 不在 TimeAttack 赛道集合。`);
  if (metadata.blocked === true)
    throw new Error(`${trackId} 被 CN track metadata 标记为 blocked。`);
  if (metadata.choosable === false)
    throw new Error(`${trackId} 不允许普通手动选择。`);
  if (!metadata.cnTitle)
    throw new Error(`${trackId} 缺少 trackLocale@cn 标题记录。`);
  if (metadata.laps === undefined)
    throw new Error(`${trackId} 缺少 TimeAttack laps。`);
  const readySource = owner.assetHost.getLibrary()?.files.find((entry: any) =>
    entry.sourceName.toLowerCase() === "stage_common.rho" &&
    entry.name.toLowerCase() === "readycamera.1s");
  if (!readySource)
    throw new Error("TimeAttack 缺少 stage_common.rho/readyCamera.1s。");
  const readyCamera = ops.makeReadyCamera(
    ops.decodeModel(await readySource.bytes()));

  let renderScene: any, skydome: any, environment: any, scene: any;
  let warpNextCamera: any;
  const stageBinding = owner.assetHost.toonStageBinding;
  try {
    const advertisements = await ops.loadAdvertisements(
      owner.assetHost.getLibrary(), metadata);
    const currentLibrary = owner.assetHost.getLibrary();
    const matrixOnlyRoots = [...eventProjections.flatMap((projection: any) => {
      const candidates = ops.textureCandidates(projection.renderRoot).candidates;
      return candidates.length > 0 && candidates.every((candidate: any) =>
        ops.textureStatus(currentLibrary, path, metadata,
          candidate.state.texture.value, advertisements).status === "missing")
        ? [projection.renderRoot] : [];
    }), ...itemRoots.matrixOnly];
    environment = await ops.loadEnvironment(owner.assetHost.getLibrary());
    renderScene = await ops.loadScene(model, owner.assetHost.getLibrary(),
      path, metadata, {
        additionalRoots: [
          ...admittedObjects.map((entry: any) => entry.renderRoot),
          ...eventProjections.map((entry: any) => entry.renderRoot),
          ...matrixRoots,
          ...itemRoots.roots,
        ],
        matrixOnlyRoots,
        rootPoseOverrides,
        advertisementSources: advertisements,
        environment,
        stageBinding,
        advanceEnvironment: false,
      });
    warpNextCamera = ops.warpNextCamera(model, renderScene);
    if (mode === "speed-individual" && warp?.inType !== "fairy" &&
      course.records.some((record: any) =>
        record.reason === "route-event-warpnext") && !warpNextCamera)
      throw new Error(`${trackId} 缺少 warpnextcamera_cam；多人传送镜头不能复用旧镜头。`);
    const skySource = owner.assetHost.getLibrary()?.findSibling(path, ["skydome.1s"]);
    if (skySource) {
      skydome = await ops.loadScene(ops.decodeModel(await skySource.bytes()),
        owner.assetHost.getLibrary(), skySource.virtualPath, metadata, {
          cameraCentered: true,
          advertisementSources: advertisements,
          scale: 0.01,
          environment,
          stageBinding,
          advanceEnvironment: false,
        });
      ops.configureSkydome(skydome.object);
    }
    scene = renderScene.object;
    if (!owner.assetHost.isGenerationCurrent(generation))
      throw new Error("赛道载入期间资源库已变化。");
  } catch (error) {
    renderScene?.dispose();
    skydome?.dispose();
    environment?.dispose();
    throw error;
  }
  return {
    path,
    data: {
      resourceVersion: mode === "speed-individual"
        ? "p3553" : ops.resourceVersion("p3553"),
      trackId,
      containerName: road.containerName,
      collisionTriangles,
      movingRoadTriangles,
      obstacleAnimators,
      eventRuntimes,
      weather,
      warp,
      deferredRoadTriangles: staticDeferredRoadTriangles,
      roadIssues: unresolvedRoads,
      runtimeIssues: [],
      railConfig,
      railCaptureDistance,
      sections: road.sections,
      firstSection: road.firstSection,
      lastSection: road.lastSection,
      start: road.start,
      lapTarget: metadata.laps,
    },
    scene,
    renderScene,
    skydome,
    environment,
    stageBinding,
    admission,
    metadata,
    minimap: minimaps[0],
    readyCamera,
    warpNextCamera,
    lensFlarePoint,
    eventProjections,
    dummySounds,
    lteCoinSource,
    ...(itemSources ? {
      itemCatalog: itemSources.catalog,
      itemCubeSource: itemSources.cubes,
      itemHazardSource: itemSources.hazards,
    } : {}),
  };
}

/** The mode-specific map entry points remain thin and typed. */
export function loadTimeAttackMap(owner: { loadMap(...args: any[]): any },
  path: string, trackId: string, admit: TrackMapOps["loadAdmission"]): any {
  return owner.loadMap(path, trackId, "time-attack", admit);
}

export function loadMultiplayerMap(owner: { loadMap(...args: any[]): any },
  path: string, trackId: string, mode: string,
  version: (key: string) => string,
  isLteTrack: (trackId: string) => boolean,
  admit: TrackMapOps["loadMultiplayerAdmission"]): any {
  if (mode === "lte" && version("p3553") !== "p3553")
    throw new Error("LTE 专属图仅准入 P3553。");
  if (mode === "lte" && !isLteTrack(trackId))
    throw Error("LTE 专属图身份不匹配。");
  if (mode === "item") {
    // Item races keep the speed-individual admission plus the item-game objects.
    if (version("p3553") !== "p3553") throw new Error("道具赛仅准入 P3553。");
    return owner.loadMap(path, trackId, "speed-individual", admit, false, true);
  }
  return owner.loadMap(path, trackId, "speed-individual", admit, mode === "lte");
}
