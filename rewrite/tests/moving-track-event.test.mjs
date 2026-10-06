import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { MovingTrackEvent } from "../src/vehicle/moving-track-event.ts";
import { eventTriangleOverlapsBox } from "../src/vehicle/event-geometry.ts";

const source = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const names = [
  "qn0", "jn0", "Xn0", "Yn0", "Hk", "Zn0", "TC", "_C", "Qn0", "Jn0",
  "e30", "t30", "n30", "i30", "r30", "s30", "Mg", "o30", "qk", "ol",
  "Kk", "al", "xg", "A0",
];
const declarations = parse(source, { sourceType: "module" }).program.body.filter(node =>
  (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") &&
  names.includes(node.id.name));
assert.deepEqual(declarations.map(node => node.id.name).sort(), [...names].sort());
const implementation = declarations.map(node => source.slice(node.start, node.end)).join("\n");

function transform(point, matrix) {
  const f = Math.fround;
  return {
    x: f(point[0] + matrix.shift[0]),
    y: f(point[1] + matrix.shift[1]),
    z: f(point[2] + matrix.shift[2]),
  };
}
const Original = new Function("e3", `${implementation}\nreturn qn0;`)(transform);
const originalOverlaps = new Function("e3", `${implementation}\nreturn jn0;`)(transform);
const Rewritten = class extends MovingTrackEvent {
  constructor(root, projection) { super(root, projection, { transformPoint: transform }); }
};

function sampleScene() {
  const root = {
    name: "root", children: [
      { name: "jump", children: [], vertexData: { positions: [
        [0, 0, 0], [2, 0, 0], [0, 2, 0], [1, 1, 1],
      ] } },
      { name: "slope", children: [], vertexData: { positions: [
        [0, 0, 0], [0, 0, 2], [0, 2, 0],
      ] }, rigidGeometry: { positions: [[3, 0, 1]] } },
    ],
  };
  const projection = { triangleBindings: [
    { nodePreorderPath: [0, 0], indices: [0, 1, 2] },
    { nodePreorderPath: [0, 1], indices: [0, 1, 2] },
  ] };
  return { root, projection };
}

function snapshot(event, output) {
  return JSON.parse(JSON.stringify({
    output, lastUpdateMs: event.lastUpdateMs, center: event.center,
    radius: event.radius, triangles: event.triangles,
    bindings: event.bindings.map(binding => ({
      normal: binding.normal, motion: binding.motion,
      previousCenter: binding.previousCenter,
    })),
  }));
}

function exercise(Type) {
  const { root, projection } = sampleScene();
  const event = new Type(root, projection);
  const states = [snapshot(event)];
  const poses = [
    [10, [0, 0, 0]], [10, [0, 0, 0]],
    [110, [2, 1, 0]], [115, [3, 1, 0]],
    [0xfffffffe, [-1, 2, 0]], [2, [0, 0, 0]],
  ];
  for (const [time, shift] of poses) {
    event.update(time, () => ({ shift }));
    states.push(snapshot(event, {
      at: time,
      center: event.registrationCenter(),
      radius: event.modelRadius(),
      throttleNear: event.shouldThrottle(time + 10, { x: 0, y: 0, z: 0 }),
      throttleFar: event.shouldThrottle(time + 10, { x: 100, y: 100, z: 100 }),
      radiusNear: event.isInsideRegistrationRadius({ x: 0, y: 0, z: 0 }),
      radiusFar: event.isInsideRegistrationRadius({ x: 100, y: 100, z: 100 }),
      hit: event.firstOverlap({
        center: { x: shift[0], y: shift[1], z: shift[2] },
        axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
        halfExtents: [1, 1, 1],
      }),
      miss: event.firstOverlap({
        center: { x: 100, y: 100, z: 100 },
        axes: [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }],
        halfExtents: [1, 1, 1],
      }),
    }));
  }
  event.reset();
  states.push(snapshot(event));
  return states;
}

test("moving event triangle transforms, collision and wrap clock match release", () => {
  assert.deepEqual(exercise(Rewritten), exercise(Original));
});

test("moving event binding and missing matrix errors match release", () => {
  for (const broken of [
    { triangleBindings: [{ nodePreorderPath: [1], indices: [0, 1, 2] }] },
    { triangleBindings: [{ nodePreorderPath: [0, 9], indices: [0, 1, 2] }] },
    { triangleBindings: [{ nodePreorderPath: [0, 0], indices: [0, 9, 2] }] },
  ]) {
    const { root } = sampleScene();
    let before, after;
    try { new Original(root, broken); } catch (error) { before = error.message; }
    try { new Rewritten(root, broken); } catch (error) { after = error.message; }
    assert.equal(after, before);
  }
  for (const Type of [Original, Rewritten]) {
    const { root, projection } = sampleScene();
    assert.throws(() => new Type(root, projection).update(1, () => undefined),
      /event 缺少上一轮 scene world matrix/);
  }
});

test("oriented box and triangle intersection matches release across poses", () => {
  let state = 0x245f813a;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const coordinate = () => Math.fround(random() * 12 - 6);
  const point = () => ({ x: coordinate(), y: coordinate(), z: coordinate() });
  for (let i = 0; i < 300; i += 1) {
    const angle = random() * Math.PI * 2;
    const cosine = Math.fround(Math.cos(angle)), sine = Math.fround(Math.sin(angle));
    const box = {
      center: point(),
      axes: [
        { x: cosine, y: sine, z: 0 },
        { x: -sine, y: cosine, z: 0 },
        { x: 0, y: 0, z: 1 },
      ],
      halfExtents: [random() * 3, random() * 3, random() * 3],
    };
    const triangle = { a: point(), b: point(), c: point(),
      normal: point(), motion: point() };
    assert.equal(eventTriangleOverlapsBox(triangle, box), originalOverlaps(triangle, box),
      `triangle/box case ${i}`);
  }
});
