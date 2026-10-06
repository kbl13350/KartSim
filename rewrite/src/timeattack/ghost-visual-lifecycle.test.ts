import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  attachGhostVisualToScene, disposeGhostVisual, seedGhostVisualStart,
  setGhostVisualEffects, setGhostVisualTrails,
  type GhostVisualLifecycleHost,
} from "./ghost-visual-lifecycle";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class Xd0 {");
const end = release.indexOf("\nconst J_", start);
assert.ok(start >= 0 && end > start);

type Visual = GhostVisualLifecycleHost & {
  seedStart(position: { x: number; y: number; z: number },
    right: { x: number; y: number; z: number },
    forward: { x: number; y: number; z: number },
    up: { x: number; y: number; z: number }): void;
  setEffects(effects: { dispose(): void }): void;
  setTrails(trails: { object: unknown; dispose(): void }, vehicle: unknown): void;
  attachToScene(scene: { add(child: unknown): void }): void;
  dispose(): void;
};

function makeVisual(rewritten: boolean, populated: boolean) {
  const events: unknown[][] = [];
  const releaseObject = (object: unknown) => events.push(["release-object", object]);
  const Original = new Function("u5", `${release.slice(start, end)}\nreturn Xd0;`)(
    releaseObject) as new () => Visual;
  const visual = Object.create(Original.prototype) as Visual;
  const vector = (name: string) => ({
    x: 0, y: 0, z: 0,
    set(x: number, y: number, z: number) {
      events.push([name, x, y, z]);
      this.x = x; this.y = y; this.z = z;
    },
  });
  const rootPosition = vector("root-position");
  visual.basisRight = vector("right");
  visual.basisUp = vector("up");
  visual.basisForward = vector("forward");
  visual.orientationMatrix = {
    makeBasis(right, up, forward) {
      events.push(["basis", right === visual.basisRight,
        up === visual.basisUp, forward === visual.basisForward]);
    },
  };
  visual.root = {
    position: rootPosition,
    quaternion: { setFromRotationMatrix(matrix) {
      events.push(["quaternion", matrix === visual.orientationMatrix]);
    } },
    add(child) { events.push(["root-add", child]); },
    clear() { events.push(["root-clear"]); },
    removeFromParent() { events.push(["root-remove"]); },
  };
  visual.modelMount = {
    add(child) { events.push(["mount-add", child]); },
    clear() { events.push(["mount-clear"]); },
  };
  visual.trailState = 5;
  visual.attachmentNodes = ["balloon-socket"];
  visual.accessories = populated ? [
    { render: { dispose() { events.push(["accessory-dispose", 1]); } } },
    { render: { dispose() { events.push(["accessory-dispose", 2]); } } },
  ] : [];
  if (populated) {
    visual.balloon = { dispose() { events.push(["balloon-dispose"]); } };
    visual.imported = {
      object: "imported-mesh",
      renderScene: { dispose() { events.push(["render-scene-dispose"]); } },
    };
    visual.character = { dispose() { events.push(["character-dispose"]); } };
    visual.linkedPresentation = { linked: true };
    visual.animation = { playing: true };
    visual.visual = { visual: true };
  }
  if (rewritten) Object.assign(visual, {
    seedStart(position: { x: number; y: number; z: number },
      right: { x: number; y: number; z: number },
      forward: { x: number; y: number; z: number },
      up: { x: number; y: number; z: number }) {
      return seedGhostVisualStart(visual, position, right, forward, up);
    },
    setEffects(effects: { dispose(): void }) {
      return setGhostVisualEffects(visual, effects);
    },
    setTrails(trails: { object: unknown; dispose(): void }, vehicle: unknown) {
      return setGhostVisualTrails(visual, trails, vehicle);
    },
    attachToScene(scene: { add(child: unknown): void }) {
      return attachGhostVisualToScene(visual, scene as never);
    },
    dispose() { return disposeGhostVisual(visual, releaseObject); },
  });
  return { visual, events };
}

test("Ghost start orientation and scene attachment match release", () => {
  const inspect = (rewritten: boolean, withTrails: boolean) => {
    const { visual, events } = makeVisual(rewritten, false);
    visual.seedStart({ x: 1, y: 2, z: 3 },
      { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 });
    visual.setEffects({ dispose() { events.push(["effect-dispose"]); } });
    if (withTrails) visual.setTrails({ object: "trail-mesh",
      dispose() { events.push(["trail-dispose"]); } }, "vehicle");
    const scene = { add(child: unknown) {
      events.push(["scene-add", child === visual.root ? "root" : child]);
    } };
    visual.attachToScene(scene);
    return { events, trailState: visual.trailState,
      trailVehicle: visual.trailVehicle,
      hasEffects: !!visual.effects, hasTrails: !!visual.trails };
  };
  for (const withTrails of [true, false]) {
    assert.deepEqual(inspect(true, withTrails), inspect(false, withTrails));
  }
});

test("Ghost visual release order and cleared references match release", () => {
  const inspect = (rewritten: boolean, populated: boolean) => {
    const { visual, events } = makeVisual(rewritten, populated);
    if (populated) {
      visual.setEffects({ dispose() { events.push(["effect-dispose"]); } });
      visual.setTrails({ object: "trail-mesh",
        dispose() { events.push(["trail-dispose"]); } }, "vehicle");
    }
    visual.dispose();
    return { events, balloon: visual.balloon, accessories: visual.accessories,
      attachmentNodes: visual.attachmentNodes, effects: visual.effects,
      trails: visual.trails, imported: visual.imported,
      character: visual.character, linked: visual.linkedPresentation,
      animation: visual.animation, visual: visual.visual };
  };
  for (const populated of [true, false]) {
    assert.deepEqual(inspect(true, populated), inspect(false, populated));
  }
});
