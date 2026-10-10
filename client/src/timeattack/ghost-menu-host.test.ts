import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deleteGhostMenuRecord, exportGhostMenuRecord, importGhostMenuRecord,
  mountGhostMenuBridge, resolveGhostMenuKartTitle, resolveGhostMenuTrack,
  type GhostMenuBridge, type GhostMenuBridgeHost, type GhostMenuRecordSummary,
} from "./ghost-menu-host";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class vd0 {");
const end = release.indexOf("\nfunction yd0", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

type Bridge = GhostMenuBridge & {
  mount(root: unknown): unknown;
};
type Mode = "normal" | "no-library" | "no-track" | "no-kart" |
  "delete-false" | "save-error" | "export-missing";

function makeFixture(mode: Mode, rewritten: boolean) {
  const events: unknown[][] = [];
  let menuOptions: Record<string, unknown> | undefined;
  const download = (bytes: Uint8Array, filename: string) =>
    events.push(["download", [...bytes], filename]);
  const attach = (options: Record<string, unknown>) => {
    menuOptions = options;
    events.push(["attach", Object.keys(options)]);
    return { mounted: true };
  };
  const Original = new Function("Ly", "wd0", "yd0",
    `${originalClass}\nreturn vd0;`)(
      { attach }, download,
      (error: unknown) => error instanceof Error ? error.message : String(error),
    ) as new (host: GhostMenuBridgeHost) => Bridge;
  const host: GhostMenuBridgeHost = {
    library: {
      record(key) { events.push(["record", key]); return { kartName: "Saved Kart" }; },
      async save(key, sources, summary) {
        events.push(["save", key, sources, summary]);
        if (mode === "save-error") throw new Error("quota");
      },
      async saveImported(key, sources, summary, bytes) {
        events.push(["save-imported", key, sources, summary, [...bytes]]);
        if (mode === "save-error") throw new Error("quota");
      },
      async delete(key) { events.push(["delete", key]); return mode !== "delete-false"; },
      async exportKsv(key) {
        events.push(["export", key]);
        return mode === "export-missing" ? undefined
          : { bytes: Uint8Array.of(1, 2), filename: "record.ksv" };
      },
    },
    getLibrary() {
      events.push(["get-library"]);
      if (mode === "no-library") return undefined;
      return {
        async timeAttackTrackCatalog() {
          events.push(["track-catalog"]);
          return mode === "no-track" ? []
            : [{ id: "Track-A", title: "Forest" }];
        },
        async timeAttackGarageCatalog() {
          events.push(["garage-catalog"]);
          return { karts: mode === "no-kart" ? []
            : [{ itemId: 7, title: "Roadster" }] };
        },
      };
    },
    getSelection() { events.push(["selection"]); return { selected: true }; },
    selectTrack(selection, speed, booster, version) {
      events.push(["select-track", selection, speed, booster, version]);
      return "selected";
    },
    currentKey() { events.push(["current-key"]); return "current"; },
    speedVersion() { events.push(["speed-version"]); return "modern"; },
    reportError(message) { events.push(["error", message]); },
    samplingMode() { events.push(["sampling-mode"]); return "linear"; },
    changeSamplingMode(value) { events.push(["change-sampling", value]); },
    resetNickname() { events.push(["reset-nickname"]); },
    refreshRecord() { events.push(["refresh-record"]); },
  };
  const bridge = new Original(host);
  if (rewritten) Object.assign(bridge, {
    mount(root: unknown) { return mountGhostMenuBridge(bridge, root,
      attach as (options: Record<string, unknown>) => unknown); },
    importRecord(key: string, sources: unknown[], summary: GhostMenuRecordSummary,
      bytes?: Uint8Array) {
      return importGhostMenuRecord(bridge, key, sources, summary, bytes);
    },
    resolveTrack(trackId: string) { return resolveGhostMenuTrack(bridge, trackId); },
    resolveKartTitle(itemId: unknown) { return resolveGhostMenuKartTitle(bridge, itemId); },
    deleteRecord(key: string) { return deleteGhostMenuRecord(bridge, key); },
    exportRecord(key: string) { return exportGhostMenuRecord(bridge, key, download); },
  });
  return { bridge, events, menuOptions: () => menuOptions };
}

async function observe(mode: Mode, rewritten: boolean,
  operation: (bridge: Bridge) => Promise<unknown> | unknown) {
  const { bridge, events } = makeFixture(mode, rewritten);
  let outcome: unknown;
  try { outcome = await operation(bridge); }
  catch (error) { outcome = { error: (error as Error).message }; }
  return { outcome, events };
}

test("Ghost record import uses prior name, chooses storage path, and reports errors like release", async () => {
  const summary = { bestTimeMs: 900, speed: 3, booster: 0 };
  for (const mode of ["normal", "save-error"] as const) {
    for (const bytes of [undefined, Uint8Array.of(4, 5)]) {
      const operation = (bridge: Bridge) => bridge.importRecord("current", [{}], summary, bytes);
      assert.deepEqual(await observe(mode, true, operation),
        await observe(mode, false, operation), `${mode}:${!!bytes}`);
    }
  }
});

test("Ghost menu catalog lookup, deletion and export match release", async () => {
  for (const mode of ["normal", "no-library", "no-track", "no-kart",
    "delete-false", "export-missing"] as const) {
    for (const operation of [
      (bridge: Bridge) => bridge.resolveTrack("TRACK-A"),
      (bridge: Bridge) => bridge.resolveKartTitle(7),
      (bridge: Bridge) => bridge.deleteRecord("current"),
      (bridge: Bridge) => bridge.exportRecord("current"),
    ]) {
      assert.deepEqual(await observe(mode, true, operation),
        await observe(mode, false, operation), mode);
    }
  }
});

test("menu mount exposes the same live host callbacks", async () => {
  const inspect = async (rewritten: boolean) => {
    const { bridge, events, menuOptions } = makeFixture("normal", rewritten);
    const mounted = bridge.mount({ root: true });
    const options = menuOptions();
    assert.ok(options);
    const invoke = (name: string, ...args: unknown[]) => {
      const callback = options[name];
      assert.equal(typeof callback, "function");
      return (callback as (...values: unknown[]) => unknown)(...args);
    };
    const outputs = [
      await invoke("currentGhostKey"),
      await invoke("speedVersion"),
      await invoke("samplingMode"),
      await invoke("selectGhostTrack", { selected: true }, 3, 0, "modern"),
      await invoke("resolveGhostTrack", "TRACK-A"),
      await invoke("resolveGhostKartTitle", 7),
      await invoke("exportGhost", "current"),
    ];
    return { mounted, outputs, events };
  };
  assert.deepEqual(await inspect(true), await inspect(false));
});
