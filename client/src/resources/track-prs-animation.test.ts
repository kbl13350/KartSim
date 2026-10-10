import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { applyTrackPrs, createPrsRuntime, defaultTrackTransform,
  isTrackPrs, playPrs, sampleTrackPrs, setPrsCycleMode, stopPrs,
  validatePrs, type ParsedTrackPrs, type TrackTransform } from
  "./track-prs-animation";

const releaseFile = path.resolve(path.dirname(fileURLToPath(import.meta.url)),
  "../../../recovered/formatted/index.js");

async function releasePrs() {
  const source = await readFile(releaseFile, "utf8");
  const first = source.indexOf("const jA = new WeakMap();");
  const last = source.indexOf("\nclass NW {", first);
  assert.ok(first >= 0 && last > first);
  return new Function(`${source.slice(first, last)}
    return {P6,zG,GW,BW,RW,Nm,UG,$G,PW};`)() as {
      P6: typeof isTrackPrs; zG: typeof createPrsRuntime;
      GW: typeof playPrs; BW: typeof setPrsCycleMode;
      RW: typeof stopPrs; Nm: typeof validatePrs;
      UG: typeof defaultTrackTransform; $G: typeof applyTrackPrs;
      PW: typeof sampleTrackPrs;
    };
}

function vectorKey(time: number, xyz: number[]): Uint8Array {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, time, true);
  xyz.forEach((value, index) => view.setFloat32(4 + index * 4, value, true));
  return bytes;
}

function quaternionKey(time: number, wxyz: number[]): Uint8Array {
  const bytes = new Uint8Array(20);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, time, true);
  wxyz.forEach((value, index) => view.setFloat32(4 + index * 4, value, true));
  return bytes;
}

function scalarKey(time: number, value: number, type: 0 | 3,
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

function property(cycleMode = 2): ParsedTrackPrs {
  return { kind: "prs", base: { cycleMode, frequency: 1,
    phaseWord: 0, startTimeWord: 0, stopTimeWord: 100 },
    firstLastCache: [0, 100, 0, 100, 0, 100],
    position: { type: 1, records: [vectorKey(0, [1, 2, 3]),
      vectorKey(100, [5, 7, 11])] },
    rotation: { type: 1, records: [quaternionKey(0, [1, 0, 0, 0]),
      quaternionKey(100, [0.707, 0, 0.707, 0])] },
    scale: { type: 3, records: [vectorKey(0, [1, 1, 1]),
      vectorKey(100, [2, 2, 2])] } };
}

function fallback(): TrackTransform {
  return { position: [8, 9, 10], basis: [[2, 0, 0], [0, 3, 0],
    [0, 0, 4]], scale: [1.5, 2.5, 3.5] };
}

test("PRS 检测、默认状态、合法范围和错误诊断与发行版一致", async () => {
  const original = await releasePrs();
  for (const value of [undefined, {}, { kind: "other" }, property()])
    assert.equal(isTrackPrs(value), original.P6(value));
  assert.deepEqual(createPrsRuntime(), original.zG());
  assert.deepEqual(defaultTrackTransform(), original.UG());
  const cases: ParsedTrackPrs[] = [property(),
    { ...property(), position: { type: 9, records: [] } },
    { ...property(), rotation: { type: 7, records: [] } },
    { ...property(), rotation: { type: 4, axes: [] } },
    { ...property(), rotation: { type: 4, axes: [
      { type: 0, records: [] }, { type: 3, records: [] },
      { type: 0, records: [] }] } },
  ];
  for (const source of cases)
    assert.equal(validatePrs(source), original.Nm(source));
});

test("PRS 向量、缩放和 quaternion 插值与发行版逐值一致", async () => {
  const original = await releasePrs();
  for (const mode of [0, 1, 2, 3]) {
    const oldProperty = property(mode);
    const currentProperty = property(mode);
    const oldRuntime = original.zG();
    const currentRuntime = createPrsRuntime();
    for (const time of [1000, 1025, 1050, 1075, 1100, 1150, 1300]) {
      const old = original.PW(oldProperty, oldRuntime, time, fallback());
      const current = sampleTrackPrs(currentProperty, currentRuntime,
        time, fallback());
      assert.deepEqual(current, old, `mode=${mode} time=${time}`);
      assert.deepEqual(currentRuntime, oldRuntime);
    }
  }
});

test("PRS composite 旋转、缺失通道 fallback 和原位输出与发行版一致", async () => {
  const original = await releasePrs();
  const axes = [
    { type: 0, records: [scalarKey(0, 0, 0, 0.1, 0.2),
      scalarKey(100, 0.6, 0, 0.3, 0.4)] },
    { type: 3, records: [scalarKey(0, 0.3, 3),
      scalarKey(100, 0.7, 3)] },
    { type: 0, records: [scalarKey(0, 0, 0, 0, 0.1),
      scalarKey(100, -0.5, 0, -0.2, 0)] },
  ];
  for (const missing of [false, true]) {
    const oldProperty = { ...property(), rotation: { type: 4, axes },
      position: missing ? undefined : property().position,
      scale: missing ? undefined : property().scale };
    const currentProperty = structuredClone(oldProperty);
    const oldRuntime = original.zG();
    const currentRuntime = createPrsRuntime();
    for (const time of [1000, 1010, 1050, 1099, 1200]) {
      const oldOutput = original.UG();
      const currentOutput = defaultTrackTransform();
      assert.equal(applyTrackPrs(currentOutput, currentProperty,
        currentRuntime, time, fallback()), currentOutput);
      assert.equal(original.$G(oldOutput, oldProperty, oldRuntime,
        time, fallback()), oldOutput);
      assert.deepEqual(currentOutput, oldOutput, `missing=${missing} time=${time}`);
      assert.deepEqual(currentRuntime, oldRuntime);
    }
  }
});

test("PRS play、模式覆盖、stop 冻结和 reset 时钟与发行版一致", async () => {
  const original = await releasePrs();
  const oldProperty = property(), currentProperty = property();
  const oldRuntime = original.zG(), currentRuntime = createPrsRuntime();
  original.GW(oldProperty, oldRuntime, 2000, 250);
  playPrs(currentProperty, currentRuntime, 2000, 250);
  assert.deepEqual(currentRuntime, oldRuntime);
  original.BW(oldRuntime, 1);
  setPrsCycleMode(currentRuntime, 1);
  for (const time of [2010, 2100, 2300]) {
    assert.deepEqual(sampleTrackPrs(currentProperty, currentRuntime,
      time, fallback()), original.PW(oldProperty, oldRuntime, time, fallback()));
    assert.deepEqual(currentRuntime, oldRuntime);
  }
  original.RW(oldProperty, oldRuntime, 2400);
  stopPrs(currentProperty, currentRuntime, 2400);
  assert.deepEqual(currentRuntime, oldRuntime);
  assert.deepEqual(sampleTrackPrs(currentProperty, currentRuntime,
    9999, fallback()), original.PW(oldProperty, oldRuntime, 9999, fallback()));
});
