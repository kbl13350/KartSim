import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildGhostKsvHeader, encodeGhostKsvRecording,
  ghostKsvEquipment, nativeFrameToKsvStamp,
  type GhostKsvExportDependencies, type GhostKsvRecording,
} from "./ghost-ksv-export";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
function section(startMarker: string, endMarker: string) {
  const start = release.indexOf(startMarker);
  const end = release.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, startMarker);
  return release.slice(start, end);
}
const originalCode = [
  section("class Rh0 {", "\nfunction Ih0"),
  section("function F_(", "\nconst D_"),
  section("const D_ =", "\nfunction Ph0"),
  section("function Ph0(", "\nconst PD"),
].join("\n");

function makeFixture() {
  const events: unknown[][] = [];
  const dependencies: GhostKsvExportDependencies = {
    encodeStatus(...parts) { events.push(["status", ...parts]);
      return parts.join(":"); },
    encodeRuntimeStamp(stamp, ceiling) {
      events.push(["runtime-stamp", stamp, ceiling]);
      return { encoded: stamp, ceiling };
    },
    createRecorder(ceiling) {
      events.push(["recorder", ceiling]);
      return {
        begin(stamp) { events.push(["begin", stamp]); },
        update(stamp) { events.push(["update", stamp]); },
        finish() { events.push(["finish"]); return { finished: true }; },
      };
    },
  };
  const Original = new Function("xD", "kD", "GD",
    `${originalCode}\nreturn { Rh0, Lh0, F_, Ph0 };`)(
      dependencies.encodeRuntimeStamp,
      class { constructor(ceiling: number) {
        return dependencies.createRecorder(ceiling);
      } },
      dependencies.encodeStatus,
    ) as {
      Rh0: new () => { encode(recording: GhostKsvRecording,
        ceiling: number): unknown };
      Lh0: new () => { build(recording: GhostKsvRecording,
        encoded: unknown): unknown };
      F_: (frame: GhostKsvRecording["frames"][number]) => unknown;
      Ph0: (equipment: Record<string, unknown>) => unknown;
    };
  return { Original, dependencies, events };
}

const recording: GhostKsvRecording = {
  frames: [
    { stageTimeMs: -50, position: { x: 1, y: 2, z: 3 },
      rotation: { w: 1, x: 0, y: 0.5, z: 0 },
      state: { stateCode: 4, driftActive: true,
        instantAccelerationActive: false, motionRequest: 2 } },
    { stageTimeMs: 110, position: { x: 4, y: 5, z: 6 },
      rotation: { w: 0.7, x: 0.1, y: 0.2, z: 0.3 },
      state: { stateCode: 6, driftActive: false,
        instantAccelerationActive: true, motionRequest: 3 } },
  ],
  metadata: {
    equipment: { playerName: "Pilot", character: 10, kart: 20,
      superBoss: 30, headBand: 40, headphone: 50,
      handGearL: 60, handGearR: 70, uniform: 80,
      decal: 90, plateText: "A1", startSlot: 2 },
    trackId: "forest", summary: { elapsedMs: 123456 }, speed: 3,
  },
};

test("native race frames and runtime stamps encode like release", () => {
  const inspect = (rewritten: boolean, input: GhostKsvRecording) => {
    const { Original, dependencies, events } = makeFixture();
    const encoder = new Original.Rh0();
    const output = rewritten
      ? encodeGhostKsvRecording(input, 900, dependencies)
      : encoder.encode(input, 900);
    return { output, events };
  };
  for (const input of [recording, { ...recording, frames: [] },
    { ...recording, ksvRuntimeStamps: [] },
    { ...recording, ksvRuntimeStamps: [{ timeMs: 10 }, { timeMs: 20 }] }]) {
    assert.deepEqual(inspect(true, input), inspect(false, input));
  }
  const { Original, dependencies } = makeFixture();
  assert.deepEqual(nativeFrameToKsvStamp(recording.frames[0]!,
    dependencies.encodeStatus), Original.F_(recording.frames[0]!));
});

test("KSV v12 equipment and header preserve release field layout", () => {
  const { Original } = makeFixture();
  for (const equipment of [recording.metadata.equipment,
    { kart: 7, character: 8, playerName: "" },
    { kart: 0, character: 0, kartPaint: 5, headphone: 2 }]) {
    assert.deepEqual(ghostKsvEquipment(equipment), Original.Ph0(equipment));
    const input = { ...recording, metadata: {
      ...recording.metadata, equipment,
    } };
    assert.deepEqual(buildGhostKsvHeader(input, { stamps: [1, 2] }),
      new Original.Lh0().build(input, { stamps: [1, 2] }));
  }
});
