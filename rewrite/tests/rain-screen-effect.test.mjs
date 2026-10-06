import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  BufferAttribute, BufferGeometry, DataTexture, MathUtils, Mesh,
  NormalBlending, PerspectiveCamera, ShaderMaterial, Vector3,
} from "three";
import { RainScreenEffect } from "../src/vehicle/rain-screen-effect.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const constants = declarations.find(node => node.type === "VariableDeclaration" &&
  node.declarations.some(part => part.id.name === "os"));
const originalClass = declarations.find(node => node.type === "ClassDeclaration" && node.id.name === "sL");
assert.ok(constants && originalClass);
const aliases = {
  t9: BufferGeometry, _0: BufferAttribute, $1: ShaderMaterial,
  X5: NormalBlending, D2: Mesh, H: Vector3, kl: MathUtils,
  ca: (mesh, key) => { mesh.userData.sortKey = key; },
};
const Original = new Function("aliases", `const { t9, _0, $1, X5, D2, H, kl, ca } = aliases;
  ${release.slice(constants.start, constants.end)}
  ${release.slice(originalClass.start, originalClass.end)}
  return sL;`)(aliases);

class Rewritten extends RainScreenEffect {
  constructor(random, initial) { super(random, initial, aliases.ca); }
}

function random() {
  let seed = 0x98abcdef;
  return { next() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; } };
}

function snapshot(effect) {
  return {
    enabled: effect.enabled,
    previousMs: effect.previousMs,
    spawnAccumulatorMs: effect.spawnAccumulatorMs,
    fadeRemainingMs: effect.fadeRemainingMs,
    queuedSpawns: effect.queuedSpawns,
    active: effect.activeParticleCount(),
    particles: effect.particles.filter(p => p.active).slice(0, 8).map(p => ({
      position: p.position.toArray(), size: p.size, speed: p.speed, lifeMs: p.lifeMs,
    })),
    positions: [...effect.positions.slice(0, 96)],
    colors: [...effect.colors.slice(0, 128)],
    drawRange: { ...effect.object.geometry.drawRange },
    material: {
      name: effect.object.material.name, toneMapped: effect.object.material.toneMapped,
      transparent: effect.object.material.transparent, blending: effect.object.material.blending,
      depthTest: effect.object.material.depthTest, depthWrite: effect.object.material.depthWrite,
      vertexColors: effect.object.material.vertexColors,
    },
    object: { name: effect.object.name, frustumCulled: effect.object.frustumCulled,
      sortKey: effect.object.userData.sortKey },
  };
}

function exercise(Type, initiallyEnabled) {
  const effect = new Type(random(), initiallyEnabled);
  const camera = new PerspectiveCamera(70, 16 / 9, 0.1, 1000);
  const states = [snapshot(effect)];
  for (const time of [1, 300, 450, 600, 750, 900, 1200, 1500]) {
    effect.update(time, camera, 1280, 720);
    states.push(snapshot(effect));
  }
  effect.setEnabled(false);
  effect.update(1800, camera, 1280, 720);
  states.push(snapshot(effect));
  effect.setEnabled(true);
  effect.update(2100, camera, 1280, 720);
  states.push(snapshot(effect));
  effect.reset(true);
  states.push(snapshot(effect));
  effect.dispose();
  return states;
}

test("rain screen renderer matches release particles and screen geometry", () => {
  for (const enabled of [false, true]) {
    const original = exercise(Original, enabled);
    assert.ok(original.some(state => state.drawRange.count > 0));
    assert.deepEqual(exercise(Rewritten, enabled), original);
  }
});
