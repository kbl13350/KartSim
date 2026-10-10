import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera } from "three";

import type { CloudPlayBinding, ItemHudCloudDependencies } from "./item-hud-cloud";
import { ItemHudSlotFlash } from "./item-hud-flash";
import { giantControllerDuration } from "./giant-boost-hud-model";
import { openMirrorLibrary } from "./item-hud-test-support";

(globalThis as { document?: unknown }).document ??= {
  createElement: () => ({ relList: { supports: () => true } }),
};
const formats = await import("../generated/formats.js") as unknown as Record<string, any>;
const { U1 } = await import("../generated/library.js") as unknown as {
  U1: ItemHudCloudDependencies["findResource"];
};
const { collectItemHudPlayPanels, finalizeItemHudPlayPanels } = await import("./item-hud-play-panels");

const library = openMirrorLibrary(["item.rho"]);

test("迅引擎开局道具：12thEngineEffect_Big 在当前槽上播放一次（1000 ms），每个新的开局道具一次", async () => {
  const events: unknown[][] = [];
  const updates: unknown[][] = [];
  const deps: ItemHudCloudDependencies = {
    attribute: formats.T, parseBml: formats.s2, findResource: U1, parseModel: formats.y9,
    collectPlayPanels: collectItemHudPlayPanels as ItemHudCloudDependencies["collectPlayPanels"],
    finalizePlay: finalizeItemHudPlayPanels as ItemHudCloudDependencies["finalizePlay"],
    loadPlayScene: async () => ({ update: () => {} }),
    createPlayRuntime: (binding: CloudPlayBinding) => ({
      play: (duration, source, now) => events.push(["play", binding.name, duration, source, now]),
      stop: () => events.push(["stop", binding.name]),
      update: () => {},
      dispose: () => {},
    }),
    createRenderer: () => ({
      update: (commands, time) => { updates.push([commands, time]); },
      render: () => events.push(["render"]),
      dispose: () => events.push(["renderer-dispose"]),
    }),
    makeUi: formats.d5, layoutUi: formats.dn, materialize: formats.dt,
    controllerDuration: giantControllerDuration,
    createCamera: () => new PerspectiveCamera(),
  };
  // The current slot of a 3-slot row: 24 + 2 × 82 = 188 … 280.
  const rect = { left: 188, top: 24, right: 280, bottom: 116 };
  const flash = await ItemHudSlotFlash.load(library, deps, rect);
  assert.deepEqual([flash.binding.name, flash.binding.sceneName, flash.durationMs], ["12thEngine", "차져슬롯이펙트_big", 1000]);
  assert.deepEqual(flash.binding.defaultCameraPosition, [0, -5.25, 0]);
  assert.equal(flash.binding.stop, true, "played on demand");
  flash.update(undefined, 10);
  assert.deepEqual(updates.at(-1), [[], 10]);
  flash.update(500, 500);
  assert.deepEqual(events.splice(0), [["play", "12thEngine", 1000, 0, 500]]);
  const [commands] = updates.at(-1) as [Array<Record<string, any>>];
  assert.equal(commands.length, 1);
  assert.deepEqual(commands[0]!.viewport, { x: 188, y: 24, width: 92, height: 92, minDepth: 0, maxDepth: 1 });
  flash.render({}, 1600, 900);
  assert.deepEqual(events.splice(0), [["render"]]);
  // The same start item never flashes twice; it ends after its 1000 ms.
  flash.update(500, 1499);
  assert.deepEqual(events.splice(0), []);
  flash.update(500, 1500);
  assert.deepEqual(events.splice(0), [["stop", "12thEngine"]]);
  assert.deepEqual(updates.at(-1), [[], 1500]);
  flash.update(500, 1600);
  assert.deepEqual(events.splice(0), []);
  // A flash time already past (a late state) does not play.
  flash.update(3000, 4500);
  assert.deepEqual(events.splice(0), []);
  flash.reset();
  flash.dispose();
  assert.deepEqual(events.splice(0), [["renderer-dispose"]]);
});
