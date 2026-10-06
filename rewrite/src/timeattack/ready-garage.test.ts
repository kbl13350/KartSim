import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { applyImmediateReadyGarageSelection, openReadyGarage, openReadyGarageX,
  returnReadyGarage, selectReadyGarage, showReadyGarageError,
  type ReadyGarageController, type ReadyGarageDependencies } from "./ready-garage";

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
  extract("async openGarage(", "async selectReadyGarage("),
  extract("async selectReadyGarage(", "async openGarageX("),
  extract("async openGarageX(", "returnGarageToReady("),
  extract("returnGarageToReady(", "applyImmediateGarageSelection("),
  extract("applyImmediateGarageSelection(", "showGarageError("),
  extract("showGarageError(", "async openSettings("),
].join("\n");

const choice = {
  kart: { path: "kart/3", itemId: 3, systemKey: "kart-3", title: "Kart 3" },
  character: { path: "character/4", itemId: 4 },
  equipment: { kart: 3 }, garage: { page: 2 },
};

function fixture(failReady = false) {
  const events: unknown[] = [];
  let viewOptions!: Record<string, any>;
  let selection = { trackId: "city", vehiclePath: "kart/1", vehicleItemId: 1,
    vehicleSystemKey: "kart-1", characterPath: "character/2", characterItemId: 2 };
  let options = { speed: 4, version: "国服" };
  let profile = { equipment: { kart: 1 }, garage: { page: 1 } };
  let title = "Kart 1";
  const view = { show: () => events.push("view.show"),
    dispose: () => events.push("view.dispose") };
  const noticeFactory = () => ({ show: (...args: unknown[]) =>
    events.push(["notice.show", ...args]) });
  const deps: ReadyGarageDependencies = {
    loadGarage: async value => { events.push("garage.load"); viewOptions = value; return view; },
    loadGarageX: async value => { events.push("garageX.load"); viewOptions = value; return view; },
    createNotice: () => { events.push("notice.create"); return noticeFactory(); },
    speed: () => 4,
    defaultVersion: "国服",
  };
  const Original = new Function("C7", "El", "y6", "ze", "ds",
    `return class { ${originalMethods} };`)(
      { load: deps.loadGarage },
      async () => ({ GarageXView: { load: deps.loadGarageX } }),
      deps.speed, deps.defaultVersion,
      class { constructor(_root: unknown) { events.push("notice.create");
        return noticeFactory(); } },
    ) as new () => Record<string, (...args: any[]) => any>;
  const released = new Original();
  const ready = { freeze: () => events.push("ready.freeze"),
    unfreeze: () => events.push("ready.unfreeze"),
    dispose: () => events.push("ready.dispose") };
  const controller = {
    host: {
      root: {} as HTMLElement, toonStageBinding: "binding",
      hud: { showDebugText: (message: string, level: string) =>
        events.push(["debug", message, level]) },
      shell: { current: "Ready", modal: undefined as string | undefined,
        openModal: (name: string) => { events.push(["modal.open", name]);
          controller.host.shell.modal = name; return true; },
        closeModal: (name: string) => { events.push(["modal.close", name]);
          controller.host.shell.modal = undefined; } },
      getLibrary: () => ({ timeAttackGarageCatalog: async () => {
        events.push("catalog"); return ["kart"]; } }),
      getSelection: () => selection,
      setSelection: (value: typeof selection) => { selection = value; events.push(["selection", value]); },
      getReadyOptions: () => options,
      setReadyOptions: (value: typeof options) => { options = value; events.push(["options", value]); },
      getVehicleTitle: () => title,
      setVehicleTitle: (value: string) => { title = value; events.push(["title", value]); },
      getProfile: () => profile,
      setProfile: (value: typeof profile) => { profile = value; events.push(["profile", value]); },
      saveProfile: () => events.push("profile.save"),
      enterTimeAttackReady: async (_profile: unknown) => {
        events.push("host.ready.enter"); if (failReady) throw new Error("load failed"); },
      selectReadyGarage: (_selection: unknown, _options: unknown, _choice: unknown) =>
        events.push("host.garage.select"),
      getInterfaceAudio: () => ({ playHover: () => events.push("hover"),
        playClick: () => events.push("click") }),
      getAudioContext: () => ({ resume: async () => { events.push("audio.resume"); } }),
      getBgm: () => ({ playGarage: () => events.push("bgm.garage") }),
    },
    disposed: false, multiplayer: undefined,
    activeSettings: undefined, settingsOpening: false,
    readyToonEnvironment: { dispose: () => events.push("environment.dispose") },
    activeTimeAttackReady: ready,
    activeTaskbar: "taskbar", activeGarage: undefined,
    activeWindowNotice: undefined,
    readyModalBusy: () => false,
    closeMultiplayer: () => {},
    enterTimeAttackReady: async () => { events.push("controller.ready.enter"); },
    showGarageError: (error: unknown) => events.push(["garage.error", error instanceof Error ? error.message : error]),
    changeFavoriteItems: (items: unknown) => events.push(["favorite.items", items]),
    applyImmediateGarageSelection: (_selection: unknown, _options: unknown, _choice: unknown) =>
      events.push("controller.immediate.select"),
  } as unknown as ReadyGarageController;
  return { controller, released, deps, events,
    getViewOptions: () => viewOptions,
    getState: () => ({ selection, options, profile, title }) };
}

test("classic garage callbacks and close sequence match release", async () => {
  async function run(release: boolean) {
    const item = fixture();
    const { controller, released, deps, events } = item;
    const selection = controller.host.getSelection()!;
    const options = controller.host.getReadyOptions();
    if (release) await released.openGarage!.call(controller, selection, options);
    else await openReadyGarage(controller, selection, options, deps);
    const callbacks = item.getViewOptions();
    callbacks.onFavoriteChange(["star"]);
    callbacks.onHover(); callbacks.onActivate(); callbacks.onInteraction();
    callbacks.onNotice("message", "success", "body");
    callbacks.onConfirm(choice);
    return events;
  }
  assert.deepEqual(await run(false), await run(true));
});

test("classic selection rollback and immediate garage selection match release", async () => {
  async function run(release: boolean) {
    const item = fixture(true);
    const { controller, released, events } = item;
    const selection = controller.host.getSelection()!;
    const options = controller.host.getReadyOptions();
    if (release) await released.selectReadyGarage!.call(controller, selection, options, choice);
    else await selectReadyGarage(controller, selection, options, choice);
    if (release) released.applyImmediateGarageSelection!.call(controller, selection, options, choice);
    else applyImmediateReadyGarageSelection(controller, selection, options, choice);
    if (release) released.showGarageError!.call(controller, new Error("bad"));
    else showReadyGarageError(controller, new Error("bad"));
    return { events, ...item.getState() };
  }
  assert.deepEqual(await run(false), await run(true));
});

test("full-screen garage loads and returns to Ready like release", async () => {
  async function run(release: boolean) {
    const item = fixture();
    const { controller, released, deps, events } = item;
    const selection = controller.host.getSelection()!;
    const options = controller.host.getReadyOptions();
    if (release) await released.openGarageX!.call(controller, selection, options);
    else await openReadyGarageX(controller, selection, options, deps);
    const callbacks = item.getViewOptions();
    callbacks.onChange(choice);
    callbacks.onNotice("message", "success", "body");
    if (release) released.returnGarageToReady!.call(controller);
    else returnReadyGarage(controller);
    return events;
  }
  assert.deepEqual(await run(false), await run(true));
});
