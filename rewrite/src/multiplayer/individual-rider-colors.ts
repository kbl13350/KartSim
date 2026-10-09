/**
 * Individual rooms dress every racer in a different basic dye, like the
 * original game: the outfit, the rank board and the minimap marker all take
 * that colour, so racers on the same character can still be told apart.
 * Team rooms keep the team dyes and roadblock rooms the runner/blocker dyes.
 *
 * Each room shuffles the palette once, seeded by its room ID, and a racer
 * takes the dye of its slot. Every browser derives the same colours from the
 * room snapshot alone, and slots are unique, so no two racers share a dye.
 */

/** The bright basic dyes of itemTable.kml: red, yellow, orange, green,
 * light jade, blue, purple and pink (black 8 and white 10 left out). One per
 * slot of an eight-racer room. */
export const individualRiderDyes: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 9];

const shuffles = new Map<string, readonly number[]>();

/** FNV-1a over the UTF-16 code units of the room ID. */
function seedOf(roomId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < roomId.length; index++) {
    hash ^= roomId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** The room's palette order: a Fisher-Yates shuffle driven by mulberry32. */
function shuffledDyes(roomId: string): readonly number[] {
  const cached = shuffles.get(roomId);
  if (cached) return cached;
  let state = seedOf(roomId);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  };
  const dyes = [...individualRiderDyes];
  for (let index = dyes.length - 1; index > 0; index--) {
    const pick = Math.floor(next() * (index + 1));
    [dyes[index], dyes[pick]] = [dyes[pick]!, dyes[index]!];
  }
  if (shuffles.size >= 64) shuffles.clear();
  shuffles.set(roomId, dyes);
  return dyes;
}

export interface IndividualRiderRoom {
  roomId?: unknown;
  mode?: unknown;
  gameplay?: unknown;
}

/** The dye of the racer in slot of an individual room; undefined in team and
 * roadblock rooms, which have their own dyes. */
export function individualRiderDye(room: IndividualRiderRoom,
  slot: unknown): number | undefined {
  if (room.mode !== "individual" || room.gameplay === "roadblock" ||
      typeof room.roomId !== "string" || typeof slot !== "number" ||
      !Number.isInteger(slot) || slot < 0 || slot >= individualRiderDyes.length) {
    return undefined;
  }
  return shuffledDyes(room.roomId)[slot];
}

/** The room as the lobby previews draw it: in an individual room every
 * member's character dye (item category 70) is its slot's dye. */
export function decorateIndividualRiders<Room extends IndividualRiderRoom & {
  members: Array<{ slot: number;
    equipment?: { itemIds: Record<number, number>; [key: string]: unknown } }>;
}>(room: Room): Room {
  if (individualRiderDye(room, 0) === undefined) return room;
  return { ...room, members: room.members.map(member => {
    const dye = individualRiderDye(room, member.slot);
    return member.equipment && dye !== undefined ? {
      ...member,
      equipment: { ...member.equipment,
        itemIds: { ...member.equipment.itemIds, 70: dye } },
    } : member;
  }) };
}
