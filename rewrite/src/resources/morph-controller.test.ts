import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { BufferGeometry, DynamicDrawUsage, Float32BufferAttribute,
  Uint16BufferAttribute } from "three";

import { FloatKeyController } from "./float-key-controller";
import { MorphController, type ParsedMorphController } from "./morph-controller";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseClass() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("class Qm {");
  const last = source.indexOf("\nclass XK {", first);
  assert.ok(first >= 0 && last > first);
  return new Function("on", "r1", `${source.slice(first, last)}\nreturn Qm;`)(
    FloatKeyController, DynamicDrawUsage) as typeof MorphController;
}

function key(time: number, value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, time, true);
  view.setFloat32(4, value, true);
  return bytes;
}

function parsed(channel: "position" | "uv"): ParsedMorphController {
  return { kind: "morph-controller",
    base: { cycleMode: 2, frequency: 1, phaseWord: 0 },
    data: [
      { vertexCount: 2, keys: { type: 1, records: [key(0, 0.2), key(100, 0.7)] },
        [channel === "position" ? "positions" : "uvs"]:
          channel === "position" ? [[1, 2, 3], [4, 5, 6]] : [[0, 0], [1, 1]] },
      { vertexCount: 2, keys: { type: 1, records: [key(0, 0.4), key(100, 0.6)] },
        [channel === "position" ? "positions" : "uvs"]:
          channel === "position" ? [[-2, 3, 4], [2, -1, 5]] : [[1, 0], [0, 1]] },
    ] } as ParsedMorphController;
}

function geometry(channel: "position" | "uv", integer = false): BufferGeometry {
  const result = new BufferGeometry();
  const values = channel === "position" ? [0, 0, 0, 0, 0, 0]
    : [0.2, 0.4, 0.6, 0.8];
  result.setAttribute(channel, integer
    ? new Uint16BufferAttribute(values, channel === "position" ? 3 : 2)
    : new Float32BufferAttribute(values, channel === "position" ? 3 : 2));
  return result;
}

function snapshot(controller: MorphController) {
  const attribute = controller.attribute;
  const box = controller.geometry.boundingBox;
  const sphere = controller.geometry.boundingSphere;
  return { channel: controller.channel, refreshBounds: controller.refreshBounds,
    lastTick: controller.lastTick, buffer: [...attribute.array],
    usage: attribute.usage, version: attribute.version,
    weights: controller.weights.map(weight => ({ output: weight.output,
      mappedTime: weight.mappedTime, frozenTime: weight.frozenTime,
      cycleModeOverride: weight.cycleModeOverride })),
    box: box && { min: box.min.toArray(), max: box.max.toArray() },
    sphere: sphere && { center: sphere.center.toArray(), radius: sphere.radius } };
}

test("位置和 UV Morph 权重、循环、停止和边界更新与发行版一致", async () => {
  const Original = await releaseClass();
  for (const channel of ["position", "uv"] as const) {
    const source = parsed(channel);
    const old = Original.fromParsed(source, geometry(channel));
    const current = MorphController.fromParsed(source, geometry(channel));
    assert.deepEqual(snapshot(current), snapshot(old));
    for (const time of [1000, 1050, 1050, 1090, 1200]) {
      old.update(time);
      current.update(time);
      assert.deepEqual(snapshot(current), snapshot(old), `${channel}@${time}`);
    }
    old.play(2000, 500);
    current.play(2000, 500);
    old.setCycleMode(1);
    current.setCycleMode(1);
    old.update(2100);
    current.update(2100);
    assert.deepEqual(snapshot(current), snapshot(old));
    old.stop(2200);
    current.stop(2200);
    assert.deepEqual(snapshot(current), snapshot(old));
    old.reset(3000);
    current.reset(3000);
    assert.deepEqual(snapshot(current), snapshot(old));
  }
});

test("Morph 通道和目标顶点的约束错误与发行版一致", async () => {
  const Original = await releaseClass();
  const cases: Array<[ParsedMorphController, BufferGeometry]> = [
    [{ ...parsed("position"), kind: "other" }, geometry("position")],
    [{ ...parsed("position"), data: [] }, geometry("position")],
    [{ ...parsed("position"), data: [{ ...parsed("position").data[0]!,
      uvs: [[0, 0], [1, 1]] }] }, geometry("position")],
    [{ ...parsed("position"), data: [{ ...parsed("position").data[0]!,
      vertexCount: 3 }] }, geometry("position")],
    [parsed("position"), geometry("position", true)],
  ];
  const capture = (run: () => unknown) => {
    try { run(); return "success"; }
    catch (error) { return String(error); }
  };
  for (const [source, mesh] of cases)
    assert.equal(capture(() => MorphController.fromParsed(source, mesh)),
      capture(() => Original.fromParsed(source, mesh)));
});
