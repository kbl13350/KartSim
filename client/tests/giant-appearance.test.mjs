import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { GiantAppearance } from "../src/world/giant-appearance.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "ClassDeclaration" && item.id.name === "Kr0");
assert.ok(node);
const originalClass = release.slice(node.start, node.end);

function fixture() {
  const log = [];
  let materialId = 0;
  class Material {
    constructor(normalUv = false) {
      this.id = `material${materialId++}`;
      this.uniforms = {
        alphaTestEnabled: { value: 0 }, alphaFunction: { value: 0 },
        alphaReference: { value: 0 },
      };
      if (normalUv) this.uniforms.normalUvOffset = { value: { x: 0, y: 0 } };
    }
    clone() {
      const clone = new Material(!!this.uniforms.normalUvOffset);
      log.push(["clone", this.id, clone.id]);
      return clone;
    }
    dispose() { log.push(["dispose", this.id]); }
  }
  const outline = (mesh, options) =>
    log.push(["outline", mesh.id, options?.selector, options?.centerArgb, options?.outerArgb]);
  const rootConsumer = mesh => {
    log.push(["consumer", mesh.id]);
    return () => log.push(["restoreConsumer", mesh.id]);
  };
  const deps = {
    applyOutline: outline,
    isMaterial: value => value instanceof Material,
    hasNormalUvOffset: material => material.uniforms?.normalUvOffset !== undefined,
    restoreRootConsumer: rootConsumer,
    normalUvY: 0.6796875,
    blending: 1, sourceAlpha: 2, oneMinusSourceAlpha: 3, addEquation: 4,
  };
  const Original = new Function("Ab", "$1", "zn", "QG", "NL", "u1", "l1", "v1", "R9",
    `${originalClass}\nreturn Kr0;`)(outline, Material, deps.hasNormalUvOffset,
      rootConsumer, deps.normalUvY, 1, 2, 3, 4);
  function binding(id, normalUv, inheritsRootAlpha) {
    const mesh = {
      id, material: new Material(normalUv),
      onBeforeRender() { log.push(["before", id]); },
    };
    return { mesh, inheritsRootAlpha };
  }
  const kart = [binding("kart", true, false)];
  const character = [binding("rider", false, true)];
  return { log, deps, Original, kart, character };
}

function exercise(rewritten) {
  const { log, deps, Original, kart, character } = fixture();
  const owner = rewritten
    ? new GiantAppearance(true, kart, character, deps)
    : new Original(true, kart, character);
  const states = [];
  for (const [state, effect] of [[1, 2], [4, 2], [4, 2], [0, 0]]) {
    owner.update(state, effect);
    for (const { mesh } of [...kart, ...character]) mesh.onBeforeRender();
    states.push({ purple: owner.purple, transparent: owner.transparent,
      clones: owner.clones.length, materials: [...kart, ...character].map(item => item.mesh.material.id) });
  }
  owner.dispose();
  return { states, log };
}

test("giant appearance outlines and translucent material ownership match release", () => {
  assert.deepEqual(exercise(true), exercise(false));
});
