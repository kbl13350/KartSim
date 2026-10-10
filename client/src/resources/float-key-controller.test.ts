import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { FloatKeyController, type ParsedFloatController } from "./float-key-controller";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releaseController() {
  const source = await readFile(releaseFile, "utf8");
  const classStart = source.indexOf("class on {");
  const classEnd = source.indexOf("\nfunction TK(", classStart);
  const helperStart = source.indexOf("function RK(", classEnd);
  const helperEnd = source.indexOf("\nfunction CB(", helperStart);
  assert.ok(classStart >= 0 && classEnd > classStart &&
    helperStart > classEnd && helperEnd > helperStart);
  return new Function(`${source.slice(classStart, classEnd)}
    ${source.slice(helperStart, helperEnd)}
    return on;`)() as typeof FloatKeyController;
}

function key(type: number, time: number, value: number,
  incoming = 0, outgoing = 0): Uint8Array {
  const bytes = new Uint8Array(type === 0 ? 16 : 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, time, true);
  view.setFloat32(4, value, true);
  if (type === 0) {
    view.setFloat32(8, incoming, true);
    view.setFloat32(12, outgoing, true);
  }
  return bytes;
}

function parsed(type: number, cycleMode: number,
  frequency = 1): ParsedFloatController {
  return { kind: "float-controller",
    base: { cycleMode, frequency, phaseWord: 0,
      startTimeWord: 0, stopTimeWord: 2000 },
    keys: { type, records: [key(type, 0, 21, 1.25, 2.5),
      key(type, 500, 14, -0.75, 1.5),
      key(type, 2000, 11, 0.25, 0)] } };
}

function snapshot(controller: FloatKeyController) {
  return { cursor: controller.cursor, epoch: controller.epoch,
    lastCycle: controller.lastCycle, pingPongReverse: controller.pingPongReverse,
    output: controller.output, frequencyOverride: controller.frequencyOverride,
    cycleModeOverride: controller.cycleModeOverride,
    frozenTime: controller.frozenTime, mappedTime: controller.mappedTime,
    current: controller.current(), keys: controller.keys };
}

test("浮点动画控制器的插值、循环、变速、冻结和 uint32 回绕与发行版一致", async () => {
  const Original = await releaseController();
  for (const type of [0, 1, 3]) {
    for (const mode of [0, 1, 2, 3]) {
      for (const frequency of [1, 0.5]) {
        const source = parsed(type, mode, frequency);
        const old = Original.fromParsed(source);
        const current = FloatKeyController.fromParsed(source);
        assert.deepEqual(snapshot(current), snapshot(old));
        for (const time of [1000, 1016, 1250, 1510, 2200, 3000, 4500,
          0xffffff00, 0x10]) {
          assert.equal(current.update(time), old.update(time),
            `${type}/${mode}/${frequency}/${time}`);
          assert.deepEqual(snapshot(current), snapshot(old));
        }
        old.play(2000, 750);
        current.play(2000, 750);
        assert.deepEqual(snapshot(current), snapshot(old));
        old.setCycleMode(1);
        current.setCycleMode(1);
        for (const time of [2200, 2600, 3100, 3700]) {
          assert.equal(current.update(time), old.update(time));
          assert.deepEqual(snapshot(current), snapshot(old));
        }
        old.stop(3800);
        current.stop(3800);
        assert.deepEqual(snapshot(current), snapshot(old));
        assert.equal(current.update(5000), old.update(5000));
        old.reset(10);
        current.reset(10);
        assert.deepEqual(snapshot(current), snapshot(old));
      }
    }
  }
});

test("浮点动画控制器非法类型、空键和损坏记录保留发行版错误", async () => {
  const Original = await releaseController();
  const cases = [
    { ...parsed(1, 0), kind: "other" },
    { ...parsed(1, 0), keys: { type: 9, records: [key(1, 0, 1)] } },
    { ...parsed(1, 0), keys: { type: 1, records: [] } },
    { ...parsed(1, 0), keys: { type: 1, records: [new Uint8Array(5)] } },
  ];
  for (const source of cases) {
    const capture = (Controller: typeof FloatKeyController) => {
      try { Controller.fromParsed(source); return "success"; }
      catch (error) { return String(error); }
    };
    assert.equal(capture(FloatKeyController), capture(Original));
  }
});
