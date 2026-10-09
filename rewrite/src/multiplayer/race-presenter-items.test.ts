import assert from "node:assert/strict";
import test from "node:test";

import { ItemIdx } from "../item/item-catalog";
import { FakePhysics, FakePresenter, testItemCatalog } from "../item/item-race-test-support";
import { createActiveItemRace, serverToLocalMs, type ActiveItemRaceHost } from "./item-race-wiring";
import { updateRacePresenterCamera, type RacePresenterCameraHost } from "./race-presenter-camera";
import { feedRacePresenterItemHud, updateRacePresenterItems } from "./race-presenter-items";

test("cubes, hazards and the item presenter update after the track, then the HUD gets the state", () => {
  const calls: unknown[][] = [];
  const camera = { id: "camera" };
  const host = {
    camera,
    assets: {
      itemCubes: { update: (...args: unknown[]) => calls.push(["cubes", ...args]) },
      itemHazards: { update: (...args: unknown[]) => calls.push(["hazards", ...args]) },
    },
    runtime: { itemRace: {
      present: (input: unknown) => calls.push(["present", input]),
      hudState: (nowMs: number) => ({ marker: nowMs }) as never,
    } },
    hud: { setItemState: (state: unknown) => calls.push(["hud", state]) },
  };
  updateRacePresenterItems(host, 1500, 1600, 900);
  feedRacePresenterItemHud(host, 1500);
  assert.deepEqual(calls, [
    ["cubes", 1500, camera, 1600, 900],
    ["hazards", 1500],
    ["present", { nowMs: 1500, camera, width: 1600, height: 900 }],
    ["hud", { marker: 1500 }],
  ]);
  // Other races carry none of it.
  assert.doesNotThrow(() => {
    updateRacePresenterItems({ camera, assets: {}, runtime: {} }, 1, 1, 1);
    feedRacePresenterItemHud({ runtime: {}, hud: {} }, 1);
  });
});

test("a spinning or launched kart keeps the chase camera on its pre-hit basis", () => {
  const inputs: Array<Record<string, unknown>> = [];
  const basis = { right: { x: 9, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 9 }, up: { x: 0, y: 9, z: 0 } };
  const body = { position: { x: 1, y: 2, z: 3 }, right: { x: 1, y: 0, z: 0 },
    forward: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: 1 } };
  const run = (cameraBasis?: typeof basis) => {
    const host = {
      warpCameraFrozen: false, cameraMode: "drive", camera: {}, playerId: "self",
      assets: { map: { readyCamera: { apply() {} } }, participants: [] },
      runtime: {
        giantEffectsEnded: false,
        local: {
          physics: { body, itemEffects: { cameraBasis },
            driveCameraRuntime: () => ({ eventScaleSecondary: { z: 1 } }) },
          track: { currentRouteSurface: () => "road" },
          lifecycle: { state: "Racing" },
          warpNext: { fairyFovFactor: () => undefined },
        },
        remotes: { giant: () => undefined, copyWebPose: () => undefined },
      },
      cameraShake: { setGiantGate() {}, update: () => ({ x: 0, y: 0, z: 0 }) },
      cameraWave: { update() {} },
      drive: { update: (input: Record<string, unknown>) => { inputs.push(input);
        return { horizontalFovDegrees: 80, far: 900 }; }, apply() {} },
      surround: { update() {}, apply() {} },
      applyWarpCamera() {},
    };
    updateRacePresenterCamera(host as unknown as RacePresenterCameraHost, 100, "Racing");
    return inputs.at(-1)!.body as Record<string, unknown>;
  };
  assert.deepEqual(run(basis), { ...body, ...basis, position: { x: 1, y: 2, z: 3 } });
  assert.deepEqual(run(undefined), { ...body, position: { x: 1, y: 2, z: 3 } });
});

function wiringHost(kind = "item"): ActiveItemRaceHost & { listeners: unknown[] } {
  const listeners: unknown[] = [];
  return {
    listeners,
    assets: { drivingMode: { kind, team: true }, itemCatalog: testItemCatalog(),
      itemPresenter: new FakePresenter(),
      itemHazards: { position: id => ({ x: id, y: 0, z: 0 }) } },
    connection: { playerId: "self", sendItem: async () => ({}),
      subscribeItem: listener => { listeners.push(listener); return () => {}; } },
    local: Object.assign({
      physics: new FakePhysics(),
      itemRacing: () => true, itemSuspended: () => false,
      track: { sampleRoute: (_vehicle: unknown, lookahead: number) =>
        ({ sampled: true, point: { x: 0, y: 0, z: lookahead } }) },
    }),
    remotes: {
      copyWebPose: id => id === "rival" || id === "done" ? { position: { x: 0, y: 0, z: 5 },
        right: { x: 1, y: 0, z: 0 }, forward: { x: 0, y: 0, z: 1 }, up: { x: 0, y: 1, z: 0 } }
        : undefined,
      raceProgress: id => id === "done" ? { finishElapsedMs: 1 } : {},
      hasDeparted: id => id === "gone",
    },
  };
}

test("the item race controller joins the local owner with the race's clock and roster", () => {
  assert.equal(serverToLocalMs(5000, { offsetMs: 1200 }), 3800);
  assert.equal(serverToLocalMs(5000, undefined), undefined);
  assert.equal(createActiveItemRace(wiringHost("ordinary"), { roster: [] }, () => 0), undefined);
  const missing = wiringHost();
  delete missing.connection.sendItem;
  assert.throws(() => createActiveItemRace(missing, { roster: [] }, () => 0), /道具赛通道/);
  const noCatalog = wiringHost();
  delete noCatalog.assets.itemCatalog;
  assert.throws(() => createActiveItemRace(noCatalog, { roster: [] }, () => 0), /道具目录/);

  const host = wiringHost();
  const roster = [{ playerId: "self", name: "我", team: 1 as const },
    { playerId: "rival", name: "对手", team: 2 as const }, { playerId: "done", team: 2 as const },
    { playerId: "gone", name: "离开", team: 2 as const }];
  const controller = createActiveItemRace(host, { roster }, () => 42)!;
  assert.ok(controller);
  assert.equal(host.local.items, controller);
  assert.equal(host.local.itemRace, controller);
  assert.equal(host.listeners.length, 1);
  const options = controller.options;
  assert.equal(options.teamRace, true);
  assert.deepEqual(options.roster[2], { playerId: "done", name: "", team: 2 });
  assert.equal(options.toLocalMs(5000), undefined, "before the clock is bound");
  host.mapping = { offsetMs: 1000 };
  assert.equal(options.toLocalMs(5000), 4000);
  assert.deepEqual(options.local.routePointAhead!(70), { x: 0, y: 0, z: 70 });
  assert.equal(options.remotes.racing("rival"), true);
  assert.equal(options.remotes.racing("done"), false, "finished");
  assert.equal(options.remotes.racing("gone"), false, "departed");
  assert.deepEqual(options.hazardPosition!(7), { x: 7, y: 0, z: 0 });
  assert.equal(options.now(), 42);
  assert.equal(options.catalog.get(ItemIdx.rocket)?.behaviour.effect, "launch");
});
