/** Connects the Ghost menu to the local recording library and track catalog. */

export interface GhostMenuRecordSummary {
  bestTimeMs: number;
  kartName?: string;
  speed: unknown;
  booster: unknown;
}

export interface GhostMenuLibrary {
  record(key: string): { kartName?: string } | undefined;
  save(key: string, sources: unknown[], summary: Record<string, unknown>): Promise<unknown>;
  saveImported(key: string, sources: unknown[], summary: Record<string, unknown>,
    bytes: Uint8Array): Promise<unknown>;
  delete(key: string): Promise<boolean>;
  exportKsv(key: string): Promise<{ bytes: Uint8Array; filename: string } | undefined>;
}

export interface GhostMenuCatalog {
  timeAttackTrackCatalog(): Promise<Array<{ id: string; title: string }>>;
  timeAttackGarageCatalog(): Promise<{
    karts: Array<{ itemId: unknown; title: string }>;
  }>;
}

export interface GhostMenuBridgeHost {
  library: GhostMenuLibrary;
  getLibrary(): GhostMenuCatalog | undefined;
  getSelection(): unknown;
  selectTrack(selection: unknown, speed: unknown, booster: unknown,
    version: unknown): unknown;
  currentKey(): string | undefined;
  speedVersion(): unknown;
  reportError(message: string): void;
  samplingMode(): unknown;
  changeSamplingMode(mode: unknown): void;
  resetNickname(): void;
  refreshRecord(): void;
}

export interface GhostMenuBridge {
  host: GhostMenuBridgeHost;
  importRecord(key: string, sources: unknown[], summary: GhostMenuRecordSummary,
    bytes?: Uint8Array): Promise<void>;
  resolveTrack(trackId: string): Promise<unknown>;
  resolveKartTitle(itemId: unknown): Promise<string | undefined>;
  deleteRecord(key: string): Promise<void>;
  exportRecord(key: string): Promise<void>;
}

export function mountGhostMenuBridge(bridge: GhostMenuBridge,
  root: unknown, attach: (options: Record<string, unknown>) => unknown): unknown {
  const host = bridge.host;
  return attach({
    root,
    importGhost: (key: string, sources: unknown[], summary: GhostMenuRecordSummary,
      bytes?: Uint8Array) => bridge.importRecord(key, sources, summary, bytes),
    resolveGhostTrack: (trackId: string) => bridge.resolveTrack(trackId),
    resolveGhostKartTitle: (itemId: unknown) => bridge.resolveKartTitle(itemId),
    selectGhostTrack: (selection: unknown, speed: unknown, booster: unknown,
      version: unknown) => host.selectTrack(selection, speed, booster, version),
    deleteGhost: (key: string) => bridge.deleteRecord(key),
    exportGhost: (key: string) => bridge.exportRecord(key),
    currentGhostKey: () => host.currentKey(),
    speedVersion: () => host.speedVersion(),
    reportError: (message: string) => host.reportError(message),
    samplingMode: () => host.samplingMode(),
    onSamplingModeChange: (mode: unknown) => host.changeSamplingMode(mode),
    resetNickname: () => host.resetNickname(),
  });
}

export async function importGhostMenuRecord(bridge: GhostMenuBridge,
  key: string, sources: unknown[], summary: GhostMenuRecordSummary,
  bytes: Uint8Array | undefined): Promise<void> {
  const prior = bridge.host.library.record(key);
  const storedSummary = {
    elapsedMs: summary.bestTimeMs,
    kartName: summary.kartName ?? prior?.kartName ?? "",
    speed: summary.speed,
    booster: summary.booster,
    hasGhost: true,
  };
  try {
    if (bytes) {
      await bridge.host.library.saveImported(key, sources, storedSummary, bytes);
    } else {
      await bridge.host.library.save(key, sources, storedSummary);
    }
  } catch (error) {
    bridge.host.reportError(`影子导入失败：${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export async function resolveGhostMenuTrack(bridge: GhostMenuBridge,
  trackId: string): Promise<unknown> {
  const library = bridge.host.getLibrary();
  if (!library) return;
  const track = (await library.timeAttackTrackCatalog()).find(candidate =>
    candidate.id.toLowerCase() === trackId.toLowerCase());
  return track ? { track, selection: bridge.host.getSelection() } : undefined;
}

export async function resolveGhostMenuKartTitle(bridge: GhostMenuBridge,
  itemId: unknown): Promise<string | undefined> {
  return (await bridge.host.getLibrary()?.timeAttackGarageCatalog())
    ?.karts.find(kart => kart.itemId === itemId)?.title;
}

export async function deleteGhostMenuRecord(bridge: GhostMenuBridge,
  key: string): Promise<void> {
  if (await bridge.host.library.delete(key)) {
    if (key === bridge.host.currentKey()) bridge.host.refreshRecord();
  }
}

export async function exportGhostMenuRecord(bridge: GhostMenuBridge,
  key: string,
  download: (bytes: Uint8Array, filename: string) => void): Promise<void> {
  const exported = await bridge.host.library.exportKsv(key);
  if (!exported) throw new Error("录像不存在或缺少可导出的 replay 数据。 ");
  download(exported.bytes, exported.filename);
}
