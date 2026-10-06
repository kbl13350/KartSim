export interface GarageCosmeticChoice {
  id: string | number;
  title: string;
  family?: string;
  [key: string]: unknown;
}

export interface GarageCosmeticVehicle {
  itemId: number;
  engineGrade?: number;
  path: string;
  [key: string]: unknown;
}

export interface GarageCosmeticConfiguration {
  cosmetics?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface GarageCosmeticEquipmentHost {
  selected: GarageCosmeticVehicle;
  configuration: unknown;
  options: { speed: unknown; library: unknown };
  cosmeticSlot?: string;
  cosmeticBusy: boolean;
  cosmeticResetToken: unknown;
  coatingMode: boolean;
  coatingPreview: unknown;
  cosmeticPreview: unknown;
  disposed: boolean;
  status: { textContent: string };
  panels?: { validateCoatingEquipment(itemId: number, choice: GarageCosmeticChoice): Promise<unknown> };
  confirmation?: { open(message: string, onConfirm: () => void): void };
  requireCustomization(): boolean;
  serial(): number;
  base(): unknown;
  equipCoating(choice?: GarageCosmeticChoice): Promise<void>;
  equipCosmetic(choice?: GarageCosmeticChoice): Promise<void>;
  publishCurrentState(): void;
  updateControls(): void;
}

export interface GarageCosmeticEquipmentDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): GarageCosmeticConfiguration;
  vehicleFamily(vehicle: unknown, engineGrade: number | undefined): string | undefined;
  validateConfiguration(vehicle: unknown, engineGrade: number,
    configuration: GarageCosmeticConfiguration, speed: unknown): void;
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    equipment: GarageCosmeticConfiguration): unknown;
  loadVehicle(library: unknown, path: string): Promise<{ parameter: { value: unknown } }>;
  cosmeticParameters(value: unknown): unknown;
  validateCosmeticResources(library: unknown, parameters: unknown,
    cosmetics: Record<string, unknown>): Promise<unknown>;
}

/** Ask before applying or removing a coating; reject an obsolete confirmation. */
export function requestGarageCoating(
  host: GarageCosmeticEquipmentHost, choice?: GarageCosmeticChoice,
): void {
  if (!host.requireCustomization()) return;
  const selected = host.selected;
  host.confirmation?.open(
    `确定${choice ? `装备「${choice.title}」` : "卸下车膜，恢复车辆原有材质"}并立即生效？`,
    () => {
      if (!host.disposed && host.selected === selected && host.coatingMode)
        void host.equipCoating(choice);
    },
  );
}

/** Validate a coating before committing it; an async validation cannot modify a newer selection. */
export async function equipGarageCoating(
  host: GarageCosmeticEquipmentHost,
  choice: GarageCosmeticChoice | undefined,
  dependencies: Pick<GarageCosmeticEquipmentDependencies,
    "currentConfiguration" | "validateConfiguration" | "writeConfiguration">,
): Promise<void> {
  if (!host.requireCustomization() || host.cosmeticBusy || !host.coatingMode) return;
  const selected = host.selected;
  const serial = host.serial();
  const resetToken = host.cosmeticResetToken;
  const current = () => !host.disposed && host.selected === selected &&
    host.coatingMode && host.serial() === serial && host.cosmeticResetToken === resetToken;
  const family = selected.engineGrade === 9 ? "xun" : "classic";
  const nextEquipment = () => {
    const equipment = dependencies.currentConfiguration(host.configuration, selected.itemId, serial);
    const cosmetics: Record<string, unknown> = { ...equipment.cosmetics, family };
    if (choice) cosmetics.coating = choice.id;
    else delete cosmetics.coating;
    return { ...equipment, cosmetics };
  };
  host.cosmeticBusy = true;
  let errorMessage: string | undefined;
  try {
    if (choice && choice.family !== family) throw new Error("车膜与车代不兼容。");
    dependencies.validateConfiguration(host.base(), selected.engineGrade ?? 0,
      nextEquipment(), host.options.speed);
    if (choice) {
      if (!host.panels) throw new Error("请等待车辆预览加载完成。");
      await host.panels.validateCoatingEquipment(selected.itemId, choice);
    }
    if (!current()) return;
    const equipment = nextEquipment();
    dependencies.validateConfiguration(host.base(), selected.engineGrade ?? 0,
      equipment, host.options.speed);
    host.configuration = dependencies.writeConfiguration(
      host.configuration, selected.itemId, serial, equipment);
    host.publishCurrentState();
    host.coatingPreview = undefined;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  } finally {
    host.cosmeticBusy = false;
    if (!host.disposed) {
      host.updateControls();
      if (errorMessage && current()) host.status.textContent = errorMessage;
    }
  }
}

/** Ask before changing a cosmetic slot; the callback belongs to the selected kart and slot. */
export function requestGarageCosmetic(
  host: GarageCosmeticEquipmentHost, choice?: GarageCosmeticChoice,
): void {
  if (!host.requireCustomization()) return;
  const selected = host.selected;
  const slot = host.cosmeticSlot;
  host.confirmation?.open(
    `确定${choice ? `装备「${choice.title}」` : "恢复此外观槽的原装效果"}并立即生效？\n不消耗库存。`,
    () => {
      if (!host.disposed && host.selected === selected && host.cosmeticSlot === slot)
        void host.equipCosmetic(choice);
    },
  );
}

/** Validate local cosmetic assets and merge with any edits made while they were loading. */
export async function equipGarageCosmetic(
  host: GarageCosmeticEquipmentHost,
  choice: GarageCosmeticChoice | undefined,
  dependencies: GarageCosmeticEquipmentDependencies,
): Promise<void> {
  if (!host.requireCustomization() || host.cosmeticBusy || !host.cosmeticSlot) return;
  const selected = host.selected;
  const serial = host.serial();
  const slot = host.cosmeticSlot;
  const resetToken = host.cosmeticResetToken;
  const current = () => !host.disposed && host.selected === selected &&
    host.serial() === serial && host.cosmeticSlot === slot &&
    host.cosmeticResetToken === resetToken;
  host.cosmeticBusy = true;
  let message: string | undefined;
  try {
    const equipment = dependencies.currentConfiguration(host.configuration, selected.itemId, serial);
    const cosmetics: Record<string, unknown> = {
      family: dependencies.vehicleFamily(host.base(), host.selected.engineGrade) === "xun"
        ? "xun" : "classic",
      ...equipment.cosmetics,
    };
    if (choice) cosmetics[slot] = choice.id;
    else delete cosmetics[slot];
    const draft = { ...equipment, cosmetics };
    dependencies.validateConfiguration(host.base(), selected.engineGrade ?? 0,
      draft, host.options.speed);
    const vehicle = await dependencies.loadVehicle(host.options.library, selected.path);
    await dependencies.validateCosmeticResources(host.options.library,
      dependencies.cosmeticParameters(vehicle.parameter.value), cosmetics);
    if (!current()) return;
    const latest = dependencies.currentConfiguration(host.configuration, selected.itemId, serial);
    const merged = { ...cosmetics, ...latest.cosmetics };
    if (choice) merged[slot] = choice.id;
    else delete merged[slot];
    const committed = { ...latest, cosmetics: merged };
    dependencies.validateConfiguration(host.base(), selected.engineGrade ?? 0,
      committed, host.options.speed);
    host.configuration = dependencies.writeConfiguration(
      host.configuration, selected.itemId, serial, committed);
    host.publishCurrentState();
    host.cosmeticPreview = undefined;
    message = "外观部件已更新并立即生效。";
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  } finally {
    host.cosmeticBusy = false;
    if (!host.disposed) {
      host.updateControls();
      if (message && current()) host.status.textContent = message;
    }
  }
}
