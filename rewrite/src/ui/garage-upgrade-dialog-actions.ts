export interface GarageUpgradeVehicle {
  itemId: number;
  engineGrade?: number;
  kartType?: number;
  title: string;
}

export interface GarageUpgradeProgression {
  kind: string;
  level: number;
  [key: string]: unknown;
}

export interface GarageUpgradeEquipment {
  progression?: GarageUpgradeProgression;
  exceedType?: number;
  [key: string]: unknown;
}

export interface GarageUpgradeDialogHost {
  selected: GarageUpgradeVehicle;
  configuration: unknown;
  surface: unknown;
  options: { library: unknown; speed: unknown };
  tuning: { exceedTypeChange?: unknown };
  pageMode: string;
  disposed: boolean;
  skillSelection?: unknown;
  exceedTypeChange?: unknown;
  upgrade?: unknown;
  preparation?: unknown;
  confirmation?: { pending: boolean };
  controls: { inert: boolean };
  progressionPanel: { element: {
    inert: boolean;
    querySelector(selector: string): { focus(): void } | null;
  } };
  factoryPanel?: { element: { inert: boolean } };
  pointEffects?: { clear(): void };
  status: { textContent: string };
  requireCustomization(): boolean;
  serial(): number;
  base(): { defaultExceedType?: number; [key: string]: unknown };
  setProgression(progression: GarageUpgradeProgression): boolean;
  publishCurrentState(): void;
  updateControls(): void;
}

export interface GarageUpgradeDialogDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): GarageUpgradeEquipment;
  initialProgression(xun: boolean): GarageUpgradeProgression;
  gradeFamily(engineGrade: number | undefined): string | undefined;
  exceedChangeAvailability(vehicle: {
    engineGrade: number | undefined;
    kartType: number | undefined;
    itemId: number;
    level: number;
  }, configuration: unknown): string;
  validateConfiguration(base: unknown, grade: number,
    equipment: GarageUpgradeEquipment, speed: unknown): void;
  writeConfiguration(configuration: unknown, itemId: number, serial: number,
    equipment: GarageUpgradeEquipment): unknown;
  openSkillSelection(surface: unknown, library: unknown, progression: GarageUpgradeProgression,
    slot: number, done: (progression?: GarageUpgradeProgression) => void): unknown;
  openExceedTypeChange(surface: unknown, tuning: GarageUpgradeDialogHost["tuning"],
    library: unknown, initial: { title: string; type: number | undefined },
    done: (type?: number) => void): unknown;
}

/** Open an XUN skill picker and apply its result only to the original selected kart. */
export function requestGarageSkillSelection(
  host: GarageUpgradeDialogHost,
  slot: number,
  dependencies: Pick<GarageUpgradeDialogDependencies,
    "currentConfiguration" | "initialProgression" | "gradeFamily" | "openSkillSelection">,
): void {
  if (!host.requireCustomization() || host.disposed || host.skillSelection ||
      host.exceedTypeChange || host.upgrade || host.preparation ||
      host.confirmation?.pending || host.pageMode !== "level" ||
      dependencies.gradeFamily(host.selected.engineGrade) !== "xun") return;
  const selected = host.selected;
  const progression = dependencies.currentConfiguration(
    host.configuration, selected.itemId, host.serial()).progression ??
    dependencies.initialProgression(true);
  if (progression.kind !== "xun") return;
  host.pointEffects?.clear();
  try {
    host.skillSelection = dependencies.openSkillSelection(
      host.surface, host.options.library, progression, slot, choice => {
        host.skillSelection = undefined;
        host.controls.inert = false;
        host.progressionPanel.element.inert = false;
        if (host.factoryPanel) host.factoryPanel.element.inert = false;
        if (choice && !host.disposed && host.selected === selected)
          host.setProgression(choice);
        if (!host.disposed)
          host.progressionPanel.element
            .querySelector(`button[aria-label="更换第${slot + 1}栏技能"]`)?.focus();
      },
    );
    host.controls.inert = true;
    host.progressionPanel.element.inert = true;
    if (host.factoryPanel) host.factoryPanel.element.inert = true;
  } catch (error) {
    host.status.textContent = error instanceof Error ? error.message : String(error);
  }
}

/** Open the XUN exceed-type selector and validate its chosen local tuning before publishing. */
export function requestGarageExceedTypeChange(
  host: GarageUpgradeDialogHost,
  dependencies: Pick<GarageUpgradeDialogDependencies,
    "currentConfiguration" | "initialProgression" | "exceedChangeAvailability" |
    "validateConfiguration" | "writeConfiguration" | "openExceedTypeChange">,
): void {
  if (!host.requireCustomization() || host.disposed || host.exceedTypeChange ||
      host.skillSelection || host.upgrade || host.preparation ||
      host.confirmation?.pending || host.pageMode !== "level") return;
  const selected = host.selected;
  const serial = host.serial();
  const equipment = dependencies.currentConfiguration(
    host.configuration, selected.itemId, serial);
  const progression = equipment.progression ?? dependencies.initialProgression(true);
  const tuning = host.tuning.exceedTypeChange;
  if (!tuning || progression.kind !== "xun" ||
      dependencies.exceedChangeAvailability({
        engineGrade: selected.engineGrade,
        kartType: selected.kartType,
        itemId: selected.itemId,
        level: progression.level,
      }, tuning) !== "enabled") return;
  const initialType = equipment.exceedType ?? host.base().defaultExceedType;
  host.pointEffects?.clear();
  host.exceedTypeChange = dependencies.openExceedTypeChange(
    host.surface, host.tuning, host.options.library,
    { title: selected.title, type: initialType }, type => {
      host.exceedTypeChange = undefined;
      host.controls.inert = false;
      host.progressionPanel.element.inert = false;
      if (!host.disposed && host.selected === selected && host.serial() === serial &&
          type !== undefined) {
        try {
          const updated = {
            ...dependencies.currentConfiguration(host.configuration, selected.itemId, serial),
            exceedType: type,
          };
          dependencies.validateConfiguration(host.base(), selected.engineGrade ?? 0,
            updated, host.options.speed);
          host.configuration = dependencies.writeConfiguration(
            host.configuration, selected.itemId, serial, updated);
          const label = new Map([[2, "S"], [3, "B"], [4, "L"]]).get(type) ?? `类型 ${type}`;
          host.publishCurrentState();
          host.status.textContent = `超负荷类型已变更为 ${label} 并立即生效。`;
        } catch (error) {
          host.status.textContent = error instanceof Error ? error.message : String(error);
        }
      }
      if (!host.disposed) host.updateControls();
    },
  );
  host.controls.inert = true;
  host.progressionPanel.element.inert = true;
}
