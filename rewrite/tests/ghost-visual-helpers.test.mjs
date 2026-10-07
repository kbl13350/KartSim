import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  cloneGhostToonMaterials, ghostEffectNames, ghostTrailState,
} from "../src/timeattack/ghost-visual-helpers.ts";

const release = readFileSync(
  new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const sourceOf = name => {
  const node = declarations.find(item =>
    item.type === "FunctionDeclaration" && item.id.name === name);
  assert.ok(node);
  return release.slice(node.start, node.end);
};

test("Ghost trail status flags match the release", () => {
  const boosterTrail = value => value * 3;
  const original = new Function("BD", `${sourceOf("Kd0")}; return Kd0;`)(boosterTrail);
  for (const kartId of [0, 1, 999]) {
    for (const engineGrade of [0, 6, 7, 10]) {
      for (const status of [0, 1, 3, 7, 8, 88, 4096, 8192,
        12288, 32768, 4097, 8193, 12289, 0xffffffff]) {
        const vehicle = { kartId, engineGrade };
        assert.equal(ghostTrailState(status, 5, vehicle, boosterTrail),
          original(status, 5, vehicle),
          `kart=${kartId} grade=${engineGrade} status=${status}`);
      }
    }
  }
});

test("Ghost effect resource names match the release", () => {
  const ops = {
    boosterState: status => status & 15,
    boosterEffect: value => value === 0 ? undefined : `boost-${value}`,
    secondaryEffect: value => value === 0 ? undefined : `second-${value}`,
    secondaryState: status => (status >>> 4) & 3,
  };
  const original = new Function("RD", "$w", "Ww", "ID",
    `${sourceOf("tf0")}; return tf0;`)(
      ops.boosterState, ops.boosterEffect,
      ops.secondaryEffect, ops.secondaryState);
  for (const statuses of [[], [0, 3, 4, 5, 10],
    [32768 | 3 | 16, 10 | 48, 8192 | 4], [0, 0, 0]]) {
    const record = { stamps: statuses.map(status => ({ status })) };
    assert.deepEqual([...ghostEffectNames(record, ops)], [...original(record)]);
  }
});

function toonScenario(readable, collectPairs) {
  const events = [];
  class Toon {
    constructor(name) {
      this.name = name;
      this.uniforms = {
        baseMap: { value: `${name}-map` },
        toonEnv: { value: `${name}-env` },
      };
    }
    clone() {
      events.push(["clone", this.name]);
      return new Toon(`${this.name}-copy`);
    }
  }
  class Mesh {
    constructor(material) { this.material = material; }
    onBeforeRender() { events.push(["before"]); }
  }
  const ops = {
    isMesh: object => object instanceof Mesh,
    isToon: material => material instanceof Toon,
    prepareClone: clone => events.push(["prepare", clone.name]),
    refreshMesh: () => events.push(["refresh"]),
    copyToon: (source, clone) => events.push(["copy", source.name, clone.name]),
  };
  const original = new Function("D2", "zn", "OL", "ZG", "f6",
    `${sourceOf("qf")}; return qf;`)(
      Mesh, ops.isToon, ops.prepareClone, ops.refreshMesh, ops.copyToon);
  const meshes = [
    new Mesh(new Toon("single")),
    new Mesh([new Toon("left"), { name: "plain" }, new Toon("right")]),
    new Mesh({ name: "not-toon" }),
  ];
  const root = { traverse: callback => {
    callback({ name: "ignored" });
    meshes.forEach(callback);
  } };
  const pairs = collectPairs ? [] : undefined;
  const count = readable
    ? cloneGhostToonMaterials(root, pairs, ops)
    : original(root, pairs);
  if (!collectPairs) meshes[0].onBeforeRender(1, 2, 3, 4, 5, 6);
  return {
    events, count,
    pairs: pairs?.map(pair => [pair.source.name, pair.clone.name]),
    materials: meshes.map(mesh => {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      return list.map(material => [material.name,
        material.uniforms?.baseMap.value, material.uniforms?.toonEnv.value]);
    }),
  };
}

test("Ghost toon material clones and render-time uniform sync match release", () => {
  for (const collectPairs of [false, true])
    assert.deepEqual(toonScenario(true, collectPairs),
      toonScenario(false, collectPairs));
});
