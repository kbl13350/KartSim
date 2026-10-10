import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { TrackEventEffectPool, eventTemplateCounts, hasEventSound } from "../src/world/track-event-effect-pool.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const declarations = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = declarations.find(node =>
    (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id?.name === name ||
    node.type === "VariableDeclaration" && node.declarations.some(part => part.id.name === name));
  assert.ok(node, `${name} declaration missing from release`);
  return release.slice(node.start, node.end);
}
const originalSource = ["Lv", "zr0", "Ur0", "$r0", "BE", "gl", "RE", "Wr0", "Hr0", "b7"]
  .map(declaration).join("\n");

function fixture() {
  const log = [];
  let sceneId = 0;
  const entries = new Map([
    ["item/eventObject/Spark.1s", [{ bytes: async () => new Uint8Array([1, 2]) }]],
    ["item/eventObject/Chime.ogg", [{ bytes: async () => new Uint8Array([3, 4]) }]],
  ]);
  const library = {
    exactCanonicalCandidates(path) {
      log.push(["candidate", path]);
      return entries.get(path) ?? [];
    },
  };
  const mount = { add(object) { log.push(["mount", object.id]); } };
  const audio = {
    createBufferSource() {
      const id = `audio${log.filter(event => event[0] === "createSound").length}`;
      log.push(["createSound", id]);
      return {
        buffer: undefined, onended: null,
        start() { log.push(["startSound", id]); },
        stop() { log.push(["stopSound", id]); },
        disconnect() { log.push(["disconnectSound", id]); },
      };
    },
  };
  const effects = [
    { model: "Spark", soundName: "Chime", soundType: 1, distance: 10 },
    { model: "spark", soundName: "Chime", soundType: 2, distance: -1 },
    { model: "Missing", soundName: "Silent", soundType: 0, distance: 0 },
  ];
  const events = effects.map(effect => ({ effect }));
  const parseScene = bytes => ({ bytes: [...bytes] });
  const resolveTextureSource = (_library, _path, reference) => ({
    status: "found", source: { kind: "track", canonicalPrefix: "item/eventObject" },
    entry: { id: reference.name },
  });
  const buildScene = async (_parsed, _library, name, resolve, options) => {
    const id = `scene${sceneId++}`;
    const resolved = resolve({ name: "sprite" });
    log.push(["build", id, name, resolved.status, options.advanceEnvironment]);
    return {
      object: { id, removeFromParent() { log.push(["unmount", id]); } },
      reset(time) { log.push(["reset", id, time]); },
      update(time, _camera, width, height) { log.push(["update", id, time, width, height]); },
      dispose() { log.push(["dispose", id]); },
    };
  };
  const decodeSound = async (_audio, bytes) => {
    log.push(["decodeSound", [...bytes]]);
    return { id: "decoded" };
  };
  const connectSound = () => { log.push(["connectSound"]); };
  const dependencies = { parseScene, buildScene, resolveTextureSource, decodeSound, connectSound };
  const Original = new Function("y9", "W1", "sn", "Q9", "S9",
    `${originalSource}\nreturn b7;`)(
      parseScene, buildScene,
      (sourceLibrary, path, _unused, reference) => resolveTextureSource(sourceLibrary, path, reference),
      decodeSound, connectSound,
    );
  return { log, library, mount, audio, effects, events, dependencies, Original };
}

function summary(pool, log) {
  return {
    templates: [...pool.templates].map(([key, value]) => [key, value.spare.length]),
    active: pool.activeScenes.length,
    sounds: [...pool.soundBuffers.keys()],
    playing: [...pool.playingSounds.keys()],
    pending: pool.pendingBuilds,
    disposed: pool.disposed,
    texturesDisposed: pool.texturesDisposed,
    log,
  };
}

async function exercise(rewritten) {
  const harness = fixture();
  const { library, mount, audio, events, effects, dependencies, log, Original } = harness;
  const pool = rewritten
    ? await new TrackEventEffectPool(library, mount, "env", "stage", audio, dependencies).loadEvents(events)
    : await Original.load(library, events, mount, "env", "stage", audio);
  const loaded = summary(pool, [...log]);
  pool.trigger(effects[0], 12.8);
  const triggered = summary(pool, [...log]);
  await new Promise(resolve => setImmediate(resolve));
  pool.trigger(effects[1], 25);
  pool.update(26, "camera", 640, 480);
  pool.remove(effects[0]);
  for (const sound of pool.playingSounds.values()) sound.onended?.();
  const running = summary(pool, [...log]);
  pool.dispose();
  return { loaded, triggered, running, final: summary(pool, [...log]) };
}

test("event effect clone, sound, replenish and teardown match the release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});

test("event model grouping and sound eligibility match release helpers", () => {
  const { Original } = fixture();
  assert.equal(typeof Original, "function");
  const effects = [
    { model: "One", soundName: "x", soundType: 0, distance: -1 },
    { model: "one", soundName: "x", soundType: 1, distance: -1 },
    { model: "Two", soundName: "x", soundType: 2, distance: -1 },
    { model: "TWO", soundName: "x", soundType: 2, distance: 0 },
  ];
  const originalHelpers = new Function(`${declaration("zr0")}\n${declaration("BE")}\n${declaration("gl")}; return { zr0, BE };`)();
  assert.deepEqual([...eventTemplateCounts(effects)], [...originalHelpers.zr0(effects)]);
  assert.deepEqual(effects.map(hasEventSound), effects.map(originalHelpers.BE));
});
