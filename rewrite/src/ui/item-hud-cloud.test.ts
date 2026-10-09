import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";

import type { HudNode } from "./item-hud-assets";
import {
  ITEM_CLOUD_HOLD_MS, ItemHudCloud, aimCloudCamera,
  type CloudPlayBinding, type ItemHudCloudDependencies,
} from "./item-hud-cloud";
import { openMirrorLibrary } from "./item-hud-test-support";
import { giantControllerDuration } from "./giant-boost-hud-model";

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ relList: { supports: () => true } }),
};
const formats = await import("../generated/formats.js") as unknown as Record<string, any>;
const { U1 } = await import("../generated/library.js") as unknown as {
  U1: ItemHudCloudDependencies["findResource"];
};
const { collectItemHudPlayPanels, finalizeItemHudPlayPanels } = await import("./item-hud-play-panels");

const library = openMirrorLibrary(["item.rho"]);

function fixture() {
  const events: unknown[][] = [];
  let rendererUpdates: unknown[][] = [];
  const cameras: PerspectiveCamera[] = [];
  const deps: ItemHudCloudDependencies = {
    attribute: formats.T, parseBml: formats.s2, findResource: U1, parseModel: formats.y9,
    collectPlayPanels: collectItemHudPlayPanels as ItemHudCloudDependencies["collectPlayPanels"],
    finalizePlay: finalizeItemHudPlayPanels as ItemHudCloudDependencies["finalizePlay"],
    loadPlayScene: async binding => ({
      update: (time: number, camera: unknown) =>
        events.push(["scene-update", binding.name, time, cameras.indexOf(camera as PerspectiveCamera)]),
    }),
    createPlayRuntime: (binding: CloudPlayBinding, scene, tick) => ({
      play: (duration, source, now) => events.push(["play", binding.name, duration, source, now]),
      stop: () => events.push(["stop", binding.name]),
      update: time => (scene as { update(time: number): void }).update(time),
      dispose: () => events.push(["runtime-dispose", binding.name]),
    }),
    createRenderer: runtimes => ({
      update: (commands, time) => { rendererUpdates.push([commands, time]); },
      render: () => events.push(["render"]),
      dispose: () => { events.push(["renderer-dispose", runtimes.size]); },
    }),
    makeUi: formats.d5, layoutUi: formats.dn, materialize: formats.dt,
    controllerDuration: giantControllerDuration,
    createCamera: () => { const camera = new PerspectiveCamera(); cameras.push(camera); return camera; },
  };
  return { deps, events, cameras,
    updates: () => { const all = rendererUpdates; rendererUpdates = []; return all; } };
}

test("cloud2Effect 的三个 Play1SPanel 经发行版绑定为全屏遮挡", async () => {
  const { deps, events, updates, cameras } = fixture();
  const cloud = await ItemHudCloud.load(library, deps, 5);
  assert.deepEqual(cloud.bindings.map(binding => [binding.name, binding.sceneName]), [
    ["cloud2Effect_0", "무지개구름_화면가림"],
    ["cloud2Effect_1", "먹물구름_화면가림"],
    ["cloud2Effect_2", "요정구름_화면가림"],
  ]);
  // The 화면가림 models animate for 3000 ms.
  assert.deepEqual(cloud.durations, [3000, 3000, 3000]);
  for (const binding of cloud.bindings) {
    assert.equal(binding.stop, true);
    assert.equal(binding.clearZBefore, true);
    assert.equal(binding.initiallyVisible, false);
    assert.deepEqual(binding.defaultCameraPosition, [0, -70, 0]);
  }
  // Each scene updates with its own camera: at (0, -70, 0), looking at the origin, z up.
  assert.equal(cameras.length, 3);
  const camera = cameras[0]!;
  assert.deepEqual(camera.position.toArray(), [0, -70, 0]);
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  assert.ok(forward.distanceTo(new Vector3(0, 1, 0)) < 1e-6);
  assert.ok(new Vector3(0, 1, 0).applyQuaternion(camera.quaternion)
    .distanceTo(new Vector3(0, 0, 1)) < 1e-6);
  assert.ok(Math.abs(Math.tan(camera.fov * Math.PI / 360) * camera.aspect -
    Math.tan(75 * Math.PI / 360)) < 1e-9, "75° horizontal");
  assert.equal(camera.aspect, 16 / 9);
  assert.equal(camera.near, 1);
  assert.equal(camera.far, 1000);

  cloud.update(undefined, 10);
  assert.deepEqual(updates(), [[[], 10]]);
  cloud.render({}, 1600, 900);
  assert.deepEqual(events.splice(0), []);

  cloud.update({ opacity: 1, variant: 1 }, 20);
  assert.deepEqual(events.splice(0), [["play", "cloud2Effect_1", 3000, 0, 20]]);
  const [[commands, time]] = updates() as [[Array<Record<string, any>>, number]];
  assert.equal(time, 20);
  assert.equal(commands.length, 1);
  assert.equal(commands[0]!.kind, "play-1s-panel");
  assert.equal(commands[0]!.binding.name, "cloud2Effect_1");
  assert.deepEqual(commands[0]!.viewport, { x: 0, y: 0, width: 1600, height: 900,
    minDepth: 0, maxDepth: 1 });
  assert.deepEqual(commands[0]!.steps, ["clear-depth", "draw-scene", "clear-depth"]);
  cloud.render({}, 1600, 900);
  assert.deepEqual(events.splice(0), [["render"]]);

  // The scene plays in, then holds while the cloud lasts.
  const runtime = cloud.runtimes.get(cloud.bindings[1]!.node)!;
  runtime.update(520);
  runtime.update(20 + ITEM_CLOUD_HOLD_MS + 4000);
  assert.deepEqual(events.splice(0), [["scene-update", "cloud2Effect_1", 520, 1],
    ["scene-update", "cloud2Effect_1", 20 + ITEM_CLOUD_HOLD_MS, 1]]);

  // Same variant at a lower opacity keeps holding; opacity 0 releases it.
  cloud.update({ opacity: 0.4, variant: 1 }, 6000);
  assert.deepEqual(events.splice(0), []);
  cloud.update({ opacity: 0 }, 7000);
  assert.equal(cloud.active, 1);
  runtime.update(7500);
  assert.deepEqual(events.splice(0),
    [["scene-update", "cloud2Effect_1", 20 + ITEM_CLOUD_HOLD_MS + 500, 1]]);
  updates();
  // The fade out ends with the model's 3000 ms.
  cloud.update(undefined, 7000 + 3000 - ITEM_CLOUD_HOLD_MS - 1);
  assert.equal(cloud.active, 1);
  cloud.update(undefined, 7000 + 3000 - ITEM_CLOUD_HOLD_MS);
  assert.equal(cloud.active, undefined);
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_1"]]);
  assert.deepEqual(updates().at(-1), [[], 8500]);

  cloud.update({ opacity: 1 }, 9000);
  assert.deepEqual(events.splice(0), [["play", "cloud2Effect_0", 3000, 0, 9000]]);
  cloud.update({ opacity: 1, variant: 2 }, 9100);
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_0"],
    ["play", "cloud2Effect_2", 3000, 0, 9100]]);
  // A new cloud during the fade out starts over.
  cloud.update(undefined, 9200);
  cloud.update({ opacity: 1, variant: 2 }, 9300);
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_2"],
    ["play", "cloud2Effect_2", 3000, 0, 9300]]);
  cloud.reset();
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_2"]]);
  cloud.dispose();
  assert.deepEqual(events.splice(0), [["renderer-dispose", 3]]);
  cloud.update({ opacity: 1 }, 70);
  assert.deepEqual(events, []);
});

test("cloud2Effect 原文件缺 visible 且为 fullscreen：只在副本中补齐", async () => {
  const source = formats.s2(await U1(library, ["item/cloud2"], "cloud2Effect", ".bml").bytes()) as HudNode;
  const panel = source.children[0]!;
  assert.equal(formats.T(panel, "visible"), undefined);
  assert.equal(formats.T(panel, "windowRect"), "fullscreen");
  await assert.rejects(collectItemHudPlayPanels(source as never, async () =>
    ({ scene: {}, canonicalPath: "x" })), /windowRect=fullscreen 缺少/);
  const sized = { ...source, children: source.children.map(child => ({ ...child,
    attributes: child.attributes.map(entry => entry.name === "windowRect"
      ? { name: "windowRect", value: "0 0 1600 900" } : entry) })) };
  await assert.rejects(collectItemHudPlayPanels(sized as never, async () =>
    ({ scene: {}, canonicalPath: "x" })), /Play1SPanel\.visible/);
});

test("乌云相机默认值", () => {
  const camera = new PerspectiveCamera();
  aimCloudCamera(camera, { node: { name: "Play1SPanel", attributes: [], children: [] },
    name: "x", scene: {} });
  assert.deepEqual(camera.position.toArray(), [0, -70, 0]);
});
