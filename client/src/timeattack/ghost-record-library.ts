/** Persistence lifecycle for local time-attack summaries and Ghost recordings. */

export type GhostSummary = Record<string, unknown> & { hasGhost?: boolean };

export interface GhostSourceEntry {
  equipment: unknown;
  record: unknown;
  timeBase?: unknown;
  rawRecording?: unknown;
  [key: string]: unknown;
}

export interface RawGhostEntry {
  metadata: { summary: GhostSummary };
  frames: unknown[];
  [key: string]: unknown;
}

export interface StoredGhostEntry {
  zCeiling: number;
  timeBase: unknown;
  participants: Array<{
    equipment: unknown;
    record: unknown;
    rawRecording?: unknown;
  }>;
  originalKsvBytes: unknown;
}

export interface GhostRecordLibraryHost {
  ghostStore: {
    get(key: string): Promise<unknown>;
    put(key: string, value: StoredGhostEntry): Promise<unknown>;
    putRaw(key: string, raw: RawGhostEntry): Promise<unknown>;
    delete(key: string): Promise<unknown>;
  };
  summaries: Map<string, GhostSummary>;
  put(key: string, sources: GhostSourceEntry[], trackId: string,
    originalKsvBytes?: unknown): Promise<void>;
  persist(): void;
}

export interface GhostRecordLibraryDependencies {
  restoreSummaries(): {
    records: Iterable<[string, GhostSummary]>;
    migrations: Array<[string, GhostSourceEntry]>;
    usedLegacy: boolean;
  };
  trackIdFromKey(key: string): string;
  errorMessage(error: unknown): string;
  zCeiling(trackId: string): number;
  commonTimeBase(sources: GhostSourceEntry[]): unknown;
  debug(event: string, data: Record<string, unknown>): void;
  storage: { setItem(key: string, value: string): void };
  summaryStorageKey: string;
  /** Optional Java storage mirror used by the local rewrite. */
  hydrateSummaries?(): Promise<void>;
  syncSummaries?(entries: Array<[string, GhostSummary]>): void;
}

export async function restoreGhostRecordLibrary(host: GhostRecordLibraryHost,
  reportError: (message: string) => void,
  dependencies: GhostRecordLibraryDependencies): Promise<void> {
  try {
    if (dependencies.hydrateSummaries) await dependencies.hydrateSummaries();
    const { records, migrations, usedLegacy } = dependencies.restoreSummaries();
    for (const [key, summary] of records) host.summaries.set(key, summary);
    for (const [key, legacy] of migrations) {
      try {
        if (!(await host.ghostStore.get(key))) {
          await host.put(key, [legacy], dependencies.trackIdFromKey(key));
        }
      } catch (error) {
        reportError(`幽灵轨迹迁移失败：${dependencies.errorMessage(error)}`);
        const summary = host.summaries.get(key);
        if (summary) host.summaries.set(key, { ...summary, hasGhost: false });
      }
    }
    if (usedLegacy || migrations.length > 0) host.persist();
  } catch (error) {
    reportError(`TimeAttack record 读取失败：${dependencies.errorMessage(error)}`);
  }
}

export async function promoteGhostRecord(host: GhostRecordLibraryHost,
  key: string, sources: GhostSourceEntry[] | undefined, trackId: string,
  summary: GhostSummary): Promise<void> {
  if (sources && sources.length > 0) await host.put(key, sources, trackId);
  host.summaries.set(key, sources && sources.length > 0
    ? { ...summary, hasGhost: true } : summary);
  host.persist();
}

export async function saveGhostRecord(host: GhostRecordLibraryHost,
  key: string, sources: GhostSourceEntry[], summary: GhostSummary,
  dependencies: GhostRecordLibraryDependencies): Promise<void> {
  dependencies.debug("save", { key, sourceCount: sources.length });
  await host.put(key, sources, dependencies.trackIdFromKey(key));
  host.summaries.set(key, { ...summary, hasGhost: true });
  host.persist();
}

export async function saveRawGhostRecord(host: GhostRecordLibraryHost,
  key: string, raw: RawGhostEntry,
  dependencies: GhostRecordLibraryDependencies): Promise<void> {
  dependencies.debug("save-raw", { key, frames: raw.frames.length });
  await host.ghostStore.putRaw(key, raw);
  host.summaries.set(key, { ...raw.metadata.summary, hasGhost: true });
  host.persist();
}

export async function saveImportedGhostRecord(host: GhostRecordLibraryHost,
  key: string, sources: GhostSourceEntry[], summary: GhostSummary,
  originalKsvBytes: unknown,
  dependencies: GhostRecordLibraryDependencies): Promise<void> {
  const imported = sources.map(source => ({ ...source, timeBase: "countdown" }));
  await host.put(key, imported, dependencies.trackIdFromKey(key), originalKsvBytes);
  host.summaries.set(key, { ...summary, hasGhost: true });
  host.persist();
}

export async function deleteGhostRecord(host: GhostRecordLibraryHost,
  key: string): Promise<boolean> {
  await host.ghostStore.delete(key);
  if (host.summaries.get(key)?.hasGhost) {
    host.summaries.delete(key);
    host.persist();
    return true;
  }
  return false;
}

export async function putGhostRecord(host: GhostRecordLibraryHost,
  key: string, sources: GhostSourceEntry[], trackId: string,
  originalKsvBytes: unknown,
  dependencies: GhostRecordLibraryDependencies): Promise<void> {
  await host.ghostStore.put(key, {
    zCeiling: dependencies.zCeiling(trackId),
    timeBase: dependencies.commonTimeBase(sources),
    participants: sources.map(source => ({
      equipment: source.equipment,
      record: source.record,
      ...(source.rawRecording ? { rawRecording: source.rawRecording } : {}),
    })),
    originalKsvBytes,
  });
}

export function persistGhostSummaries(host: GhostRecordLibraryHost,
  dependencies: GhostRecordLibraryDependencies): void {
  const entries = [...host.summaries] as Array<[string, GhostSummary]>;
  dependencies.storage.setItem(dependencies.summaryStorageKey, JSON.stringify(entries));
  dependencies.syncSummaries?.(entries);
  dependencies.debug("summary-persist", { count: host.summaries.size });
}

export interface GhostExportLibraryHost extends GhostRecordLibraryHost {
  ksvEncoder: { encode(recording: RawExportRecording, zCeiling: number): unknown };
  ksvHeaderBuilder: { build(recording: RawExportRecording, encoded: unknown): unknown };
}

interface RawExportRecording {
  metadata: {
    trackId: string;
    equipment: { playerName?: unknown };
    summary: { elapsedMs?: unknown };
  };
}

interface StoredExportGhost {
  originalKsvBytes?: ArrayLike<number>;
  participants: Array<{
    equipment: { playerName?: unknown };
    rawRecording?: RawExportRecording;
  }>;
}

export interface GhostExportDependencies {
  filename(key: string, playerName: unknown, elapsedMs: unknown): string;
  zCeiling(trackId: string): number;
  encodeKsvFile(header: unknown, zCeiling: number): Uint8Array;
}

export function ghostRecordKey(selection: { trackId?: string },
  options: { booster: unknown; version?: unknown },
  makeKey: (trackId: string, speed: unknown, booster: unknown,
    version: unknown) => string,
  resolveSpeed: (options: unknown) => unknown): string {
  if (!selection.trackId) throw new Error("TimeAttack record key 缺少赛道。 ");
  return makeKey(selection.trackId, resolveSpeed(options), options.booster, options.version);
}

export function ghostTrackIdFromKey(key: string): string {
  return key.split("\0")[0] ?? "";
}

export function ghostRecord(host: GhostRecordLibraryHost,
  key: string): GhostSummary | undefined {
  return host.summaries.get(key);
}

export async function exportGhostSource(host: GhostExportLibraryHost,
  key: string): Promise<{
    kind: "original-ksv";
    bytes: ArrayLike<number>;
  } | {
    kind: "raw";
    recording: RawExportRecording;
  } | undefined> {
  const stored = await host.ghostStore.get(key) as StoredExportGhost | undefined;
  if (!stored) return;
  if (stored.originalKsvBytes) {
    return { kind: "original-ksv", bytes: stored.originalKsvBytes };
  }
  const recording = stored.participants[0]?.rawRecording;
  return recording ? { kind: "raw", recording } : undefined;
}

export async function exportGhostKsv(host: GhostExportLibraryHost,
  key: string, dependencies: GhostExportDependencies): Promise<{
    bytes: Uint8Array;
    filename: string;
    source: "original" | "generated-v12";
    metadataParity: "preserved-original" | "native-partial";
  }> {
  const stored = await host.ghostStore.get(key) as StoredExportGhost | undefined;
  if (!stored) throw new Error(`Replay not found: ${key}`);

  if (stored.originalKsvBytes) {
    const summary = host.summaries.get(key);
    return {
      bytes: Uint8Array.from(stored.originalKsvBytes),
      filename: dependencies.filename(
        key,
        stored.participants[0]?.equipment.playerName ?? summary?.kartName,
        stored.participants[0]?.rawRecording?.metadata.summary.elapsedMs ?? summary?.elapsedMs,
      ),
      source: "original",
      metadataParity: "preserved-original",
    };
  }

  const recording = stored.participants[0]?.rawRecording;
  if (!recording) {
    throw new Error("Replay exists but has neither rawRecording nor originalKsvBytes");
  }
  const zCeiling = dependencies.zCeiling(recording.metadata.trackId);
  const encoded = host.ksvEncoder.encode(recording, zCeiling);
  const header = host.ksvHeaderBuilder.build(recording, encoded);
  return {
    bytes: dependencies.encodeKsvFile(header, zCeiling),
    filename: dependencies.filename(key,
      recording.metadata.equipment.playerName,
      recording.metadata.summary.elapsedMs),
    source: "generated-v12",
    metadataParity: "native-partial",
  };
}
