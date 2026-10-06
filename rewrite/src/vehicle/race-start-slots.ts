export interface StartPoint { x: number; y: number; z: number }
export interface RaceStarter { playerId: string }
export interface RaceStartGrid {
  roster: RaceStarter[];
  startSlots?: Record<string, number>;
}

/** A room must assign one unique grid slot from zero through seven to each racer. */
export function validateRaceStartGrid(grid: RaceStartGrid): void {
  const slots = grid.startSlots;
  if (!slots || Object.keys(slots).length !== grid.roster.length)
    throw new Error("本局缺少完整起跑位表。");
  const used = new Set<number>();
  for (const racer of grid.roster) {
    const slot = slots[racer.playerId];
    if (!Object.hasOwn(slots, racer.playerId) || !Number.isInteger(slot) ||
        slot! < 0 || slot! > 7 || used.has(slot!))
      throw new Error("本局起跑位重复或越界。");
    used.add(slot!);
  }
}

/** Places racers in paired columns, then optionally snaps them to the road. */
export function raceStartPosition(
  origin: StartPoint,
  right: StartPoint,
  slot: number,
  groundAt: (origin: StartPoint, direction: StartPoint) => StartPoint | undefined,
): StartPoint {
  if (!Number.isInteger(slot) || slot < 0 || slot > 7)
    throw new Error("多人起跑位必须是0至7。");
  const f32 = Math.fround;
  const side = f32(f32(slot & 1 ? -((slot >>> 1) + 1) : slot >>> 1) * f32(2));
  const position = {
    x: f32(origin.x + f32(right.x * side)),
    y: f32(origin.y + f32(right.y * side)),
    z: f32(origin.z + f32(right.z * side)),
  };
  const road = groundAt({ x: position.x, y: f32(position.y + 10), z: position.z },
    { x: 0, y: -100, z: 0 });
  return road ? { ...road } : position;
}
