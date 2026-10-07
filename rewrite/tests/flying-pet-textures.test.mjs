import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "@babel/parser";
import { FlyingPetTextures } from "../src/world/flying-pet-textures.ts";

const release = readFileSync(new URL("../../recovered/formatted/index.js", import.meta.url), "utf8");
const node = parse(release, { sourceType: "module" }).program.body.find(item =>
  item.type === "ClassDeclaration" && item.id.name === "mE");
assert.ok(node);
const originalClass = release.slice(node.start, node.end);

function fixture(missingFace) {
  const log = [];
  const names = ["0.png", "1.png", "f00_0.png", "f00_1.png"];
  const entries = new Map(names.map((name, index) => {
    const bytes = new Uint8Array(26);
    bytes[0] = index + 1;
    bytes[24] = 8;
    bytes[25] = 6;
    return [name, { bytes: async () => { log.push(["bytes", name]); return bytes; } }];
  }));
  if (missingFace) entries.delete("f00_1.png");
  const assets = { name: "pet", find(name) { log.push(["find", name]); return entries.get(name); } };
  const decodePng = async bytes => {
    log.push(["decode", bytes[0]]);
    return { pixels: new Uint8Array([bytes[0], 2, 3, 4]), width: 1, height: 1 };
  };
  const paintColors = (low, high, primary, highlight) => {
    log.push(["paint", low[0], high[0], primary, highlight]);
    return new Uint8Array([low[0] + high[0], 2, 3, 4]);
  };
  class Texture {
    constructor(pixels, width, height, format) {
      this.pixels = [...pixels];
      log.push(["texture", this.pixels, width, height, format]);
    }
    dispose() { log.push(["dispose", this.name]); }
  }
  const deps = {
    decodePng, paintColors,
    createTexture: (pixels, width, height, format) => new Texture(pixels, width, height, format),
    format: 1, colorSpace: 2, wrapping: 3, filtering: 4,
  };
  const Original = new Function("p2", "K6", "J9", "e9", "v9", "S1", "h9",
    `${originalClass}\nreturn mE;`)(decodePng, paintColors, Texture, 1, 2, 3, 4);
  return { log, assets, deps, Original };
}

async function exercise(rewritten, missingFace) {
  const { log, assets, deps, Original } = fixture(missingFace);
  const owner = rewritten
    ? new FlyingPetTextures(assets, 11, 22, deps)
    : new Original(assets, 11, 22);
  const body = await owner.body();
  const face = await owner.face(0);
  await owner.body();
  owner.dispose();
  owner.dispose();
  let afterDispose;
  try { owner.load("body"); } catch (error) { afterDispose = error.message; }
  return { body: body.pixels, face: face?.pixels, afterDispose, log };
}

test("flying pet painted body, optional face and cache disposal match release", async () => {
  for (const missingFace of [false, true])
    assert.deepEqual(await exercise(true, missingFace), await exercise(false, missingFace));
});
