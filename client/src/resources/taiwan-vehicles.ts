import imported from "./taiwan-vehicles.json";
import type { GarageItemDefinition } from "./timeattack-items";

export interface TaiwanVehicle {
  source: "taiwan" | "web-existing";
  sourceTwItemId: number | null;
  sourceInternalId: string;
  definition: GarageItemDefinition;
  sourceItemAttributes: Record<string, string>;
  sourceParameter: { path: string; source: string };
  body: Record<string, string>;
  evidence: string;
}

/** Regional numeric IDs never replace an existing CN identity. */
export const taiwanVehicles = imported.vehicles as unknown as TaiwanVehicle[];
const byItemId = new Map(taiwanVehicles.map(vehicle => [vehicle.definition.itemId, vehicle]));

export function taiwanVehicle(itemId: number): TaiwanVehicle | undefined {
  return byItemId.get(itemId);
}

export interface TaiwanVehicleLibrary {
  exactCanonicalCandidates(path: string): unknown[];
}

/** Expose imports and restored entries only when their complete resources are mounted. */
export function availableTaiwanVehicles(library: TaiwanVehicleLibrary): TaiwanVehicle[] {
  return taiwanVehicles.filter(({ definition, source, sourceParameter }) => {
    const directory = `kart_/${definition.internalId}`;
    const parameterPath = source === "web-existing" ? sourceParameter.path : `${directory}/param.xml`;
    const parameters = library.exactCanonicalCandidates(parameterPath).length;
    if (parameters === 0) return false;
    for (const file of [parameterPath, `${directory}/model.1s`, `${directory}/${definition.textureKey}.png`]) {
      const count = library.exactCanonicalCandidates(file).length;
      if (count !== 1) throw new Error(`新增车辆 ${definition.title} 的 ${file} 需要唯一资源，实际 ${count}。`);
    }
    return true;
  });
}

/** Preserve every existing ItemTable row, appending only non-conflicting IDs. */
export function appendTaiwanVehicleDefinitions(
  definitions: GarageItemDefinition[], library: TaiwanVehicleLibrary,
): GarageItemDefinition[] {
  const occupied = new Set(definitions.filter(row => row.kind === "kart").map(row => row.itemId));
  const additions = availableTaiwanVehicles(library).map(({ definition }) => {
    if (occupied.has(definition.itemId))
      throw new Error(`新增车辆 ID ${definition.itemId} 与现有车辆冲突。`);
    occupied.add(definition.itemId);
    return { ...definition };
  });
  return additions.length ? [...definitions, ...additions] : definitions;
}
