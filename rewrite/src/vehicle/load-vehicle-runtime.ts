export interface VehicleRuntimeProfile {
  equipment: { itemIds: Record<number, number>; kartSerial: number };
  garage: unknown;
  initial: unknown;
}

export interface VehicleArchiveEntry {
  extension: string;
  bytes(): Promise<Uint8Array>;
}

export interface VehicleResourceBundle {
  parameter: { value: unknown };
  find(paths: string[]): VehicleArchiveEntry | undefined;
}

export interface ImportedVehicle {
  object: unknown;
  model: unknown;
  renderScene?: { dispose(): void };
}

export interface VehicleRuntimeOwner {
  assetHost: {
    userProfile: VehicleRuntimeProfile;
    importer: {
      importVehicleRender(...args: unknown[]): Promise<ImportedVehicle>;
    };
  };
}

export interface VehicleRuntimeOps {
  resolveResources(library: unknown, path: string, scope: unknown): Promise<VehicleResourceBundle>;
  wheelAssets(bundle: VehicleResourceBundle, library: unknown): (VehicleArchiveEntry | undefined)[];
  palette(library: unknown, itemId: number): Promise<{ primary: number; high: number }>;
  prepareAppearance(...args: unknown[]): Promise<unknown>;
  garageKart(garage: unknown, itemId: number, serial: number): {
    cosmetics?: { coating?: unknown };
    factory?: { active?: boolean };
    progression?: { kind?: string; level?: number };
  } | undefined;
  parseParameters(value: unknown): unknown;
  makeVisual(library: unknown, parameters: unknown, cosmetics: unknown): Promise<{
    isWheelOutline: boolean;
    [key: string]: unknown;
  }>;
  shortAssetName(path: string): string;
  loadCoating(...args: unknown[]): Promise<{ dispose(): void }>;
  needsParticleModification(grade: number | undefined, factoryActive: boolean,
    progressionLevel: number | undefined): boolean;
  loadXunModification(...args: unknown[]): Promise<unknown>;
  loadParticleModification(...args: unknown[]): Promise<unknown>;
  disposeObject(object: unknown): void;
}

/** Resolves a kart's model, appearance, coating, and progression effects. */
export async function loadVehicleRuntime(
  owner: VehicleRuntimeOwner,
  path: string,
  textureKey: string,
  plateId: number,
  library: unknown,
  environment: unknown,
  stageBinding: { coatingTextures(library: unknown): unknown },
  profile: VehicleRuntimeProfile = owner.assetHost.userProfile,
  kartItemId?: number,
  engineGrade?: number,
  coatingTextureOverride?: unknown,
  scope?: unknown,
  convertClientCoordinates?: boolean,
  deferEnvironment = false,
  ops?: VehicleRuntimeOps,
): Promise<{
  imported: ImportedVehicle;
  visual: { isWheelOutline: boolean; [key: string]: unknown };
  resources: VehicleResourceBundle;
  coating: { dispose(): void } | undefined;
  particleModification: unknown;
}> {
  if (!ops) throw new Error("Vehicle runtime dependencies are required.");
  const resources = await ops.resolveResources(library, path, scope);
  const model = resources.find(["model.1s"]);
  if (!model || model.extension !== "1s")
    throw new Error("玩家车辆必须能解析 model.1s 与 base param*.xml。");
  const wheelAssets = ops.wheelAssets(resources, library);
  const paintItemId = profile.equipment.itemIds[2]!;
  const paint = paintItemId === 0
    ? { primary: 0, high: 0 }
    : await ops.palette(library, paintItemId);
  const [modelBytes, wheelBytes, appearance] = await Promise.all([
    model.bytes(),
    Promise.all(wheelAssets.map(asset => asset?.bytes())),
    ops.prepareAppearance(library, resources, textureKey, plateId,
      paint.primary, paint.high, {
        itemId: profile.equipment.itemIds[4], initial: profile.initial,
      }),
  ]);
  const garageItem = kartItemId === undefined ? undefined : ops.garageKart(
    profile.garage, kartItemId,
    kartItemId === profile.equipment.itemIds[3] ? profile.equipment.kartSerial : 0,
  );
  const visual = await ops.makeVisual(library,
    ops.parseParameters(resources.parameter.value), garageItem?.cosmetics);
  const imported = await owner.assetHost.importer.importVehicleRender(
    modelBytes, ops.shortAssetName(path), appearance, wheelBytes,
    visual.isWheelOutline, environment, stageBinding,
    convertClientCoordinates, deferEnvironment,
  );
  try {
    const coating = imported.renderScene && engineGrade !== undefined
      ? await ops.loadCoating(
          library, imported.renderScene, imported.model, visual,
          engineGrade, garageItem?.cosmetics,
          coatingTextureOverride ?? stageBinding.coatingTextures(library),
        )
      : undefined;
    if (garageItem?.cosmetics?.coating !== undefined && !coating)
      throw new Error("车膜缺少车辆渲染器。");
    const factoryActive = garageItem?.factory?.active === true;
    const progressionLevel = garageItem?.progression?.kind === "xun"
      ? garageItem.progression.level : undefined;
    let particleModification: unknown;
    if (imported.renderScene &&
        ops.needsParticleModification(engineGrade, factoryActive, progressionLevel)) {
      particleModification = engineGrade === 9
        ? await ops.loadXunModification(library, imported.renderScene, environment, stageBinding)
        : await ops.loadParticleModification(library, imported.renderScene, environment, stageBinding);
    }
    return { imported, visual, resources, coating, particleModification };
  } catch (error) {
    imported.renderScene?.dispose();
    ops.disposeObject(imported.object);
    throw error;
  }
}
