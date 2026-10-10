export interface FactoryVehicle {
  kind: string;
  itemId: number;
  systemKey?: string;
  path: string;
  engineGrade?: number;
  [key: string]: unknown;
}

export interface GarageFactoryScoringHost {
  selected: FactoryVehicle;
  options: {
    catalog: { karts: FactoryVehicle[] };
    profile?: { equipment: { itemIds: Record<number, number>; kartSerial: number } };
    library: unknown;
  };
  assets: { parts: unknown };
  configuration: unknown;
  scoreSources: Map<string, Promise<unknown>>;
  factoryScoreRevision: number;
  factoryPanel?: { updateScores(scores?: unknown, error?: string): void };
  pageMode: string;
  disposed: boolean;
  serialFor(vehicle: FactoryVehicle): number;
  factoryVehicleKey(vehicle: FactoryVehicle): string;
  nativeFactoryAllowed(vehicle: FactoryVehicle): boolean;
  base(): unknown;
  serial(): number;
}

export interface GarageFactoryScoringDependencies {
  currentConfiguration(configuration: unknown, itemId: number, serial: number): unknown;
  scoreFamily(vehicle: unknown, engineGrade: number | undefined): string | undefined;
  loadScoreSource(library: unknown, path: string, kind: "xun-body" | "x-v1"): Promise<unknown>;
  calculateScores(source: unknown, vehicle: unknown, engineGrade: number | undefined,
    configuration: unknown, parts: unknown): unknown;
}

/** Include the kart serial so separate owned copies keep separate Factory score state. */
export function garageFactoryVehicleKey(
  host: GarageFactoryScoringHost,
  vehicle: FactoryVehicle,
): string {
  return `${vehicle.kind}:${vehicle.itemId}:${vehicle.systemKey ?? ""}:${vehicle.path}:` +
    `${vehicle.engineGrade ?? ""}:${host.serialFor(vehicle)}`;
}

/** Resolve an equivalent catalog object when navigation enters Factory mode. */
export function canonicalGarageFactoryVehicle(
  host: GarageFactoryScoringHost,
  vehicle: FactoryVehicle,
): FactoryVehicle {
  const normalizedPath = (path: string) => path.replace(/\\/g, "/").toLowerCase();
  return host.options.catalog.karts.find(candidate =>
    candidate.itemId === vehicle.itemId &&
    normalizedPath(candidate.path) === normalizedPath(vehicle.path) &&
    (candidate.systemKey ?? "") === (vehicle.systemKey ?? "")) ?? vehicle;
}

/** Only the kart currently equipped in the profile carries its owned serial. */
export function garageKartSerialFor(host: GarageFactoryScoringHost, vehicle: FactoryVehicle): number {
  const profile = host.options?.profile;
  return profile && vehicle.itemId === profile.equipment.itemIds[3]
    ? profile.equipment.kartSerial : 0;
}

/** Load native Factory scores once per source and discard results from stale page selections. */
export function updateGarageFactoryScores(
  host: GarageFactoryScoringHost,
  dependencies: GarageFactoryScoringDependencies,
): void {
  const revision = ++host.factoryScoreRevision;
  const selected = host.selected;
  const panel = host.factoryPanel;
  const selectedKey = host.factoryVehicleKey(selected);
  if (!panel) return;
  if (!host.nativeFactoryAllowed(selected)) {
    panel.updateScores(undefined, "当前车辆不支持车辆改装。");
    return;
  }
  let vehicle: unknown;
  let configuration: unknown;
  try {
    vehicle = host.base();
    configuration = dependencies.currentConfiguration(
      host.configuration, selected.itemId, host.serial());
  } catch (error) {
    panel.updateScores(undefined, String(error));
    return;
  }
  const family = dependencies.scoreFamily(vehicle, selected.engineGrade);
  if (!family) {
    panel.updateScores(undefined, "当前车辆缺少对应代际的 Factory 评分来源。");
    return;
  }
  const sourceKind = family === "xun" ? "xun-body" : "x-v1";
  const cacheKey = `${sourceKind}:${selected.path}`;
  let source = host.scoreSources.get(cacheKey);
  if (!source) {
    source = dependencies.loadScoreSource(host.options.library, selected.path, sourceKind);
    host.scoreSources.set(cacheKey, source);
    source.catch(() => host.scoreSources.delete(cacheKey));
  }
  const stillCurrent = () => !host.disposed && host.factoryScoreRevision === revision &&
    host.factoryVehicleKey(host.selected) === selectedKey && host.pageMode === "factory";
  source.then(scores => {
    if (!stillCurrent()) return;
    panel.updateScores(dependencies.calculateScores(
      scores, vehicle, selected.engineGrade, configuration, host.assets.parts));
  }).catch(error => {
    if (stillCurrent()) panel.updateScores(undefined, String(error));
  });
}
