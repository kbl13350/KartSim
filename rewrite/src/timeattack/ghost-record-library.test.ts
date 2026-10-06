import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deleteGhostRecord, persistGhostSummaries, promoteGhostRecord,
  putGhostRecord, restoreGhostRecordLibrary, saveGhostRecord,
  saveImportedGhostRecord, saveRawGhostRecord, exportGhostKsv,
  exportGhostSource, ghostRecord, ghostRecordKey, ghostTrackIdFromKey,
  type GhostExportDependencies, type GhostExportLibraryHost,
  type GhostRecordLibraryDependencies, type GhostRecordLibraryHost,
  type GhostSourceEntry, type GhostSummary, type RawGhostEntry,
  type StoredGhostEntry,
} from "./ghost-record-library";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Pt {");
const end = release.indexOf("\nfunction V_", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Library = GhostExportLibraryHost & {
  restore(reportError: (message: string) => void): Promise<void>;
  promote(key: string, sources: GhostSourceEntry[] | undefined,
    trackId: string, summary: GhostSummary): Promise<void>;
  save(key: string, sources: GhostSourceEntry[], summary: GhostSummary): Promise<void>;
  saveRaw(key: string, raw: RawGhostEntry): Promise<void>;
  saveImported(key: string, sources: GhostSourceEntry[], summary: GhostSummary,
    bytes: Uint8Array): Promise<void>;
  delete(key: string): Promise<boolean>;
  record(key: string): GhostSummary | undefined;
  exportSource(key: string): Promise<unknown>;
  exportKsv(key: string): Promise<unknown>;
};
type Mode = "normal" | "migration-error" | "read-error" | "persist-error" |
  "write-error";

function makeFixture(mode: Mode, rewritten: boolean): {
  library: Library;
  events: unknown[][];
  rows: Map<string, unknown>;
  source: GhostSourceEntry;
  recordKey(selection: { trackId?: string }, options: {
    speed: unknown; booster: unknown; version?: unknown;
  }): string;
  trackIdFromKey(key: string): string;
} {
  const events: unknown[][] = [];
  const rows = new Map<string, unknown>();
  rows.set("already-stored", { existing: true });
  class Store {
    async get(key: string) { events.push(["get", key]); return rows.get(key); }
    async put(key: string, value: StoredGhostEntry) {
      events.push(["put-store", key, value]);
      if ((mode === "migration-error" && key === "missing-ghost") ||
        mode === "write-error") throw new Error("ghost store unavailable");
      rows.set(key, value);
    }
    async putRaw(key: string, raw: RawGhostEntry) {
      events.push(["put-raw", key, raw]);
      if (mode === "write-error") throw new Error("ghost store unavailable");
      rows.set(key, raw);
    }
    async delete(key: string) {
      events.push(["delete-store", key]);
      if (mode === "write-error") throw new Error("ghost store unavailable");
      rows.delete(key);
    }
  }
  const source: GhostSourceEntry = {
    equipment: { kart: 7 },
    record: { stamps: [{ time: 0 }] },
    timeBase: "race",
    rawRecording: { frames: [] },
  };
  const restoreSummaries = () => {
    events.push(["restore-summaries"]);
    if (mode === "read-error") throw new Error("bad summary JSON");
    return {
      records: [
        ["already-stored", { elapsedMs: 1000, hasGhost: true }],
        ["missing-ghost", { elapsedMs: 2000, hasGhost: true }],
      ] as Array<[string, GhostSummary]>,
      migrations: [
        ["already-stored", source], ["missing-ghost", source],
      ] as Array<[string, GhostSourceEntry]>,
      usedLegacy: false,
    };
  };
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
  const debug = (event: string, data: Record<string, unknown>) => {
    events.push(["debug", event, data]);
  };
  const zCeiling = (trackId: string) => {
    events.push(["z-ceiling", trackId]); return 900;
  };
  const commonTimeBase = (sources: GhostSourceEntry[]) => {
    events.push(["time-base", sources.map(entry => entry.timeBase)]);
    return "countdown";
  };
  const storage = {
    setItem(key: string, value: string) {
      events.push(["set-item", key, value]);
      if (mode === "persist-error") throw new Error("storage quota");
    },
  };
  const dependencies: GhostRecordLibraryDependencies = {
    restoreSummaries,
    trackIdFromKey: key => key.split("\0")[0] ?? "",
    errorMessage, zCeiling, commonTimeBase, debug, storage,
    summaryStorageKey: "summary-key",
  };
  const exportDependencies: GhostExportDependencies = {
    filename: (key, name, elapsed) => {
      events.push(["filename", key, name, elapsed]);
      return `${key}-${String(name)}-${String(elapsed)}.ksv`;
    },
    zCeiling,
    encodeKsvFile: (header, ceiling) => {
      events.push(["encode-file", header, ceiling]);
      return Uint8Array.of(10, 11);
    },
  };
  const encode = (recording: unknown, ceiling: number) => {
    events.push(["encode-recording", recording, ceiling]);
    return { compressed: true };
  };
  const build = (recording: unknown, encoded: unknown) => {
    events.push(["build-header", recording, encoded]);
    return { format: "v12" };
  };
  const Original = new Function("Th0", "Rh0", "Lh0", "Vh0", "z_", "Nf",
    "B6", "Dh0", "PD", "localStorage", "V_", "ph0", "LD", "Ue",
    `${originalClass}\nreturn Pt;`)(Store, class {}, class {}, restoreSummaries,
      errorMessage, debug, zCeiling, commonTimeBase, "summary-key", storage,
      exportDependencies.filename, exportDependencies.encodeKsvFile,
      (trackId: string, speed: unknown, booster: unknown, version: unknown) =>
        `${trackId}:${String(speed)}:${String(booster)}:${String(version)}`,
      (options: { speed: unknown }) => options.speed,
    ) as (new () => Library) & {
      recordKey(selection: { trackId?: string }, options: {
        speed: unknown; booster: unknown; version?: unknown;
      }): string;
      trackIdFromKey(key: string): string;
    };
  const library = new Original();
  library.ksvEncoder.encode = encode;
  library.ksvHeaderBuilder.build = build;
  if (rewritten) Object.assign(library, {
    restore(reportError: (message: string) => void) {
      return restoreGhostRecordLibrary(library, reportError, dependencies);
    },
    promote(key: string, sources: GhostSourceEntry[] | undefined,
      trackId: string, summary: GhostSummary) {
      return promoteGhostRecord(library, key, sources, trackId, summary);
    },
    save(key: string, sources: GhostSourceEntry[], summary: GhostSummary) {
      return saveGhostRecord(library, key, sources, summary, dependencies);
    },
    saveRaw(key: string, raw: RawGhostEntry) {
      return saveRawGhostRecord(library, key, raw, dependencies);
    },
    saveImported(key: string, sources: GhostSourceEntry[], summary: GhostSummary,
      bytes: Uint8Array) {
      return saveImportedGhostRecord(library, key, sources, summary, bytes, dependencies);
    },
    delete(key: string) { return deleteGhostRecord(library, key); },
    put(key: string, sources: GhostSourceEntry[], trackId: string,
      bytes?: Uint8Array) {
      return putGhostRecord(library, key, sources, trackId, bytes, dependencies);
    },
    persist() { return persistGhostSummaries(library, dependencies); },
    record(key: string) { return ghostRecord(library, key); },
    exportSource(key: string) { return exportGhostSource(library, key); },
    exportKsv(key: string) { return exportGhostKsv(library, key, exportDependencies); },
  });
  return {
    library, events, rows, source,
    recordKey: (selection, options) => rewritten
      ? ghostRecordKey(selection, options,
        (trackId, speed, booster, version) =>
          `${trackId}:${String(speed)}:${String(booster)}:${String(version)}`,
        value => (value as { speed: unknown }).speed)
      : Original.recordKey(selection, options),
    trackIdFromKey: key => rewritten
      ? ghostTrackIdFromKey(key) : Original.trackIdFromKey(key),
  };
}

async function observe(operation: (library: Library, source: GhostSourceEntry) =>
  Promise<unknown> | unknown, mode: Mode, rewritten: boolean): Promise<unknown> {
  const { library, events, rows, source } = makeFixture(mode, rewritten);
  library.summaries.set("current", { elapsedMs: 3000, hasGhost: true });
  let outcome: unknown;
  try { outcome = await operation(library, source); }
  catch (error) { outcome = { error: (error as Error).message }; }
  return { outcome, events, summaries: [...library.summaries], rows: [...rows] };
}

test("legacy restore, existing Ghosts, migration failure and read errors match release", async () => {
  for (const mode of ["normal", "migration-error", "read-error", "persist-error"] as const) {
    const operation = (library: Library) => {
      const reports: string[] = [];
      return library.restore(message => reports.push(message)).then(() => reports);
    };
    assert.deepEqual(await observe(operation, mode, true),
      await observe(operation, mode, false), mode);
  }
});

test("Ghost write and summary publication order match release", async () => {
  const operations = [
    (library: Library, source: GhostSourceEntry) =>
      library.promote("current", [source], "track-a", { elapsedMs: 1800 }),
    (library: Library) =>
      library.promote("current", [], "track-a", { elapsedMs: 1800 }),
    (library: Library, source: GhostSourceEntry) =>
      library.save("track-a\0key", [source], { elapsedMs: 1800 }),
    (library: Library) =>
      library.saveRaw("raw-key", { metadata: { summary: { elapsedMs: 1900 } },
        frames: [{ at: 1 }] }),
    (library: Library, source: GhostSourceEntry) =>
      library.saveImported("track-a\0key", [source], { elapsedMs: 2000 },
        Uint8Array.of(4, 5)),
    (library: Library, source: GhostSourceEntry) =>
      library.put("direct", [source], "track-a", Uint8Array.of(6)),
  ];
  for (const operation of operations) {
    for (const mode of ["normal", "write-error"] as const) {
      assert.deepEqual(await observe(operation, mode, true),
        await observe(operation, mode, false));
    }
  }
});

test("delete preserves summaries without Ghosts and propagates store errors like release", async () => {
  for (const mode of ["normal", "write-error"] as const) {
    for (const withGhost of [true, false]) {
      const operation = (library: Library) => {
        library.summaries.set("target", { elapsedMs: 100, hasGhost: withGhost });
        return library.delete("target");
      };
      assert.deepEqual(await observe(operation, mode, true),
        await observe(operation, mode, false));
    }
  }
});

test("Ghost record keys and summary queries match release", () => {
  for (const selection of [{ trackId: "track-a" }, {}]) {
    const options = { speed: 3, booster: "normal", version: 12 };
    for (const key of ["track-a\0standard", "bare-track", "\0empty"]) {
      const original = makeFixture("normal", false);
      const rewritten = makeFixture("normal", true);
      original.library.summaries.set(key, { elapsedMs: 100 });
      rewritten.library.summaries.set(key, { elapsedMs: 100 });
      assert.deepEqual(rewritten.library.record(key), original.library.record(key));
      assert.equal(rewritten.trackIdFromKey(key), original.trackIdFromKey(key));
    }
    const result = (rewritten: boolean) => {
      try { return makeFixture("normal", rewritten).recordKey(selection, options); }
      catch (error) { return { error: (error as Error).message }; }
    };
    assert.deepEqual(result(true), result(false));
  }
});

test("Ghost export keeps original bytes and generates raw KSV in release order", async () => {
  const records: Array<[string, unknown]> = [
    ["original", {
      originalKsvBytes: Uint8Array.of(1, 2, 3),
      participants: [{ equipment: { playerName: "Pilot" },
        rawRecording: { metadata: { summary: { elapsedMs: 900 } } } }],
    }],
    ["original-summary-fallback", {
      originalKsvBytes: Uint8Array.of(4, 5), participants: [{ equipment: {} }],
    }],
    ["raw", {
      participants: [{ equipment: { playerName: "Pilot" },
        rawRecording: { metadata: { trackId: "track-a",
          equipment: { playerName: "RawPilot" }, summary: { elapsedMs: 800 } } } }],
    }],
    ["no-source", { participants: [{ equipment: {} }] }],
  ];
  for (const key of ["original", "original-summary-fallback", "raw", "no-source", "missing"]) {
    const observeExport = async (rewritten: boolean) => {
      const { library, events, rows } = makeFixture("normal", rewritten);
      library.summaries.set("original-summary-fallback",
        { kartName: "Fallback", elapsedMs: 1100 });
      for (const [recordKey, value] of records) rows.set(recordKey, value);
      const result: Record<string, unknown> = {};
      for (const method of ["exportSource", "exportKsv"] as const) {
        try { result[method] = await library[method](key); }
        catch (error) { result[method] = { error: (error as Error).message }; }
      }
      return { result, events };
    };
    assert.deepEqual(await observeExport(true), await observeExport(false), key);
  }
});
