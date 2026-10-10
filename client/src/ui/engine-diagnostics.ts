import { Euler } from "three";
import {
  formatPerformanceDecimal,
  formatPerformanceMemory,
  formatPerformanceMilliseconds,
  type PerformanceCounter,
} from "./performance-counter";

type FrameSummary = ReturnType<PerformanceCounter["summary"]>;

export interface EngineDiagnosticsInput {
  renderer: {
    getDrawingBufferSize(size: { x: number; y: number }): unknown;
    getPixelRatio(): number;
    info: {
      memory: { geometries: number; textures: number };
      programs?: unknown[];
    };
    capabilities: {
      isWebGL2: boolean;
      maxTextures: number;
      maxTextureSize: number;
    };
  };
  scene: { traverse(visit: (object: SceneDiagnosticObject) => void): void };
  camera: {
    quaternion: Parameters<Euler["setFromQuaternion"]>[0];
    position: { x: number; y: number; z: number };
    fov: number;
    near: number;
    far: number;
  };
  drawingBufferSize: { x: number; y: number };
  renderStats: unknown;
  network?: unknown[];
  raceStartProgramCount: number;
  active: Record<string, boolean>;
  options: Record<string, boolean>;
  maxRafDelayMs: number;
}

export interface SceneDiagnosticObject {
  visible: boolean;
  name: string;
  parent?: SceneDiagnosticObject | null;
  isMesh?: boolean;
  isSkinnedMesh?: boolean;
  isLine?: boolean;
  isPoints?: boolean;
  isSprite?: boolean;
  isLight?: boolean;
  geometry?: {
    drawRange: { count: number };
    index?: { count: number } | null;
    attributes: { position: { count: number } };
  };
  material?: object | object[];
}

/** Captures the camera values displayed by the F3 performance panel. */
export function cameraDiagnostics(camera: EngineDiagnosticsInput["camera"]) {
  const rotation = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
  return {
    position: [
      Math.round(camera.position.x * 100) / 100,
      Math.round(camera.position.y * 100) / 100,
      Math.round(camera.position.z * 100) / 100,
    ],
    rotationY: Math.round(rotation.y * 1_000) / 1_000,
    rotationX: Math.round(rotation.x * 1_000) / 1_000,
    fov: Math.round(camera.fov * 100) / 100,
    near: camera.near,
    far: camera.far,
  };
}

/** Takes one renderer, scene and track snapshot for performance diagnostics. */
export function collectEngineDiagnostics(input: EngineDiagnosticsInput) {
  const { renderer, scene, camera, drawingBufferSize, renderStats } = input;
  renderer.getDrawingBufferSize(drawingBufferSize);

  const sceneCounts = {
    objects: 0,
    visibleObjects: 0,
    meshes: 0,
    skinnedMeshes: 0,
    lineObjects: 0,
    pointObjects: 0,
    sprites: 0,
    lights: 0,
  };
  const materials = new Set<object>();
  const geometries = new Set<object>();
  let builtTrackMeshes = 0;
  let visibleTrackMeshes = 0;
  let visibleTrackTriangles = 0;

  scene.traverse(object => {
    sceneCounts.objects++;
    if (object.visible) sceneCounts.visibleObjects++;
    const isMesh = object.isMesh === true;
    if (isMesh) sceneCounts.meshes++;
    if (object.isSkinnedMesh) sceneCounts.skinnedMeshes++;
    if (object.isLine) sceneCounts.lineObjects++;
    if (object.isPoints) sceneCounts.pointObjects++;
    if (object.isSprite) sceneCounts.sprites++;
    if (object.isLight) sceneCounts.lights++;
    if (object.geometry) geometries.add(object.geometry);
    if (Array.isArray(object.material)) {
      for (const material of object.material) materials.add(material);
    } else if (object.material) {
      materials.add(object.material);
    }
    if (!isMesh) return;

    let belongsToTrack = false;
    let ancestorsVisible = true;
    for (let ancestor: SceneDiagnosticObject | null | undefined = object;
      ancestor; ancestor = ancestor.parent) {
      if (ancestor.name.endsWith(":TimeAttackRenderScene")) belongsToTrack = true;
      if (!ancestor.visible) ancestorsVisible = false;
    }
    if (!belongsToTrack) return;
    builtTrackMeshes++;
    if (!ancestorsVisible) return;
    visibleTrackMeshes++;
    const geometry = object.geometry!;
    const drawCount = geometry.drawRange.count !== Infinity
      ? geometry.drawRange.count
      : geometry.index
        ? geometry.index.count
        : geometry.attributes.position.count;
    visibleTrackTriangles += drawCount / 3;
  });

  const info = renderer.info;
  return {
    network: input.network,
    render: renderStats,
    rendererMemory: {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    },
    programs: info.programs?.length ?? 0,
    programsAtStart: input.raceStartProgramCount,
    capabilities: {
      isWebGL2: renderer.capabilities.isWebGL2,
      maxTextures: renderer.capabilities.maxTextures,
      maxTextureSize: renderer.capabilities.maxTextureSize,
    },
    drawingBuffer: {
      width: drawingBufferSize.x,
      height: drawingBufferSize.y,
      pixelRatio: renderer.getPixelRatio(),
    },
    scene: {
      ...sceneCounts,
      materials: materials.size,
      geometries: geometries.size,
    },
    trackDraws: {
      visibleMeshes: visibleTrackMeshes,
      visibleTris: Math.round(visibleTrackTriangles),
      builtMeshes: builtTrackMeshes,
    },
    camera: cameraDiagnostics(camera),
    active: input.active,
    options: input.options,
    raf: { maxDelayMs: input.maxRafDelayMs },
  };
}

export type EngineDiagnostics = ReturnType<typeof collectEngineDiagnostics>;

const switchState = (enabled: boolean | undefined): string => enabled ? "on" : "off";

/** Formats the live F3 panel, including network and renderer information. */
export function formatDiagnosticsLines(
  engine: EngineDiagnostics | null | undefined,
  frame: FrameSummary,
  currentFps: number,
): string[] {
  const longTasks = frame.longTaskSupported
    ? `${frame.longTaskCount} max ${formatPerformanceMilliseconds(frame.longTaskMaxMs)}`
    : "n/a";
  const heap = frame.heapSupported
    ? `used ${formatPerformanceMemory(frame.heapCurrentBytes)} / limit ${formatPerformanceMemory(frame.heapLimitBytes)} | committed ${formatPerformanceMemory(frame.heapTotalBytes)} | min ${formatPerformanceMemory(frame.heapMinBytes)} max ${formatPerformanceMemory(frame.heapMaxBytes)} | maxdrop ${formatPerformanceMemory(frame.heapLargestDropBytes)}`
    : "unavailable";
  const lines = [
    `FPS        now ${currentFps.toFixed(1)} | race avg ${frame.averageFps.toFixed(1)} | frames ${frame.frameCount}`,
    `FRAME      p50 ${formatPerformanceMilliseconds(frame.frame.p50Ms)} | p95 ${formatPerformanceMilliseconds(frame.frame.p95Ms)} | p99 ${formatPerformanceMilliseconds(frame.frame.p99Ms)} | max ${formatPerformanceMilliseconds(frame.frame.maxMs)}`,
    `LOW FPS    1% ${frame.frame.low1Fps.toFixed(1)} | 0.1% ${frame.frame.low01Fps.toFixed(1)} | min ${frame.frame.minFps.toFixed(1)}`,
    `WORK       p50 ${formatPerformanceMilliseconds(frame.work.p50Ms)} | p95 ${formatPerformanceMilliseconds(frame.work.p95Ms)} | max ${formatPerformanceMilliseconds(frame.work.maxMs)} | 1s mean ${formatPerformanceDecimal(frame.workWindowMeanMs)} | longtask ${longTasks}`,
    `STALL      worst frame minus its work = ${formatPerformanceMilliseconds(frame.maxStallMs)} (outside game callback => GC/GPU/browser)`,
    `JS HEAP    ${heap}`,
    `ALLOC      ${frame.heapAllocKiBPerFrame.toFixed(1)} KiB/frame | ${frame.heapAllocMiBPerSec.toFixed(2)} MiB/s | GC ${frame.heapGcPerSec.toFixed(2)} /s (total ${frame.heapGcDropTotal})`,
  ];
  if (!engine) {
    lines.push("ENGINE     (diagnostics provider unavailable)");
    return lines;
  }
  const render = engine.render as {
    calls: number; triangles: number; lines: number; points: number; frame: number
  };
  lines.push(
    `DRAW       calls ${render.calls} | triangles ${render.triangles} | lines ${render.lines} | points ${render.points} | frameIndex ${render.frame}`,
    `GPU MEM    geometries ${engine.rendererMemory.geometries} | textures ${engine.rendererMemory.textures} | programs ${engine.programs} (start ${engine.programsAtStart})`,
    `CONTEXT    ${engine.capabilities.isWebGL2 ? "WebGL2" : "WebGL1"} | maxTextures ${engine.capabilities.maxTextures} | maxTextureSize ${engine.capabilities.maxTextureSize} | DPR ${engine.drawingBuffer.pixelRatio.toFixed(2)} | buffer ${engine.drawingBuffer.width}x${engine.drawingBuffer.height}`,
    `SCENE      objects ${engine.scene.objects} | visible ${engine.scene.visibleObjects} | mesh ${engine.scene.meshes} (skinned ${engine.scene.skinnedMeshes}) | line ${engine.scene.lineObjects} | point ${engine.scene.pointObjects} | sprite ${engine.scene.sprites} | light ${engine.scene.lights}`,
    `TRACK DRAW visible ${engine.trackDraws.visibleMeshes} / ${engine.trackDraws.builtMeshes} built | ${engine.trackDraws.visibleTris} tri`,
    `CAMERA     pos ${engine.camera.position.join(", ")} | yaw ${engine.camera.rotationY} | pitch ${engine.camera.rotationX} | fov ${engine.camera.fov} | near ${engine.camera.near} | far ${engine.camera.far}`,
    `ASSETS     materials ${engine.scene.materials} | geometries ${engine.scene.geometries}`,
    `ACTIVE     ${Object.keys(engine.active).filter(key => engine.active[key]).join(" ")}`,
    `OPTIONS    verticalSync ${switchState(engine.options.verticalSync)} | boostBlur ${switchState(engine.options.boostBlur)} | toonLine ${switchState(engine.options.toonLine)} | shadow ${switchState(engine.options.shadow)} | dualBoostAuto ${switchState(engine.options.dualBoostAuto)}`,
    `RAF DELAY  max ${formatPerformanceMilliseconds(engine.raf.maxDelayMs)} (vsync -> our callback; large = main thread busy before us)`,
  );
  for (const peer of engine.network ?? []) {
    const network = peer as {
      peer: string | number; route: string; candidate?: string;
      rttMs?: number; stateAgeMs: number; bufferedBytes: number;
      sent: number; received: number; relayed: number; dropped: number;
      repairs: number;
    };
    lines.push(
      `NET peer-${network.peer} ${network.route} (${network.candidate ?? "pending"}) | RTT ${network.rttMs?.toFixed(0) ?? "-"} ms | age ${network.stateAgeMs.toFixed(0)} ms | queued ${network.bufferedBytes} B | RTC ${network.sent}/${network.received} | relay attempts ${network.relayed} | errors ${network.dropped} | repair ${network.repairs}`,
    );
  }
  return lines;
}
