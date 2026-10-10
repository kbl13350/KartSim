import capturedCsv from "./data/vehicle-physics-h10.csv?raw";
import supplementalCsv from "./data/vehicle-physics-d10.csv?raw";
import overridesJson from "./data/vehicle-physics-overrides.json?raw";
import aliasesJson from "./data/vehicle-physics-aliases.json?raw";
import { buildReleaseVehicleData } from "./release-data-builder";

/** Names kept for the generated release modules that still consume these tables. */
export const { h10, d10, hn } = buildReleaseVehicleData(
  capturedCsv, supplementalCsv, overridesJson, aliasesJson,
);
