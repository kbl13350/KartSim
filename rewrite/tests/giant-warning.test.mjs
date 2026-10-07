import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { GiantWarning } from "../src/world/giant-warning.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = nodes.find(item => item.id?.name === name ||
    item.type === "VariableDeclaration" && item.declarations.some(part => part.id.name === name));
  assert.ok(node, `${name} missing`);
  return release.slice(node.start, node.end);
}

function fixture() {
  const log = [];
  class Geometry {
    attributes = {};
    setAttribute(name, attribute) { this.attributes[name] = attribute; }
    setIndex(indices) { log.push(["indices", indices]); }
    dispose() { log.push(["geometryDispose"]); }
  }
  class Attribute {
    constructor(values, itemSize) { this.values = values; this.itemSize = itemSize; }
  }
  class Material {
    constructor(options) { log.push(["material", options.transparent, options.depthWrite]); }
    dispose() { log.push(["materialDispose"]); }
  }
  class Mesh {
    constructor() { log.push(["mesh"]); }
    removeFromParent() { log.push(["meshRemove"]); }
  }
  const orientMesh = () => log.push(["orient"]);
  const deps = {
    createGeometry: () => new Geometry(),
    createAttribute: (values, itemSize) => new Attribute(values, itemSize),
    createMaterial: options => new Material(options),
    createMesh: (...args) => new Mesh(...args), orientMesh,
    repeatWrapping: 1, linearFilter: 2, normalBlending: 3,
    sourceAlpha: 4, oneMinusSourceAlpha: 5, addEquation: 6,
    doubleSide: 7, alwaysDepth: 8,
  };
  const Original = new Function("S1", "h9", "t9", "_0", "Vt", "D2", "Ao",
    "u1", "l1", "v1", "R9", "s1", "y1",
    `${declaration("M2")}\n${declaration("qr0")}\nreturn qr0;`)(
      1, 2, Geometry, Attribute, Material, Mesh, orientMesh,
      3, 4, 5, 6, 7, 8,
    );
  const texture = { dispose() { log.push(["textureDispose"]); } };
  const local = { id: "local", main: 0, position: { x: 0, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: -1 } };
  const giant = { id: "giant", main: 4, position: { x: 0, y: 0, z: 15 } };
  const farGiant = { id: "far", main: 4, position: { x: 0, y: 0, z: 80 } };
  const camera = { matrixWorld: { elements: [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, -5, 1,
  ] } };
  return { log, deps, Original, texture, local, giant, farGiant, camera };
}

function snapshot(warning) {
  return {
    selected: warning.selected, coefficient: warning.coefficient, angle: warning.angle,
    visible: warning.mesh.visible,
    positions: [...warning.positions], uvs: [...warning.uvs],
  };
}

function exercise(rewritten) {
  const { log, deps, Original, texture, local, giant, farGiant, camera } = fixture();
  const warning = rewritten ? new GiantWarning(texture, deps) : new Original(texture);
  const frames = [];
  for (const [opponents, hidden] of [
    [[farGiant, giant], false], [[giant], false], [[], false],
    [[], true], [[], false], [[], false],
  ]) {
    warning.update(local, opponents, hidden, camera);
    frames.push(snapshot(warning));
  }
  warning.dispose();
  return { frames, end: snapshot(warning), log };
}

test("giant warning target selection, quad geometry and fade match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
