import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

import { decodeBinaryXml } from "../codecs/binary-xml";
import { RhoReader } from "../codecs/rho";
import type { RhoArchiveIndex } from "./archive-index";
import { loadTrackConfig, type TrackConfigResource } from "./track-config";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const release = readFileSync(path.resolve(project, "../recovered/formatted/index.js"), "utf8");
const from = release.indexOf("class Sw {");
const to = release.indexOf("\nconst BZ = ", from);
assert.ok(from >= 0 && to > from);
(globalThis as unknown as { document: unknown }).document = {
  createElement: () => ({ relList: { supports: () => true } }),
};
const { x1 } = await import("../generated/formats.js");
const dependencies = { parseBml: decodeBinaryXml, parseXml: x1 };

const ReleaseLibrary = new Function("s2", "x1", `${release.slice(from, to)}\nreturn Sw;`)(
  decodeBinaryXml, x1,
) as new (input: { files: TrackConfigResource[]; [field: string]: unknown }) => {
  byCanonicalPath: Map<string, TrackConfigResource[]>;
  get(path: string): TrackConfigResource | undefined;
  loadTrackConfig(path: string): Promise<unknown>;
};

class AuthoredLibrary extends ReleaseLibrary {
  loadTrackConfig(modelPath: string) { return loadTrackConfig(this, modelPath, dependencies); }
}

function setup<T>(Constructor: new (input: any) => T, files: TrackConfigResource[]): T {
  return new Constructor({
    files, archives: [], errors: [], warnings: [], region: "cn", manifestAvailable: false,
    manifestMountPaths: new Set(), archiveIndexes: { rho: [], rho5: [] },
  });
}

function resource(virtualPath: string, containerId: string, extension: string,
  bytes: Uint8Array = new Uint8Array()): TrackConfigResource {
  return {
    virtualPath, canonicalPath: virtualPath, containerId, extension, sourceName: `${containerId}.rho`,
    bytes: async () => bytes,
  };
}

async function outcome(operation: () => Promise<unknown>): Promise<unknown> {
  try { return { value: await operation() }; }
  catch (error) { return { error: error instanceof Error ? error.message : String(error) }; }
}

test("缺失、同容器选择和配置歧义保持 release 行为", async () => {
  const model = resource("track_ice_I01/track.1s", "track", "1s");
  const otherConfig = resource("track_ice_I01/track.bml", "other", "bml");
  const original = setup(ReleaseLibrary, [model, otherConfig]);
  const authored = setup(AuthoredLibrary, [model, otherConfig]);
  assert.deepEqual(await authored.loadTrackConfig(model.virtualPath),
    await original.loadTrackConfig(model.virtualPath));
  assert.deepEqual(await outcome(() => authored.loadTrackConfig("missing")),
    await outcome(() => original.loadTrackConfig("missing")));
  const withoutContainer = resource("track_ice_I02/track.1s", "", "1s");
  assert.deepEqual(await outcome(() => setup(AuthoredLibrary, [withoutContainer]).loadTrackConfig(withoutContainer.virtualPath)),
    await outcome(() => setup(ReleaseLibrary, [withoutContainer]).loadTrackConfig(withoutContainer.virtualPath)));
  const duplicate = [model, resource("track_ice_I01/track.bml", "track", "bml"),
    resource("track_ice_I01/track.xml", "track", "xml")];
  assert.deepEqual(await outcome(() => setup(AuthoredLibrary, duplicate).loadTrackConfig(model.virtualPath)),
    await outcome(() => setup(ReleaseLibrary, duplicate).loadTrackConfig(model.virtualPath)));
});

test("真实 p3553 track.bml 与原版解析结果一致", async () => {
  const index = JSON.parse(inflateSync(readFileSync(path.resolve(project,
    "../mirror/__p3553/archive-index"))).toString("utf8")) as { rho: RhoArchiveIndex[] };
  const archive = index.rho.find(item => item.name === "track_fairy_I01.rho");
  assert.ok(archive);
  const archiveBytes = readFileSync(path.resolve(project, "../mirror/p3553", archive.name));
  const copy = (chunk: Uint8Array): ArrayBuffer => Uint8Array.from(chunk).buffer as ArrayBuffer;
  const reader = new RhoReader({
    name: archive.name, size: archiveBytes.length,
    arrayBuffer: async () => copy(archiveBytes),
    slice: (start = 0, end = archiveBytes.length) => ({
      arrayBuffer: async () => copy(archiveBytes.subarray(start, end)),
    }),
  }, archive);
  const model = resource("track_fairy_I01/track.1s", "rho:fairy", "1s");
  const config = resource("track_fairy_I01/track.bml", "rho:fairy", "bml",
    await reader.read("track.bml"));
  const original = setup(ReleaseLibrary, [model, config]);
  const authored = setup(AuthoredLibrary, [model, config]);
  const expected = await original.loadTrackConfig(model.virtualPath);
  const actual = await authored.loadTrackConfig(model.virtualPath);
  assert.deepEqual(actual, expected);
  assert.equal((actual as { root: { name: string } }).root.name, "trackInfo");
});
