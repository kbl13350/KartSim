export interface GarageStateVehicle {
  itemId: number;
  engineGrade?: number;
  kartType?: number;
  systemKey?: string;
  path: string;
  [key: string]: unknown;
}

export interface GarageProgression {
  kind: string;
  level?: number;
  [key: string]: unknown;
}

export interface GarageEquipmentState {
  progression?: GarageProgression;
  factory?: unknown;
  exceedType?: number;
  [key: string]: unknown;
}

export interface GarageStateCommitHost {
  selected: GarageStateVehicle;
  configuration: unknown;
  options: {
    speed: unknown;
    library: unknown;
    catalog: { characters: Array<{ itemId: number; [key: string]: unknown }> };
    selectedCharacterItemId: number;
    profile: { equipment: { systemKartVariant: unknown }; [key: string]: unknown };
    onChange?: (state: {
      kart: GarageStateVehicle;
      character: { itemId: number; [key: string]: unknown };
      equipment: Record<string, unknown>;
      garage: unknown;
    }) => void;
  };
  pageMode: string;
  disposed: boolean;
  upgradeCatalogEmpty: boolean;
  cosmeticResetToken: unknown;
  previewPart: unknown;
  cosmeticPreview: unknown;
  coatingPreview: unknown;
  status: { textContent: string };
  confirmation?: { open(message: string, callback: () => void): void };
  progressionPanel: {
    update(progression: GarageProgression, supported: boolean, engineGrade: number | undefined,
      factory: unknown, exceedType: number | undefined,
      vehicle: { itemId: number; kartType: number | undefined }, catalogEmpty: boolean): void;
    updateRadar(library: unknown, path: string, base: GarageBaseVehicle,
      progression: GarageProgression, factory: unknown): void;
  };
  pointEffects?: { transition(before: GarageProgression, after: GarageProgression): void };
  serial(): number;
  base(): GarageBaseVehicle;
  requireCustomization(): boolean;
  canSetProgression(progression: GarageProgression): boolean;
  publishCurrentState(): void;
  updateControls(): void;
  updateVehicleInformation(base: GarageBaseVehicle, equipment: GarageEquipmentState,
    layout: GarageProgressionLayout): void;
  updateCosmeticEquippedSlots(equipment: GarageEquipmentState,
    layout: GarageProgressionLayout, preview: boolean): void;
  updateVehicleHeading(level?: number): void;
}

export interface GarageBaseVehicle {
  defaultExceedType?: number;
  [key: string]: unknown;
}

export interface GarageProgressionLayout {
  kind: string;
  [key: string]: unknown;
}

export interface GarageStateCommitDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): GarageEquipmentState;
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    equipment: GarageEquipmentState): unknown;
  validateConfiguration(base: GarageBaseVehicle, engineGrade: number,
    equipment: GarageEquipmentState, speed: unknown): void;
  composeEquipment(profile: GarageStateCommitHost["options"]["profile"], kartItemId: number,
    characterItemId: number, systemKey: string | undefined, systemKartVariant: unknown): Record<string, unknown>;
  normalizeEquipment(equipment: Record<string, unknown>): Record<string, unknown>;
  supportsProgression(engineGrade: number | undefined): boolean;
  progressionLayout(engineGrade: number | undefined): GarageProgressionLayout | undefined;
  progressionKind(engineGrade: number | undefined): string | undefined;
  expectedProgressionKind(family: string | undefined): string | undefined;
  initialProgression(xun: boolean): GarageProgression;
}

/** Confirm a complete local garage reset for the selected vehicle and serial. */
export function requestGarageRestoreDefaults(
  host: GarageStateCommitHost,
  dependencies: Pick<GarageStateCommitDependencies, "writeConfiguration">,
): void {
  if (!host.requireCustomization()) return;
  const selected = host.selected;
  const serial = host.serial();
  host.confirmation?.open(
    "部件、强化、改装和外观记录将清除并立即生效。\n是否确认恢复原装？",
    () => {
      if (host.disposed || host.selected !== selected || host.serial() !== serial) return;
      host.cosmeticResetToken = {};
      host.previewPart = undefined;
      host.cosmeticPreview = undefined;
      host.coatingPreview = undefined;
      host.configuration = dependencies.writeConfiguration(host.configuration, selected.itemId, serial, {});
      host.publishCurrentState();
      host.updateControls();
      host.status.textContent = "已恢复原装并立即生效。";
    },
  );
}

/** Publish the selected kart, character and effective tuning state to the game shell. */
export function publishGarageCurrentState(
  host: GarageStateCommitHost,
  dependencies: Pick<GarageStateCommitDependencies,
    "currentConfiguration" | "composeEquipment" | "normalizeEquipment">,
): void {
  if (!host.options.onChange) return;
  const character = host.options.catalog.characters.find(
    entry => entry.itemId === host.options.selectedCharacterItemId);
  if (!character) throw new Error("当前人物不在资源目录内，无法更新车库状态。");
  const equipment = dependencies.composeEquipment(host.options.profile, host.selected.itemId,
    character.itemId, host.selected.systemKey, host.options.profile.equipment.systemKartVariant);
  const current = dependencies.currentConfiguration(
    host.configuration, host.selected.itemId, host.serial());
  const exceedType = host.selected.engineGrade === 9
    ? (current.exceedType ?? host.base().defaultExceedType) : undefined;
  const published = {
    ...dependencies.normalizeEquipment({ ...equipment, garage: host.configuration }),
    exceedType: exceedType ?? 0,
  };
  host.options.onChange({
    kart: host.selected,
    character,
    equipment: published,
    garage: host.configuration,
  });
}

/** Commit a progression change after validation and notify the visual transition. */
export function setGarageProgression(
  host: GarageStateCommitHost,
  progression: GarageProgression,
  refreshControls: boolean,
  dependencies: Pick<GarageStateCommitDependencies,
    "currentConfiguration" | "initialProgression" | "validateConfiguration" | "writeConfiguration">,
): boolean {
  if (!host.canSetProgression(progression)) return false;
  try {
    const before = dependencies.currentConfiguration(host.configuration,
      host.selected.itemId, host.serial()).progression ??
      dependencies.initialProgression(progression.kind === "xun");
    const equipment = {
      ...dependencies.currentConfiguration(host.configuration, host.selected.itemId, host.serial()),
      progression,
    };
    dependencies.validateConfiguration(host.base(), host.selected.engineGrade ?? 0,
      equipment, host.options.speed);
    host.configuration = dependencies.writeConfiguration(host.configuration,
      host.selected.itemId, host.serial(), equipment);
    host.publishCurrentState();
    host.status.textContent = "强化配置已更新并立即生效。";
    if (refreshControls) host.updateControls();
    host.pointEffects?.transition(before, progression);
    return true;
  } catch (error) {
    host.status.textContent = error instanceof Error ? error.message : String(error);
    return false;
  }
}

/** Refresh the selected kart's progression panel from its current persisted equipment. */
export function refreshGarageUpgradeState(
  host: GarageStateCommitHost,
  dependencies: Pick<GarageStateCommitDependencies,
    "currentConfiguration" | "supportsProgression" | "progressionLayout" |
    "progressionKind" | "expectedProgressionKind" | "initialProgression">,
): void {
  if (host.pageMode !== "level" || !host.selected) return;
  try {
    const equipment = dependencies.currentConfiguration(host.configuration,
      host.selected.itemId, host.serial());
    const base = host.base();
    const layout = dependencies.progressionLayout(host.selected.engineGrade);
    const kind = dependencies.progressionKind(host.selected.engineGrade);
    const supported = dependencies.supportsProgression(host.selected.engineGrade);
    const progression = equipment.progression &&
      equipment.progression.kind === dependencies.expectedProgressionKind(kind)
      ? equipment.progression : dependencies.initialProgression(kind === "xun");
    if (layout && kind === "xun") {
      host.updateVehicleInformation(base, equipment, layout);
      host.updateCosmeticEquippedSlots(equipment, layout, false);
    }
    host.updateVehicleHeading(progression.kind === "xun" ? progression.level : undefined);
    host.progressionPanel.update(progression, !!supported, host.selected.engineGrade,
      equipment.factory, equipment.exceedType ?? base.defaultExceedType,
      { itemId: host.selected.itemId, kartType: host.selected.kartType },
      host.upgradeCatalogEmpty);
    if (kind === "classic" && progression.kind === "classic")
      host.progressionPanel.updateRadar(host.options.library, host.selected.path,
        base, progression, equipment.factory);
  } catch (error) {
    host.status.textContent = error instanceof Error ? error.message : String(error);
  }
}
