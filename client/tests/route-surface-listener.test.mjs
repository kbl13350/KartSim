import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  applyWarpNextAction, applyWarpNextActions, freezeWarpCamera,
  handleRouteSurfaceTag, warpNextEventFrame,
} from "../src/timeattack/route-surface-listener.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body
  .find(item => item.type === "ClassDeclaration" && item.id.name === "sf0");
assert.ok(node);
const source = release.slice(node.start, node.end);

function run(readable) {
  const events = [];
  const physics = {
    handleRouteSurfaceTag: tag => { events.push(["physics-tag", tag]); return true; },
    setWarpPresentationActive: value => events.push(["warp-active", value]),
    setWarpPressProtected: value => events.push(["press-protected", value]),
    completeCheckpointPose: (...args) => events.push(["teleport", ...args]),
    setFullPhysicsBypass: value => events.push(["bypass", value]),
    restoreResetInteraction: () => events.push("restore"),
  };
  const track = {
    data: { warp: "warp-data" },
    warpNextDestination: () => { events.push("destination"); return 99; },
    setLensFlareEnabled: value => events.push(["lens", value]),
  };
  const session = {
    warpHud: { hidden: false }, warpNextCamera: {},
    rain: { setEnabled: value => events.push(["rain", value]) },
    rainAudio: { setRainEnabled: value => events.push(["rain-audio", value]) },
    snow: { setEnabled: value => events.push(["snow", value]) },
    coordinator: {
      completeWarpNextRailLanding: () => events.push("complete-rail"),
      deferWarpNextRailLanding: () => events.push("defer-rail"),
      synchronizePositionAnchor: () => events.push("sync-anchor"),
    },
  };
  const host = {
    session, presentationClockMs: 123,
    getPhysics: () => physics, getTrack: () => track,
    warpNext: { enter: (...args) => { events.push(["warp-enter", ...args]); return []; } },
    lightFactor: { trigger: () => events.push("flash") },
    cameraShake: {
      enter: () => events.push("shake-in"),
      leave: value => events.push(["shake-out", value]),
    },
    cameraWave: {
      enter: () => events.push("wave-in"),
      leave: () => events.push("wave-out"),
    },
    driveCameraman: { reset: value => events.push(["reset-camera", value]) },
  };
  const routeEffect = tag => tag.split(":")[0];
  const Original = new Function("YD", "Vo", `${source}; return sf0;`)(
    class {}, routeEffect);
  const listener = readable ? {
    host,
    handleRouteSurfaceTag(tag, frame) {
      return handleRouteSurfaceTag(this, tag, frame, { routeEffect });
    },
    warpNextEventFrame(tag, frame) {
      return warpNextEventFrame(this, tag, frame);
    },
    applyWarpNextActions(actions) { return applyWarpNextActions(this, actions); },
    applyWarpNextAction(action) { return applyWarpNextAction(this, action); },
    freezeWarpCamera() { return freezeWarpCamera(this); },
  } : new Original(host);
  for (const tag of ["flash:in:one", "shake:in:one",
    "shake:out:one", "wave:out:one", "norain:out:one",
    "nosnow:out:one", "lensflare:in:one", "warpnext:in:next"])
    listener.handleRouteSurfaceTag(tag, 42);
  listener.applyWarpNextActions([
    { kind: "start-warp-presentation" },
    { kind: "reset-drive-camera" },
    { kind: "freeze-camera" },
    { kind: "teleport", frame: { x: 1 }, clearMotion: true },
    { kind: "finish-warp-presentation" },
    { kind: "finish-warp-letterbox" },
  ]);
  return { events, hudHidden: session.warpHud.hidden,
    cameraFrozen: session.warpCameraFrozen,
    driveState: session.driveCameraState };
}

test("track tags, weather, and warp actions match the release", () => {
  assert.deepEqual(run(true), run(false));
});
