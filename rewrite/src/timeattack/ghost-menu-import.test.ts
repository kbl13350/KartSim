import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deleteGhostFromMenu, exportGhostFromMenu, importSelectedGhostFile,
  isCurrentGhostImport, switchToImportedGhostTrack,
  type GhostMenuHost, type GhostMenuImportDependencies,
} from "./ghost-menu-import";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Ly {");
const end = release.indexOf("\nfunction X_", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Menu = GhostMenuHost & {
  deleteGhost(): Promise<void>;
  exportGhost(): Promise<void>;
  importSelectedFile(): Promise<void>;
};
type Mode = "normal" | "no-key" | "delete-error" | "export-missing" |
  "export-error" | "decode-error" | "import-error" | "cancel-read" |
  "cancel-title" | "track-missing" | "selection-missing" |
  "pending-switch" | "select-error";

function makeFixture(mode: Mode, rewritten: boolean): {
  menu: Menu;
  events: unknown[][];
  selection: { trackId: string; speed: number; booster: number; version: string };
} {
  const events: unknown[][] = [];
  const selection = { trackId: "track-a", speed: 3, booster: 0, version: "国服" };
  const dependencies: GhostMenuImportDependencies = {
    decodeKsv(bytes) {
      events.push(["decode", [...bytes]]);
      if (mode === "decode-error") throw new Error("invalid KSV");
      return { info: { players: [{ equipment: { kart: 7 } }] }, zCeiling: 900 };
    },
    toGhostRecord(info, version) {
      events.push(["record", info, version]);
      return { key: "track-a\0normal", sources: [
        { record: { stamps: [0, 1, 2] } },
        { record: { stamps: [0, 1] } },
      ], summary: { bestTimeMs: 500 } };
    },
    toSelection(info, version) {
      events.push(["selection", info, version]);
      return selection;
    },
    selectionLabel(value) {
      events.push(["label", value]);
      return "S3 个人";
    },
    mergeTrackSelection(value, track) {
      events.push(["merge-track", value, track]);
      return { value, track };
    },
  };
  const Original = new Function("pd0", "gd0", "zD", "X_", "md0",
    `${originalClass}\nreturn Ly;`)(dependencies.decodeKsv,
      dependencies.toGhostRecord, dependencies.toSelection,
      dependencies.selectionLabel, dependencies.mergeTrackSelection,
    ) as new (...args: never[]) => Menu;
  const menu = Object.create(Original.prototype) as Menu;
  menu.disposed = false;
  menu.importRevision = 0;
  menu.input = {
    files: [{ async arrayBuffer() {
      events.push(["read-file"]);
      if (mode === "cancel-read") menu.importRevision++;
      return Uint8Array.of(1, 2, 3).buffer;
    } }],
    value: "chosen.ksv",
  };
  menu.options = {
    currentGhostKey() { events.push(["current-key"]); return mode === "no-key" ? undefined : "track-a\0normal"; },
    async deleteGhost(key) {
      events.push(["delete", key]);
      if (mode === "delete-error") throw new Error("storage failed");
    },
    ...mode !== "export-missing" ? { async exportGhost(key: string) {
      events.push(["export", key]);
      if (mode === "export-error") throw new Error("no replay");
    } } : {},
    reportError(message) { events.push(["error", message]); },
    speedVersion() { events.push(["speed-version"]); return "modern"; },
    async resolveGhostKartTitle(kartId) {
      events.push(["kart-title", kartId]);
      if (mode === "cancel-title") menu.disposed = true;
      return "Roadster";
    },
    async importGhost(key, sources, summary, bytes) {
      events.push(["import", key, sources, summary, [...bytes]]);
      if (mode === "import-error") throw new Error("quota");
    },
    async resolveGhostTrack(trackId) {
      events.push(["resolve-track", trackId]);
      if (mode === "track-missing") return undefined;
      return { track: { id: trackId, title: "Forest" },
        selection: mode === "selection-missing" ? undefined : { trackId } };
    },
    async selectGhostTrack(value, speed, booster, version) {
      events.push(["select-track", value, speed, booster, version]);
      if (mode === "select-error") throw new Error("track load failed");
    },
  };
  if (mode === "pending-switch") {
    menu.pendingTrackSwitch = Promise.reject(new Error("previous switch failed"));
  }
  if (rewritten) Object.assign(menu, {
    deleteGhost() { return deleteGhostFromMenu(menu); },
    exportGhost() { return exportGhostFromMenu(menu); },
    importSelectedFile() { return importSelectedGhostFile(menu, dependencies); },
    isCurrentImport(revision: number) { return isCurrentGhostImport(menu, revision); },
    switchToImportedTrack(value: typeof selection, ceiling: number,
      frames: number, revision: number) {
      return switchToImportedGhostTrack(menu, value, ceiling, frames,
        revision, dependencies);
    },
  });
  return { menu, events, selection };
}

async function observe(mode: Mode, method: "deleteGhost" | "exportGhost" |
  "importSelectedFile" | "switchToImportedTrack", rewritten: boolean) {
  const { menu, events, selection } = makeFixture(mode, rewritten);
  let outcome: unknown;
  try {
    outcome = method === "switchToImportedTrack"
      ? await menu.switchToImportedTrack(selection, 900, 3, 0)
      : await menu[method]();
  } catch (error) { outcome = { error: (error as Error).message }; }
  return { outcome, events, inputValue: menu.input.value,
    disposed: menu.disposed, revision: menu.importRevision,
    hasPendingSwitch: !!menu.pendingTrackSwitch };
}

test("Ghost menu delete and export guards/errors match release", async () => {
  for (const mode of ["normal", "no-key", "delete-error"] as const) {
    assert.deepEqual(await observe(mode, "deleteGhost", true),
      await observe(mode, "deleteGhost", false), mode);
  }
  for (const mode of ["normal", "no-key", "export-missing", "export-error"] as const) {
    assert.deepEqual(await observe(mode, "exportGhost", true),
      await observe(mode, "exportGhost", false), mode);
  }
});

test("Ghost import reads bytes, checks revision, saves, and switches like release", async () => {
  for (const mode of ["normal", "decode-error", "import-error", "cancel-read",
    "cancel-title", "track-missing", "selection-missing", "select-error"] as const) {
    assert.deepEqual(await observe(mode, "importSelectedFile", true),
      await observe(mode, "importSelectedFile", false), mode);
  }
});

test("track switch awaits a previous failed switch and clears its own pending task", async () => {
  for (const mode of ["normal", "track-missing", "selection-missing",
    "pending-switch", "select-error"] as const) {
    assert.deepEqual(await observe(mode, "switchToImportedTrack", true),
      await observe(mode, "switchToImportedTrack", false), mode);
  }
});
