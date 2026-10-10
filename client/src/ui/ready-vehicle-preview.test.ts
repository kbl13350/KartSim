import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  disposeReadyVehiclePreview,
  loadReadyVehiclePreview,
  renderReadyVehiclePreview,
  type ReadyVehiclePreview,
} from "./ready-vehicle-preview";

const source = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const beginning = source.indexOf("class ny {");
const end = source.indexOf("function B80() {", beginning);
assert.ok(beginning >= 0 && end > beginning, "Ready preview class missing from release");
const releasedClass = source.slice(beginning, end);

type Scenario = "success" | "without-pet" | "load-failure" | "host-failure" | "release-failure";

async function exercise(released: boolean, scenario: Scenario): Promise<unknown[]> {
  const events: unknown[] = [];
  const camera = { id: "camera" };
  const preview: ReadyVehiclePreview = {
    kart: { animation: { updateCurrentState: time => events.push(["animation", time]) } },
    ...(scenario === "without-pet" ? {} : {
      flyingPet: { update: (time: number, current: unknown, width: number, height: number) =>
        events.push(["pet", time, current === camera, width, height]) },
    }),
    decorations: [0, 1].map(index => ({ scene: {
      update: (time: number, current: unknown, width: number, height: number) =>
        events.push(["decoration", index, time, current === camera, width, height]),
    } })),
    scene: { id: "scene" },
  };
  class FakeRenderer {
    outputColorSpace: unknown;
    constructor(options: unknown) { events.push(["renderer", options]); }
    setClearColor(color: number, alpha: number) { events.push(["clear", color, alpha]); }
    setSize(width: number, height: number, updateStyle: boolean) {
      events.push(["size", width, height, updateStyle]);
      if (scenario === "host-failure") throw new Error("host failed");
    }
    dispose() { events.push(["renderer-dispose"]); }
  }
  const releasePreview = (value: ReadyVehiclePreview) => {
    events.push(["release", value === preview]);
    if (scenario === "release-failure") throw new Error("release failed");
  };
  const loadPreview = async (...args: unknown[]) => {
    events.push(["load", args.slice(0, 4), args[4] === stage,
      args[5] instanceof FakeImporter, args[6], args[7]]);
    if (scenario === "load-failure") throw new Error("load failed");
    return preview;
  };
  class FakeImporter { constructor() { events.push(["importer"]); } }
  const updateScene = (value: ReadyVehiclePreview, time: number,
    current: unknown, width: number, height: number) =>
    events.push(["scene-update", value === preview, time, current === camera, width, height]);
  const composite = (_renderer: unknown, output: unknown, frame: unknown, paint: () => void) => {
    events.push(["composite-begin", output, frame]);
    paint();
    events.push(["composite-end"]);
  };
  const renderScene = (_renderer: unknown, scene: unknown, current: unknown) =>
    events.push(["paint", scene === preview.scene, current === camera]);
  const Original = new Function(
    "I4", "B80", "qe", "Ni", "Es", "T7", "Tr", "Lt", "T4", "NP", "f4",
    `${releasedClass}; return ny;`,
  )(
    FakeRenderer, () => camera, "srgb", 800, 450, loadPreview,
    FakeImporter, releasePreview, updateScene, composite, renderScene,
  ) as {
    new (value: ReadyVehiclePreview, stage: { beginFrame(time: number): void }): {
      preview: ReadyVehiclePreview;
      stageBinding: { beginFrame(time: number): void };
      camera: unknown;
      renderer: FakeRenderer;
      render(output: unknown, frame: unknown, time: number): void;
      dispose(): void;
    };
    load(...args: unknown[]): Promise<InstanceType<typeof Original>>;
  };
  const stage = { beginFrame: (time: number) => events.push(["begin", time]) };
  let host: InstanceType<typeof Original> | undefined;
  try {
    host = released
      ? await Original.load("library", "environment", "character", "kart", stage, "options")
      : await loadReadyVehiclePreview(
        "library", "environment", "character", "kart", stage, "options", {
          createImporter: () => new FakeImporter(),
          loadPreview,
          createHost: (value, binding) => new Original(value, binding as typeof stage),
          releasePreview,
        },
      );
  } catch (error) {
    events.push(["error", String(error)]);
    return events;
  }
  if (released) host.render("output", "frame", 2.5);
  else renderReadyVehiclePreview(host, "output", "frame", 2.5, {
    width: 800, height: 450, updateScene, composite, renderScene,
  });
  try {
    if (released) host.dispose();
    else disposeReadyVehiclePreview(host, releasePreview);
  } catch (error) {
    events.push(["error", String(error)]);
  }
  return events;
}

for (const scenario of [
  "success", "without-pet", "load-failure", "host-failure", "release-failure",
] as const) {
  test(`Ready vehicle preview matches release: ${scenario}`, async () => {
    assert.deepEqual(await exercise(false, scenario), await exercise(true, scenario));
  });
}
