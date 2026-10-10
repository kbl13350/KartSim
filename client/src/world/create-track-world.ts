/** Inputs already decoded from the original track.1s and its sibling resources. */
export interface TrackConstructionData {
  resourceVersion: string;
  trackId: string;
  sections: readonly {
    outgoing: readonly { section: number }[];
    incoming: readonly { section: number }[];
  }[];
  firstSection: number;
  lastSection: number;
  roadIssues: readonly unknown[];
  deferredRoadTriangles: readonly unknown[];
  runtimeIssues: readonly unknown[];
  collisionTriangles: readonly { roadDescriptor: unknown }[];
  movingRoadTriangles?: readonly {
    roadDescriptor: unknown;
    origin: { mesh: unknown };
  }[];
  obstacleAnimators?: readonly unknown[];
  eventRuntimes?: readonly unknown[];
  obstacleTriangles?: readonly unknown[];
  railConfig?: unknown;
  railCaptureDistance?: number;
  [field: string]: unknown;
}

export interface TrackSceneGroup {
  name: string;
  matrixAutoUpdate: boolean;
  matrixWorldNeedsUpdate: boolean;
  add(object: unknown): unknown;
}

export interface TrackRenderOwner {
  settings?: { cameraFar?: number; fog?: unknown };
  clientWorldElements?: unknown;
  clientWorldBounds?: unknown;
}

export interface TrackSurfaceDependencies {
  p3553ObbQuery: unknown;
  legacyObbQuery: unknown;
  isRailDescriptor(descriptor: unknown): boolean;
  movingDescriptorIssue(descriptor: unknown, mesh: unknown): string | undefined;
  makeStaticSurface(triangles: TrackConstructionData["collisionTriangles"],
    obbQuery: unknown): unknown;
  makeMovingSurface(triangles: NonNullable<TrackConstructionData["movingRoadTriangles"]>,
    clientWorldElements: unknown, obbQuery: unknown): unknown;
  makeObstacleSurface(triangles: readonly unknown[], obbQuery: unknown): unknown;
}

export interface TrackConstructionDependencies extends TrackSurfaceDependencies {
  makeGroup(): TrackSceneGroup;
}

export interface ConstructedTrackWorld {
  renderScene: TrackRenderOwner | undefined;
  skydomeScene: { object: unknown } | undefined;
  lensFlare: { object: unknown } | undefined;
  group: TrackSceneGroup;
  skydome: unknown;
  data: TrackConstructionData | undefined;
  cameraFar: number | undefined;
  fog: unknown;
  sections: TrackConstructionData["sections"] | undefined;
  surface: unknown;
  movingSurface: unknown;
  obstacleClientWorldElements: unknown;
  obstacleClientWorldBounds: unknown;
  obstacleSurface: unknown;
  pendingObstacleTriangles: unknown;
  obstacleKartPaired: boolean;
  obstacleKartPairs: WeakSet<object>;
  eventClientWorldElements: unknown;
  pendingEventRuntimes: unknown;
  activeEventRuntimes: unknown[];
  expiredEventEffects: unknown[];
  routeStates: WeakMap<object, unknown>;
  triangleObbQuery: unknown;
}

/**
 * The construction seam for the released `_L` class. A caller supplies the
 * exact renderer, descriptor and collision implementations; this function
 * owns the decoded track validation, state, scene wiring and failure order.
 */
export function createTrackWorld<T extends object>(
  TrackWorld: { prototype: T },
  data: TrackConstructionData,
  scene: TrackSceneGroup,
  renderScene: TrackRenderOwner | undefined,
  skydomeScene: { object: unknown } | undefined,
  lensFlare: { object: unknown } | undefined,
  dependencies: TrackConstructionDependencies,
): T & ConstructedTrackWorld {
  const world = Object.create(TrackWorld.prototype) as T & ConstructedTrackWorld;

  // Match released class-field defaults before running constructor checks.
  Object.assign(world, {
    renderScene: undefined, skydomeScene: undefined, lensFlare: undefined,
    group: dependencies.makeGroup(), skydome: undefined, data: undefined,
    cameraFar: undefined, fog: undefined, sections: undefined,
    surface: undefined, movingSurface: undefined,
    obstacleClientWorldElements: undefined,
    obstacleClientWorldBounds: undefined, obstacleSurface: undefined,
    pendingObstacleTriangles: undefined, obstacleKartPaired: false,
    obstacleKartPairs: new WeakSet<object>(), eventClientWorldElements: undefined,
    pendingEventRuntimes: undefined, activeEventRuntimes: [],
    expiredEventEffects: [], routeStates: new WeakMap<object, unknown>(),
    triangleObbQuery: undefined,
  });

  return initializeTrackWorld(world, data, scene, renderScene,
    skydomeScene, lensFlare, dependencies);
}

/** Initializes an actual `_L` instance after its own class fields are created. */
export function initializeTrackWorld<T extends ConstructedTrackWorld>(
  world: T,
  data: TrackConstructionData,
  scene: TrackSceneGroup,
  renderScene: TrackRenderOwner | undefined,
  skydomeScene: { object: unknown } | undefined,
  lensFlare: { object: unknown } | undefined,
  dependencies: TrackSurfaceDependencies,
): T {
  world.renderScene = renderScene;
  world.skydomeScene = skydomeScene;
  world.lensFlare = lensFlare;
  if (data.sections.length === 0) {
    throw new Error("导入赛道缺少原版 RouteSection 图。");
  }
  if (!data.sections[data.firstSection] || !data.sections[data.lastSection]) {
    throw new Error("原版路线图首尾索引无效。");
  }
  data.sections.forEach((section, index) => {
    for (const edge of [...section.outgoing, ...section.incoming]) {
      if (!data.sections[edge.section]) {
        throw new Error(`路线段 ${index} 含越界 edge target ${edge.section}。`);
      }
    }
  });

  world.data = data;
  world.triangleObbQuery = data.resourceVersion === "p3553" ?
    dependencies.p3553ObbQuery : dependencies.legacyObbQuery;
  world.cameraFar = renderScene?.settings?.cameraFar;
  world.fog = renderScene?.settings?.fog;
  world.group.name = `track:${data.trackId}`;
  world.group.matrixAutoUpdate = false;
  world.group.matrixWorldNeedsUpdate = false;
  world.sections = data.sections;

  if (data.roadIssues.length > 0 || data.deferredRoadTriangles.length > 0) {
    throw new Error("赛道包含尚未接入已证 consumer 的 road descriptor，已停止建立运行时查询。");
  }
  if (data.runtimeIssues.length > 0) {
    throw new Error(`赛道包含尚未接入的原版 runtime object：${data.runtimeIssues[0]}。`);
  }
  if (data.collisionTriangles.some(triangle =>
    dependencies.isRailDescriptor(triangle.roadDescriptor))) {
    if (!data.railConfig) {
      throw new Error("赛道包含 rail descriptor，但资源库缺少权威 rail.bml。");
    }
    if (data.railCaptureDistance === undefined) {
      throw new Error("赛道包含 rail descriptor，但 stage theme producer 未闭合，无法选择 4/10 m capture distance。");
    }
  }

  world.surface = dependencies.makeStaticSurface(data.collisionTriangles,
    world.triangleObbQuery);
  if (data.movingRoadTriangles?.length) {
    if (!renderScene?.clientWorldElements) {
      throw new Error("moving road 缺少上一帧 scene world matrix owner。");
    }
    for (const triangle of data.movingRoadTriangles) {
      const issue = dependencies.movingDescriptorIssue(triangle.roadDescriptor,
        triangle.origin.mesh);
      if (issue) throw new Error(`moving road 拒绝 descriptor：${issue}。`);
    }
    world.movingSurface = dependencies.makeMovingSurface(data.movingRoadTriangles,
      renderScene.clientWorldElements, world.triangleObbQuery);
  }
  if (data.obstacleAnimators?.length) {
    if (!renderScene?.clientWorldElements) {
      throw new Error("obstacle 缺少上一轮 scene world matrix owner。");
    }
    if (!renderScene.clientWorldBounds) {
      throw new Error("obstacle 缺少上一轮 scene world bounds owner。");
    }
    world.obstacleClientWorldElements = renderScene.clientWorldElements;
    world.obstacleClientWorldBounds = renderScene.clientWorldBounds;
  }
  if (data.eventRuntimes?.length) {
    if (!renderScene?.clientWorldElements) {
      throw new Error("event 缺少上一轮 scene world matrix owner。");
    }
    world.eventClientWorldElements = renderScene.clientWorldElements;
  }
  if (data.obstacleTriangles?.length) {
    world.obstacleSurface = dependencies.makeObstacleSurface(data.obstacleTriangles,
      world.triangleObbQuery);
  }
  scene.name ||= "track.1s-scene";
  world.group.add(scene);
  if (lensFlare) world.group.add(lensFlare.object);
  world.skydome = skydomeScene?.object;
  return world;
}
