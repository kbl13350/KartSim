import { sameGaragePart, type GaragePart, type GaragePartSlot } from "./garage-parts-business";

export interface GarageEquipmentVehicle {
  itemId: number;
  engineGrade?: number;
  [key: string]: unknown;
}

export interface GarageEquipmentHost {
  selected: GarageEquipmentVehicle;
  slot: GaragePartSlot;
  configuration: unknown;
  options: { speed: unknown };
  status: { textContent: string };
  disposed: boolean;
  previewPart?: GaragePart;
  coatingMode: boolean;
  coatingPreview: unknown;
  cosmeticSlot: unknown;
  cosmeticPreview: unknown;
  transformPreviewStartPending: boolean;
  inventory: { scrollTop: number };
  panels?: { setTransformPreview?(enabled: boolean): void };
  confirmation?: {
    openPartEquip(label: string, onConfirm: () => void): void;
    open(message: string, onConfirm: () => void): void;
  };
  requireCustomization(): boolean;
  base(): unknown;
  serial(): number;
  partLabel(part: GaragePart): string;
  publishCurrentState(): void;
  updateControls(): void;
  updatePerformance(): void;
  equip(part?: GaragePart): void;
}

export interface GarageEquipmentDependencies {
  canCustomize(itemId: number): boolean;
  slotLocked(vehicle: unknown, slot: GaragePartSlot): boolean;
  currentConfiguration(configuration: unknown, itemId: number, serial: number): Record<string, unknown>;
  validateConfiguration(vehicle: unknown, engineGrade: number,
    equipment: Record<string, unknown>, speed: unknown): void;
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    equipment: Record<string, unknown>): unknown;
  partFamily(vehicle: unknown, engineGrade: number | undefined): string | undefined;
  slotLabel(slot: GaragePartSlot, family: string | undefined): string;
}

/** Practice karts cannot accept parts, tuning, factory changes, or cosmetics. */
export function requireGarageCustomization(
  host: GarageEquipmentHost, canCustomize: GarageEquipmentDependencies["canCustomize"],
): boolean {
  if (canCustomize(host.selected.itemId)) return true;
  host.status.textContent = "练习车不支持部件、强化、改装或外观修改。";
  return false;
}

/** Validate and publish an equipment change, including removal of a part. */
export function equipGaragePart(
  host: GarageEquipmentHost,
  part: GaragePart | undefined,
  dependencies: Pick<GarageEquipmentDependencies,
    "slotLocked" | "currentConfiguration" | "validateConfiguration" | "writeConfiguration">,
): void {
  if (!host.requireCustomization()) return;
  const vehicle = host.base();
  if (part && dependencies.slotLocked(vehicle, host.slot)) throw new Error("该部件槽已锁定。");
  const equipment = { ...dependencies.currentConfiguration(
    host.configuration, host.selected.itemId, host.serial()) };
  if (part) equipment[host.slot] = part;
  else delete equipment[host.slot];
  dependencies.validateConfiguration(vehicle, host.selected.engineGrade ?? 0,
    equipment, host.options.speed);
  host.configuration = dependencies.writeConfiguration(
    host.configuration, host.selected.itemId, host.serial(), equipment);
  host.publishCurrentState();
  host.previewPart = undefined;
  host.status.textContent = "";
  host.updateControls();
}

/** Confirm the change only while the originally selected kart and slot remain active. */
export function requestGaragePartEquip(
  host: GarageEquipmentHost,
  part: GaragePart | undefined,
  dependencies: Pick<GarageEquipmentDependencies, "partFamily" | "slotLabel">,
): void {
  if (!host.requireCustomization()) return;
  const selected = host.selected;
  const slot = host.slot;
  const confirm = () => {
    if (host.disposed || host.selected !== selected || host.slot !== slot) return;
    try {
      host.equip(part);
    } catch (error) {
      host.status.textContent = error instanceof Error ? error.message : String(error);
    }
  };
  if (part) {
    host.confirmation?.openPartEquip(host.partLabel(part), confirm);
  } else {
    const family = dependencies.partFamily(host.base(), selected.engineGrade);
    host.confirmation?.open(
      `将${dependencies.slotLabel(slot, family)}恢复为原装配置并立即生效？`, confirm);
  }
}

/** Switching a slot drops temporary cosmetic and part previews before refreshing the inventory. */
export function selectGaragePartSlot(host: GarageEquipmentHost, slot: GaragePartSlot): void {
  host.coatingMode = false;
  host.coatingPreview = undefined;
  host.cosmeticSlot = undefined;
  host.cosmeticPreview = undefined;
  host.transformPreviewStartPending = false;
  host.panels?.setTransformPreview?.(false);
  host.previewPart = undefined;
  host.slot = slot;
  host.inventory.scrollTop = 0;
  host.updateControls();
}

/** A structurally identical part does not need another performance calculation. */
export function setGaragePartPreview(host: GarageEquipmentHost, part?: GaragePart): void {
  if (sameGaragePart(host.previewPart, part)) return;
  host.previewPart = part;
  host.updatePerformance();
}
