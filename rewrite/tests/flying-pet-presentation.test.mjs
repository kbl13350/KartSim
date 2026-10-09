import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { FlyingPetPresentation } from "../src/world/flying-pet-presentation.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function original(name) {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node, `${name} missing`);
  return release.slice(node.start, node.end);
}

function fixture() {
  const log = [];
  const asset = {
    async clip(equipped, motion) {
      log.push(["clip", equipped, motion]);
      return { sequence: `${equipped ? "equipped" : "ordinary"}:${motion}` };
    },
    async model(equipped = false) { log.push(["modelAsset", equipped]); return `model:${equipped}`; },
  };
  class Skin {
    constructor(_asset, primary, high) { log.push(["skin", primary, high]); }
    dispose() { log.push(["dispose", "skin"]); }
  }
  class Animation {
    constructor(sequence) { log.push(["animation", sequence]); }
    reset(sequence) { log.push(["animationReset", sequence]); }
  }
  class Idle {
    constructor(clips) { log.push(["idle", [...clips.keys()]]); }
    reset() { log.push(["idleReset"]); }
    update(elapsed) { log.push(["idleUpdate", elapsed]); }
  }
  class State {
    local = [0.75, -0.75, 0.5];
    secondLocal = [0.75, 0.75, 0.5];
    firstVisible = true;
    secondVisible = true;
    firedVisible = true;
    aliveVisible = true;
    firedStart = 100;
    aliveStart = 100;
    update(time, _pose, scale, idle) {
      log.push(["stateUpdate", time, scale]);
      idle(16);
      return true;
    }
    launch() { log.push(["launch"]); }
    enable() { log.push(["enable"]); }
    disable() { log.push(["disable"]); }
  }
  let modelCount = 0;
  class Model {
    static async load(model, clips) {
      const id = `pet${modelCount++}`;
      log.push(["loadModel", id, model, clips]);
      return {
        object: {
          id, matrix: { elements: Array(16).fill(0) }, matrixWorld: { elements: [1] },
          visible: true,
          updateWorldMatrix(force, children) { log.push(["worldMatrix", id, force, children]); },
        },
        headSocket: { add(object) { log.push(["head", id, object.id]); } },
        update(_animation, _camera, _width, _height, time) { log.push(["petUpdate", id, time]); },
        dispose() { log.push(["dispose", id]); },
      };
    }
  }
  const loadEffect = async (_library, name) => {
    log.push(["effect", name]);
    return {
      object: { id: name, matrix: { elements: Array(16).fill(0) }, visible: true },
      reset(time) { log.push(["effectReset", name, time]); },
      update(time) { log.push(["effectUpdate", name, time]); },
      setControllerCycleMode(mode) { log.push(["cycleMode", name, mode]); },
      dispose() { log.push(["dispose", name]); },
    };
  };
  class Audio {
    static async load() { log.push(["loadAudio"]); return new Audio(); }
    playAlive() { log.push(["playAlive"]); }
    dispose() { log.push(["dispose", "audio"]); }
  }
  class Rotation {
    makeRotationX(angle) { log.push(["rotation", angle]); return this; }
    multiply() { log.push(["multiply"]); this.elements = [2]; return this; }
  }
  const loadPetAsset = async (_library, id) => { log.push(["loadAsset", id]); return asset; };
  const isVisible = (role, localVisible) => {
    log.push(["visible", role, localVisible]); return localVisible;
  };
  const renderNested = (object, callback) => { log.push(["renderNested", object.id]); callback(); };
  const deps = {
    loadPetAsset, createSkinResources: (...args) => new Skin(...args),
    createAnimation: sequence => new Animation(sequence),
    loadModel: (...args) => Model.load(...args),
    createIdleMotion: (...args) => new Idle(...args), loadEffect,
    loadAudio: (...args) => Audio.load(...args),
    createRaceState: () => new State(), isVisible,
    createRotationMatrix: () => new Rotation(), renderNested,
  };
  const Original = new Function("_3", "x4", "mE", "cc", "Ks", "or0", "cr0",
    "$d", "Tv", "hr0", "dr0", "v2", "qm", `${original("S4")}\nreturn S4;`)(
      new Function(`${original("_3")}\nreturn _3;`)(),
      { load: loadPetAsset }, Skin, Animation, Model, [0, 1, 21, 20, 8, 6, 5, 7],
      Idle, loadEffect, Audio, State, isVisible, Rotation, renderNested,
    );
  const options = {
    library: {}, item: { internalId: 17, tuneGroupId: 1 },
    colors: { primary: 2, high: 3 }, environment: {}, binding: {},
    role: "local", grandparentScale: 1.5, random: {}, audioContext: {},
    listen(callback) { this.listener = callback; return () => log.push(["unsubscribe"]); },
  };
  const mount = { add(...objects) { log.push(["mount", objects.map(object => object.id)]); } };
  return { log, deps, Original, options, mount };
}

async function preview(rewritten) {
  const { log, deps, Original, options, mount } = fixture();
  const pet = rewritten
    ? await new FlyingPetPresentation(undefined, deps).loadPreview(options, false)
    : await Original.preview(options, false);
  pet.mount(mount);
  pet.update(100, "camera", 640, 480);
  const position = pet.object.matrix.elements.slice(12, 15);
  pet.dispose();
  return { log, position };
}

async function race(rewritten) {
  const { log, deps, Original, options, mount } = fixture();
  const pet = rewritten
    ? await new FlyingPetPresentation(options, deps).loadRace(options)
    : await Original.race(options);
  pet.mount(mount);
  pet.launch();
  options.listener(true);
  pet.update(100, "camera", 640, 480, true);
  const position = pet.object.matrix.elements.slice(12, 15);
  pet.dispose();
  return { log, position };
}

test("flying pet preview and race animation lifecycle match release", async () => {
  assert.deepEqual(await preview(true), await preview(false));
  assert.deepEqual(await race(true), await race(false));
});

test("walking-room pets preload idle clips and advance/reset their own clock", async () => {
  const { log, deps, options, mount } = fixture();
  const pet = await new FlyingPetPresentation(undefined, deps)
    .loadPreview({ ...options, animate: true });
  assert.deepEqual(log.filter(entry => entry[0] === "clip").map(entry => entry[2]),
    [0, 1, 21, 20, 8, 6, 5, 7]);
  assert.equal(log.find(entry => entry[0] === "loadModel")[3].length, 8,
    "all idle face textures must be available before animation switches");
  pet.mount(mount);
  pet.update(100, "camera", 640, 480);
  pet.update(116, "camera", 640, 480);
  pet.reset();
  pet.update(2000, "camera", 640, 480);
  assert.deepEqual(log.filter(entry => entry[0] === "idleUpdate").map(entry => entry[1]), [0, 16, 0]);
  pet.dispose();
  pet.update(2016, "camera", 640, 480);
  assert.equal(log.filter(entry => entry[0] === "idleUpdate").length, 3);
});
