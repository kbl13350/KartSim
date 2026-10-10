/** Ghost vehicle and decoration resources prepared by the solo-race builder. */

export interface GhostEquipment {
  kart: number;
  kartPath?: string;
  systemKey?: unknown;
  character: number;
  characterColor?: number;
  itemIds: Record<number, number>;
}

export interface GhostSource {
  equipment: GhostEquipment;
}

export interface GhostKartCatalogEntry {
  itemId: number;
  path: string;
  systemKey?: unknown;
  textureKey?: unknown;
  engineGrade?: number;
  fixedPlateId?: unknown;
  hideChar?: boolean;
  characterAniType?: number;
  linkCharacterId?: number;
  alwaysLinkCharacter?: boolean;
}

export interface GhostAssetLibrary {
  timeAttackGarageCatalog(): Promise<{
    karts: GhostKartCatalogEntry[];
    characters: Array<{ itemId: number; path: string }>;
  }>;
  timeAttackLinkedCharacterItem(id: number): Promise<{ path: string }>;
  timeAttackCharacterItem(id: number, path: string): Promise<unknown>;
  timeAttackDecorationItem(slot: number, itemId: number | undefined): Promise<{
    internalId: unknown;
    [key: string]: unknown;
  }>;
}

export interface GhostAssetBuilder {
  host: {
    getLibrary(): GhostAssetLibrary | undefined;
    userProfile: { equipment: { itemIds: Record<number, number> } };
  };
  loadVehicleRuntime(...args: unknown[]): Promise<{
    imported: unknown;
    visual: { reverse: unknown; onCharacterSize: unknown };
  }>;
  loadCharacterAsset(...args: unknown[]): Promise<{ scene: unknown }>;
}

export interface GhostAssetDependencies {
  findKart(catalog: GhostKartCatalogEntry[], itemId: number,
    path: string, systemKey: unknown): GhostKartCatalogEntry | undefined;
  loadParameterFactory(): Promise<(
    identity: { itemId: number; systemKey: unknown }, speed: unknown,
    bodyParameter: unknown, version: unknown,
  ) => { spec: { motorcycleType: number } }>;
  loadBodyParameter(library: GhostAssetLibrary, path: string,
    systemKey: unknown): Promise<{ parameter: { value: unknown } }>;
  ghostItemIds(equipment: GhostEquipment): unknown;
  loadPaintColor(library: GhostAssetLibrary, itemId: number | undefined,
    slot?: number): Promise<{ primary: number }>;
  createBalloon(library: GhostAssetLibrary, internalId: unknown,
    scene: unknown, importer: unknown,
    configuration: Record<string, unknown>): Promise<{ dispose(): void }>;
  createAccessory(library: GhostAssetLibrary, kind: string, internalId: unknown,
    scene: unknown, importer: unknown,
    configuration: Record<string, unknown>): Promise<{ dispose(): void }>;
}

export async function loadGhostKartAssets(builder: GhostAssetBuilder,
  ghost: GhostSource, scene: unknown, importer: unknown, speed: unknown,
  version: unknown, signal: unknown, dependencies: GhostAssetDependencies): Promise<{
    imported: unknown;
    visual: { reverse: unknown; onCharacterSize: unknown };
    character: unknown;
    onCharacterSize: unknown;
    linkedCharacter: "always" | "conditional" | false;
    engineGrade: number;
    motorcycle: boolean;
  }> {
  const library = builder.host.getLibrary();
  if (!library) throw new Error("影子资源库尚未建立。");
  const catalog = await library.timeAttackGarageCatalog();
  const firstKart = catalog.karts.find(kart => kart.itemId === ghost.equipment.kart);
  const kart = dependencies.findKart(catalog.karts, ghost.equipment.kart,
    ghost.equipment.kartPath ?? firstKart?.path ?? "", ghost.equipment.systemKey);
  if (!kart) {
    throw new Error(`影子录制的 ItemKart ${ghost.equipment.kart} 不在当前车库目录。`);
  }
  if (kart.textureKey === undefined || kart.engineGrade === undefined ||
    kart.fixedPlateId === undefined || kart.hideChar === undefined ||
    kart.characterAniType === undefined) {
    throw new Error(`影子 ItemKart ${kart.itemId} metadata 不完整。`);
  }

  const engineGrade = kart.engineGrade;
  const createParameters = await dependencies.loadParameterFactory();
  const bodyParameter = kart.itemId === 0
    ? (await dependencies.loadBodyParameter(library, kart.path, kart.systemKey)).parameter.value
    : undefined;
  const { spec } = createParameters({ itemId: kart.itemId, systemKey: kart.systemKey },
    speed, bodyParameter, version);
  const motorcycle = spec.motorcycleType !== 0;
  const itemIds = dependencies.ghostItemIds(ghost.equipment);
  const vehicle = await builder.loadVehicleRuntime(
    kart.path, kart.textureKey, kart.fixedPlateId, library,
    scene, importer, itemIds, undefined, undefined, undefined,
    kart.systemKey, signal, !kart.linkCharacterId,
  );

  if (kart.linkCharacterId) {
    if (kart.hideChar || kart.characterAniType !== 0 ||
      kart.alwaysLinkCharacter === undefined) {
      throw new Error(`影子 ItemKart ${kart.itemId} 出现未分析的 linked character flag 组合。`);
    }
    const linked = await library.timeAttackLinkedCharacterItem(kart.linkCharacterId);
    const linkedMode = kart.alwaysLinkCharacter ? "always" : "conditional";
    const character = await builder.loadCharacterAsset(
      linked.path, linked, vehicle.visual.reverse, 0, motorcycle,
      scene, importer, linkedMode, itemIds, signal,
    );
    return {
      imported: vehicle.imported,
      visual: vehicle.visual,
      character: character.scene,
      onCharacterSize: vehicle.visual.onCharacterSize,
      linkedCharacter: linkedMode,
      engineGrade,
      motorcycle,
    };
  }

  const firstCharacter = catalog.characters.find(character =>
    character.itemId === ghost.equipment.character);
  if (!firstCharacter) {
    throw new Error(`影子录制的 ItemCharacter ${ghost.equipment.character} 不在当前车库目录。`);
  }
  const characterItem = await library.timeAttackCharacterItem(
    ghost.equipment.character, firstCharacter.path);
  const character = await builder.loadCharacterAsset(
    firstCharacter.path, characterItem, vehicle.visual.reverse,
    kart.characterAniType, motorcycle, scene, importer,
    undefined, itemIds, signal,
  );
  return {
    imported: vehicle.imported,
    visual: vehicle.visual,
    character: character.scene,
    onCharacterSize: vehicle.visual.onCharacterSize,
    linkedCharacter: false,
    engineGrade,
    motorcycle,
  };
}

/** Dispose each completed decoration when a later load fails. */
export async function loadGhostDecorations(ghost: GhostSource,
  library: GhostAssetLibrary, scene: unknown, importer: unknown,
  dependencies: GhostAssetDependencies): Promise<{
    balloon?: { dispose(): void };
    accessories: Array<{ kind: string; render: { dispose(): void } }>;
  }> {
  let balloon: { dispose(): void } | undefined;
  const accessories: Array<{ kind: string; render: { dispose(): void } }> = [];
  try {
    const balloonId = ghost.equipment.itemIds[9];
    if (balloonId !== 0) {
      const item = await library.timeAttackDecorationItem(9, balloonId);
      const paintId = ghost.equipment.itemIds[2];
      const wireColor = paintId === 0 ? undefined
        : (await dependencies.loadPaintColor(library, paintId)).primary;
      balloon = await dependencies.createBalloon(library, item.internalId,
        scene, importer, { ...item, wireColor });
    }
    for (const [kind, slot] of [
      ["goggle", 8], ["headBand", 11], ["handGearL", 16],
    ] as const) {
      const itemId = ghost.equipment.itemIds[slot];
      if (itemId === 0) continue;
      const item = await library.timeAttackDecorationItem(slot, itemId);
      accessories.push({
        kind,
        render: await dependencies.createAccessory(library, kind, item.internalId,
          scene, importer, { convertClientCoordinates: false }),
      });
    }
    return { balloon, accessories };
  } catch (error) {
    balloon?.dispose();
    accessories.forEach(({ render }) => render.dispose());
    throw error;
  }
}

export async function rankGhostColors(builder: GhostAssetBuilder,
  ghosts: GhostSource[], dependencies: GhostAssetDependencies): Promise<Array<number | undefined>> {
  const library = builder.host.getLibrary();
  if (!library) throw new Error("比赛资源库尚未建立。");
  const itemIds = [
    builder.host.userProfile.equipment.itemIds[70],
    ...ghosts.map(ghost => ghost.equipment.characterColor ?? 0),
  ];
  return Promise.all(itemIds.map(async itemId =>
    itemId === 0 ? undefined
      : (await dependencies.loadPaintColor(library, itemId, 70)).primary & 0xFFFFFF));
}
