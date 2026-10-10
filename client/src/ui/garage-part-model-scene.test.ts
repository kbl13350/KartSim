import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "@babel/parser";
import {
  createGaragePartCamera, garagePartModelDuration, loadGaragePartModelScene,
  type GaragePartCamera, type GaragePartModelSceneDependencies,
  type GaragePartPanelNode,
} from "./garage-part-model-scene";

const release = readFileSync(new URL(
  "../../../recovered/formatted/assets/GarageXView-DSeU5AUN.js", import.meta.url), "utf8");
const source = parse(release, { sourceType: "module" }).program.body;
function releasedFunction(name: string, bindings: string[], values: unknown[]): Function {
  const declaration = source.find(node => node.type === "FunctionDeclaration" &&
    node.id?.name === name);
  assert.ok(declaration && declaration.type === "FunctionDeclaration");
  return new Function(...bindings,
    `return (${release.slice(declaration.start!, declaration.end!)});`)(...values) as Function;
}

function floatRecord(time: number, value: number, inTangent = 0,
  outTangent = 0): Uint8Array {
  const bytes = new Uint8Array(16);
  const data = new DataView(bytes.buffer);
  data.setUint32(0, time, true);
  data.setFloat32(4, value, true);
  data.setFloat32(8, inTangent, true);
  data.setFloat32(12, outTangent, true);
  return bytes;
}

test("part scene duration traverses PRS and float controllers like release Yi", () => {
  const original = releasedFunction("Yi", [], []) as (value: unknown) => number;
  const cases: unknown[] = [
    undefined, {},
    { kind: "prs", base: { stopTimeWord: 120, frequency: 60 } },
    { children: [
      { kind: "prs", base: { stopTimeWord: 60, frequency: 20 } },
      { kind: "float-controller", base: { frequency: 30 }, keys: {
        type: 1, records: [floatRecord(0, 1), floatRecord(30, 2),
          floatRecord(60, 2), floatRecord(90, 2)],
      } },
    ] },
    { kind: "float-controller", base: { frequency: 20 }, keys: {
      type: 0, records: [floatRecord(0, 5), floatRecord(20, 5),
        floatRecord(40, 5, 0, 1)],
    } },
    { kind: "float-controller", base: { frequency: 20 }, keys: {
      type: 3, records: [floatRecord(0, 2), floatRecord(80, 2)],
    } },
  ];
  const cyclic: { child?: unknown; self?: unknown } = {
    child: { kind: "prs", base: { frequency: 12, stopTimeWord: 18 } },
  };
  cyclic.self = cyclic;
  cases.push(cyclic);
  for (const [index, value] of cases.entries())
    assert.equal(garagePartModelDuration(value), original(value), `duration case ${index}`);
});

interface TestPanel extends GaragePartPanelNode { fields: Record<string, string> }
function panel(fields: Record<string, string> = {}): TestPanel {
  return { name: "Parts12", children: [], fields: {
    name: "default", defaultCameraPos: "1.3 2.4 3.5",
    defaultSpotPos: "4 5 6", zoom: "1.5", fov: "80",
    nearPlane: "0.5", farPlane: "120", ...fields,
  } };
}

function cameraRun(released: boolean, fields: Record<string, string>): unknown {
  const events: unknown[] = [];
  const sourcePanel = panel(fields);
  const field = (node: GaragePartPanelNode, name: string): string | undefined =>
    (node as TestPanel).fields[name];
  const verticalFov = (fov: number, aspect: number) => fov + aspect * 0.25;
  class Camera {
    aspect: number;
    fov: number;
    position = { set: (x: number, y: number, z: number) => events.push(
      ["position", x, y, z]) };
    constructor(fov: number, aspect: number, readonly near: number,
      readonly far: number) {
      this.fov = fov;
      this.aspect = aspect;
      events.push(["camera", fov, aspect, near, far]);
    }
    lookAt(x: number, y: number, z: number) { events.push(["lookAt", x, y, z]); }
    updateProjectionMatrix() { events.push(["projection", this.fov, this.aspect]); }
  }
  let error: string | undefined;
  let result: GaragePartCamera | undefined;
  try {
    if (released) {
      const original = releasedFunction("Zi", ["y", "zs", "us"],
        [field, Camera, verticalFov]) as (node: GaragePartPanelNode,
        width: number, height: number) => GaragePartCamera;
      result = original(sourcePanel, 128, 96);
    } else {
      result = createGaragePartCamera(sourcePanel, 128, 96, {
        field, verticalFov,
        createPerspectiveCamera: (fov, aspect, near, far) =>
          new Camera(fov, aspect, near, far),
      });
    }
  } catch (cause) { error = String(cause); }
  return { error, events, fov: result?.fov, aspect: result?.aspect };
}

test("part preview camera validates native fields and converts axes like release Zi", () => {
  const cases: Array<Record<string, string>> = [
    {}, { zoom: "0" }, { defaultCameraPos: "1 2" },
    { defaultSpotPos: "NaN 2 3" }, { farPlane: "0.1" }, { fov: "270" },
  ];
  for (const fields of cases)
    assert.deepEqual(cameraRun(false, fields), cameraRun(true, fields),
      JSON.stringify(fields));
});

type SceneVariant = "panel" | "load-panel" | "missing-panel" | "missing-layout" |
  "duplicate-model" | "missing-texture" | "load-failure";

async function sceneRun(released: boolean, variant: SceneVariant): Promise<unknown> {
  const events: unknown[] = [];
  const sourcePanel = panel();
  const layout = { name: "root", children: variant === "missing-panel" ? [] : [sourcePanel] };
  const record = floatRecord(1200, 2);
  const model = { kind: "prs", base: { stopTimeWord: 120, frequency: 1 },
    child: { kind: "float-controller", base: { frequency: 10 }, keys: {
      type: 1, records: [floatRecord(0, 0), record],
    } } };
  const resources = new Map<string, unknown>([
    ["gui_/windowTemplate/itemPanels.bml", layout],
    ["parts_/wing.1s", model], ["parts_/wing.png", new Uint8Array([1])],
  ]);
  const library = {
    exactCanonicalCandidates(path: string) {
      events.push(["resource", path]);
      if (variant === "duplicate-model" && path === "parts_/wing.1s")
        return [resource(path), resource(path)];
      if (variant === "missing-layout" && path.includes("itemPanels")) return [];
      if (variant === "missing-texture" && path.endsWith(".png")) return [];
      return resources.has(path) ? [resource(path)] : [];
    },
  };
  function resource(path: string) {
    return { async bytes(): Promise<Uint8Array> {
      events.push(["bytes", path]);
      return resources.get(path) as Uint8Array;
    } };
  }
  const field = (node: GaragePartPanelNode, name: string): string | undefined =>
    (node as TestPanel).fields?.[name];
  const verticalFov = (fov: number, aspect: number) => fov + aspect / 4;
  class Camera {
    aspect: number;
    fov: number;
    position = { set: (...value: number[]) => { events.push(["position", ...value]); } };
    constructor(fov: number, aspect: number, readonly near: number,
      readonly far: number) {
      this.aspect = aspect;
      this.fov = fov;
      events.push(["camera", fov, aspect, near, far]);
    }
    lookAt(...value: number[]) { events.push(["lookAt", ...value]); }
    updateProjectionMatrix() { events.push(["project", this.fov, this.aspect]); }
  }
  class Scene {
    add(object: unknown) { events.push(["scene-add", object]); }
  }
  const renderer = {
    object: "model-object",
    reset(time: number) { events.push(["reset", time]); },
    update(time: number, camera: GaragePartCamera, width: number, height: number) {
      events.push(["render", time, camera.aspect, camera.fov, width, height]);
    },
    dispose() { events.push("dispose"); },
  };
  const loadScene: GaragePartModelSceneDependencies["loadScene"] = async (
    _model, _library, path, resolveTexture, options) => {
      events.push(["load-scene", path, options]);
      resolveTexture({ name: "wing" });
      if (variant === "load-failure") throw new Error("render decode failed");
      return renderer;
    };
  const dependencies: GaragePartModelSceneDependencies = {
    field, verticalFov, parsePanel: bytes => bytes as unknown as GaragePartPanelNode,
    parseModel: bytes => bytes, createScene: () => new Scene(), loadScene,
    createPerspectiveCamera: (fov, aspect, near, far) =>
      new Camera(fov, aspect, near, far),
    now: () => 55,
  };
  const request = { path: "parts_/wing.1s",
    panel: variant === "panel" ? sourcePanel : undefined };
  let error: string | undefined;
  let durationMs: number | undefined;
  try {
    const scene = released ? await (releasedFunction("Je",
      ["j", "y", "Zi", "qs", "Ds", "Os", "performance", "Yi", "us"],
      [dependencies.parsePanel, field,
        releasedFunction("Zi", ["y", "zs", "us"], [field, Camera, verticalFov]),
        dependencies.parseModel, loadScene, Scene, { now: dependencies.now },
        releasedFunction("Yi", [], []), verticalFov]) as
      (library: unknown, request: unknown, environment: unknown, stage: unknown) =>
        Promise<Awaited<ReturnType<typeof loadGaragePartModelScene>>>)
        (library, request, "environment", "stage") :
      await loadGaragePartModelScene(library, request, "environment", "stage", dependencies);
    durationMs = scene.durationMs;
    scene.update(256, 128);
    for (const time of [50, 80, 20, 120, 0, 121]) {
      scene.seek(time);
      scene.update(320, 200);
    }
    for (const time of [-1, Number.NaN]) {
      try { scene.seek(time); }
      catch (cause) { events.push(["seek-error", String(cause)]); }
    }
    scene.dispose();
  } catch (cause) { error = String(cause); }
  return { error, durationMs, events };
}

test("part model resource loading, seeking, rendering and failures match release Je", async () => {
  for (const variant of ["panel", "load-panel", "missing-panel", "missing-layout",
    "duplicate-model", "missing-texture", "load-failure"] as const)
    assert.deepEqual(await sceneRun(false, variant), await sceneRun(true, variant), variant);
});
