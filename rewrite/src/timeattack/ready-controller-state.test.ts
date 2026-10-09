import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { changeReadyFavoriteItems, changeReadyFavoriteTrack, closeReadyMultiplayer,
  disposeReadyController, getReadyWindowNotice, isReadyModalBusy,
  readyNetworkDiagnostics, refreshReadyRecord, releaseReadyForRace,
  renderReadyController, returnMultiplayerToSinglePlayer,
  setReadyWindowNotice, updateReadyWindowNotice,
  type ReadyControllerStateHost } from "./ready-controller-state";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class ql0 {");
assert.ok(classStart > 0);
const extract = (name: string, next: string) => {
  const start = source.indexOf(`  ${name}(`, classStart);
  const end = source.indexOf(`  ${next}(`, start);
  assert.ok(start > classStart && end > start, name);
  return source.slice(start, end);
};
const Original = new Function("IP", `return class {
  ${extract("dispose", "updateWindowNotice")}
  ${extract("updateWindowNotice", "getWindowNotice")}
  ${extract("getWindowNotice", "setWindowNotice")}
  ${extract("setWindowNotice", "renderReady")}
  ${extract("renderReady", "refreshRecord")}
  ${extract("refreshRecord", "releaseForRace")}
  ${extract("releaseForRace", "readyModalBusy")}
  ${extract("readyModalBusy", "async enterTimeAttackReady")}
  ${extract("async returnMultiplayerToSinglePlayer", "networkDiagnostics")}
  ${extract("networkDiagnostics", "closeMultiplayer")}
  ${extract("closeMultiplayer", "readyStageContext")}
  ${extract("changeFavoriteTrack", "changeFavoriteItems")}
  ${extract("changeFavoriteItems", "async openGarage")}
};`)((track: { themeId: string; trackId: string }) => track) as
  new () => Record<string, (...args: never[]) => unknown>;
type Name = "dispose" | "updateWindowNotice" | "getWindowNotice" |
  "setWindowNotice" | "renderReady" | "refreshRecord" | "releaseForRace" |
  "readyModalBusy" | "returnMultiplayerToSinglePlayer" |
  "networkDiagnostics" | "closeMultiplayer" | "changeFavoriteTrack" |
  "changeFavoriteItems";
const release = (name: Name, host: ReadyControllerStateHost, ...args: unknown[]) =>
  (Original.prototype[name] as (...args: unknown[]) => unknown).call(host, ...args);

function fixture(released: boolean) {
  const events: unknown[] = [];
  let profile = { favoriteTracks: [{ themeId: "town", trackId: "a" }],
    favoriteItems: [] as unknown };
  let saveFailure = false;
  const ready = { render: (state: unknown) => events.push(["render", state]),
    refreshRecord: () => events.push("refreshRecord"),
    unfreeze: () => events.push("unfreeze"),
    show: () => events.push("show"), dispose: () => events.push("ready.dispose") };
  const multiplayer = { leaveRoom: async (reason: string) => {
    events.push(["leaveRoom", reason]); return true;
  }, networkDiagnostics: () => ["peer"], dispose: () => events.push("multiplayer.dispose") };
  const host = {
    host: { shell: { readyModalBusy: false, current: "MultiplayerLobby",
      leaveMultiplayerLobby: () => events.push("shell.leave") },
      hud: { showDebugText: (message: string, level: string) =>
        events.push(["debug", message, level]) },
      getProfile: () => profile,
      setProfile: (value: typeof profile) => { profile = value; events.push(["profile", value]); },
      saveProfile: () => { if (saveFailure) throw new Error("disk"); events.push("save"); },
      getBgm: () => ({ playReady: () => events.push("bgm.ready") }) },
    activeTimeAttackReady: ready,
    activeTaskbar: { setVisible: (visible: boolean) => events.push(["taskbar", visible]),
      dispose: () => events.push("taskbar.dispose") },
    activeSettings: undefined,
    activeTrackSelect: { dispose: () => events.push("track.dispose") },
    activeGarage: { dispose: () => events.push("garage.dispose") },
    activeWindowNotice: { update: (value: unknown) => events.push(["notice", value]) },
    readyToonEnvironment: {}, multiplayer,
    randomTrackSession: { clear: () => events.push("random.clear") },
    activeRandomGroup: {}, randomTrackCatalog: {},
    disposed: false, settingsOpening: false,
    releaseReadyToonEnvironment: () => events.push("environment.release"),
    closeMultiplayer: (_openReady = true, _restoreReady = true) => {},
    closeSettings: () => events.push("settings.close"),
    enterTimeAttackReady: async () => { events.push("ready.enter"); },
    showGarageError: (error: unknown) => events.push(["garage.error", error]),
  } as unknown as ReadyControllerStateHost;
  host.closeMultiplayer = (openReady = true, restoreReady = true) => {
    if (released) release("closeMultiplayer", host, openReady, restoreReady);
    else closeReadyMultiplayer(host, openReady, restoreReady);
  };
  return { host, events, setSaveFailure: (value: boolean) => { saveFailure = value; } };
}

test("Ready-owned UI release and notices match release", () => {
  const run = (released: boolean) => {
    const { host, events } = fixture(released);
    const invoke = (name: Name, ...args: unknown[]) => release(name, host, ...args);
    if (released) {
      invoke("updateWindowNotice", 3);
      invoke("renderReady", "ready"); invoke("refreshRecord");
      invoke("releaseForRace"); invoke("dispose");
    } else {
      updateReadyWindowNotice(host, 3);
      renderReadyController(host, "ready"); refreshReadyRecord(host);
      releaseReadyForRace(host); disposeReadyController(host);
    }
    return { events, disposed: host.disposed, multiplayer: host.multiplayer,
      ready: host.activeTimeAttackReady };
  };
  assert.deepEqual(run(false), run(true));
});

test("multiplayer return and diagnostics match release", async () => {
  const run = async (released: boolean) => {
    const { host, events } = fixture(released);
    const diagnostic = released ? release("networkDiagnostics", host) : readyNetworkDiagnostics(host);
    if (released) await release("returnMultiplayerToSinglePlayer", host);
    else await returnMultiplayerToSinglePlayer(host);
    await Promise.resolve();
    return { events, diagnostic, multiplayer: host.multiplayer };
  };
  assert.deepEqual(await run(false), await run(true));
});

test("track and item favorites, including save failure, match release", () => {
  const run = (released: boolean) => {
    const { host, events, setSaveFailure } = fixture(released);
    const track = { themeId: "town", trackId: "b" };
    if (released) release("changeFavoriteTrack", host, track, true);
    else changeReadyFavoriteTrack(host, track, true, value => value as typeof track);
    setSaveFailure(true);
    if (released) release("changeFavoriteItems", host, ["item-1"]);
    else changeReadyFavoriteItems(host, ["item-1"]);
    const busy = released ? release("readyModalBusy", host) : isReadyModalBusy(host);
    const notice = released ? release("getWindowNotice", host) : getReadyWindowNotice(host);
    if (released) release("setWindowNotice", host, notice);
    else setReadyWindowNotice(host,
      notice as ReadyControllerStateHost["activeWindowNotice"]);
    return { events, busy, hasNotice: !!host.activeWindowNotice };
  };
  assert.deepEqual(run(false), run(true));
});

test("a race start closes the shop, or cancels one still loading", () => {
  const { host, events } = fixture(false);
  const shopHost = host as unknown as { activeShop?: { close(): void }; shopOpening?: boolean;
    shopCancelled?: boolean };
  shopHost.activeShop = { close: () => events.push("shop.close") };
  releaseReadyForRace(host);
  assert.ok(events.includes("shop.close"));
  assert.equal(shopHost.activeShop, undefined);
  const loading = fixture(false);
  const loadingHost = loading.host as unknown as typeof shopHost;
  loadingHost.shopOpening = true;
  releaseReadyForRace(loading.host);
  assert.equal(loadingHost.shopCancelled, true);
});
