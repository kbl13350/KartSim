import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CoatingOwner, type CoatingOwnerOps, type CoatingSelection } from "./coating-owner";

const release = readFileSync(new URL("../../../recovered/formatted/index.js", import.meta.url), "utf8");
const start = release.indexOf("class d7 {");
const end = release.indexOf("const RS =", start);
assert.ok(start >= 0 && end > start);
const originalClass = release.slice(start, end);

function harness(fail = false) {
  const events: string[] = [];
  const archive = { name: "archive" };
  class Textures {
    constructor(_archive: typeof archive) { events.push("textures.create"); }
    advance(time: number) { events.push(`textures.advance=${time}`); }
    dispose() { events.push("textures.dispose"); }
  }
  const scene = { setCoatingProjection: (projection: string | undefined) => {
    events.push(`scene.projection=${projection}`);
  } };
  const loadProjection = async (
    _archive: typeof archive, _visual: string, _body: string, generation: number,
    selection: CoatingSelection, _textures: Textures,
  ) => {
    events.push(`projection.load=${generation},${selection.coating}`);
    if (fail) throw Error("projection failed");
    return "projection";
  };
  const original = new Function("Ak", "yB", `${originalClass}return d7;`)(loadProjection, Textures) as {
    load(archiveArg: typeof archive, sceneArg: typeof scene, visual: string, body: string, generation: number,
      selection: CoatingSelection | undefined, injected: Textures | undefined): Promise<CoatingOwner<string, Textures> | undefined>;
  };
  const ops: CoatingOwnerOps<typeof archive, string, string, string, Textures> = {
    createTextures: archiveArg => new Textures(archiveArg), loadProjection,
  };
  return { archive, scene, Textures, original, ops, events };
}

async function trace(useOriginal: boolean, selection: CoatingSelection | undefined, injected: boolean, fail = false) {
  const h = harness(fail);
  const textures = injected ? new h.Textures(h.archive) : undefined;
  let owner: CoatingOwner<string, InstanceType<typeof h.Textures>> | undefined;
  try {
    owner = useOriginal
      ? await h.original.load(h.archive, h.scene, "visual", "body", 9, selection, textures)
      : await CoatingOwner.load(h.archive, h.scene, "visual", "body", 9, selection, textures, h.ops);
  } catch (error) { return { error: (error as Error).message, events: h.events }; }
  if (!owner) return { absent: true, events: h.events };
  const keys = Object.keys(owner);
  owner.advance(100.9);
  owner.advance(-1.2);
  owner.dispose();
  owner.advance(200);
  owner.dispose();
  return { keys, ownsTextures: owner.ownsTextures, disposed: owner.disposed, events: h.events };
}

test("coating owner allocation, borrowed manager and update behavior match release", async () => {
  for (const selection of [undefined, {}, { coating: 7 }]) {
    for (const injected of [false, true]) {
      assert.deepEqual(await trace(false, selection, injected), await trace(true, selection, injected));
    }
  }
});

test("coating owner failure disposes only locally allocated textures like release", async () => {
  for (const injected of [false, true]) {
    assert.deepEqual(await trace(false, { coating: 7 }, injected, true),
      await trace(true, { coating: 7 }, injected, true));
  }
});
