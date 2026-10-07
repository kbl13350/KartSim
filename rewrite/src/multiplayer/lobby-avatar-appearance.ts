/** Collect kart and rider dye colors before building a lobby avatar preview. */

export interface LobbyAvatarEquipment {
  itemIds: Record<number, number>;
  [key: string]: unknown;
}

export interface LobbyAvatarAppearanceDependencies {
  loadRoleTeams(library: unknown): Promise<{ dyeId: number }[]>;
  paintColors(library: unknown, itemId: number, slot?: number):
    Promise<unknown>;
  cosmetics(equipment: LobbyAvatarEquipment, member: unknown): unknown;
}

export async function loadLobbyAvatarAppearance(library: unknown,
  equipment: LobbyAvatarEquipment, teamIndex: number | null,
  member: unknown, initial = "",
  dependencies: LobbyAvatarAppearanceDependencies) {
  const dyeId = teamIndex === null ? equipment.itemIds[70]
    : (await dependencies.loadRoleTeams(library))[teamIndex - 1]!.dyeId;
  const [kartColors, riderColors] = await Promise.all([
    equipment.itemIds[2]
      ? dependencies.paintColors(library, equipment.itemIds[2])
      : { primary: 0, high: 0 },
    dyeId ? dependencies.paintColors(library, dyeId, 70) : null,
  ]);
  const cosmetics = dependencies.cosmetics(equipment, member);
  return { equipment, kartColors, riderColors, initial,
    build: cosmetics ? { cosmetics } : {} };
}
