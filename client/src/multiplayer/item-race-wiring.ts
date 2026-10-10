/**
 * Item race (道具赛) assembly for the active multiplayer race: the item race
 * controller is created once the race connection, the local race owner and
 * the remote fleet exist, and becomes the local owner's item command handler.
 */
import { ItemRaceController, type ItemRaceConnection } from "../item/item-race-controller";
import type { ItemCatalog } from "../item/item-catalog";
import type { ItemRacePresenter, ItemPresenterPose } from "../item/item-race-presenter-contract";
import type { Vec3 } from "../item/item-race-rules";
import { isItemRace } from "./lobby-item-mode";

export interface ActiveItemRaceHost {
  assets: {
    drivingMode?: { kind: string; team?: boolean };
    itemCatalog?: Pick<ItemCatalog, "get"> & Partial<Pick<ItemCatalog, "passives" | "animalBoosters">>;
    itemPresenter?: ItemRacePresenter;
    itemHazards?: { position(id: number): Vec3 | undefined };
  };
  connection: Partial<ItemRaceConnection> & { playerId: string };
  local: {
    physics: ConstructorParameters<typeof ItemRaceController>[0]["physics"];
    track?: { sampleRoute?(vehicle: unknown, lookahead: number):
      { sampled: boolean; point?: Vec3 } };
    itemRacing(): boolean;
    itemSuspended(): boolean;
    items?: unknown;
    itemRace?: ItemRaceController;
  };
  remotes: {
    copyWebPose(playerId: string): ItemPresenterPose | undefined;
    raceProgress(playerId: string): { finishElapsedMs?: number } | undefined;
    hasDeparted(playerId: string): boolean;
  };
  mapping?: { offsetMs: number };
}

/**
 * The race snapshot part the item race reads: the frozen roster with each
 * racer's race equipment (passives, ITEM_MODE.md C.1 — never the display
 * profiles, which anonymous and competition rooms rewrite), the race id (the
 * passive roll seed) and the track (iceBanana).
 */
export interface ItemRaceRoster {
  raceId?: unknown;
  trackId?: unknown;
  roster: ReadonlyArray<{ playerId: string; name?: string; team?: 1 | 2 | null; equipment?: unknown }>;
}

/** `equipment.itemIds` of a roster entry, if it has one. */
export function rosterItemIds(equipment: unknown): unknown {
  return equipment && typeof equipment === "object"
    ? (equipment as { itemIds?: unknown }).itemIds : undefined;
}

/** `toLocalTick` of the race clock: server milliseconds → local presenter milliseconds. */
export function serverToLocalMs(serverMs: number, mapping: { offsetMs: number } | undefined):
  number | undefined {
  return mapping && Number.isFinite(mapping.offsetMs) ? serverMs - mapping.offsetMs : undefined;
}

/**
 * Create the item race controller of an item race and hand it to the local
 * race owner (`local.items` receives the Ctrl/Alt/Z commands, `local.itemRace`
 * the cube and hazard callbacks). Other races return undefined.
 */
export function createActiveItemRace(host: ActiveItemRaceHost, race: ItemRaceRoster,
  now: () => number): ItemRaceController | undefined {
  const { assets, connection, local, remotes } = host;
  if (!isItemRace(assets.drivingMode)) return undefined;
  if (!connection.sendItem || !connection.subscribeItem) throw new Error("本局连接缺少道具赛通道。");
  if (!assets.itemCatalog) throw new Error("道具赛缺少道具目录。");
  const sendItem = connection.sendItem.bind(connection);
  const subscribeItem = connection.subscribeItem.bind(connection);
  const controller = new ItemRaceController({
    playerId: connection.playerId,
    roster: race.roster.map(entry => {
      const itemIds = rosterItemIds(entry.equipment);
      return { playerId: entry.playerId, name: entry.name ?? "",
        team: entry.team === 1 || entry.team === 2 ? entry.team : null,
        ...(itemIds !== undefined ? { itemIds } : {}) };
    }),
    teamRace: assets.drivingMode?.team === true,
    ...(typeof race.raceId === "string" ? { raceId: race.raceId } : {}),
    ...(typeof race.trackId === "string" ? { trackId: race.trackId } : {}),
    catalog: assets.itemCatalog,
    physics: local.physics,
    connection: { sendItem, subscribeItem },
    local: {
      racing: () => local.itemRacing(),
      suspended: () => local.itemSuspended(),
      routePointAhead: distance => {
        const sample = local.track?.sampleRoute?.(local.physics, distance);
        return sample?.sampled && sample.point ? { ...sample.point } : undefined;
      },
    },
    remotes: {
      pose: playerId => remotes.copyWebPose(playerId),
      racing: playerId => !remotes.hasDeparted(playerId) &&
        remotes.raceProgress(playerId)?.finishElapsedMs === undefined &&
        remotes.copyWebPose(playerId) !== undefined,
    },
    toLocalMs: serverMs => serverToLocalMs(serverMs, host.mapping),
    now,
    ...(assets.itemPresenter ? { presenter: assets.itemPresenter } : {}),
    ...(assets.itemHazards ? { hazardPosition: (id: number) => assets.itemHazards!.position(id) } : {}),
  });
  local.items = controller;
  local.itemRace = controller;
  return controller;
}
