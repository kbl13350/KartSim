import { CURRENT_SUMMARY_KEY, type GhostSummary } from "./ghost-records";
import { browserProfileSync } from "../ui/profile-sync";

const RECORD_ID = "ghost-summary-index";
type SummaryEntry = [string, GhostSummary];

function validEntries(value: unknown): value is SummaryEntry[] {
  return Array.isArray(value) && value.length <= 10_000 && value.every(entry =>
    Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string" &&
    entry[0].length <= 256 && entry[1] !== null && typeof entry[1] === "object" &&
    !Array.isArray(entry[1]));
}

/** Import only when this browser has no summary index; local progress always wins. */
export async function hydrateGhostSummaryIndex(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const sync = browserProfileSync();
  if (!sync) return;
  const existing = localStorage.getItem(CURRENT_SUMMARY_KEY);
  if (existing !== null) {
    try {
      const entries: unknown = JSON.parse(existing);
      if (validEntries(entries)) sync.enqueueRecord(RECORD_ID, { entries });
    } catch { /* The ordinary restore path reports malformed local data. */ }
    return;
  }
  const remote = await sync.loadRecord(RECORD_ID);
  if (!remote || !validEntries(remote.entries)) return;
  // Replay frames live in IndexedDB and are not part of this compact summary copy.
  const summaries = remote.entries.map(([key, summary]) =>
    [key, { ...summary, hasGhost: false }] as SummaryEntry);
  localStorage.setItem(CURRENT_SUMMARY_KEY, JSON.stringify(summaries));
}

/** Mirror summary metadata only. Full replay frames stay in IndexedDB. */
export function syncGhostSummaryIndex(entries: SummaryEntry[]): void {
  browserProfileSync()?.enqueueRecord(RECORD_ID, { entries });
}
