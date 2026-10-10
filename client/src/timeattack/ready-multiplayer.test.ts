import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyReadyMultiplayerGarage, openReadyMultiplayer,
  readyMultiplayerGarageOptions, type ReadyMultiplayerController,
  type ReadyMultiplayerDependencies } from "./ready-multiplayer";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const classStart = source.indexOf("class ql0 {");
assert.ok(classStart > 0);
function extract(start: string, next: string) {
  const first = source.indexOf(`  ${start}`, classStart);
  const last = source.indexOf(`  ${next}`, first + 2);
  assert.ok(first > classStart && last > first, start);
  return source.slice(first, last);
}
const originalMethods = [
  extract("async openMultiplayer()", "async multiplayerGarageOptions()"),
  extract("async multiplayerGarageOptions()", "applyMultiplayerGarage("),
  extract("applyMultiplayerGarage(", "async returnMultiplayerToSinglePlayer()"),
].join("\n");

type LobbyCallbacks = Record<string, any>;

function fixture(mode: "ready" | "garage", failure?: Error) {
  const events: unknown[] = [];
  let lobbyOptions!: LobbyCallbacks;
  let profile = { favoriteTracks: [{ themeId: "town", trackId: "a" }],
    initial: { kart: 1 }, equipment: { kart: 1 } };
  let selection = { trackId: "city", vehicleItemId: 1,
    vehiclePath: "kart/1", vehicleSystemKey: "kart-1",
    characterItemId: 2, characterPath: "character/2" };
  let readyOptions = { speed: 4, version: "国服", settingSpeed: 4 };
  let gameOptions = { autoReady: false, mainMenuBgmPath: "menu.ogg" };
  const noticeFactory = () => {
    events.push("notice.create");
    return { show: (...args: unknown[]) => events.push(["notice.show", ...args]) };
  };
  const lobby = {
    async open() {
      events.push("lobby.open");
      await lobbyOptions.prepareAudio();
      lobbyOptions.audioContext();
      lobbyOptions.onPageAudio("lobby");
      lobbyOptions.onRaceVisibility(true);
      lobbyOptions.speed(4, "国服");
      events.push(["autoReady", lobbyOptions.autoReadyEnabled()]);
      events.push(["toggle", lobbyOptions.toggleAutoReady()]);
      events.push(["favorite.ids", lobbyOptions.trackFavorites.ids("ordinary")]);
      events.push(["favorite.count", lobbyOptions.trackFavorites.count()]);
      lobbyOptions.trackFavorites.change({ themeId: "town", trackId: "b" }, true);
      lobbyOptions.onNotice("notice", "success", "body");
      lobbyOptions.onHover(); lobbyOptions.onStartActivate(); lobbyOptions.onActivate();
      if (!failure) lobbyOptions.onVisible();
      if (failure) throw failure;
    },
    dispose: () => events.push("lobby.dispose"),
    leaveRoom: async () => true,
    networkDiagnostics: () => [],
  };
  const Wl0 = function (this: unknown, options: LobbyCallbacks) {
    lobbyOptions = options;
    events.push("lobby.create");
    return lobby;
  } as unknown as new (options: LobbyCallbacks) => typeof lobby;
  const deps: ReadyMultiplayerDependencies = {
    sanitizeReadyOptions: options => ({ ...options, sanitized: true }),
    nickname: () => "Tester",
    version: id => `version:${id}`,
    initialEquipment: current => current.equipment,
    favoriteTrackIds: (favorites, scope) => [scope, favorites.length],
    createNotice: () => noticeFactory(),
    createLobby: options => new Wl0(options),
  };
  const Original = new Function("Hl0", "Wl0", "im", "Bt", "zw", "nT", "ds",
    `return class { ${originalMethods} };`)(
      deps.sanitizeReadyOptions, Wl0, deps.nickname, deps.version,
      deps.initialEquipment, deps.favoriteTrackIds,
      class { constructor(_root: unknown) { return noticeFactory(); } },
    ) as new () => Record<string, (...args: any[]) => any>;
  const released = new Original();
  const library = { timeAttackGarageCatalog: async () => {
    events.push("garage.catalog"); return ["kart"]; } };
  const garage = { freeze: () => events.push("garage.freeze"),
    unfreeze: () => events.push("garage.unfreeze"),
    dispose: () => events.push("garage.dispose") };
  const ready = { freeze: () => events.push("ready.freeze"),
    unfreeze: () => events.push("ready.unfreeze"),
    hide: () => events.push("ready.hide"), show: () => events.push("ready.show") };
  const controller = {
    host: {
      root: {} as HTMLElement, toonStageBinding: "binding", multiplayerRaceLoader: "loader",
      hud: { showDebugText: (text: string, kind: string) => events.push(["debug", text, kind]) },
      shell: { current: "MultiplayerLobby", modal: mode,
        enterMultiplayerLobby: (from: string) => { events.push(["shell.enter", from]); return true; },
        restoreGarageFromMultiplayerLobby: () => events.push("shell.restoreGarage"),
        leaveMultiplayerLobby: () => events.push("shell.leave") },
      getLibrary: () => library,
      getReadyOptions: () => readyOptions,
      setReadyOptions: (value: typeof readyOptions) => { readyOptions = value; events.push(["ready.options", value]); },
      getGameOptions: () => gameOptions,
      setGameOptions: (value: typeof gameOptions) => { gameOptions = value; events.push(["game.options", value]); },
      saveGameOptions: () => events.push("game.save"),
      getSelection: () => selection,
      setSelection: (value: typeof selection) => { selection = value; events.push(["selection", value]); },
      setVehicleTitle: (value: string) => events.push(["vehicle.title", value]),
      getProfile: () => profile,
      setProfile: (value: typeof profile) => { profile = value; events.push(["profile", value]); },
      saveProfile: () => events.push("profile.save"),
      getBgm: () => ({ prepareMultiplayer: async (_library: unknown, path: string) =>
        { events.push(["bgm.prepare", path]); },
      playMultiplayer: (page: string) => events.push(["bgm.play", page]) }),
      getAudioContext: () => ({ resume: async () => { events.push("audio.resume"); } }),
      getInterfaceAudio: () => ({ playHover: () => events.push("hover"),
        playStart: () => events.push("start"), playClick: () => events.push("click") }),
    },
    disposed: false, multiplayer: undefined as typeof lobby | undefined,
    activeGarage: mode === "garage" ? garage : undefined,
    activeTimeAttackReady: ready,
    activeSettings: { setRoomSpeed: (speed: number, version: string) =>
      events.push(["settings.speed", speed, version]) },
    activeTaskbar: { setVisible: (visible: boolean) => events.push(["taskbar", visible]) },
    activeWindowNotice: undefined,
    readyToonEnvironment: "environment",
    closeMultiplayer: () => events.push("multiplayer.close"),
    multiplayerGarageOptions: () => {},
    applyMultiplayerGarage: () => {},
    changeFavoriteTrack: (track: unknown, favorite: boolean) =>
      events.push(["favorite.change", track, favorite]),
    changeFavoriteItems: (items: unknown) => events.push(["favorite.items", items]),
    showGarageError: (error: unknown) => events.push(["garage.error", error]),
    enterTimeAttackReady: async () => { events.push("ready.enter"); },
  } as unknown as ReadyMultiplayerController;
  controller.multiplayerGarageOptions = () => Promise.resolve("options");
  controller.applyMultiplayerGarage = choice => events.push(["garage.apply", choice]);
  return { controller, released, deps, events, lobby, noticeFactory };
}

async function run(release: boolean, mode: "ready" | "garage", failure?: Error) {
  const item = fixture(mode, failure);
  const { controller, released, deps, events } = item;
  if (release) await released.openMultiplayer!.call(controller);
  else await openReadyMultiplayer(controller, deps);
  return { events, hasLobby: !!controller.multiplayer, hasGarage: !!controller.activeGarage };
}

test("multiplayer opening and callback wiring match release", async () => {
  assert.deepEqual(await run(false, "ready"), await run(true, "ready"));
});

test("garage account cancellation restores the garage like release", async () => {
  const failure = new Error("ACCOUNT_CANCELLED");
  assert.deepEqual(await run(false, "garage", failure),
    await run(true, "garage", failure));
});

test("multiplayer garage options and selection match release", async () => {
  async function compare(release: boolean) {
    const { controller, released, events, noticeFactory } = fixture("ready");
    const options = release
      ? await released.multiplayerGarageOptions!.call(controller)
      : await readyMultiplayerGarageOptions(controller, noticeFactory);
    options.onFavoriteChange(["star"]);
    options.onHover(); options.onActivate(); options.onInteraction();
    options.onNotice("notice", "success", "body");
    const choice = { kart: { path: "kart/3", itemId: 3, systemKey: "kart-3", title: "Kart 3" },
      character: { path: "character/4", itemId: 4 }, equipment: { kart: 3 } };
    if (release) released.applyMultiplayerGarage!.call(controller, choice);
    else applyReadyMultiplayerGarage(controller, choice);
    return { selection: controller.host.getSelection(),
      profile: controller.host.getProfile(), events,
      optionKeys: Object.keys(options) };
  }
  assert.deepEqual(await compare(false), await compare(true));
});
