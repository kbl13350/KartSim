/** A decoded .1s scene can contain both PRS and float-controller timelines. */
export function garagePartModelDuration(model: unknown): number {
  const visited = new Set<object>();
  let duration = 0;

  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object" || ArrayBuffer.isView(value) ||
        visited.has(value)) return;
    visited.add(value);
    const node = value as Record<string, unknown>;
    const base = node.base as Record<string, unknown> | undefined;

    if (node.kind === "prs" && base &&
        typeof base.stopTimeWord === "number" &&
        typeof base.frequency === "number" && base.frequency > 0 &&
        base.stopTimeWord > 0) {
      duration = Math.max(duration, base.stopTimeWord / base.frequency);
    }

    if (node.kind === "float-controller" && base &&
        typeof base.frequency === "number" && base.frequency > 0) {
      const keys = node.keys as {
        type: number;
        records: Uint8Array[];
      } | undefined;
      if (keys && [0, 1, 3].includes(keys.type) &&
          keys.records.every(record => record.byteLength >= 8)) {
        const record = (index: number): DataView => {
          const bytes = keys.records[index]!;
          return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        };
        let firstDistinct = keys.records.length - 1;
        while (firstDistinct > 0) {
          const previous = record(firstDistinct - 1);
          const current = record(firstDistinct);
          const valueChanged = previous.getFloat32(4, true) !==
            current.getFloat32(4, true);
          const tangentChanged = keys.type === 0 &&
            (previous.byteLength < 16 || current.byteLength < 16 ||
              previous.getFloat32(12, true) !== 0 ||
              current.getFloat32(8, true) !== 0);
          if (valueChanged || tangentChanged) break;
          firstDistinct--;
        }
        if (firstDistinct >= 0)
          duration = Math.max(duration,
            record(firstDistinct).getUint32(0, true) / base.frequency);
      }
    }

    Object.values(node).forEach(visit);
  };

  visit(model);
  return duration;
}

export interface GaragePartPanelNode {
  name: string;
  children: GaragePartPanelNode[];
}

export interface GaragePartCamera {
  aspect: number;
  fov: number;
  position: { set(x: number, y: number, z: number): void };
  lookAt(x: number, y: number, z: number): void;
  updateProjectionMatrix(): void;
}

export interface GaragePartCameraDependencies {
  field(node: GaragePartPanelNode, name: string): string | undefined;
  verticalFov(fov: number, aspect: number): number;
  createPerspectiveCamera(fov: number, aspect: number,
    near: number, far: number): GaragePartCamera;
}

/** Read the Parts12 camera, including the native Y/Z axis conversion. */
export function createGaragePartCamera(
  panel: GaragePartPanelNode,
  width: number,
  height: number,
  dependencies: GaragePartCameraDependencies,
): GaragePartCamera {
  const vector = (name: string): number[] => {
    const values = (dependencies.field(panel, name) ?? "")
      .trim().split(/\s+/).map(Number);
    if (values.length !== 3 || !values.every(Number.isFinite))
      throw new Error(`部件镜头缺少 ${name}`);
    return values.map(Math.fround);
  };
  const [cameraX, cameraY, cameraZ] = vector("defaultCameraPos") as
    [number, number, number];
  const [targetX, targetY, targetZ] = vector("defaultSpotPos") as
    [number, number, number];
  const zoom = Number(dependencies.field(panel, "zoom"));
  if (!(zoom > 0)) throw new Error("部件镜头 zoom 无效");
  const fov = Number(dependencies.field(panel, "fov") ?? 75);
  const near = Number(dependencies.field(panel, "nearPlane") ?? 1);
  const far = Number(dependencies.field(panel, "farPlane") ?? 100);
  if (!(fov > 0 && fov / zoom < 180 && near > 0 && far > near))
    throw new Error("部件镜头投影参数无效");
  const aspect = width / height;
  const camera = dependencies.createPerspectiveCamera(
    dependencies.verticalFov(fov / zoom, aspect), aspect, near, far);
  camera.position.set(cameraX, cameraZ, -cameraY);
  camera.lookAt(targetX, targetZ, -targetY);
  return camera;
}

export interface GaragePartModelResource {
  bytes(): Promise<Uint8Array>;
}

export interface GaragePartModelLibrary {
  exactCanonicalCandidates(path: string): GaragePartModelResource[];
}

export interface GaragePartModelRequest {
  path: string;
  panel?: GaragePartPanelNode;
}

export interface GaragePartModelSession {
  object: unknown;
  reset(time: number): void;
  update(time: number, camera: GaragePartCamera, width: number, height: number): void;
  dispose(): void;
}

export interface GaragePartModelScene {
  scene: { add(object: unknown): void };
  camera: GaragePartCamera;
  durationMs: number;
  seek(time: number): void;
  update(width: number, height: number): void;
  dispose(): void;
}

export interface GaragePartModelSceneDependencies extends GaragePartCameraDependencies {
  parsePanel(bytes: Uint8Array): GaragePartPanelNode;
  parseModel(bytes: Uint8Array): unknown;
  createScene(): { add(object: unknown): void };
  loadScene(model: unknown, library: GaragePartModelLibrary, path: string,
    resolveTexture: (texture: { name: string }) => {
      status: "found"; entry: GaragePartModelResource;
    }, options: {
      environment: unknown; stageBinding: unknown; advanceEnvironment: false;
    }): Promise<GaragePartModelSession>;
  now(): number;
}

/** Load a part preview and control its original animation timeline. */
export async function loadGaragePartModelScene(
  library: GaragePartModelLibrary,
  request: GaragePartModelRequest,
  environment: unknown,
  stageBinding: unknown,
  dependencies: GaragePartModelSceneDependencies,
): Promise<GaragePartModelScene> {
  const exactResource = (path: string): GaragePartModelResource => {
    const candidates = library.exactCanonicalCandidates(path);
    if (candidates.length !== 1)
      throw new Error(`部件模型资源缺失或不唯一：${path}`);
    return candidates[0]!;
  };

  const panel = request.panel ??
    dependencies.parsePanel(await exactResource("gui_/windowTemplate/itemPanels.bml").bytes())
      .children.find(node => node.name === "Parts12" &&
        dependencies.field(node, "name") === "default");
  if (!panel) throw new Error("P3543 缺少 Parts12 镜头定义");
  const camera = createGaragePartCamera(panel, 128, 128, dependencies);
  const zoom = Number(dependencies.field(panel, "zoom"));
  const fov = Number(dependencies.field(panel, "fov") ?? 75);
  const model = dependencies.parseModel(await exactResource(request.path).bytes());
  const directory = request.path.slice(0, request.path.lastIndexOf("/") + 1);
  const session = await dependencies.loadScene(model, library, request.path,
    texture => ({ status: "found", entry: exactResource(`${directory}${texture.name}.png`) }),
    { environment, stageBinding, advanceEnvironment: false });
  const scene = dependencies.createScene();
  scene.add(session.object);
  session.reset(dependencies.now());
  let seekTime: number | undefined;
  const durationMs = garagePartModelDuration(model);

  return {
    scene, camera, durationMs,
    seek(time) {
      if (!Number.isFinite(time) || time < 0) throw new Error("动画时间无效");
      if (seekTime === undefined || time < seekTime) session.reset(1000);
      seekTime = Math.min(time, Math.max(0, durationMs - 0.001));
    },
    update(width, height) {
      camera.aspect = width / height;
      camera.fov = dependencies.verticalFov(fov / zoom, camera.aspect);
      camera.updateProjectionMatrix();
      session.update(seekTime === undefined ? dependencies.now() : 1000 + seekTime,
        camera, width, height);
    },
    dispose() { session.dispose(); },
  };
}
