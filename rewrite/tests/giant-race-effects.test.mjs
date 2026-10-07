import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { GiantRaceEffects } from "../src/world/giant-race-effects.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const originalNode = parse(release, { sourceType: "module" }).program.body.find(node =>
  node.type === "ClassDeclaration" && node.id.name === "Fv");
assert.ok(originalNode);
const originalClass = release.slice(originalNode.start, originalNode.end);

function fixture() {
  const log = [];
  let groupId = 0;
  let effectId = 0;
  class Group {
    constructor() {
      this.id = `group${groupId++}`;
      this.matrix = { set: (...values) => log.push(["matrix", this.id, values]) };
      this.visible = true;
    }
    add(child) { log.push(["child", this.id, child.id]); }
    removeFromParent() { log.push(["remove", this.id]); }
  }
  class Texture {
    constructor(pixels, width, height) {
      log.push(["texture", [...pixels], width, height]);
    }
  }
  class Warning {
    constructor(texture) {
      this.mesh = { id: "warning" };
      log.push(["warning", texture.flipY, texture.needsUpdate]);
    }
    update(local, others, visibility, camera) {
      log.push(["warningUpdate", local.id, others.map(actor => actor.id), visibility, camera]);
    }
    dispose() { log.push(["warningDispose"]); }
  }
  const attribute = (node, name) => node.attrs[name];
  const parseBml = () => ({ children: [
    { name: "state", attrs: { name: "Affect", fired: "fired00", item: "burst", itemFx: "giantReset", life: "1000" } },
    { name: "state", attrs: { name: "Affect", item: "arrow", life: "30000" } },
  ] });
  const exactEntry = (_library, path) => ({
    bytes: async () => { log.push(["bytes", path]); return new TextEncoder().encode(path); },
  });
  const build = async (_library, path, _textures, _options, advance, parsed) => {
    const id = `effect${effectId++}`;
    log.push(["build", id, path, advance, parsed ?? null]);
    return {
      parsed: parsed ?? `parsed:${path}`,
      scene: {
        object: { id },
        reset(time) { log.push(["reset", id, time]); },
        update(time, camera, width, height) { log.push(["update", id, time, camera, width, height]); },
        dispose() { log.push(["dispose", id]); },
      },
    };
  };
  const decodeSound = async (_audio, bytes) => {
    const name = new TextDecoder().decode(bytes);
    log.push(["decodeSound", name]);
    return name;
  };
  const connectSound = (_audio, _source, category) => log.push(["connectSound", category]);
  const decodeImage = async bytes => {
    log.push(["decodeImage", new TextDecoder().decode(bytes)]);
    return { pixels: new Uint8Array([1, 2, 3]), width: 1, height: 1 };
  };
  const dependencies = {
    parseBml, attribute, exactEntry, createGroup: () => new Group(),
    decodeSound, connectSound, decodeImage,
    createTexture: (pixels, width, height) => new Texture(pixels, width, height),
    createWarning: texture => new Warning(texture), build,
  };
  const Original = new Function("s2", "Yi", "T", "T2", "Q9", "p2", "J9", "qr0", "aI", "S9",
    `${originalClass}\nreturn Fv;`)(
      parseBml, exactEntry, attribute, Group, decodeSound, decodeImage, Texture,
      Warning, build, connectSound,
    );
  const world = { add(object) { log.push(["world", object.id]); } };
  const audio = {
    createBufferSource() {
      const id = `sound${log.filter(item => item[0] === "createSound").length}`;
      log.push(["createSound", id]);
      return {
        buffer: undefined, loop: false, onended: null,
        start() { log.push(["startSound", id, this.buffer, this.loop]); },
        stop() { log.push(["stopSound", id]); },
        disconnect() { log.push(["disconnectSound", id]); },
      };
    },
  };
  const stage = (cells, time) => log.push(["stage", cells, time]);
  const pose = {
    right: { x: 1, y: 0, z: 0 },
    forward: { x: 0, y: 0, z: 1 },
    up: { x: 0, y: 1, z: 0 },
    position: { x: 2, y: 3, z: 4 },
  };
  function actor(id, local, main) {
    const visuals = [];
    return {
      id, visuals,
      logic: {
        local, main, mainScale: { z: 2 },
        consumeVisuals() { return visuals.splice(0); },
      },
      pose() { return pose; },
    };
  }
  const actors = [actor("local", true, 4), actor("rival", false, 0)];
  return { log, dependencies, Original, world, audio, stage, actors };
}

function snapshot(owner, log) {
  return {
    actorCount: owner.actors.length,
    spareCounts: owner.actors.map(entry => entry.spare.length),
    explosions: owner.explosions.length,
    arrowVisible: owner.actors.map(entry => entry.mount.visible),
    sounds: [...owner.sounds.keys()],
    activeSounds: owner.sources.size,
    pending: owner.pending,
    disposed: owner.disposed,
    log: [...log],
  };
}

async function exercise(rewritten) {
  const harness = fixture();
  const { log, Original, world, audio, stage, actors, dependencies } = harness;
  const owner = rewritten
    ? await new GiantRaceEffects({}, world, {}, audio, stage, dependencies).loadActors(actors)
    : await Original.load({}, world, actors, {}, audio, stage);
  const loaded = snapshot(owner, log);
  owner.textures.set("sample", { dispose() { log.push(["textureDispose"]); } });
  owner.setThreatSound(true);
  owner.setThreatSound(false);
  actors[0].visuals.push({ kind: "stage", cells: [1, 2], atMs: 100 });
  actors[1].visuals.push({ kind: "reset", atMs: 100 });
  owner.update(100, "camera", 640, 480, "near");
  const active = snapshot(owner, log);
  await new Promise(resolve => setImmediate(resolve));
  owner.update(1101, "camera", 640, 480, "far");
  const expired = snapshot(owner, log);
  owner.dispose();
  owner.dispose();
  return { loaded, active, expired, final: snapshot(owner, log) };
}

test("giant race resource load, warning, bursts and cleanup match release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});
