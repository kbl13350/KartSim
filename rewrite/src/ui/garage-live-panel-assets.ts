/** Asset ownership and asynchronous card/preview selection for live garage panels. */

export interface GarageCardItem {
  kind: string;
  itemId: number;
  path?: string;
  [field: string]: unknown;
}

export interface GaragePreviewSelection {
  equipment: { itemIds: Record<number, number>; kartSerial: number };
  garage: unknown;
  initial?: unknown;
}

export interface GarageLivePreview {
  reverse: boolean;
  origin?: number;
  coatingSource?: { itemId: number; visual: unknown; engineGrade: number };
  kart: { model: unknown };
  particleModification?: { setPresentationAllowed(allowed: boolean): void };
  [field: string]: unknown;
}

export interface GarageCoatingFitting {
  current?: unknown;
  select(request: unknown): Promise<boolean>;
  cancel(): void;
  dispose(): void;
}

export interface GarageLivePanelAssetsHost {
  library: unknown;
  environment: unknown;
  stageBinding: unknown;
  importer: unknown;
  previewMode: string;
  coatingTextures: unknown;
  coatingFitting?: GarageCoatingFitting;
  coatingRequest?: unknown;
  coatingFailure?: string;
  particleModificationPageVisible: boolean;
  characters: Map<number, unknown>;
  karts: Map<string, unknown>;
  equipment: Map<string, { dispose(): void }>;
  characterLoading: Set<number>;
  kartLoading: Set<string>;
  equipmentLoading: Set<string>;
  characterFailed: Set<number>;
  kartFailed: Set<string>;
  equipmentFailed: Set<string>;
  desiredCharacters: Set<number>;
  desiredKarts: Set<string>;
  desiredEquipment: Set<string>;
  preview?: GarageLivePreview;
  previewKey?: string;
  previewGeneration: number;
  previewReverse: boolean;
  disposed: boolean;
  onReady(): void;
  resetPreviewRotation(): void;
  disposePreview(): void;
  syncCharacters(items: GarageCardItem[]): void;
  syncKarts(items: GarageCardItem[]): void;
  syncEquipment(items: GarageCardItem[]): void;
  loadEquipmentCard(item: GarageCardItem): void;
  loadKartCard(item: GarageCardItem): void;
}

export interface GarageLivePanelAssetDependencies {
  coatingEquipment(library: unknown, model: unknown, visual: unknown,
    engineGrade: number, coating: { family: string; coating: string }, textures: unknown): Promise<unknown>;
  equipmentKey(item: GarageCardItem): string;
  loadEquipment(library: unknown, item: GarageCardItem,
    environment: unknown, binding: unknown): Promise<{ dispose(): void }>;
  disposeCharacter(character: unknown): void;
  loadCharacter(library: unknown, item: GarageCardItem, environment: unknown,
    binding: unknown, mode: string): Promise<unknown>;
  kartKey(item: GarageCardItem): string;
  disposeKart(kart: unknown): void;
  loadKart(library: unknown, item: GarageCardItem,
    environment: unknown, binding: unknown): Promise<unknown>;
  garageKart(garage: unknown, itemId: number, serial: number): {
    cosmetics?: unknown;
    progression?: { kind?: string; level?: number };
  };
  normalizedKartPath(path: string): string;
  loadPreview(library: unknown, kart: GarageCardItem, rider: GarageCardItem,
    environment: unknown, binding: unknown, importer: unknown, mode: string,
    selection: GaragePreviewSelection, coatingTextures: unknown): Promise<GarageLivePreview>;
  disposePreview(preview: GarageLivePreview): void;
  createCoatingFitting(preview: GarageLivePreview, textures: unknown): GarageCoatingFitting;
}

export function garageEquipmentCardKey(item: GarageCardItem): string {
  return `${item.kind}:${item.itemId}`;
}

export function normalizedGarageKartPath(path: string): string {
  return path.replaceAll("\\", "/").toLowerCase();
}

export function setParticleModificationPageVisible(host: GarageLivePanelAssetsHost,
  visible: boolean): void {
  host.particleModificationPageVisible = visible;
  host.preview?.particleModification?.setPresentationAllowed(visible);
}

export async function validateCoatingEquipment(host: GarageLivePanelAssetsHost,
  itemId: number, coating: { family: string; id: string },
  deps: GarageLivePanelAssetDependencies): Promise<void> {
  const preview = host.preview;
  const source = preview?.coatingSource;
  if (!preview || source?.itemId !== itemId)
    throw new Error("请等待当前车辆预览加载完成。");
  await deps.coatingEquipment(host.library, preview.kart.model, source.visual,
    source.engineGrade, { family: coating.family, coating: coating.id }, host.coatingTextures);
  if (host.disposed || host.preview !== preview)
    throw new Error("车辆已切换，请重新选择车膜。");
}

export function syncGarageCards(host: GarageLivePanelAssetsHost,
  items: GarageCardItem[]): void {
  host.syncCharacters(items.filter(item => item.kind === "character"));
  host.syncKarts(items.filter(item => item.kind === "kart"));
  host.syncEquipment(items.filter(item => "category" in item));
}

export function syncGarageEquipment(host: GarageLivePanelAssetsHost,
  items: GarageCardItem[], deps: GarageLivePanelAssetDependencies): void {
  host.desiredEquipment = new Set(items.map(deps.equipmentKey));
  host.equipment.forEach((asset, key) => {
    if (!host.desiredEquipment.has(key)) { asset.dispose(); host.equipment.delete(key); }
  });
  items.forEach(item => host.loadEquipmentCard(item));
}

export function loadGarageEquipmentCard(host: GarageLivePanelAssetsHost,
  item: GarageCardItem, deps: GarageLivePanelAssetDependencies): void {
  const key = deps.equipmentKey(item);
  if (host.equipment.has(key) || host.equipmentLoading.has(key) ||
      host.equipmentFailed.has(key)) return;
  host.equipmentLoading.add(key);
  deps.loadEquipment(host.library, item, host.environment, host.stageBinding)
    .then(asset => {
      if (host.disposed || !host.desiredEquipment.has(key)) asset.dispose();
      else host.equipment.set(key, asset);
    })
    .catch(() => host.equipmentFailed.add(key))
    .finally(() => {
      host.equipmentLoading.delete(key);
      if (!host.disposed) host.onReady();
    });
}

export function syncGarageCharacters(host: GarageLivePanelAssetsHost,
  items: GarageCardItem[], deps: GarageLivePanelAssetDependencies): void {
  host.desiredCharacters = new Set(items.map(item => item.itemId));
  host.characters.forEach((asset, id) => {
    if (!host.desiredCharacters.has(id)) {
      deps.disposeCharacter(asset);
      host.characters.delete(id);
    }
  });
  items.forEach(item => {
    if (host.characters.has(item.itemId) || host.characterLoading.has(item.itemId) ||
        host.characterFailed.has(item.itemId)) return;
    host.characterLoading.add(item.itemId);
    deps.loadCharacter(host.library, item, host.environment, host.stageBinding, "card")
      .then(asset => {
        if (host.disposed || !host.desiredCharacters.has(item.itemId))
          deps.disposeCharacter(asset);
        else host.characters.set(item.itemId, asset);
      })
      .catch(() => { host.characterFailed.add(item.itemId); })
      .finally(() => {
        host.characterLoading.delete(item.itemId);
        if (!host.disposed) host.onReady();
      });
  });
}

export function syncGarageKarts(host: GarageLivePanelAssetsHost,
  items: GarageCardItem[], deps: GarageLivePanelAssetDependencies): void {
  host.desiredKarts = new Set(items.map(deps.kartKey));
  host.karts.forEach((asset, key) => {
    if (!host.desiredKarts.has(key)) {
      deps.disposeKart(asset);
      host.karts.delete(key);
    }
  });
  items.forEach(item => host.loadKartCard(item));
}

export function loadGarageKartCard(host: GarageLivePanelAssetsHost,
  item: GarageCardItem, deps: GarageLivePanelAssetDependencies): void {
  const key = deps.kartKey(item);
  if (host.karts.has(key) || host.kartLoading.has(key) || host.kartFailed.has(key)) return;
  host.kartLoading.add(key);
  deps.loadKart(host.library, item, host.environment, host.stageBinding)
    .then(asset => {
      if (host.disposed || !host.desiredKarts.has(key)) deps.disposeKart(asset);
      else host.karts.set(key, asset);
    })
    .catch(() => host.kartFailed.add(key))
    .finally(() => {
      host.kartLoading.delete(key);
      if (!host.disposed) host.onReady();
    });
}

export function syncGaragePreview(host: GarageLivePanelAssetsHost,
  kart: GarageCardItem, rider: GarageCardItem, selection: GaragePreviewSelection,
  deps: GarageLivePanelAssetDependencies): void {
  const itemIds = selection.equipment.itemIds;
  const serial = kart.itemId === itemIds[3] ? selection.equipment.kartSerial : 0;
  const build = deps.garageKart(selection.garage, kart.itemId, serial);
  const key = JSON.stringify([
    deps.kartKey(kart), deps.normalizedKartPath(kart.path!), rider.itemId,
    itemIds[2], itemIds[4], itemIds[70], itemIds[52], itemIds[8], itemIds[9],
    itemIds[11], itemIds[16], itemIds[26], itemIds[27], selection.initial,
    build.cosmetics, build.progression?.kind, build.progression?.level,
  ]);
  if (key === host.previewKey) return;
  host.previewKey = key;
  const generation = ++host.previewGeneration;
  host.disposePreview();
  deps.loadPreview(host.library, kart, rider, host.environment,
    host.stageBinding, host.importer, host.previewMode, selection, host.coatingTextures)
    .then(preview => {
      if (host.disposed || generation !== host.previewGeneration)
        deps.disposePreview(preview);
      else {
        host.preview = preview;
        preview.particleModification?.setPresentationAllowed(
          host.particleModificationPageVisible);
        const reverse = host.previewMode === "kart-only" ? false : preview.reverse;
        if (host.previewReverse !== reverse) {
          host.previewReverse = reverse;
          host.resetPreviewRotation();
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      if (!host.disposed && generation === host.previewGeneration) host.onReady();
    });
}

export function disposeGaragePreview(host: GarageLivePanelAssetsHost,
  deps: GarageLivePanelAssetDependencies): void {
  host.coatingFitting?.dispose();
  host.coatingFitting = undefined;
  host.coatingRequest = undefined;
  host.coatingFailure = undefined;
  // These fields are part of the live preview session rather than the assets.
  const motion = host as GarageLivePanelAssetsHost & {
    transformPreviewEnabled: boolean;
    transformPreviewTimelineActive: boolean;
    transformPreviewCancelled: boolean;
    transformPreviewCompleted: boolean;
    transformPreviewClosing: boolean;
  };
  motion.transformPreviewEnabled = false;
  motion.transformPreviewTimelineActive = false;
  motion.transformPreviewCancelled = false;
  motion.transformPreviewCompleted = false;
  motion.transformPreviewClosing = false;
  if (host.preview) {
    deps.disposePreview(host.preview);
    host.preview = undefined;
  }
}

export function syncGarageCoatingPreview(host: GarageLivePanelAssetsHost,
  request: unknown, deps: GarageLivePanelAssetDependencies): void {
  if (!request) {
    if (host.coatingRequest) {
      const hadCurrent = host.coatingFitting?.current !== undefined;
      host.coatingFitting?.cancel();
      if (hadCurrent && host.preview) host.preview.origin = undefined;
    }
    host.coatingRequest = undefined;
    host.coatingFailure = undefined;
    return;
  }
  if (!host.preview || host.coatingRequest === request) return;
  host.coatingRequest = request;
  host.coatingFailure = undefined;
  try {
    if (host.previewMode !== "kart-only")
      throw new Error("车膜试穿仅属于独立车库。");
    host.coatingFitting ??= deps.createCoatingFitting(host.preview, host.coatingTextures);
    const fitting = host.coatingFitting;
    const preview = host.preview;
    fitting.select(request)
      .then(applied => {
        if (applied && !host.disposed && host.preview === preview &&
            host.coatingFitting === fitting && host.coatingRequest === request)
          preview.origin = undefined;
      })
      .catch(error => {
        if (!host.disposed && host.coatingFitting === fitting && host.coatingRequest === request)
          host.coatingFailure = error instanceof Error ? error.message : String(error);
      });
  } catch (error) {
    host.coatingFailure = error instanceof Error ? error.message : String(error);
  }
}
