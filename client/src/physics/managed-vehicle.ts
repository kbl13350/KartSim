import { currentVehicleDisplaySettings, type VehicleDisplaySettings } from '../resources/vehicle-display-settings';
import { PART_LOCK_FIELDS } from './fields';
import { VEHICLE_METADATA_FIELDS } from './vehicle-detail-schema';
import type { SpeedVersion, VehicleIdentity, VehicleSpec, VehicleSpecResult } from './catalog';

export function managedVehicleOverrides(vehicle: VehicleIdentity, settings: VehicleDisplaySettings = currentVehicleDisplaySettings()) {
  const id = vehicle.itemId ? `catalog:3:${vehicle.itemId}` : `system:${vehicle.systemKey ?? ''}`;
  return settings.vehicleOverrides?.[id.toLowerCase()];
}

// Enumerable symbols survive the existing tuning/pet object spreads, but never
// enter JSON/replay payloads. Item mode must not overwrite an admin-set factor.
export const managedPhysicsFields = Symbol('managedVehiclePhysics');

export function applyManagedVehicleSpec(result: VehicleSpecResult, vehicle: VehicleIdentity,
  speed: number, version: SpeedVersion, settings?: VehicleDisplaySettings): VehicleSpecResult {
  const profile = version === '国服' && speed === 4 ? '4' : '7';
  const changes = managedVehicleOverrides(vehicle, settings)?.profiles[profile];
  if (!changes || !Object.keys(changes).length) return result;
  const spec = { ...result.spec, partsLocks: [...result.spec.partsLocks], [managedPhysicsFields]: changes } as VehicleSpec;
  for (const [key, value] of Object.entries(changes)) {
    const index = PART_LOCK_FIELDS.indexOf(key as typeof PART_LOCK_FIELDS[number]);
    if (index >= 0) spec.partsLocks[index] = value;
    else (spec as unknown as Record<string, number>)[key] = value;
  }
  if ('chargerSystemBoosterUseCount' in changes && !('vehicleFunctionChargerBranchValue' in changes))
    spec.vehicleFunctionChargerBranchValue = changes.chargerSystemBoosterUseCount!;
  if ('wallCollGaugeMaxVelLoss' in changes && !('vehicleFunctionWallCollisionGaugeValue' in changes))
    spec.vehicleFunctionWallCollisionGaugeValue = changes.wallCollGaugeMaxVelLoss!;
  return { spec, source: `${result.source}+admin` };
}

/** Catalogs are cached; getters reflect a refreshed snapshot and allow cloning. */
export function managedVehicleMetadata<T extends VehicleIdentity>(vehicle: T): T {
  const result = { ...vehicle };
  for (const { key } of VEHICLE_METADATA_FIELDS) {
    Object.defineProperty(result, key, {
      enumerable: Object.hasOwn(vehicle, key) || Object.hasOwn(managedVehicleOverrides(vehicle)?.metadata ?? {}, key), configurable: true,
      get: () => {
        const metadata = managedVehicleOverrides(vehicle)?.metadata;
        return metadata && Object.hasOwn(metadata, key) ? metadata[key] : Reflect.get(vehicle, key);
      },
    });
  }
  return result;
}
