import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { closeReadySettings, confirmReadySettings, handleReadyShortcut,
  openReadySettings, previewReadySettings, publishReadyRaceSpeed,
  releaseReadyToonEnvironment, saveReadyGameOptions,
  showReadyTrackSelectError, type ReadySettingsController,
  type ReadySettingsDependencies } from "./ready-settings";

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
  extract("async openSettings()", "previewSettings("),
  extract("previewSettings(", "confirmSettings("),
  extract("confirmSettings(", "publishRaceSpeedChannel("),
  extract("publishRaceSpeedChannel(", "saveGameOptions("),
  extract("saveGameOptions(", "closeSettings("),
  extract("closeSettings(", "showTrackSelectError("),
  extract("showTrackSelectError(", "handleReadyShortcut("),
  extract("handleReadyShortcut(", "releaseReadyToonEnvironment("),
  source.slice(source.indexOf("  releaseReadyToonEnvironment(", classStart),
    source.indexOf("\n}\n", source.indexOf("  releaseReadyToonEnvironment(", classStart))),
].join("\n");

function fixture(multiplayer = false) {
  const events: unknown[] = [];
  let loadedOptions!: Record<string, any>;
  let gameOptions = { mainMenuBgmPath: "old.ogg", enableRoadSound: true };
  let readyOptions = { version: "国服", settingSpeed: 4 };
  const view = { dispose: () => events.push("view.dispose"),
    setRoomSpeed: (speed: number, version: string) =>
      events.push(["room.speed", speed, version]) };
  const lobby = multiplayer ? {
    hasModal: false, isInRoom: false,
    refreshAutoReady: () => events.push("autoReady.refresh"),
    handleRoomShortcut: (_event: KeyboardEvent) => false,
    quickJoinShortcut: () => events.push("quick.join"),
  } : undefined;
  const deps: ReadySettingsDependencies = {
    loadSettings: async options => { loadedOptions = options;
      events.push("settings.load"); return view; },
    speedLabel: options => options.settingSpeed as number,
    chooseSpeed: (_version, speed) => speed,
    defaultSpeed: 7,
    defaultVersion: "国服",
    persistGameOptions: options => events.push(["persist", options]),
  };
  const Original = new Function("oy", "Ue", "E4", "ze", "$v", "ua0",
    `return class { ${originalMethods} };`)(
      { load: deps.loadSettings }, deps.speedLabel, deps.defaultSpeed,
      deps.defaultVersion, deps.chooseSpeed, deps.persistGameOptions,
    ) as new () => Record<string, (...args: any[]) => any>;
  const released = new Original();
  const environment = { dispose: () => events.push("environment.dispose") };
  const controller = {
    host: {
      root: {} as HTMLElement,
      hud: { showDebugText: (message: string, level: string) =>
        events.push(["debug", message, level]) },
      shell: { modal: undefined as string | undefined,
        openModal: (name: string) => { events.push(["modal.open", name]);
          controller.host.shell.modal = name; return true; },
        closeModal: (name: string) => { events.push(["modal.close", name]);
          controller.host.shell.modal = undefined; } },
      toonStageBinding: { retain: (_env: unknown) => events.push("environment.retain") },
      getLibrary: () => "library",
      getAudioContext: () => ({ resume: async () => { events.push("audio.resume"); } }),
      getInterfaceAudio: () => ({ playClick: () => events.push("click") }),
      getBgm: () => ({ prepareMultiplayer: async (_library: unknown, path: string) => {
        events.push(["bgm.prepare", path]); },
      playMultiplayer: (page: string) => events.push(["bgm.play", page]) }),
      getGameOptions: () => gameOptions,
      setGameOptions: (value: typeof gameOptions) => { gameOptions = value; events.push(["game.options", value]); },
      saveGameOptions: () => events.push("game.save"),
      applyInputKeyMap: (_options: unknown) => events.push("input.map"),
      applyAudioOptions: (value: unknown) => events.push(["audio.options", value]),
      getReadyOptions: () => readyOptions,
      setReadyOptions: (value: typeof readyOptions) => { readyOptions = value; events.push(["ready.options", value]); },
      previewSettings: (_options: unknown) => events.push("host.preview"),
      confirmSettings: (_options: unknown, _speed: number, _version: string) =>
        events.push("host.confirm"),
      closeSettings: () => events.push("host.close"),
    },
    disposed: false, settingsOpening: false, multiplayer: lobby,
    activeSettings: undefined,
    activeGarage: undefined,
    activeTimeAttackReady: { setSpeedChannel: (channel: unknown) =>
      events.push(["speed.channel", channel]),
      activateTrainingShortcut: () => events.push("training") },
    activeWindowNotice: { dispose: () => events.push("notice.dispose") },
    readyToonEnvironment: environment,
    readyStageContext: () => ({ library: "library" }),
    readyModalBusy: () => false,
    publishRaceSpeedChannel: () => events.push("publish.speed"),
    returnGarageToReady: () => events.push("garage.return"),
    closeSettings: () => events.push("controller.close"),
    showTrackSelectError: (error: unknown) => events.push(["track.error", error]),
  } as unknown as ReadySettingsController;
  return { controller, released, deps, events, view,
    getLoadOptions: () => loadedOptions,
    getState: () => ({ gameOptions, readyOptions }) };
}

test("settings opening and callback wiring match release in Ready and lobby", async () => {
  async function run(release: boolean, multiplayer: boolean) {
    const item = fixture(multiplayer);
    const { controller, released, deps, events } = item;
    if (release) await released.openSettings!.call(controller);
    else await openReadySettings(controller, deps);
    const options = item.getLoadOptions();
    options.onPreview({ mainMenuBgmPath: "new.ogg" });
    options.onConfirm({ mainMenuBgmPath: "new.ogg" }, 7, "国服");
    options.onCancel(); options.onActivate();
    return { events, initialSpeed: options.initialSpeed,
      initialVersion: options.initialVersion,
      speedLocked: options.speedLocked,
      active: controller.activeSettings === item.view,
      opening: controller.settingsOpening };
  }
  for (const multiplayer of [false, true])
    assert.deepEqual(await run(false, multiplayer), await run(true, multiplayer));
});

test("settings preview and single-player commit match release", () => {
  function run(release: boolean) {
    const item = fixture();
    const { controller, released, deps, events } = item;
    const next = { mainMenuBgmPath: "new.ogg", enableRoadSound: false };
    if (release) {
      released.previewSettings!.call(controller, next);
      released.confirmSettings!.call(controller, next, 7, "国服");
      released.publishRaceSpeedChannel!.call(controller);
      released.saveGameOptions!.call(controller);
      released.showTrackSelectError!.call(controller, new Error("bad"));
    } else {
      previewReadySettings(controller, next);
      confirmReadySettings(controller, next, 7, "国服", deps);
      publishReadyRaceSpeed(controller, deps);
      saveReadyGameOptions(controller, deps.persistGameOptions);
      showReadyTrackSelectError(controller, new Error("bad"));
    }
    return { events, ...item.getState() };
  }
  assert.deepEqual(run(false), run(true));
});

test("lobby settings music refresh, close, shortcut and environment release match release", async () => {
  async function run(release: boolean) {
    const item = fixture(true);
    const { controller, released, deps, events, view } = item;
    controller.activeSettings = view;
    const next = { mainMenuBgmPath: "new.ogg", enableRoadSound: false };
    if (release) released.confirmSettings!.call(controller, next, 7, "国服");
    else confirmReadySettings(controller, next, 7, "国服", deps);
    await Promise.resolve();
    const event = { code: "F5", preventDefault: () => { events.push("prevent"); } } as unknown as KeyboardEvent;
    if (release) {
      released.closeSettings!.call(controller);
      released.handleReadyShortcut!.call(controller, event);
      released.releaseReadyToonEnvironment!.call(controller);
    } else {
      closeReadySettings(controller);
      handleReadyShortcut(controller, event);
      releaseReadyToonEnvironment(controller);
    }
    return { events, active: controller.activeSettings,
      notice: controller.activeWindowNotice,
      environment: controller.readyToonEnvironment };
  }
  assert.deepEqual(await run(false), await run(true));
});

test("while the shop is open or loading, Ready and room shortcuts do nothing behind it", () => {
  const key = (code: string, events: unknown[]) => ({ code, repeat: false,
    preventDefault: () => { events.push(["prevent", code]); } }) as unknown as KeyboardEvent;
  for (const multiplayer of [false, true]) {
    for (const shop of ["open", "opening"] as const) {
      const { controller, events } = fixture(multiplayer);
      let roomShortcuts = 0;
      if (controller.multiplayer) {
        controller.multiplayer.handleRoomShortcut = () => { roomShortcuts++; return true; };
      }
      if (shop === "open") controller.activeShop = { close() {} };
      else controller.shopOpening = true;
      // Handled (true) so the application's option toggles (F6–F8) and Escape-to-pause skip it too.
      assert.equal(handleReadyShortcut(controller, key("F5", events)), true);
      assert.equal(handleReadyShortcut(controller, key("KeyP", events)), true);
      assert.equal(handleReadyShortcut(controller, key("F6", events)), true);
      const blocked = { roomShortcuts, events: [...events] };
      // No training race, quick join or room ready; F5 does not reload the page either.
      assert.deepEqual(blocked, { roomShortcuts: 0, events: [["prevent", "F5"]] });
      controller.activeShop = undefined;
      controller.shopOpening = false;
      assert.equal(handleReadyShortcut(controller, key("F5", events)), true);
      assert.ok(multiplayer ? roomShortcuts > 0 : events.includes("training"));
    }
  }
});
