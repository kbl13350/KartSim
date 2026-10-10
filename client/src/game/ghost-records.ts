/** Summary metadata stored separately from the large ghost frame recordings. */
export interface GhostSummary {
  readonly replay?: unknown;
  readonly hasGhost?: boolean;
  readonly [field: string]: unknown;
}

export interface GhostRecordingSource {
  readonly timeBase?: string;
}

export interface RestoredGhostSummaries {
  readonly records: Array<[string, GhostSummary]>;
  readonly migrations: Array<[string, unknown]>;
  readonly usedLegacy: boolean;
}

export interface SummaryStorage {
  getItem(key: string): string | null;
}

export const CURRENT_SUMMARY_KEY = "kartrider-web:p3553:time-attack-records-v1";
export const LEGACY_SUMMARY_KEY = "kartrider-web:p3528:time-attack-records-v1";

/** Keep the release client's NUL-separated identity, including its retro flag. */
export function makeGhostRecordKey(
  trackId: string,
  speed: number,
  booster: number,
  version = "国服",
): string {
  const key = `${trackId.toLowerCase()}\0${speed}\0${booster}`;
  return version === "国服" ? key : `${key}\0retro`;
}

export function trackIdFromGhostKey(key: string): string {
  return key.split("\0")[0] ?? "";
}

/** Replace characters forbidden in common file systems without altering Unicode names. */
export function safeGhostFilenamePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim() || "replay";
}

export function ghostExportFilename(
  recordKey: string,
  playerName?: string,
  elapsedMs?: number,
): string {
  const trackId = trackIdFromGhostKey(recordKey);
  const name = playerName || "replay";
  const time = typeof elapsedMs === "number" && Number.isFinite(elapsedMs)
    ? String(Math.max(0, Math.trunc(elapsedMs)))
    : "unknown-time";
  return `${safeGhostFilenamePart(trackId)}_${safeGhostFilenamePart(name)}_${time}.ksv`;
}

/** A batch only has one time base when every recording declares the same one. */
export function commonGhostTimeBase(
  sources: readonly GhostRecordingSource[],
): string | undefined {
  const declared = sources.filter(source => source.timeBase !== undefined);
  if (declared.length !== sources.length) return undefined;
  const first = declared[0]?.timeBase;
  return declared.every(source => source.timeBase === first) ? first : undefined;
}

/** Read one historical summary array. The persisted format is intentionally kept. */
export function readGhostSummaryEntries(
  key: string,
  storage: SummaryStorage = localStorage,
): Array<[string, GhostSummary]> {
  const serialized = storage.getItem(key);
  if (serialized === null) return [];
  const parsed: unknown = JSON.parse(serialized);
  if (!Array.isArray(parsed)) throw new Error(`TimeAttack record ${key} 格式无效。`);
  return parsed as Array<[string, GhostSummary]>;
}

/** Merge current then legacy summaries; record the replay payloads for migration. */
export function restoreGhostSummaries(
  storage: SummaryStorage = localStorage,
): RestoredGhostSummaries {
  const current = readGhostSummaryEntries(CURRENT_SUMMARY_KEY, storage);
  const legacy = readGhostSummaryEntries(LEGACY_SUMMARY_KEY, storage);
  const seen = new Set<unknown>();
  const records: Array<[string, GhostSummary]> = [];
  const migrations: Array<[string, unknown]> = [];
  for (const [key, summary] of [...current, ...legacy]) {
    if (seen.has(key)) continue;
    seen.add(key);
    const { replay, ...withoutReplay } = summary;
    if (replay) migrations.push([key, replay]);
    records.push([key, replay ? { ...withoutReplay, hasGhost: true } : withoutReplay]);
  }
  return { records, migrations, usedLegacy: legacy.length > 0 };
}

// Names imported by the generated compatibility runtime.
export {
  makeGhostRecordKey as LD,
  ghostExportFilename as V_,
  safeGhostFilenamePart as N_,
  commonGhostTimeBase as Dh0,
  restoreGhostSummaries as Vh0,
  readGhostSummaryEntries as O_,
};
