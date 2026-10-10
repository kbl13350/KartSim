/** Small room state projections shared by the lobby view. */

export interface LobbyRoomMember {
  playerId: string;
  slot: number;
  equipment?: { itemIds: Record<number, number>; [key: string]: unknown };
  [key: string]: unknown;
}

export interface LobbyRoomSnapshot {
  members: LobbyRoomMember[];
  mode: string;
  capacity: number;
  closedSlots?: number[];
  phase?: string;
  hostId?: string;
  race?: { roadblock?: { runnerId?: string } };
  [key: string]: unknown;
}

export interface LobbyRoomSlot {
  slot: number;
  member: LobbyRoomMember | undefined;
  open: boolean;
}

export function lobbyRiderSlots(room: LobbyRoomSnapshot,
  playerId: string): (LobbyRoomSlot | undefined)[] {
  const ownSlot = room.members.find(member => member.playerId === playerId)?.slot;
  if (ownSlot === undefined) return [];
  const slots = Array.from({ length: 8 }, (_, slot) => ({
    slot,
    member: room.members.find(member => member.slot === slot),
    open: (room.mode === "individual" ? slot < room.capacity
      : slot % 4 < room.capacity / 2) &&
      !room.closedSlots?.includes(slot),
  }));
  return room.mode === "team" ? slots
    : [slots[ownSlot], ...slots.filter(value => value.slot !== ownSlot)];
}

export function roadblockRunnerId(room: LobbyRoomSnapshot,
  gameplayMode: (room: LobbyRoomSnapshot) => string): string | undefined {
  if (gameplayMode(room) === "roadblock") {
    return room.phase === "open" ? room.hostId : room.race?.roadblock?.runnerId;
  }
  return undefined;
}

export function decorateRoadblockRiders(room: LobbyRoomSnapshot,
  colors: { dyeId: number }[], runnerId: string | undefined):
  LobbyRoomSnapshot {
  if (!runnerId) return room;
  if (colors.length !== 2) throw new Error("挡人房间缺少红蓝装饰资源。");
  return { ...room, members: room.members.map(member =>
    member.equipment ? {
      ...member,
      equipment: {
        ...member.equipment,
        itemIds: {
          ...member.equipment.itemIds,
          70: colors[member.playerId === runnerId ? 0 : 1]!.dyeId,
        },
      },
    } : member) };
}

export function wrapLobbyChatBubble(text: string): string[] {
  const lines = [""];
  for (const character of text) {
    const index = lines.length - 1;
    const width = Array.from(lines[index]! + character).reduce((sum, point) =>
      sum + (/^[\x00-\x7f]$/.test(point) ? 7 : 14), 0);
    if (width > 119 && lines[index]) lines.push(character);
    else lines[index] += character;
  }
  return lines.length <= 3 ? lines
    : [...lines.slice(0, 2), `${lines[2]!.slice(0, -1)}…`];
}
