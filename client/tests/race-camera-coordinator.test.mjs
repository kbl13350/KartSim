import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { RaceCameraCoordinator } from "../src/timeattack/race-camera-coordinator.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body
  .find(item => item.type === "ClassDeclaration" && item.id.name === "Mf0");
assert.ok(node);
const source = release.slice(node.start, node.end);

function run(readable) {
  const events = [];
  let driveId = 0;
  const makeDrive = processState => {
    const id = ++driveId;
    events.push(["create-drive", id, processState]);
    return {
      configureP3528ResolutionMode: () => events.push(["configure-drive", id]),
      reset: () => events.push(["reset-drive", id]),
      update: options => {
        events.push(["update-drive", id, options]);
        return { horizontalFovDegrees: 120, far: 400 };
      },
      apply: (camera, state) => events.push(["apply-drive", id, state]),
    };
  };
  const makeSurround = () => {
    events.push("create-surround");
    return {
      configureP3528ResolutionMode: () => events.push("configure-surround"),
      reset: () => events.push("reset-surround"),
      update: (time, body, scale) => {
        events.push(["update-surround", time, body, scale]);
        return { angle: 20 };
      },
      apply: (camera, state) => events.push(["apply-surround", state]),
    };
  };
  const Original = new Function("Bt", "zB", "Ol", "KL",
    `${source}; return Mf0;`)(() => "p3553", "process",
      class Drive { constructor(processState) { return makeDrive(processState); } },
      class Surround { constructor() { return makeSurround(); } });
  const shake = {
    update: (time, surface) => {
      events.push(["shake", time, surface]);
      return { x: .1, y: .2, z: .3 };
    },
  };
  const wave = { update: (...args) => events.push(["wave", ...args]) };
  const warp = { fairyFovFactor: () => .5 };
  const controller = readable
    ? new RaceCameraCoordinator(shake, wave, warp, {}, {
      versionTag: () => "p3553", processState: "process",
      createDrive: makeDrive, createSurround: makeSurround,
    })
    : new Original(shake, wave, warp);
  const camera = {};
  const vehicle = {
    body: { position: { x: 1, y: 2, z: 3 } },
    driveCameraRuntime: () => ({ eventScaleSecondary: { z: 2 } }),
  };
  const track = {
    cameraFar: 500,
    currentRouteSurface: () => "asphalt",
  };
  const session = {
    cameraMode: "ready",
    readyCamera: { apply: (...args) => events.push(["ready", ...args]) },
  };
  controller.configureP3528ResolutionMode();
  controller.update(100, camera, session, vehicle, track);
  session.cameraMode = "drive";
  controller.update(200, camera, session, vehicle, track);
  session.cameraMode = "surround";
  controller.update(300, camera, session, vehicle, track);
  controller.reset();
  controller.beginNewStage();
  return { events, driveState: session.driveCameraState,
    surroundState: session.surroundCameraState };
}

test("race camera modes, shake, FOV, and stage reset match the release", () => {
  assert.deepEqual(run(true), run(false));
});
