import { deathmatchIdentity, isDeathmatchState } from "./deathmatch-rules";
import { isDeathmatchTrack } from "./lobby-deathmatch-mode";

type Data = Record<string, any>;
const record = (value: unknown): value is Data => !!value && typeof value === "object" && !Array.isArray(value);

/** Frozen arena slots alternate red/blue, unlike the room's two four-seat rows. */
export function isDeathmatchRoster(value: unknown): boolean {
  return Array.isArray(value) && value.length === 8 &&
    new Set(value.map(player => player?.playerId)).size === 8 &&
    new Set(value.map(player => player?.slot)).size === 8 &&
    value.every(player => record(player) && typeof player.playerId === "string" &&
      player.ai === undefined && Number.isInteger(player.slot) && player.slot >= 0 && player.slot < 8 &&
      player.team === player.slot % 2 + 1);
}

/** Validate the same frozen state before map loading and when accepting a room event. */
export function validateDeathmatchRace(room: Data, race: Data): void {
  if (room.gameplay !== "deathmatch") {
    if (race.deathmatch !== undefined) throw new Error("其他玩法不能携带死斗规则。");
    return;
  }
  const ids = new Set<string>((Array.isArray(race.roster) ? race.roster : []).map(player => player?.playerId));
  if (room.mode !== "team" || race.channelName !== "speedTeamCombine" ||
      !isDeathmatchTrack(race.trackId) || !isDeathmatchRoster(race.roster) ||
      !isDeathmatchState(race.deathmatch, ids) || !record(race.startSlots) ||
      Object.keys(race.startSlots).length !== 8 || race.roster.some((player: Data) =>
        race.startSlots[player.playerId] !== player.slot ||
        race.deathmatch.players[player.playerId]?.spawnSlot !== player.slot) ||
      (room.race?.deathmatch !== undefined &&
        deathmatchIdentity(room.race.deathmatch) !== deathmatchIdentity(race.deathmatch)))
    throw new Error("死斗模式冻结规则、名单或出生点无效。");
}
