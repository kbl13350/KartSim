export interface CharacterFile {
  containerId: string;
  canonicalPath?: string;
  virtualPath: string;
  sourceName: string;
  name: string;
  bytes(): Promise<Uint8Array>;
}

export interface CharacterLibrary {
  files: CharacterFile[];
}

export interface CharacterAssetOwner {
  assetHost: {
    userProfile: { equipment: { itemIds: Record<number, number> } };
    getLibrary(): CharacterLibrary | undefined;
    requireAsset(path: string): CharacterFile;
  };
}

export interface CharacterIdentity {
  model: string;
  body: string;
  high?: string;
  motionFolder?: string;
}

export interface FaceTextureSource {
  kind: "direct" | "split";
  image: string;
  base: string;
  overlay: string;
}

export interface CharacterAssetOps {
  resolveIdentity(library: CharacterLibrary, internalId: unknown, uniform: unknown,
    path: string): Promise<unknown>;
  chooseCostume(files: string[], identity: unknown): CharacterIdentity;
  decodeMotion(bytes: Uint8Array): unknown;
  linkedMotionNames: string[];
  specialMotionNames: string[];
  standardMotionNames: string[];
  linkedController(motions: Map<string, unknown>, source: unknown, always: boolean): unknown;
  specialController(motions: Map<string, unknown>, source: unknown): unknown;
  standardController(motions: Map<string, unknown>, source: unknown): unknown;
  awardController(controller: unknown, idle: unknown,
    motions: Record<number, unknown>, finished: unknown): unknown;
  faceTextureSources(files: string[], identity: CharacterIdentity, motionAssets: unknown):
    Map<string, FaceTextureSource>;
  collectFaceMotionAssets(motions: unknown[]): unknown;
  palette(library: CharacterLibrary, itemId: number, category?: number): Promise<{
    primary: number; high: number;
  }>;
  parseModel(bytes: Uint8Array): unknown;
  createScene(...args: unknown[]): Promise<unknown>;
}

/** Loads a rider model, animation set and face textures from its exact archive. */
export async function loadCharacterAsset(
  owner: CharacterAssetOwner,
  path: string,
  item: { internalId: unknown; uniform: unknown },
  motionSource: unknown,
  animationType: number,
  includeF54: boolean,
  environment: unknown,
  stageBinding: unknown,
  linkMode?: "always" | "conditional",
  profile: { equipment: { itemIds: Record<number, number> } } = owner.assetHost.userProfile,
  outlineBatch?: unknown,
  award = false,
  ops?: CharacterAssetOps,
): Promise<{ name: string; scene: unknown; award: unknown }> {
  if (!ops) throw new Error("Character asset dependencies are required.");
  const library = owner.assetHost.getLibrary();
  if (!library) throw new Error("人物资源库尚未建立。");
  const source = owner.assetHost.requireAsset(path);
  const files = library.files.filter(file => file.containerId === source.containerId);
  const localName = (file: CharacterFile): string => {
    const normalized = (file.canonicalPath ?? file.virtualPath).replaceAll("\\", "/");
    const costumeIndex = normalized.toLowerCase().lastIndexOf("/costume/");
    return costumeIndex >= 0
      ? normalized.slice(costumeIndex + 1)
      : normalized.slice(normalized.lastIndexOf("/") + 1);
  };
  const byName = new Map(files.map(file => [localName(file).toLowerCase(), file]));
  const identityRecord = await ops.resolveIdentity(library, item.internalId, item.uniform, path);
  const costume = ops.chooseCostume([...byName.keys()], identityRecord);
  const get = (name: string): CharacterFile | undefined => byName.get(name.toLowerCase());
  const model = get(costume.model);
  const body = get(costume.body);
  const high = costume.high ? get(costume.high) : undefined;
  if (!model) throw new Error(`${path} 的 model provenance 不完整。`);
  if (!body) throw new Error(`${path} 的 body texture provenance 不完整。`);
  if (costume.high && !high)
    throw new Error(`${path} 的 high texture provenance 不完整。`);
  const commonMotion = (name: string): CharacterFile | undefined => library.files.find(file =>
    file.sourceName.toLowerCase() === "character_common.rho" &&
    file.name.toLowerCase() === name.toLowerCase());
  const loadMotion = async (name: string): Promise<unknown> => {
    const localPath = costume.motionFolder
      ? `${costume.motionFolder}/${name}.1s` : `${name}.1s`;
    const file = get(localPath) ?? commonMotion(`${name}.1s`);
    if (!file)
      throw new Error("TimeAttack 人物动画缺少本地或 character_common.rho/" + `${name}.1s。`);
    return ops.decodeMotion(await file.bytes());
  };
  if (animationType !== 0 && animationType !== 1)
    throw new Error(`ItemKart characterAniType ${animationType} 不在 P3528 已闭合集合。`);
  const names = linkMode ? ops.linkedMotionNames
    : animationType === 1 ? ops.specialMotionNames : ops.standardMotionNames;
  const requested = [...new Set([...names, ...(award ? ["f40", "f41", "f42"] : [])])]
    .filter(name => name !== "f54" || includeF54);
  const loaded = await Promise.all(requested.map(async name =>
    [name, await loadMotion(name)] as const));
  const motions = new Map(loaded);
  const motionValues = [...motions.values()];
  const controller = linkMode
    ? ops.linkedController(motions, motionSource, linkMode === "always")
    : animationType === 1
      ? ops.specialController(motions, motionSource)
      : ops.standardController(motions, motionSource);
  if (award && animationType !== 0)
    throw new Error("颁奖动作暂未开放特殊角色动画车型。");
  const requiredMotion = (name: string): unknown => {
    const value = motions.get(name);
    if (!value) throw new Error(`人物动作集合缺少 ${name}。`);
    return value;
  };
  const awardController = award
    ? ops.awardController(controller, requiredMotion("f00"), {
        3: requiredMotion("f40"), 4: requiredMotion("f41"),
        5: requiredMotion("f42"), 12: requiredMotion("f49"),
      }, requiredMotion("f50"))
    : undefined;
  const faceSources = ops.faceTextureSources([...byName.keys()], costume,
    ops.collectFaceMotionAssets(motionValues));
  const faces = new Map(await Promise.all([...faceSources].map(async ([name, sourceInfo]) => {
    const image = get(sourceInfo.kind === "direct" ? sourceInfo.image : sourceInfo.base);
    const overlay = sourceInfo.kind === "split" ? get(sourceInfo.overlay) : undefined;
    if (!image || (sourceInfo.kind === "split" && !overlay))
      throw new Error(`${path} 的 face ${name} texture provenance 不完整。`);
    return [name, { image: await image.bytes(), overlay: overlay ? await overlay.bytes() : undefined }] as const;
  })));
  const paletteCategory = linkMode ? 2 : 70;
  const paletteItemId = profile.equipment.itemIds[paletteCategory]!;
  const colors = paletteItemId === 0
    ? { primary: 0, high: 0 }
    : await ops.palette(library, paletteItemId, paletteCategory);
  const scene = await ops.createScene(
    ops.parseModel(await model.bytes()), await body.bytes(), faces,
    awardController ?? controller, environment, stageBinding, {
      convertClientCoordinates: false,
      highTextureBytes: high ? await high.bytes() : undefined,
      primaryColor: colors.primary,
      highColor: colors.high,
      outlineBatch,
    },
  );
  return {
    name: source.sourceName.replace(/^character_/i, "").replace(/\.rho$/i, ""),
    scene,
    award: awardController,
  };
}
