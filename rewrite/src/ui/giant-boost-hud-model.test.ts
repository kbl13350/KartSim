import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GiantBoostGaugeState, findGiantModelCamera, findGiantModelNode,
  frameGiantModelCamera, giantControllerDuration, giantHudViewport,
  type GiantModelNode,
} from "./giant-boost-hud-model";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class I00 {");
const end = release.indexOf("\nclass Fw {", start);
assert.ok(start > 0 && end > start);

function exercise(readable: boolean) {
  const outputs: unknown[] = [];
  const applyCamera = (_camera: unknown, view: number[], projection: number[]) =>
    outputs.push(["camera", view, projection]);
  const Original = new Function("Aa", `${release.slice(start, end)}\n` +
    "return { I00, cI, lI, ig, Lx, Px };"
  )(applyCamera) as {
    I00: new (duration: number) => GiantBoostGaugeState;
    cI(node: GiantModelNode): GiantModelNode | undefined;
    lI(node: GiantModelNode, name: string): GiantModelNode | undefined;
    ig(value: unknown): number;
    Lx(model: unknown, camera: unknown, width?: number, height?: number): void;
    Px(width: number, height: number): unknown;
  };
  const createState = (duration: number) => readable
    ? new GiantBoostGaugeState(duration) : new Original.I00(duration);
  const state = createState(1000);
  const snapshot = (label: string) => outputs.push([label, state.duration, state.cells,
    state.full, state.zero, state.remaining, state.start, state.last]);
  snapshot("initial");
  for (const [kind, value, tick] of [
    ["stage", 2, 0], ["stage", 6, 10], ["stage", 0, 20],
    ["update", 0, 164], ["update", 0, 310], ["stage", 1, 320],
    ["update", 0, 1300], ["stage", 0, 1400],
    ["update", 0, 0xffffffff],
  ] as const) {
    const result = kind === "stage" ? state.stage(value, tick) : state.update(tick);
    outputs.push([kind, result ?? null]);
    snapshot(kind);
  }
  state.reset();
  snapshot("reset");
  try { createState(0); }
  catch (error) { outputs.push(["duration-error", String(error)]); }

  const cameraNode: GiantModelNode = {
    name: "camera", className: "ReCamera", children: [],
    camera: { projectionMode: 1, fieldOfViewDegrees: 76,
      nearClip: 1, farClip: 100 },
  };
  const target: GiantModelNode = { name: "부스터 게이지01", children: [] };
  const root: GiantModelNode = { kind: "node", children: [
    { name: "group", children: [target, cameraNode] },
  ] };
  const findCamera = readable ? findGiantModelCamera : Original.cI;
  const findNode = readable ? findGiantModelNode : Original.lI;
  outputs.push(["found", findCamera(root)?.name, findNode(root, target.name!)?.name,
    findNode(root, "missing")?.name]);
  const cyclic: Record<string, unknown> = { base: { stopTimeWord: 1000 },
    nested: { base: { stopTimeWord: 2500 } } };
  cyclic.self = cyclic;
  outputs.push(["duration", readable ? giantControllerDuration(cyclic) : Original.ig(cyclic)]);
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 2, -64, 5, 1];
  const model = { parsed: { root }, scene: { clientWorldElements: () => matrix } };
  for (const [width, height] of [[800, 600], [1600, 900], [320, 640]] as const) {
    if (readable) frameGiantModelCamera(model, {}, applyCamera, width, height);
    else Original.Lx(model, {}, width, height);
    outputs.push(["viewport", readable ? giantHudViewport(width, height)
      : Original.Px(width, height)]);
  }
  return outputs;
}

test("Giant Boost timing, controller scan, camera and viewport match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
