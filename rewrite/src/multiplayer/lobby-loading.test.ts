import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { syncRaceLoadingView, type LobbyLoadingHost, type RaceLoadingView } from "./lobby-loading";
import type { LobbyRoom } from "./lobby-actions";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class Wl0 {");
const start = source.indexOf("  syncLoadingView() {", classStart);
const end = source.indexOf("  maybeAutoReady()", start);
assert.ok(classStart > 0 && start > classStart && end > start);
const makeOriginal = (load: (library: unknown, root: unknown) => Promise<RaceLoadingView>) =>
  new Function("gy", "C1", `return class { ${source.slice(start, end)} };`)(
    { load }, (error: unknown) => error instanceof Error ? error.message : String(error),
  ) as new () => { syncLoadingView(this: LobbyLoadingHost): void };

function room(phase: LobbyRoom["phase"] = "loading", race: Record<string, unknown> = {}): LobbyRoom {
  return { roomId: "room-1", revision: 1, name: "Room", phase,
    speed: 7, hostId: "host", mode: "individual", members: [
      { playerId: "me", name: "Me", slot: 0, ready: false, team: null },
    ], race: { raceId: "race-1", loadedIds: ["me"], ...race } };
}

function fixture() {
  const events: unknown[] = [];
  const host = {
    state: { room: room() },
    options: { raceLoader: {}, library: {}, root: {},
      status: (message: string, error?: boolean) => events.push(["status", message, error]) },
    roomView: { setStartPresentation: (value: boolean) => events.push(["presenting", value]) },
    loadingView: undefined as RaceLoadingView | undefined,
    loadingViewPending: undefined as Promise<void> | undefined,
    loadingViewFailed: false,
    startPresentation: undefined as LobbyLoadingHost["startPresentation"],
    disposed: false, connected: true, raceVisible: false,
    startMission: undefined, rpNotice: undefined,
    syncLoadingView: () => {},
  } satisfies LobbyLoadingHost;
  const view: RaceLoadingView = {
    show: (loaded, members) => { events.push(["show", loaded, members]); },
    hide: () => { events.push("hide"); },
    dispose: () => { events.push("dispose"); },
  };
  return { host, events, view };
}

test("countdown overlay, RP banner and race identity match release", () => {
  const run = (released: boolean) => {
    const { host, events, view } = fixture();
    host.loadingView = view;
    const load = async () => view;
    const Original = makeOriginal(load);
    const sync = () => released ? Original.prototype.syncLoadingView.call(host)
      : syncRaceLoadingView(host, load);
    sync();
    host.state.room = room("countdown", { rp: true });
    sync();
    host.startPresentation = { roomId: "room-1", raceId: "race-1",
      complete: false, signal: new AbortController().signal };
    sync();
    host.startPresentation.complete = true;
    sync();
    host.state.room = room("open");
    sync();
    return events;
  };
  assert.deepEqual(run(false), run(true));
});

test("overlay loading and rejected resource path match release", async () => {
  const run = async (released: boolean, fail: boolean) => {
    const { host, events, view } = fixture();
    const load = async () => {
      events.push("load");
      if (fail) throw new Error("missing overlay");
      return view;
    };
    const Original = makeOriginal(load);
    host.syncLoadingView = () => released
      ? Original.prototype.syncLoadingView.call(host)
      : syncRaceLoadingView(host, load);
    host.syncLoadingView();
    host.syncLoadingView();
    await host.loadingViewPending;
    return { events, failed: host.loadingViewFailed, hasView: !!host.loadingView,
      pending: host.loadingViewPending };
  };
  assert.deepEqual(await run(false, false), await run(true, false));
  assert.deepEqual(await run(false, true), await run(true, true));
});
