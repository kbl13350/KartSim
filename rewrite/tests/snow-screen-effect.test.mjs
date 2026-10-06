import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import {
  BufferAttribute, BufferGeometry, DataTexture, LinearFilter, MathUtils,
  Mesh, NormalBlending, PerspectiveCamera, RGBAFormat, ShaderMaterial,
  Vector3, ClampToEdgeWrapping, SRGBColorSpace,
} from "three";
import { SnowScreenEffect, loadSnowScreenEffect } from "../src/vehicle/snow-screen-effect.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
const constants = declarations.find(node => node.type === "VariableDeclaration" &&
  node.declarations.some(part => part.id.name === "gi"));
const originalClass = declarations.find(node => node.type === "ClassDeclaration" && node.id.name === "A7");
assert.ok(constants && originalClass);
const aliases = {
  t9: BufferGeometry, _0: BufferAttribute, $1: ShaderMaterial,
  X5: NormalBlending, D2: Mesh, H: Vector3, kl: MathUtils,
  ca: (mesh, key) => { mesh.userData.sortKey = key; },
};
const Original = new Function("aliases", `const { t9, _0, $1, X5, D2, H, kl, ca } = aliases;
  ${release.slice(constants.start, constants.end)}
  ${release.slice(originalClass.start, originalClass.end)}
  return A7;`)(aliases);

class Rewritten extends SnowScreenEffect {
  constructor(random, texture) {
    super(random, texture, aliases.ca);
  }
}

function random() {
  let seed = 0x12345678;
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
      active: p.active, position: p.position.toArray(), size: p.size,
      speed: p.speed, lifeMs: p.lifeMs, u0: p.u0, u1: p.u1,
    })),
    positions: [...effect.positions.slice(0, 96)],
    colors: [...effect.colors.slice(0, 128)],
    uvs: [...effect.uvs.slice(0, 64)],
    drawRange: { ...effect.object.geometry.drawRange },
    material: {
      name: effect.object.material.name,
      toneMapped: effect.object.material.toneMapped,
      transparent: effect.object.material.transparent,
      blending: effect.object.material.blending,
      depthTest: effect.object.material.depthTest,
      depthWrite: effect.object.material.depthWrite,
      vertexColors: effect.object.material.vertexColors,
    },
    object: { name: effect.object.name, frustumCulled: effect.object.frustumCulled,
      sortKey: effect.object.userData.sortKey },
  };
}

function exercise(Type) {
  const effect = new Type(random(), new DataTexture(new Uint8Array(32 * 128 * 4), 32, 128));
  const camera = new PerspectiveCamera(70, 16 / 9, 0.1, 1000);
  const states = [snapshot(effect)];
  for (const time of [1, 500, 650, 800, 1100, 1250, 1250, 1500]) {
    effect.update(time, camera, 1280, 720);
    states.push(snapshot(effect));
  }
  effect.setEnabled(false);
  effect.update(1800, camera, 1280, 720);
  states.push(snapshot(effect));
  effect.setEnabled(true);
  effect.update(2000, camera, 1280, 720);
  states.push(snapshot(effect));
  effect.reset();
  states.push(snapshot(effect));
  effect.dispose();
  return states;
}

test("snow screen renderer matches release particle state and geometry", () => {
  const original = exercise(Original);
  const rewritten = exercise(Rewritten);
  assert.ok(original.some(state => state.drawRange.count > 0));
  assert.deepEqual(rewritten, original);
});

test("snow texture loader validates source identity before decode", async () => {
  await assert.rejects(loadSnowScreenEffect({ exactCanonicalCandidates: () => [] }, random(),
    async () => { throw new Error("unexpected decode"); }, () => { throw new Error("unexpected render"); }),
  /exact source 数量应为1/);
  await assert.rejects(loadSnowScreenEffect({ exactCanonicalCandidates: () => [
    { sourceName: "other.rho", bytes: async () => new Uint8Array() },
  ] }, random(), async () => { throw new Error("unexpected decode"); },
  () => { throw new Error("unexpected render"); }), /必须来自 theme_ice.rho/);
});
