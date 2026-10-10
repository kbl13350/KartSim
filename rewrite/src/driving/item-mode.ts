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
  /** Booster item (6); flying pets of tune group 204 already add their 250 ms here. */
  itemBoosterTime?: number;
  /** Special booster (31 animalBooster, `AnimalBoosterTime`). */
  animalBoosterTime?: number;
  /** Super shield (18 superShield) boost (`SuperBoosterTime`). */
  superBoosterTime?: number;
  normalBoosterTime: number;
}

/**
 * Which tuning time an item boost runs for: the booster item (`itemBoosterTime`),
 * the special booster 31 (`animalBoosterTime`) or the super shield 18
 * (`superBoosterTime`); ITEM_MODE.md C.4.
 */
export type ItemBoosterKind = "item" | "animal" | "super";
export const ITEM_BOOSTER_KINDS: readonly ItemBoosterKind[] = Object.freeze(["item", "animal", "super"]);

export interface ItemBoosterOptions {
  /** Run for this many ms instead of the tuning time (siren 警灯: its `Use.life`). */
  durationMs?: number;
}

/** BodyParam defaults (`AnimalBoosterTime` 4000, `SuperBoosterTime` 3500; physics/body-param.ts). */
const DEFAULT_ANIMAL_BOOSTER_MS = 4000;
const DEFAULT_SUPER_BOOSTER_MS = 3500;

/** The duration of an item boost of `kind` on this kart, in ms. */
export function itemBoosterDurationMs(tuning: ItemModeTuning, kind: ItemBoosterKind = "item"): number {
  const value = kind === "animal" ? tuning.animalBoosterTime ?? DEFAULT_ANIMAL_BOOSTER_MS
    : kind === "super" ? tuning.superBoosterTime ?? DEFAULT_SUPER_BOOSTER_MS
      : tuning.itemBoosterTime ?? tuning.normalBoosterTime;
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
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
 * the existing flame, sound and remote `boosterState` follow) for the kind's
 * tuning time (`itemBoosterTime`, `animalBoosterTime`, `superBoosterTime`) or
 * `options.durationMs`. Every kind uses the item booster factor
 * (`boostAccelFactorOnlyItem`, the kart XML `BoosterAccelFactorItem`). The
 * item was already spent on the server, so unlike the nitro slot this does not
 * require forward input or an idle physics state.
 */
export function startVehicleItemBooster(vehicle: ItemModeVehicle, kind: ItemBoosterKind = "item",
  options: ItemBoosterOptions = {}): boolean {
  if (!vehicle.itemMode) return false;
  if (!ITEM_BOOSTER_KINDS.includes(kind)) throw new Error(`未知的道具加速 ${String(kind)}。`);
  const { runtime, tuning, state } = vehicle;
  if (runtime.raceMotionLocked || runtime.fullPhysicsBypass) return false;
  if (vehicle.itemEffects && !vehicle.itemEffects.canUseItem) return false;
  const duration = options.durationMs !== undefined
    ? (Number.isFinite(options.durationMs) ? Math.max(0, Math.trunc(options.durationMs)) : 0)
    : itemBoosterDurationMs(tuning, kind);
  if (duration === 0) return false;
  vehicle.itemEffects?.end("pull");
  runtime.physicsState = ITEM_BOOSTER_STATE;
  runtime.stateRemainingMs = duration;
  runtime.dualActiveSpeedLocked = false;
  state.boostTime = duration * 0.001;
  runtime.resultBoosterCount = (runtime.resultBoosterCount + 1) >>> 0;
  return true;
}

/**
 * End a booster item the server refused (ITEM_LOCKED, INVALID_TARGET…): the
 * item controller starts the booster on the key press, before the reply, and
 * takes it back on a rejection so the item cannot boost twice. Only the item
 * booster state ends; it no longer counts as a used booster.
 */
export function cancelVehicleItemBooster(vehicle: ItemModeVehicle): boolean {
  if (!vehicle.itemMode) return false;
  const { runtime, state } = vehicle;
  if (runtime.physicsState !== ITEM_BOOSTER_STATE) return false;
  runtime.physicsState = 0;
  runtime.stateRemainingMs = 0;
  state.boostTime = 0;
  runtime.resultBoosterCount = Math.max(0, runtime.resultBoosterCount - 1) >>> 0;
  return true;
}
