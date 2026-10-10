import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createLobbyAvatarCamera, type LobbyAvatarCameraDependencies } from
  "./lobby-avatar-camera";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("function Ml0(");
const end = release.indexOf("\nclass xl0 {", start);
assert.ok(start >= 0 && end > start);
const originalFunction = release.slice(start, end);

function observe(rewritten: boolean, team: number | null,
  reverse: boolean, linked?: number, always?: boolean, kartId?: number) {
  const events: unknown[][] = [];
  class Camera {
    position = { set(x: number, y: number, z: number) {
      events.push(["position", x, y, z]);
    } };
    constructor(readonly fov: number, readonly aspect: number,
      readonly near: number, readonly far: number) {
      events.push(["camera", fov, aspect, near, far]);
    }
    lookAt(x: number, y: number, z: number) {
      events.push(["target", x, y, z]);
    }
  }
  const math = {
    degToRad(degrees: number) {
      events.push(["deg-to-rad", degrees]); return degrees * Math.PI / 180;
    },
    radToDeg(radians: number) {
      events.push(["rad-to-deg", radians]); return radians * 180 / Math.PI;
    },
  };
  const deps = { ...math,
    createCamera: (fov: number, aspect: number, near: number, far: number) =>
      new Camera(fov, aspect, near, far),
  } satisfies LobbyAvatarCameraDependencies;
  const Original = new Function("kl", "Z9",
    `${originalFunction}\nreturn Ml0;`)(math, Camera) as (
      team: number | null, reverse: boolean, linked?: number,
      always?: boolean, kartId?: number) => Camera;
  const camera = rewritten
    ? createLobbyAvatarCamera(deps, team, reverse, linked, always, kartId)
    : Original(team, reverse, linked, always, kartId);
  return { events, fov: (camera as Camera).fov,
    aspect: (camera as Camera).aspect };
}

test("lobby preview camera framing matches every released team and kart branch", () => {
  for (const team of [null, 0, 1, 2, 3]) {
    for (const reverse of [false, true]) {
      for (const linked of [0, 1]) {
        for (const always of [false, true]) {
          for (const kartId of [0, 900]) {
            const caseName = JSON.stringify([team, reverse, linked, always, kartId]);
            assert.deepEqual(observe(true, team, reverse, linked, always, kartId),
              observe(false, team, reverse, linked, always, kartId), caseName);
          }
        }
      }
    }
  }
  assert.deepEqual(observe(true, null, false), observe(false, null, false));
});
