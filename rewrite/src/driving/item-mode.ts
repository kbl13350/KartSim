/**
 * Item-race (道具赛) slots and boosters on the AL vehicle.
 *
 * Item races reuse `runtime.speedSlots` as the item slot store, sized by the
 * kart's `itemSlotCapacity` and holding original item indices (-1 empty). The
 * server is the authority for the slot contents; the item controller mirrors
 * every reply through `setItemSlots`. Drift never creates boosters in item
 * races; a booster comes only from the booster item (`startItemBooster`).
 */
import { VehicleItemEffects, type ItemEffectVehicle } from "./item-effects";

/** Item index of the booster item (`item.rho/booster`, also the speed nitro slot). */
export const ITEM_BOOSTER_INDEX = 6;
export const EMPTY_ITEM_SLOT = -1;
/** Highest item index the protocol carries (`cubeId`, `itemId` are 1..4096). */
const MAX_ITEM_INDEX = 4096;
const ITEM_BOOSTER_STATE = 3;

export interface ItemModeTuning {
  itemSlotCapacity?: number;
  itemBoosterTime?: number;
  normalBoosterTime: number;
}

export interface ItemModeVehicle extends ItemEffectVehicle {
  itemMode: boolean;
  itemEffects?: VehicleItemEffects;
  tuning: ItemModeTuning & ItemEffectVehicle["tuning"];
  runtime: ItemEffectVehicle["runtime"] & {
    speedSlots: number[];
    speedSlotDisabled: boolean[];
    raceMotionLocked: boolean;
    dualActiveSpeedLocked: boolean;
    resultBoosterCount: number;
  };
  state: ItemEffectVehicle["state"] & { nitro: number };
}

/** Two slots, or three for karts whose `ItemSlotCapacity` is 3 (server clamps to 2..3). */
export function itemSlotCapacityFor(tuning: { itemSlotCapacity?: number }): 2 | 3 {
  return Math.trunc(Number(tuning.itemSlotCapacity)) >= 3 ? 3 : 2;
}

/** Turn an AL instance into an item-race vehicle; idempotent. */
export function installVehicleItemMode(vehicle: ItemModeVehicle): void {
  vehicle.itemMode = true;
  const capacity = itemSlotCapacityFor(vehicle.tuning);
  const runtime = vehicle.runtime;
  if (runtime.speedSlots.length !== capacity) {
    runtime.speedSlots.length = 0;
    runtime.speedSlotDisabled.length = 0;
    for (let index = 0; index < capacity; index += 1) {
      runtime.speedSlots.push(EMPTY_ITEM_SLOT);
      runtime.speedSlotDisabled.push(false);
    }
    vehicle.state.nitro = 0;
  }
  vehicle.itemEffects ??= new VehicleItemEffects(vehicle);
}

export function vehicleItemSlotCapacity(vehicle: Pick<ItemModeVehicle, "itemMode" | "tuning">): number {
  return vehicle.itemMode ? itemSlotCapacityFor(vehicle.tuning) : 0;
}

/** Mirror the server's slot list; missing trailing slots are empty. */
export function setVehicleItemSlots(vehicle: ItemModeVehicle, slots: readonly number[]): void {
  if (!vehicle.itemMode) throw new Error("只有道具赛车辆有道具槽。");
  const capacity = itemSlotCapacityFor(vehicle.tuning);
  if (!Array.isArray(slots) || slots.length > capacity ||
      slots.some(slot => !Number.isInteger(slot) || slot < EMPTY_ITEM_SLOT || slot > MAX_ITEM_INDEX))
    throw new Error(`道具槽必须是最多 ${capacity} 个道具编号（-1 为空）。`);
  const runtime = vehicle.runtime;
  runtime.speedSlots.length = capacity;
  runtime.speedSlotDisabled.length = capacity;
  for (let index = 0; index < capacity; index += 1) {
    runtime.speedSlots[index] = slots[index] ?? EMPTY_ITEM_SLOT;
    runtime.speedSlotDisabled[index] = false;
  }
  vehicle.state.nitro = runtime.speedSlots.filter(slot => slot === ITEM_BOOSTER_INDEX).length;
}

/** The live slot list (index 0 is used first). Do not mutate it. */
export function vehicleItemSlots(
  vehicle: Pick<ItemModeVehicle, "itemMode" | "runtime">,
): readonly number[] {
  return vehicle.itemMode ? vehicle.runtime.speedSlots : [];
}

/**
 * Apply a used booster item: physics state 3 (the ordinary booster state, so
 * the existing flame, sound and remote `boosterState` follow) for
 * `itemBoosterTime`. The item was already spent on the server, so unlike the
 * nitro slot this does not require forward input or an idle physics state.
 */
export function startVehicleItemBooster(vehicle: ItemModeVehicle): boolean {
  if (!vehicle.itemMode) return false;
  const { runtime, tuning, state } = vehicle;
  if (runtime.raceMotionLocked || runtime.fullPhysicsBypass) return false;
  if (vehicle.itemEffects && !vehicle.itemEffects.canUseItem) return false;
  vehicle.itemEffects?.end("pull");
  const duration = Math.max(0, Math.trunc(tuning.itemBoosterTime ?? tuning.normalBoosterTime));
  if (duration === 0) return false;
  runtime.physicsState = ITEM_BOOSTER_STATE;
  runtime.stateRemainingMs = duration;
  runtime.dualActiveSpeedLocked = false;
  state.boostTime = duration * 0.001;
  runtime.resultBoosterCount = (runtime.resultBoosterCount + 1) >>> 0;
  return true;
}
