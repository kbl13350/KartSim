/** Preload only the pet selected by this player's RP box draw. */

export interface RpArchiveEntry {
  sourceKind: string;
  virtualPath: string;
  sourceName: string;
  bytes(): Promise<unknown>;
}

export interface RpPetLibrary {
  entriesUnderCanonicalPrefix(prefix: string): Iterable<RpArchiveEntry>;
}

export interface RpPetRace {
  rp?: { draws: Record<string, { flyingPetId?: number }> };
  roster: { playerId: string }[];
}

export interface RpPetPreloadDependencies {
  validDraws(rp: NonNullable<RpPetRace["rp"]>,
    playerIds: string[]): boolean;
  findItem(library: RpPetLibrary, itemId: number):
    Promise<{ internalId: string } | undefined>;
  loadPet(library: RpPetLibrary, internalId: string):
    Promise<{ folders: string[]; soundFolders: string[] }>;
  sharedFolder: string;
}

export async function preloadRpFlyingPet(library: RpPetLibrary,
  race: RpPetRace, playerId: string,
  signal: { throwIfAborted(): void },
  dependencies: RpPetPreloadDependencies): Promise<void> {
  if (!race.rp) return;
  signal.throwIfAborted();
  if (!dependencies.validDraws(race.rp,
    race.roster.map(member => member.playerId))) {
    throw new Error("RP 飞宠预读缺少有效抽取结果。");
  }
  const draw = race.rp.draws[playerId];
  if (!draw) throw new Error("RP 飞宠预读缺少本机抽取结果。");
  if (!draw.flyingPetId) return;
  const item = await dependencies.findItem(library, draw.flyingPetId);
  signal.throwIfAborted();
  if (!item) throw new Error("RP 飞宠预读缺少物品身份。");
  const pet = await dependencies.loadPet(library, item.internalId);
  signal.throwIfAborted();
  const prefixes = [
    ...pet.folders.map(folder => `flyingPet_/${folder}`),
    dependencies.sharedFolder,
    ...pet.soundFolders.map(folder => `sound_/flyingPet/${folder}`),
  ];
  const unique = new Map<string, RpArchiveEntry>();
  for (const prefix of prefixes) {
    for (const entry of library.entriesUnderCanonicalPrefix(prefix)) {
      const key = entry.sourceKind === "loose"
        ? entry.virtualPath : entry.sourceName;
      if (!unique.has(key)) unique.set(key, entry);
    }
  }
  const entries = [...unique.values()];
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      signal.throwIfAborted();
      await entries[next++]!.bytes();
      signal.throwIfAborted();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, entries.length) }, worker));
}
