export interface GarageFlowVehicle {
  itemId: number;
  engineGrade?: number;
  title: string;
  [key: string]: unknown;
}

export interface GarageFlowProgression {
  kind: string;
  level: number;
  [key: string]: unknown;
}

export interface GarageFlowCandidate {
  item: GarageFlowVehicle;
  value: GarageFlowProgression;
}

export interface GarageFlowPreparationResult {
  candidate: GarageFlowCandidate;
  target: GarageFlowProgression;
  method: string;
}

export interface GarageProgressionFlowHost {
  skillSelection?: unknown;
  exceedTypeChange?: unknown;
  upgrade?: unknown;
  preparation?: unknown;
  confirmation?: { pending: boolean };
  selected: GarageFlowVehicle;
  configuration: unknown;
  disposed: boolean;
  surface: unknown;
  options: {
    library: unknown;
    environment: unknown;
    stageBinding: unknown;
    catalog: { karts: GarageFlowVehicle[] };
    profile: { equipment: { itemIds: number[]; kartSerial: number } };
  };
  tuning?: { urls: Map<string, string> };
  pointEffects?: { clear(): void };
  controls: { inert: boolean };
  progressionPanel: { element: { inert: boolean } };
  factoryPanel?: { element: { inert: boolean } };
  panels?: {
    setTransformPreview(enabled: boolean): void;
    resetPreviewRotation(enabled: boolean): void;
  };
  status: { textContent: string };
  serial(): number;
  canSetProgression(progression: GarageFlowProgression): boolean;
  setProgression(progression: GarageFlowProgression, refreshControls?: boolean): boolean;
  publishCurrentState(): void;
  updateControls(): void;
  requestProgression(progression: GarageFlowProgression, prepared?: boolean, method?: string): void;
  hideUpgradeResultBackground(): void;
  restoreUpgradeResultBackground(): void;
  refreshUpgradeState(): void;
}

export interface GarageProgressionFlowDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number):
    { progression?: GarageFlowProgression };
  initialProgression(xun: boolean): GarageFlowProgression;
  blockedKart(itemId: number): boolean;
  transition(before: GarageFlowProgression, after: GarageFlowProgression,
    engineGrade: number | undefined, method: string): { afterLevel: number; [key: string]: unknown };
  openPreparation(surface: unknown, library: unknown, candidates: GarageFlowCandidate[],
    selectedItemId: number, done: (result?: GarageFlowPreparationResult) => void): unknown;
  openResult(surface: unknown, library: unknown, environment: unknown,
    stageBinding: unknown, vehicleTitle: string, done: () => void,
    kind: string, transition: ReturnType<GarageProgressionFlowDependencies["transition"]>,
    immediate: boolean, badgeUrl: string | undefined): unknown;
}

/** Coordinate XUN candidate selection, progression commit and its result dialog. */
export function requestGarageProgression(
  host: GarageProgressionFlowHost,
  target: GarageFlowProgression,
  prepared: boolean,
  method: string,
  dependencies: GarageProgressionFlowDependencies,
): void {
  if (host.skillSelection || host.exceedTypeChange || host.upgrade || host.preparation ||
      host.confirmation?.pending || !host.canSetProgression(target)) return;
  const before = dependencies.currentConfiguration(
    host.configuration, host.selected.itemId, host.serial()).progression ??
    dependencies.initialProgression(target.kind === "xun");
  if (target.level === before.level) {
    host.setProgression(target);
    return;
  }
  const selected = host.selected;
  try {
    if (target.kind === "xun" && !prepared) {
      const candidates = host.options.catalog.karts
        .filter(vehicle => !dependencies.blockedKart(vehicle.itemId) && vehicle.engineGrade === 9)
        .map(vehicle => {
          const serial = vehicle.itemId === host.options.profile.equipment.itemIds[3]
            ? host.options.profile.equipment.kartSerial : 0;
          const progression = dependencies.currentConfiguration(
            host.configuration, vehicle.itemId, serial).progression ??
            dependencies.initialProgression(true);
          if (progression.kind !== "xun")
            throw new Error("迅车型存档强化类型不匹配。");
          return { item: vehicle, value: progression };
        });
      host.pointEffects?.clear();
      host.preparation = dependencies.openPreparation(
        host.surface, host.options.library, candidates, selected.itemId, result => {
          host.preparation = undefined;
          host.controls.inert = false;
          host.progressionPanel.element.inert = false;
          if (host.factoryPanel) host.factoryPanel.element.inert = false;
          if (!result || host.disposed) return;
          host.selected = result.candidate.item;
          host.panels?.setTransformPreview(false);
          host.panels?.resetPreviewRotation(false);
          host.publishCurrentState();
          host.updateControls();
          host.requestProgression(result.target, true, result.method);
        },
      );
      host.controls.inert = true;
      host.progressionPanel.element.inert = true;
      if (host.factoryPanel) host.factoryPanel.element.inert = true;
      return;
    }
    const change = dependencies.transition(before, target, selected.engineGrade, method);
    host.pointEffects?.clear();
    if (!host.setProgression(target, false)) return;
    host.upgrade = dependencies.openResult(
      host.surface, host.options.library, host.options.environment,
      host.options.stageBinding, selected.title, () => {
        host.upgrade = undefined;
        host.restoreUpgradeResultBackground();
        host.controls.inert = false;
        host.progressionPanel.element.inert = false;
        if (host.factoryPanel) host.factoryPanel.element.inert = false;
        if (!host.disposed && host.selected === selected) host.refreshUpgradeState();
      },
      target.kind, change, true,
      target.kind === "xun" ? host.tuning?.urls.get(`tuning_mark_${change.afterLevel}`) : undefined,
    );
    host.hideUpgradeResultBackground();
    host.controls.inert = true;
    host.progressionPanel.element.inert = true;
    if (host.factoryPanel) host.factoryPanel.element.inert = true;
  } catch (error) {
    host.status.textContent = error instanceof Error ? error.message : String(error);
  }
}
