import assert from "node:assert/strict";
import test from "node:test";
import { defaultLocalProfile } from "../ui/local-profile";
import { closeReadyHouse, saveReadyHouseProfile, type ReadyHouseController } from "./ready-house";

test("My Room save rolls back memory when persistence fails", () => {
  const original = defaultLocalProfile();
  let current = original;
  let refreshed = false;
  const controller = {
    host: {
      getProfile: () => current,
      setProfile: (next: typeof original) => { current = next; },
      saveProfile: () => { throw new Error("disk full"); },
    },
    activeHouse: { refresh: () => { refreshed = true; } },
  } as unknown as ReadyHouseController;
  const next = { ...original, myRoom: { ...original.myRoom, displayName: "新小屋" } };
  assert.throws(() => saveReadyHouseProfile(controller, next), /disk full/);
  assert.equal(current, original);
  assert.equal(refreshed, false);
});

test("inventory favorite saves without replacing an unsaved My Room draft", () => {
  const original = defaultLocalProfile();
  let current = original;
  let saved = 0, roomRefreshes = 0;
  const controller = {
    host: {
      getProfile: () => current,
      setProfile: (next: typeof original) => { current = next; },
      saveProfile: () => { saved++; },
    },
    activeHouse: { refresh: () => { roomRefreshes++; } },
  } as unknown as ReadyHouseController;
  const next = { ...original, favoriteItems: [{ category: 3, itemId: 123, serial: 0 }] };
  saveReadyHouseProfile(controller, next);
  assert.equal(current, next);
  assert.equal(saved, 1);
  assert.equal(roomRefreshes, 0);
});

test("closing My Room releases both overlays and restores Ready controls", () => {
  const events: string[] = [];
  const controller = {
    disposed: false,
    host: { shell: { modal: "house", current: "ReadyHouse",
      closeModal: () => { events.push("shell.close"); controller.host.shell.modal = undefined;
        controller.host.shell.current = "Ready"; } } },
    activeHouse: { dispose: () => events.push("house.dispose") },
    activeHouseGarage: { dispose: () => events.push("garage.dispose") },
    houseTaskbarRelease: () => events.push("taskbar.release"),
    activeTimeAttackReady: { unfreeze: () => events.push("ready.unfreeze") },
    activeTaskbar: { setVisible: (visible: boolean) => events.push(`taskbar:${visible}`) },
  } as unknown as ReadyHouseController;
  closeReadyHouse(controller);
  assert.deepEqual(events, ["taskbar.release", "garage.dispose", "house.dispose", "shell.close",
    "ready.unfreeze", "taskbar:true"]);
  assert.equal(controller.activeHouse, undefined);
  assert.equal(controller.activeHouseGarage, undefined);
});
