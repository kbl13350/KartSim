export interface LoadedRaceCharacter {
  scene: { object: { visible: boolean } };
  [key: string]: unknown;
}

export interface RaceCharacterItem {
  itemId: number;
  linkCharacterId: number;
  alwaysLinkCharacter: boolean;
  hideChar: boolean;
  characterAniType: number;
}

export interface RaceCharacterAssetOwner {
  assetHost: {
    userProfile: { equipment: { itemIds: Record<number, number> } };
    getLibrary(): {
      timeAttackLinkedCharacterItem(id: number): Promise<{ path: string }>;
    } | undefined;
  };
  loadCharacterAsset(...args: unknown[]): Promise<LoadedRaceCharacter>;
}

/** Selects the ordinary rider or the kart's linked rider for a race. */
export async function loadRaceCharacters(
  owner: RaceCharacterAssetOwner,
  characterPath: string,
  characterItem: unknown,
  kartItem: RaceCharacterItem,
  motionBasis: unknown,
  includeSpecialMotion: boolean,
  environment: unknown,
  stageBinding: unknown,
  award = false,
): Promise<{ ordinary?: LoadedRaceCharacter; linked?: LoadedRaceCharacter }> {
  const profile = owner.assetHost.userProfile;
  if (!kartItem.linkCharacterId) {
    if (profile.equipment.itemIds[70] === 0) return {};
    const ordinary = await owner.loadCharacterAsset(
      characterPath, characterItem, motionBasis, kartItem.characterAniType,
      includeSpecialMotion, environment, stageBinding, undefined,
      profile, undefined, award,
    );
    ordinary.scene.object.visible = !kartItem.hideChar;
    return { ordinary };
  }
  if (kartItem.hideChar || kartItem.characterAniType !== 0)
    throw new Error(`ItemKart ${kartItem.itemId} 出现未分析的 linked character flag 组合。`);
  const library = owner.assetHost.getLibrary();
  if (!library) throw new Error("linked character 资源库尚未建立。");
  const linkedItem = await library.timeAttackLinkedCharacterItem(kartItem.linkCharacterId);
  return {
    linked: await owner.loadCharacterAsset(
      linkedItem.path, linkedItem, motionBasis, 0,
      includeSpecialMotion, environment, stageBinding,
      kartItem.alwaysLinkCharacter ? "always" : "conditional",
      undefined, undefined, award,
    ),
  };
}
