import type { Vector3 } from "./continuous-motion";
import { installVehicleItemMode, type ItemModeVehicle } from "./item-mode";

export interface VehicleCollisionDimensions {
  rawHalfWidth: number;
  rawHalfLength: number;
  scaleX: number;
  scaleY: number;
  rawHeight: number;
}

export interface VehicleRaceMode {
  kind: string;
  team: boolean;
}

export interface VehicleConstructionContext {
  externalTeamGauge: boolean;
  itemMode?: boolean;
  speedRaceMode?: VehicleRaceMode;
  lteMotion?: unknown;
  giant?: unknown;
  checkClientFramerate: boolean;
  tuning: Record<string, unknown>;
  teamBooster: boolean;
  teamBoosterDirect: boolean;
  body: object;
  state: object;
  wheels: object;
  runtime: { eventScalePrimary: Vector3 };
  collisionShape: {
    rawHalfWidth: number;
    rawHalfLength: number;
    readonly scaleX: number;
    readonly scaleY: number;
    readonly rawHeight: number;
  };
  clock: { enableRhythmCheck(): void };
  createBody(): object;
  createState(): object;
  createWheelRuntime(): object;
  createRuntime(): { eventScalePrimary: Vector3 };
}

/** Body of the released AL constructor, after JavaScript field initializers run. */
export function initializeVehicle(
  vehicle: VehicleConstructionContext,
  tuning: Record<string, unknown>,
  dimensions: VehicleCollisionDimensions,
  teamBooster: boolean,
  teamBoosterDirect: boolean,
  externalTeamGauge: boolean,
  speedRaceMode: VehicleRaceMode | undefined,
  lteMotion: unknown,
  giant: unknown,
  checkClientFramerate: boolean,
  validateRaceMode: (mode: VehicleRaceMode) => void,
): void {
  vehicle.externalTeamGauge = externalTeamGauge;
  vehicle.speedRaceMode = speedRaceMode;
  vehicle.lteMotion = lteMotion;
  vehicle.giant = giant;
  vehicle.checkClientFramerate = checkClientFramerate;
  if ((speedRaceMode?.kind === "lte") !== !!lteMotion) {
    throw new Error("LTE 玩法与运动 consumer 不一致。");
  }
  if ((speedRaceMode?.kind === "giant") !== !!giant) {
    throw new Error("巨人玩法与规则 owner 不一致。");
  }
  // Item races size the slot store from itemSlotCapacity when the runtime is created.
  const itemMode = speedRaceMode?.kind === "item";
  if (itemMode) vehicle.itemMode = true;
  if (speedRaceMode) {
    validateRaceMode(speedRaceMode);
    if (speedRaceMode.team !== teamBooster) {
      throw new Error("玩法与组队气量参数不一致。");
    }
  }
  vehicle.tuning = { ...tuning };
  vehicle.teamBooster = teamBooster;
  vehicle.teamBoosterDirect = teamBoosterDirect;
  vehicle.body = vehicle.createBody();
  vehicle.state = vehicle.createState();
  vehicle.wheels = vehicle.createWheelRuntime();
  vehicle.runtime = vehicle.createRuntime();

  // Shape scale getters must keep reading the current runtime after a reset.
  vehicle.collisionShape = {
    rawHalfWidth: dimensions.rawHalfWidth,
    rawHalfLength: dimensions.rawHalfLength,
    get scaleX() { return vehicle.runtime.eventScalePrimary.x; },
    get scaleY() { return vehicle.runtime.eventScalePrimary.y; },
    get rawHeight() { return vehicle.runtime.eventScalePrimary.z; },
  };
  vehicle.runtime.eventScalePrimary = {
    x: Math.fround(dimensions.scaleX),
    y: Math.fround(dimensions.scaleY),
    z: Math.fround(dimensions.rawHeight),
  };
  if (checkClientFramerate) vehicle.clock.enableRhythmCheck();
  // The constructed AL carries every member the item owner needs.
  if (itemMode) installVehicleItemMode(vehicle as unknown as ItemModeVehicle);
}
