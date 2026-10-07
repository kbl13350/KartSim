import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { configureRpSceneCamera, decorateRpResultTemplate,
  rpSceneCameraMatrices, type RpCameraLike } from "./rp-scene-helpers";
import type { RoomTemplateNode } from "./lobby-room-template";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const cameraStart = release.indexOf("function _F(");
const cameraEnd = release.indexOf("\nclass my {", cameraStart);
const resultStart = release.indexOf("function Vl0(", cameraEnd);
const resultEnd = release.indexOf("\nclass vy {", resultStart);
assert.ok(cameraStart >= 0 && cameraEnd > cameraStart &&
  resultStart > cameraEnd && resultEnd > resultStart);

function node(tag: string, name?: string, children: RoomTemplateNode[] = [],
  fields: Record<string, string> = {}): RoomTemplateNode {
  return { name: tag, text: "", children,
    attributes: Object.entries({ ...(name ? { name } : {}), ...fields })
      .map(([key, value]) => ({ name: key, value })) };
}
const attribute = (target: RoomTemplateNode, key: string) =>
  target.attributes.find(entry => entry.name === key)?.value;
const clone = (target: RoomTemplateNode,
  fields: Record<string, string | undefined>,
  children = target.children): RoomTemplateNode => ({
    ...target,
    attributes: [
      ...target.attributes.filter(entry => !(entry.name in fields)),
      ...Object.entries(fields).map(([name, value]) => ({ name, value })),
    ],
    children,
  });

function makeCamera() {
  const events: unknown[][] = [];
  class Matrix {
    elements = Array(16).fill(0) as number[];
    copy(other: Matrix) {
      events.push(["copy", other.elements.slice()]);
      this.elements = other.elements.slice();
      return this;
    }
    invert() {
      events.push(["invert", this.elements.slice()]);
      return this;
    }
  }
  const camera: RpCameraLike = {
    near: 0, far: 0, aspect: 0, fov: 0,
    matrixWorldInverse: new Matrix(), matrixWorld: new Matrix(),
    projectionMatrix: new Matrix(), projectionMatrixInverse: new Matrix(),
  };
  const applyMatrices = (_camera: RpCameraLike, view: number[],
    projection: number[]) => {
    events.push(["apply", view.slice(), projection.slice()]);
    _camera.matrixWorldInverse.elements = view.slice();
    _camera.projectionMatrix.elements = projection.slice();
  };
  return { camera, events, applyMatrices };
}

function original() {
  return new Function("T", "h2", "Aa",
    `${release.slice(cameraStart, cameraEnd)}\n` +
    `${release.slice(resultStart, resultEnd)}\n` +
    "return { _F, Dl0, Vl0 };",
  )(attribute, clone, (camera: RpCameraLike, view: number[],
    projection: number[]) => {
    camera.matrixWorldInverse.elements = view.slice();
    camera.projectionMatrix.elements = projection.slice();
  }) as {
    _F(node: RoomTemplateNode, width: number, height: number): unknown;
    Dl0(camera: RpCameraLike, node: RoomTemplateNode,
      width: number, height: number): void;
    Vl0(node: RoomTemplateNode, kart: string, pet: string): RoomTemplateNode;
  };
}

function outcome(fn: () => unknown) {
  try { return { value: fn() }; }
  catch (failure) { return { error: (failure as Error).message }; }
}

test("RP camera matrices and validation branches match release", () => {
  const released = original();
  const cases: [RoomTemplateNode, number, number][] = [
    [node("Scene", "scene", [], { zoom: "1" }), 640, 480],
    [node("Scene", "scene", [], { zoom: "1",
      defaultCameraPos: "0 -5 2", defaultSpotPos: "0 0 1" }), 1280, 720],
    [node("Scene", "scene", [], { zoom: "1",
      defaultCameraPos: "invalid" }), 640, 480],
    [node("Scene", "scene", [], { zoom: "1",
      defaultSpotPos: "0 NaN 0" }), 640, 480],
    [node("Scene", "scene", [], { zoom: "2" }), 640, 480],
    [node("Scene", "scene", [], { zoom: "1", camera: "true" }), 640, 480],
    [node("Scene", "scene", [], { zoom: "1" }), 0, 480],
  ];
  for (const [scene, width, height] of cases) {
    assert.deepEqual(outcome(() => rpSceneCameraMatrices(scene, width,
      height, attribute)), outcome(() => released._F(scene, width, height)));
  }
});

test("RP camera setup preserves projection flips and matrix update order", () => {
  const scene = node("Scene", "scene", [], { zoom: "1" });
  const released = original();
  const old = makeCamera();
  released.Dl0(old.camera, scene, 640, 480);
  const modern = makeCamera();
  configureRpSceneCamera(modern.camera, scene, 640, 480,
    { attribute, applyMatrices: modern.applyMatrices });
  assert.deepEqual(JSON.parse(JSON.stringify(modern.camera)),
    JSON.parse(JSON.stringify(old.camera)));
  // The released Aa adapter records the same matrices as the modern adapter.
  assert.deepEqual(modern.events.slice(1), old.events);
});

test("RP result template composition and missing assets match release", () => {
  const released = original();
  const box = node("Panel", "boxOpen", [node("Play1SPanel")]);
  const loss = node("Panel", "꽝");
  const win = node("Panel", "당첨", [node("Play1SPanel")]);
  const main = node("Panel", "main");
  const dialog = node("Panel", "noticeDlg", [loss, win, main], {
    frame: "resultFrame",
  });
  const valid = node("Panel", "root", [dialog, box]);
  const cases = [
    valid,
    node("Panel", "root", [box]),
    node("Panel", "root", [dialog]),
    node("Panel", "root", [node("Panel", "noticeDlg",
      [loss, win, main]), box]),
    node("Panel", "root", [node("Panel", "noticeDlg",
      [loss, main], { frame: "resultFrame" }), box]),
  ];
  for (const scene of cases) {
    assert.deepEqual(outcome(() => decorateRpResultTemplate(scene,
      "卡丁车", "飞宠", { attribute, clone })),
    outcome(() => released.Vl0(scene, "卡丁车", "飞宠")));
  }
});
