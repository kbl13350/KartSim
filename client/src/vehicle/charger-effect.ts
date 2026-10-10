export const CHARGER_EFFECT_PATH = "effect/charger/카트바디차저발동.1s";

export interface ChargerSceneObject {
  visible: boolean;
  add(object: ChargerSceneObject): void;
  traverse(visit: (node: { isMesh?: boolean }) => void): void;
  removeFromParent(): void;
}

export interface ChargerScene {
  object: ChargerSceneObject;
  playControllers?(nowMs: number, offsetMs: number): void;
  stopControllers?(nowMs: number): void;
  update(nowMs: number, frame: unknown, environment: unknown, options: unknown): void;
  dispose(): void;
}

export interface ChargerArchiveEntry {
  virtualPath: string;
  bytes(): Promise<unknown>;
}

export interface ChargerArchive {
  exactCanonicalCandidates(path: string): ChargerArchiveEntry[];
}

export interface ChargerEffectOps<ModelData> {
  decodeModel(bytes: unknown): ModelData;
  loadModel(
    data: ModelData,
    archive: ChargerArchive,
    path: string,
    identity: { id: "effect:charger" },
    options: { environment: unknown; stageBinding: unknown; advanceEnvironment: false; convertClientCoordinates: false },
  ): Promise<ChargerScene>;
  prepareTexture(object: ChargerSceneObject): void;
  configureMesh(node: { isMesh?: boolean }, renderOrder: -1000, transparent: true, depthBias: -0.01): void;
  configureMaterials(object: ChargerSceneObject): void;
}

/** Kart charger animation: its activity follows the charge state each frame. */
export class ChargerEffect {
  scene: ChargerScene;
  active = false;

  constructor(scene: ChargerScene) {
    this.scene = scene;
    this.scene.object.visible = false;
  }

  static async load<ModelData>(
    archive: ChargerArchive,
    parent: { object: ChargerSceneObject },
    environment: unknown,
    stageBinding: unknown,
    ops: ChargerEffectOps<ModelData>,
  ): Promise<ChargerEffect> {
    const candidates = archive.exactCanonicalCandidates(CHARGER_EFFECT_PATH);
    if (candidates.length !== 1) {
      throw new Error(`${CHARGER_EFFECT_PATH} source 数量应为 1，实际为 ${candidates.length}。`);
    }
    const entry = candidates[0]!;
    const scene = await ops.loadModel(
      ops.decodeModel(await entry.bytes()), archive, entry.virtualPath,
      { id: "effect:charger" },
      { environment, stageBinding, advanceEnvironment: false, convertClientCoordinates: false },
    );
    parent.object.add(scene.object);
    ops.prepareTexture(scene.object);
    scene.object.traverse(node => {
      if (node.isMesh === true) ops.configureMesh(node, -1000, true, -0.01);
    });
    ops.configureMaterials(scene.object);
    return new this(scene);
  }

  update(nowMs: number, charging: boolean, animationOffsetMs: number, frame: unknown, environment: unknown, options: unknown): void {
    const now = Math.trunc(nowMs) >>> 0;
    if (charging !== this.active) {
      this.active = charging;
      if (charging) {
        this.scene.object.visible = true;
        this.scene.playControllers?.(now, Math.trunc(animationOffsetMs) >>> 0);
      } else {
        this.scene.stopControllers?.(now);
        this.scene.object.visible = false;
      }
    }
    if (charging) this.scene.update(now, frame, environment, options);
  }

  reset(nowMs = 0): void {
    this.active = false;
    this.scene.stopControllers?.(Math.trunc(nowMs) >>> 0);
    this.scene.object.visible = false;
  }

  dispose(): void {
    this.scene.object.removeFromParent();
    this.scene.dispose();
  }
}
