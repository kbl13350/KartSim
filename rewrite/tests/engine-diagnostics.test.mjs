import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { Euler, Quaternion } from "three";
import {
  cameraDiagnostics, collectEngineDiagnostics, formatDiagnosticsLines,
} from "../src/ui/engine-diagnostics.ts";
import { PerformanceCounter } from "../src/ui/performance-counter.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function sourceOf(name) {
  const declaration = declarations.find(node =>
    node.id?.name === name ||
    node.declarations?.some(part => part.id.name === name));
  assert.ok(declaration, name);
  return release.slice(declaration.start, declaration.end);
}
const originalCollect = new Function("o5",
  `${sourceOf("Xo0")}\n${sourceOf("jo0")}; return jo0;`)(Euler);
const originalFormat = new Function(
  `${sourceOf("Nv")}\n${["i1", "$g", "De", "yc", "qo0"].map(sourceOf).join("\n")}; return qo0;`,
)();

function input(hiddenTrack = false) {
  const track = { name: "West:TimeAttackRenderScene", visible: !hiddenTrack, parent: null };
  const geometry = { drawRange: { count: Infinity }, index: { count: 63 },
    attributes: { position: { count: 120 } } };
  const material = { name: "road" };
  const scene = [
    track,
    { name: "road", visible: true, parent: track, isMesh: true,
      geometry, material: [material, material] },
    { name: "wall", visible: false, parent: track, isMesh: true,
      geometry: { drawRange: { count: 9 }, attributes: { position: { count: 12 } } },
      material },
    { name: "fx", visible: true, parent: null, isSprite: true, material: { name: "fx" } },
  ];
  return {
    renderer: {
      getDrawingBufferSize(size) { size.x = 1920; size.y = 1080; },
      getPixelRatio() { return 1.5; },
      info: { memory: { geometries: 7, textures: 13 }, programs: [1, 2] },
      capabilities: { isWebGL2: true, maxTextures: 16, maxTextureSize: 8192 },
    },
    scene: { traverse(visit) { scene.forEach(visit); } },
    camera: { quaternion: new Quaternion().setFromEuler(new Euler(0.17, 0.2, 0.1)),
      position: { x: 1.235, y: -5.624, z: 14.678 }, fov: 62.345,
      near: 0.1, far: 700 },
    drawingBufferSize: { x: 0, y: 0 },
    renderStats: { calls: 10, triangles: 100, lines: 3, points: 2, frame: 42 },
    network: [{ peer: 2, route: "relay", candidate: "srflx", rttMs: 31.5,
      stateAgeMs: 45.5, bufferedBytes: 12, sent: 30, received: 31,
      relayed: 1, dropped: 0, repairs: 2 }],
    raceStartProgramCount: 1,
    active: { multiplayer: true, track: true, unused: false },
    options: { boostBlur: true, toonLine: false, shadow: true, dualBoostAuto: false },
    maxRafDelayMs: 12.5,
  };
}

test("engine scene, renderer, track and camera diagnostics match release", () => {
  for (const hidden of [false, true]) {
    const expected = originalCollect(input(hidden));
    const actual = collectEngineDiagnostics(input(hidden));
    assert.deepEqual(actual, expected);
    assert.deepEqual(cameraDiagnostics(input(hidden).camera), expected.camera);
  }
});

test("F3 diagnostics text matches release with and without an engine", () => {
  const counter = new PerformanceCounter();
  counter.beginRace(100);
  counter.recordFrame(20, 5, 120);
  const frame = counter.summary();
  for (const engine of [null, collectEngineDiagnostics(input())]) {
    assert.deepEqual(formatDiagnosticsLines(engine, frame, 57.9),
      originalFormat(engine, frame, 57.9));
  }
  counter.dispose();
});
