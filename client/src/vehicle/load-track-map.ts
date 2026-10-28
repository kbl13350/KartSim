import { registerCityTrack, CITY_TRACK_ID } from "../city/city-track";
import { preparePracticeScene, PRACTICE_SCENE_IDS } from "../resources/practice-scene";
import { extraTrackCategory, resourceTracks } from "../resources/extra-tracks";
import { alignLicenseFrames, alignLicenseSections, licenseEventScenes, markLicenseGoal } from "../license/license-course";
import { itemGameObjectKind } from "./track-object-admission";
import { carriedHazards, loadHazardItemScenery } from "../item/hazard-scenery-items";
import { invisibleTrackGeometry } from "../resources/moving-obstacle";
import { trackMetadataOverride } from "../resources/track-overrides";
import { minimapProjection } from "../resources/minimap-projection";
import { isXmasTrack, xmasTrackModelPath } from "../resources/xmas-theme";
import { isCustomTrackId } from "../mapeditor/design";
import { taiwanTrack } from "../resources/taiwan-tracks";
import { findTrackChoice } from "../resources/track-duplicates";
import { braveMapRoute, validateBraveRoute, type BraveRouteSelection } from "../multiplayer/brave-route";

/** 驾照考试 courses register metadata overrides too; 地图工坊 maps do not take their rules. */
function riderSchoolCourse(trackId: string): boolean {
  return trackMetadataOverride(trackId) !== undefined && trackId !== CITY_TRACK_ID && !isCustomTrackId(trackId);
}

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
  loadItemGame?(library: any, model: any, trackId: string, xmas?: boolean): Promise<{
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

/**
 * Speed races and time attack keep the item hazards' movables as scenery
 * (`item-hazard-scenery-admitted`): factory_I04's propeller robots fly their
 * route and carry their water mine (hazard-scenery-items.ts), which traps karts
 * (item/hazard-traps.ts).
 */
export function hazardSceneryObjects(model: any, course: { records: any[] }): any[] {
  if (model.root.kind !== "track") return [];
  return course.records.flatMap((record: any) => {
    if (record.occurrence.kind !== "track-object" || record.reason !== "item-hazard-scenery-admitted")
      return [];
    const object = model.root.trackObjects[record.occurrence.index];
    if (object?.kind !== "ToMovableObject" || !object.object || object.object.kind !== "node")
      throw new Error(`ToMovableObject ${record.occurrence.name} 缺少道具陷阱嵌套场景。`);
    return [object];
  });
}

/**
 * Show each scenery carrier's item in the track scene: the scene's update and
 * dispose also drive the items. A failed item load leaves the carriers bare.
 */
async function withCarriedHazardItems(renderScene: any, objects: any[], library: any,
  environment: unknown, stageBinding: unknown, ops: TrackMapOps): Promise<any> {
  const hazards = carriedHazards(objects);
  if (hazards.length === 0 || !library) return renderScene;
  let items;
  try {
    items = await loadHazardItemScenery(library, hazards, renderScene, environment, stageBinding,
      { decodeModel: ops.decodeModel, loadScene: ops.loadScene });
  } catch (error) {
    console.warn("赛道道具陷阱载体上的道具模型载入失败", error);
    return renderScene;
  }
  if (items.count === 0) return renderScene;
  return {
    ...renderScene,
    update(time: number, camera?: any, width?: number, height?: number) {
      renderScene.update(time, camera, width, height);
      items.update(time, camera, width, height);
    },
    dispose() {
      items.dispose();
      renderScene.dispose();
    },
  };
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
  brave?: BraveRouteSelection,
): Promise<any> {
  if (brave) {
    validateBraveRoute(brave, trackId);
    if (mode !== "speed-individual" || lte || itemGame)
      throw new Error("勇者竞速地图只走组队竞速准入。");
  }
  if (itemGame && (mode !== "speed-individual" || lte))
    throw new Error("道具赛地图只走 speed-individual 准入。");
  if (trackId === CITY_TRACK_ID) registerCityTrack();
  const generation = owner.assetHost.generationValue();
  // 冰河圣诞版: the ice tracks with a Christmas model race it (xmas-theme.ts).
  const xmasPath = isXmasTrack(trackId)
    ? xmasTrackModelPath(owner.assetHost.getLibrary(), path, trackId) : undefined;
  if (xmasPath) path = xmasPath;
  const asset = owner.assetHost.requireAsset(path);
  const library = owner.assetHost.getLibrary();
  const indexedVariant = library?.files && resourceTracks(library).find(entry =>
    entry.id === trackId && entry.model.virtualPath === path);
  if (asset.extension !== "1s" ||
    (!/^(?:track|track_rvs|track_xmas|track_xmas_rvs)\.1s$/i.test(asset.name) && !indexedVariant))
    throw new Error("玩家地图必须来自原始 track.1s 资源。");

  const model = ops.decodeModel(await asset.bytes());
  preparePracticeScene(model, trackId);
  const lteCoinSource = lte && library
    ? await ops.loadLteCoins(library, model) : undefined;
  if (lte && !lteCoinSource) throw Error("LTE 专属图缺少金币原件。");
  if (itemGame && (!library || !ops.loadItemGame))
    throw new Error("道具赛地图缺少道具资源库。");
  const itemSources = itemGame
    ? await ops.loadItemGame!(library, model, trackId, xmasPath !== undefined) : undefined;
  const [weather, warp] = await Promise.all([
    library ? ops.loadWeather(library, path) : undefined,
    library ? ops.loadWarp(library, path) : undefined,
  ]);
  if (!weather) throw new Error(`${path} 缺少权威 weather config。`);

  const resourcePractice = !lte && !itemGame && Boolean(findTrackChoice<any>(
    await library?.timeAttackTrackCatalog?.() ?? [], trackId)?.resourceCategory);
  const trainingCourse = riderSchoolCourse(trackId) ||
    (indexedVariant && extraTrackCategory({ ...indexedVariant, variant: "" }) === "resource:training");
  const course = ops.validateCourse(model, ops.assetProvenance(asset), mode, {
    weather, warp, resourcePractice,
    p3553CourseSound: mode === "speed-individual" ||
      ops.resourceVersion("p3553") === "p3553",
    lteCoins: lteCoinSource !== undefined,
    ...(itemGame ? { itemGame: true } : {}),
    // 驾照考试 courses hand their tutorial route tags to the license race.
    ...(mode === "time-attack" && trainingCourse ? { riderSchool: true } : {}),
  });
  const lensFlarePoint = ops.lensFlareAnchor(model);
  const dummySounds = mode === "speed-individual" ||
    ops.resourceVersion("p3553") === "p3553"
    ? ops.dummySounds(model) : [];
  const road = ops.extractRoad(model, mode, {
    forceReverse: brave ? brave.localTeam !== brave.forwardTeam : /_rvs$/i.test(trackId),
    // Keep the original CN extraction contract; imported boost/jump meshes use
    // their UV V orientation even when two vertices share the same U value.
    consistentUvTangents: taiwanTrack(trackId) !== undefined,
    // 卡丁城 and 地图工坊 maps are wider than the release's 2 km road grid.
    roadExtent: trackMetadataOverride(trackId)?.roadExtent,
    practiceScene: PRACTICE_SCENE_IDS.has(trackId) ? trackId : undefined,
  });
  const braveRoute = brave ? braveMapRoute(brave, model, road) : undefined;
  // 驾照考试: the open course without a final gate (village_C005) ends at its last gate,
  // and the course's tutorial points name their hint scenes.
  const licenseCourse = mode === "time-attack" && trainingCourse;
  if (licenseCourse) {
    markLicenseGoal(road);
    alignLicenseFrames(road);
    alignLicenseSections(road);
  }
  const licenseEvents = licenseCourse && model.root.kind === "track"
    ? licenseEventScenes(model.root.trackObjects) : undefined;
  if (model.root.kind !== "track")
    throw new Error(`${path} 缺少 TrackContainer。`);
  const minimaps = model.root.trackObjects.filter(
    (object: any) => object.kind === "ToMinimap");
  if (trackId === "pirate_P01" && minimaps.length === 0)
    minimaps.push({ centerX: road.start.position.x, centerY: -road.start.position.z,
      scale: 1, canvasWidth: 256, canvasHeight: 256, padding: 4 });
  if (minimaps.length !== 1)
    throw new Error(`${path} 的 ToMinimap 数量必须为 1，实际 ${minimaps.length}。`);

  const movingObjects = ops.mapMovingObjects(model, course);
  const matrixRoots = ops.additionalMatrixRoots(model, course);
  const rootPoseOverrides = new Map(movingObjects.map(
    (entry: any) => [entry.object, entry.transform]));
  const itemRoots = itemGame ? itemGameRoots(movingObjects)
    : { roots: [], matrixOnly: [] };
  const sceneryObjects = hazardSceneryObjects(model, course);
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
      trackMetadataOverride(trackId);
  if (!metadata)
    throw new Error(`${trackId} 缺少权威 track@zz.bml metadata。`);
  const gameType = metadata.gameType ?? "speed";
  if (mode === "time-attack" && gameType !== "speed" && gameType !== "item")
    throw new Error(`${trackId} 的 gameType=${gameType} 不在 TimeAttack 赛道集合。`);
  if (metadata.blocked === true)
    throw new Error(`${trackId} 被 CN track metadata 标记为 blocked。`);
  if (metadata.choosable === false && !brave)
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
    const additionalRoots = [
      ...admittedObjects.map((entry: any) => entry.renderRoot),
      ...eventProjections.map((entry: any) => entry.renderRoot),
      ...matrixRoots,
      ...itemRoots.roots,
      ...sceneryObjects.map((object: any) => object.object),
    ];
    renderScene = await ops.loadScene(model, owner.assetHost.getLibrary(),
      path, metadata, {
        additionalRoots,
        matrixOnlyRoots,
        hiddenNodes: invisibleTrackGeometry([model.root.scene, ...additionalRoots]),
        rootPoseOverrides,
        advertisementSources: advertisements,
        environment,
        stageBinding,
        advanceEnvironment: false,
      });
    renderScene = await withCarriedHazardItems(renderScene, sceneryObjects,
      owner.assetHost.getLibrary(), environment, stageBinding, ops);
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
      ...(braveRoute ? { brave: braveRoute } : {}),
      ...(licenseEvents ? { licenseEvents } : {}),
      // The HUD's Christmas item slot frame and dashboard follow the model.
      ...(xmasPath ? { xmas: true } : {}),
    },
    scene,
    renderScene,
    skydome,
    environment,
    stageBinding,
    admission,
    metadata,
    // A few tracks' map art was drawn with another projection (minimap-projection.ts).
    minimap: minimapProjection(trackId, minimaps[0]),
    readyCamera,
    warpNextCamera,
    lensFlarePoint,
    eventProjections,
    dummySounds,
    lteCoinSource,
    // 驾照考试 item steps read the course's item boxes and target dummies.
    ...(licenseCourse ? { licenseModel: model } : {}),
    // Speed races and time attack: the carriers' water mines trap karts (item/hazard-traps.ts).
    ...(sceneryObjects.length ? { hazardSceneryObjects: sceneryObjects } : {}),
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
  admit: TrackMapOps["loadMultiplayerAdmission"], brave?: BraveRouteSelection): any {
  if (mode === "brave") {
    validateBraveRoute(brave, trackId);
    if (version("p3553") !== "p3553") throw new Error("勇者竞速仅准入 P3553。");
    return owner.loadMap(path, trackId, "speed-individual", admit, false, false, brave);
  }
  if (brave) throw new Error("普通比赛不能附带勇者竞速方向。");
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
