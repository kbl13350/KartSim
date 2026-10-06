import capturedCsv from "./data/vehicle-physics-h10.csv?raw";
import supplementalCsv from "./data/vehicle-physics-d10.csv?raw";
import overridesJson from "./data/vehicle-physics-overrides.json?raw";
import { VehicleSpecCatalog, type VehicleOverrides } from "./catalog";

let catalog: VehicleSpecCatalog | undefined;

/** Load the extracted data bundled with this source project. */
export function bundledVehicleSpecCatalog(): VehicleSpecCatalog {
  catalog ??= new VehicleSpecCatalog(capturedCsv, supplementalCsv,
    JSON.parse(overridesJson) as VehicleOverrides);
  return catalog;
}
