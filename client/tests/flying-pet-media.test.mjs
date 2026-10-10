import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { FlyingPetAudio, loadFlyingPetAliveSound, loadFlyingPetEffect } from "../src/world/flying-pet-media.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const nodes = parse(release, { sourceType: "module" }).program.body;
function declaration(name) {
  const node = nodes.find(item => item.id?.name === name);
  assert.ok(node, `${name} missing`);
  return release.slice(node.start, node.end);
}

function fixture() {
  const log = [];
  const asset = { sound(name) {
    log.push(["sound", name]);
    return { bytes: async () => new Uint8Array([1, 2]) };
  } };
  const context = { createBufferSource() {
    const source = {
      addEventListener(event, callback, options) {
        log.push(["listen", event, options.once]); this.onended = callback;
      },
      start() { log.push(["start"]); },
      stop() { log.push(["stop"]); },
      disconnect() { log.push(["disconnect"]); },
    };
    log.push(["source"]);
    return source;
  } };
  const library = { get(path) {
    log.push(["get", path]);
    return { bytes: async () => new Uint8Array([3, 4]) };
  } };
  const deps = {
    directory: "pet/effect",
    parseScene: bytes => ({ bytes: [...bytes] }),
    buildScene: async (parsed, _library, name, resolve, options) => {
      const texture = resolve({ name: "tex" });
      log.push(["build", parsed.bytes, name, texture.status, options.convertClientCoordinates]);
      return { id: name };
    },
    decodeAudio: async (_context, bytes) => {
      log.push(["decode", [...bytes]]); return "aliveSound";
    },
    connectAudio: (_context, _source, category) => log.push(["connect", category]),
  };
  const original = new Function("DI", "W1", "y9", "Q9", "S9",
    `${declaration("$d")}\n${declaration("Tv")}\nreturn { $d, Tv };`)(
      deps.directory, deps.buildScene, deps.parseScene, deps.decodeAudio, deps.connectAudio);
  return { log, asset, context, library, deps, original };
}

async function exercise(rewritten) {
  const { log, asset, context, library, deps, original } = fixture();
  const effect = rewritten
    ? await loadFlyingPetEffect(library, "aliveFx", "env", "binding", deps)
    : await original.$d(library, "aliveFx", "env", "binding");
  const audio = rewritten
    ? new FlyingPetAudio(context, await loadFlyingPetAliveSound(asset, context, deps), deps)
    : await original.Tv.load(asset, context);
  audio.playAlive();
  audio.dispose();
  audio.dispose();
  return { effect, disposed: audio.disposed, active: audio.active.size, log };
}

test("flying pet effect and audio ownership match release", async () => {
  assert.deepEqual(await exercise(true), await exercise(false));
});
