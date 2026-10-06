import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ColorKeyController, type ParsedColorController } from "./color-key-controller";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function originalController() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("class Zm {");
  const last = source.indexOf("\nclass Qm {", first);
  assert.ok(first >= 0 && last > first);
  return new Function(`${source.slice(first, last)}\nreturn Zm;`)() as typeof ColorKeyController;
}

function key(type: number, time: number, color: number,
  incoming = 0, outgoing = 0): Uint8Array {
  const bytes = new Uint8Array(type === 0 ? 16 : 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, time, true);
  view.setUint32(4, color, true);
  if (type === 0) {
    view.setFloat32(8, incoming, true);
    view.setFloat32(12, outgoing, true);
  }
  return bytes;
}

function parsed(type: number, cycleMode: number, frequency: number): ParsedColorController {
  return { kind: "color-controller", base: { cycleMode, frequency, phaseWord: 7 },
    keys: { type, records: [key(type, 10, 0x80ff2301, 1.5, -0.25),
      key(type, 50, 0x0090a2ed, 0.75, 2.25),
      key(type, 200, 0xffffffff, 0, 0)] } };
}

function snapshot(controller: ColorKeyController) {
  return { cursor: controller.cursor, epoch: controller.epoch,
    lastCycle: controller.lastCycle, pingPongReverse: controller.pingPongReverse,
    output: controller.output, keys: controller.keys };
}

test("材质颜色控制器的 Hermite、常量键、循环和时间回绕与发行版一致", async () => {
  const Original = await originalController();
  for (const type of [0, 3]) for (const mode of [0, 1, 2, 3])
    for (const frequency of [1, 0.5, 2]) {
      const data = parsed(type, mode, frequency);
      const old = Original.fromParsed(data);
      const current = ColorKeyController.fromParsed(data);
      assert.deepEqual(snapshot(current), snapshot(old));
      for (const time of [100, 107, 120, 145, 230, 460, 1000, 0xffffff00, 0x10]) {
        const read = (controller: ColorKeyController) => {
          try { return controller.update(time); }
          catch (error) { return String(error); }
        };
        assert.equal(read(current), read(old), `${type}/${mode}/${frequency}/${time}`);
        assert.deepEqual(snapshot(current), snapshot(old));
      }
      old.reset(300);
      current.reset(300);
      assert.deepEqual(snapshot(current), snapshot(old));
    }
});

test("材质颜色控制器保留发行版解析错误", async () => {
  const Original = await originalController();
  const cases = [
    { ...parsed(0, 0, 1), kind: "other" },
    { ...parsed(0, 0, 1), keys: { type: 1, records: [key(3, 0, 0)] } },
    { ...parsed(0, 0, 1), keys: { type: 0, records: [] } },
    { ...parsed(0, 0, 1), keys: { type: 0, records: [new Uint8Array(3)] } },
  ];
  for (const data of cases) {
    const capture = (Controller: typeof ColorKeyController) => {
      try { Controller.fromParsed(data); return "success"; }
      catch (error) { return String(error); }
    };
    assert.equal(capture(ColorKeyController), capture(Original));
  }
});
