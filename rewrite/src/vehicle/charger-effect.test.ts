import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CHARGER_EFFECT_PATH, ChargerEffect, type ChargerEffectOps, type ChargerSceneObject } from "./charger-effect";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class tv {");
const end = release.indexOf("function ve0(n) {", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

function harness(candidateCount = 1) {
  const events: string[] = [];
  const mesh = { isMesh: true };
  class Object3D implements ChargerSceneObject {
    visible = true;
    add(_object: ChargerSceneObject) { events.push("parent.add"); }
    traverse(visit: (node: { isMesh?: boolean }) => void) {
      visit(mesh);
      visit({ isMesh: false });
    }
    removeFromParent() { events.push("scene.remove"); }
  }
  const scene = {
    object: new Object3D(),
    playControllers: (now: number, offset: number) => { events.push(`play=${now},${offset}`); },
    stopControllers: (now: number) => { events.push(`stop=${now}`); },
    update: (now: number, frame: unknown, environment: unknown, options: unknown) => {
      events.push(`update=${now},${frame},${environment},${options}`);
    },
    dispose: () => { events.push("scene.dispose"); },
  };
  const archive = { exactCanonicalCandidates: (path: string) => {
    events.push(`candidates=${path}`);
    return Array.from({ length: candidateCount }, () => ({
      virtualPath: "virtual/charger.1s", bytes: async () => { events.push("bytes"); return "model-bytes"; },
    }));
  } };
  const decodeModel = (bytes: unknown) => { events.push(`decode=${bytes}`); return `decoded:${bytes}`; };
  const loadModel = async (data: string, _archive: typeof archive, path: string, identity: { id: "effect:charger" }, options: unknown) => {
    events.push(`model=${data},${path},${identity.id},${JSON.stringify(options)}`);
    return scene;
  };
  const prepareTexture = (_object: ChargerSceneObject) => { events.push("prepare-texture"); };
  const configureMesh = (_node: { isMesh?: boolean }, order: -1000, transparent: true, bias: -0.01) => {
    events.push(`mesh=${order},${transparent},${bias}`);
  };
  const configureMaterials = (_object: ChargerSceneObject) => { events.push("prepare-materials"); };
  const original = new Function("BS", "c5", "y9", "ye0", "ie", "me0", "we0", "ve0",
    `${originalClass}return tv;`,
  )(CHARGER_EFFECT_PATH, loadModel, decodeModel, prepareTexture, configureMesh, -1000, -0.01, configureMaterials) as {
    load(archiveArg: typeof archive, parent: { object: ChargerSceneObject }, environment: unknown, stage: unknown): Promise<ChargerEffect>;
  };
  const ops: ChargerEffectOps<string> = { decodeModel, loadModel, prepareTexture, configureMesh, configureMaterials };
  return { events, scene, archive, parent: { object: new Object3D() }, original, ops };
}

async function trace(useOriginal: boolean, candidateCount = 1) {
  const h = harness(candidateCount);
  let effect: ChargerEffect;
  try {
    effect = useOriginal
      ? await h.original.load(h.archive, h.parent, "environment", "stage")
      : await ChargerEffect.load(h.archive, h.parent, "environment", "stage", h.ops);
  } catch (error) { return { error: (error as Error).message, events: h.events }; }
  const keys = Object.keys(effect);
  const initialVisible = h.scene.object.visible;
  effect.update(100.9, false, 0, "f", "env", "opt");
  effect.update(101.2, true, -1.4, "f", "env", "opt");
  effect.update(102.8, true, 5, "f", "env", "opt");
  effect.update(103.6, false, 0, "f", "env", "opt");
  effect.update(104.4, true, 3, "f", "env", "opt");
  effect.reset(-1.2);
  const afterReset = { active: effect.active, visible: h.scene.object.visible };
  effect.dispose();
  return { keys, initialVisible, afterReset, events: h.events };
}

test("charger visual transitions, frame time coercion and reset match release", async () => {
  assert.deepEqual(await trace(false), await trace(true));
});

test("charger requires exactly one original effect asset like release", async () => {
  for (const count of [0, 2]) {
    assert.deepEqual(await trace(false, count), await trace(true, count));
  }
});
