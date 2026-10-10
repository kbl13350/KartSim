import { parseKartSpecCsv, speedType, vehicleId, type KartSpecRow } from "./csv";
import { applyDefaultExceed } from "./default-exceed";
import { KART_FIELDS, PART_LOCK_FIELDS, type KartField, type PartLockField } from "./fields";
import { createBodyParamSpec, type BodyParamInput } from "./body-param";
import { speedBaseline } from "./speed-baseline";

export type VehicleSpec = Omit<Record<KartField, number>, PartLockField> & {
  partsLocks: [number, number, number, number, number, number];
  vehicleFunctionChargerBranchValue: number;
  vehicleFunctionWallCollisionGaugeValue: number;
};

export interface VehicleSpecResult {
  spec: VehicleSpec;
  source: string;
}

export interface VehicleIdentity { itemId: number; systemKey?: string }

export type SpeedVersion = "国服" | "国服复古" | "韩服复古";
export type VehicleOverrides = Record<string, Record<string, number>>;

function requireVersion(version: string, speed: number): void {
  const valid = version === "国服" ? Number.isInteger(speed) && speed >= 0 && speed <= 8
    : (version === "国服复古" || version === "韩服复古") &&
      Number.isInteger(speed) && speed >= 0 && speed <= 5;
  if (!valid) throw new Error(`SpeedType table has no version ${version}, speed ${speed}`);
}

function completeRow(key: string, row: KartSpecRow): Record<KartField, number> {
  const missing = KART_FIELDS.filter((field) => row.values[field] === undefined);
  if (missing.length) throw new Error(`kartspec.csv ${key} is missing: ${missing.join(", ")}`);
  return row.values as Record<KartField, number>;
}

function normalizeSpec(values: Record<KartField, number>): VehicleSpec {
  const copy: Record<string, number> = { ...values };
  const locks = PART_LOCK_FIELDS.map((field) => {
    const value = copy[field]!;
    delete copy[field];
    return value;
  }) as VehicleSpec["partsLocks"];
  return {
    ...copy,
    vehicleFunctionChargerBranchValue: values.chargerSystemBoosterUseCount,
    vehicleFunctionWallCollisionGaugeValue: values.wallCollGaugeMaxVelLoss,
    partsLocks: locks,
  } as VehicleSpec;
}

export class VehicleSpecCatalog {
  readonly captured: Map<string, KartSpecRow>;
  readonly supplemental: Map<string, KartSpecRow>;
  readonly overrides: VehicleOverrides;

  constructor(capturedCsv: string | Map<string, KartSpecRow>,
    supplementalCsv: string | Map<string, KartSpecRow>,
    overrides: VehicleOverrides | Map<string, Record<string, number>> = {}) {
    this.captured = typeof capturedCsv === "string" ? parseKartSpecCsv(capturedCsv) : capturedCsv;
    this.supplemental = typeof supplementalCsv === "string" ? parseKartSpecCsv(supplementalCsv) : supplementalCsv;
    this.overrides = overrides instanceof Map ? Object.fromEntries(overrides) : overrides;
  }

  private find(key: string): KartSpecRow | undefined {
    return this.captured.get(key) ?? this.supplemental.get(key);
  }

  private applyLauncherOverride(id: number, speed: number, spec: VehicleSpec, source: string): VehicleSpecResult {
    const key = `${id}:${speed}`;
    const override = this.overrides[key];
    if (!override) return { spec, source };
    return {
      spec: { ...spec, ...override },
      source: `${source}+${key === "1466:4" || key === "1466:7" ? "p3543-launcher-v1" : "p3543-launcher-v2"}`,
    };
  }

  private result(id: number, speed: number, key: string, row: KartSpecRow): VehicleSpecResult {
    const spec = normalizeSpec(completeRow(key, row));
    if (row.source === "local-p3553+launcher-v2") {
      return { spec: applyDefaultExceed(spec), source: `${row.source}+default-exceedspec` };
    }
    return this.applyLauncherOverride(id, speed, spec, row.source);
  }

  /** `ek`: exact 国服 4/7 row, then standard-speed row 7 plus version suffix. */
  lookup(itemId: number | string, speed: number, version: SpeedVersion = "国服"): VehicleSpecResult {
    const id = vehicleId(String(itemId));
    const speedKey = speedType(speed);
    const directKey = `${id}:${speedKey}`;
    const direct = version === "国服" ? this.find(directKey) : undefined;
    if (direct) return this.result(id, speed, directKey, direct);

    requireVersion(version, speed);
    const standardKey = `${id}:7`;
    const standard = this.find(standardKey);
    if (!standard) throw new Error(`kartspec.csv has no vehicle ${id}`);
    const base = this.result(id, 7, standardKey, standard);
    return { ...base, source: `${base.source}+speed-baseline:${version}:${speedKey}` };
  }

  /** `JI`: ordinary cars use CSV; system cars use their own BodyParam resource. */
  createVehicleParameters(vehicle: VehicleIdentity, speed: number,
    body?: BodyParamInput, version: SpeedVersion = "国服"): VehicleSpecResult {
    if (vehicle.itemId !== 0) return this.lookup(vehicle.itemId, speed, version);
    const key = vehicle.systemKey?.trim();
    if (!key) throw new Error("System vehicle needs a stable identity key");
    speedBaseline(version, speed); // original JI validates the requested speed first
    if (key === "legacyPractice") {
      return { spec: createBodyParamSpec({}, 7, "国服"),
        source: "system:legacyPractice:school-spec+speed-baseline" };
    }
    if (!["practiceKart", "legacyPracticeX", "legacyPracticeBlackline"].includes(key)) {
      throw new Error(`Unmapped system vehicle ${key}`);
    }
    if (!body) throw new Error(`System vehicle ${key} needs its BodyParam resource`);
    return { spec: createBodyParamSpec(body, 7, "国服"),
      source: `system:${key}:BodyParam+speed-baseline` };
  }
}
