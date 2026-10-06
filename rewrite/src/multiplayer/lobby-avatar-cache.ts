/** Async player-preview cache for a multiplayer lobby. */

export interface LobbyEquipment {
  systemKart?: unknown;
  systemKartVariant?: unknown;
  kartSerial?: unknown;
  valueAt3E?: unknown;
  exceedType?: unknown;
  itemIds: Record<number, unknown>;
}

export interface LobbyMember<PlayerId = unknown> {
  playerId: PlayerId;
  team?: unknown;
  equipment?: LobbyEquipment;
  initial?: unknown;
}

export interface LobbyRoster<PlayerId = unknown> {
  mode: string;
  members: LobbyMember<PlayerId>[];
}

/** Identity includes only visual-affecting equipment, in release order. */
export function lobbyAvatarKey(member: LobbyMember, mode: string,
  cosmeticItemSlots: readonly number[]): string | undefined {
  const equipment = member.equipment;
  return equipment && JSON.stringify([
    mode === "team" ? member.team : null,
    equipment.systemKart,
    equipment.systemKartVariant,
    member.initial ?? "",
    equipment.kartSerial,
    equipment.valueAt3E,
    equipment.exceedType,
    ...cosmeticItemSlots.map(slot => equipment.itemIds[slot]),
  ]);
}

interface AvatarEntry<Value> {
  key: string;
  value?: Value;
}

export class LobbyAvatarCache<Value, PlayerId = unknown> {
  readonly entries = new Map<PlayerId, AvatarEntry<Value>>();
  disposed = false;

  constructor(
    readonly build: (member: LobbyMember<PlayerId>, team: unknown) => Promise<Value>,
    readonly release: (value: Value) => void,
    readonly changed: () => void,
    readonly failed: (error: unknown) => void,
    private readonly cosmeticItemSlots: readonly number[],
  ) {}

  get(playerId: PlayerId): Value | undefined {
    return this.entries.get(playerId)?.value;
  }

  update(roster: LobbyRoster<PlayerId>): void {
    if (this.disposed) return;
    const present = new Set(roster.members.map(member => member.playerId));
    for (const [playerId, entry] of this.entries) {
      if (present.has(playerId)) continue;
      this.entries.delete(playerId);
      if (entry.value) this.release(entry.value);
    }

    for (const member of roster.members) {
      const key = lobbyAvatarKey(member, roster.mode, this.cosmeticItemSlots);
      const previous = this.entries.get(member.playerId);
      if (previous?.key === key) continue;
      this.entries.delete(member.playerId);
      if (previous?.value) this.release(previous.value);
      if (!key) continue;

      const pending: AvatarEntry<Value> = { key };
      this.entries.set(member.playerId, pending);
      this.build(member, roster.mode === "team" ? member.team : null).then(
        value => {
          if (this.disposed || this.entries.get(member.playerId) !== pending) {
            this.release(value);
          } else {
            pending.value = value;
            this.changed();
          }
        },
        error => {
          if (!this.disposed && this.entries.get(member.playerId) === pending) {
            this.failed(error);
          }
        },
      );
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const entry of this.entries.values()) {
      if (entry.value) this.release(entry.value);
    }
    this.entries.clear();
  }
}
