import assert from "node:assert/strict";
import test from "node:test";

import type { HudNode } from "./item-hud-assets";
import { ItemHudCloud, type CloudPlayBinding, type ItemHudCloudDependencies } from "./item-hud-cloud";
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
  const deps: ItemHudCloudDependencies = {
    attribute: formats.T, parseBml: formats.s2, findResource: U1, parseModel: formats.y9,
    collectPlayPanels: collectItemHudPlayPanels as ItemHudCloudDependencies["collectPlayPanels"],
    finalizePlay: finalizeItemHudPlayPanels as ItemHudCloudDependencies["finalizePlay"],
    loadPlayScene: async binding => ({ scene: binding.name }),
    createPlayRuntime: (binding: CloudPlayBinding, _scene, tick) => ({
      play: (duration, source, now) => events.push(["play", binding.name, duration, source, now]),
      stop: () => events.push(["stop", binding.name]),
      update: () => {},
      dispose: () => events.push(["runtime-dispose", binding.name]),
    }),
    createRenderer: runtimes => ({
      update: (commands, time) => { rendererUpdates.push([commands, time]); },
      render: () => events.push(["render"]),
      dispose: () => { events.push(["renderer-dispose", runtimes.size]); },
    }),
    makeUi: formats.d5, layoutUi: formats.dn, materialize: formats.dt,
    controllerDuration: giantControllerDuration,
  };
  return { deps, events, updates: () => { const all = rendererUpdates; rendererUpdates = []; return all; } };
}

test("cloud2Effect 的三个 Play1SPanel 经发行版绑定为全屏遮挡", async () => {
  const { deps, events, updates } = fixture();
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

  cloud.update(undefined, 10);
  assert.deepEqual(updates(), [[[], 10]]);
  cloud.render({}, 1600, 900);
  assert.deepEqual(events, []);

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

  // Same variant: keeps playing; a fade to 0 hides and stops it.
  cloud.update({ opacity: 0.4, variant: 1 }, 30);
  assert.deepEqual(events.splice(0), []);
  cloud.update({ opacity: 0, variant: 1 }, 40);
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_1"]]);
  cloud.update({ opacity: 1 }, 50);
  assert.deepEqual(events.splice(0), [["play", "cloud2Effect_0", 3000, 0, 50]]);
  cloud.update({ opacity: 1, variant: 2 }, 60);
  assert.deepEqual(events.splice(0), [["stop", "cloud2Effect_0"], ["play", "cloud2Effect_2", 3000, 0, 60]]);
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
